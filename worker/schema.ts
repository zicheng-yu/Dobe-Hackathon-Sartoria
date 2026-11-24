export const REQUIREMENT_SCHEMA_VERSION = 'sartoria_requirement_v1' as const;

export const OFFICIAL_SPEC_KEYS = [
  'category',
  'patternStructure',
  'collar',
  'fabric',
  'color',
  'motif',
  'lengthRatio',
  'easeAllowance',
] as const;

export type OfficialSpecKey = (typeof OFFICIAL_SPEC_KEYS)[number];
export type StructuredInfoStatus = 'explicit' | 'suggested' | 'unknown';
export type StructuredConstraintKind = 'hard' | 'soft' | 'excluded' | 'pending';

export interface StructuredSpecField {
  key: OfficialSpecKey;
  label: string;
  value: string;
  infoStatus: StructuredInfoStatus;
  constraintKind: StructuredConstraintKind;
  sourceQuote: string | null;
  rationale: string;
  ergonomicCue: string | null;
}

export interface StructuredRequirementV1 {
  schemaVersion: typeof REQUIREMENT_SCHEMA_VERSION;
  aestheticArchetype: string;
  emotionTags: string[];
  colorSpecifiedByUser: boolean;
  bodyErgonomics: string[];
  followUpQuestions: string[];
  officialSpecs: StructuredSpecField[];
  threeBuckets: {
    userExplicit: string[];
    systemSuggested: string[];
    needsHumanVerification: string[];
  };
}

/**
 * OpenAI Responses API Strict JSON Schema (text.format.type = "json_schema", strict = true).
 * Aligned with YOU-241 & YOU-238 contract: explicit/suggested/unknown separation + verbatim sourceQuote.
 */
export const SARTORIA_REQUIREMENT_V1_SCHEMA = {
  type: 'object',
  additionalProperties: false,
  required: [
    'schemaVersion',
    'aestheticArchetype',
    'emotionTags',
    'colorSpecifiedByUser',
    'bodyErgonomics',
    'followUpQuestions',
    'officialSpecs',
    'threeBuckets',
  ],
  properties: {
    schemaVersion: {
      type: 'string',
      enum: [REQUIREMENT_SCHEMA_VERSION],
    },
    aestheticArchetype: {
      type: 'string',
    },
    emotionTags: {
      type: 'array',
      items: { type: 'string' },
    },
    colorSpecifiedByUser: {
      type: 'boolean',
    },
    bodyErgonomics: {
      type: 'array',
      items: { type: 'string' },
    },
    followUpQuestions: {
      type: 'array',
      items: { type: 'string' },
    },
    officialSpecs: {
      type: 'array',
      items: {
        type: 'object',
        additionalProperties: false,
        required: [
          'key',
          'label',
          'value',
          'infoStatus',
          'constraintKind',
          'sourceQuote',
          'rationale',
          'ergonomicCue',
        ],
        properties: {
          key: {
            type: 'string',
            enum: [...OFFICIAL_SPEC_KEYS],
          },
          label: { type: 'string' },
          value: { type: 'string' },
          infoStatus: {
            type: 'string',
            enum: ['explicit', 'suggested', 'unknown'],
          },
          constraintKind: {
            type: 'string',
            enum: ['hard', 'soft', 'excluded', 'pending'],
          },
          sourceQuote: {
            type: ['string', 'null'],
          },
          rationale: { type: 'string' },
          ergonomicCue: {
            type: ['string', 'null'],
          },
        },
      },
    },
    threeBuckets: {
      type: 'object',
      additionalProperties: false,
      required: ['userExplicit', 'systemSuggested', 'needsHumanVerification'],
      properties: {
        userExplicit: {
          type: 'array',
          items: { type: 'string' },
        },
        systemSuggested: {
          type: 'array',
          items: { type: 'string' },
        },
        needsHumanVerification: {
          type: 'array',
          items: { type: 'string' },
        },
      },
    },
  },
} as const;

