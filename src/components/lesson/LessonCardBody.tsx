import React from 'react';
import styled, { useTheme } from 'styled-components/native';

import CourseAssetView from '@/components/CourseAssetView';
import Icon from '@/components/Icon';
import type { CourseAssetV2, CourseQuestionV2 } from '@/data/course/v2/wire';
import {
  isCheckYourselfBlock,
  isConceptBlock,
  isDriveSmarterBlock,
  isImageBlock,
  isProseBlock,
  isQuickChallengeBlock,
  recallSegments,
} from '@/data/course/v2/wire';
import type { AppTheme } from '@/theme';
import { shadows } from '@/theme';

import { CARD_META, UNKNOWN_META, cardMetaFor } from './cards';
import type { LessonCard } from './cards';
import type { CardMeta, LessonAnswer, OptionState, Tone } from './types';

// The body of one lesson card, with no knowledge of navigation, progress
// storage or analytics — everything it draws comes in as props. The app's
// player and the admin preview both render lessons through this component, so
// what an editor sees is what a learner gets.

export const toneColor = (theme: AppTheme, tone: Tone): string =>
  tone === 'accent'
    ? theme.colors.accent
    : tone === 'trap'
    ? theme.colors.trap
    : tone === 'california'
    ? theme.colors.california
    : theme.colors.muted;

export const Kicker: React.FC<{
  meta: CardMeta;
  label?: string;
  muted?: boolean;
}> = ({ meta, label, muted = false }) => {
  const theme = useTheme();
  const tone: Tone = muted ? 'muted' : meta.tone;

  return (
    <KickerRow>
      <Icon name={meta.icon} size={15} color={toneColor(theme, tone)} />
      <KickerText $tone={tone}>{label ?? meta.label}</KickerText>
    </KickerRow>
  );
};

type OptionsProps = {
  question: CourseQuestionV2;
  answer?: LessonAnswer;
  onSelect: (choiceId: string) => void;
};

export const Options: React.FC<OptionsProps> = ({
  question,
  answer,
  onSelect,
}) => {
  const theme = useTheme();
  const checked = answer?.checked ?? false;
  const wasWrong = checked && answer?.selectedId !== question.correctAnswerId;

  return (
    <OptionList>
      {question.choices.map(choice => {
        const picked = choice.id === answer?.selectedId;
        const isCorrect = choice.id === question.correctAnswerId;

        if (!checked) {
          return (
            <Option
              key={choice.id}
              $state={picked ? 'selected' : 'idle'}
              onPress={() => onSelect(choice.id)}
            >
              <OptionText $state={picked ? 'selected' : 'idle'}>
                {choice.text}
              </OptionText>
              <Radio $selected={picked} />
            </Option>
          );
        }

        if (isCorrect) {
          return (
            <Option key={choice.id} $state="correct" disabled>
              <Icon
                name="circle-check"
                size={20}
                color={theme.colors.correct}
              />
              <OptionBody>
                <OptionText $state="correct">{choice.text}</OptionText>
                {wasWrong && (
                  <MicroLabel $state="correct">Correct answer</MicroLabel>
                )}
              </OptionBody>
            </Option>
          );
        }

        if (picked) {
          return (
            <Option key={choice.id} $state="wrong" disabled>
              <Icon name="xmark" size={19} color={theme.colors.wrong} />
              <OptionBody>
                <OptionText $state="wrong">{choice.text}</OptionText>
                <MicroLabel $state="wrong">Your answer</MicroLabel>
              </OptionBody>
            </Option>
          );
        }

        return (
          <Option key={choice.id} $state="dimmed" disabled>
            <OptionText $state="dimmed">{choice.text}</OptionText>
          </Option>
        );
      })}
    </OptionList>
  );
};

export const Diagram: React.FC<{ asset?: CourseAssetV2; tall?: boolean }> = ({
  asset,
  tall = false,
}) => (
  <DiagramWrap $tall={tall}>
    <CourseAssetView asset={asset} radius={16} />
  </DiagramWrap>
);

