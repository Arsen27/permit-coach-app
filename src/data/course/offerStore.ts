import AsyncStorage from '@react-native-async-storage/async-storage';

// Remembers that the learner said "not now" to an opt-in course version, so
// the offer does not nag on every check. The decline is per version: a later
// opt-in release gets to ask once again. Accepting clears the record.

type DeclinedOffer = {
  courseId: string;
  version: string;
};

const key = (userId: string) => `dmv-prep/course-offer/v1/${userId}`;

export const loadDeclinedOffer = async (
  userId: string,
): Promise<DeclinedOffer | null> => {
  try {
    const raw = await AsyncStorage.getItem(key(userId));
    if (raw == null) {
      return null;
    }
    const parsed = JSON.parse(raw) as DeclinedOffer;
    return typeof parsed.courseId === 'string' &&
      typeof parsed.version === 'string'
      ? parsed
      : null;
  } catch {
    return null;
  }
};

export const saveDeclinedOffer = async (
  userId: string,
  declined: DeclinedOffer,
): Promise<void> => {
  await AsyncStorage.setItem(key(userId), JSON.stringify(declined)).catch(
    () => undefined,
  );
};

export const clearDeclinedOffer = async (userId: string): Promise<void> => {
  await AsyncStorage.removeItem(key(userId)).catch(() => undefined);
};
