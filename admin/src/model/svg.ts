import { adminApi } from '@admin/api/adminApi';
import { svgSafetyErrors } from '@/data/course/v2/wire';

// Ingests an uploaded SVG for a lesson illustration: the same safety rules the
// importer and the app enforce, plus size extraction so the asset keeps honest
// dimensions. The server re-checks and re-hashes on save — this is the fast,
// friendly failure.

export type IngestedSvg = { svgXml: string; width: number; height: number };

// Where the panel shows a picture from. The panel is served by the content
// server, so its own asset route is a relative path.
export const assetSrc = (asset: { sha256?: string; mime?: string }): string => {
  const extension =
    asset.mime === 'image/png'
      ? 'png'
      : asset.mime === 'image/jpeg'
      ? 'jpg'
      : 'svg';
  return `/v1/assets/${asset.sha256}.${extension}`;
};

export const ingestSvgUpload = (raw: string): IngestedSvg => {
  const svgXml = raw.replace(/^﻿/, '').trim();
  const open = svgXml.match(/<svg\b[^>]*>/i);
  if (open == null || !/<\/svg\s*>\s*$/i.test(svgXml)) {
    throw new Error('the file is not an SVG document');
  }

  const problems = svgSafetyErrors(svgXml);
  if (problems.length > 0) {
    throw new Error(problems.join('; '));
  }

  const attributes = open[0];
  const numeric = (name: string): number | null => {
    const match = new RegExp(`\\b${name}\\s*=\\s*["']([\\d.]+)`, 'i').exec(
      attributes,
    );
    return match == null ? null : Number.parseFloat(match[1]);
  };

  let width = numeric('width');
  let height = numeric('height');
  if (width == null || height == null) {
    const viewBox =
      /\bviewBox\s*=\s*["']\s*[\d.-]+[\s,]+[\d.-]+[\s,]+([\d.]+)[\s,]+([\d.]+)/i.exec(
        attributes,
      );
    if (viewBox != null) {
      width = width ?? Number.parseFloat(viewBox[1]);
      height = height ?? Number.parseFloat(viewBox[2]);
    }
  }
  if (
    width == null ||
    height == null ||
    !Number.isFinite(width) ||
    !Number.isFinite(height) ||
    width <= 0 ||
    height <= 0
  ) {
    throw new Error('the SVG declares no usable width/height or viewBox');
  }

  return { svgXml, width: Math.round(width), height: Math.round(height) };
};

export const readUploadedSvg = async (file: File): Promise<IngestedSvg> => {
  if (
    file.type !== 'image/svg+xml' &&
    !file.name.toLowerCase().endsWith('.svg')
  ) {
    throw new Error('lesson artwork is SVG — upload an .svg file');
  }
  return ingestSvgUpload(await file.text());
};

// ---------------------------------------------------------------------------
// Course-shipped icons
//
// A slide type's glyph rides inside the course document, which every update
// downloads whole. So an icon is minified before it is stored, and its size is
// shown to the author while they choose it — the cost is small, but it is paid
// on every update by every learner, so it should never be invisible.

// Everything a drawing tool leaves behind that a 15px glyph does not need.
const NOISE: RegExp[] = [
  /<\?xml[\s\S]*?\?>/gi,
  /<!DOCTYPE[\s\S]*?>/gi,
  /<!--[\s\S]*?-->/g,
  /<metadata\b[\s\S]*?<\/metadata\s*>/gi,
  /<title\b[\s\S]*?<\/title\s*>/gi,
  /<desc\b[\s\S]*?<\/desc\s*>/gi,
  // Editor bookkeeping: inkscape:, sodipodi:, sketch: and friends.
  /\s(?:inkscape|sodipodi|sketch|serif|adobe|illustrator|figma):[\w-]+\s*=\s*"[^"]*"/gi,
  /\s(?:inkscape|sodipodi|sketch|serif|adobe|illustrator|figma):[\w-]+\s*=\s*'[^']*'/gi,
  /\sxmlns:(?:inkscape|sodipodi|sketch|serif|adobe|illustrator|figma)\s*=\s*"[^"]*"/gi,
];

