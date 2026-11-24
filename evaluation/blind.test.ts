import { execFileSync } from 'node:child_process';
import { createHash } from 'node:crypto';
import { mkdirSync, mkdtempSync, readFileSync, renameSync, rmSync, writeFileSync } from 'node:fs';
import { createRequire } from 'node:module';
import { join, resolve } from 'node:path';
import { afterAll, beforeAll, expect, test, vi } from 'vitest';
import { HISTORICAL_CASES } from '../src/data/cases';
import { CRAFTS } from '../src/data/crafts';
import { DECISION_CATALOG } from '../src/data/decisionCatalog';
import { FABRICS } from '../src/data/fabrics';
import { PATTERNS } from '../src/data/patterns';
import { SCENES } from '../src/data/scenes';
import { matchDecision } from '../src/engine/decisionMatching';
import {
  appendDecisionVersion, emptyDecisionHistory, previewDecisionRevision, recordDecisionRevision,
} from '../src/engine/decisionRevisions';
import { buildDecisionVersion, decisionInput, decisionPresentation } from '../src/engine/decisionVersion';
import { buildLedgerRecordFromSession, loadLedgerRecords, saveLedgerRecords } from '../src/engine/ledgerStore';
import { buildLocalDecisionRequirement } from '../src/engine/requirementInterview';
import type { CandidateCombination, DecisionHistory, DecisionRequirement, MatchResult, Version } from '../src/types/decisions';
import type {
  ConfigurationState, CraftAsset, DeconstructedRequirement, FabricAsset, FeasibilityNotice,
  PatternAsset, RequirementInput, SceneEnvironment, HistoricalCaseAsset,
} from '../src/types/sartoria';
import { buildDecisionExport, buildDecisionMarkdown } from '../src/utils/decisionHandoff';
import { fixtures, type CatalogExpectation, type Fixture, type FixtureTurn, type Triple } from './fixtures';
import { holdout } from './holdout';
import { HOLDOUT2_FIXTURES } from './holdout2';
import { HOLDOUT3_FIXTURES } from './holdout3';
import { freeTextFixtures } from './freeText20261124';
import { postRepairFixtures } from './postRepairBlind';

const BASELINE = '4e0d95921683fd04cf7834b754b02687d73d56a6';
const FROZEN_SHA256 = '731df75840720f873ffd0846fbbaac0ebb7d0ca13716d8a42bb51f3d7239943a';
const HOLDOUT_SHA256 = 'a053040ea829964de4bd6f62239aef063c89876dfb31ff8cb40677e3db0180f2';
const HOLDOUT2_SHA256 = '3cb9a202d55270895d783c2a5705078dac778b8dc717a1f6e40fbf3d092791bc';
const HOLDOUT3_SHA256 = '87975f8f6146c78f54fcb85594ef10b787c1127a5b0d5bc322522de6c59f27b9';
const FREE_TEXT_SHA256 = 'c9144cd09a54ec7ffd43c91180ab29fdaeabb54c83169fe33dfd019eb4660916';
const POST_REPAIR_SHA256 = 'd87bf1751d2d9d5d15b1a395aa74564d1fc6ba4952767732f203721959c888e2';
const RUN_TIME = '2026-11-24T00:00:00.000Z';
const gitArgs = ['-c', `safe.directory=${resolve('.').replaceAll('\\', '/')}`];

const releaseMode = (import.meta as ImportMeta & { env?: { MODE?: string } }).env?.MODE === 'release';
const releaseSha = process.env.SARTORIA_RELEASE_SHA ?? (releaseMode
  ? execFileSync('git', [...gitArgs, 'rev-parse', 'HEAD'], { encoding: 'utf8' }).trim()
  : undefined);
const releaseSuites = [
  { id: '1', fixtures: holdout, source: 'holdout.ts', hash: HOLDOUT_SHA256, report: `release-${releaseSha}.json`,
    assumeNoConflictsWhenOmitted: true },
  { id: '2', fixtures: HOLDOUT2_FIXTURES, source: 'holdout2.ts', hash: HOLDOUT2_SHA256, report: `release-2-${releaseSha}.json`,
    assumeNoConflictsWhenOmitted: false },
  { id: '3', fixtures: HOLDOUT3_FIXTURES, source: 'holdout3.ts', hash: HOLDOUT3_SHA256, report: `release-3-${releaseSha}.json`,
    assumeNoConflictsWhenOmitted: false },
  { id: '4', fixtures: freeTextFixtures, source: 'freeText20261124.ts', hash: FREE_TEXT_SHA256, report: `release-4-${releaseSha}.json`,
    assumeNoConflictsWhenOmitted: false },
  { id: '5', fixtures: postRepairFixtures, source: 'postRepairBlind.ts', hash: POST_REPAIR_SHA256, report: `release-5-${releaseSha}.json`,
    assumeNoConflictsWhenOmitted: false },
];
const requestedSuite = process.env.SARTORIA_RELEASE_SUITE;
if (releaseSha !== undefined && requestedSuite !== undefined && !releaseSuites.some(({ id }) => id === requestedSuite)) {
  throw new Error(`SARTORIA_RELEASE_SUITE must be one of ${releaseSuites.map(({ id }) => id).join(', ')}.`);
}
const suites = releaseSha === undefined
  ? [{ id: 'historical', fixtures, source: 'fixtures.ts', hash: FROZEN_SHA256, report: 'report.json',
    assumeNoConflictsWhenOmitted: true }]
  : releaseSuites.filter(({ id }) => requestedSuite === undefined || requestedSuite === id);

