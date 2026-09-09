// Defensive stub, like the storage one: the shared card renderer reaches the
// app's asset store, which on a device keeps every picture as a file. The
// panel has no device file system and never needs one — it draws artwork
// from the admin API — so the file store answers "nothing here" and the
// bundle stays free of a native module.

const nothing = async () => undefined;

const ReactNativeBlobUtil = {
  fs: {
    dirs: { DocumentDir: '/content' },
    mkdir: nothing,
    ls: async () => [] as string[],
    exists: async () => false,
    readFile: async () => {
      throw new Error('no file store in the admin panel');
    },
    writeFile: nothing,
    unlink: nothing,
    mv: nothing,
    hash: async () => '',
  },
  config: () => ({
    fetch: async () => ({ info: () => ({ status: 0 }) }),
  }),
};

export default ReactNativeBlobUtil;