// The recall rule as a wrapping row of words so each [[gap]] can be a real
// pill (padding + radius are not available on nested Text fragments). Hidden
// gaps keep the word in the layout with transparent ink, so revealing never
// reflows the sentence.
const RecallRule: React.FC<{ ruleMarkdown: string; revealed: boolean }> = ({
  ruleMarkdown,
  revealed,
}) => (
  <RecallLine>
    {recallSegments(ruleMarkdown).flatMap((segment, index) => {
      if (segment.gap) {
        return [
          <RecallGap key={`gap-${index}`} $revealed={revealed}>
            <RecallGapWord $revealed={revealed}>{segment.text}</RecallGapWord>
          </RecallGap>,
        ];
      }
      return segment.text
        .split(/\s+/)
        .filter(word => word.length > 0)
        .map((word, wordIndex) => (
          <RecallWord key={`word-${index}-${wordIndex}`}>{word}</RecallWord>
        ));
    })}
  </RecallLine>
);

const TeachingCopy: React.FC<{
  body: string;
  bullets?: string[];
}> = ({ body, bullets }) => (
  <>
    <Body>{body}</Body>
    {bullets != null && bullets.length > 0 && (
      <BulletList>
        {bullets.map(bullet => (
          <BulletRow key={bullet}>
            <BulletMark>•</BulletMark>
            <BulletText>{bullet}</BulletText>
          </BulletRow>
        ))}
      </BulletList>
    )}
  </>
);

type LessonCardBodyProps = {
  card: LessonCard;
  // The card's question and diagram, already resolved by the host — the app
  // reads them from the course store, the admin from the version it is showing.
  question?: CourseQuestionV2;
  asset?: CourseAssetV2;
  answer?: LessonAnswer;
  onSelect: (choiceId: string) => void;
  // The course's own state, for the `state_specific` kicker.
  stateLabel: string;
  // Position of a checkpoint question within the lesson, for its kicker.
  checkpointOrdinal?: number;
  checkpointTotal?: number;
  // check_yourself only: whether the host has revealed the hidden words.
  revealed?: boolean;
};

const LessonCardBody: React.FC<LessonCardBodyProps> = ({
  card,
  question,
  asset,
  answer,
  onSelect,
  stateLabel,
  checkpointOrdinal = 0,
  checkpointTotal = 0,
  revealed = false,
}) => {
  const { block } = card;
  const meta = cardMetaFor(block, stateLabel);
  const checked = answer?.checked ?? false;

  if (card.checkpoint && question != null) {
    return (
      <>
        <Kicker
          meta={CARD_META.core_rule}
          label={`Checkpoint · Question ${checkpointOrdinal} of ${checkpointTotal}`}
          muted={checked}
        />
        <Ask>{question.prompt}</Ask>
        <Options question={question} answer={answer} onSelect={onSelect} />
        {!checked && answer?.selectedId == null && (
          <Hint>Pick one answer to continue</Hint>
        )}
      </>
    );
  }

  if (isQuickChallengeBlock(block) && question != null) {
    return (
      <>
        <Kicker meta={meta} muted={checked} />
        <Title>{block.title}</Title>
        {asset != null && <Diagram asset={asset} />}
        <Body>{block.scenario}</Body>
        <Ask $small>{question.prompt}</Ask>
        <Options question={question} answer={answer} onSelect={onSelect} />
        {!checked && answer?.selectedId == null && (
          <Hint>Pick one answer to continue</Hint>
        )}
      </>
    );
  }

  if (isImageBlock(block)) {
    return (
      <>
        <Kicker meta={meta} />
        <Diagram asset={asset} tall />
      </>
    );
  }

  if (isCheckYourselfBlock(block)) {
    return (
      <>
        <Kicker meta={meta} />
        <Title>{block.title}</Title>
        <RecallCard style={shadows.recallCard}>
          <RecallContext>{block.context}</RecallContext>
          <RecallRule ruleMarkdown={block.ruleMarkdown} revealed={revealed} />
        </RecallCard>
        {asset != null && (
          <RecallAssetGap>
            <Diagram asset={asset} />
          </RecallAssetGap>
        )}
        <RecallHint>
          {revealed
            ? 'Just a self-check — either answer moves you forward.'
            : 'Say the missing words out loud, then reveal.'}
        </RecallHint>
      </>
    );
  }

  if (isProseBlock(block) && block.type === 'remember_this') {
    return (
      <>
        <Kicker meta={meta} />
        <RecapCard>
          <RecapText>{block.bodyMarkdown}</RecapText>
        </RecapCard>
        {asset != null && <Diagram asset={asset} />}
      </>
    );
  }

  if (isDriveSmarterBlock(block)) {
    return (
      <>
        <Kicker meta={meta} />
        <Title $tight>{block.title}</Title>
        <OptionalNote>
          Not on the test — skip it if you're short on time.
        </OptionalNote>
        {asset != null && <Diagram asset={asset} />}
        <TeachingCopy body={block.bodyMarkdown} bullets={block.bullets} />
      </>
    );
  }

  if (isProseBlock(block) || isConceptBlock(block)) {
    return (
      <>
        <Kicker meta={meta} />
        <Title>{block.title}</Title>
        {asset != null && <Diagram asset={asset} />}
        <TeachingCopy body={block.bodyMarkdown} bullets={block.bullets} />
      </>
    );
  }

  // A block type this build does not know: never break the deck.
  return (
    <>
      <Kicker meta={UNKNOWN_META} />
      <Title>One more thing</Title>
      <Body>
        This card needs a newer version of the app. Nothing else in the lesson
        is affected — carry on.
      </Body>
    </>
  );
};