function verifyReleaseSource(expectedSha: string) {
  expect(expectedSha).toMatch(/^[0-9a-f]{40}$/);
  const pinned = execFileSync('git', [...gitArgs, 'rev-parse', '--verify', `${expectedSha}^{commit}`],
    { encoding: 'utf8' }).trim();
  expect(pinned).toBe(expectedSha);
  const releaseInputs = [
    'src', 'package.json', 'package-lock.json', 'vite.config.ts', 'tsconfig*.json',
    'evaluation/blind.test.ts', 'evaluation/fixtures.ts', ...releaseSuites.map(({ source }) => `evaluation/${source}`),
  ];
  const differences = execFileSync('git', [...gitArgs, 'diff', '--name-only', expectedSha, '--', ...releaseInputs],
    { encoding: 'utf8' });
  const untracked = execFileSync('git', [...gitArgs, 'ls-files', '--others', '--exclude-standard', '--', ...releaseInputs],
    { encoding: 'utf8' });
  expect(differences + untracked, 'Release source, dependencies, and evaluation inputs must match the pinned commit.').toBe('');
}

type Catalog = {
  patterns: PatternAsset[];
  fabrics: FabricAsset[];
  crafts: CraftAsset[];
  scenes: SceneEnvironment[];
  cases: HistoricalCaseAsset[];
};

function scratchInput(projectName: string, rawNarrative: string): RequirementInput {
  return {
    projectName, rawNarrative, clientName: '', businessType: 'private_couture',
    season: 'all_season', groupSize: '', targetSceneId: '',
  };
}

function loadBaseline(cache: string) {
  const source = join(cache, 'source');
  const compiled = join(cache, 'cjs');
  const archive = join(cache, 'source.tar');
  mkdirSync(source, { recursive: true });
  mkdirSync(compiled, { recursive: true });
  const gitRoot = resolve('.').replaceAll('\\', '/');
  const oldSource = [
    'src/engine/deconstructEngine.ts', 'src/engine/matchingEngine.ts', 'src/data', 'src/types',
  ];
  execFileSync('git', ['-c', `safe.directory=${gitRoot}`, 'archive', '--format=tar', `--output=${archive}`, BASELINE, ...oldSource]);
  execFileSync('tar', ['-xf', archive, '-C', source]);

  const commonJs = '{"type":"commonjs"}';
  writeFileSync(join(source, 'package.json'), commonJs);
  writeFileSync(join(compiled, 'package.json'), commonJs);
  const compiler = resolve('node_modules/typescript/bin/tsc');
  const tsconfig = join(source, 'tsconfig.json');
  writeFileSync(tsconfig, JSON.stringify({
    compilerOptions: {
      target: 'es2022', module: 'nodenext', rootDir: '.', outDir: compiled, noCheck: true,
    },
    include: ['src/**/*.ts'],
  }));
  execFileSync(process.execPath, [compiler, '-p', tsconfig]);
  const load = createRequire(join(compiled, 'package.json'));
  return {
    deconstruct: load('./src/engine/deconstructEngine.js').deconstructLocally as
      (input: RequirementInput) => DeconstructedRequirement,
    matching: load('./src/engine/matchingEngine.js') as {
      recommendInitialConfig: (input: RequirementInput, result: DeconstructedRequirement) => ConfigurationState;
      evaluateFeasibility: (input: RequirementInput, config: ConfigurationState, result: DeconstructedRequirement) => FeasibilityNotice[];
    },
    catalog: {
      patterns: load('./src/data/patterns.js').PATTERNS,
      fabrics: load('./src/data/fabrics.js').FABRICS,
      crafts: load('./src/data/crafts.js').CRAFTS,
      scenes: load('./src/data/scenes.js').SCENES,
      cases: load('./src/data/cases.js').HISTORICAL_CASES,
    } as Catalog,
  };
}

const reportDirectory = resolve('node_modules/.cache/sartoria-baseline');
let scratch: { path: string; remove: () => void };
let baseline: ReturnType<typeof loadBaseline>;
beforeAll(() => {
  mkdirSync(reportDirectory, { recursive: true });
  const dir = mkdtempSync(join(reportDirectory, 'run-'));
  scratch = { path: dir, remove: () => rmSync(dir, { recursive: true, force: true }) };
  baseline = loadBaseline(scratch.path);
});
afterAll(() => scratch?.remove());

const tripleKey = ({ field, op, value }: Triple) => JSON.stringify([field, op, value]);
const hard = (requirement: DecisionRequirement) => requirement.constraints.filter((item) =>
  item.level === 'hard' && item.state !== 'unknown' && item.value !== null,
);
const sameSet = (left: readonly string[], right: readonly string[]) =>
  JSON.stringify([...new Set(left)].sort()) === JSON.stringify([...new Set(right)].sort());

const sceneTypes: Readonly<Record<string, readonly string[] | undefined>> = {
  'scene-bund-banquet': ['formal_evening', 'indoor_formal'],
  'scene-bund-protocol': ['indoor_formal'],
  'scene-jingan-salon': ['indoor_formal', 'indoor_performance'],
  'scene-lujiazui-summit': ['indoor_formal'],
  'scene-outdoor-stage': ['outdoor_stage'],
};
const knownSceneTypes = new Set(Object.values(sceneTypes).flatMap((types) => types ?? []));

function auditSceneValue(sceneId: string, requested: Triple['value'], scenes: readonly SceneEnvironment[]) {
  if (typeof requested !== 'string' || !scenes.some(({ id }) => id === sceneId)) return undefined;
  if (scenes.some(({ id }) => id === requested)) return sceneId === requested;
  return knownSceneTypes.has(requested) ? sceneTypes[sceneId]?.includes(requested) : undefined;
}

function scoredTripleKey(triple: Triple, scenes: readonly SceneEnvironment[] = SCENES) {
  if (triple.field !== 'scene') return tripleKey(triple);
  const allowed = scenes.filter(({ id }) => auditSceneValue(id, triple.value, scenes) === (triple.op === 'eq'))
    .map(({ id }) => id).sort();
  // Identical nonempty sets give the same result for every catalog combination's venue.
  return allowed.length ? JSON.stringify([triple.field, triple.op, allowed]) : tripleKey(triple);
}

