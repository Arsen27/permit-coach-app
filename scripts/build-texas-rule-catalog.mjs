// Renders scripts/texas-rule-catalog.json from the compact rule definitions in
// scripts/texas-rule-catalog-rules.mjs. Every source is resolved to its local
// snapshot in the dmv-materials library (SHA-256 and size recorded), so the
// catalog can be re-verified against the exact files it was checked against.
//
// Usage: node scripts/build-texas-rule-catalog.mjs

import crypto from 'node:crypto';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

import { RULES } from './texas-rule-catalog-rules.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const MATERIALS = process.env.DMV_MATERIALS_ROOT || path.resolve(ROOT, '../dmv-materials');
const OUTPUT = path.join(ROOT, 'scripts/texas-rule-catalog.json');
const CHECKED_AT = '2026-09-05';
const COURSE_VERSION = 'TX-2026.09.05-r01';
const SNAPSHOT_DATE = '2026-08-10';

const sha256 = data => crypto.createHash('sha256').update(data).digest('hex');
const snapshotCache = new Map();
const snapshot = localFile => {
  if (!snapshotCache.has(localFile)) {
    const filename = path.join(MATERIALS, localFile);
    if (!fs.existsSync(filename)) throw new Error(`Missing snapshot ${localFile}`);
    const data = fs.readFileSync(filename);
    snapshotCache.set(localFile, { localSha256: sha256(data), localSizeBytes: data.byteLength });
  }
  return snapshotCache.get(localFile);
};

// The Texas MUTCD PDF (45 MB) lives only in the Mac library; its hash was taken
// there on 2026-09-05 with shasum -a 256.
const TMUTCD_PDF = {
  localFile: 'state-mutcd/Texas/Texas_MUTCD_2025_effective_2026-01-18.pdf',
  localSha256: '6f74a89c8f2c9f41a5785c45ab2b9d00a308d5bfdac93a13f130318b9b18be2a',
  localSizeBytes: 45509287,
};

const CODES = {
  TN: { name: 'Texas Transportation Code', prefix: 'TN' },
  PE: { name: 'Texas Penal Code', prefix: 'PE' },
  AL: { name: 'Texas Alcoholic Beverage Code', prefix: 'AL' },
};

export const resolveSource = source => {
  if (source.kind === 'statute') {
    const code = CODES[source.code];
    const chapter = source.section.split('.')[0];
    const localFile = `state-primary-law/Texas/${code.prefix}_CH${chapter}_official_current_${SNAPSHOT_DATE}.html`;
    return {
      citation: `${code.name} § ${source.section}${source.sub ? `(${source.sub})` : ''}`,
      officialUrl: `https://statutes.capitol.texas.gov/Docs/${code.prefix}/htm/${code.prefix}.${chapter}.htm#${source.section}`,
      checkedAt: CHECKED_AT,
      effectiveFrom: null,
      effectiveTo: null,
      rightsStatus: 'primary_authority_independent_explanation',
      localFile,
      retrievedAt: SNAPSHOT_DATE,
      ...snapshot(localFile),
      snapshotVerifiedAt: CHECKED_AT,
    };
  }
  if (source.kind === 'tmutcd') {
    return {
      citation: `Texas MUTCD 2025, Section ${source.section}`,
      officialUrl: 'https://ftp.txdot.gov/pub/txdot-info/trf/tmutcd/2025/2025_tmutcd.pdf',
      checkedAt: CHECKED_AT,
      effectiveFrom: '2026-01-18',
      effectiveTo: null,
      rightsStatus: 'official_traffic_control_standard_independent_explanation_no_logos',
      ...TMUTCD_PDF,
      retrievedAt: SNAPSHOT_DATE,
      snapshotVerifiedAt: CHECKED_AT,
    };
  }
  if (source.kind === 'handbook') {
    return {
      citation: `Texas Driver Handbook (DL-7), revised January 2026${source.topic ? ` — ${source.topic}` : ''}`,
      officialUrl: 'https://www.dps.texas.gov/internetforms/Forms/DL-7.pdf',
      checkedAt: CHECKED_AT,
      effectiveFrom: null,
      effectiveTo: null,
      rightsStatus: 'official_guidance_paraphrase_only_no_brand_assets',
      localFile: null,
      retrievedAt: null,
      localSha256: null,
      localSizeBytes: null,
      snapshotVerifiedAt: null,
      note: 'Handbook PDF not yet in the dmv-materials library; verify when state-driver-manuals/Texas/DL-7.pdf lands.',
    };
  }
  if (source.kind === 'txdmv') {
    const localFile = 'state-dmv-guidance/Texas/TXDMV_New_to_Texas_checked_2026-08-10.html';
    return {
      citation: 'Texas Department of Motor Vehicles — New to Texas',
      officialUrl: 'https://www.txdmv.gov/motorists/new-to-texas',
      checkedAt: CHECKED_AT,
      effectiveFrom: null,
      effectiveTo: null,
      rightsStatus: 'official_guidance_paraphrase_only_no_brand_assets',
      localFile,
      retrievedAt: SNAPSHOT_DATE,
      ...snapshot(localFile),
      snapshotVerifiedAt: CHECKED_AT,
    };
  }
  throw new Error(`Unknown source kind ${source.kind}`);
};

const rules = RULES.map(rule => ({
  ruleId: rule.ruleId,
  conceptId: rule.conceptId,
  jurisdiction: 'TX',
  ruleType: rule.ruleType ?? 'state-rule',
  legalClaim: rule.legalClaim ?? true,
  authoringRule: rule.authoringRule,
  valueType: rule.valueType ?? (Object.keys(rule.values ?? {}).length ? 'compound' : 'none'),
  values: rule.values ?? {},
  conditions: rule.conditions ?? [],
  exceptions: rule.exceptions ?? [],
  sources: rule.sources.map(resolveSource),
  status: rule.status ?? 'verified',
  ...(rule.reviewNote && { reviewNote: rule.reviewNote }),
  addedForVersion: COURSE_VERSION,
}));

const ids = new Set();
for (const rule of rules) {
  if (ids.has(rule.ruleId)) throw new Error(`Duplicate rule ${rule.ruleId}`);
  ids.add(rule.ruleId);
}

const catalog = {
  catalogId: `tx-rule-catalog-${COURSE_VERSION.toLowerCase()}`,
  jurisdiction: 'TX',
  targetLicense: 'ordinary non-commercial Class C passenger driver license',
  courseVersion: COURSE_VERSION,
  sourceCheckedAt: CHECKED_AT,
  rulesEffectiveThrough: null,
  legalFreshnessStatus: 'source_checked_effective_through_review_pending',
  status: 'ready_for_review',
  versionBindingStatus: 'bound',
  courseGenerationStatus: 'generated_from_catalog_rules',
  ruleCount: rules.length,
  allowedStatuses: ['verified', 'needs_review'],
  rules,
  snapshotLibrary: {
    materialsRoot: 'dmv-materials',
    verifiedAt: CHECKED_AT,
    note: 'Every statute and standard source lists the local snapshot file that backs it, with the SHA-256 and size of the snapshot at verification time. Paths are relative to the dmv-materials library root. Handbook sources are pending the DL-7 PDF.',
  },
};

fs.writeFileSync(OUTPUT, JSON.stringify(catalog, null, 2) + '\n');
console.log(`${rules.length} rules → ${path.relative(ROOT, OUTPUT)} (${rules.filter(r => r.status !== 'verified').length} needs_review)`);
