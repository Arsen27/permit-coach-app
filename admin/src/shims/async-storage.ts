// Defensive stub: nothing in the shared card renderer should reach persistent
// storage, but the alias keeps an accidental import from breaking the bundle.

const memory = new Map<string, string>();

const AsyncStorage = {
  getItem: async (key: string) => memory.get(key) ?? null,
  setItem: async (key: string, value: string) => {
    memory.set(key, value);
  },
  removeItem: async (key: string) => {
    memory.delete(key);
  },
  clear: async () => {
    memory.clear();
  },
  getAllKeys: async () => [...memory.keys()],
  getMany: async (keys: string[]) =>
    Object.fromEntries(keys.map(key => [key, memory.get(key) ?? null])),
  setMany: async (entries: Record<string, string>) => {
    for (const [key, value] of Object.entries(entries)) {
      memory.set(key, value);
    }
  },
  removeMany: async (keys: string[]) => {
    for (const key of keys) {
      memory.delete(key);
    }
  },
};

export default AsyncStorage;
