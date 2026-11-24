import type {
  ConfigurationState,
  ProposalDraft,
  RequirementInput,
  VisualPromptPack,
} from './sartoria';

export const REQUIREMENT_SCHEMA_VERSION = 'sartoria_requirement_v1';

export const CONSTRAINT_FIELDS = [
  'businessType',
  'quantity',
  'scene',
  'season',
  'category',
  'patternStructure',
  'collar',
  'fabric',
  'color',
  'motif',
  'lengthRatio',
  'easeAllowance',
  'closure',
  'care',
  'wrinkleResistance',
  'luster',
  'style',
  'craft',
] as const;

export type ConstraintField = (typeof CONSTRAINT_FIELDS)[number];
export type ConstraintValue = string | number | boolean | null;

export interface RequirementTurn {
  id: string;
  text: string;
}

export interface Constraint {
  id: string;
  field: ConstraintField;
  op: 'eq' | 'neq';
  value: ConstraintValue;
  level: 'hard' | 'preference' | 'pending';
  state: 'explicit' | 'suggested' | 'unknown' | 'confirmed';
  sourceTurnId: string | null;
  quote: string | null;
  verifiedBy: string | null;
  reason: string | null;
  quantityScope?: 'order' | 'batch';
  blocking?: true;
  withdraws?: { op: 'eq' | 'neq'; value: NonNullable<ConstraintValue> };
}

export interface ClarificationQuestion {
  field: ConstraintField;
  question: string;
}

export interface DecisionRequirement {
  schemaVersion: typeof REQUIREMENT_SCHEMA_VERSION;
  mode: 'local_rules' | 'validated';
  input: RequirementInput;
  turns: RequirementTurn[];
  constraints: Constraint[];
  questions: ClarificationQuestion[];
  onlineReview?: {
    notes: string[];
    questions: string[];
  };
}

export interface AssetSource {
  kind: 'official_case' | 'public_reference' | 'team_simulation';
  reference: string;
  simulated: true;
}

export interface AssetEvidence {
  constraintId: string | null;
  assetId: string;
  assetCode: string;
  kind: 'pattern' | 'fabric' | 'craft' | 'case';
  field: string;
  value: ConstraintValue;
  source: AssetSource;
  outcome: 'satisfies' | 'conflict' | 'unknown' | 'reference';
  detail: string;
}

export interface CandidateCombination {
  id: string;
  config: ConfigurationState;
  status: 'eligible' | 'needs_review' | 'rejected';
  ruleScore: number;
  evidence: AssetEvidence[];
  decisionReasons: string[];
  comparison: { style: string; comfort: string; fit: string; care: string };
  referenceCaseIds: string[];
}

export interface MatchResult {
  status: 'matched' | 'no_match';
  recommended: CandidateCombination | null;
  alternative: CandidateCombination | null;
  review: CandidateCombination[];
  rejected: CandidateCombination[];
}

export interface ConstraintChange {
  field: ConstraintField;
  previous: Constraint | null;
  next: Constraint | null;
}

export interface RevisionImpact {
  area: 'requirements' | 'pattern' | 'fabric' | 'craft' | 'care' | 'visual';
  detail: string;
}

export type RevisionOption = 'keep' | 'accept' | 'defer';

export interface Revision {
  id: string;
  baseVersionId: string;
  turn: RequirementTurn;
  requestedPatch: ConstraintChange[];
  impacts: RevisionImpact[];
  selectedOption: RevisionOption;
  humanDecision: 'confirmed' | 'rejected';
  savedAt: string;
}

export interface Version {
  id: string;
  projectId: string;
  number: number;
  parentVersionId: string | null;
  createdAt: string;
  requirement: DecisionRequirement;
  match: MatchResult;
  candidate: CandidateCombination | null;
  proposal: ProposalDraft | null;
  promptPack: VisualPromptPack | null;
  revision: Revision | null;
}

export interface DecisionHistory {
  versions: Version[];
  rejectedRevisions: Revision[];
  feedbackDraft: string;
}

export interface HandoffReview {
  field: string;
  owner: string;
  nextStep: string;
}

export interface DecisionExport {
  schemaVersion: 'sartoria_handoff_v1';
  simulated: true;
  version: Version;
  previousVersionId: string | null;
  versionChanges: ConstraintChange[];
  reviews: HandoffReview[];
  boundaries: string[];
}
