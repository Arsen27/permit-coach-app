import React from 'react';
import styled from 'styled-components/native';

import { NativeStackScreenProps } from '@react-navigation/native-stack';

import { track } from '@/analytics';

import { ONBOARDING_QUESTIONS, questionLadderIndex } from './content';
import { useOnboarding } from './context';
import { pushNextStep } from './flow';
import { OnboardingParamList } from './types';
import {
  ContinueDock,
  Kicker,
  OptionCard,
  StepHint,
  StepScreen,
  StepTitle,
} from './ui';

type QuestionScreenProps = NativeStackScreenProps<
  OnboardingParamList,
  'Question'
>;

const QuestionScreen: React.FC<QuestionScreenProps> = ({
  navigation,
  route,
}) => {
  const { answers, toggleOption, persistAnswers } = useOnboarding();
  const { index } = route.params;
  const question = ONBOARDING_QUESTIONS[index];
  const selected = answers[question.id] ?? [];
  const position = questionLadderIndex(index);

  const advance = () => {
    track('onboarding_question_answered', {
      question_id: question.id,
      question_index: index,
      option_ids: selected,
    });
    // The last question on the ladder is the point where the profile is
    // complete enough to save; the showcases collect nothing.
    if (index === ONBOARDING_QUESTIONS.length - 1) {
      persistAnswers();
    }
    pushNextStep(navigation, position);
  };

  return (
    <StepScreen>
      <Scroll showsVerticalScrollIndicator={false}>
        <Kicker>{question.kicker}</Kicker>
        <StepTitle style={{ marginTop: 8 }}>{question.title}</StepTitle>
        {question.hint != null && (
          <StepHint style={{ marginTop: 6 }}>{question.hint}</StepHint>
        )}
        <Options>
          {question.options.map(option => (
            <OptionCard
              key={option.id}
              label={option.label}
              sublabel={option.sublabel}
              icon={option.icon}
              tint={option.tint}
              level={option.level}
              multi={question.multi}
              selected={selected.includes(option.id)}
              onPress={() =>
                toggleOption(question.id, option.id, question.multi)
              }
            />
          ))}
        </Options>
      </Scroll>
      <ContinueDock disabled={selected.length === 0} onPress={advance} />
    </StepScreen>
  );
};

const Scroll = styled.ScrollView.attrs({
  contentContainerStyle: {
    paddingTop: 24,
    paddingHorizontal: 24,
    paddingBottom: 130,
  },
})`
  flex: 1;
`;

const Options = styled.View`
  margin-top: 22px;
  gap: 10px;
`;

export default QuestionScreen;
