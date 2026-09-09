import React from 'react';
import styled from 'styled-components';

import type { CourseAssetV2, LessonDocV2 } from '@/data/course/v2/wire';
import { assetSrc } from '@admin/model/svg';
import { useEdit } from '@admin/store/editStore';
import { admin } from '@admin/styles/theme';

import { BodyArea, FieldLabel, SmallButton, SmallInput } from './fields';

// The lesson screen — what a learner reads before the first slide: the
// summary, the key points, the minutes, and the opening illustration. It was
// the one surface of a lesson the editor could not touch, and its hero was
// derived (the first picture a slide shows), so adding artwork to an early
// slide silently changed the lesson's face.

type Props = {
  doc: LessonDocV2;
  assets: Map<string, CourseAssetV2>;
  onPickHero: () => void;
};

// The same fallbacks the app derives when nothing is authored, shown so the
// author edits what the learner already sees rather than a blank.
const effectiveIntro = (doc: LessonDocV2) =>
  doc.lesson.intro ?? {
    summary: doc.lesson.objective,
    keyPoints: [
      'Learn the rule behind the most common exam scenarios.',
      'See the trap that makes a plausible answer wrong.',
      'Check your understanding with a short test.',
    ],
    theoryMinutes: Math.max(
      4,
      Number.parseInt(doc.lesson.estimatedMinutes, 10) || 6,
    ),
    testMinutes: Math.max(2, Math.ceil(doc.lesson.questionIds.length / 2)),
  };

// The derived hero: reading order over the blocks, as the app falls back.
const derivedHero = (doc: LessonDocV2): CourseAssetV2 | undefined => {
  for (const block of doc.lesson.blocks) {
    const withAsset = block as { assetId?: string };
    if (withAsset.assetId != null) {
      const asset = doc.assets.find(a => a.assetId === withAsset.assetId);
      if (asset != null) {
        return asset;
      }
    }
    const elements = (
      block as { content?: { kind: string; assetId?: string }[] }
    ).content;
    for (const element of elements ?? []) {
      if (element.kind === 'image' && element.assetId != null) {
        const asset = doc.assets.find(a => a.assetId === element.assetId);
        if (asset != null) {
          return asset;
        }
      }
    }
  }
  return undefined;
};

