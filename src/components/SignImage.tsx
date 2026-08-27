import React, { useEffect, useState } from 'react';
import { Image } from 'react-native';
import { SvgUri, SvgXml } from 'react-native-svg';

import { signAssetUrl } from '@/data/signs/client';
import { SEED_SIGN_SVGS } from '@/data/signs/seedAssets';
import {
  SIGN_IMAGE_EXTENSIONS,
  Sign,
  SignImageRef,
  signThumbRef,
} from '@/data/signs/wire';

import PlaceholderImage from './PlaceholderImage';

// A sign's picture at a given size. Every sign carries uploaded artwork, so
// this is the only thing that draws one. Assets are content-addressed, which
// means the platform image cache holds them indefinitely and a re-render costs
// nothing.

type SignImageProps = {
  sign: Sign;
  size: number;
  // Thumbnails take the thumb slot when the sign has one and fall back to the
  // full image otherwise; the detail screen always wants the full image.
  variant?: 'thumb' | 'full';
};

const SignImage: React.FC<SignImageProps> = ({
  sign,
  size,
  variant = 'thumb',
}) => {
  const ref: SignImageRef =
    variant === 'full' ? sign.image.full : signThumbRef(sign.image);

  // Keyed by asset id, so a catalogue update that swaps the picture clears a
  // previous failure instead of leaving this sign permanently blank.
  const [failedAssetId, setFailedAssetId] = useState<string | null>(null);
  useEffect(() => {
    setFailedAssetId(null);
  }, [ref.assetId]);

  // The bundled catalogue's artwork ships with the app, so a fresh install
  // draws every sign with no network. Anything published later is not in here
  // and comes from the server.
  const bundled = SEED_SIGN_SVGS[ref.assetId];
  if (bundled != null) {
    return <SvgXml xml={bundled} width={size} height={size} />;
  }

  if (failedAssetId === ref.assetId) {
    return <PlaceholderImage label={sign.name} height={size} radius={8} />;
  }

  const uri = signAssetUrl(ref.assetId, SIGN_IMAGE_EXTENSIONS[ref.mime]);

  if (ref.mime === 'image/svg+xml') {
    return (
      <SvgUri
        uri={uri}
        width={size}
        height={size}
        onError={() => setFailedAssetId(ref.assetId)}
      />
    );
  }

  return (
    <Image
      source={{ uri }}
      style={{ width: size, height: size }}
      // Signs are authored square but must never be cropped: a clipped shape
      // is the wrong answer on a shape-recognition question.
      resizeMode="contain"
      onError={() => setFailedAssetId(ref.assetId)}
    />
  );
};

export default SignImage;
