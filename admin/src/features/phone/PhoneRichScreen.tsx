import React from 'react';
import styled from 'styled-components';

import DiffRuns from '@admin/features/viewer/DiffRuns';
import type { CompareRow } from '@admin/model/compare';
import type { LessonCards, RenderCard } from '@admin/model/renderCard';
import { isBulletsElement } from '@/data/course/v2/wire';
import { BULLET_PREFIX } from '@admin/model/renderCard';
import { useEdit } from '@admin/store/editStore';

import WebPhoneCard, { type WebPhoneSlots } from './WebPhoneCard';

// The phone screen for the two modes the RN renderer cannot draw: word-level
// diff marks, and in-place text editing. Chrome (header, progress, Continue)
// mirrors the app player; the card body is web markup.

type Props = {
  rendered: LessonCards;
  index: number;
  // Diff mode: this pane's side of the compare rows.
  row?: CompareRow | null;
  side?: 'before' | 'after';
  // Edit mode: commits go straight to the edit store.
  editable?: boolean;
  onAdvance?: () => void;
};

const slotsFor = (
  row: CompareRow,
  side: 'before' | 'after',
  card: RenderCard,
): WebPhoneSlots | undefined => {
  if (row.diff == null) {
    return undefined;
  }
  const { diff } = row;
  return {
    title: <DiffRuns runs={diff.title} side={side} />,
    ask:
      diff.ask == null ? undefined : <DiffRuns runs={diff.ask} side={side} />,
    bodies: card.bodies.map((_, index) => (
      <DiffRuns key={index} runs={diff.bodies[index] ?? []} side={side} />
    )),
    options: (card.options ?? []).map((_, index) => (
      <DiffRuns key={index} runs={diff.options[index] ?? []} side={side} />
    )),
    imageAlt:
      diff.imageAlt == null ? undefined : (
        <DiffRuns runs={diff.imageAlt} side={side} />
      ),
  };
};

const PhoneRichScreen: React.FC<Props> = ({
  rendered,
  index,
  row = null,
  side = 'after',
  editable = false,
  onAdvance,
}) => {
  const editBlock = useEdit(state => state.editBlock);
  const editElement = useEdit(state => state.editElement);
  const editQuestion = useEdit(state => state.editQuestion);

  const total = Math.max(1, rendered.cards.length);
  const bounded = Math.min(index, total - 1);
  const card =
    row != null
      ? side === 'after'
        ? row.left
        : row.right
      : rendered.cards[bounded];

  const editHandlers =
    !editable || card == null
      ? null
      : {
          onTitle: (text: string) => {
            if (card.type === 'checkpoint' && card.refs.questionId != null) {
              editQuestion(card.refs.questionId, { prompt: text });
            } else if (card.refs.blockId != null) {
              editBlock(card.refs.blockId, { title: text } as never);
            }
          },
          onBody: (bodyIndex: number, text: string) => {
            const blockId = card.refs.blockId;
            if (blockId == null) {
              return;
            }
            // A quick challenge's body is its scenario, and a check-yourself
            // card's two lines are its label and its rule. Everything else is
            // an element list, so the edit goes back to the exact element the
            // line was flattened out of rather than to the markdown mirror.
            if (card.type === 'quick_challenge') {
              const next = card.bodies.map((existing, i) =>
                i === bodyIndex ? text : existing,
              );
              editBlock(blockId, { scenario: next.join('\n\n') } as never);
              return;
            }
            if (card.type === 'check_yourself') {
              editBlock(
                blockId,
                (bodyIndex === 0
                  ? { context: text }
                  : { ruleMarkdown: text }) as never,
              );
              return;
            }
            const ref = card.bodyRefs?.[bodyIndex];
            const element =
              ref == null ? undefined : card.elements?.[ref.elementIndex];
            if (ref == null || element == null) {
              return;
            }
            if (ref.itemIndex == null) {
              editElement(blockId, ref.elementIndex, {
                kind: 'paragraph',
                text,
              });
              return;
            }
            if (!isBulletsElement(element)) {
              return;
            }
            const items = [...element.items];
            items[ref.itemIndex] = text.startsWith(BULLET_PREFIX)
              ? text.slice(BULLET_PREFIX.length)
              : text;
            editElement(blockId, ref.elementIndex, { kind: 'bullets', items });
          },
          onAsk: (text: string) => {
            if (card.refs.questionId != null) {
              editQuestion(card.refs.questionId, { prompt: text });
            }
          },
        };

  return (
    <Screen>
      <Header>
        <Circle>‹</Circle>
        <Progress>
          <Meta>
            <MetaTitle>{rendered.title}</MetaTitle>
            <MetaCount>
              {bounded + 1} / {total}
            </MetaCount>
          </Meta>
          <Track>
            <TrackFill style={{ width: `${((bounded + 1) / total) * 100}%` }} />
          </Track>
        </Progress>
        <Circle>✕</Circle>
      </Header>

      <Body>
        {card == null ? (
          <Missing>Not in this version</Missing>
        ) : (
          <WebPhoneCard
            card={card}
            slots={row == null ? undefined : slotsFor(row, side, card)}
            editable={editHandlers}
            badge={
              row == null
                ? null
                : side === 'after' && row.added
                ? 'added'
                : side === 'before' && row.removed
                ? 'removed'
                : null
            }
          />
        )}
        <BodyPad />
      </Body>

      <Footer>
        <Continue onClick={onAdvance}>Continue</Continue>
      </Footer>
    </Screen>
  );
};

export default PhoneRichScreen;

const Screen = styled.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  font-family: 'PlusJakartaSans-Medium', 'Plus Jakarta Sans', system-ui,
    sans-serif;
`;

const Header = styled.div`
  flex: none;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 62px 20px 0;
`;

const Circle = styled.div`
  flex: none;
  width: 40px;
  height: 40px;
  border-radius: 99px;
  background: #f6f6f7;
  display: flex;
  align-items: center;
  justify-content: center;
  font-size: 17px;
  color: #52525b;
`;

const Progress = styled.div`
  flex: 1;
`;

const Meta = styled.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 8px;
`;

const MetaTitle = styled.span`
  font-size: 12.5px;
  font-weight: 700;
  color: #18181b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
`;

const MetaCount = styled.span`
  font-size: 11.5px;
  font-weight: 700;
  color: #71717a;
`;

const Track = styled.div`
  height: 5px;
  border-radius: 3px;
  background: #f1f1f3;
  overflow: hidden;
`;

const TrackFill = styled.div`
  height: 100%;
  border-radius: 3px;
  background: #059669;
`;

const Body = styled.div`
  flex: 1;
  min-height: 0;
  overflow: auto;
  overscroll-behavior: contain;
`;

const BodyPad = styled.div`
  height: 130px;
`;

const Missing = styled.div`
  padding: 200px 40px 0;
  text-align: center;
  font-size: 15px;
  font-weight: 600;
  color: #a1a1aa;
`;

const Footer = styled.div`
  position: absolute;
  bottom: 22px;
  left: 25px;
  right: 25px;
`;

const Continue = styled.button`
  width: 100%;
  height: 54px;
  border: none;
  border-radius: 1000px;
  background: #059669;
  color: #fff;
  font-family: inherit;
  font-size: 16px;
  font-weight: 800;
  letter-spacing: -0.25px;
  cursor: pointer;
  box-shadow: 0 8px 40px rgba(0, 0, 0, 0.18);
`;
