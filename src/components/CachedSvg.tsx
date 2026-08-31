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
const PARSE_CHUNK = 12;

export const warmSvgAsts = async (
  assets: { sha256: string; mime: string }[],
): Promise<void> => {
  const vectors = assets.filter(isVectorAsset);
  for (let index = 0; index < vectors.length; index += PARSE_CHUNK) {
    for (const asset of vectors.slice(index, index + PARSE_CHUNK)) {
      const markup = vectorMarkup(asset);
      if (markup != null) {
        astOf(asset.sha256, markup);
      }
    }
    // Yield the thread: this is a warm-up, not a race.
    await new Promise(resolve => setTimeout(resolve, 0));
  }
};

// Test seam.
export const resetSvgAstsForTests = (): void => {
  cache.clear();
};

export default CachedSvg;
