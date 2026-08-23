import { NativeStackNavigationProp } from '@react-navigation/native-stack';

// New lessons keep the slide deck and lesson test separate. The same quiz
// engine also serves module tests and every practice mode.
export type QuizParams =
  | { mode: 'lessonTest'; lessonId: string }
  | { mode: 'moduleTest'; moduleId: string }
  | { mode: 'topic'; topicId: string }
  | { mode: 'quickMix' }
  | { mode: 'exam' }
  | { mode: 'signsQuiz' }
  | { mode: 'categoryQuiz'; categoryId: string }
  | { mode: 'saved' }
  | { mode: 'mistakes' };

export type RootStackParamList = {
  Onboarding: undefined;
  Tabs: undefined;
  Lesson: { lessonId: string };
  Theory: { lessonId: string };
  Quiz: QuizParams;
  SignCategory: { categoryId: string };
  SignDetail: { signId: string };
  StatePicker: undefined;
  FontPicker: undefined;
  // Which side of the form to open on; the screen can still switch modes.
  Auth: { mode?: 'signUp' | 'signIn' } | undefined;
  // 'daily' = the once-a-day gate presented it, 'manual' = the header chip.
  Streak: { source: 'daily' | 'manual' } | undefined;
};

export type TabParamList = {
  Learn: undefined;
  Practice: undefined;
  Signs: undefined;
  You: undefined;
};

export type RootNavigation = NativeStackNavigationProp<RootStackParamList>;
