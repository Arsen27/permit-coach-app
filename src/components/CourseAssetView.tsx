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
};

type CourseAssetViewProps = {
  asset?: Diagram;
  radius?: number;
};

// Course illustration: embedded SVG XML rendered natively, so every diagram
// works fully offline. Assets are authored 1200×675; the frame keeps the 16:9
// ratio and scales proportionally to the available width.
const ASPECT_RATIO = 16 / 9;

const CourseAssetView: React.FC<CourseAssetViewProps> = ({
  asset,
  radius = 14,
}) => {
  const [failed, setFailed] = useState(false);

  if (asset == null || failed) {
    return (
      <PlaceholderImage
        label={asset?.alt ?? 'illustration unavailable'}
        height={186}
        radius={radius}
      />
    );
  }

  return (
    <Frame
      style={{ borderRadius: radius }}
      accessible
      accessibilityRole="image"
      accessibilityLabel={asset.alt}
    >
      <SvgXml
        xml={asset.svgXml}
        width="100%"
        height="100%"
        onError={() => setFailed(true)}
      />
    </Frame>
  );
};

const Frame = styled.View`
  width: 100%;
  aspect-ratio: ${ASPECT_RATIO};
  overflow: hidden;
`;

export default CourseAssetView;