export const minifySvg = (svgXml: string): string => {
  let out = svgXml;
  for (const pattern of NOISE) {
    out = out.replace(pattern, '');
  }
  return out
    .replace(/>\s+</g, '><')
    .replace(/\s{2,}/g, ' ')
    .trim();
};

// Does the artwork ask to be tinted? `currentColor` is ordinary SVG semantics,
// not a convention of ours — it is what lets the card's own colour reach it.
export const followsCurrentColor = (svgXml: string): boolean =>
  /currentColor/i.test(svgXml);

// Rewrites explicit paint to `currentColor` so the glyph takes the slide type's
// colour. `none` is left alone: it means "do not paint this", not a colour.
export const toCurrentColor = (svgXml: string): string =>
  svgXml
    .replace(
      /\b(fill|stroke)\s*=\s*"(?!none")[^"]*"/gi,
      (_match, attribute: string) => `${attribute}="currentColor"`,
    )
    .replace(
      /\b(fill|stroke)\s*=\s*'(?!none')[^']*'/gi,
      (_match, attribute: string) => `${attribute}='currentColor'`,
    )
    .replace(
      /\b(fill|stroke)\s*:\s*(?!none)[^;"'}]+/gi,
      (_match, attribute: string) => `${attribute}:currentColor`,
    );

// An icon that declares no paint at all renders as a black silhouette, which is
// never what an author meant by "keep its own colours".
export const paintsItself = (svgXml: string): boolean =>
  /\b(fill|stroke)\s*[:=]/i.test(svgXml);

// Whether a glyph ships tinted is a per-slide-type choice, and a reversible
// one: the caller holds on to the glyph as it was drawn, so a type can be
// flipped back to its own colours without a re-upload. A glyph that declares no
// paint at all is tinted whatever the choice — the alternative is black.
export const tintedIcon = (svgXml: string, tinted: boolean): string =>
  tinted || !paintsItself(svgXml) ? toCurrentColor(svgXml) : svgXml;

// The uploaded glyph exactly as it was drawn: safety-checked and minified, but
// never recoloured. Tinting is the caller's to apply, per slide type.
export const readUploadedIcon = async (file: File): Promise<string> => {
  const { svgXml } = await readUploadedSvg(file);
  return minifySvg(svgXml);
};

// ---------------------------------------------------------------------------
// Uploading lesson artwork
//
// A document points at a picture rather than carrying it, so a file has to
// reach the server before a lesson can name it. The local checks still run
// first: an author should learn that an SVG is unusable before a round trip,
// and the dimensions come from the file itself either way.

export type UploadedArtwork = {
  sha256: string;
  mime: string;
  sizeBytes: number;
  width: number;
  height: number;
};

const rasterSize = (file: File): Promise<{ width: number; height: number }> =>
  new Promise((resolve, reject) => {
    const url = URL.createObjectURL(file);
    const image = new Image();
    image.onload = () => {
      URL.revokeObjectURL(url);
      resolve({ width: image.naturalWidth, height: image.naturalHeight });
    };
    image.onerror = () => {
      URL.revokeObjectURL(url);
      reject(new Error('the file is not an image this browser can read'));
    };
    image.src = url;
  });

export const uploadArtwork = async (file: File): Promise<UploadedArtwork> => {
  const isSvg =
    file.type === 'image/svg+xml' || file.name.toLowerCase().endsWith('.svg');
  const size = isSvg ? await readUploadedSvg(file) : await rasterSize(file);
  if (size.width <= 0 || size.height <= 0) {
    throw new Error('the picture has no size');
  }
  const stored = await adminApi.uploadAsset(file);
  return {
    sha256: stored.assetId,
    mime: stored.mime,
    sizeBytes: stored.sizeBytes,
    width: size.width,
    height: size.height,
  };
};
