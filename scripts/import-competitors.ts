// Turns the competitor screenshot captures into the JSON the admin serves.
// Run from the repo root:
//   npm run competitors:import
//
// Output lands in server/content-admin/competitors/ (parsed courses plus the
// images they reference), so the server never has to see the capture corpus.

import { cp, mkdir, readFile, readdir, rm, writeFile } from 'node:fs/promises';
import path from 'node:path';

import {
  parseLessonBody,
  parseTest,
  type CompetitorCourse,
  type CompetitorLesson,
  type CompetitorModule,
} from './competitorParser.ts';

const REPO = path.join(import.meta.dirname, '..');
const SOURCE = path.join(REPO, 'courses', 'competitors');
const OUT = path.join(REPO, 'server', 'content-admin', 'competitors');

const APPS = [
  { id: 'zutobi', dir: 'Zutobi', name: 'Zutobi', format: 'article' as const },
  { id: 'mydmv', dir: 'myDMV', name: 'myDMV', format: 'slides' as const },
];

const read = async (file: string): Promise<string | null> => {
  try {
    return await readFile(file, 'utf8');
  } catch {
    return null;
  }
};

const numberIn = (name: string): number => {
  const match = /(\d+)/.exec(name);
  return match == null ? 0 : Number(match[1]);
};

const titleFromDir = (name: string): string => {
  const withoutIndex = name.replace(/^module-\d+_/, '');
  return withoutIndex
    .split('-')
    .map(word =>
      word.length === 0 ? word : word[0].toUpperCase() + word.slice(1),
    )
    .join(' ');
};

const importApp = async (
  app: (typeof APPS)[number],
): Promise<CompetitorCourse> => {
  const courseDir = path.join(SOURCE, app.dir, 'course');
  const warnings: string[] = [];
  const modules: CompetitorModule[] = [];

  const entries = (await readdir(courseDir, { withFileTypes: true }))
    .filter(entry => entry.isDirectory() && /^module-\d+_/.test(entry.name))
    .sort((a, b) => numberIn(a.name) - numberIn(b.name));

  for (const [moduleIndex, moduleEntry] of entries.entries()) {
    const moduleDir = path.join(courseDir, moduleEntry.name);
    const lessonDirs = (await readdir(moduleDir, { withFileTypes: true }))
      .filter(entry => entry.isDirectory() && /^lesson-\d+$/.test(entry.name))
      .sort((a, b) => numberIn(a.name) - numberIn(b.name));

    const lessons: CompetitorLesson[] = [];
    for (const lessonEntry of lessonDirs) {
      const lessonDir = path.join(moduleDir, lessonEntry.name);
      const number = numberIn(lessonEntry.name);
      const body = await read(path.join(lessonDir, `lesson-${number}.md`));
      if (body == null) {
        // Captured but not yet transcribed — recorded, not silently dropped.
        warnings.push(
          `${moduleEntry.name}/${lessonEntry.name}: no lesson text`,
        );
        continue;
      }

      const parsed = parseLessonBody(body);
      parsed.warnings.forEach(warning =>
        warnings.push(`${moduleEntry.name}/${lessonEntry.name}: ${warning}`),
      );

      const lessonId = `${app.id}-${moduleEntry.name}-${lessonEntry.name}`;
      const lesson: CompetitorLesson = {
        lessonId,
        title: parsed.title,
        // The capture's own number: both apps count lessons straight through
        // the course, and gaps in the capture must not shift what follows.
        sequence: number,
        sections: parsed.sections,
      };

      const testBody = await read(
        path.join(lessonDir, `lesson-${number}-tests.md`),
      );
      const inlineTest =
        testBody == null && /##\s+Test Questions/i.test(body) ? body : null;
      const source = testBody ?? inlineTest;
      if (source != null) {
        const test = parseTest(source);
        test.warnings.forEach(warning =>
          warnings.push(`${moduleEntry.name}/${lessonEntry.name}: ${warning}`),
        );
        if (test.test.questions.length > 0) {
          lesson.test = test.test;
        }
      }

      // Images are referenced relative to the lesson; rewrite to the route the
      // admin serves them from.
      const assetBase = `${app.id}/${moduleEntry.name}/${lessonEntry.name}`;
      for (const section of lesson.sections) {
        for (const image of section.images) {
          image.src = `${assetBase}/${image.src}`;
        }
      }
      for (const question of lesson.test?.questions ?? []) {
        if (question.image != null) {
          question.image.src = `${assetBase}/${question.image.src}`;
        }
      }

      lessons.push(lesson);
    }

    const moduleTestBody = await read(
      path.join(moduleDir, 'module-test', 'module-test.md'),
    );
    const moduleTest =
      moduleTestBody == null ? undefined : parseTest(moduleTestBody).test;

    modules.push({
      moduleId: `${app.id}-${moduleEntry.name}`,
      title: titleFromDir(moduleEntry.name),
      sequence: moduleIndex + 1,
      lessons,
      moduleTest,
    });
  }

  return {
    id: app.id,
    name: app.name,
    format: app.format,
    modules,
    warnings,
  };
};

const copyImages = async (app: (typeof APPS)[number]): Promise<number> => {
  const courseDir = path.join(SOURCE, app.dir, 'course');
  const target = path.join(OUT, 'assets', app.id);
  await rm(target, { recursive: true, force: true });

  let copied = 0;
  const modules = (await readdir(courseDir, { withFileTypes: true })).filter(
    entry => entry.isDirectory() && /^module-\d+_/.test(entry.name),
  );
  for (const moduleEntry of modules) {
    const moduleDir = path.join(courseDir, moduleEntry.name);
    const lessons = (await readdir(moduleDir, { withFileTypes: true })).filter(
      entry => entry.isDirectory() && /^lesson-\d+$/.test(entry.name),
    );
    for (const lessonEntry of lessons) {
      const from = path.join(moduleDir, lessonEntry.name, 'images');
      const to = path.join(
        target,
        moduleEntry.name,
        lessonEntry.name,
        'images',
      );
      try {
        const files = await readdir(from);
        if (files.filter(name => !name.startsWith('.')).length === 0) {
          continue;
        }
        await mkdir(path.dirname(to), { recursive: true });
        await cp(from, to, { recursive: true });
        copied += files.length;
      } catch {
        // No images for this lesson.
      }
    }
  }
  return copied;
};

const main = async () => {
  await mkdir(OUT, { recursive: true });

  for (const app of APPS) {
    const course = await importApp(app);
    const images = await copyImages(app);
    await writeFile(
      path.join(OUT, `${app.id}.json`),
      JSON.stringify(course, null, 2) + '\n',
      'utf8',
    );

    const lessons = course.modules.reduce(
      (sum, module) => sum + module.lessons.length,
      0,
    );
    const tests = course.modules.reduce(
      (sum, module) =>
        sum + module.lessons.filter(lesson => lesson.test != null).length,
      0,
    );
    console.log(
      `${app.name}: ${course.modules.length} modules · ${lessons} lessons · ` +
        `${tests} lesson tests · ${images} images · ${course.warnings.length} warnings`,
    );
    for (const warning of course.warnings.slice(0, 5)) {
      console.log(`  · ${warning}`);
    }
    if (course.warnings.length > 5) {
      console.log(`  · …and ${course.warnings.length - 5} more`);
    }
  }
};

await main();