export const SARTORIA_SYSTEM_PROMPT = [
  '你是上海服装集团 Sartoria AI 海派高定与团体职业服企划辅助专家。',
  '你的唯一职责是将客户口语化需求转化为严格符合 `sartoria_requirement_v1` JSON Schema 的结构化企划参数，供下游确定性规则引擎匹配静态模拟定制资产。',
  '',
  '【必须严格遵守的业务红线与校验规则】',
  '1. officialSpecs 必须且仅包含以下 8 个字段（按顺序，不可重复、不可缺失）：category(品类)、patternStructure(版型结构)、collar(领型)、fabric(面料)、color(色彩)、motif(装饰纹样)、lengthRatio(长度比例)、easeAllowance(松弛余量)。',
  '2. 信息状态 infoStatus 只能为 explicit（客户原话明确提到）、suggested（系统结合体态/场合给出的专业建议）、unknown（客户未说明或必须由线下人工核定）；严禁伪造“已人工确认”。',
  '3. 原文依据溯源：仅当 infoStatus 为 explicit 时填写 sourceQuote，且 sourceQuote 必须是客户原始需求文本中的逐字连续子串；若是 suggested 或 unknown，sourceQuote 必须为 null，并在 rationale 中写简短专业依据。',
  '4. 严禁代客定色：若客户原文未明确提到具体颜色或色系倾向，colorSpecifiedByUser 必须为 false，color 字段的 infoStatus 必须为 unknown，value 写明“无特殊需求（客户未指定颜色，系统不代客决定，须由顾问携实物色卡线下核定）”。',
  '5. 严禁凭空编造具体厘米数：easeAllowance 字段只给放量方向建议（如肩背、袖笼、腹部、裙摆等方向），严禁编造原文未出现的“+4cm”“6厘米”等具体松量数值，且 infoStatus 必须为 unknown（待版师量体与试身核定）。',
  '6. 严禁包含正式报价、具体交期承诺、真实库存结论或 CAD 生产定版结论；followUpQuestions 输出 0–2 条最关键的待核实追问。',
  '7. emotionTags 输出 3–5 个精炼中文审美标签；threeBuckets 清晰分离 userExplicit、systemSuggested、needsHumanVerification 三类信息。',
  'aestheticArchetype 标题优先使用客户明确的风格、品类或材质。若提及排除条件，保留其对象、否定方向和程度：仅排除强反光时，中等光泽仍可用，标题可省略光泽或写“避开强反光”。只有客户明确选择低光泽或哑光时才用相应词语命名。',
  '8. 在 threeBuckets.userExplicit 的正文优先写明本次明确的成衣数量、具名场地和委托性质，最多 8 条，可合并相关要求。成衣数量须写出数字和原文已给的单位，包括一件、一套与多件多套；若数量对应明确品类，也写入 category.value，不能只留在 sourceQuote 里。保留客户点名的完整场地或活动名称；遇公司、机构或团队统一订做时，写明团体委托及原文所指的委托方或团队。',
  '9. 委托性质看实际下单和使用关系。为工作团队配发工装，或由采购与门店管理人员代表用工方共同安排工作服，即使未出现“团体”或机构全称，也在 userExplicit 写明团体委托并保留原文中的对象或决策角色作为依据。个人自用、代家人亲友下单或家人同穿属于个人委托。仅有人数、成衣数量或职业称谓不足以认定团体委托；未说出的机构名称和穿着团队不得补写。',
  '10. 在所有字段区分成衣件数、套数、穿着人数和每人配额，分别保留原文明确的数字及其对象。成衣件套数不能推作人数或每人配额，套装品类也不能推作一套。若人数和每人配额均已明确，可另列可直接计算的总量并写明计算依据。原文未给单位时保留数量所指对象，不擅加“件”或“套”。',
  '11. 原文把已定成衣数量限定在首批、本批或试点范围时，在 userExplicit 和适用的 category.value 显式保留该范围及数量；未给整单累计数量时另列“累计总量待确认”。“先”直接限定成衣订做数量（如“先订／先下单”后接数量），即使没有“批”字，也按当前批次的已定数量记录。仅表达流程顺序的“先”（如先登记、先看样）不构成分批依据。',
  '12. 明确事实只取自客户需求原文；业务类型、季候和项目参考名称仅供理解语境。保留本次已确认的要求与明确排除，把尚未确定的数量、改期换场和委托安排放入 needsHumanVerification；历史订单、已撤回的说法和未决定的选项不能写成当前确认。',
  '13. threeBuckets.needsHumanVerification 是待办清单，明确列出尚未确认且影响选配或交接的需求，即使客户未提及、未明确说“待定”，或者该项未入选 0–2 条追问。逐项检查成衣数量（含仅确认分批时的累计总量）、穿着场地或使用环境、洗护方式、具体成衣品类、面料成分、穿着季节。岗位与决策角色不能确认穿着场地；“工装／工作服／职业服”仅说明用途，不能确认具体品类；耐皱、低光泽等性能不能确认面料成分；活动名、提交时间和表单季候不能确认穿着季节。如相关字段缺失或未定，在待办清单正文用对应字段名写明“待确认”，勿仅在规格解释、系统建议或追问里提及。',
  '14. needsHumanVerification 最多 8 条。优先列客户明确悬置的内容和上述待确认需求；必要时将相关待办合并一条，每个待确认字段仍须具名。保留色彩核对和量体核定边界。避免重复事项；尽量使用短句，规格理由和人体工学提示保持简短。',
  '15. 提交前复核订单总量：上下装分体、套内单品的件数只描述结构。若只知道每套由几件组成，未说订几套，在 needsHumanVerification 正文直接列“订单总套数待确认”；是否增设备份是另一项问题。若已明确订量，保留客户给出的单位和批次范围。',
].join('\n');

