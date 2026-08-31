import { useEffect, useMemo, useState } from 'react';

import { svgTreeWarm, warmSvgMarkups } from '@/components/CachedSvg';

import {
  AssetRef,
  assetInMemory,
  ensureAssets,
  isVectorAsset,
  vectorMarkup,
  warmAssets,
} from './store';

// The entry gate for a screen full of artwork. A lesson's slides and a
// quiz's questions each pay their real costs — storage reads and SVG
// parses — at the door, behind one full-screen skeleton, so no transition
// inside ever pays them again.
//
// The gate waits for the device, never for the network: pictures that are
// not downloaded yet are requested in the background and land into their
// own shimmering frames, but an offline learner is not stared down by a
// full-screen skeleton that cannot end.

export type ArtworkSpec = {
  // Pictures the device stores by hash — course assets, sign artwork.
  ensure: AssetRef[];
  // Markup already at hand (bundled sign art, authored diagrams), keyed the
  // way the drawing components key it.
  inline: { key: string; markup: string }[];
};

// Whether everything this spec names that IS on the device is already in
// memory with its tree built — the synchronous fast path, so a lesson
// re-entered a second later never flashes the gate.
export const artworkWarm = (spec: ArtworkSpec): boolean =>
  spec.ensure.every(
    ref =>
      assetInMemory(ref.sha256) &&
      (!isVectorAsset(ref) || svgTreeWarm(ref.sha256)),
  ) && spec.inline.every(entry => svgTreeWarm(entry.key));

// Reads and parses everything local; fires the downloads without waiting on
// them. Resolves when the screen can transition freely through what it has.
export const warmArtwork = async (spec: ArtworkSpec): Promise<void> => {
  // The downloads, in the background: each picture notifies as it lands and
  // its frame stops shimmering on its own.
  const download = ensureAssets(spec.ensure).catch(() => undefined);
  // Everything already here: bytes into memory, then trees.
  await warmAssets(spec.ensure).catch(() => undefined);
  const vectors = spec.ensure.flatMap(ref => {
    if (!isVectorAsset(ref)) {
      return [];
    }
    const markup = vectorMarkup(ref);
    return markup == null ? [] : [{ key: ref.sha256, markup }];
  });
  await warmSvgMarkups([...vectors, ...spec.inline]).catch(() => undefined);
  // Whatever the network delivers is warmed as a second pass, so a learner
  // who waits a beat on the first slide still gets free transitions.
  void download.then(async () => {
    await warmAssets(spec.ensure).catch(() => undefined);
    await warmSvgMarkups(
      spec.ensure.flatMap(ref => {
        if (!isVectorAsset(ref) || svgTreeWarm(ref.sha256)) {
          return [];
        }
        const markup = vectorMarkup(ref);
        return markup == null ? [] : [{ key: ref.sha256, markup }];
      }),
    ).catch(() => undefined);
  });
};

// True once the screen may show its content. Starts true when everything is
// already warm, so the gate never flashes on a re-entry.
export const useArtworkGate = (spec: ArtworkSpec): boolean => {
  const [ready, setReady] = useState(() => artworkWarm(spec));
  // The spec is derived from a stable question/card list; the gate runs once.
  const initial = useMemo(() => spec, []); // eslint-disable-line react-hooks/exhaustive-deps
  useEffect(() => {
    if (ready) {
      return;
    }
    let alive = true;
    warmArtwork(initial).then(() => {
      if (alive) {
        setReady(true);
      }
    });
    return () => {
      alive = false;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);
  return ready;
};
