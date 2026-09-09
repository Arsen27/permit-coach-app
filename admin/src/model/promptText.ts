import type { PromptChunk } from '@admin/store/promptStore';

// One markdown request out of every excerpt the operator collected. The shape
// is fixed so a model receives the same structure every time: where each quote
// came from, what should change about it, then the overall instruction.

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

  chunks.forEach((chunk, index) => {
    parts.push(`## Excerpt ${index + 1} — ${chunk.source}`, '');
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
