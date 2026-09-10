// Where an excerpt came from, precisely enough that a model can find it again.
//
// A quote on its own is ambiguous: the same sentence can appear in two slides
// of the same lesson, and a fragment of one ("stop before the crosswalk") can
// match half a dozen. So an excerpt carries the block it was taken from — the
// id `edit_block` itself takes — and the numbered lines it falls in, with those
// lines quoted in full. The model is then told a place, not asked to search.
//
// The numbering is the card as the panel draws it: line 1 is the title, then
// each body line in order, then the question and its answers. It is stated in
// the prompt so nothing has to be inferred from the shape.

export type ExcerptAnchor = {
  lessonId: string;
  blockId: string;
  // Which card of the lesson, as the viewer numbers them.
  cardIndex: number;
  cardCount: number;
  // "Core rule", "Exam trap" — what a reader sees above the card.
  kicker: string;
  // 1-based, inclusive. The same number twice means one line.
  fromLine: number;
  toLine: number;
  // Every line the excerpt touches, whole. A selection is usually a fragment,
  // and the whole line is what makes it findable.
  lineTexts: string[];
};

const closest = (node: Node | null, selector: string): HTMLElement | null => {
  const start =
    node == null
      ? null
      : node.nodeType === Node.ELEMENT_NODE
      ? (node as HTMLElement)
      : node.parentElement;
  return start?.closest(selector) ?? null;
};

const lineOf = (node: Node | null): HTMLElement | null =>
  closest(node, '[data-line]');

// Reads the anchor out of a live selection. Returns null when the selection is
// not inside a card the viewer marked up — an excerpt without a place is still
// worth collecting, it just cannot claim one.
export const anchorOfSelection = (
  selection: Selection | null,
): ExcerptAnchor | null => {
  if (selection == null || selection.rangeCount === 0) {
    return null;
  }
  const card = closest(selection.anchorNode, '[data-block-id]');
  if (card == null) {
    return null;
  }
  const lines = [...card.querySelectorAll<HTMLElement>('[data-line]')];
  if (lines.length === 0) {
    return null;
  }
  // A drag that starts on the card's number or its kicker begins outside any
  // line — and selecting a whole card that way is the most natural gesture
  // there is. Falling back to the card's full span is right there: the
  // selection really does cover all of it.
  const startEl = lineOf(selection.anchorNode);
  const endEl = lineOf(selection.focusNode);
  const numberOf = (element: HTMLElement | null, fallback: number): number =>
    element == null ? fallback : Number(element.dataset.line);
  const first = Number(lines[0].dataset.line);
  const last = Number(lines[lines.length - 1].dataset.line);
  // A selection dragged upwards has its focus before its anchor.
  const a = numberOf(startEl, first);
  const b = numberOf(
    endEl,
    startEl == null ? last : Number(startEl.dataset.line),
  );
  const fromLine = Math.min(a, b);
  const toLine = Math.max(a, b);

  return {
    lessonId: card.dataset.lessonId ?? '',
    blockId: card.dataset.blockId ?? '',
    cardIndex: Number(card.dataset.cardIndex ?? '0'),
    cardCount: Number(card.dataset.cardCount ?? '0'),
    kicker: card.dataset.kicker ?? '',
    fromLine,
    toLine,
    lineTexts: lines
      .filter(line => {
        const n = Number(line.dataset.line);
        return n >= fromLine && n <= toLine;
      })
      .map(line => (line.textContent ?? '').trim()),
  };
};

// The one-line "where" a prompt and the panel both show.
export const describeAnchor = (anchor: ExcerptAnchor): string => {
  const where =
    anchor.cardCount > 0
      ? `card ${anchor.cardIndex} of ${anchor.cardCount}`
      : `card ${anchor.cardIndex}`;
  const lines =
    anchor.fromLine === anchor.toLine
      ? `line ${anchor.fromLine}`
      : `lines ${anchor.fromLine}–${anchor.toLine}`;
  return [anchor.kicker, where, lines].filter(Boolean).join(' · ');
};
