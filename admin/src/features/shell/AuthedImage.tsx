import React, { useEffect, useState } from 'react';

import { useAuth } from '@admin/store/authStore';

// Competitor artwork sits behind the admin API, and a plain <img> cannot carry
// the Bearer. When a session is present the bytes are fetched with it and
// served to the tag as an object URL; with open access the tag loads the path
// directly, exactly as before.

const objectUrls = new Map<string, string>();
const inflight = new Map<string, Promise<string | null>>();

const resolve = async (src: string): Promise<string | null> => {
  const cached = objectUrls.get(src);
  if (cached != null) {
    return cached;
  }
  const pending = inflight.get(src);
  if (pending != null) {
    return pending;
  }

  const promise = (async () => {
    const token = await useAuth.getState().bearer();
    if (token.length === 0 || typeof URL.createObjectURL !== 'function') {
      objectUrls.set(src, src);
      return src;
    }
    const response = await fetch(src, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!response.ok) {
      return null;
    }
    const url = URL.createObjectURL(await response.blob());
    objectUrls.set(src, url);
    return url;
  })().finally(() => inflight.delete(src));

  inflight.set(src, promise);
  return promise;
};

type Props = React.ImgHTMLAttributes<HTMLImageElement> & { src: string };

const AuthedImage: React.FC<Props> = ({ src, alt, ...rest }) => {
  const [url, setUrl] = useState<string | null>(objectUrls.get(src) ?? null);

  useEffect(() => {
    let live = true;
    void resolve(src).then(resolved => {
      if (live) {
        setUrl(resolved);
      }
    });
    return () => {
      live = false;
    };
  }, [src]);

  if (url == null) {
    return null;
  }
  return <img {...rest} alt={alt} src={url} />;
};

export default AuthedImage;
