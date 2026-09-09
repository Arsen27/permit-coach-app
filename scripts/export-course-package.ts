import { mkdirSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import type { CourseDocV2 } from '../src/data/course/v2/wire.ts';

// Pulls a released version out of the content server into a course package on
// disk. Releases live in the server's database, so a build that starts from an
// earlier release — every course builder does — asks for it here instead of
// reading a tree that no longer exists.
//
//   npm run course:export -- --course ca-class-c --version 3.2.11
//   npm run course:export -- --course ca-class-c            # what production serves
//
// Reads the public content routes, so no admin token is needed; SERVER is
// ADMIN_URL or a local server. A version only staging serves needs
// STAGING_KEY.

const args = process.argv.slice(2);
const flagValue = (name: string): string | null => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] ?? null : null;
};

const courseId = flagValue('--course') ?? 'ca-class-c';
const server = (
  flagValue('--server') ??
  process.env.ADMIN_URL ??
  'http://localhost:8787'
).replace(/\/$/, '');
const outRoot = resolve(
  flagValue('--out') ?? join(process.cwd(), 'out', 'course-packages'),
);
const stagingKey = process.env.STAGING_KEY ?? '';
const headers: Record<string, string> =
  stagingKey.length > 0 ? { 'X-Staging-Key': stagingKey } : {};

const get = async (path: string): Promise<string> => {
  const response = await fetch(`${server}${path}`, { headers });
  if (!response.ok) {
    throw new Error(`${server}${path} → ${response.status}`);
  }
  return response.text();
};

const version =
  flagValue('--version') ??
  (
    JSON.parse(
      await get(`/v1/bootstrap?course=${encodeURIComponent(courseId)}`),
    ) as { course: { latestVersion: string } }
  ).course.latestVersion;

const base = `/v1/course/${encodeURIComponent(courseId)}/${encodeURIComponent(
  version,
)}`;
const courseRaw = await get(`${base}/course`);
const courseDoc = JSON.parse(courseRaw) as CourseDocV2;

const dir = join(outRoot, `${courseId}-${version}`);
mkdirSync(join(dir, 'modules'), { recursive: true });
mkdirSync(join(dir, 'lessons'), { recursive: true });
writeFileSync(join(dir, 'course.json'), courseRaw);

let files = 1;
for (const moduleId of courseDoc.course.moduleIds) {
  const raw = await get(`${base}/modules/${moduleId}`);
  writeFileSync(join(dir, 'modules', `${moduleId}.json`), raw);
  files += 1;
  // Lesson documents are what a builder diffs against, so they come too.
  const moduleDoc = JSON.parse(raw) as {
    module: { lessons: { lessonId: string }[] };
  };
  for (const lesson of moduleDoc.module.lessons) {
    const lessonRaw = await get(`${base}/lessons/${lesson.lessonId}`);
    writeFileSync(join(dir, 'lessons', `${lesson.lessonId}.json`), lessonRaw);
    files += 1;
  }
}

console.log(`Exported ${courseId}@${version} from ${server}`);
console.log(`  package: ${dir}`);
console.log(`  files:   ${files}`);
