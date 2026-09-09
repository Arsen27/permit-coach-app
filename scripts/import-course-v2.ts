// v2 course importer. Reads a course handoff package, verifies it, and writes
// a course package (out/course-packages/<courseId>-<semver>) plus the release
// audit trail (docs/course-releases/<courseId>/<semver>). Nothing is written
// into the app — it ships without course content — and nothing is written
// into the server either: releases live in its database, so the package is
// handed over the admin API.
//
//   npm run course:import-v2 -- --source <dir> --delivery-version 2.0.0
//   npm run course:import-v2 -- --source <dir> --delivery-version 2.0.0 --push
//   npm run course:import-v2 -- --source <dir> --delivery-version 2.0.0 --push --release
//   npm run course:import-v2 -- --source <dir> --delivery-version 2.0.0 --check
//
// --push sends the package to the content server (ADMIN_URL, ADMIN_TOKEN) as
// a draft; --release turns it into a release in the same call. Publishing it
// to a channel stays a separate decision in the panel. --check regenerates
// everything in memory and compares byte-for-byte against the files on disk;
// it never writes and never pushes.

import { existsSync, mkdirSync, readFileSync, writeFileSync } from 'node:fs';
import { join, resolve } from 'node:path';

import { newestRelease, pushPackage } from './coursePush.ts';
import {
  buildStableIdMap,
  buildVersionDocuments,
  checkEmittedContent,
  loadSourcePackage,
  serializeJson,
  transformPackage,
  validateTransformResult,
  verifyManifestRelease,
  verifySourcePackage,
} from './courseImportV2.ts';

const repoRoot = process.cwd();

const args = process.argv.slice(2);
const flagValue = (name: string): string | null => {
  const index = args.indexOf(name);
  return index >= 0 ? args[index + 1] ?? null : null;
};
const checkOnly = args.includes('--check');
const push = args.includes('--push');
const releaseNow = args.includes('--release');
// See VerifyOptions.allowStaleValidationReport: accepts a package whose QA
// report was produced from different bytes than it ships. Per-file asset
// hashes, SVG safety and the runtime validators still have to pass.
const allowStaleValidationReport = args.includes(
  '--allow-stale-validation-report',
);
const sourceFlag = flagValue('--source');
const deliveryVersion = flagValue('--delivery-version');
const checkedAtFlag = flagValue('--checked-at');

if (!sourceFlag || !deliveryVersion) {
  console.error(
    'Usage: npm run course:import-v2 -- --source <package dir> --delivery-version <x.y.z> [--push [--release]] [--check] [--checked-at YYYY-MM-DD] [--allow-stale-validation-report] [--base <x.y.z>]',
  );
  process.exit(1);
}
if (!/^\d+\.\d+\.\d+$/.test(deliveryVersion)) {
  console.error(`Invalid delivery version: ${deliveryVersion}`);
  process.exit(1);
}

