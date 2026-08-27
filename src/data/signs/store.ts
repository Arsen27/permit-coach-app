import AsyncStorage from '@react-native-async-storage/async-storage';

import { createLogger, formatBytes } from '@/lib/log';
import { sha256Hex } from '@/lib/sha256';

// Named signsData.json (not signs.json) because Metro resolves `./signs` to a
// .json file before a .ts one — the data would shadow the module.
import rawSigns from './signsData.json';
import { Sign, SignCategory, SignsDoc, validateSignsDoc } from './wire';

// Device store for the signs catalogue. The bundled seed serves synchronously
// until a downloaded document has been committed (the seed itself is never
// written to AsyncStorage), and a commit stages the doc, re-reads and verifies
// it, then flips the meta pointer last — a kill at any point leaves a
// consistent catalogue.
//
// The catalogue is not versioned: a document's sha256 is its identity, so
// "what do I have" and "what is published" compare as bytes.

const PREFIX = 'dmv-prep/signs/v1';
const META_KEY = `${PREFIX}/meta`;
const docKey = (sha256: string) => `${PREFIX}/${sha256}/doc`;

type Meta = { sha256: string };

// The snapshot carries its derived indexes so every consumer — screens, the
// quiz generator, the practice bank — reads the same committed catalogue
// without rebuilding lookups per call.
export type SignsCatalog = {
  sha256: string;
  categories: SignCategory[];
  signs: Sign[];
  categoriesById: Map<string, SignCategory>;
  signsById: Map<string, Sign>;
  signsByCategoryId: Map<string, Sign[]>;
};

const log = createLogger('signs');

const toCatalog = (doc: SignsDoc, sha256: string): SignsCatalog => {
  const signsByCategoryId = new Map<string, Sign[]>();
  for (const sign of doc.signs) {
    const bucket = signsByCategoryId.get(sign.categoryId);
    if (bucket == null) {
      signsByCategoryId.set(sign.categoryId, [sign]);
    } else {
      bucket.push(sign);
    }
  }
  return {
    sha256,
    categories: doc.categories,
    signs: doc.signs,
    categoriesById: new Map(doc.categories.map(c => [c.id, c])),
    signsById: new Map(doc.signs.map(s => [s.id, s])),
    signsByCategoryId,
  };
};

// The bundled catalogue goes through the same validator an authored document
// would: the seed is content like any other, and a cast here is exactly the
// kind of unchecked trust the wire format exists to remove. A broken seed is
// a build-time mistake, so it throws — there is nothing earlier to fall back
// to.
const seedResult = validateSignsDoc(rawSigns);
if (!seedResult.ok) {
  throw new Error(
    `bundled signs catalogue is invalid: ${seedResult.errors.join('; ')}`,
  );
}
// Hashed over the same shape the server publishes, so a device running the
// seed and a device that downloaded an identical document agree.
const seedCatalog = toCatalog(
  seedResult.value,
  sha256Hex(JSON.stringify(seedResult.value)),
);

let snapshot: SignsCatalog = seedCatalog;
let hydrated = false;
let hydrating: Promise<void> | null = null;
const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach(listener => listener());
};

// Removes every document other than the one being kept, best-effort.
const sweep = async (keep: string | null): Promise<void> => {
  const keys = (await AsyncStorage.getAllKeys()).filter(
    key =>
      key.startsWith(`${PREFIX}/`) &&
      key !== META_KEY &&
      (keep == null || key !== docKey(keep)),
  );
  if (keys.length > 0) {
    await AsyncStorage.removeMany(keys);
  }
};

const hydrateOnce = async (): Promise<void> => {
  let committed: string | null = null;
  try {
    const rawMeta = await AsyncStorage.getItem(META_KEY);
    if (rawMeta != null) {
      const meta = JSON.parse(rawMeta) as Meta;
      const body = await AsyncStorage.getItem(docKey(meta.sha256));
      if (body != null) {
        // Re-hash on hydrate, not just on download: the stored bytes are the
        // bytes the hash covered, so a truncated or tampered document is
        // caught before it ever renders.
        if (sha256Hex(body) !== meta.sha256) {
          throw new Error('stored doc does not match its hash');
        }
        const parsed = validateSignsDoc(JSON.parse(body));
        if (!parsed.ok) {
          throw new Error(`stored doc invalid: ${parsed.errors[0]}`);
        }
        snapshot = toCatalog(parsed.value, meta.sha256);
        committed = meta.sha256;
        log.info(`hydrated signs ${meta.sha256.slice(0, 12)} from storage`, {
          categories: snapshot.categories.length,
          signs: snapshot.signs.length,
        });
      } else {
        log.warn('corrupted signs store: doc missing — falling back to seed');
        await AsyncStorage.removeItem(META_KEY);
      }
    } else {
      log.info('no committed signs document — serving the bundled seed');
    }
  } catch (error) {
    log.error('hydrate signs failed — falling back to the bundled seed', error);
    snapshot = seedCatalog;
    await AsyncStorage.removeItem(META_KEY).catch(() => undefined);
  }
  hydrated = true;
  notify();
  sweep(committed).catch(() => undefined);
};

export const signsStore = {
  getSnapshot: (): SignsCatalog => snapshot,
  isHydrated: (): boolean => hydrated,
  hydrate: (): Promise<void> => {
    if (hydrating == null) {
      hydrating = hydrateOnce();
    }
    return hydrating;
  },
  // `body` is the exact wire bytes the updater hash-verified; persisting that
  // string (rather than re-serializing `doc`) keeps the stored copy the same
  // bytes the hash covered.
  commit: async (
    doc: SignsDoc,
    body: string,
    sha256: string,
  ): Promise<void> => {
    const elapsed = log.time();
    const key = docKey(sha256);
    await AsyncStorage.setItem(key, body);
    const reread = await AsyncStorage.getItem(key);
    if (reread !== body) {
      await AsyncStorage.removeItem(key).catch(() => undefined);
      throw new Error(`staged signs doc verification failed for ${key}`);
    }
    const meta: Meta = { sha256 };
    await AsyncStorage.setItem(META_KEY, JSON.stringify(meta));
    snapshot = toCatalog(doc, sha256);
    log.info(
      `committed signs ${sha256.slice(0, 12)} (${formatBytes(
        body.length,
      )}, ${elapsed()}ms)`,
      { categories: snapshot.categories.length, signs: snapshot.signs.length },
    );
    notify();
    sweep(sha256).catch(() => undefined);
  },
  subscribe: (listener: () => void): (() => void) => {
    listeners.add(listener);
    return () => {
      listeners.delete(listener);
    };
  },
  // Unlike the course store, listeners survive a reset: index.ts subscribes
  // once per process to keep its live-binding exports in step, and clearing
  // that subscription would silently freeze them on whatever was last served.
  // Notifying instead re-syncs every consumer to the seed.
  resetForTests: (): void => {
    snapshot = seedCatalog;
    hydrated = false;
    hydrating = null;
    notify();
  },
};
