import { describeAnchor } from '@admin/model/excerptAnchor';
import type { PromptChunk } from '@admin/store/promptStore';

// One markdown request out of every excerpt the operator collected. The shape
// is fixed so a model receives the same structure every time: where each quote
// came from, what should change about it, then the overall instruction.
//
// "Where" is the part that has to be exact. A quote on its own is ambiguous —
// the same sentence appears in more than one slide, and a fragment of one
// matches half a dozen — so every excerpt names the block id (the same id
// `edit_block` takes), the card's position in the lesson, and the numbered
// lines it falls in, with those lines quoted whole. A model is then told a
// place rather than asked to go looking for one.

export type PromptContext = {
  courseTitle: string;
  usState: string;
  versionLabel: string;
};

export const buildPromptText = (
  chunks: PromptChunk[],
  overallNote: string,
  context: PromptContext,
): string => {
  const parts: string[] = [
    '# Course content revision request',
    '',
    `Course: ${context.courseTitle}`,
    `State: ${context.usState}`,
    `Working version: ${context.versionLabel}`,
    '',
  ];

  if (chunks.some(chunk => chunk.anchor != null)) {
    parts.push(
      'Each excerpt names the block it came from. Line 1 of a card is its',
      'title, then each body line in order, then the question and its answers.',
      'Edit the block named — not another card with similar wording.',
      '',
    );
  }

  chunks.forEach((chunk, index) => {
    parts.push(`## Excerpt ${index + 1} — ${chunk.source}`, '');
    const anchor = chunk.anchor;
    if (anchor != null) {
      parts.push(
        `- Lesson: \`${anchor.lessonId}\``,
        `- Block: \`${anchor.blockId}\` (${describeAnchor(anchor)})`,
        '',
      );
      if (anchor.lineTexts.length > 0) {
        parts.push('The line(s) in full, as the card holds them:', '');
        anchor.lineTexts.forEach((text, offset) => {
          parts.push(`${anchor.fromLine + offset}. ${text}`);
        });
        parts.push('');
      }
      parts.push('The selected part of them:', '');
    }
    parts.push(`> ${chunk.text.replace(/\n+/g, '\n> ')}`, '');
    if (chunk.note.trim().length > 0) {
      parts.push(`Requested change: ${chunk.note.trim()}`, '');
    }
  });

  if (overallNote.trim().length > 0) {
    parts.push('## Overall instructions', '', overallNote.trim(), '');
  }

  return parts.join('\n');
};

// navigator.clipboard is unavailable outside a secure context, so a textarea
// fallback keeps Copy working when the panel is served over plain http.
export const copyText = async (text: string): Promise<boolean> => {
  if (navigator.clipboard?.writeText != null) {
    try {
      await navigator.clipboard.writeText(text);
      return true;
    } catch {
      // fall through
    }
  }
  try {
    const area = document.createElement('textarea');
    area.value = text;
    area.style.position = 'fixed';
    area.style.opacity = '0';
    document.body.appendChild(area);
    area.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(area);
    return ok;
  } catch {
    return false;
  }
};
