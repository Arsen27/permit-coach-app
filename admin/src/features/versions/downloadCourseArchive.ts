import { adminApi } from '@admin/api/adminApi';
import type { LessonDocV2 } from '@admin/api/types';
import { buildCourseArchive } from '@admin/model/courseArchive';
import { assetSrc } from '@admin/model/svg';
import type { VersionDescriptor } from '@admin/model/versionDescriptor';
import type { ZipEntry } from '@admin/model/zip';
import { zipArchive } from '@admin/model/zip';

// Fetches everything one version shows — its outline, every lesson, its bank
// and the bytes of every picture — and hands the browser a zip of the HTML
// archive courseArchive.ts lays out. A released version and a draft read the
// same; a competitor course has no documents of ours to archive.

// A few requests at a time: a course is a few dozen lessons and a hundred-odd
// pictures, and the panel shares the server with everyone else.
const inBatches = async <T, R>(
  items: T[],
  limit: number,
  work: (item: T) => Promise<R>,
): Promise<R[]> => {
  const results: R[] = new Array(items.length);
  let next = 0;
  const worker = async () => {
    while (next < items.length) {
      const index = next;
      next += 1;
      results[index] = await work(items[index]);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(limit, items.length) }, worker),
  );
  return results;
};

const saveFile = (bytes: Uint8Array<ArrayBuffer>, name: string): void => {
  const url = URL.createObjectURL(
    new Blob([bytes], { type: 'application/zip' }),
  );
  const link = document.createElement('a');
  link.href = url;
  link.download = name;
  document.body.appendChild(link);
  link.click();
  link.remove();
  // The download has its own copy once it starts.
  setTimeout(() => URL.revokeObjectURL(url), 60_000);
};

export const downloadCourseArchive = async (
  version: VersionDescriptor,
  onProgress: (message: string) => void,
): Promise<string> => {
  const courseId = version.courseId;
  if (courseId == null || version.kind === 'competitor') {
    throw new Error('Only our own versions can be archived');
  }
  const draftId = version.draftId;
  const isDraft = version.kind === 'draft' && draftId != null;

  onProgress(`Reading ${version.label}…`);
  const [outline, bank] = await Promise.all([
    isDraft
      ? adminApi.draftOutline(courseId, draftId)
      : adminApi.releasedOutline(courseId, version.version),
    isDraft
      ? adminApi.questions(courseId, draftId)
      : adminApi.releasedQuestions(courseId, version.version),
  ]);

  const lessonIds = outline.modules.flatMap(module =>
    module.lessons.map(lesson => lesson.lessonId),
  );
  let read = 0;
  const docs = await inBatches(lessonIds, 6, async lessonId => {
    const doc: LessonDocV2 = isDraft
      ? await adminApi.draftLesson(courseId, draftId, lessonId)
      : await adminApi.releasedLesson(courseId, version.version, lessonId);
    read += 1;
    onProgress(`Lessons ${read}/${lessonIds.length}…`);
    return doc;
  });

  const archive = buildCourseArchive({
    outline,
    lessons: new Map(
      lessonIds.map((lessonId, index) => [lessonId, docs[index]]),
    ),
    bank: { questions: bank.questions, assets: bank.assets ?? [] },
    draft: isDraft,
    generatedAt: new Date(),
  });

  // A picture two modules show is fetched once and written into both.
  const pictures = [
    ...new Map(
      archive.files.flatMap(file =>
        file.kind === 'asset' ? [[file.asset.sha256, file.asset] as const] : [],
      ),
    ).values(),
  ];
  let fetched = 0;
  const bytes = new Map(
    await inBatches(pictures, 8, async asset => {
      const response = await fetch(assetSrc(asset));
      if (!response.ok) {
        throw new Error(
          `Picture ${asset.assetId} could not be fetched (${response.status})`,
        );
      }
      fetched += 1;
      onProgress(`Pictures ${fetched}/${pictures.length}…`);
      return [
        asset.sha256,
        new Uint8Array(await response.arrayBuffer()),
      ] as const;
    }),
  );

  const entries: ZipEntry[] = archive.files.map(file =>
    file.kind === 'page'
      ? { path: file.path, data: file.html }
      : { path: file.path, data: bytes.get(file.asset.sha256)! },
  );
  const name = `${archive.root}.zip`;
  saveFile(zipArchive(entries), name);
  return name;
};