function hardScore(gold: readonly Triple[], predicted: readonly Triple[], keyFor = tripleKey) {
  const expected = new Map(gold.map((entry) => [keyFor(entry), entry]));
  const observed = new Map(predicted.map((entry) => [keyFor(entry), entry]));
  const missed = [...expected].filter(([key]) => !observed.has(key)).map(([, item]) => item);
  const extra = [...observed].filter(([key]) => !expected.has(key)).map(([, item]) => item);
  return { tp: expected.size - missed.length, fp: extra.length, fn: missed.length, missed, extra };
}

function normalizeBaseline(deconstructed: DeconstructedRequirement) {
  const triples: Triple[] = [];
  const ambiguous: string[] = [];
  for (const { key, value, provenance } of deconstructed.officialSpecs) {
    if (provenance !== 'user_explicit') continue;
    let normalized: string | undefined;
    if (key === 'category') {
      normalized = /^两件式套装/.test(value) ? 'two_piece' : /^团体职业套装/.test(value) ? 'suit'
        : /^高端海派定制长礼服$/.test(value) ? 'dress' : /^外套$/.test(value) ? 'jacket' : undefined;
    } else if (key === 'color') {
      normalized = /^深邃墨黛黑底/.test(value) ? 'obsidian' : /^月白烟青浅色系/.test(value) ? 'ivory' : undefined;
    } else if (key === 'motif') {
      normalized = /暗花纹样/.test(value) ? 'subtle_jacquard' : undefined;
    }
    if (normalized) triples.push({ field: key, op: 'eq', value: normalized });
    else ambiguous.push(key);
  }
  return { triples, ambiguous };
}

function manualEffort(score: ReturnType<typeof hardScore>, ambiguous: readonly string[] = []) {
  const corrections = new Set([...score.extra.map(({ field }) => field), ...ambiguous]);
  const missing = new Set(score.missed.map(({ field }) => field).filter((field) => !corrections.has(field)));
  return { corrections: corrections.size, missing: missing.size };
}

function legacyFabricType(fabric: FabricAsset) {
  if (/丝绒/.test(fabric.weave)) return 'velvet';
  if (/三醋酸/.test(fabric.composition)) return 'acetate';
  if (/100%.*羊毛/.test(fabric.composition)) return 'wool';
  if (/100%.*桑蚕丝/.test(fabric.composition)) return 'silk';
  if (/\d+%.*\/.*\d+%/.test(fabric.composition)) return 'blend';
  return null;
}

function auditConfig(config: ConfigurationState, gold: readonly Triple[], catalog: Catalog, old: boolean) {
  const pat = catalog.patterns.find(({ id }) => id === config.patternId);
  const fab = catalog.fabrics.find(({ id }) => id === config.fabricId);
  const crf = config.craftIds.map((id) => catalog.crafts.find((entry) => entry.id === id));
  const scene = catalog.scenes.find(({ id }) => id === config.sceneId);
  const unknownId = !pat || !fab || !scene || crf.some((entry) => !entry);
  if (!pat || !fab) return { unknownId, violations: [], unknowns: [] };
  const pp = old ? undefined : DECISION_CATALOG.patterns.find(({ asset }) => asset.id === pat.id)?.profile;
  const fp = old ? undefined : DECISION_CATALOG.fabrics.find(({ asset }) => asset.id === fab.id)?.profile;
  const sketch = pat.blueprintConfig;
  const patternKind = sketch.silhouetteType.startsWith('jacket_') ? 'jacket'
    : sketch.silhouetteType.startsWith('suit_') ? 'suit' : sketch.silhouetteType.startsWith('gown_') ? 'dress'
      : sketch.silhouetteType === 'stage_two_piece' ? 'two_piece' : null;
  const legacyCollars = sketch.collarStyle.startsWith('mandarin') ? ['stand']
    : /lapel|shawl/.test(sketch.collarStyle) ? ['lapel'] : sketch.collarStyle.startsWith('cross') ? ['cross_open'] : ['diagonal'];
  const fabricCare = fp?.care ?? (/专业.*干洗/.test(fab.careAndMoqNote) ? 'dry_clean' : null);
  const craftCare = config.craftIds.map((id) => DECISION_CATALOG.crafts.find(({ asset }) => asset.id === id)?.profile.care ?? null);
  const hideButtons = ['open_no_buttons', 'hidden_placket'].includes(sketch.closureStyle);
  const vals: Readonly<Record<string, Triple['value'] | readonly Triple['value'][]>> = {
    businessType: pat.businessType,
    season: pat.seasonFit.includes('all_season') ? fab.seasons :
      fab.seasons.includes('all_season') ? pat.seasonFit : pat.seasonFit.filter((season) => fab.seasons.includes(season)),
    category: pp?.category ?? patternKind,
    patternStructure: pp?.patternStructure ?? (pat.silhouette.includes('H 型直身') ? 'h_line' : patternKind === 'two_piece' ? 'two_piece' : null),
    collar: pp?.collars ?? legacyCollars,
    fabric: fp?.fabric ?? legacyFabricType(fab),
    color: fab.colorFamily === 'neutral_silk' ? null : fab.colorFamily,
    motif: fp?.motif ?? null,
    lengthRatio: pp?.lengthRatio ?? (sketch.hemLength === 'ankle_two_piece' ? 'ankle' : sketch.hemLength),
    easeAllowance: pp?.easeAllowance ?? (/抬手|抬臂/.test(pat.easeAllowance) ? 'arm_mobility' : null),
    closure: hideButtons ? 'no_visible_buttons' : 'visible_buttons',
    care: fabricCare,
    luster: fp?.luster ?? (/哑光/.test(fab.luster) ? 'low' : fab.luster === '高雅丝光' ? 'high' : 'medium'),
    wrinkleResistance: fp?.wrinkleResistance ?? (/抗皱回弹|抗皱回复/.test(fab.description) ? true : null),
    style: pp?.style ?? (patternKind === 'suit' && pat.id === 'pat-minimal-unstructured-blazer' ? 'modern' : null),
    craft: config.craftIds,
  };
  const violations = new Set<string>();
  const unknowns = new Set<string>();
  for (const constraint of gold) {
    const { field, value, op } = constraint;
    if (field === 'scene') {
      const matches = auditSceneValue(config.sceneId, value, catalog.scenes);
      if (matches === undefined) unknowns.add(field);
      else if (matches !== (op === 'eq')) violations.add(field);
      continue;
    }
    if (field === 'quantity' && typeof value === 'number') {
      const ranges = [pp?.quantity, fp?.quantity];
      if (op === 'eq') {
        if (ranges.some((range) => range && (value < range[0] || value > range[1]))) violations.add(field);
      } else {
        const ordered = gold.find((label) => label.field === 'quantity' && label.op === 'eq');
        if (ordered?.value === value || ranges.some((range) => range && range[0] === value && range[1] === value)) {
          violations.add(field);
        } else if (!ordered && ranges.some((range) => range && range[0] <= value && value <= range[1])) {
          unknowns.add(field);
        }
      }
      if (ranges.some((range) => !range)) unknowns.add(field);
      continue;
    }
    const represented = vals[field];
    if (represented == null) {
      unknowns.add(field);
      continue;
    }
    const matches = Array.isArray(represented)
      ? represented.includes(value) || (field === 'season' && represented.includes('all_season'))
      : represented === value;
    if (op === 'eq' ? !matches : matches) violations.add(field);
    if (!old && field === 'care') {
      if (craftCare.some((method) => method && (op === 'eq' ? method !== value : method === value))) violations.add(field);
      if (craftCare.includes(null) || (value === 'machine_wash' && craftCare.length === 0)) unknowns.add(field);
    }
  }
  if (!fab.suitableBusiness.includes(pat.businessType)) violations.add('businessCompatibility');
  if (!pat.suitableScenes.includes(config.sceneId) || !fab.suitableScenes.includes(config.sceneId)) violations.add('sceneCompatibility');
  if (fp && !fp.compatiblePatternIds.includes(pat.id)) violations.add('patternFabricCompatibility');
  if (crf.some((entry) => entry && !entry.compatibleFabrics.includes(fab.weave))) violations.add('craftCompatibility');
  return { unknownId, violations: [...violations].sort(), unknowns: [...unknowns].sort() };
}

