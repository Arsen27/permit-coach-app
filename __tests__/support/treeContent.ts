import { readFileSync } from 'fs';
import { join } from 'path';

import type { CourseDocV2, ModuleDocV2 } from '@/data/course/v2/wire';
import { sha256Hex, utf8ByteLength } from '@/lib/sha256';

// The committed content tree predates artwork-as-a-file: its documents carry
// their SVG inline. It is only an import source now — the server converts on
// the way in — so tests that want to reason about released documents convert
// the same way here, rather than the tree being migrated for their sake.

export const TREE_DIR = join(__dirname, '..', '..', 'server', 'content');

type LegacyAsset = {
  assetId: string;
  uuid: string;
  type?: string;
  width: number;
  height: number;
  alt: string;
  sha256: string;
  svgXml?: string;
};

export type TreeDoc = { body: string; parsed: unknown };

// Exactly what the server would store for this document, bytes included.
export const convertTreeDoc = (raw: string): TreeDoc => {
  const doc = JSON.parse(raw) as {
    schemaVersion: number;
    assets?: LegacyAsset[];
  };
  doc.schemaVersion = 3;
  if (Array.isArray(doc.assets)) {
    doc.assets = doc.assets.map(asset => {
      if (asset.svgXml == null) {
        return asset;
      }
      return {
        assetId: asset.assetId,
        uuid: asset.uuid,
        mime: 'image/svg+xml',
        width: asset.width,
        height: asset.height,
        alt: asset.alt,
        sha256: sha256Hex(asset.svgXml),
        sizeBytes: utf8ByteLength(asset.svgXml),
      } as unknown as LegacyAsset;
    });
  }
  const body = `${JSON.stringify(doc, null, 2)}\n`;
  return { body, parsed: JSON.parse(body) };
};

export const readTreeDoc = (
  courseId: string,
  version: string,
  relPath: string,
): TreeDoc =>
  convertTreeDoc(
    readFileSync(join(TREE_DIR, courseId, version, relPath), 'utf8'),
  );

// One released version, as the server would serve it.
export const readTreeVersion = (
  courseId: string,
  version: string,
): { courseDoc: CourseDocV2; moduleDocs: ModuleDocV2[] } => {
  const courseDoc = readTreeDoc(courseId, version, 'course.json')
    .parsed as CourseDocV2;
  return {
    courseDoc,
    moduleDocs: courseDoc.course.moduleIds.map(
      id =>
        readTreeDoc(courseId, version, join('modules', `${id}.json`))
          .parsed as ModuleDocV2,
    ),
  };
};
