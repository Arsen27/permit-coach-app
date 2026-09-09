import { existsSync, readFileSync } from 'fs';
import { join } from 'path';

import { convertTreeDoc } from './support/treeContent';

import type { ManifestVersionV2 } from '@/data/course/v2/wire';
import {
  BLOCKED_TOPIC_PATTERNS,
  LESSON_SLUGS,
  MODULE_SLUGS,
  buildStableIdMap,
  buildVersionDocuments,
  checkEmittedContent,
  loadSourcePackage,
  serializeJson,
  sha256Hex,
  transformPackage,
  utf8Size,
  uuidV5,
  validateTransformResult,
  verifyManifestRelease,
  verifySourcePackage,
} from '../scripts/courseImportV2';

// Exercises the v2 importer against the real handoff package: source
// verification, stable-id mapping, deterministic transformation, and byte
// equality with the generated outputs on disk. Skipped when the untracked
// package is not present.

const PACKAGE_DIR = join(
  __dirname,
  '..',
  'courses',
  'California_DMV_Course_CA2026.08.10r01_Illustrated_20260811',
);
const DELIVERY_VERSION = '1.0.0';
// 90 lesson illustrations (3 per lesson) + 55 dedicated question assets.
const EXPECTED_ASSETS = 145;
const SERVER_VERSION_DIR = join(
  __dirname,
  '..',
  'server',
  'content',
  'ca-class-c',
  DELIVERY_VERSION,
);

const describeIf = existsSync(PACKAGE_DIR) ? describe : describe.skip;

describeIf('course importer v2 (real package)', () => {
  const pkg = loadSourcePackage(PACKAGE_DIR);
  const idMap = buildStableIdMap(pkg);
  const result = transformPackage(pkg, idMap, {
    deliveryVersion: DELIVERY_VERSION,
  });

  it('verifies the source package cleanly', () => {
    const check = verifySourcePackage(pkg, {
      allowStaleValidationReport: true,
    });
    expect(check.errors).toEqual([]);
    expect(check.svgCount).toBe(EXPECTED_ASSETS);
  });

  // This delivery regenerated content without re-running the package QA, so
  // its own report no longer describes the bytes it ships. The importer must
  // refuse it unless the operator opts in.
  it('rejects the stale QA report unless it is explicitly accepted', () => {
    expect(verifySourcePackage(pkg).errors).toEqual([
      expect.stringContaining('final-validation contentHash differs'),
    ]);
  });

  it('maps every entity to a curated stable id with deterministic uuids', () => {
    const byEntity = (entity: string) =>
      idMap.entries.filter(entry => entry.entity === entity);
    expect(byEntity('course')).toHaveLength(1);
    expect(byEntity('module')).toHaveLength(8);
    expect(byEntity('moduleTest')).toHaveLength(8);
    expect(byEntity('lesson')).toHaveLength(30);
    expect(byEntity('question')).toHaveLength(150);
    expect(byEntity('asset')).toHaveLength(EXPECTED_ASSETS);
    expect(byEntity('block')).toHaveLength(360);
    expect(Object.keys(MODULE_SLUGS)).toHaveLength(8);
    expect(Object.keys(LESSON_SLUGS)).toHaveLength(30);
    // uuidV5 is deterministic and stable-id-derived.
    const first = byEntity('module')[0];
    expect(first.uuid).toBe(
      uuidV5(`dmv-prep:ca-class-c:${first.stableId}`, idMap.uuidNamespace),
    );
  });

  it('requires manual mapping for unknown source entities', () => {
    const mutated = {
      ...pkg,
      modules: [
        ...pkg.modules,
        {
          ...pkg.modules[0],
          moduleId: 'ca-2026-08-10-r01-m99',
          moduleTestId: 'x',
        },
      ],
    };
    expect(() => buildStableIdMap(mutated)).toThrow(
      /no manual stable id mapping/,
    );
  });

  it('produces wire-valid documents with no leaked audit fields', () => {
    expect(validateTransformResult(result)).toEqual([]);
    const emitted = checkEmittedContent(result);
    expect(emitted.errors).toEqual([]);
  });

  it('is deterministic across runs', () => {
    const again = transformPackage(pkg, buildStableIdMap(pkg), {
      deliveryVersion: DELIVERY_VERSION,
    });
    expect(serializeJson(again.courseDoc)).toBe(
      serializeJson(result.courseDoc),
    );
    expect(serializeJson(again.moduleDocs)).toBe(
      serializeJson(result.moduleDocs),
    );
  });

  it('still reproduces the immutable 1.0.0 release byte-for-byte', () => {
    // Must mirror the flags the release was imported with, or the byte
    // comparison against the server tree fails on the manifest entry.
    const built = buildVersionDocuments(result, {
      deliveryVersion: DELIVERY_VERSION,
      releasedAt: '2026-08-10',
      status: 'release_candidate',
      minAppVersion: '1.0.0',
      notes:
        'Illustrated release: dedicated artwork for 55 questions, 33 lesson illustrations redrawn',
      instructions: [
        {
          op: 'full',
          severity: 'soft',
          message: 'The California course now has new illustrations.',
        },
      ],
    });
    // The committed tree predates artwork-as-a-file; converting it the way
    // the server converts it on import is what makes the comparison mean
    // something — the importer emits exactly what a release holds today.
    for (const [relPath, bytes] of built.files) {
      expect(
        convertTreeDoc(readFileSync(join(SERVER_VERSION_DIR, relPath), 'utf8'))
          .body,
      ).toBe(bytes);
    }
    // Manifest release check against the built files: zero errors.
    expect(
      verifyManifestRelease(built.manifestVersion, null, relPath =>
        built.files.has(relPath) ? built.files.get(relPath)! : null,
      ),
    ).toEqual([]);
  });

  it('screens emitted learner text against blocked numeric topics', () => {
    expect(BLOCKED_TOPIC_PATTERNS.length).toBeGreaterThan(0);
    const emitted = checkEmittedContent(result);
    expect(emitted.errors).toEqual([]);
  });
});

