// Parses the competitor course corpus (courses/competitors/<App>/course) into
// the normalised form the admin serves. Both apps were captured with the same
// hand-rolled markdown conventions, so one parser covers them; the shapes that
// predate that convention are handled explicitly rather than silently skipped.

export type CompetitorImage = {
  src: string;
  alt: string;
  caption?: string;
  description?: string;
};

export type CompetitorSection = {
  heading?: string;
  level: 2 | 3;
  paragraphs: string[];
  images: CompetitorImage[];
  bullets: string[];
  // myDMV marks these inline rather than in separate per-state files.
  stateNotes: string[];
  takeaways: string[];
  californiaSpecific: boolean;
};

export type CompetitorQuestion = {
  number: number;
  prompt: string;
  image?: CompetitorImage;
  options: { letter: string; text: string }[];
  correctLetter: string | null;
  correctText: string | null;
};

export type CompetitorTest = { questions: CompetitorQuestion[] };

export type CompetitorLesson = {
  lessonId: string;
  title: string;
  sequence: number;
  sections: CompetitorSection[];
  test?: CompetitorTest;
};

export type CompetitorModule = {
  moduleId: string;
  title: string;
  sequence: number;
  lessons: CompetitorLesson[];
  moduleTest?: CompetitorTest;
};

export type CompetitorCourse = {
  id: string;
  name: string;
  format: 'article' | 'slides';
  modules: CompetitorModule[];
  warnings: string[];
};

const IMAGE = /^!\[([^\]]*)\]\(([^)]+)\)$/;
const CAPTION = /^\*\*Text below the image:\*\*\s*(.+)$/;
const DESCRIPTION = /^\*\*Description:\*\*\s*(.+)$/;
const QUESTION_HEAD = /^#{2,3}\s+Question\s+(\d+)\s*$/;
const QUESTION_STEM = /^\*\*Question:\*\*\s*(.+)$/;
const OPTION = /^-\s+([A-E])\.\s+(.+)$/;
const UNREADABLE_OPTION = /^-\s+\[unclear\]\s*$/;
const CORRECT = /^\*\*Correct answer:\s*(.+?)\.?\*\*$/;
const TAKEAWAY = /^👍\s*\*{0,2}(.+?)\*{0,2}$/;
const CA_MARKER = /^📍\s*\*California-specific\*$/;
const BULLET = /^-\s+(.+)$/;

const stripEmphasis = (value: string): string =>
  value.replace(/\*\*/g, '').trim();

// Titles are "# Lesson 4 — Right of way II" (em dash).
export const parseTitleLine = (
  line: string,
): { kind: 'lesson' | 'module'; number: number; title: string } | null => {
  const match = /^#\s+(Lesson|Module)\s+(\d+)\s+—\s+(.+?)\s*$/.exec(line);
  if (match == null) {
    return null;
  }
  return {
    kind: match[1].toLowerCase() as 'lesson' | 'module',
    number: Number(match[2]),
    title: match[3],
  };
};

const emptySection = (
  heading: string | undefined,
  level: 2 | 3,
): CompetitorSection => ({
  heading,
  level,
  paragraphs: [],
  images: [],
  bullets: [],
  stateNotes: [],
  takeaways: [],
  californiaSpecific: false,
});

