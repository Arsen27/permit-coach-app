// The admin stores are browser modules: the auth store reads localStorage the
// moment it is created. Model tests run under plain node, so this installs the
// smallest possible stand-in. Import it *before* any store.

const store = new Map<string, string>();

if (!('localStorage' in globalThis)) {
  Object.defineProperty(globalThis, 'localStorage', {
    value: {
      get length() {
        return store.size;
      },
      key: (index: number) => [...store.keys()][index] ?? null,
      getItem: (key: string) => store.get(key) ?? null,
      setItem: (key: string, value: string) => {
        store.set(key, String(value));
      },
      removeItem: (key: string) => {
        store.delete(key);
      },
      clear: () => {
        store.clear();
      },
    },
    configurable: true,
  });
}

export {};
