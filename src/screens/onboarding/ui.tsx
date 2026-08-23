import React, { useEffect, useRef, useState } from 'react';
import { Animated, Easing } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import styled, { useTheme } from 'styled-components/native';

import Icon from '@/components/Icon';
import PrimaryButton from '@/components/PrimaryButton';
import { RowTile } from '@/components/rows';

import { OptionTint } from './content';

// Shared onboarding primitives: accent kicker, left 27px title, ladder-node
// progress strip and the icon-card option rows — per the onboarding board.
//
// Every state change here is a transition rather than a jump. Selection is
// drawn as an accent layer stacked over the resting card and cross-faded, so
// the animation stays on the native driver (colours themselves cannot be
// animated there).

const LEVEL_BARS = 4;

// Option icon tiles are fixed, not themed. The accent is the learner's own
// choice made *after* onboarding, and these tiles carry meaning of their own
// (a red cross for a failed test, an amber warning) — recolouring the set
// with the accent would both break the board and blur what the icons mean.
// Same posture as answer feedback and sign colours in `theme`.
const OPTION_TILES: Record<OptionTint, { bg: string; fg: string }> = {
  accent: { bg: 'rgba(4, 133, 247, 0.07)', fg: '#0485F7' },
  done: { bg: 'rgba(34, 197, 94, 0.11)', fg: '#16A34A' },
  warning: { bg: 'rgba(245, 158, 11, 0.13)', fg: '#F59E0B' },
  error: { bg: 'rgba(239, 68, 68, 0.09)', fg: '#EF4444' },
  neutral: { bg: '#EFEFF1', fg: '#71717A' },
};

// Drives a 0→1 value whenever `on` flips. Spring for anything that should
// feel physical (a control the finger just hit), timing for ambient state.
export const useToggle = (on: boolean, spring = true): Animated.Value => {
  const value = useRef(new Animated.Value(on ? 1 : 0)).current;

  useEffect(() => {
    const animation = spring
      ? Animated.spring(value, {
          toValue: on ? 1 : 0,
          useNativeDriver: true,
          speed: 18,
          bounciness: 7,
        })
      : Animated.timing(value, {
          toValue: on ? 1 : 0,
          duration: 180,
          easing: Easing.out(Easing.quad),
          useNativeDriver: true,
        });
    animation.start();
    return () => animation.stop();
  }, [on, spring, value]);

  return value;
};

export const StepScreen = styled.View`
  flex: 1;
  background-color: ${({ theme }) => theme.colors.bg};
`;

// The band the floating CTA covers: its 22px float above the safe area plus
// the 54px capsule, and enough clearance that the last line of text does not
// stop right against it. Scrolled content has to reserve this by hand, since
// the dock is positioned absolutely and never joins the content flow.
const DOCK_RESERVE = 22 + 54 + 18;

type StepScrollProps = {
  children: React.ReactNode;
};

// For a step whose content can outgrow the screen — a tall illustration plus
// title and body leaves nothing to spare on a 667pt phone. Scrolling switches
// itself on only once the content genuinely overflows, so on a taller device
// this behaves exactly like the plain View it replaces, bounce included. That
// measurement is what makes it safe everywhere: it also covers a large system
// font or a longer translation, which a screen-height guess would miss.
export const StepScroll: React.FC<StepScrollProps> = ({ children }) => {
  const insets = useSafeAreaInsets();
  const [viewport, setViewport] = useState(0);
  const [content, setContent] = useState(0);
  // flexGrow below holds the content at least viewport-tall, so anything past
  // that is real overflow; the 1px slack absorbs sub-pixel rounding.
  const overflows = content > viewport + 1;

  return (
    <StepScrollArea
      scrollEnabled={overflows}
      bounces={overflows}
      showsVerticalScrollIndicator={false}
      // The step draws its own full-bleed art under a transparent header, so
      // iOS must not inset the content to clear that bar.
      contentInsetAdjustmentBehavior="never"
      automaticallyAdjustContentInsets={false}
      onLayout={event => setViewport(event.nativeEvent.layout.height)}
      onContentSizeChange={(_, height) => setContent(height)}
      contentContainerStyle={{
        flexGrow: 1,
        paddingBottom: insets.bottom + DOCK_RESERVE,
      }}
    >
      {children}
    </StepScrollArea>
  );
};

