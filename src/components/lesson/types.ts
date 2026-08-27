import { IconName } from '@/assets/icons';

// Shared by the lesson player and the admin preview. Kept free of storage and
// navigation imports so both runtimes can pull the card renderer in on its own.

export type LessonAnswer = {
  selectedId: string;
  checked: boolean;
};

export type Tone = 'accent' | 'muted' | 'trap' | 'california';

// `tone` names a palette slot; an authored slide type may override either
// colour outright, which is why both are optional rather than a second tone.
export type CardMeta = {
  label: string;
  icon: IconName;
  // Set when the course ships its own glyph for this slide type.
  iconSvg?: string;
  tone: Tone;
  textColor?: string;
  iconColor?: string;
};

export type OptionState = 'idle' | 'selected' | 'correct' | 'wrong' | 'dimmed';
