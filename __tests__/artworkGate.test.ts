import { resetSvgAstsForTests, svgTreeWarm } from '@/components/CachedSvg';
import { artworkWarm, warmArtwork } from '@/data/assets/gate';
import { primeVectorsForTests, resetAssetsForTests } from '@/data/assets/store';
import { sha256Hex, utf8ByteLength } from '@/lib/sha256';

// The entry gate: a screen warms every picture it is about to show — bytes
// into memory, SVG trees built — before its first slide renders, so no
// transition inside pays a read or a parse.

const SVG = '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 10 10"/>';
const SHA = sha256Hex(SVG);
const REF = {
  sha256: SHA,
  mime: 'image/svg+xml',
  sizeBytes: utf8ByteLength(SVG),
};

beforeEach(() => {
  resetAssetsForTests();
  resetSvgAstsForTests();
});

it('a stored picture is cold until warmed, then free to draw', async () => {
  await primeVectorsForTests([[SHA, SVG]]);
  resetAssetsForTests(); // the restart: bytes on the device, memory empty
  const { hydrateAssets } = jest.requireActual('@/data/assets/store');
  await hydrateAssets();

  const spec = { ensure: [REF], inline: [] };
  expect(artworkWarm(spec)).toBe(false);

  await warmArtwork(spec);
  expect(artworkWarm(spec)).toBe(true);
  expect(svgTreeWarm(SHA)).toBe(true);
});

it('bundled markup is parsed at the door', async () => {
  const spec = { ensure: [], inline: [{ key: 'seed-stop', markup: SVG }] };
  expect(artworkWarm(spec)).toBe(false);

  await warmArtwork(spec);
  expect(artworkWarm(spec)).toBe(true);
});

it('a picture the device does not hold never blocks the gate', async () => {
  const missing = {
    sha256: sha256Hex('nowhere'),
    mime: 'image/svg+xml',
    sizeBytes: 64,
  };
  // Resolves — the download runs in the background; the learner is not
  // stared down by a skeleton that cannot end.
  await expect(
    warmArtwork({ ensure: [missing], inline: [] }),
  ).resolves.toBeUndefined();
});
