import React from 'react';
import { Animated, Platform } from 'react-native';
import styled, { useTheme } from 'styled-components/native';

import CourseAssetView from '@/components/CourseAssetView';
import Icon from '@/components/Icon';
import type {
  CardStyleV2,
  CourseAssetV2,
  CourseQuestionV2,
  LessonElementV2,
} from '@/data/course/v2/wire';
import {
  blockElements,
  isBulletsElement,
  isCheckYourselfBlock,
  isConceptBlock,
  isDriveSmarterBlock,
  isImageBlock,
  isImageElement,
  isParagraphElement,
  isProseBlock,
  isQuickChallengeBlock,
  recallSegments,
} from '@/data/course/v2/wire';
import type { AppTheme } from '@/theme';
import { shadows } from '@/theme';

import RecallCover from './RecallCover';
import { UNKNOWN_META, cardMetaFor, checkpointMetaFor } from './cards';
import type { LessonCard } from './cards';
import type { CardMeta, LessonAnswer, OptionState, Tone } from './types';

// Resolves an inline image element to the asset the host holds. The app reads
// the course store, the admin the document it is showing.
export type AssetResolver = (assetId: string) => CourseAssetV2 | undefined;

// The body of one lesson card, with no knowledge of navigation, progress
// storage or analytics — everything it draws comes in as props. The app's
// player and the admin preview both render lessons through this component, so
// what an editor sees is what a learner gets.

// A recap is the line the learner carries away, so it is set large — but a
// paragraph set at hero size is a wall, and an author who wrote several
// points meant several points. Past this much text the card splits into one
// per paragraph and the type comes down; a short closing line is left
// exactly as it was.
const RECAP_SPLIT_CHARS = 150;
const RECAP_TIGHT_CHARS = 90;

const recapPoints = (elements: LessonElementV2[]): string[] => {
  const paragraphs = elements
    .filter(isParagraphElement)
    .map(element => element.text.trim())
    .filter(text => text.length > 0);
  if (paragraphs.length === 0) {
    return [''];
  }
  const total = paragraphs.join(' ').length;
  return paragraphs.length > 1 && total > RECAP_SPLIT_CHARS
    ? paragraphs
    : [paragraphs.join('\n\n')];
};

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
  // A dimmed kicker (an answered question) drops the authored colours too —
  // the point of the dim is that the card has stopped asking for attention.
  const fallback = toneColor(theme, tone);
  const iconColor = muted ? fallback : meta.iconColor ?? fallback;
  const textColor = muted ? fallback : meta.textColor ?? fallback;

  return (
    <KickerRow>
      <Icon name={meta.icon} xml={meta.iconSvg} size={15} color={iconColor} />
      <KickerText $color={textColor}>{label ?? meta.label}</KickerText>
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

// One [[gap]]: the sharp white word defines the layout; the outlined pill
// chrome of screen 24 fades in around it on reveal, and a RecallCover hides
// it until then — Liquid Glass on iOS 26 (the word reads as a blur, screen
// 19), an opaque pill elsewhere. Revealing is staggered per gap: the glass
// dematerializes natively while the chrome springs in with a small pop, so
// the word visibly comes into focus without the sentence ever reflowing.
const RecallGapPillComponent: React.FC<{
  word: string;
  revealed: boolean;
  order: number;
}> = ({ word, revealed, order }) => {
  const progress = React.useRef(new Animated.Value(revealed ? 1 : 0)).current;
  const [coverRevealed, setCoverRevealed] = React.useState(revealed);
  const shown = React.useRef(revealed);

  React.useEffect(() => {
    if (revealed === shown.current) {
      return;
    }
    shown.current = revealed;
    if (!revealed) {
      progress.setValue(0);
      setCoverRevealed(false);
      return;
    }
    // The native glass dissolve is triggered by a prop flip, so the stagger
    // delays both the flip and the spring by the same amount.
    const timer = setTimeout(() => setCoverRevealed(true), order * 90);
    Animated.spring(progress, {
      toValue: 1,
      delay: order * 90,
      friction: 7,
      tension: 90,
      useNativeDriver: Platform.OS !== 'web',
    }).start();
    return () => {
      clearTimeout(timer);
      progress.stopAnimation();
    };
  }, [revealed, order, progress]);

  // One interpolation graph per mounted pill: rebuilding these Animated
  // nodes on every parent re-render made recall cards needlessly heavy.
  const anim = React.useMemo(
    () => ({
      chromeOpacity: progress.interpolate({
        inputRange: [0, 0.25, 1],
        outputRange: [0, 0, 1],
        extrapolate: 'clamp',
      }),
      coverFade: progress.interpolate({
        inputRange: [0, 0.7, 1],
        outputRange: [1, 0, 0],
        extrapolate: 'clamp',
      }),
      pop: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0.94, 1],
      }),
      coverLift: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [1, 1.08],
        extrapolate: 'clamp',
      }),
      // Glass alone does not smear 19px glyphs enough to stop reading.
      // Hidden, the word is dimmed and flanked by two offset ghost copies —
      // under the glass the three read as one blurred blob. Revealing
      // converges the ghosts into the word as it comes up to full ink: a
      // focus pull.
      wordFocus: progress.interpolate({
        inputRange: [0, 1],
        outputRange: [0.32, 1],
        extrapolate: 'clamp',
      }),
      ghostFade: progress.interpolate({
        inputRange: [0, 0.6, 1],
        outputRange: [0.26, 0, 0],
        extrapolate: 'clamp',
      }),
      ghostShift: {
        [-1]: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [-3, 0],
          extrapolate: 'clamp',
        }),
        [1]: progress.interpolate({
          inputRange: [0, 1],
          outputRange: [3, 0],
          extrapolate: 'clamp',
        }),
      },
    }),
    [progress],
  );
  const { chromeOpacity, coverFade, pop, coverLift, wordFocus, ghostFade } =
    anim;
  const ghostShift = (direction: 1 | -1) => anim.ghostShift[direction];

  return (
    <RecallGap>
      <RecallChrome
        style={{ opacity: chromeOpacity, transform: [{ scale: pop }] }}
      />
      <RecallGapWord style={{ opacity: wordFocus }}>{word}</RecallGapWord>
      {([-1, 1] as const).map(direction => (
        <RecallGhost
          key={direction}
          pointerEvents="none"
          accessibilityElementsHidden
          importantForAccessibility="no-hide-descendants"
          style={{
            opacity: ghostFade,
            transform: [{ translateX: ghostShift(direction) }],
          }}
        >
          <RecallGhostWord>{word}</RecallGhostWord>
        </RecallGhost>
      ))}
      <RecallCoverWrap
        pointerEvents="none"
        style={{ transform: [{ scale: coverLift }] }}
      >
        <RecallCover revealed={coverRevealed} fade={coverFade} word={word} />
      </RecallCoverWrap>
    </RecallGap>
  );
};