export const parseLessonBody = (
  markdown: string,
): { title: string; sections: CompetitorSection[]; warnings: string[] } => {
  const warnings: string[] = [];
  const lines = markdown.split('\n');

  let title = '';
  const sections: CompetitorSection[] = [];
  let current = emptySection(undefined, 2);
  let sawTitle = false;
  // The oldest capture keeps its questions in the lesson file; everything from
  // "## Test Questions" onwards belongs to the test parser, not here.
  let stopped = false;

  const flush = () => {
    if (
      current.paragraphs.length > 0 ||
      current.images.length > 0 ||
      current.bullets.length > 0 ||
      current.heading != null
    ) {
      sections.push(current);
    }
  };

  for (let index = 0; index < lines.length && !stopped; index++) {
    const line = lines[index].trim();
    if (line.length === 0) {
      continue;
    }

    const heading1 = /^#\s+(.+)$/.exec(line);
    if (heading1 != null) {
      const parsed = parseTitleLine(line);
      if (!sawTitle) {
        title = parsed?.title ?? heading1[1];
        sawTitle = true;
      } else {
        // The legacy single-file layout repeats the plain title as a second H1.
        warnings.push(`second H1 treated as a section: ${heading1[1]}`);
        flush();
        current = emptySection(heading1[1], 2);
      }
      continue;
    }

    const heading = /^(#{2,3})\s+(.+)$/.exec(line);
    if (heading != null) {
      const text = heading[2];
      if (/^Test Questions/i.test(text) || /^Short Answer Key/i.test(text)) {
        stopped = true;
        break;
      }
      if (
        /^Screenshot Order$/i.test(text) ||
        /^Lesson$/i.test(text) ||
        /^Test$/i.test(text)
      ) {
        // Capture bookkeeping, not lesson content.
        continue;
      }
      if (/^Lesson Text$/i.test(text)) {
        continue;
      }
      flush();
      current = emptySection(text, heading[1].length === 3 ? 3 : 2);
      if (/^State notes/i.test(text)) {
        current.stateNotes.push('');
      }
      continue;
    }

    const image = IMAGE.exec(line);
    if (image != null) {
      current.images.push({ alt: image[1], src: image[2] });
      continue;
    }

    const caption = CAPTION.exec(line);
    if (caption != null && current.images.length > 0) {
      current.images[current.images.length - 1].caption = caption[1];
      continue;
    }

    const description = DESCRIPTION.exec(line);
    if (description != null && current.images.length > 0) {
      current.images[current.images.length - 1].description = description[1];
      continue;
    }

    if (CA_MARKER.test(line)) {
      current.californiaSpecific = true;
      continue;
    }

    if (line.startsWith('👍')) {
      const takeaway = TAKEAWAY.exec(line);
      current.takeaways.push(stripEmphasis(takeaway?.[1] ?? line.slice(1)));
      continue;
    }

    if (/^\*\*State notes:\*\*/.test(line)) {
      current.stateNotes.push(
        stripEmphasis(line.replace(/^\*\*State notes:\*\*/, '')),
      );
      continue;
    }

    if (line.startsWith('>')) {
      // Extraction notes from the older template.
      continue;
    }

    const bullet = BULLET.exec(line);
    if (bullet != null) {
      current.bullets.push(stripEmphasis(bullet[1]));
      continue;
    }

    if (current.heading != null && /^State notes/i.test(current.heading)) {
      current.stateNotes.push(line);
      continue;
    }

    current.paragraphs.push(line);
  }

  flush();
  // The placeholder pushed when a "State notes" heading opened.
  sections.forEach(section => {
    section.stateNotes = section.stateNotes.filter(note => note.length > 0);
  });

  return { title, sections, warnings };
};

export const parseTest = (
  markdown: string,
): { test: CompetitorTest; warnings: string[] } => {
  const warnings: string[] = [];
  const questions: CompetitorQuestion[] = [];
  const lines = markdown.split('\n');

  let current: CompetitorQuestion | null = null;
  let pendingImage: CompetitorImage | null = null;

  const commit = () => {
    if (current != null) {
      questions.push(current);
    }
    current = null;
    pendingImage = null;
  };

  for (const raw of lines) {
    const line = raw.trim();
    if (line.length === 0) {
      continue;
    }

    if (/^##\s+Short Answer Key/i.test(line)) {
      break;
    }

    const head = QUESTION_HEAD.exec(line);
    if (head != null) {
      commit();
      current = {
        number: Number(head[1]),
        prompt: '',
        options: [],
        correctLetter: null,
        correctText: null,
      };
      continue;
    }

    if (current == null) {
      continue;
    }

    const image = IMAGE.exec(line);
    if (image != null) {
      pendingImage = { alt: image[1], src: image[2] };
      current.image = pendingImage;
      continue;
    }

    const description = DESCRIPTION.exec(line);
    if (description != null && pendingImage != null) {
      pendingImage.description = description[1];
      continue;
    }

    const stem = QUESTION_STEM.exec(line);
    if (stem != null) {
      current.prompt = stem[1];
      continue;
    }

    if (UNREADABLE_OPTION.test(line)) {
      // Kept so the option count still matches the screenshot.
      current.options.push({ letter: '?', text: '[unclear]' });
      continue;
    }

    const option = OPTION.exec(line);
    if (option != null) {
      current.options.push({ letter: option[1], text: option[2] });
      continue;
    }

    const correct = CORRECT.exec(line);
    if (correct != null) {
      const answer = correct[1];
      const lettered = /^([A-E])\.\s*(.+)$/.exec(answer);
      if (lettered != null) {
        current.correctLetter = lettered[1];
        current.correctText = lettered[2];
      } else {
        // "None of the displayed options", "Not confirmed from the screenshots".
        current.correctLetter = null;
        current.correctText = answer;
        warnings.push(`question ${current.number}: answer without a letter`);
      }
      continue;
    }
  }

  commit();
  return { test: { questions }, warnings };
};
