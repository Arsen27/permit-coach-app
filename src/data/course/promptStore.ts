import AsyncStorage from '@react-native-async-storage/async-storage';

import { UpdatePrompt } from './planner';

// At most one aggregated update prompt per user, persisted so a kill while
// the alert is on screen re-shows it on the next launch.

const KEY = 'dmv-prep/course-prompts/v1';

type PromptsByUser = Record<string, UpdatePrompt>;

const load = async (): Promise<PromptsByUser> => {
  try {
    const raw = await AsyncStorage.getItem(KEY);
    return raw != null ? (JSON.parse(raw) as PromptsByUser) : {};
  } catch {
    return {};
  }
};

export const loadPrompt = async (
  userId: string,
): Promise<UpdatePrompt | null> => (await load())[userId] ?? null;

export const savePrompt = async (prompt: UpdatePrompt): Promise<void> => {
  const prompts = await load();
  prompts[prompt.userId] = prompt;
  await AsyncStorage.setItem(KEY, JSON.stringify(prompts));
};

export const clearPrompt = async (userId: string): Promise<void> => {
  const prompts = await load();
  if (prompts[userId] != null) {
    delete prompts[userId];
    await AsyncStorage.setItem(KEY, JSON.stringify(prompts));
  }
};