// ---------------------------------------------------------------------------
// Release-rule verification on synthetic manifests (no package required).

const ref = (bytes: string) => ({
  sha256: sha256Hex(bytes),
  sizeBytes: utf8Size(bytes),
});

const makeEntry = (
  version: string,
  instructions: ManifestVersionV2['instructions'],
  bodies: Record<string, string>,
): ManifestVersionV2 => ({
  version,
  releasedAt: '2026-08-12',
  status: 'release_candidate',
  minAppVersion: '1.0.0',
  sourceVersionLabel: 'TEST',
  sourceReviewStatus: 'draft_generated_human_review_required',
  publicationAuthorized: false,
  instructions,
  documents: {
    course: ref(bodies['course.json']),
    modules: { m1: ref(bodies['modules/m1.json']) },
    lessons: { l1: { ...ref(bodies['lessons/l1.json']), moduleId: 'm1' } },
  },
});

describe('verifyManifestRelease rules', () => {
  const bodiesV1 = {
    'course.json': '{"v":"2.0.0"}',
    'modules/m1.json': '{"m":"one"}',
    'lessons/l1.json': '{"l":"one"}',
  };
  const bodiesV2 = {
    'course.json': '{"v":"2.0.1"}',
    'modules/m1.json': '{"m":"one-changed"}',
    'lessons/l1.json': '{"l":"one-changed"}',
  };
  const read = (bodies: Record<string, string>) => (relPath: string) =>
    bodies[relPath] ?? null;
  const previous = makeEntry(
    '2.0.0',
    [{ op: 'full', severity: 'soft' }],
    bodiesV1,
  );

  it('accepts a clean patch release', () => {
    const entry = makeEntry(
      '2.0.1',
      [{ op: 'lesson-content', lessonId: 'l1', severity: 'soft' }],
      bodiesV2,
    );
    expect(verifyManifestRelease(entry, previous, read(bodiesV2))).toEqual([]);
  });

  it('rejects module/full instructions in a patch release', () => {
    const withModule = makeEntry(
      '2.0.1',
      [
        { op: 'module', moduleId: 'm1', severity: 'soft' },
        { op: 'lesson-content', lessonId: 'l1', severity: 'soft' },
      ],
      bodiesV2,
    );
    expect(
      verifyManifestRelease(withModule, previous, read(bodiesV2)),
    ).toContain('patch release must not contain module or full instructions');
    const withFull = makeEntry(
      '2.0.1',
      [{ op: 'full', severity: 'soft' }],
      bodiesV2,
    );
    expect(verifyManifestRelease(withFull, previous, read(bodiesV2))).toContain(
      'patch release must not contain module or full instructions',
    );
  });

  it('rejects full instructions in a minor release', () => {
    const entry = makeEntry(
      '2.1.0',
      [{ op: 'full', severity: 'soft' }],
      bodiesV2,
    );
    expect(verifyManifestRelease(entry, previous, read(bodiesV2))).toContain(
      'minor release must not contain full instructions',
    );
  });

  it('allows full instructions in a major release', () => {
    const entry = makeEntry(
      '3.0.0',
      [{ op: 'full', severity: 'soft' }],
      bodiesV2,
    );
    expect(verifyManifestRelease(entry, previous, read(bodiesV2))).toEqual([]);
  });

  it('rejects instructions that target unknown documents', () => {
    const entry = makeEntry(
      '2.0.1',
      [
        { op: 'lesson-content', lessonId: 'ghost', severity: 'soft' },
        { op: 'lesson-content', lessonId: 'l1', severity: 'soft' },
      ],
      bodiesV2,
    );
    expect(verifyManifestRelease(entry, previous, read(bodiesV2))).toContain(
      'instruction targets unknown lesson ghost',
    );
  });

  it('rejects changed documents that no instruction covers', () => {
    const entry = makeEntry('2.0.1', [], bodiesV2);
    const errors = verifyManifestRelease(entry, previous, read(bodiesV2));
    expect(errors).toContain(
      'changed lesson l1 is not covered by instructions',
    );
    expect(errors).toContain(
      'changed module m1 is not covered by instructions',
    );
  });

  it('rejects instructions that target unchanged documents', () => {
    const unchanged = {
      ...bodiesV2,
      'lessons/l1.json': bodiesV1['lessons/l1.json'],
      'modules/m1.json': bodiesV1['modules/m1.json'],
    };
    const entry = makeEntry(
      '2.0.1',
      [{ op: 'lesson-content', lessonId: 'l1', severity: 'soft' }],
      unchanged,
    );
    expect(verifyManifestRelease(entry, previous, read(unchanged))).toContain(
      'instruction targets unchanged lesson l1',
    );
  });

  it('rejects a release version that is not above the previous one', () => {
    const entry = makeEntry(
      '2.0.0',
      [{ op: 'lesson-content', lessonId: 'l1', severity: 'soft' }],
      bodiesV2,
    );
    expect(verifyManifestRelease(entry, previous, read(bodiesV2))).toContain(
      'release version 2.0.0 is not above previous 2.0.0',
    );
  });

  it('rejects hashes that do not match the exact bytes', () => {
    const entry = makeEntry(
      '2.0.1',
      [{ op: 'lesson-content', lessonId: 'l1', severity: 'soft' }],
      bodiesV2,
    );
    const tampered = { ...bodiesV2, 'lessons/l1.json': '{"l":"tampered"}' };
    expect(verifyManifestRelease(entry, previous, read(tampered))).toContain(
      'hash mismatch for lessons/l1.json',
    );
  });

  it('rejects missing version files', () => {
    const entry = makeEntry(
      '2.0.1',
      [{ op: 'lesson-content', lessonId: 'l1', severity: 'soft' }],
      bodiesV2,
    );
    const partial = { ...bodiesV2 } as Record<string, string>;
    delete partial['lessons/l1.json'];
    expect(verifyManifestRelease(entry, previous, read(partial))).toContain(
      'missing version file lessons/l1.json',
    );
  });
});
