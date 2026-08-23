import { Platform } from 'react-native';

// Liquid Glass token set (see design_handoff_dmv_prep_glass/tokens.css). The
// accent and the font family are user-selectable in Settings; everything else
// is fixed. Build a concrete theme with `makeTheme(accentId, fontId)`.

// Emerald is the brand accent and, for this release, the only one: the
// picker was removed from Settings. The list stays a list (and setAccent
// stays on AppState) so re-introducing alternatives is a data change.
export type AccentId = 'emerald';

export const ACCENT_OPTIONS: { id: AccentId; hex: string }[] = [
  { id: 'emerald', hex: '#059669' },
];

export const DEFAULT_ACCENT_ID: AccentId = ACCENT_OPTIONS[0].id;

// Accent ids are persisted locally and on the server profile, so a build that
// drops one still has to read old rows: anything unrecognised falls back to
// the default instead of leaving the picker with nothing selected.
export const normalizeAccentId = (value: string): AccentId =>
  ACCENT_OPTIONS.some(option => option.id === value)
    ? (value as AccentId)
    : DEFAULT_ACCENT_ID;

export type FontWeightKey =
  | 'regular'
  | 'medium'
  | 'semiBold'
  | 'bold'
  | 'extraBold'
  | 'black';

export type FontId =
  | 'jakarta'
  | 'system'
  | 'inter'
  | 'openSans'
  | 'lato'
  | 'notoSans'
  | 'dmSans'
  | 'rubik'
  | 'workSans';

type FontFiles = Record<FontWeightKey, string> | null;

// PostScript names of the bundled TTFs (assets/fonts). `files: null` is the
// platform system font (SF Pro on iOS, Roboto on Android) — weight comes from
// font-weight instead of a per-weight family.
const familyFiles = (base: string): FontFiles => ({
  regular: `${base}-Regular`,
  medium: `${base}-Medium`,
  semiBold: `${base}-SemiBold`,
  bold: `${base}-Bold`,
  extraBold: `${base}-ExtraBold`,
  black: `${base}-ExtraBold`,
});

export const FONT_OPTIONS: { id: FontId; label: string; files: FontFiles }[] = [
  {
    id: 'jakarta',
    label: 'Plus Jakarta Sans',
    files: familyFiles('PlusJakartaSans'),
  },
  {
    id: 'system',
    label: Platform.OS === 'ios' ? 'System (SF Pro)' : 'System default',
    files: null,
  },
  { id: 'inter', label: 'Inter', files: familyFiles('Inter') },
  { id: 'openSans', label: 'Open Sans', files: familyFiles('OpenSans') },
  {
    id: 'lato',
    label: 'Lato',
    // Lato ships 400/700/900 only — nearest-weight mapping.
    files: {
      regular: 'Lato-Regular',
      medium: 'Lato-Regular',
      semiBold: 'Lato-Bold',
      bold: 'Lato-Bold',
      extraBold: 'Lato-Black',
      black: 'Lato-Black',
    },
  },
  { id: 'notoSans', label: 'Noto Sans', files: familyFiles('NotoSans') },
  { id: 'dmSans', label: 'DM Sans', files: familyFiles('DMSans') },
  { id: 'rubik', label: 'Rubik', files: familyFiles('Rubik') },
  { id: 'workSans', label: 'Work Sans', files: familyFiles('WorkSans') },
];

const WEIGHT_VALUES: Record<FontWeightKey, number> = {
  regular: 400,
  medium: 500,
  semiBold: 600,
  bold: 700,
  extraBold: 800,
  black: 900,
};

// Each entry is a ready CSS declaration so styled templates can interpolate
// `${({ theme }) => theme.fonts.bold}` whichever way the weight is expressed
// (bundled family vs system font-weight).
const makeFonts = (files: FontFiles): Record<FontWeightKey, string> => {
  const entries = (Object.keys(WEIGHT_VALUES) as FontWeightKey[]).map(key => [
    key,
    files != null
      ? `font-family: ${files[key]};`
      : `font-weight: ${WEIGHT_VALUES[key]};`,
  ]);
  return Object.fromEntries(entries);
};

const hexToRgb = (hex: string): [number, number, number] => [
  parseInt(hex.slice(1, 3), 16),
  parseInt(hex.slice(3, 5), 16),
  parseInt(hex.slice(5, 7), 16),
];

export const rgba = (hex: string, alpha: number): string => {
  const [r, g, b] = hexToRgb(hex);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
};

