import React from 'react';
import { SvgXml } from 'react-native-svg';
import { useTheme } from 'styled-components/native';

import { iconXml, IconName } from '@/assets/icons';

type IconProps = {
  name: IconName;
  // A glyph shipped with the course. It wins over `name`, which stays as the
  // fallback for content authored against an icon this build does not have.
  xml?: string;
  size?: number;
  color?: string;
};

// Renders the design-system SVGs at a square `size`, letterboxed like the
// HTML reference's `mask: center/contain` (the viewBoxes are not all square).
//
// `key={name}` is deliberate. Call sites such as the lesson kicker keep one
// `Icon` element at a fixed position in the tree and only swap `name`, so
// without a key React reconciles every icon into the same native SVG view and
// mutates it in place. The key mounts a fresh view per glyph instead.
//
// What that is and is not worth: on iOS this is a no-op. An on-device A/B
// (keyed vs unkeyed, eight icons, eight different viewBoxes, pixel-diffed)
// found zero differing pixels, and driving the real lesson deck forwards and
// backwards never produced a bad frame. Do not expect it to change anything
// on iOS.
//
// It matters on Android, where react-native-svg caches each SvgView's render
// as a Bitmap. SvgView.invalidate() only drops that cache when
// `mRemovalTransitionStarted` is false, and that flag is set in
// startViewTransition() and never reset — there is no endViewTransition
// override (SvgView.java:63, :103, :115). Once a removal transition has run,
// the view keeps blitting its stale bitmap at (0,0) forever, which reads as a
// glyph that is clipped and offset inside its own box. A fresh view per name
// sidesteps it, because a new SvgView starts with a null bitmap and the flag
// clear.
const Icon: React.FC<IconProps> = ({ name, xml, size = 16, color }) => {
  const theme = useTheme();
  // Course glyphs have no name to key by, so they key by their own bytes —
  // the same thing CourseAssetView does, for the same Android reason.
  const svg = xml ?? iconXml[name];

  return (
    <SvgXml
      key={xml ?? name}
      xml={svg}
      width={size}
      height={size}
      // Only paths drawn in `currentColor` follow this; artwork with its own
      // fills keeps them, which is how an author asks for a coloured glyph.
      color={color ?? theme.colors.ink}
    />
  );
};

export default Icon;
