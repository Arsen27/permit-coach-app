// Enriches the verified California rule catalog with local-snapshot evidence:
// for every source citation it locates the snapshot file inside the
// dmv-materials library, records the relative path, SHA-256 and size, and a
// retrievedAt date parsed from the snapshot filename. The enriched catalog is
// written to scripts/california-rule-catalog.json and becomes the single
// catalog input for build-california-conversation-course.mjs.
//
// Snapshots that are not present locally (for example the very large MUTCD
// PDFs on a partial checkout) keep their previously recorded hash and are
// reported as "kept" instead of failing the run.
//
// Usage:
//   node scripts/enrich-california-rule-catalog.mjs
//   DMV_MATERIALS_ROOT=/path/to/dmv-materials node scripts/enrich-california-rule-catalog.mjs

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MATERIALS =
  process.env.DMV_MATERIALS_ROOT || path.resolve(ROOT, '../dmv-materials');
const INPUT = path.join(ROOT, 'scripts/california-rule-catalog.json');
const FALLBACK_INPUT = path.join(
  ROOT,
  'courses/California_DMV_Course_CA2026.08.22r02_CohesiveProse/rules/rule-catalog.json',
);
const OUTPUT = INPUT;

// The date the local snapshots were re-verified against this catalog. Update
// alongside a real re-verification, not automatically.
const SNAPSHOT_VERIFIED_AT = '2026-09-02';

const readJson = filename => JSON.parse(fs.readFileSync(filename, 'utf8'));
const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');

const PRIMARY_LAW_DIR = 'state-primary-law/California';
const listFiles = relativeDir => {
  const absolute = path.join(MATERIALS, relativeDir);
  if (!fs.existsSync(absolute)) return [];
  return fs
    .readdirSync(absolute)
    .filter(name => !name.startsWith('.'))
    .map(name => path.posix.join(relativeDir, name));
};

// CA_VEH_D11_CH02_21350-21468.html → range 21350–21468.
// CA_VEH_S4152_5_checked_2026-08-02.html → exact section 4152.5.
// CA_VEH_D06_7_CH02_15620.html → exact section 15620.
const parseSectionSpan = name => {
  let match = name.match(/_(\d+(?:_\d+)?)-(\d+(?:_\d+)?)\.(?:html|pdf)$/);
  if (match) {
    return {
      low: Number(match[1].replace('_', '.')),
      high: Number(match[2].replace('_', '.')),
    };
  }
  match = name.match(/_S(\d+(?:_\d+)?)_checked/);
  if (match) {
    const value = Number(match[1].replace('_', '.'));
    return { low: value, high: value };
  }
  match = name.match(/_CH\d+_(\d+)\.(?:html|pdf)$/);
  if (match) {
    const value = Number(match[1]);
    return { low: value, high: value };
  }
  return null;
};

const lawFiles = code =>
  listFiles(PRIMARY_LAW_DIR)
    .filter(file => path.basename(file).startsWith(`CA_${code}`))
    .map(file => ({ file, span: parseSectionSpan(path.basename(file)) }))
    .filter(entry => entry.span != null);

const findLawFile = (code, section) => {
  const value = Number(section);
  const candidates = lawFiles(code).filter(
    entry => entry.span.low <= value && value <= entry.span.high,
  );
  // Prefer an exact single-section snapshot, then HTML over PDF, then the
  // narrowest covering range.
  candidates.sort((left, right) => {
    const width = entry => entry.span.high - entry.span.low;
    const exact = entry => (width(entry) === 0 ? 0 : 1);
    const html = entry => (entry.file.endsWith('.html') ? 0 : 1);
    return (
      exact(left) - exact(right) ||
      html(left) - html(right) ||
      width(left) - width(right)
    );
  });
  return candidates[0]?.file ?? null;
};

// Non-statute sources map to a fixed snapshot each.
const FIXED_SNAPSHOTS = new Map([
  [
    'https://www.dmv.ca.gov/portal/driver-licenses-identification-cards/learners-permits/',
    'state-exam-guides/California/California_Learners_Permits_2026-08-01.html',
  ],
  [
    'https://www.dmv.ca.gov/portal/driver-licenses-identification-cards/driver-licenses-dl/',
    'state-exam-guides/California/CA_DMV_Drivers_Licenses_Knowledge_Test_Attempts_checked_2026-08-02.html',
  ],
]);
const CCR_SNAPSHOTS = new Map([
  ['20.03', 'state-dmv-regulations/California/CA_CCR_T13_S20_03_FullText.html'],
  ['20.02', 'state-dmv-regulations/California/CA_CCR_T13_S20_02_FullText.html'],
  ['15.02', 'state-dmv-regulations/California/CA_CCR_T13_S15_02_FullText.html'],
  ['15.03', 'state-dmv-regulations/California/CA_CCR_T13_S15_03_FullText.html'],
  ['50.45', 'state-dmv-regulations/California/CA_CCR_T13_S50_45_FullText.html'],
]);
const MUTCD_SNAPSHOT =
  'state-mutcd/California/California_MUTCD_2026_Complete.pdf';

