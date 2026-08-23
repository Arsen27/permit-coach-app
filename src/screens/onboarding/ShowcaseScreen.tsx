import React, { useState } from 'react';
import { Image, ImageSourcePropType, useWindowDimensions } from 'react-native';
import styled from 'styled-components/native';

import { NativeStackScreenProps } from '@react-navigation/native-stack';

import PlaceholderImage from '@/components/PlaceholderImage';
import { useCourse } from '@/data/course/CourseProvider';
import { bundleLessonCount } from '@/data/course/v2/wire';

import {
  LADDER_STEP_COUNT,
  makeShowcaseSlides,
  showcaseLadderIndex,
} from './content';
import { OnboardingParamList } from './types';
import { ContinueDock, LadderDots, StepScreen, StepScroll } from './ui';

type ShowcaseScreenProps = NativeStackScreenProps<
  OnboardingParamList,
  'Showcase'
>;

// Product preview in the standard onboarding layout: full-bleed illustration
// under the transparent header, centered ladder progress, then title and
// description.
const ShowcaseScreen: React.FC<ShowcaseScreenProps> = ({
  navigation,
  route,
}) => {
  const { bundle } = useCourse();
  const slides = makeShowcaseSlides(
    bundleLessonCount(bundle),
    bundle.course.state,
  );
  const { index } = route.params;
  const slide = slides[index];

  const advance = () => {
    if (index < slides.length - 1) {
      navigation.push('Showcase', { index: index + 1 });
      return;
    }
    navigation.push('Building');
  };

  return (
    <StepScreen>
      {/* The illustration alone is ~405pt on a 667pt phone, which leaves the
          body text nowhere to go — so the step scrolls where it has to. The
          dock stays outside the scroll, pinned over it. */}
      <StepScroll>
        {slide.image != null ? (
          <Illustration source={slide.image} />
        ) : (
          <PlaceholderImage label={slide.placeholder ?? ''} height={340} />
        )}
        <DotsWrap>
          <LadderDots
            total={LADDER_STEP_COUNT}
            current={showcaseLadderIndex(index)}
          />
        </DotsWrap>
        <Title>{slide.title}</Title>
        <Lead>{slide.body}</Lead>
      </StepScroll>
      <ContinueDock onPress={advance} />
    </StepScreen>
  );
};

// The current showcase exports are all 1170×1264; used only if the asset's
// own dimensions cannot be resolved.
const FALLBACK_ASPECT_RATIO = 1170 / 1264;

// Full-bleed width running under the transparent navigation bar; height
// follows the asset's own proportions (never its literal pixel size), so a
// re-exported illustration keeps fitting without any code change. The ratio
// is read from the bundled asset and passed straight into `style` — not
// through the css template — so no css-to-style translation sits between it
// and the native view.
type IllustrationProps = {
  source: ImageSourcePropType;
};

const Illustration: React.FC<IllustrationProps> = ({ source }) => {
  const resolved = Image.resolveAssetSource?.(source);
  const aspectRatio =
    resolved != null && resolved.width > 0 && resolved.height > 0
      ? resolved.width / resolved.height
      : FALLBACK_ASPECT_RATIO;

  // The height is an explicit number, never `aspectRatio` in the style:
  // on RN 0.86's new architecture an Image style containing aspectRatio is
  // ignored wholesale (even its width), and the view falls back to the
  // asset's intrinsic 1170×1264pt — reproduced in the simulator, no warning
  // anywhere. The window width seeds the first frame; onLayout then corrects
  // for any container that is not screen-wide.
  const { width: windowWidth } = useWindowDimensions();
  const [width, setWidth] = useState(windowWidth);
  const height = Math.round(width / aspectRatio);

  return (
    <IllustrationImage
      source={source}
      resizeMode="cover"
      style={{ height }}
      onLayout={event => setWidth(event.nativeEvent.layout.width)}
    />
  );
};

const IllustrationImage = styled.Image`
  width: 100%;
`;

const DotsWrap = styled.View`
  align-items: center;
  margin: 26px 0 22px;
`;

const Title = styled.Text`
  ${({ theme }) => theme.fonts.extraBold}
  margin: 0 30px 12px;
  font-size: 26px;
  line-height: 33px;
  letter-spacing: -0.8px;
  text-align: center;
  color: ${({ theme }) => theme.colors.ink};
`;

const Lead = styled.Text`
  ${({ theme }) => theme.fonts.medium}
  margin: 0 36px;
  font-size: 15px;
  line-height: 24px;
  text-align: center;
  color: ${({ theme }) => theme.colors.strong};
`;

export default ShowcaseScreen;
