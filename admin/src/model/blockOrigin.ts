import type { StateOrigins } from '@admin/api/types';

// Where a block of a state's course comes from.
//
// The block ids of a generated course carry the state's prefix; strip it and
// what is left is the bare id that both the skeleton and the state package key
// their material by. That mapping is the whole basis of the badge on the state
// screen, so it lives here as plain data logic rather than inside the component
// that draws it.

export type Origin = 'shared' | 'overridden' | 'own';

export const bareIdOf = (id: string, idPrefix: string): string =>
  id.startsWith(`${idPrefix}-`) ? id.slice(idPrefix.length + 1) : id;

export const originOf = (
  origins: StateOrigins | null,
  blockId: string | undefined,
): { origin: Origin; bareId: string } | null => {
  if (origins == null || blockId == null) {
    return null;
  }
  const bareId = bareIdOf(blockId, origins.idPrefix);
  // An override wins over "shared": the shared text no longer reaches here.
  if (origins.overriddenCards.includes(bareId)) {
    return { origin: 'overridden', bareId };
  }
  if (origins.sharedCards.includes(bareId)) {
    return { origin: 'shared', bareId };
  }
  return { origin: 'own', bareId };
};
