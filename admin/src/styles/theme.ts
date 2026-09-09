// Admin chrome tokens, taken from the design mockup. The phone simulator does
// not use these — it renders under the app's own theme.

export const admin = {
  bg: '#F4F4F5',
  surface: '#FFFFFF',
  rail: '#0F1116',
  railText: '#6E717B',
  ink: '#18181B',
  body: '#3F3F46',
  strong: '#27272A',
  muted: '#52525B',
  dim: '#71717A',
  dim2: '#A1A1AA',
  faint: '#B9B9BE',
  ghost: '#C4C4C8',
  line: '#E4E4E7',
  line2: '#E9E9EB',
  line3: '#E7E7EA',
  hair: '#F1F1F3',
  soft: '#FAFAFA',
  soft2: '#F6F6F7',
  accent: '#0485F7',
  accentSoft: 'rgba(4,133,247,.09)',
  status: {
    draft: {
      chip: 'Draft',
      col: '#B45309',
      bg: 'rgba(217,119,6,.13)',
      dot: '#F59E0B',
    },
    released: {
      chip: 'Released',
      col: '#15803D',
      bg: 'rgba(22,163,74,.12)',
      dot: '#22C55E',
    },
    competitor: {
      chip: 'Competitor',
      col: '#6D28D9',
      bg: 'rgba(124,58,237,.12)',
      dot: '#8B5CF6',
    },
  },
  diff: {
    insBg: 'rgba(34,197,94,.2)',
    insText: '#14532D',
    delBg: 'rgba(239,68,68,.15)',
    delText: '#991B1B',
    addedBorder: 'rgba(34,197,94,.55)',
    removedBorder: 'rgba(239,68,68,.45)',
  },
  mono: "'JetBrains Mono', ui-monospace, monospace",
  sans: 'Inter, system-ui, sans-serif',
} as const;

export type AdminTokens = typeof admin;