const StepScrollArea = styled.ScrollView`
  flex: 1;
  background-color: ${({ theme }) => theme.colors.bg};
`;

type ContinueDockProps = {
  label?: string;
  disabled?: boolean;
  onPress: () => void;
};

// Every step floats its CTA 22px above the safe-area bottom — no footer bar.
// It lifts into place as soon as the step has an answer.
export const ContinueDock: React.FC<ContinueDockProps> = ({
  label = 'Continue',
  disabled = false,
  onPress,
}) => {
  const insets = useSafeAreaInsets();
  const ready = useToggle(!disabled, false);

  return (
    <Dock
      style={{
        bottom: insets.bottom + 22,
        opacity: ready.interpolate({
          inputRange: [0, 1],
          outputRange: [0.45, 1],
        }),
        transform: [
          {
            translateY: ready.interpolate({
              inputRange: [0, 1],
              outputRange: [8, 0],
            }),
          },
        ],
      }}
    >
      <PrimaryButton label={label} disabled={disabled} onPress={onPress} />
    </Dock>
  );
};

const Dock = styled(Animated.View)`
  position: absolute;
  left: 25px;
  right: 25px;
`;

export const Kicker = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: 10.5px;
  letter-spacing: 1.1px;
  text-transform: uppercase;
  color: ${({ theme }) => theme.colors.accent};
  font-variant: tabular-nums;
`;

export const StepTitle = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  font-size: 27px;
  line-height: 32px;
  letter-spacing: -0.8px;
  color: ${({ theme }) => theme.colors.ink};
`;

export const StepHint = styled.Text`
  ${({ theme }) => theme.fonts.medium}
  font-size: 13px;
  color: ${({ theme }) => theme.colors.muted};
`;

type LadderDotsProps = {
  total: number;
  current: number;
};

// Ladder-node progress: filled nodes behind, a ring on the current step,
// hollow ahead — dots joined by short dashes. Nodes and links cross-fade as
// the flow advances instead of snapping between screens.
export const LadderDots: React.FC<LadderDotsProps> = ({ total, current }) => (
  <DotsRow>
    {Array.from({ length: total }, (_, index) => (
      <React.Fragment key={index}>
        {index > 0 && <LadderLink done={index <= current} />}
        <LadderDot state={dotState(index, current)} />
      </React.Fragment>
    ))}
  </DotsRow>
);

const dotState = (
  index: number,
  current: number,
): 'done' | 'current' | 'todo' =>
  index === current ? 'current' : index < current ? 'done' : 'todo';

const LadderDot: React.FC<{ state: 'done' | 'current' | 'todo' }> = ({
  state,
}) => {
  const done = useToggle(state === 'done', false);
  const current = useToggle(state === 'current');

  return (
    <DotFrame>
      <DotBase />
      <DotFill style={{ opacity: done }} />
      <DotRing
        style={{
          opacity: current,
          transform: [
            {
              scale: current.interpolate({
                inputRange: [0, 1],
                outputRange: [0.6, 1],
              }),
            },
          ],
        }}
      />
    </DotFrame>
  );
};

// 12px wide so the current ring fits; the 8px dot is centred inside it.
const DotFrame = styled.View`
  width: 12px;
  height: 12px;
  align-items: center;
  justify-content: center;
`;

const DotBase = styled.View`
  width: 8px;
  height: 8px;
  border-radius: 9999px;
  background-color: ${({ theme }) => theme.colors.line};
`;

const DotFill = styled(Animated.View)`
  position: absolute;
  width: 8px;
  height: 8px;
  border-radius: 9999px;
  background-color: ${({ theme }) => theme.colors.accent};
`;

const DotRing = styled(Animated.View)`
  position: absolute;
  width: 12px;
  height: 12px;
  border-radius: 9999px;
  border-width: 3px;
  border-color: ${({ theme }) => theme.colors.accent};
  background-color: ${({ theme }) => theme.colors.bg};
`;

