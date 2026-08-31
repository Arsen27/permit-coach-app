import { useEffect, useMemo, useState } from 'react';

// The slides a player keeps mounted: the active one, optionally the one
// behind it (for Back), and the one ahead. The one ahead is premounted one
// commit AFTER a transition — while the learner reads — so the flip itself
// never mounts anything. Rendering the window keyed by the slide's own id
// is the point: when the premounted slide becomes active its instance
// survives, native views and all — an SVG's tree above everything — and
// the transition costs a display flip.
export const useMountedWindow = (
  index: number,
  count: number,
  behind: 0 | 1,
): number[] => {
  const [ahead, setAhead] = useState(index + 1);
  useEffect(() => {
    setAhead(index + 1);
  }, [index]);
  return useMemo(
    () =>
      [...new Set([index - behind, index, ahead])]
        .filter(i => i >= 0 && i < count)
        .sort((a, b) => a - b),
    [index, ahead, count, behind],
  );
};