const RecallGapPill = React.memo(RecallGapPillComponent);

// The recall rule as a wrapping row of words so each [[gap]] can be a real
// pill (padding + radius are not available on nested Text fragments).
// Memoized: the parent re-renders on every answer/reveal state change, and
// re-splitting the markdown plus re-mounting a word per fragment is wasted
// work unless the rule or the reveal actually changed.
const RecallRuleComponent: React.FC<{
  ruleMarkdown: string;
  revealed: boolean;
}> = ({ ruleMarkdown, revealed }) => {
  const segments = React.useMemo(
    () => recallSegments(ruleMarkdown),
    [ruleMarkdown],
  );
  let gapOrder = -1;
  return (
    <RecallLine>
      {segments.flatMap((segment, index) => {
        if (segment.gap) {
          gapOrder += 1;
          return [
            <RecallGapPill
              key={`gap-${index}`}
              word={segment.text}
              revealed={revealed}
              order={gapOrder}
            />,
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
};

const RecallRule = React.memo(RecallRuleComponent);

// The card body, drawn element by element in authored order so an image can
// sit between two paragraphs. Legacy blocks come through `blockElements()` as
// paragraphs followed by their bullets, which is exactly how they used to be
// drawn — nothing shipped changes shape.
const TeachingCopy: React.FC<{
  elements: LessonElementV2[];
  resolveAsset?: AssetResolver;
}> = ({ elements, resolveAsset }) => (
  <>
    {elements.map((element, index) => {
      if (isParagraphElement(element)) {
        // A line left blank while authoring is not a paragraph break.
        return element.text.trim().length === 0 ? null : (
          <Body key={index}>{element.text}</Body>
        );
      }
      if (isBulletsElement(element)) {
        const items = element.items.filter(item => item.trim().length > 0);
        return items.length === 0 ? null : (
          <BulletList key={index}>
            {items.map((bullet, bulletIndex) => (
              <BulletRow key={bulletIndex}>
                <BulletMark>•</BulletMark>
                <BulletText>{bullet}</BulletText>
              </BulletRow>
            ))}
          </BulletList>
        );
      }
      if (isImageElement(element)) {
        return <Diagram key={index} asset={resolveAsset?.(element.assetId)} />;
      }
      // An element kind this build does not know: skip it, keep the card.
      return null;
    })}
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
  // The course's authored slide types, if it ships any.
  cardStyles?: CardStyleV2[];
  // Resolves the artwork of inline image elements.
  resolveAsset?: AssetResolver;
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
  cardStyles,
  resolveAsset,
  checkpointOrdinal = 0,
  checkpointTotal = 0,
  revealed = false,
}) => {
  const { block } = card;
  const meta = cardMetaFor(block, stateLabel, cardStyles);
  const elements = blockElements(block);
  const checked = answer?.checked ?? false;

  if (card.checkpoint && question != null) {
    return (
      <>
        <Kicker
          meta={checkpointMetaFor(cardStyles)}
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
            : 'The words are there — can you read them from memory?'}
        </RecallHint>
      </>
    );
  }

  if (isProseBlock(block) && block.type === 'remember_this') {
    const points = recapPoints(elements);
    const longest = points.reduce(
      (most, point) => Math.max(most, point.length),
      0,
    );
    return (
      <>
        <Kicker meta={meta} />
        {points.map((point, index) => (
          <RecapCard key={index} testID="recap-card" $stacked={index > 0}>
            <RecapText testID="recap-text" $long={longest > RECAP_TIGHT_CHARS}>
              {point}
            </RecapText>
          </RecapCard>
        ))}
        {asset != null && <Diagram asset={asset} />}
        {/* The recap sentence is the card; any artwork the author added
            inline still belongs below it. */}
        <TeachingCopy
          elements={elements.filter(isImageElement)}
          resolveAsset={resolveAsset}
        />
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
        <TeachingCopy elements={elements} resolveAsset={resolveAsset} />
      </>
    );
  }

  if (isProseBlock(block) || isConceptBlock(block)) {
    return (
      <>
        <Kicker meta={meta} />
        <Title>{block.title}</Title>
        {asset != null && <Diagram asset={asset} />}
        <TeachingCopy elements={elements} resolveAsset={resolveAsset} />
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

const KickerText = styled.Text<{ $color: string }>`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: 10.5px;
  letter-spacing: 1.1px;
  text-transform: uppercase;
  color: ${({ $color }) => $color};
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

const RecallGap = styled.View`
  padding: 1px 10px;
`;

// Screen 24's outlined pill, as an absolute layer under the word so the cover
// above can hide both together.
const RecallChrome = styled(Animated.View)`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  border-radius: 9px;
  background-color: rgba(255, 255, 255, 0.16);
  border: 1px solid rgba(255, 255, 255, 0.34);
`;

const RecallGapWord = styled(Animated.Text)`
  ${({ theme }) => theme.fonts.bold}
  font-size: 19px;
  line-height: 25px;
  letter-spacing: -0.15px;
  color: #ffffff;
`;

// The offset ghost copies that turn the dimmed word into an unreadable blob
// while the cover is up.
const RecallGhost = styled(Animated.View)`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
  align-items: center;
  justify-content: center;
`;

const RecallGhostWord = styled.Text`
  ${({ theme }) => theme.fonts.bold}
  font-size: 19px;
  line-height: 25px;
  letter-spacing: -0.15px;
  color: #ffffff;
`;

const RecallCoverWrap = styled(Animated.View)`
  position: absolute;
  top: 0;
  right: 0;
  bottom: 0;
  left: 0;
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

const RecapCard = styled.View<{ $stacked: boolean }>`
  margin: 0 20px ${({ $stacked }) => ($stacked ? '12px' : '16px')};
  padding: 20px;
  border-radius: 20px;
  border: 1px solid ${({ theme }) => theme.colors.accentSoft};
  background-color: ${({ theme }) => theme.colors.accentSoft};
`;

const RecapText = styled.Text<{ $long: boolean }>`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: ${({ $long }) => ($long ? '19px' : '23px')};
  line-height: ${({ $long }) => ($long ? '26px' : '30px')};
  letter-spacing: -0.6px;
  color: ${({ theme }) => theme.colors.ink};
`;