const LadderLink: React.FC<{ done: boolean }> = ({ done }) => {
  const filled = useToggle(done, false);

  return (
    <LinkFrame>
      <LinkBase />
      <LinkFill style={{ opacity: filled }} />
    </LinkFrame>
  );
};

const LinkFrame = styled.View`
  width: 14px;
  height: 2px;
`;

const LinkBase = styled.View`
  width: 14px;
  height: 2px;
  border-radius: 1px;
  background-color: ${({ theme }) => theme.colors.line};
`;

const LinkFill = styled(Animated.View)`
  position: absolute;
  width: 14px;
  height: 2px;
  border-radius: 1px;
  background-color: ${({ theme }) => theme.colors.accent};
`;

const DotsRow = styled.View`
  flex-direction: row;
  align-items: center;
  gap: 5px;
`;

type OptionCardProps = {
  label: string;
  sublabel?: string;
  icon?: React.ComponentProps<typeof Icon>['name'];
  tint?: OptionTint;
  level?: number;
  multi: boolean;
  selected: boolean;
  onPress: () => void;
};

export const OptionCard: React.FC<OptionCardProps> = ({
  label,
  sublabel,
  icon,
  tint = 'neutral',
  level,
  multi,
  selected,
  onPress,
}) => {
  const chosen = useToggle(selected, false);
  const press = useRef(new Animated.Value(0)).current;

  const setPressed = (pressed: boolean) => {
    Animated.spring(press, {
      toValue: pressed ? 1 : 0,
      useNativeDriver: true,
      speed: 40,
      bounciness: 0,
    }).start();
  };

  const colors = OPTION_TILES[tint];
  const plain = icon == null && level == null;

  return (
    <Animated.View
      style={{
        transform: [
          {
            scale: press.interpolate({
              inputRange: [0, 1],
              outputRange: [1, 0.98],
            }),
          },
        ],
      }}
    >
      <Card
        $plain={plain}
        accessibilityRole={multi ? 'checkbox' : 'radio'}
        accessibilityState={{ checked: selected }}
        onPress={onPress}
        onPressIn={() => setPressed(true)}
        onPressOut={() => setPressed(false)}
      >
        <SelectedLayer style={{ opacity: chosen }} />
        {level != null && <LevelBars level={level} active={selected} />}
        {icon != null && (
          <RowTile $bg={colors.bg} $size={38} $radius={12}>
            <Icon name={icon} size={16} color={colors.fg} />
          </RowTile>
        )}
        <OptionBody>
          <OptionLabel $selected={selected}>{label}</OptionLabel>
          {sublabel != null && <OptionSublabel>{sublabel}</OptionSublabel>}
        </OptionBody>
        {multi ? (
          <CheckBox selected={selected} />
        ) : (
          <Radio selected={selected} />
        )}
      </Card>
    </Animated.View>
  );
};

const Card = styled.Pressable<{ $plain: boolean }>`
  flex-direction: row;
  align-items: center;
  gap: 13px;
  padding: ${({ $plain }) => ($plain ? '14px 18px' : '13px 16px')};
  border-radius: 14px;
  border-width: 1px;
  border-color: ${({ theme }) => theme.colors.line};
  background-color: transparent;
  overflow: hidden;
`;

// The selected treatment as its own layer: a 1.5px accent border over the
// resting 1px one, plus the soft accent wash.
const SelectedLayer = styled(Animated.View)`
  position: absolute;
  top: -1px;
  left: -1px;
  right: -1px;
  bottom: -1px;
  border-radius: 14px;
  border-width: 1.5px;
  border-color: ${({ theme }) => theme.colors.accent};
  background-color: ${({ theme }) => theme.colors.accentSoft};
`;

const OptionBody = styled.View`
  flex: 1;
`;

const OptionLabel = styled.Text<{ $selected: boolean }>`
  ${({ theme, $selected }) =>
    $selected ? theme.fonts.extraBold : theme.fonts.semiBold}
  font-size: 15px;
  letter-spacing: ${({ $selected }) => ($selected ? -0.2 : 0)}px;
  color: ${({ theme }) => theme.colors.ink};
  font-variant: tabular-nums;
`;