const LessonScreenEditor: React.FC<Props> = ({ doc, assets, onPickHero }) => {
  const editIntro = useEdit(state => state.editIntro);
  const setHeroAsset = useEdit(state => state.setHeroAsset);
  const setAssetAlt = useEdit(state => state.setAssetAlt);

  const intro = effectiveIntro(doc);
  const authored =
    doc.lesson.heroAssetId != null
      ? assets.get(doc.lesson.heroAssetId)
      : undefined;
  const hero = authored ?? derivedHero(doc);

  return (
    <Wrap data-lesson-screen>
      <HeadRow>
        <Kicker>LESSON SCREEN</Kicker>
        <Hint>What the learner reads before the first slide</Hint>
      </HeadRow>

      <HeroRow>
        <HeroBox>
          {hero == null ? (
            <HeroEmpty>no picture — the screen opens on the title</HeroEmpty>
          ) : (
            <HeroImage src={assetSrc(hero)} alt={hero.alt} />
          )}
        </HeroBox>
        <HeroSide>
          <FieldLabel>OPENING ILLUSTRATION</FieldLabel>
          <HeroNote>
            {authored != null
              ? 'Pinned to this picture, wherever the slides move.'
              : 'Follows the first picture a slide shows — adding artwork to an early slide changes it. Pin one to stop that.'}
          </HeroNote>
          {authored != null && (
            <SmallInput
              value={authored.alt}
              placeholder="Describe the illustration"
              onChange={event =>
                setAssetAlt(authored.assetId, event.target.value)
              }
            />
          )}
          <HeroActions>
            <SmallButton
              title="Upload a picture and pin it as this lesson's hero"
              onClick={onPickHero}
            >
              {authored != null ? 'Replace picture' : 'Pin a picture'}
            </SmallButton>
            {authored != null && (
              <SmallButton
                title="Back to following the first slide's picture"
                onClick={() => setHeroAsset(null)}
              >
                Unpin
              </SmallButton>
            )}
          </HeroActions>
        </HeroSide>
      </HeroRow>

      <Field>
        <FieldLabel>SUMMARY</FieldLabel>
        <BodyArea
          value={intro.summary}
          rows={2}
          placeholder="One paragraph on what this lesson teaches"
          onChange={event => editIntro({ summary: event.target.value })}
        />
      </Field>

      <Field>
        <FieldLabel>KEY POINTS</FieldLabel>
        {intro.keyPoints.map((point, index) => (
          <PointRow key={index}>
            <SmallInput
              value={point}
              placeholder="One thing the learner walks away with"
              onChange={event =>
                editIntro({
                  keyPoints: intro.keyPoints.map((existing, at) =>
                    at === index ? event.target.value : existing,
                  ),
                })
              }
            />
            <SmallButton
              title="Remove this point"
              disabled={intro.keyPoints.length <= 1}
              onClick={() =>
                editIntro({
                  keyPoints: intro.keyPoints.filter((_, at) => at !== index),
                })
              }
            >
              ✕
            </SmallButton>
          </PointRow>
        ))}
        {intro.keyPoints.length < 5 && (
          <SmallButton
            title="Add a key point"
            onClick={() => editIntro({ keyPoints: [...intro.keyPoints, ''] })}
          >
            + Add point
          </SmallButton>
        )}
      </Field>

      <MinutesRow>
        <Field>
          <FieldLabel>THEORY · MIN</FieldLabel>
          <SmallInput
            value={String(intro.theoryMinutes)}
            onChange={event => {
              const minutes = Number.parseInt(event.target.value, 10);
              if (Number.isFinite(minutes) && minutes > 0) {
                editIntro({ theoryMinutes: minutes });
              }
            }}
          />
        </Field>
        <Field>
          <FieldLabel>TEST · MIN</FieldLabel>
          <SmallInput
            value={String(intro.testMinutes)}
            onChange={event => {
              const minutes = Number.parseInt(event.target.value, 10);
              if (Number.isFinite(minutes) && minutes > 0) {
                editIntro({ testMinutes: minutes });
              }
            }}
          />
        </Field>
      </MinutesRow>
    </Wrap>
  );
};

export default LessonScreenEditor;

const Wrap = styled.div`
  display: flex;
  flex-direction: column;
  gap: 14px;
  padding: 16px 18px;
  margin-bottom: 22px;
  border: 1px solid ${admin.line2};
  border-radius: 16px;
  background: ${admin.surface};
`;

const HeadRow = styled.div`
  display: flex;
  align-items: baseline;
  gap: 10px;
`;

const Kicker = styled.span`
  font: 700 10.5px ${admin.mono};
  letter-spacing: 1.1px;
  color: ${admin.dim};
`;

const Hint = styled.span`
  font-size: 11.5px;
  font-weight: 500;
  color: ${admin.dim2};
`;

const HeroRow = styled.div`
  display: flex;
  gap: 14px;
`;

const HeroBox = styled.div`
  flex: none;
  width: 210px;
  aspect-ratio: 16 / 9;
  border-radius: 10px;
  overflow: hidden;
  background: ${admin.hair};
  display: flex;
  align-items: center;
  justify-content: center;
`;

const HeroImage = styled.img`
  width: 100%;
  height: 100%;
  object-fit: cover;
`;

const HeroEmpty = styled.span`
  padding: 0 14px;
  font-size: 11px;
  font-weight: 500;
  text-align: center;
  color: ${admin.dim2};
`;

const HeroSide = styled.div`
  flex: 1;
  min-width: 0;
  display: flex;
  flex-direction: column;
  gap: 7px;
`;

const HeroNote = styled.p`
  margin: 0;
  font-size: 11.5px;
  line-height: 1.5;
  font-weight: 500;
  color: ${admin.dim};
  text-wrap: pretty;
`;

const HeroActions = styled.div`
  display: flex;
  gap: 8px;
`;

const Field = styled.div`
  display: flex;
  flex-direction: column;
  gap: 5px;
  align-items: flex-start;

  & > textarea,
  & > input {
    align-self: stretch;
  }
`;

const PointRow = styled.div`
  display: flex;
  gap: 8px;
  align-self: stretch;

  & > input {
    flex: 1;
  }
`;

const MinutesRow = styled.div`
  display: flex;
  gap: 18px;

  & > div {
    width: 110px;
  }
`;
