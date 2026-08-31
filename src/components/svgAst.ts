import { parse } from 'react-native-svg';
import type { JsxAST } from 'react-native-svg';

import { isVectorAsset, vectorMarkup } from '@/data/assets/store';
import { createLogger } from '@/lib/log';

// Parsed SVG, once per picture. SvgXml parses its markup on every mount, so
// every visit to a card paid the parse again; here the tree is built the
// first time a picture is needed — or in the background right after launch —
// and drawing it later costs nothing.

const log = createLogger('assets');

const MAX_ENTRIES = 400;

// null records a markup that would not parse, so it is not retried per frame.
const cache = new Map<string, JsxAST | null>();

export const astOf = (key: string, markup: string): JsxAST | null => {
  const cached = cache.get(key);
  if (cached !== undefined) {
    return cached;
  }
  let ast: JsxAST | null = null;
  try {
    ast = parse(markup);
  } catch (error) {
    log.warn(`svg ${key.slice(0, 12)} would not parse`, error);
  }
  if (cache.size >= MAX_ENTRIES) {
    cache.delete(cache.keys().next().value as string);
  }
  cache.set(key, ast);
  return ast;
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
