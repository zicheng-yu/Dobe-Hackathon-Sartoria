import { DatabaseSync } from 'node:sqlite';
import { describe, expect, it } from 'vitest';
import {
  computeActualCostMicros,
  computeConservativeReserveMicros,
  DEFAULT_MODEL,
  getShanghaiDayWindow,
  QUOTA_LIMITS,
} from '../pricing.ts';
import { QuotaLedgerCore, type SqlExecutorLike } from '../quotaCore.ts';
import {
  OFFICIAL_SPEC_KEYS,
  REQUIREMENT_SCHEMA_VERSION,
  SARTORIA_SYSTEM_PROMPT,
  validateStructuredRequirement,
} from '../schema.ts';
import { resolveVisitorIdentity } from '../visitorAuth.ts';

function createMemorySqlExecutor(): SqlExecutorLike {
  const db = new DatabaseSync(':memory:');
  return {
    exec<T = Record<string, unknown>>(query: string, ...bindings: unknown[]) {
      const stmt = db.prepare(query);
      const trimmed = query.trim().toUpperCase();
      if (trimmed.startsWith('SELECT') || trimmed.includes('RETURNING')) {
        const rows = stmt.all(...(bindings as never[])) as T[];
        return { toArray: () => rows };
      }
      stmt.run(...(bindings as never[]));
      return { toArray: () => [] as T[] };
    },
  };
}

describe('Worker extraction prompt', () => {
  it('keeps a sheen exclusion distinct from a positive finish in the model headline', () => {
    const titleRule = SARTORIA_SYSTEM_PROMPT.split('\n').find(line => line.includes('aestheticArchetype 标题'));
    expect(titleRule).toContain('仅排除强反光时，中等光泽仍可用');
    expect(titleRule).toContain('只有客户明确选择低光泽或哑光时才用相应词语命名');
  });

  it('requires explicit garment quantities, named venues, and group commissions in the extracted facts', () => {
    expect(SARTORIA_SYSTEM_PROMPT).toMatch(/threeBuckets\.userExplicit[^\n]+成衣数量、具名场地和委托性质/);
    expect(SARTORIA_SYSTEM_PROMPT).toContain('包括一件、一套与多件多套');
    expect(SARTORIA_SYSTEM_PROMPT).toMatch(/category\.value[^\n]+不能只留在 sourceQuote/);
    expect(SARTORIA_SYSTEM_PROMPT).toContain('完整场地或活动名称');
    expect(SARTORIA_SYSTEM_PROMPT).toContain('团体委托及原文所指的委托方或团队');
  });

  it('distinguishes supported quantities and treats uncertainty separately across the response', () => {
    expect(SARTORIA_SYSTEM_PROMPT).toMatch(/套内单品的件数只描述结构[^\n]+needsHumanVerification[^\n]+订单总套数待确认/);
    expect(SARTORIA_SYSTEM_PROMPT).toContain('在所有字段区分成衣件数、套数、穿着人数和每人配额');
    expect(SARTORIA_SYSTEM_PROMPT).toContain('成衣件套数不能推作人数或每人配额');
    expect(SARTORIA_SYSTEM_PROMPT).toContain('明确事实只取自客户需求原文');
    expect(SARTORIA_SYSTEM_PROMPT).toMatch(/尚未确定[^\n]+needsHumanVerification/);
  });

  it('grounds group commissions in actual ordering roles and distinguishes private or family orders', () => {
    expect(SARTORIA_SYSTEM_PROMPT).toMatch(/采购与门店管理人员[^\n]+团体委托[^\n]+决策角色作为依据/);
    expect(SARTORIA_SYSTEM_PROMPT).toMatch(/代家人亲友下单[^\n]+个人委托/);
    expect(SARTORIA_SYSTEM_PROMPT).toContain('未说出的机构名称和穿着团队不得补写');
  });

  it('preserves a confirmed batch quantity while leaving the cumulative quantity open', () => {
    expect(SARTORIA_SYSTEM_PROMPT).toMatch(/首批、本批或试点范围[^\n]+保留该范围及数量[^\n]+累计总量待确认/);
    expect(SARTORIA_SYSTEM_PROMPT).toMatch(/“先”直接限定成衣订做数量[^\n]+没有“批”字[^\n]+当前批次的已定数量/);
    expect(SARTORIA_SYSTEM_PROMPT).toMatch(/流程顺序的“先”[^\n]+不构成分批依据/);
    expect(SARTORIA_SYSTEM_PROMPT).toMatch(/原文未给单位[^\n]+不擅加“件”或“套”/);
  });

  it('requires a named verification item for each relevant missing requirement beyond the follow-up budget', () => {
    const checklist = SARTORIA_SYSTEM_PROMPT.split('\n').find((line) => line.includes('threeBuckets.needsHumanVerification 是待办清单'));
    expect(checklist).toMatch(/未入选 0–2 条追问[^\n]+逐项检查/);
    for (const field of ['成衣数量', '穿着场地', '洗护方式', '具体成衣品类', '面料成分', '穿着季节']) {
      expect(checklist).toContain(field);
    }
    expect(checklist).toContain('岗位与决策角色不能确认穿着场地');
    expect(checklist).toContain('仅说明用途，不能确认具体品类');
    expect(checklist).toContain('低光泽等性能不能确认面料成分');
    expect(checklist).toContain('表单季候不能确认穿着季节');
    expect(checklist).toContain('在待办清单正文用对应字段名写明“待确认”');
  });

  it('retains all eight model verification entries and safety boundaries within eight returned lines', () => {
    const pending = [
      '累计总量待确认', '使用场地待确认', '洗护方式待确认', '具体成衣品类待确认',
      '面料成分待确认', '穿着季节待确认', '领型待确认', '长度比例待确认',
    ];
    const questions = ['穿着场地在哪里？', '需要哪一类成衣？', '洗护有要求吗？'];
    const result = validateStructuredRequirement({
      schemaVersion: REQUIREMENT_SCHEMA_VERSION,
      aestheticArchetype: '通勤工装',
      emotionTags: ['利落', '耐用', '简洁'],
      colorSpecifiedByUser: false,
      bodyErgonomics: [],
      followUpQuestions: questions,
      officialSpecs: OFFICIAL_SPEC_KEYS.map((key) => ({
        key, value: '待确认', infoStatus: 'unknown', constraintKind: 'pending', sourceQuote: null,
      })),
      threeBuckets: { userExplicit: [], systemSuggested: [], needsHumanVerification: pending },
    }, '想订一批员工工作服。');

    if (!result.ok) throw new Error(result.reason);
    expect(result.data.followUpQuestions).toEqual(questions.slice(0, 2));
    const verification = result.data.threeBuckets.needsHumanVerification;
    expect(verification).toHaveLength(8);
    const verificationText = verification.join('\n');
    expect(verificationText).toContain('色彩确认');
    expect(verificationText).toContain('精确净体尺寸与松量厘米数');
    for (const entry of pending) expect(verificationText).toContain(entry);
  });
});

