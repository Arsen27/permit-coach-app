import React, { useMemo, useState } from 'react';
import { ScrollView, View } from 'react-native';
import { ThemeProvider } from 'styled-components/native';
import styledWeb from 'styled-components';

import LessonCardBody from '@/components/lesson/LessonCardBody';
import { cardAssetId } from '@/components/lesson/cards';
import type { LessonCard } from '@/components/lesson/cards';
import type { LessonAnswer } from '@/components/lesson/types';
import type { CardStyleV2, LessonDocV2 } from '@/data/course/v2/wire';
import { isCheckYourselfBlock } from '@/data/course/v2/wire';
import { defaultTheme } from '@/theme';

// The lesson exactly as the app plays it: the same LessonCardBody the device
// renders, under the app's own theme, so what an editor previews is what a
// learner gets. Only the chrome around it is the admin's.

type Props = {
  doc: LessonDocV2;
  cards: LessonCard[];
  index: number;
  stateLabel: string;
  // The course's authored slide types, so the preview kicker matches the app.
  cardStyles?: CardStyleV2[];
  onAdvance?: () => void;
  // Wheel scrolling is claimed by the phone only while it is focused, so the
  // page keeps scrolling naturally until the operator clicks into a device.
  scrollEnabled?: boolean;
};

const AppLessonScreen: React.FC<Props> = ({
  doc,
  cards,
  index,
  stateLabel,
  cardStyles,
  onAdvance,
  scrollEnabled = true,
}) => {
  const [answers, setAnswers] = useState<Record<string, LessonAnswer>>({});
  // check_yourself cards the operator has revealed, by blockId.
  const [revealed, setRevealed] = useState<Record<string, boolean>>({});

  const questions = useMemo(
    () =>
      new Map(doc.questions.map(question => [question.questionId, question])),
    [doc],
  );
  const assets = useMemo(
    () => new Map(doc.assets.map(asset => [asset.assetId, asset])),
    [doc],
  );

  const card = cards[Math.min(index, cards.length - 1)];
  if (card == null) {
    return (
      <Empty>
        <EmptyText>This lesson has no cards yet</EmptyText>
      </Empty>
    );
  }

  const question =
    card.questionId == null ? undefined : questions.get(card.questionId);
  const assetId = cardAssetId(card, question?.assetId);
  const answer = card.questionId == null ? undefined : answers[card.questionId];
  const checked = answer?.checked ?? false;
  const awaitingCheck = question != null && !checked;

  const select = (choiceId: string) => {
    if (card.questionId == null) {
      return;
    }
    setAnswers(previous => ({
      ...previous,
      [card.questionId!]: { selectedId: choiceId, checked: false },
    }));
  };

  const check = () => {
    if (card.questionId == null || answer?.selectedId == null) {
      return;
    }
    setAnswers(previous => ({
      ...previous,
      [card.questionId!]: { ...previous[card.questionId!], checked: true },
    }));
  };

  const ordinal =
    card.questionId == null
      ? 0
      : doc.lesson.questionIds.indexOf(card.questionId) + 1;

  const recall = isCheckYourselfBlock(card.block);
  const recallShown = recall && revealed[card.block.blockId] === true;
  const revealRecall = () =>
    setRevealed(previous => ({ ...previous, [card.block.blockId]: true }));

  return (
    <ThemeProvider theme={defaultTheme}>
      <Screen>
        <Header>
          <CircleButton>‹</CircleButton>
          <Progress>
            <ProgressMeta>
              <ProgressTitle>{doc.lesson.title}</ProgressTitle>
              <ProgressCount>
                {Math.min(index, cards.length - 1) + 1} / {cards.length}
              </ProgressCount>
            </ProgressMeta>
            <Track>
              <TrackFill
                style={{
                  width: `${
                    ((Math.min(index, cards.length - 1) + 1) / cards.length) *
                    100
                  }%`,
                }}
              />
            </Track>
          </Progress>
          <CircleButton>✕</CircleButton>
        </Header>

        <Body>
          <ScrollView scrollEnabled={scrollEnabled} style={{ flex: 1 }}>
            <View style={{ paddingBottom: 140 }}>
              <LessonCardBody
                card={card}
                question={question}
                asset={assetId == null ? undefined : assets.get(assetId)}
                answer={answer}
                onSelect={select}
                stateLabel={stateLabel}
                cardStyles={cardStyles}
                resolveAsset={assetId => assets.get(assetId)}
                checkpointOrdinal={ordinal}
                checkpointTotal={doc.lesson.questionIds.length}
                revealed={recallShown}
              />
            </View>
          </ScrollView>
        </Body>

        <Footer>
          {recall ? (
            recallShown ? (
              <>
                <RecallAsk>Did you remember it?</RecallAsk>
                <RecallRow>
                  <RecallNo onClick={onAdvance}>Not yet</RecallNo>
                  <RecallYes onClick={onAdvance} $disabled={false}>
                    I knew it
                  </RecallYes>
                </RecallRow>
              </>
            ) : (
              <Continue onClick={revealRecall} $disabled={false}>
                Reveal words
              </Continue>
            )
          ) : (
            <Continue
              onClick={awaitingCheck ? check : onAdvance}
              $disabled={awaitingCheck && answer?.selectedId == null}
            >
              {awaitingCheck
                ? 'Check answer'
                : index >= cards.length - 1
                ? 'Finish lesson'
                : 'Continue'}
            </Continue>
          )}
        </Footer>
      </Screen>
    </ThemeProvider>
  );
};