test('audits named venues by identity and equates only the same eligible venue set', () => {
  const catalog = { patterns: PATTERNS, fabrics: FABRICS, crafts: CRAFTS, scenes: SCENES, cases: HISTORICAL_CASES };
  const stageConfig: ConfigurationState = {
    patternId: 'pat-official-stage-twopiece', fabricId: 'fab-official-ivory-rose-stage', craftIds: [],
    sceneId: 'scene-outdoor-stage', activeView: 'scene_look', focusedHotspotId: null,
  };
  const scene = (value: string, op: Triple['op'] = 'eq'): Triple => ({ field: 'scene', op, value });
  expect(auditConfig(stageConfig, [scene(stageConfig.sceneId)], catalog, false).violations).not.toContain('scene');
  expect(auditConfig(stageConfig, [scene('scene-bund-banquet')], catalog, false).violations).toContain('scene');
  expect(auditConfig(stageConfig, [scene('outdoor_stage', 'neq')], catalog, false).violations).toContain('scene');
  expect(auditSceneValue('scene-studio-minimal', 'scene-studio-minimal', SCENES)).toBe(true);
  expect(auditSceneValue('scene-studio-minimal', 'indoor_formal', SCENES)).toBeUndefined();
  expect(hardScore([scene('scene-outdoor-stage')], [scene('outdoor_stage')]).tp).toBe(0);
  expect(hardScore([scene('scene-outdoor-stage')], [scene('outdoor_stage')], scoredTripleKey).tp).toBe(1);
  expect(hardScore([scene('scene-bund-banquet')], [scene('formal_evening')], scoredTripleKey).tp).toBe(1);
  expect(hardScore([scene('scene-bund-protocol')], [scene('indoor_formal')], scoredTripleKey).tp).toBe(0);
  expect(hardScore([scene('scene-jingan-salon')], [scene('scene-bund-banquet')], scoredTripleKey).tp).toBe(0);
  expect(hardScore([scene('scene-outdoor-stage', 'neq')], [scene('outdoor_stage', 'neq')], scoredTripleKey).tp).toBe(0);
});

function auditClaims(candidate: CandidateCombination, catalog: Catalog) {
  const inLibrary = new Set([
    ...catalog.patterns, ...catalog.fabrics, ...catalog.crafts, ...catalog.cases, ...catalog.scenes,
  ].map(({ id }) => id));
  const outsideReferences = [...candidate.referenceCaseIds, ...candidate.evidence.map(({ assetId }) => assetId)]
    .filter((id) => !inLibrary.has(id));
  const suspect = candidate.evidence.filter((entry) => {
    const asserted = entry.outcome === 'satisfies';
    if (!asserted) return false;
    if (entry.kind === 'case') return true;
    const fabric = DECISION_CATALOG.fabrics.find(({ asset }) => asset.id === entry.assetId);
    const craft = DECISION_CATALOG.crafts.find(({ asset }) => asset.id === entry.assetId);
    if (entry.field === 'care') return entry.value == null || entry.value !== (fabric?.profile.care ?? craft?.profile.care);
    if (entry.field === 'wrinkleResistance') return entry.value !== fabric?.profile.wrinkleResistance;
    return /compliance|certification/i.test(entry.field);
  });
  const claimedCare = /^模拟可低温机洗/.test(candidate.comparison.care) ? 'machine_wash'
    : /^模拟目录标注专业干洗/.test(candidate.comparison.care) ? 'dry_clean'
      : /^模拟目录标注手洗/.test(candidate.comparison.care) ? 'hand_wash' : null;
  const aligned = DECISION_CATALOG.fabrics.find(({ asset }) => asset.id === candidate.config.fabricId)?.profile.care === claimedCare &&
    candidate.config.craftIds.every((id) => DECISION_CATALOG.crafts.find(({ asset }) => asset.id === id)?.profile.care === claimedCare) &&
    (claimedCare !== 'machine_wash' || candidate.config.craftIds.length > 0);
  return { outsideReferences, fakeClaim: suspect.length > 0 || (claimedCare !== null && !aligned) };
}