export default LessonCardBody;

// ---------------------------------------------------------------------------
// Styles

const KickerRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 8px;
  margin: 30px 24px 12px;
`;

const KickerText = styled.Text<{ $tone: Tone }>`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: 10.5px;
  letter-spacing: 1.1px;
  text-transform: uppercase;
  color: ${({ theme, $tone }) => toneColor(theme, $tone)};
`;

const Title = styled.Text<{ $tight?: boolean }>`
  ${({ theme }) => theme.fonts.extraBold}
  margin: 0 24px ${({ $tight }) => ($tight ? '8px' : '16px')};
  font-size: 25px;
  line-height: 31px;
  letter-spacing: -0.7px;
  color: ${({ theme }) => theme.colors.ink};
`;

const Ask = styled.Text<{ $small?: boolean }>`
  ${({ theme }) => theme.fonts.extraBold}
  margin: ${({ $small }) => ($small ? '4px 24px 14px' : '0 24px 18px')};
  font-size: ${({ $small }) => ($small ? '17px' : '23px')};
  line-height: ${({ $small }) => ($small ? '24px' : '30px')};
  letter-spacing: -0.6px;
  color: ${({ theme }) => theme.colors.ink};
`;

const Body = styled.Text`
  ${({ theme }) => theme.fonts.medium}
  margin: 0 24px 18px;
  font-size: 16px;
  line-height: 26px;
  color: ${({ theme }) => theme.colors.body};
`;

const BulletList = styled.View`
  margin: -2px 24px 20px;
  gap: 11px;
`;

const BulletRow = styled.View`
  flex-direction: row;
  align-items: flex-start;
  gap: 10px;
`;

const BulletMark = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  width: 12px;
  font-size: 17px;
  line-height: 24px;
  color: ${({ theme }) => theme.colors.accent};
`;

const BulletText = styled.Text`
  ${({ theme }) => theme.fonts.medium}
  flex: 1;
  font-size: 16px;
  line-height: 24px;
  color: ${({ theme }) => theme.colors.body};
`;

const OptionalNote = styled.Text`
  ${({ theme }) => theme.fonts.medium}
  margin: 0 24px 20px;
  font-size: 14px;
  line-height: 22px;
  color: ${({ theme }) => theme.colors.muted};
`;

const Hint = styled.Text`
  ${({ theme }) => theme.fonts.semiBold}
  margin: 18px 24px 0;
  font-size: 13px;
  color: ${({ theme }) => theme.colors.dim};
`;

const DiagramWrap = styled.View<{ $tall?: boolean }>`
  margin: 0 20px ${({ $tall }) => ($tall ? '0' : '16px')};
`;

const OptionList = styled.View`
  margin: 0 20px;
  gap: 10px;
`;

const Option = styled.Pressable<{ $state: OptionState }>`
  flex-direction: row;
  align-items: center;
  gap: 12px;
  padding: 15px 16px;
  border-radius: 14px;
  opacity: ${({ $state }) => ($state === 'dimmed' ? 0.5 : 1)};
  border: ${({ theme, $state }) =>
    $state === 'selected'
      ? `1.5px solid ${theme.colors.accent}`
      : $state === 'correct'
      ? `1.5px solid ${theme.colors.correct}`
      : $state === 'wrong'
      ? `1.5px solid ${theme.colors.wrongLine}`
      : $state === 'dimmed'
      ? `1px solid ${theme.colors.faint}`
      : `1px solid ${theme.colors.line}`};
  background-color: ${({ theme, $state }) =>
    $state === 'selected'
      ? theme.colors.accentSoft
      : $state === 'correct'
      ? theme.colors.correctSoft
      : $state === 'wrong'
      ? theme.colors.wrongSoft
      : 'transparent'};
`;

