import React, { useEffect, useState } from 'react';
import { Image } from 'react-native';
import { SvgUri } from 'react-native-svg';

import SignArt from '@/components/SignArt';
import { signAssetUrl } from '@/data/signs/client';
import {
  SIGN_IMAGE_EXTENSIONS,
  Sign,
  SignImageRef,
  signThumbRef,
} from '@/data/signs/wire';

// A sign's picture at a given size. An uploaded image replaces the drawn art
// when the sign has one; the drawn art stays the fallback, so a sign renders
// correctly offline, before the upload has been fetched, and if the file ever
// fails to load. Assets are content-addressed, so the platform image cache
// holds them indefinitely and a re-render costs nothing.

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
  const ref: SignImageRef | undefined =
    sign.image == null
      ? undefined
      : variant === 'full'
      ? sign.image.full
      : signThumbRef(sign.image);

  // Keyed by asset id, so a catalogue update that swaps the picture clears a
  // previous failure instead of leaving this sign permanently on the fallback.
  const [failedAssetId, setFailedAssetId] = useState<string | null>(null);
  useEffect(() => {
    setFailedAssetId(null);
  }, [ref?.assetId]);

  if (ref == null || failedAssetId === ref.assetId) {
    return <SignArt art={sign.art} size={size} />;
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
      // Signs are authored square-ish but must never be cropped: a clipped
      // shape is the wrong answer on a shape-recognition question.
      resizeMode="contain"
      onError={() => setFailedAssetId(ref.assetId)}
    />
  );
};

export default SignImage;