function catalogExpectation(expected: CatalogExpectation | undefined, offered: readonly ConfigurationState[]) {
  if (!expected) return null;
  if (expected.outcome !== 'eligible') return offered.length === 0;
  return offered.some((config) => expected.requiredIds?.every((id) =>
    [config.fabricId, config.patternId, config.sceneId, ...config.craftIds].includes(id),
  ) ?? true);
}

function currentCatalogExpectation(
  expected: CatalogExpectation | undefined,
  match: MatchResult,
  selected: CandidateCombination | null = null,
) {
  if (expected && match.status !== (expected.outcome === 'eligible' ? 'matched' : 'no_match')) return false;
  const offered = [match.recommended, match.alternative, selected].filter((candidate): candidate is CandidateCombination =>
    candidate?.status === 'eligible');
  return catalogExpectation(expected, offered.map(({ config }) => config));
}

function claimSourceCount(requirement: DecisionRequirement) {
  return hard(requirement).filter((item) => item.quote && requirement.turns.some((turn) =>
    turn.id === item.sourceTurnId && turn.text.includes(item.quote!),
  )).length;
}

function archiveHistory(history: DecisionHistory, version: Version) {
  const records = loadLedgerRecords();
  const existing = records.find(({ id }) => id === version.projectId);
  const record = buildLedgerRecordFromSession({
    id: version.projectId, projectCode: existing?.projectCode, createdAt: existing?.createdAt,
    stylePackId: 'shanghai-haipai', input: decisionInput(version.requirement, version.candidate),
    deconstructed: decisionPresentation(version.requirement), config: version.candidate?.config ?? null,
    decisionVersion: version, existingLogs: existing?.auditLogs, status: existing?.status,
  });
  saveLedgerRecords([{ ...record, decisionHistory: history }, ...records.filter(({ id }) => id !== record.id)]);
  return loadLedgerRecords().find(({ id }) => id === version.projectId);
}

function exactArchiveSnapshot(version: Version, record: ReturnType<typeof archiveHistory>) {
  if (!record) return false;
  if (!version.candidate) {
    return version.match.status === 'no_match' && record.config === null && record.proposal === null &&
      record.promptPack === null && version.proposal === null && version.promptPack === null &&
      record.matchedCaseIds.length === 0 && record.matchScore === 0;
  }
  return JSON.stringify(record.config) === JSON.stringify(version.candidate.config) &&
    JSON.stringify(record.proposal) === JSON.stringify(version.proposal) &&
    JSON.stringify(record.promptPack) === JSON.stringify(version.promptPack) &&
    record.proposal !== null && record.promptPack !== null;
}

function scoreRevisionConflicts(
  reported: readonly string[],
  expected: readonly string[] | undefined,
  assumeNoConflictsWhenOmitted: boolean,
): boolean | null {
  if (expected === undefined && !assumeNoConflictsWhenOmitted) return null;
  return sameSet(reported, expected ?? []);
}

test('distinguishes missing revision conflict annotations from explicit expectations', () => {
  expect(scoreRevisionConflicts(['care'], undefined, false)).toBeNull();
  expect(scoreRevisionConflicts(['care'], undefined, true)).toBe(false);
  expect(scoreRevisionConflicts([], undefined, true)).toBe(true);
  expect(scoreRevisionConflicts(['care'], [], false)).toBe(false);
  expect(scoreRevisionConflicts([], [], false)).toBe(true);
  expect(scoreRevisionConflicts(['care', 'fabric'], ['fabric', 'care'], false)).toBe(true);
  expect(scoreRevisionConflicts(['care'], ['care', 'fabric'], false)).toBe(false);
});

