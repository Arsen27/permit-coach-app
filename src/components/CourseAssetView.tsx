import React, { useState } from 'react';
import styled from 'styled-components/native';
import { SvgXml } from 'react-native-svg';

import PlaceholderImage from './PlaceholderImage';

// Anything that can be drawn as an embedded diagram. CourseAssetV2 satisfies
// this structurally, so course assets pass straight through; the authored
// practice questions supply the same pair from their own art registry.
export type Diagram = {
  svgXml: string;
  alt: string;
  // Authored pixel size. The frame takes this ratio, so every asset —
  // portrait photos included — spans the full available width and the height
  // follows. Registry art without a size keeps the classic 16:9.
  width?: number;
  height?: number;
};

type CourseAssetViewProps = {
  asset?: Diagram;
  radius?: number;
};

// Course illustration: embedded SVG XML rendered natively, so every diagram
// works fully offline.
const DEFAULT_ASPECT_RATIO = 16 / 9;

const aspectRatioOf = (asset: Diagram): number =>
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
  const [failedXml, setFailedXml] = useState<string | null>(null);

  if (asset == null || asset.svgXml === failedXml) {
    return (
      <PlaceholderImage
        label={asset?.alt ?? 'illustration unavailable'}
        height={186}
        radius={radius}
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
        and a diagram is big enough that doing so is impossible to miss. The
        XML is the identity here because `Diagram` carries no id of its own.
      */}
      <SvgXml
        key={asset.svgXml}
        xml={asset.svgXml}
        width="100%"
        height="100%"
        onError={() => setFailedXml(asset.svgXml)}
      />
    </Frame>
  );
};

const Frame = styled.View`
  width: 100%;
  overflow: hidden;
`;

export default CourseAssetView;