export default AppLessonScreen;

// The chrome around the shared card is the admin's own, written for the web.
const Screen = styledWeb.div`
  position: absolute;
  inset: 0;
  display: flex;
  flex-direction: column;
  background: #fff;
  font-family: 'PlusJakartaSans-Medium', 'Plus Jakarta Sans', system-ui,
    sans-serif;
`;

const Header = styledWeb.div`
  flex: none;
  display: flex;
  align-items: center;
  gap: 14px;
  padding: 62px 20px 0;
`;

const CircleButton = styledWeb.div`
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

const Progress = styledWeb.div`
  flex: 1;
`;

const ProgressMeta = styledWeb.div`
  display: flex;
  align-items: baseline;
  justify-content: space-between;
  margin-bottom: 8px;
`;

const ProgressTitle = styledWeb.span`
  font-size: 12.5px;
  font-weight: 700;
  color: #18181b;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  max-width: 200px;
`;

const ProgressCount = styledWeb.span`
  font-size: 11.5px;
  font-weight: 700;
  color: #71717a;
`;

const Track = styledWeb.div`
  height: 5px;
  border-radius: 3px;
  background: #f1f1f3;
  overflow: hidden;
`;

const TrackFill = styledWeb.div`
  height: 100%;
  border-radius: 3px;
  background: #059669;
`;

const Body = styledWeb.div`
  flex: 1;
  min-height: 0;
  /* A block container gives the ScrollView no bounded height — it would grow
     with its content and never scroll. */
  display: flex;
  flex-direction: column;

  /* The scroller itself: reaching its end must not spill into the page. */
  & > div {
    overscroll-behavior: contain;
  }
`;

const Footer = styledWeb.div`
  position: absolute;
  bottom: 22px;
  left: 25px;
  right: 25px;
`;

const Continue = styledWeb.button<{ $disabled: boolean }>`
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
  opacity: ${({ $disabled }) => ($disabled ? 0.45 : 1)};
`;

const RecallAsk = styledWeb.div`
  margin-bottom: 12px;
  text-align: center;
  font-size: 13px;
  font-weight: 700;
  color: #71717a;
`;

const RecallRow = styledWeb.div`
  display: flex;
  gap: 10px;
`;

const RecallNo = styledWeb.button`
  flex: 1;
  height: 54px;
  border-radius: 1000px;
  border: 1.5px solid #e4e4e7;
  background: #fff;
  color: #3f3f46;
  font-family: inherit;
  font-size: 15px;
  font-weight: 800;
  letter-spacing: -0.2px;
  cursor: pointer;
`;

const RecallYes = styledWeb(Continue)`
  flex: 1;
  width: auto;
`;

const Empty = styledWeb.div`
  position: absolute;
  inset: 0;
  display: flex;
  align-items: center;
  justify-content: center;
`;

const EmptyText = styledWeb.span`
  font-size: 15px;
  font-weight: 600;
  color: #a1a1aa;
`;