const SPEC_DEFAULT_LABELS: Record<OfficialSpecKey, string> = {
  category: '品类',
  patternStructure: '版型结构',
  collar: '领型',
  fabric: '面料',
  color: '色彩',
  motif: '装饰纹样',
  lengthRatio: '长度比例',
  easeAllowance: '松弛余量',
};

function normalizeForQuoteMatch(text: string): string {
  return text.replace(/[\s，,。.、；;：:！!？?「」『』“”"'（）()]+/g, '').toLowerCase();
}

function quoteExistsInNarrative(quote: string, rawNarrative: string): boolean {
  const cleanQuote = quote.trim();
  if (!cleanQuote) return false;
  if (rawNarrative.includes(cleanQuote)) return true;
  const normQuote = normalizeForQuoteMatch(cleanQuote);
  const normNarrative = normalizeForQuoteMatch(rawNarrative);
  return normQuote.length >= 2 && normNarrative.includes(normQuote);
}

const VALID_INFO_STATUS = new Set<string>(['explicit', 'suggested', 'unknown']);
const VALID_CONSTRAINT_KIND = new Set<string>(['hard', 'soft', 'excluded', 'pending']);
const MAX_VERIFICATION_ITEMS = 8;

export type ValidationOutcome =
  | {
      ok: true;
      data: StructuredRequirementV1;
      warnings: string[];
    }
  | {
      ok: false;
      reason: string;
    };

/**
 * Structural + Semantic validation of GPT-6.2 Astra Structured Output (YOU-241 / YOU-246).
 * Verifies exact schema shape, verbatim source quote grounding, unspecified-color guardrail,
 * and anti-fabricated-centimeters guardrail.
 */
export function validateStructuredRequirement(
  rawParsed: unknown,
  rawNarrative: string
): ValidationOutcome {
  if (!rawParsed || typeof rawParsed !== 'object') {
    return { ok: false, reason: '模型输出不是合法 JSON 对象' };
  }

  const obj = rawParsed as Record<string, unknown>;
  if (obj.schemaVersion !== REQUIREMENT_SCHEMA_VERSION) {
    return { ok: false, reason: 'schemaVersion 不匹配 sartoria_requirement_v1' };
  }

  if (typeof obj.aestheticArchetype !== 'string' || !obj.aestheticArchetype.trim()) {
    return { ok: false, reason: '缺少 aestheticArchetype' };
  }

  if (typeof obj.colorSpecifiedByUser !== 'boolean') {
    return { ok: false, reason: '缺少 colorSpecifiedByUser 布尔标记' };
  }

  if (!Array.isArray(obj.officialSpecs) || obj.officialSpecs.length !== 8) {
    return { ok: false, reason: 'officialSpecs 必须包含完整的 8 项专业字段' };
  }

  const warnings: string[] = [];
  const seenKeys = new Set<OfficialSpecKey>();
  const validatedSpecs: StructuredSpecField[] = [];
  const rawHasCm = /\d+(?:\.\d+)?\s*(?:cm|厘米)/i.test(rawNarrative);

  for (const item of obj.officialSpecs) {
    if (!item || typeof item !== 'object') {
      return { ok: false, reason: 'officialSpecs 存在非法条目' };
    }
    const spec = item as Record<string, unknown>;
    const key = spec.key as OfficialSpecKey;
    if (!OFFICIAL_SPEC_KEYS.includes(key) || seenKeys.has(key)) {
      return { ok: false, reason: `officialSpecs 字段键非法或重复: ${String(spec.key)}` };
    }
    seenKeys.add(key);

    if (typeof spec.value !== 'string' || !spec.value.trim()) {
      return { ok: false, reason: `字段 ${key} 缺少 value` };
    }
    if (typeof spec.infoStatus !== 'string' || !VALID_INFO_STATUS.has(spec.infoStatus)) {
      return { ok: false, reason: `字段 ${key} infoStatus 非法` };
    }
    if (
      typeof spec.constraintKind !== 'string' ||
      !VALID_CONSTRAINT_KIND.has(spec.constraintKind)
    ) {
      return { ok: false, reason: `字段 ${key} constraintKind 非法` };
    }

    let infoStatus = spec.infoStatus as StructuredInfoStatus;
    let constraintKind = spec.constraintKind as StructuredConstraintKind;
    let value = spec.value.trim();
    let sourceQuote =
      typeof spec.sourceQuote === 'string' && spec.sourceQuote.trim()
        ? spec.sourceQuote.trim()
        : null;
    const rationale =
      typeof spec.rationale === 'string' ? spec.rationale.trim() : '';
    const ergonomicCue =
      typeof spec.ergonomicCue === 'string' && spec.ergonomicCue.trim()
        ? spec.ergonomicCue.trim()
        : null;

    // Semantic check 1: verbatim quote grounding for explicit fields
    if (infoStatus === 'explicit') {
      if (!sourceQuote || !quoteExistsInNarrative(sourceQuote, rawNarrative)) {
        warnings.push(`字段 ${key} 原文摘录未命中原话，已降级为系统建议`);
        infoStatus = 'suggested';
        if (constraintKind === 'hard') constraintKind = 'soft';
        sourceQuote = null;
      }
    } else {
      // Never retain fabricated quotes on suggested/unknown fields
      sourceQuote = null;
    }

    // Semantic check 2: enforce unspecified color guardrail
    if (key === 'color' && !obj.colorSpecifiedByUser) {
      infoStatus = 'unknown';
      constraintKind = 'pending';
      sourceQuote = null;
      if (!value.includes('不代客') && !value.includes('待') && !value.includes('未指定')) {
        value = '无特殊需求（客户未指定颜色，系统不代客决定，须由顾问携实物色卡线下核定）';
        warnings.push('客户未指定颜色，已强制保留待人工核色边界');
      }
    }

    // Semantic check 3: never allow fabricated specific ease cm numbers
    if (key === 'easeAllowance') {
      infoStatus = 'unknown';
      constraintKind = 'pending';
      if (!rawHasCm && /\d+(?:\.\d+)?\s*(?:cm|厘米)/i.test(value)) {
        value = value.replace(/\d+(?:\.\d+)?\s*(?:cm|厘米)/gi, '适度余量');
        if (!value.includes('版师') && !value.includes('量体')) {
          value = `${value}（具体松量数值须由版师量体与试身核定，AI 不凭空报数）`;
        }
        warnings.push('已拦截并清除模型生成的具体松量厘米数');
      }
    }

    validatedSpecs.push({
      key,
      label:
        typeof spec.label === 'string' && spec.label.trim()
          ? spec.label.trim()
          : SPEC_DEFAULT_LABELS[key],
      value,
      infoStatus,
      constraintKind,
      sourceQuote,
      rationale,
      ergonomicCue,
    });
  }

  // Order canonically
  const orderedSpecs = OFFICIAL_SPEC_KEYS.map(
    (k) => validatedSpecs.find((s) => s.key === k)!
  );

  const rawBuckets = obj.threeBuckets as Record<string, unknown> | undefined;
  if (
    !rawBuckets ||
    !Array.isArray(rawBuckets.userExplicit) ||
    !Array.isArray(rawBuckets.systemSuggested) ||
    !Array.isArray(rawBuckets.needsHumanVerification)
  ) {
    return { ok: false, reason: '缺少完整的 threeBuckets 三分栏信息' };
  }

  const cleanStrArray = (arr: unknown, max: number): string[] =>
    Array.isArray(arr)
      ? arr
          .filter((x): x is string => typeof x === 'string' && x.trim().length > 0)
          .map((x) => x.trim())
          .slice(0, max)
      : [];

  const emotionTags = cleanStrArray(obj.emotionTags, 5);
  const bodyErgonomics = cleanStrArray(obj.bodyErgonomics, 6);
  const followUpQuestions = cleanStrArray(obj.followUpQuestions, 2);
  const userExplicit = cleanStrArray(rawBuckets.userExplicit, 8);
  const systemSuggested = cleanStrArray(rawBuckets.systemSuggested, 8);
  const needsHumanVerification = cleanStrArray(rawBuckets.needsHumanVerification, MAX_VERIFICATION_ITEMS);

  if (emotionTags.length === 0) {
    return { ok: false, reason: 'emotionTags 不能为空' };
  }

  if (
    !obj.colorSpecifiedByUser &&
    !needsHumanVerification.some((line) => line.includes('色'))
  ) {
    needsHumanVerification.unshift(
      '色彩确认：客户未指定颜色，须由顾问携实物色卡线下确认，AI 不代客定色'
    );
  }
  if (!needsHumanVerification.some((line) => line.includes('量体') || line.includes('松量'))) {
    needsHumanVerification.push('精确净体尺寸与松量厘米数须由版师实测与试穿核定');
  }
  if (needsHumanVerification.length > MAX_VERIFICATION_ITEMS) {
    const groupedItems = needsHumanVerification.splice(MAX_VERIFICATION_ITEMS - 1);
    needsHumanVerification.push(groupedItems.join('；'));
  }

  return {
    ok: true,
    warnings,
    data: {
      schemaVersion: REQUIREMENT_SCHEMA_VERSION,
      aestheticArchetype: obj.aestheticArchetype.trim(),
      emotionTags,
      colorSpecifiedByUser: obj.colorSpecifiedByUser,
      bodyErgonomics,
      followUpQuestions,
      officialSpecs: orderedSpecs,
      threeBuckets: {
        userExplicit,
        systemSuggested,
        needsHumanVerification,
      },
    },
  };
}