function scoreRevisions(fixture: Fixture, initial: Version, assumeNoConflictsWhenOmitted: boolean) {
  const rows: {
    turn: string; decision: string; preview: boolean; conflicts: boolean | null; patch: boolean; stored: boolean;
    invariant: boolean; preservedExistingHard: boolean; preservedExistingPending: boolean; expectedState: boolean;
    roundTrip: boolean; archiveRoundTrip: boolean; reviewOnly: boolean; reason: string | null;
    catalogOutcome: CatalogExpectation['outcome'] | null; catalog: boolean | null;
  }[] = [];
  let history = appendDecisionVersion(emptyDecisionHistory(), initial);
  const initiallySaveable = Boolean(initial.candidate);
  const initialArchive = archiveHistory(history, initial);
  const initialArchiveValid = exactArchiveSnapshot(initial, initialArchive) &&
    JSON.stringify(initialArchive?.decisionHistory) === JSON.stringify(history);
  for (const step of fixture.turns.slice(1)) {
    const revision = step.revision!;
    const before = history.versions.at(-1)!;
    const beforeBytes = JSON.stringify(before);
    history = { ...history, feedbackDraft: step.text };
    const preview = previewDecisionRevision(before, history.feedbackDraft);
    const patch = sameSet(preview?.requestedPatch.map(({ field }) => field) ?? [], revision.requestedFields);
    const conflicts = scoreRevisionConflicts(preview?.conflicts.map(({ field }) => field) ?? [],
      step.conflicts, assumeNoConflictsWhenOmitted);
    const previewSafe = beforeBytes === JSON.stringify(history.versions.at(-1));
    let stored = false;
    let reason: string | null = null;
    if (!preview) {
      reason = '未生成改稿预览。';
    } else if (revision.decision === 'cancel') {
      stored = previewSafe && history.feedbackDraft === step.text;
    } else {
      const target = revision.decision === 'apply'
        ? preview.branches.find((branch) => branch.option === 'accept') ?? preview.branches.find((branch) => branch.option === 'keep')
        : preview.branches.find((branch) => branch.option === revision.decision);
      if (!target?.canConfirm) {
        reason = target?.candidate ? '预览包含组合，但该决策分支无法确认。' : '指定分支无法确认或暂无合格组合。';
      } else {
        const action = recordDecisionRevision(preview, target, RUN_TIME);
        if (revision.decision === 'defer') {
          history = { ...history, rejectedRevisions: [...history.rejectedRevisions, action] };
          stored = action.baseVersionId === before.id && action.selectedOption === 'defer' &&
            history.feedbackDraft === step.text && beforeBytes === JSON.stringify(history.versions.at(-1));
        } else {
          const next = buildDecisionVersion({
            projectId: before.projectId, previous: before, requirement: target.requirement, match: target.match,
            candidate: target.candidate, revision: action, now: RUN_TIME,
          });
          const appended = appendDecisionVersion(history, next);
          stored = appended.versions.length === history.versions.length + 1 && appended.versions.at(-1)?.id === next.id &&
            appendDecisionVersion(appended, next) === appended;
          history = appended;
        }
      }
    }
    const actual = history.versions.at(-1)!;
    const actualHard = hard(actual.requirement);
    const beforeHard = hard(before.requirement);
    const preservedFields = revision.invariantFields;
    const preservedExistingHard = preservedFields.every((field) => {
      const signature = (item: (typeof actualHard)[number]) => JSON.stringify([tripleKey(item), item.sourceTurnId, item.quote]);
      return sameSet(actualHard.filter((item) => item.field === field).map(signature),
        beforeHard.filter((item) => item.field === field).map(signature));
    });
    const knownPending = (version: Version) => version.requirement.constraints
      .filter((item) => preservedFields.includes(item.field) && item.state === 'unknown' &&
        (item.sourceTurnId !== null || item.verifiedBy !== null))
      .map((item) => JSON.stringify([item.field, item.sourceTurnId, item.quote, item.blocking, item.withdraws]));
    const pendingAfter = new Set(knownPending(actual));
    const preservedExistingPending = knownPending(before).every((source) => pendingAfter.has(source));
    const scoreKey = (item: Triple) => scoredTripleKey(item);
    const invariant = preservedExistingPending && preservedExistingHard && sameSet(
      actualHard.filter(({ field }) => preservedFields.includes(field)).map(scoreKey),
      step.hard.filter(({ field }) => preservedFields.includes(field)).map(scoreKey),
    );
    const changedFields = [...new Set([...beforeHard, ...actualHard].map(({ field }) => field))].filter((field) =>
      !sameSet(beforeHard.filter((item) => item.field === field).map(tripleKey),
        actualHard.filter((item) => item.field === field).map(tripleKey)),
    );
    const expectedState = sameSet(actualHard.map(scoreKey), step.hard.map(scoreKey)) &&
      sameSet(changedFields, revision.changedFields);
    const savedParent = history.versions.find(({ id }) => id === actual.parentVersionId) ?? null;
    const reopenedRecord = archiveHistory(history, actual);
    const reopenedHistory = reopenedRecord?.decisionHistory;
    const reopened = reopenedHistory?.versions.find(({ id }) => id === actual.id);
    const reopenedParent = reopenedHistory?.versions.find(({ id }) => id === actual.parentVersionId) ?? null;
    const finalExport = reopened ? buildDecisionExport(reopened, reopenedParent) : null;
    const archiveRoundTrip = Boolean(
      initialArchiveValid && stored && previewSafe && reopened && finalExport &&
      exactArchiveSnapshot(actual, reopenedRecord) &&
      JSON.stringify(reopenedHistory) === JSON.stringify(history) &&
      JSON.stringify(finalExport) === JSON.stringify(buildDecisionExport(actual, savedParent)) &&
      JSON.stringify(finalExport.version) === JSON.stringify(actual) &&
      buildDecisionMarkdown(reopened, reopenedParent) === buildDecisionMarkdown(actual, savedParent) &&
      JSON.stringify(reopenedHistory?.versions.find(({ id }) => id === before.id)) === beforeBytes,
    );
    const roundTrip = archiveRoundTrip && initiallySaveable && Boolean(before.candidate && actual.candidate);
    rows.push({ turn: step.id, decision: revision.decision, preview: Boolean(preview && previewSafe), patch, conflicts,
      stored, invariant, preservedExistingHard, preservedExistingPending, expectedState, roundTrip, archiveRoundTrip,
      reviewOnly: !initial.candidate || !before.candidate || !actual.candidate, reason,
      catalogOutcome: step.catalog?.outcome ?? null, catalog: currentCatalogExpectation(step.catalog, actual.match, actual.candidate) });
  }
  const stepsCorrect = rows.every(({ preview, patch, conflicts, stored, invariant, expectedState }) =>
    preview && patch && conflicts !== false && stored && invariant && expectedState);
  return {
    initiallySaveable, initialArchiveValid, rows,
    full: stepsCorrect && rows.every(({ roundTrip }) => roundTrip),
    archiveFull: stepsCorrect && rows.every(({ archiveRoundTrip }) => archiveRoundTrip),
    invariants: rows.every(({ invariant }) => invariant),
  };
}

function sum(metrics: readonly { tp: number; fp: number; fn: number }[]) {
  return metrics.reduce((total, item) => ({
    tp: total.tp + item.tp, fp: total.fp + item.fp, fn: total.fn + item.fn,
  }), { tp: 0, fp: 0, fn: 0 });
}

// Same first message and gold labels. Only clause punctuation/spacing changes.
function probeFormatting(fixture: Fixture, catalog: Catalog, original: DecisionRequirement, match: MatchResult) {
  const turn = fixture.turns[0];
  const originalFacts = hard(original).map(tripleKey);
  const originalChoices = [match.recommended?.id, match.alternative?.id];
  return ['chatLines', 'unpunctuated'].map((format) => {
    const text = turn.text.replace(/[，。；！？、,;!?]+/gu, format === 'chatLines' ? '\n' : ' ').trim();
    const parsed = buildLocalDecisionRequirement(scratchInput(fixture.id, text));
    const options = matchDecision(parsed);
    const candidates = [options.recommended, options.alternative].filter((candidate) => candidate !== null);
    const audits = candidates.map((candidate) => auditConfig(candidate.config, turn.hard, catalog, false));
    const extracted = hard(parsed);
    const { tp, fp, fn } = hardScore(turn.hard, extracted);
    return {
      format, changedText: text !== turn.text, hardChanged: !sameSet(originalFacts, extracted.map(tripleKey)),
      optionsChanged: options.recommended?.id !== originalChoices[0] || options.alternative?.id !== originalChoices[1],
      score: { tp, fp, fn }, knownViolation: [...new Set(audits.flatMap(({ violations }) => violations))],
      unverifiedHard: [...new Set(audits.flatMap(({ unknowns }) => unknowns))],
    };
  });
}

