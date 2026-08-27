import AsyncStorage from '@react-native-async-storage/async-storage';

import { createLogger, formatBytes } from '@/lib/log';

// Named signsData.json (not signs.json) because Metro resolves `./signs` to a
// .json file before a .ts one — the data would shadow the module.
import rawSigns from './signsData.json';
import { Sign, SignCategory, SignsDoc, validateSignsDoc } from './wire';

// Device store for the signs catalogue. Same shape and guarantees as the
// course store, scaled down to a single document: the bundled seed serves
// synchronously until a server version has been committed (the seed itself is
// never written to AsyncStorage), and a commit stages the doc, re-reads and
// verifies it, then flips the meta pointer last — a kill at any point leaves
// a consistent catalogue.

const PREFIX = 'dmv-prep/signs/v1';
const META_KEY = `${PREFIX}/meta`;
const docKey = (semver: string) => `${PREFIX}/${semver}/doc`;

type Meta = { deliveryVersion: string };

// The snapshot carries its derived indexes so every consumer — screens, the
// quiz generator, the practice bank — reads the same committed catalogue
// without rebuilding lookups per call.
export type SignsCatalog = {
  deliveryVersion: string;
  categories: SignCategory[];
  signs: Sign[];
  categoriesById: Map<string, SignCategory>;
  signsById: Map<string, Sign>;
  signsByCategoryId: Map<string, Sign[]>;
};

const log = createLogger('signs');

const toCatalog = (doc: SignsDoc): SignsCatalog => {
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
    deliveryVersion: doc.deliveryVersion,
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
// a build-time mistake, so it throws — there is no earlier version to fall
// back to.
const seedResult = validateSignsDoc(rawSigns);
if (!seedResult.ok) {
  throw new Error(
    `bundled signs catalogue is invalid: ${seedResult.errors.join('; ')}`,
  );
}
const seedCatalog = toCatalog(seedResult.value);

let snapshot: SignsCatalog = seedCatalog;
let hydrated = false;
let hydrating: Promise<void> | null = null;
const listeners = new Set<() => void>();

const notify = () => {
  listeners.forEach(listener => listener());
};

// Removes every version other than the one being kept, best-effort.
const sweep = async (keepSemver: string | null): Promise<void> => {
  const keys = (await AsyncStorage.getAllKeys()).filter(
    key =>
      key.startsWith(`${PREFIX}/`) &&
      key !== META_KEY &&
      (keepSemver == null || key !== docKey(keepSemver)),
  );
  if (keys.length > 0) {
    await AsyncStorage.removeMany(keys);
  }
};

const hydrateOnce = async (): Promise<void> => {
  let committedSemver: string | null = null;
  try {
    const rawMeta = await AsyncStorage.getItem(META_KEY);
    if (rawMeta != null) {
      const meta = JSON.parse(rawMeta) as Meta;
      const body = await AsyncStorage.getItem(docKey(meta.deliveryVersion));
      if (body != null) {
        // Full validation on every hydrate, not just on download: a doc this
        // small re-validates in microseconds, and it means a catalogue the
        // running app serves is always one the validator has passed.
        const parsed = validateSignsDoc(JSON.parse(body), {
          deliveryVersion: meta.deliveryVersion,
        });
        if (!parsed.ok) {
          throw new Error(`stored doc invalid: ${parsed.errors[0]}`);
        }
        snapshot = toCatalog(parsed.value);
        committedSemver = meta.deliveryVersion;
        log.info(`hydrated signs@${meta.deliveryVersion} from storage`, {
          categories: snapshot.categories.length,
          signs: snapshot.signs.length,
        });
      } else {
        log.warn(
          `corrupted signs store @${meta.deliveryVersion}: doc missing — falling back to the seed`,
        );
        await AsyncStorage.removeItem(META_KEY);
      }
    } else {
      log.info(
        `no committed signs version — serving the bundled seed ${seedCatalog.deliveryVersion}`,
      );
    }
  } catch (error) {
    log.error('hydrate signs failed — falling back to the bundled seed', error);
    snapshot = seedCatalog;
    await AsyncStorage.removeItem(META_KEY).catch(() => undefined);
  }
  hydrated = true;
  notify();
  sweep(committedSemver).catch(() => undefined);
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
  // bytes the manifest hash covered.
  commit: async (doc: SignsDoc, body: string): Promise<void> => {
    const elapsed = log.time();
    const key = docKey(doc.deliveryVersion);
    await AsyncStorage.setItem(key, body);
    const reread = await AsyncStorage.getItem(key);
    if (reread !== body) {
      await AsyncStorage.removeItem(key).catch(() => undefined);
      throw new Error(`staged signs doc verification failed for ${key}`);
    }
    const meta: Meta = { deliveryVersion: doc.deliveryVersion };
    await AsyncStorage.setItem(META_KEY, JSON.stringify(meta));
    snapshot = toCatalog(doc);
    log.info(
      `committed signs@${doc.deliveryVersion} (${formatBytes(
        body.length,
      )}, ${elapsed()}ms)`,
      { categories: snapshot.categories.length, signs: snapshot.signs.length },
    );
    notify();
    sweep(doc.deliveryVersion).catch(() => undefined);
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
