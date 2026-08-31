import React, { useState } from 'react';
import { Image } from 'react-native';
import styled from 'styled-components/native';

import { useAssetSource } from '@/data/assets/store';

import CachedSvg, { svgDrawable } from './CachedSvg';
import type { CourseAssetV2 } from '@/data/course/v2/wire';

import ArtworkSkeleton from './ArtworkSkeleton';

// Anything that can be drawn. A course asset is a reference to a file the
// content server holds; the authored practice questions supply their markup
// inline from their own art registry. Both arrive here.
export type Diagram = {
  svgXml: string;
  alt: string;
  // Authored pixel size. The frame takes this ratio, so every asset —
  // portrait photos included — spans the full available width and the height
  // follows. Registry art without a size keeps the classic 16:9.
  width?: number;
  height?: number;
};

type Drawable = Diagram | CourseAssetV2;

type CourseAssetViewProps = {
  asset?: Drawable;
  radius?: number;
};

const inlineMarkup = (asset: Drawable): string | null =>
  'svgXml' in asset ? asset.svgXml : null;

// Course illustration. Both kinds are drawn from the device: a vector from
// the markup the updater stored, a photograph from its bytes. Neither needs
// the network — a course on the phone is a course that renders on a plane.
const DEFAULT_ASPECT_RATIO = 16 / 9;

const aspectRatioOf = (asset: Drawable): number =>
  asset.width != null &&
  asset.height != null &&
  asset.width > 0 &&
  asset.height > 0
    ? asset.width / asset.height
    : DEFAULT_ASPECT_RATIO;

const CourseAssetView: React.FC<CourseAssetViewProps> = ({
  asset,
  radius = 14,
}) => {
  // Which drawing failed, not merely that one did. A lesson walks several
  // illustrations through this one mounted view, and a bare `failed` boolean
  // had nothing to reset it — so the first unparseable asset turned every
  // later card's diagram into a placeholder for the rest of the lesson.
  const [failedKey, setFailedKey] = useState<string | null>(null);

  // Inline markup wins (registry art); anything else is a stored picture.
  const inline = asset == null ? null : inlineMarkup(asset);
  const { source: stored, pending } = useAssetSource(
    asset != null && inline == null ? (asset as CourseAssetV2) : null,
  );
  const markup = inline ?? (stored?.kind === 'markup' ? stored.markup : null);
  const uri = stored?.kind === 'uri' ? stored.uri : null;
  const key = markup ?? uri;
  // Parsed once per picture, never per mount: SvgXml re-parsed its markup on
  // every visit to a card, and in a debug build that read as a flicker.
  const svgKey =
    markup == null
      ? null
      : 'svgXml' in (asset ?? {})
      ? markup
      : (asset as CourseAssetV2).sha256;

  // Nothing to draw yet, or ever: a picture still being read off the device,
  // one whose download has not landed, or one that would not decode. All of
  // them hold the picture's own shape, so the card never reflows when the
  // illustration arrives — only the failure holds still instead of
  // shimmering, because nothing is coming for it.
  const undrawable =
    asset == null ||
    key === failedKey ||
    (markup != null && svgKey != null && !svgDrawable(svgKey, markup));
  if (pending || undrawable || key == null) {
    return (
      <ArtworkSkeleton
        aspectRatio={asset == null ? undefined : aspectRatioOf(asset)}
        radius={radius}
        // A card that cannot name its picture at all, or holds one that will
        // not decode, is not waiting for anything.
        still={undrawable}
        label={asset?.alt}
      />
    );
  }

  return (
    // The ratio goes straight into `style`, like ShowcaseScreen's
    // illustration: no css template between the number and the native view.
    // (The RN 0.86 aspectRatio-in-Image-style bug does not apply — this
    // frame is a plain View.)
    <Frame
      style={{ borderRadius: radius, aspectRatio: aspectRatioOf(asset) }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={asset.alt}
    >
      {/*
        Keyed by the drawing itself, for the reason spelled out in Icon.tsx:
        on Android a mounted SvgXml can go on blitting a stale cached bitmap,
        and a diagram is big enough that doing so is impossible to miss.
      */}
      {markup != null && svgKey != null ? (
        <CachedSvg
          key={key}
          cacheKey={svgKey}
          markup={markup}
          width="100%"
          height="100%"
        />
      ) : (
        <Image
          key={key}
          source={{ uri: uri! }}
          style={{ width: '100%', height: '100%' }}
          resizeMode="contain"
          onError={() => setFailedKey(key)}
        />
      )}
    </Frame>
  );
};

const Frame = styled.View`
  width: 100%;
  overflow: hidden;
`;

export default CourseAssetView;