const sourceDir = resolve(sourceFlag);
if (!existsSync(join(sourceDir, 'manifest.json'))) {
  console.error(`No manifest.json in source package: ${sourceDir}`);
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 1. Source verification

const pkg = loadSourcePackage(sourceDir);

// Output roots follow the package's stable course id, so each state keeps its
// own package and audit trail.
const PACKAGE_DIR = join(
  repoRoot,
  'out',
  'course-packages',
  `${pkg.courseId}-${deliveryVersion}`,
);
const RELEASE_DIR = join(
  repoRoot,
  'docs',
  'course-releases',
  pkg.courseId,
  deliveryVersion,
);
const sourceCheck = verifySourcePackage(pkg, { allowStaleValidationReport });
if (sourceCheck.errors.length > 0) {
  console.error('Source package verification FAILED:');
  for (const error of sourceCheck.errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}
console.log(
  `Source package OK: ${pkg.manifest.versionLabel} (${sourceCheck.hashedFileCount} hashed files, ${sourceCheck.svgCount} SVG hashes verified)`,
);
for (const warning of sourceCheck.warnings) {
  console.warn(`  WARNING: ${warning}`);
}

// ---------------------------------------------------------------------------
// 2-3. Stable ids + transform

const idMap = buildStableIdMap(pkg);
const checkedAt = checkedAtFlag ?? pkg.manifest.releaseDate;
const result = transformPackage(pkg, idMap, { deliveryVersion, checkedAt });

const contentCheck = checkEmittedContent(result, pkg.course.jurisdiction);
if (contentCheck.errors.length > 0) {
  console.error('Emitted content check FAILED:');
  for (const error of contentCheck.errors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

const integrityErrors = validateTransformResult(result);
if (integrityErrors.length > 0) {
  console.error('Generated document validation FAILED:');
  for (const error of integrityErrors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 4. Version documents + manifest

// What this release is built on top of. The server owns the release history
// now, so the fork point is asked for rather than read off a local manifest;
// --base names it when the server is unreachable or a rebuild is deliberate.
const baseVersion =
  flagValue('--base') ??
  (checkOnly ? null : await newestRelease(pkg.courseId)) ??
  deliveryVersion;

// Every document embeds its deliveryVersion, so a re-import rewrites all of
// them and the release is a `full` rebuild by definition — which the manifest
// rules only allow on a major bump. A scoped release (a handful of corrected
// lessons at the same major) still has to hand-author its instructions; see
// docs/course-integration/server-versioning.md.
const built = buildVersionDocuments(result, {
  deliveryVersion,
  releasedAt: checkedAt,
  status: 'release_candidate',
  minAppVersion: '1.0.0',
  notes: flagValue('--notes') ?? 'New scenario-first card course',
  instructions: [
    {
      op: 'full',
      // `soft` keeps learner progress: a rebuild that only changes how
      // lessons are presented never invalidates an answer already given.
      severity: 'soft',
      message:
        flagValue('--update-message') ??
        `The ${pkg.course.state} course was rebuilt.`,
    },
  ],
});

// Self-consistency of the entry against the bytes it describes. The server
// re-checks the release against the whole history when the package lands;
// there is no previous entry to compare with here.
const releaseErrors = verifyManifestRelease(
  built.manifestVersion,
  null,
  relPath => built.files.get(relPath) ?? null,
);
if (releaseErrors.length > 0) {
  console.error('Manifest release verification FAILED:');
  for (const error of releaseErrors) {
    console.error(`  - ${error}`);
  }
  process.exit(1);
}

// ---------------------------------------------------------------------------
// 5. Audit artifacts

const importReport = {
  stableCourseId: pkg.courseId,
  deliveryVersion,
  generatedFrom: {
    packageDir: sourceDir,
    versionLabel: pkg.manifest.versionLabel,
    releaseDate: pkg.manifest.releaseDate,
    status: pkg.manifest.status,
    publicationAuthorized: pkg.manifest.publicationAuthorized,
    contentHash: pkg.manifest.contentHash,
    contentHashNote:
      'Per-file SVG sha256 values and cross-report consistency verified. The package does not document a formula for recomputing manifest.contentHash from delivered bytes, so it is recorded as-is.',
    hashedFileCount: sourceCheck.hashedFileCount,
    finalValidationStatus: pkg.finalValidation.status,
    staleValidationReportAccepted: allowStaleValidationReport,
    warnings: sourceCheck.warnings,
  },
  counts: {
    modules: result.moduleDocs.length,
    lessons: result.lessonDocs.length,
    questions: result.moduleDocs.reduce(
      (sum, doc) => sum + doc.questions.length,
      0,
    ),
    moduleTests: result.moduleDocs.length,
    moduleTestQuestionRefs: result.moduleDocs.reduce(
      (sum, doc) => sum + doc.module.moduleTest.questionIds.length,
      0,
    ),
    assets: result.moduleDocs.reduce((sum, doc) => sum + doc.assets.length, 0),
    blocksPerLesson: 12,
    questionsPerLesson: 5,
    assetsPerLesson: 3,
  },
  manifestVersion: {
    version: built.manifestVersion.version,
    releasedAt: built.manifestVersion.releasedAt,
    status: built.manifestVersion.status,
    instructions: built.manifestVersion.instructions,
  },
  strippedAuditFields: [
    'primaryRuleIds',
    'reinforcementRuleIds',
    'evidenceId',
    'blueprintId',
    'estimatedVisibleWordCount',
    'status',
    'courseVersion',
    'relatedRuleIds (questions)',
    'rightsStatus/source (assets)',
    'official URLs, rights registry, dependency map, QA reports, authoring files',
  ],
  auditLessonFields: result.auditLessonFields,
  warnings: [...sourceCheck.warnings, ...contentCheck.warnings],
};

const outputs = new Map<string, string>();
for (const [relPath, bytes] of built.files) {
  outputs.set(join(PACKAGE_DIR, relPath), bytes);
}
// What the push needs to know about the release it is asking for.
outputs.set(
  join(PACKAGE_DIR, 'release.json'),
  serializeJson({
    courseId: pkg.courseId,
    versionLabel: deliveryVersion,
    baseVersion,
    notes: built.manifestVersion.notes ?? '',
    minAppVersion: built.manifestVersion.minAppVersion,
    instructions: built.manifestVersion.instructions,
  }),
);
outputs.set(
  join(RELEASE_DIR, 'import-report.json'),
  serializeJson(importReport),
);
outputs.set(
  join(RELEASE_DIR, 'stable-id-map.json'),
  serializeJson({
    courseId: pkg.courseId,
    uuidNamespace: idMap.uuidNamespace,
    entries: idMap.entries,
  }),
);
outputs.set(
  join(RELEASE_DIR, 'document-hashes.json'),
  serializeJson(built.manifestVersion.documents),
);
outputs.set(
  join(RELEASE_DIR, 'source-manifest.json'),
  readFileSync(join(sourceDir, 'manifest.json'), 'utf8'),
);
outputs.set(
  join(RELEASE_DIR, 'final-qa-report.md'),
  readFileSync(join(sourceDir, 'reports', 'final-qa-report.md'), 'utf8'),
);

// ---------------------------------------------------------------------------
// 6. Write (or --check compare)

if (checkOnly) {
  const problems: string[] = [];
  for (const [path, expected] of outputs) {
    if (!existsSync(path)) {
      problems.push(`missing: ${path}`);
      continue;
    }
    const actual = readFileSync(path, 'utf8');
    if (actual !== expected) {
      problems.push(`differs: ${path}`);
    }
  }
  if (problems.length > 0) {
    console.error('--check FAILED (outputs differ from a fresh import):');
    for (const problem of problems) {
      console.error(`  - ${problem}`);
    }
    process.exit(1);
  }
  console.log(`--check OK: all ${outputs.size} generated files match.`);
  process.exit(0);
}

for (const [path, bytes] of outputs) {
  mkdirSync(join(path, '..'), { recursive: true });
  writeFileSync(path, bytes);
}

console.log(
  `Imported ${pkg.manifest.versionLabel} → ${pkg.courseId}@${deliveryVersion}`,
);
console.log(`  package: ${PACKAGE_DIR}`);
console.log(`  release: ${RELEASE_DIR}`);
console.log(`  files:   ${outputs.size}`);

if (!push) {
  console.log(
    `  push it with: npm run course:import-v2 -- --source ${sourceFlag} --delivery-version ${deliveryVersion} --push`,
  );
  process.exit(0);
}

// ---------------------------------------------------------------------------
// 7. Hand it to the content server

const pushed = await pushPackage(built.files, {
  courseId: pkg.courseId,
  versionLabel: deliveryVersion,
  baseVersion,
  notes: built.manifestVersion.notes ?? '',
  ...(releaseNow && {
    release: {
      version: deliveryVersion,
      notes: built.manifestVersion.notes ?? '',
      minAppVersion: built.manifestVersion.minAppVersion,
      instructions: built.manifestVersion.instructions,
    },
  }),
});

if (pushed.version == null) {
  console.log(`  draft:   ${pushed.draftId} (release it in ${pushed.url})`);
} else {
  console.log(
    `  released: ${pkg.courseId}@${pushed.version} — publish it to a channel in ${pushed.url}`,
  );
}
