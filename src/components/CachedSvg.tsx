import React from 'react';
import * as RNSvg from 'react-native-svg';

import { isVectorAsset, vectorMarkup } from '@/data/assets/store';
import { createLogger } from '@/lib/log';

// SVG drawn from a tree parsed once per picture. SvgXml parses its markup on
// every mount, so every visit to a card paid the parse again; here the tree
// is built the first time a picture is needed — or in the background right
// after launch — and drawing it later costs nothing.
//
// The parser and the ast renderer are public exports of react-native-svg at
// runtime; its type entry hides them, so they are reached through a cast
// that both the app's and the admin's compilers accept.

const log = createLogger('assets');

type SvgTree = object;

const { parse, SvgAst } = RNSvg as unknown as {
  parse: (xml: string) => SvgTree | null;
  SvgAst: React.FC<{ ast: SvgTree | null; override?: object }>;
};

const MAX_ENTRIES = 400;
const PARSE_CHUNK = 12;

// null records a markup that would not parse, so it is not retried per frame.
const cache = new Map<string, SvgTree | null>();

const astOf = (key: string, markup: string): SvgTree | null => {
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  let tree: SvgTree | null = null;
  try {
    tree = parse(markup);
  } catch (error) {
    log.warn(`svg ${key.slice(0, 12)} would not parse`, error);
  }
  if (cache.size >= MAX_ENTRIES) {
    cache.delete(cache.keys().next().value as string);
  }
  cache.set(key, tree);
  return tree;
};

// Whether this markup has a drawable tree; a false answer is what a caller
// turns into its placeholder.
export const svgDrawable = (key: string, markup: string): boolean =>
  astOf(key, markup) != null;

// Whether the tree for this key is already built — parsed fine or refused,
// either way drawing it costs nothing now.
export const svgTreeWarm = (key: string): boolean => cache.has(key);

// Parses a batch of markups whose bytes the caller already holds, a few per
// tick. The entry gates hand these over so no slide pays a parse mid-lesson.
export const warmSvgMarkups = async (
  entries: readonly { key: string; markup: string }[],
): Promise<void> => {
  for (let index = 0; index < entries.length; index += PARSE_CHUNK) {
    for (const entry of entries.slice(index, index + PARSE_CHUNK)) {
      astOf(entry.key, entry.markup);
    }
    // Yield the thread: this is a warm-up, not a race.
    await new Promise(resolve => setTimeout(resolve, 0));
  }
};

type CachedSvgProps = {
  // The cache key: a content hash where there is one, the markup itself
  // otherwise.
  cacheKey: string;
  markup: string;
  width: number | string;
  height: number | string;
};

const CachedSvg: React.FC<CachedSvgProps> = ({
  cacheKey,
  markup,
  width,
  height,
}) => {
  const tree = astOf(cacheKey, markup);
  if (tree == null) {
    return null;
  }
  return <SvgAst ast={tree} override={{ width, height }} />;
};

// Parses the course's diagrams in the background after launch, a few per
// tick, so the first visit to any card finds its tree already built.
export const warmSvgAsts = (
  assets: { sha256: string; mime: string }[],
): Promise<void> =>
  warmSvgMarkups(
    assets.filter(isVectorAsset).flatMap(asset => {
      const markup = vectorMarkup(asset);
      return markup == null ? [] : [{ key: asset.sha256, markup }];
    }),
  );

// Test seam.
export const resetSvgAstsForTests = (): void => {
  cache.clear();
};

export default CachedSvg;
