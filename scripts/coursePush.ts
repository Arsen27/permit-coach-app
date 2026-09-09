import { readFileSync } from 'node:fs';
import { join } from 'node:path';

import type {
  CourseDocV2,
  ModuleDocV2,
  UpdateInstructionV2,
} from '../src/data/course/v2/wire.ts';

// Hands a built course package to the content server. Releases live in the
// server's database now, so a build produces a package and pushes it: the
// server turns it into a draft, and optionally releases it in the same call
// with every rule of the update contract checked. Publishing to a channel
// stays a separate, human decision in the panel.
//
// ADMIN_URL defaults to a local server; ADMIN_TOKEN is the shared token the
// panel also accepts (see server/.env.example).

export type PackageFiles = Map<string, string>;

export type PushOptions = {
  courseId: string;
  versionLabel: string;
  baseVersion: string;
  notes?: string;
  // Release it straight away instead of leaving a draft for the panel.
  release?: {
    version?: string;
    notes?: string;
    minAppVersion?: string;
    instructions?: UpdateInstructionV2[];
  };
  server?: string;
  token?: string;
};

export type PushResult = {
  draftId: string;
  version: string | null;
  url: string;
};

// The documents a package holds, as the server wants them: the course
// document and one module document per module. Lesson documents are derived
// from the modules, so they are not sent.
export const readPackageDocs = (
  files: PackageFiles,
): { courseDoc: CourseDocV2; moduleDocs: ModuleDocV2[] } => {
  const courseRaw = files.get('course.json');
  if (courseRaw == null) {
    throw new Error('package has no course.json');
  }
  const courseDoc = JSON.parse(courseRaw) as CourseDocV2;
  const moduleDocs = courseDoc.course.moduleIds.map(moduleId => {
    const raw = files.get(`modules/${moduleId}.json`);
    if (raw == null) {
      throw new Error(`package has no modules/${moduleId}.json`);
    }
    return JSON.parse(raw) as ModuleDocV2;
  });
  return { courseDoc, moduleDocs };
};

export const readPackageDir = (dir: string): PackageFiles => {
  const courseRaw = readFileSync(join(dir, 'course.json'), 'utf8');
  const courseDoc = JSON.parse(courseRaw) as CourseDocV2;
  const files: PackageFiles = new Map([['course.json', courseRaw]]);
  for (const moduleId of courseDoc.course.moduleIds) {
    const relPath = `modules/${moduleId}.json`;
    files.set(relPath, readFileSync(join(dir, relPath), 'utf8'));
  }
  return files;
};

export const pushPackage = async (
  files: PackageFiles,
  options: PushOptions,
): Promise<PushResult> => {
  const server = (
    options.server ??
    process.env.ADMIN_URL ??
    'http://localhost:8787'
  ).replace(/\/$/, '');
  const token = options.token ?? process.env.ADMIN_TOKEN ?? '';
  const { courseDoc, moduleDocs } = readPackageDocs(files);

  const url = `${server}/v1/admin/courses/${encodeURIComponent(
    options.courseId,
  )}/drafts/import${options.release != null ? '?release=1' : ''}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token.length > 0 && { Authorization: `Bearer ${token}` }),
    },
    body: JSON.stringify({
      versionLabel: options.versionLabel,
      baseVersion: options.baseVersion,
      notes: options.notes ?? '',
      courseDoc,
      moduleDocs,
      ...(options.release != null && { release: options.release }),
    }),
  });

  const payload = (await response.json().catch(() => null)) as {
    draftId?: string;
    draft?: { draftId: string };
    version?: string;
    error?: string;
    errors?: string[];
  } | null;

  if (!response.ok) {
    const detail =
      payload?.errors?.join('\n  - ') ?? payload?.error ?? response.statusText;
    throw new Error(
      `${server} refused the package (${response.status}):\n  - ${detail}`,
    );
  }

  const draftId = payload?.draftId ?? payload?.draft?.draftId ?? '';
  return {
    draftId,
    version: payload?.version ?? null,
    url: `${server}/admin`,
  };
};

// What the newest release of a course is, so a build can say what it forked
// from without a local tree to read.
export const newestRelease = async (
  courseId: string,
  server = process.env.ADMIN_URL ?? 'http://localhost:8787',
): Promise<string | null> => {
  const response = await fetch(
    `${server.replace(/\/$/, '')}/v1/bootstrap?course=${encodeURIComponent(
      courseId,
    )}`,
  );
  if (!response.ok) {
    return null;
  }
  const body = (await response.json()) as {
    course?: { latestVersion?: string };
  };
  return body.course?.latestVersion ?? null;
};