const OptionBody = styled.View`
  flex: 1;
`;

const OptionText = styled.Text<{ $state: OptionState }>`
  ${({ theme, $state }) =>
    $state === 'idle'
      ? theme.fonts.semiBold
      : $state === 'dimmed'
      ? theme.fonts.medium
      : theme.fonts.bold}
  flex-shrink: 1;
  ${({ $state }) =>
    $state === 'idle' || $state === 'selected' ? 'flex: 1;' : ''}
  font-size: 15px;
  line-height: 22px;
  letter-spacing: ${({ $state }) =>
    $state === 'correct' || $state === 'wrong' ? '-0.15px' : '0px'};
  color: ${({ theme, $state }) =>
    $state === 'correct'
      ? theme.colors.correctText
      : $state === 'wrong'
      ? theme.colors.wrongText
      : $state === 'dimmed'
      ? theme.colors.muted
      : theme.colors.ink};
`;

const MicroLabel = styled.Text<{ $state: OptionState }>`
  ${({ theme }) => theme.fonts.extraBold}
  margin-top: 3px;
  font-size: 11.5px;
  letter-spacing: 0.5px;
  text-transform: uppercase;
  color: ${({ theme, $state }) =>
    $state === 'correct' ? theme.colors.correct : theme.colors.wrong};
`;

const Radio = styled.View<{ $selected: boolean }>`
  width: 22px;
  height: 22px;
  border-radius: 9999px;
  border: ${({ theme, $selected }) =>
    $selected
      ? `6.5px solid ${theme.colors.accent}`
      : `1.5px solid ${theme.colors.dim2}`};
`;

const RecallCard = styled.View`
  margin: 0 20px;
  padding: 28px 24px 32px;
  border-radius: 22px;
  background-color: ${({ theme }) => theme.colors.recall};
`;

const RecallContext = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  margin-bottom: 14px;
  font-size: 11px;
  letter-spacing: 1px;
  text-transform: uppercase;
  color: rgba(255, 255, 255, 0.62);
`;

const RecallLine = styled.View`
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  column-gap: 5px;
  row-gap: 7px;
`;

const RecallWord = styled.Text`
  ${({ theme }) => theme.fonts.semiBold}
  font-size: 19px;
  line-height: 27px;
  letter-spacing: -0.15px;
  color: #ffffff;
`;

const RecallGap = styled.View<{ $revealed: boolean }>`
  border-radius: 10px;
  padding: ${({ $revealed }) => ($revealed ? '1px 10px' : '1px 20px')};
  background-color: ${({ $revealed }) =>
    $revealed ? 'rgba(255, 255, 255, 0.16)' : 'rgba(255, 255, 255, 0.26)'};
  border: 1px solid
    ${({ $revealed }) =>
      $revealed ? 'rgba(255, 255, 255, 0.34)' : 'transparent'};
`;

const RecallGapWord = styled.Text<{ $revealed: boolean }>`
  ${({ theme, $revealed }) =>
    $revealed ? theme.fonts.bold : theme.fonts.semiBold}
  font-size: 19px;
  line-height: 25px;
  letter-spacing: -0.15px;
  color: ${({ $revealed }) => ($revealed ? '#ffffff' : 'transparent')};
`;

const RecallHint = styled.Text`
  ${({ theme }) => theme.fonts.semiBold}
  margin: 18px 24px 0;
  font-size: 13.5px;
  line-height: 21px;
  text-align: center;
  color: ${({ theme }) => theme.colors.dim};
`;

const RecallAssetGap = styled.View`
  margin-top: 16px;
`;

const RecapCard = styled.View`
  margin: 0 20px 20px;
  padding: 26px 22px;
  border-radius: 20px;
  border: 1px solid ${({ theme }) => theme.colors.accentSoft};
  background-color: ${({ theme }) => theme.colors.accentSoft};
`;

const RecapText = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: 26px;
  line-height: 33px;
  letter-spacing: -0.7px;
  color: ${({ theme }) => theme.colors.ink};
`;
