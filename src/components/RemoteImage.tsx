import React, { useState } from 'react';
import { Image, StyleSheet } from 'react-native';
import styled from 'styled-components/native';

import PlaceholderImage from './PlaceholderImage';

export type CourseImage = {
  url: string;
  caption?: string;
};

type RemoteImageProps = {
  image?: CourseImage;
  height: number;
  radius?: number;
  placeholderLabel: string;
};

// Course imagery: a remote URL when the asset exists, the hatched placeholder
// while loading, on error, or when no asset was produced yet. Relies on the
// platform image cache — content URLs are immutable (a new image is a new
// file).
const RemoteImage: React.FC<RemoteImageProps> = ({
  image,
  height,
  radius = 0,
  placeholderLabel,
}) => {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  if (image == null || failed) {
    return (
      <PlaceholderImage
        label={placeholderLabel}
        height={height}
        radius={radius}
      />
    );
  }

  return (
    <Frame style={{ height, borderRadius: radius }}>
      {!loaded && (
        <PlaceholderImage
          label={image.caption ?? placeholderLabel}
          height={height}
          radius={radius}
        />
      )}
      <Image
        source={{ uri: image.url }}
        style={StyleSheet.absoluteFill}
        resizeMode="cover"
        onLoad={() => setLoaded(true)}
        onError={() => setFailed(true)}
      />
    </Frame>
  );
};

const Frame = styled.View`
  overflow: hidden;
`;

export default RemoteImage;
