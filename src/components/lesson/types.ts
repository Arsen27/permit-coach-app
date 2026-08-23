import { IconName } from '@/assets/icons';

// Shared by the lesson player and the admin preview. Kept free of storage and
// navigation imports so both runtimes can pull the card renderer in on its own.

export type LessonAnswer = {
  selectedId: string;
  checked: boolean;
};

export type Tone = 'accent' | 'muted' | 'trap' | 'california';

export type CardMeta = { label: string; icon: IconName; tone: Tone };

export type OptionState = 'idle' | 'selected' | 'correct' | 'wrong' | 'dimmed';