describe('YOU-246 & YOU-247: Pricing, Quota Ledger, Concurrency, Signed Cookies & Schema Guardrails', () => {
  it('computes exact gpt-6.2-astra standard & cached token costs in micro-dollars', () => {
    // 1000 non-cached input ($8/M -> 8,000 micros) + 500 cached ($0.40/M -> 200 micros) + 1000 output ($40/M -> 40,000 micros) = 48,200 micros ($0.0482)
    const cost = computeActualCostMicros(DEFAULT_MODEL, {
      input_tokens: 1500,
      input_tokens_details: { cached_tokens: 500 },
      output_tokens: 1000,
    });
    expect(cost).toBe(48_200);

    // Missing usage returns null so caller applies conservative reserve
    expect(computeActualCostMicros(DEFAULT_MODEL, undefined)).toBeNull();
    expect(computeActualCostMicros(DEFAULT_MODEL, { input_tokens: 100 })).toBeNull();

    const reserve = computeConservativeReserveMicros(DEFAULT_MODEL, 400, QUOTA_LIMITS.maxOutputTokens);
    expect(reserve).toBeGreaterThan(100_000);
    expect(reserve).toBeLessThan(200_000);
  });

  it('enforces 5/day per visitor, blocks cookie-clearing on same IP, and resets at Asia/Shanghai 00:00 while preserving $40 lifetime spend', () => {
    const ledger = new QuotaLedgerCore(createMemorySqlExecutor());
    // 2026-11-24 23:55:00 Asia/Shanghai
    const day1Ms = Date.parse('2026-11-24T23:55:00+08:00');
    const win1 = getShanghaiDayWindow(day1Ms);
    expect(win1.dateShanghai).toBe('2026-11-24');
    expect(win1.resetAtIso).toBe('2026-11-25T00:00:00+08:00');

    for (let i = 1; i <= 5; i++) {
      const res = ledger.reserve({
        visitorKey: 'visitor-A',
        visitorTag: 'v_aaa',
        ipHash: 'ip_hash_1',
        model: DEFAULT_MODEL,
        reservedMicros: 120_000,
        nowMs: day1Ms + i * 1000,
      });
      expect(res.allowed).toBe(true);
      if (res.allowed) {
        ledger.settle(
          {
            reservationId: res.reservationId,
            status: 'succeeded',
            inputTokens: 1000,
            outputTokens: 500,
            settledMicros: 28_000,
            nowMs: day1Ms + i * 1000 + 500,
          },
          'visitor-A',
          'ip_hash_1'
        );
      }
    }

    // 6th call for same visitor rejected before OpenAI
    const call6 = ledger.reserve({
      visitorKey: 'visitor-A',
      visitorTag: 'v_aaa',
      ipHash: 'ip_hash_1',
      model: DEFAULT_MODEL,
      reservedMicros: 120_000,
      nowMs: day1Ms + 10_000,
    });
    expect(call6.allowed).toBe(false);
    if (!call6.allowed) {
      expect(call6.rejectCode).toBe('VISITOR_DAILY_LIMIT_EXCEEDED');
      expect(call6.snapshot.resetAt).toBe('2026-11-25T00:00:00+08:00');
    }

    // Anti-cookie-clearing: new cookie visitorKey with SAME ipHash still rejected!
    const clearedCookieCall = ledger.reserve({
      visitorKey: 'visitor-A-cleared-cookie',
      visitorTag: 'v_bbb',
      ipHash: 'ip_hash_1',
      model: DEFAULT_MODEL,
      reservedMicros: 120_000,
      nowMs: day1Ms + 12_000,
    });
    expect(clearedCookieCall.allowed).toBe(false);
    if (!clearedCookieCall.allowed) {
      expect(clearedCookieCall.rejectCode).toBe('VISITOR_DAILY_LIMIT_EXCEEDED');
    }

    // Next day 00:00:05 Asia/Shanghai: daily count resets to 0, lifetime spent (5 * 28_000 = 140_000) persists!
    const day2Ms = Date.parse('2026-11-25T00:00:05+08:00');
    const day2Status = ledger.getStatus({ visitorKey: 'visitor-A', ipHash: 'ip_hash_1', nowMs: day2Ms });
    expect(day2Status.dateShanghai).toBe('2026-11-25');
    expect(day2Status.visitor.used).toBe(0);
    expect(day2Status.visitor.remaining).toBe(5);
    expect(day2Status.site.used).toBe(0);
    expect(day2Status.budget.spentMicros).toBe(140_000);
  });

  it('enforces site-wide 50/day cap across multiple visitors and tracks upstream errors without bypassing quota', () => {
    const ledger = new QuotaLedgerCore(createMemorySqlExecutor());
    const nowMs = Date.parse('2026-11-24T10:00:00+08:00');

    // 10 distinct visitors x 5 calls = 50 calls
    for (let v = 0; v < 10; v++) {
      for (let c = 0; c < 5; c++) {
        const res = ledger.reserve({
          visitorKey: `visitor-${v}`,
          visitorTag: `v_${v}`,
          ipHash: `ip_${v}`,
          model: DEFAULT_MODEL,
          reservedMicros: 100_000,
          nowMs: nowMs + v * 100 + c,
        });
        expect(res.allowed).toBe(true);
        if (res.allowed) {
          // Simulate upstream 429/5xx error on some calls: dollar reserve released, call count still retained!
          ledger.settle(
            {
              reservationId: res.reservationId,
              status: c === 4 ? 'upstream_error' : 'succeeded',
              settledMicros: c === 4 ? 0 : 20_000,
              errorCode: c === 4 ? 'HTTP_503' : null,
              nowMs: nowMs + v * 100 + c + 1,
            },
            `visitor-${v}`,
            `ip_${v}`
          );
        }
      }
    }

    // 11th fresh visitor makes call #51 -> rejected by site-wide cap
    const call51 = ledger.reserve({
      visitorKey: 'visitor-11',
      visitorTag: 'v_11',
      ipHash: 'ip_11',
      model: DEFAULT_MODEL,
      reservedMicros: 100_000,
      nowMs: nowMs + 50_000,
    });
    expect(call51.allowed).toBe(false);
    if (!call51.allowed) {
      expect(call51.rejectCode).toBe('SITE_DAILY_LIMIT_EXCEEDED');
      expect(call51.snapshot.site.used).toBe(50);
    }
  });

  it('enforces $40 cumulative hard budget under concurrent reservation pressure and conservative missing-usage accounting', async () => {
    const ledger = new QuotaLedgerCore(createMemorySqlExecutor());
    const day1 = Date.parse('2026-11-24T12:00:00+08:00');

    // Consume $39.70 across previous days (using large settled micros for test speed)
    const bigRes = ledger.reserve({
      visitorKey: 'seed-v',
      visitorTag: 'v_seed',
      ipHash: 'ip_seed',
      model: DEFAULT_MODEL,
      reservedMicros: 39_700_000,
      nowMs: day1 - 86_400_000,
    });
    expect(bigRes.allowed).toBe(true);
    if (bigRes.allowed) {
      // Simulate timeout / missing usage -> conservative strategy keeps full $39.70 charged!
      ledger.settle(
        {
          reservationId: bigRes.reservationId,
          status: 'timeout',
          nowMs: day1 - 86_400_000 + 35_000,
        },
        'seed-v',
        'ip_seed'
      );
    }

    // Only $0.30 (300,000 micros) remains in lifetime $40 budget.
    // Fire 10 concurrent reservations of $0.12 (120,000 micros) each from 10 different visitors.
    // Exactly 2 ($0.24) can succeed; the remaining 8 MUST be hard-rejected with BUDGET_EXHAUSTED!
    const concurrentResults = await Promise.all(
      Array.from({ length: 10 }, (_, i) =>
        Promise.resolve().then(() =>
          ledger.reserve({
            visitorKey: `race-v-${i}`,
            visitorTag: `v_r${i}`,
            ipHash: `ip_r${i}`,
            model: DEFAULT_MODEL,
            reservedMicros: 120_000,
            nowMs: day1 + i,
          })
        )
      )
    );

    const allowed = concurrentResults.filter((r) => r.allowed);
    const rejected = concurrentResults.filter((r) => !r.allowed);
    expect(allowed).toHaveLength(2);
    expect(rejected).toHaveLength(8);
    for (const r of rejected) {
      if (!r.allowed) expect(r.rejectCode).toBe('BUDGET_EXHAUSTED');
    }

    const status = ledger.getStatus({ visitorKey: 'race-v-0', ipHash: 'ip_r0', nowMs: day1 + 50 });
    expect(status.budget.spentMicros + status.budget.reservedMicros).toBeLessThanOrEqual(
      QUOTA_LIMITS.cumulativeBudgetMicros
    );
  });

  it('signs and verifies first-party HttpOnly visitor cookies and rejects tampered cookies', async () => {
    const secret = 'test-signing-secret-at-least-32-chars-long';
    const req1 = new Request('https://sartoria.zichengyu.com/api/llm/status', {
      headers: { 'CF-Connecting-IP': '203.0.113.42' },
    });
    const id1 = await resolveVisitorIdentity(req1, secret);
    expect(id1.setCookieHeader).toContain('sartoria_vid=');
    expect(id1.setCookieHeader).toContain('HttpOnly');
    expect(id1.setCookieHeader).toContain('Secure');
    expect(id1.setCookieHeader).toContain('SameSite=Lax');
    expect(id1.ipHash).toBeTruthy();
    expect(id1.ipHash).not.toContain('203.0.113.42');

    // Replay valid cookie -> same visitorKey, no Set-Cookie needed
    const cookiePair = id1.setCookieHeader!.split(';')[0];
    const req2 = new Request('https://sartoria.zichengyu.com/api/deconstruct', {
      headers: { Cookie: cookiePair, 'CF-Connecting-IP': '203.0.113.42' },
    });
    const id2 = await resolveVisitorIdentity(req2, secret);
    expect(id2.visitorKey).toBe(id1.visitorKey);
    expect(id2.setCookieHeader).toBeNull();

    // Tampered cookie -> rejected and freshly re-issued
    const reqTampered = new Request('https://sartoria.zichengyu.com/api/deconstruct', {
      headers: { Cookie: `${cookiePair.slice(0, -4)}dead`, 'CF-Connecting-IP': '203.0.113.42' },
    });
    const idTampered = await resolveVisitorIdentity(reqTampered, secret);
    expect(idTampered.visitorKey).not.toBe(id1.visitorKey);
    expect(idTampered.setCookieHeader).toContain('sartoria_vid=');
  });

  it('enforces schema validation, verbatim quote grounding, unspecified-color and no-cm guardrails', () => {
    const rawNarrative =
      '想要定制一件外套，简约大气新中式风格，正式一些。我身形偏高，肩背宽厚，不要压肩不卡手臂，宽松有质感。';

    const mockModelOutput = {
      schemaVersion: REQUIREMENT_SCHEMA_VERSION,
      aestheticArchetype: '简约大气新中式正装',
      emotionTags: ['简约大气', '松弛无束缚', '东方正式'],
      colorSpecifiedByUser: false,
      bodyErgonomics: ['高个宽厚肩背'],
      followUpQuestions: ['请问倾向深色系还是浅色系面料？'],
      officialSpecs: [
        {
          key: 'category',
          label: '品类',
          value: '外套',
          infoStatus: 'explicit',
          constraintKind: 'hard',
          sourceQuote: '定制一件外套',
          rationale: '客户原文明确要求',
          ergonomicCue: null,
        },
        {
          key: 'patternStructure',
          label: '版型结构',
          value: 'H型直身微落平肩',
          infoStatus: 'explicit',
          constraintKind: 'hard',
          sourceQuote: '我要修身鱼尾版型', // Hallucinated quote not in rawNarrative!
          rationale: '',
          ergonomicCue: '宽厚肩背',
        },
        {
          key: 'collar',
          label: '领型',
          value: '交领开襟无立领',
          infoStatus: 'suggested',
          constraintKind: 'soft',
          sourceQuote: null,
          rationale: '不压肩无束缚',
          ergonomicCue: null,
        },
        {
          key: 'fabric',
          label: '面料',
          value: '真丝暗纹织花',
          infoStatus: 'suggested',
          constraintKind: 'soft',
          sourceQuote: null,
          rationale: '挺而不硬',
          ergonomicCue: null,
        },
        {
          key: 'color',
          label: '色彩',
          value: '藏青色', // Model tried to invent a color despite colorSpecifiedByUser: false!
          infoStatus: 'suggested',
          constraintKind: 'soft',
          sourceQuote: null,
          rationale: '',
          ergonomicCue: null,
        },
        {
          key: 'motif',
          label: '装饰纹样',
          value: '低调小巧暗花',
          infoStatus: 'suggested',
          constraintKind: 'soft',
          sourceQuote: null,
          rationale: '',
          ergonomicCue: null,
        },
        {
          key: 'lengthRatio',
          label: '长度比例',
          value: '衣长至臀中位置',
          infoStatus: 'suggested',
          constraintKind: 'soft',
          sourceQuote: null,
          rationale: '',
          ergonomicCue: null,
        },
        {
          key: 'easeAllowance',
          label: '松弛余量',
          value: '肩背放量 +6cm，袖笼放量 4厘米', // Model tried to invent exact cm numbers!
          infoStatus: 'suggested',
          constraintKind: 'soft',
          sourceQuote: null,
          rationale: '',
          ergonomicCue: null,
        },
      ],
      threeBuckets: {
        userExplicit: ['定制外套，简约大气新中式，身形偏高肩背宽厚'],
        systemSuggested: ['建议 H 型微落平肩与交领开襟'],
        needsHumanVerification: [],
      },
    };

    const res = validateStructuredRequirement(mockModelOutput, rawNarrative);
    expect(res.ok).toBe(true);
    if (res.ok) {
      // 1. Valid quote preserved
      const cat = res.data.officialSpecs.find((s) => s.key === 'category')!;
      expect(cat.infoStatus).toBe('explicit');
      expect(cat.sourceQuote).toBe('定制一件外套');

      // 2. Hallucinated quote caught & downgraded to suggested
      const pat = res.data.officialSpecs.find((s) => s.key === 'patternStructure')!;
      expect(pat.infoStatus).toBe('suggested');
      expect(pat.sourceQuote).toBeNull();

      // 3. Invented color blocked & forced to unknown
      const col = res.data.officialSpecs.find((s) => s.key === 'color')!;
      expect(col.infoStatus).toBe('unknown');
      expect(col.value).toContain('不代客决定');

      // 4. Fabricated cm numbers stripped & forced to unknown
      const ease = res.data.officialSpecs.find((s) => s.key === 'easeAllowance')!;
      expect(ease.infoStatus).toBe('unknown');
      expect(ease.value).not.toMatch(/\d+\s*(?:cm|厘米)/i);
    }
  });
});
