import React, { useEffect, useState } from 'react';
import { Image } from 'react-native';
import { SvgXml } from 'react-native-svg';

import { useAssetSource } from '@/data/assets/store';
import { SEED_SIGN_SVGS } from '@/data/signs/seedAssets';
import {
  SIGN_IMAGE_EXTENSIONS,
  Sign,
  SignImageRef,
  signThumbRef,
} from '@/data/signs/wire';

import PlaceholderImage from './PlaceholderImage';

// A sign's picture at a given size. Every sign carries uploaded artwork, so
// this is the only thing that draws one. The bundled catalogue's artwork ships
// with the app; anything published later is downloaded with the catalogue and
// drawn from the device, so a sign learnt on the train draws in a tunnel.

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

  // Content-addressed, so the id is the hash: the same picture in the store
  // and in the bundle are the same bytes.
  const downloaded = useAssetSource({ sha256: ref.assetId, mime: ref.mime });

  // The bundled catalogue's artwork ships with the app, so a fresh install
  // draws every sign with no network. Anything published later is not in here
  // and comes from the server.
  const bundled = SEED_SIGN_SVGS[ref.assetId];

  // The bundled copy needs no read at all; anything else comes off the device.
  const stored: ReturnType<typeof useAssetSource> =
    bundled != null ? { kind: 'markup', markup: bundled } : downloaded;

  if (failedAssetId === ref.assetId || stored == null) {
    return <PlaceholderImage label={sign.name} height={size} radius={8} />;
  }

  if (stored.kind === 'markup') {
    return (
      <SvgXml
        xml={stored.markup}
        width={size}
        height={size}
        onError={() => setFailedAssetId(ref.assetId)}
      />
    );
  }

  return (
    <Image
      source={{ uri: stored.uri }}
      style={{ width: size, height: size }}
      // Signs are authored square but must never be cropped: a clipped shape
      // is the wrong answer on a shape-recognition question.
      resizeMode="contain"
      onError={() => setFailedAssetId(ref.assetId)}
    />
  );
};

export default SignImage;