const hexHue = (hex: string): number => {
  const [r, g, b] = hexToRgb(hex).map(v => v / 255);
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  const d = max - min;
  if (d === 0) {
    return 0;
  }
  let h;
  if (max === r) {
    h = ((g - b) / d) % 6;
  } else if (max === g) {
    h = (b - r) / d + 2;
  } else {
    h = (r - g) / d + 4;
  }
  return (h * 60 + 360) % 360;
};

const makeColors = (accent: string) => {
  // Handoff rule: a green accent (hue 80–180°) takes over the done tokens so
  // the screen holds a single green family.
  const hue = hexHue(accent);
  const accentIsGreen = hue >= 80 && hue <= 180;
  const done = accentIsGreen ? accent : '#22C55E';

  return {
    accent,
    accentSoft: rgba(accent, 0.08),

    bg: '#FFFFFF',
    ink: '#18181B',
    line: '#E4E4E7',
    faint: '#F2F2F3',
    surface: '#F6F6F7',
    body: '#38383B',
    strong: '#4B4B4D',
    muted: '#707072',
    dim: '#979798',
    dim2: '#C5C5C6',

    done,
    doneText: accentIsGreen ? accent : '#1CA24D',
    doneSoft: rgba(done, 0.14),
    doneLine: rgba(done, 0.45),
    warning: '#F59E0B',
    error: '#EF4444',

    // Answer feedback is deliberately NOT themed: correct and incorrect must
    // read identically whatever accent the user picked, and each always pairs
    // its colour with an icon and a word (lesson-card handoff).
    correct: '#16A34A',
    correctText: '#15803D',
    correctSoft: 'rgba(34, 197, 94, 0.07)',
    wrong: '#DC2626',
    wrongLine: '#EF4444',
    wrongText: '#B91C1C',
    wrongSoft: 'rgba(239, 68, 68, 0.06)',
    // Card-type signals: exam traps are amber, California-specific content
    // carries the handbook's own green.
    trap: '#D97706',
    california: '#00693C',
    // Check-yourself recall card: the deck's one full-colour card (lesson-card
    // handoff screens 17/24). Fixed deep green — like correct/wrong it must
    // read the same whatever accent the user picked.
    recall: '#00734A',
  };
};

// Sign colours (MUTCD) are fixed — they must read as real-world signage and
// are never themed.
export const signColors = {
  regulatory: '#C8102E',
  warning: '#FFB915',
  guide: '#003F87',
  highway: '#00693C',
  workzone: '#E67817',
  school: '#C9D64F',
  ink: '#1A1A1C',
} as const;

// Liquid Glass surface values from Apple's iOS 26 kit. The blur itself comes
// from the native glass material (or stays flat on the Android analog).
export const glass = {
  fill: 'rgba(255, 255, 255, 0.68)',
  fallbackFill: 'rgba(255, 255, 255, 0.94)',
  selection: 'rgb(237, 237, 237)',
  tabInactive: '#54545A',
  highlight: 'rgba(255, 255, 255, 0.7)',
} as const;

// Glass shadow recipes from the iOS 26 kit (RN 0.76+ boxShadow, inset
// supported). Applied to wrapper Views so the glass surface itself stays
// shadow-free.
export const shadows = {
  glass: { boxShadow: '0 8px 40px rgba(0, 0, 0, 0.12)' },
  cta: {
    boxShadow:
      '0 8px 40px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
  },
  chip: {
    boxShadow:
      '0 8px 24px rgba(0, 0, 0, 0.16), inset 0 1px 0 rgba(255, 255, 255, 0.4)',
  },
  chipOnAccent: {
    boxShadow:
      '0 8px 24px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.9)',
  },
  recallCard: {
    boxShadow:
      '0 14px 40px rgba(0, 0, 0, 0.18), inset 0 1px 0 rgba(255, 255, 255, 0.18)',
  },
} as const;

export const makeTheme = (accentId: AccentId, fontId: FontId) => {
  const accent =
    ACCENT_OPTIONS.find(option => option.id === accentId) ?? ACCENT_OPTIONS[0];
  const font =
    FONT_OPTIONS.find(option => option.id === fontId) ?? FONT_OPTIONS[0];

  return {
    accentId: accent.id,
    fontId: font.id,
    colors: makeColors(accent.hex),
    signs: signColors,
    glass,
    fonts: makeFonts(font.files),
  };
};

export type AppTheme = ReturnType<typeof makeTheme>;

export const defaultTheme = makeTheme(DEFAULT_ACCENT_ID, 'jakarta');