// Hashes recorded from a verification pass against the full library, used
// when a run only has a partial local checkout (the MUTCD PDFs are large and
// are not copied everywhere). A run with the file present always re-hashes.
const KNOWN_SNAPSHOT_HASHES = new Map([
  [
    MUTCD_SNAPSHOT,
    {
      sha256:
        'a3a0ab0659672a5c0959d963849176f173d768147743b87d85d9eb398e2343d9',
      sizeBytes: 122143863,
      verifiedAt: '2026-08-22',
    },
  ],
  [
    'state-mutcd/California/California_MUTCD_2026_LA28_Supplement_effective_2026-07-15.pdf',
    {
      sha256:
        '6420b09e42dc99c73082854408d0954afac2605cdf7e9bd20c644760e608b60c',
      sizeBytes: 55080690,
      verifiedAt: '2026-08-22',
    },
  ],
]);

const retrievedAtFor = file => {
  const name = path.basename(file);
  const dated = name.match(/(?:checked|effective)_(\d{4}-\d{2}-\d{2})/);
  if (dated) return dated[1];
  const plain = name.match(/(\d{4}-\d{2}-\d{2})/);
  if (plain) return plain[1];
  // Bulk snapshots in the library were collected in the 2026-08-01 pass; see
  // the per-folder sources.md files.
  return '2026-08-01';
};

const snapshotFor = source => {
  const url = source.officialUrl ?? '';
  const citation = source.citation ?? '';
  if (FIXED_SNAPSHOTS.has(url)) return FIXED_SNAPSHOTS.get(url);
  if (/California Driver'?s Handbook/i.test(citation)) {
    return 'state-driver-manuals/California_Driver_Manual.pdf';
  }
  const leginfo = url.match(/lawCode=([A-Z]+)&sectionNum=([\d.]+)/);
  if (leginfo) {
    const code = leginfo[1];
    const section = leginfo[2].replace(/\.$/, '');
    if (code === 'VEH') return findLawFile('VEH', section);
    if (code === 'HSC' || code === 'BPC') {
      const flat = section.replace('.', '_');
      return (
        listFiles(PRIMARY_LAW_DIR).find(file =>
          path.basename(file).startsWith(`CA_${code}_S${flat}_`),
        ) ?? null
      );
    }
  }
  const ccr = citation.match(/California Code of Regulations § ([\d.]+)/);
  if (ccr) return CCR_SNAPSHOTS.get(ccr[1]) ?? null;
  if (/California MUTCD/.test(citation)) return MUTCD_SNAPSHOT;
  return null;
};

const inputPath = fs.existsSync(INPUT) ? INPUT : FALLBACK_INPUT;
const catalog = readJson(inputPath);
const stats = { hashed: 0, kept: 0, unmapped: [] };

for (const rule of catalog.rules) {
  for (const source of rule.sources ?? []) {
    const snapshot = snapshotFor(source);
    if (snapshot == null) {
      stats.unmapped.push(`${rule.ruleId}: ${source.citation}`);
      continue;
    }
    source.localFile = snapshot;
    source.retrievedAt = retrievedAtFor(snapshot);
    const absolute = path.join(MATERIALS, snapshot);
    if (fs.existsSync(absolute)) {
      const data = fs.readFileSync(absolute);
      source.localSha256 = sha256(data);
      source.localSizeBytes = data.byteLength;
      source.snapshotVerifiedAt = SNAPSHOT_VERIFIED_AT;
      stats.hashed += 1;
    } else if (source.localSha256) {
      stats.kept += 1;
    } else if (KNOWN_SNAPSHOT_HASHES.has(snapshot)) {
      const known = KNOWN_SNAPSHOT_HASHES.get(snapshot);
      source.localSha256 = known.sha256;
      source.localSizeBytes = known.sizeBytes;
      source.snapshotVerifiedAt = known.verifiedAt;
      stats.kept += 1;
    } else {
      stats.unmapped.push(
        `${rule.ruleId}: snapshot missing locally (${snapshot})`,
      );
    }
  }
}

catalog.snapshotLibrary = {
  materialsRoot: 'dmv-materials',
  verifiedAt: SNAPSHOT_VERIFIED_AT,
  note: 'Every source lists the local snapshot file that backs it, with the SHA-256 and size of the snapshot at verification time. Paths are relative to the dmv-materials library root.',
};

fs.writeFileSync(OUTPUT, JSON.stringify(catalog, null, 2) + '\n');
console.log(
  JSON.stringify(
    {
      input: path.relative(ROOT, inputPath),
      output: path.relative(ROOT, OUTPUT),
      rules: catalog.rules.length,
      sourcesHashed: stats.hashed,
      sourcesKeptPriorHash: stats.kept,
      unmapped: stats.unmapped,
    },
    null,
    2,
  ),
);
if (stats.unmapped.length > 0) {
  process.exitCode = 1;
}
