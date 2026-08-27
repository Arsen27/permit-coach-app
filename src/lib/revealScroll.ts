// Geometry for "bring a block that just appeared into view — but only if it
// actually needs it". Used when a quiz reveals its answer feedback below a
// long question: on a short question the feedback is already on screen and
// scrolling would be jarring, on a long one it sits below the fold.
type RevealScrollInput = {
  /** Current vertical scroll offset of the list. */
  offset: number;
  /** Visible height of the scroll viewport. */
  viewport: number;
  /** The block's y position inside the scroll content. */
  blockY: number;
  /** The block's measured height. */
  blockHeight: number;
  /** Height of anything floating over the bottom of the viewport (a CTA). */
  bottomOverlay?: number;
  /** Breathing room left between the block and the overlay. */
  margin?: number;
};

/**
 * The offset to scroll to so the block is fully visible, or `null` when it
 * already is (or cannot be measured yet) and the list should stay put.
 */
export const revealScrollOffset = ({
  offset,
  viewport,
  blockY,
  blockHeight,
  bottomOverlay = 0,
  margin = 12,
}: RevealScrollInput): number | null => {
  if (viewport <= 0 || blockHeight <= 0) {
    return null;
  }
  const visibleBottom = offset + viewport - bottomOverlay;
  const blockBottom = blockY + blockHeight;
  if (blockBottom <= visibleBottom) {
    return null;
  }
  const target = blockBottom + margin - viewport + bottomOverlay;
  // A block taller than the viewport can never fit; line its top up instead
  // so the user reads it from the beginning rather than from the middle.
  const topAligned = Math.max(0, blockY - margin);
  const next = Math.max(0, Math.min(target, topAligned));
  // Never scroll backwards: the block is cut off at the bottom, so anything
  // at or above the current offset means the user is already inside it.
  return next <= offset ? null : next;
};