const OptionSublabel = styled.Text`
  ${({ theme }) => theme.fonts.semiBold}
  margin-top: 2px;
  font-size: 12.5px;
  line-height: 18px;
  color: ${({ theme }) => theme.colors.muted};
`;

// Four stacked bars; the ones up to `level` light up when the row is picked.
const LevelBars: React.FC<{ level: number; active: boolean }> = ({
  level,
  active,
}) => (
  <BarsColumn>
    {Array.from({ length: LEVEL_BARS }, (_, index) => (
      <LevelBar key={index} filled={index < level} active={active} />
    ))}
  </BarsColumn>
);

const LevelBar: React.FC<{ filled: boolean; active: boolean }> = ({
  filled,
  active,
}) => {
  const lit = useToggle(filled && active, false);

  return (
    <BarFrame>
      <BarBase $filled={filled} />
      <BarFill style={{ opacity: lit }} />
    </BarFrame>
  );
};

const BarsColumn = styled.View`
  gap: 3px;
`;

const BarFrame = styled.View`
  width: 16px;
  height: 5px;
`;

const BarBase = styled.View<{ $filled: boolean }>`
  width: 16px;
  height: 5px;
  border-radius: 3px;
  background-color: ${({ theme, $filled }) =>
    $filled ? theme.colors.dim : theme.colors.line};
`;

const BarFill = styled(Animated.View)`
  position: absolute;
  width: 16px;
  height: 5px;
  border-radius: 3px;
  background-color: ${({ theme }) => theme.colors.accent};
`;

export const CheckBox: React.FC<{ selected: boolean }> = ({ selected }) => {
  const theme = useTheme();
  const on = useToggle(selected);

  return (
    <CheckBoxFrame>
      <CheckBoxFill style={{ opacity: on, transform: [{ scale: on }] }}>
        <Icon name="check" size={11} color={theme.colors.bg} />
      </CheckBoxFill>
    </CheckBoxFrame>
  );
};

const CheckBoxFrame = styled.View`
  width: 22px;
  height: 22px;
  border-radius: 7px;
  align-items: center;
  justify-content: center;
  border-width: 1.5px;
  border-color: ${({ theme }) => theme.colors.dim2};
`;

const CheckBoxFill = styled(Animated.View)`
  position: absolute;
  top: -1.5px;
  left: -1.5px;
  width: 22px;
  height: 22px;
  border-radius: 7px;
  align-items: center;
  justify-content: center;
  background-color: ${({ theme }) => theme.colors.accent};
`;

export const Radio: React.FC<{ selected: boolean }> = ({ selected }) => {
  const on = useToggle(selected);

  return (
    <RadioFrame>
      <RadioDot style={{ opacity: on, transform: [{ scale: on }] }} />
    </RadioFrame>
  );
};

const RadioFrame = styled.View`
  width: 22px;
  height: 22px;
  border-radius: 9999px;
  align-items: center;
  justify-content: center;
  border-width: 1.5px;
  border-color: ${({ theme }) => theme.colors.dim2};
  background-color: ${({ theme }) => theme.colors.bg};
`;

// A 6.5px ring reads as a filled radio at this size — matches the board.
const RadioDot = styled(Animated.View)`
  position: absolute;
  top: -1.5px;
  left: -1.5px;
  width: 22px;
  height: 22px;
  border-radius: 9999px;
  border-width: 6.5px;
  border-color: ${({ theme }) => theme.colors.accent};
  background-color: ${({ theme }) => theme.colors.bg};
`;

type FadeInProps = {
  visible: boolean;
  children: React.ReactNode;
};

// Reveals a block that appears as a consequence of an answer (the test-date
// summary), rather than having it pop in.
export const FadeIn: React.FC<FadeInProps> = ({ visible, children }) => {
  const shown = useToggle(visible, false);

  return (
    <Animated.View
      style={{
        opacity: shown,
        transform: [
          {
            translateY: shown.interpolate({
              inputRange: [0, 1],
              outputRange: [6, 0],
            }),
          },
        ],
      }}
    >
      {children}
    </Animated.View>
  );
};
