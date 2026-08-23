import { questionDiagram, questionDiagrams } from '@/assets/questionDiagrams';
import practiceBank from '@/data/practiceQuestions.json';
import { currentUnit } from '@/data/curriculum';

// The course packages ship an illustration per question; these diagrams cover
// the hand-authored banks, which shipped with none.

const authoredIds = [
  ...currentUnit.lessons[0].questions.map(question => question.id),
  ...Object.values(practiceBank as Record<string, { id: string }[]>).flatMap(
    questions => questions.map(question => question.id),
  ),
];

describe('question diagrams', () => {
  it('covers every right-of-way and parking question', () => {
    const rightOfWay = authoredIds.filter(id => id.startsWith('row-'));
    const parking = authoredIds.filter(id => id.startsWith('ps-'));
    expect(rightOfWay.length).toBeGreaterThan(0);
    for (const id of [...rightOfWay, ...parking]) {
      expect(questionDiagram(id)).toBeDefined();
    }
  });

  it('covers every speed-and-lane question', () => {
    for (const id of authoredIds.filter(entry => entry.startsWith('sl-'))) {
      expect(questionDiagram(id)).toBeDefined();
    }
  });

  it('leaves purely numeric or legal answers without decoration', () => {
    // Only the open-container question is spatial; BAC limits, record
    // retention and points are not made clearer by a picture.
    const alcohol = authoredIds.filter(id => id.startsWith('ap-'));
    const drawn = alcohol.filter(id => questionDiagram(id) != null);
    expect(drawn).toEqual(['ap-6']);
  });

  it('only draws questions that actually exist', () => {
    for (const id of Object.keys(questionDiagrams)) {
      expect(authoredIds).toContain(id);
    }
  });

  it('emits self-contained, safe SVG with alt text', () => {
    for (const [id, diagram] of Object.entries(questionDiagrams)) {
      expect(diagram.xml.startsWith('<svg')).toBe(true);
      expect(diagram.xml.trimEnd().endsWith('</svg>')).toBe(true);
      // Same rules the course asset pipeline enforces: nothing executable,
      // nothing fetched from the network.
      expect(diagram.xml).not.toMatch(
        /<script|foreignObject|https?:\/\/(?!www\.w3\.org)/,
      );
      expect(diagram.xml).toContain('viewBox="0 0 1200 675"');
      expect(diagram.alt.length).toBeGreaterThan(20);
      expect(id).toMatch(/^[a-z]+-\d+$/);
    }
  });

  it('keeps every drawn element inside the canvas', () => {
    // A shape placed off-canvas silently disappears; catching it here beats
    // finding it in a screenshot.
    for (const diagram of Object.values(questionDiagrams)) {
      const xs = [...diagram.xml.matchAll(/\sx="(-?[\d.]+)"/g)].map(m =>
        Number(m[1]),
      );
      const ys = [...diagram.xml.matchAll(/\sy="(-?[\d.]+)"/g)].map(m =>
        Number(m[1]),
      );
      expect(Math.min(...xs)).toBeGreaterThanOrEqual(-60);
      expect(Math.max(...xs)).toBeLessThanOrEqual(1260);
      expect(Math.min(...ys)).toBeGreaterThanOrEqual(-60);
      expect(Math.max(...ys)).toBeLessThanOrEqual(720);
    }
  });
});