test.each(suites)('replays $source and writes the evaluation report', (suite) => {
  if (releaseSha !== undefined) verifyReleaseSource(releaseSha);
  const frozenText = readFileSync(resolve('evaluation', suite.source), 'utf8').replaceAll('\r\n', '\n');
  expect(createHash('sha256').update(frozenText).digest('hex')).toBe(suite.hash);
  expect(suite.fixtures).toHaveLength(24);
  expect(suite.fixtures.flatMap(({ turns }) => turns)).toHaveLength(36);
  const revisionCount = suite.fixtures.filter(({ group }) => group === 'multi-round-revisions').length;
  const catalog = { patterns: PATTERNS, fabrics: FABRICS, crafts: CRAFTS, scenes: SCENES, cases: HISTORICAL_CASES };
  const storage = new Map<string, string>();
  vi.stubGlobal('window', {
    localStorage: {
      getItem: (key: string) => storage.get(key) ?? null,
      setItem: (key: string, value: string) => storage.set(key, value),
    },
  });
  try {
    const rows = suite.fixtures.map((fixture) => {
      const turn: FixtureTurn = fixture.turns[0];
      const input = scratchInput(fixture.id, turn.text);
      const oldResult = baseline.deconstruct(input);
      const old = normalizeBaseline(oldResult);
      const oldConfig = baseline.matching.recommendInitialConfig(input, oldResult);
      const oldNotice = baseline.matching.evaluateFeasibility(input, oldConfig, oldResult);
      const oldAudit = auditConfig(oldConfig, turn.hard, baseline.catalog, true);
      const oldUnwarned = oldAudit.violations.filter((field) =>
        !(field === 'craftCompatibility' && oldNotice.some((notice) => notice.id === 'feas-craft-incompat')),
      );
      const requirement = buildLocalDecisionRequirement(input);
      const observed = hard(requirement);
      const matching = matchDecision(requirement);
      const candidates = [matching.recommended, matching.alternative].filter((item) => item !== null);
      const newAudit = candidates.map((candidate) => ({ id: candidate.id,
        ...auditConfig(candidate.config, turn.hard, catalog, false), ...auditClaims(candidate, catalog) }));
      const unclear = (turn.followUpFields ?? []).filter((field) => !requirement.questions.some((question) => question.field === field));
      const preferred = oldNotice.some((notice) => notice.id === 'feas-craft-ok');
      const oldScore = hardScore(turn.hard, old.triples);
      const newScore = hardScore(turn.hard, observed);
      const oldEquivalent = hardScore(turn.hard, old.triples, (item) => scoredTripleKey(item, baseline.catalog.scenes));
      const newEquivalent = hardScore(turn.hard, observed, scoredTripleKey);
      const catalogExpected = turn.catalog ?? fixture.catalog;
      const unresolvedOverwrites = turn.unknowns.filter(({ field }) => newScore.extra.some((item) =>
        item.field === field && item.op === 'eq',
      ));
      const revision = fixture.group === 'multi-round-revisions'
        ? scoreRevisions(fixture, buildDecisionVersion({
          projectId: fixture.id, previous: null, requirement, match: matching, candidate: matching.recommended,
          revision: null, now: RUN_TIME,
        }), suite.assumeNoConflictsWhenOmitted)
        : null;
      return {
        id: fixture.id, group: fixture.group, catalogOutcome: catalogExpected?.outcome ?? null,
        ...(suite.id === '4' || suite.id === '5' ? { formatting: probeFormatting(fixture, catalog, requirement, matching) } : {}),
        old: { score: oldScore, equivalentScore: oldEquivalent, negation: hardScore(turn.hard.filter((item) => item.op === 'neq'), old.triples.filter((item) => item.op === 'neq')),
          manual: manualEffort(oldScore, old.ambiguous), unknownId: oldAudit.unknownId, knownViolation: oldUnwarned,
          fakeClaim: preferred && oldAudit.violations.includes('craftCompatibility'),
          catalog: catalogExpectation(catalogExpected, [oldConfig]) },
        current: { score: newScore, equivalentScore: newEquivalent, negation: hardScore(turn.hard.filter((item) => item.op === 'neq'), observed.filter((item) => item.op === 'neq')),
          manual: manualEffort(newScore), quoteCount: claimSourceCount(requirement), hardClaimCount: observed.length,
          unknownId: newAudit.some((item) => item.unknownId || item.outsideReferences.length > 0),
          knownViolation: [...new Set(newAudit.flatMap((item) => item.violations))],
          unverifiedHard: [...new Set(newAudit.flatMap((item) => item.unknowns))],
          fakeClaim: newAudit.some((item) => item.fakeClaim),
          catalog: currentCatalogExpectation(catalogExpected, matching),
          matching: matching.status, audit: newAudit, missingFollowUps: unclear, questionCount: requirement.questions.length,
          unresolvedOverwrites: unresolvedOverwrites.map(({ field }) => field) },
        revision,
      };
    });
    function totals(variant: 'old' | 'current') {
      return {
        hard: sum(rows.map((row) => row[variant].score)),
        decisionEquivalentHard: sum(rows.map((row) => row[variant].equivalentScore)),
        negation: sum(rows.map((row) => row[variant].negation)),
        corrections: rows.reduce((count, row) => count + row[variant].manual.corrections, 0),
        missing: rows.reduce((count, row) => count + row[variant].manual.missing, 0),
        outside: rows.filter((row) => row[variant].unknownId).length,
        knownViolation: rows.filter((row) => row[variant].knownViolation.length > 0).length,
        fakeClaim: rows.filter((row) => row[variant].fakeClaim).length,
        candidateChange: rows.filter((row) => row[variant].knownViolation.length > 0 || row[variant].unknownId || row[variant].fakeClaim).length,
        catalogPassed: rows.filter((row) => row[variant].catalog === true).length,
        catalogScored: rows.filter((row) => row[variant].catalog !== null).length,
      };
    }
    const main = buildLocalDecisionRequirement(scratchInput('录屏主故事', '60 套，室内正式，藏青，耐皱，可机洗，不像传统制服。'));
    const mainExpected: Triple[] = [
      { field: 'quantity', op: 'eq', value: 60 }, { field: 'scene', op: 'eq', value: 'indoor_formal' },
      { field: 'color', op: 'eq', value: 'navy' }, { field: 'wrinkleResistance', op: 'eq', value: true },
      { field: 'care', op: 'eq', value: 'machine_wash' }, { field: 'style', op: 'neq', value: 'traditional_uniform' },
    ];
    function catalogChecks(outcome: CatalogExpectation['outcome']) {
      const probes = rows.flatMap(({ catalogOutcome, current, revision }) => [
        { catalogOutcome, catalog: current.catalog }, ...revision?.rows ?? [],
      ]).filter((probe) => probe.catalogOutcome === outcome);
      return { passed: probes.filter(({ catalog }) => catalog === true).length, total: probes.length };
    }
    const revisionSteps = rows.flatMap(({ revision }) => revision?.rows ?? []);
    const report = {
      baseline: BASELINE, productionSha: releaseSha ?? null, suite: suite.id, fixtureFile: suite.source,
      fixtureSha256: suite.hash, old: totals('old'), current: totals('current'),
      sourceQuotes: rows.reduce((count, row) => count + row.current.quoteCount, 0),
      sourceQuoteTotal: rows.reduce((count, row) => count + row.current.hardClaimCount, 0),
      catalogChecks: { eligible: catalogChecks('eligible'), noMatch: catalogChecks('no-match'), blocked: catalogChecks('blocked') },
      questionsOverLimit: rows.filter(({ current }) => current.questionCount > 2).length,
      missingFollowUps: rows.filter(({ current }) => current.missingFollowUps.length > 0).length,
      unverifiedHard: rows.filter(({ current }) => current.unverifiedHard.length > 0).length,
      unknownOverwrites: rows.filter(({ current }) => current.unresolvedOverwrites.length > 0).length,
      revisions: {
        cases: revisionCount, turns: revisionSteps.length,
        invariants: rows.filter(({ revision }) => revision?.invariants).length,
        full: rows.filter(({ revision }) => revision?.full).length,
        initiallySaveable: rows.filter(({ revision }) => revision?.initiallySaveable).length,
        storedRoundTrips: revisionSteps.filter(({ roundTrip }) => roundTrip).length,
        initialArchives: rows.filter(({ revision }) => revision?.initialArchiveValid).length,
        archiveFull: rows.filter(({ revision }) => revision?.archiveFull).length,
        archiveRoundTrips: revisionSteps.filter(({ archiveRoundTrip }) => archiveRoundTrip).length,
        reviewOnlyRoundTrips: revisionSteps.filter(({ archiveRoundTrip, reviewOnly }) => archiveRoundTrip && reviewOnly).length,
        preservedExistingHard: revisionSteps.filter(({ preservedExistingHard }) => preservedExistingHard).length,
        preservedExistingPending: revisionSteps.filter(({ preservedExistingPending }) => preservedExistingPending).length,
        conflictAnnotations: {
          passed: revisionSteps.filter(({ conflicts }) => conflicts === true).length,
          failed: revisionSteps.filter(({ conflicts }) => conflicts === false).length,
          unscored: revisionSteps.filter(({ conflicts }) => conflicts === null).length,
        },
      },
      main: { score: hardScore(mainExpected, hard(main)), matching: matchDecision(main).status },
      rows,
    };
    const { tp, fp, fn } = report.current.hard;
    const gates = releaseSha === undefined ? null : {
      hardPrecision: tp / (tp + fp) >= 0.9,
      hardRecall: tp / (tp + fn) >= 0.9,
      noOutsideIds: report.current.outside === 0,
      noKnownViolations: report.current.knownViolation === 0,
      noUnsupportedKeyClaims: report.current.fakeClaim === 0 && report.unverifiedHard === 0,
      allUnchangedHardPreserved: report.revisions.invariants === revisionCount,
      completeArchivedChains: report.revisions.archiveFull >= 5,
      mainBrief: report.main.score.tp === mainExpected.length && report.main.score.fp === 0 &&
        report.main.score.fn === 0 && report.main.matching === 'matched',
      eligibleCatalogProbes: report.catalogChecks.eligible.total > 0 &&
        report.catalogChecks.eligible.passed === report.catalogChecks.eligible.total,
      noMatchCatalogProbes: report.catalogChecks.noMatch.total > 0 &&
        report.catalogChecks.noMatch.passed === report.catalogChecks.noMatch.total,
      conflictCatalogProbes: report.catalogChecks.blocked.total === 0
        ? null : report.catalogChecks.blocked.passed === report.catalogChecks.blocked.total,
      quoteSourceTracing: report.sourceQuoteTotal > 0 && report.sourceQuotes === report.sourceQuoteTotal,
    };
    const output = join(reportDirectory, suite.report);
    const runReport = join(scratch.path, suite.report);
    writeFileSync(runReport, JSON.stringify({ ...report, gates }, null, 2));
    renameSync(runReport, output);
    console.log(JSON.stringify({ ...report, gates, rows: undefined, fullReport: output }, null, 2));
    if (gates) {
      const failures = Object.entries(gates).filter(([, passed]) => passed === false).map(([gate]) => gate);
      expect(failures, `Release report: ${output}`).toEqual([]);
    }
  } finally {
    vi.unstubAllGlobals();
  }
}, 30_000);
