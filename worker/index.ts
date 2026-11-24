import {
  computeActualCostMicros,
  computeConservativeReserveMicros,
  DEFAULT_MODEL,
  DEFAULT_REASONING_EFFORT,
  microsToUsd,
  QUOTA_LIMITS,
  type OpenAIUsagePayload,
} from './pricing.ts';
import { QuotaBudgetLedger } from './quotaLedger.ts';
import {
  REQUIREMENT_SCHEMA_VERSION,
  SARTORIA_REQUIREMENT_V1_SCHEMA,
  SARTORIA_SYSTEM_PROMPT,
  validateStructuredRequirement,
} from './schema.ts';
import { resolveVisitorIdentity } from './visitorAuth.ts';
import { handleVideoRangeRequest } from './videoRange.ts';

export { QuotaBudgetLedger };

export interface WorkerEnv {
  ASSETS: Fetcher;
  QUOTA_LEDGER: DurableObjectNamespace<QuotaBudgetLedger>;
  OPENAI_API_KEY?: string;
  VISITOR_SIGNING_SECRET?: string;
  OPENAI_MODEL?: string;
}

const OPENAI_RESPONSES_URL = 'https://api.openai.com/v1/responses';
const LEDGER_SINGLETON_NAME = 'sartoria-quota-budget-v1';

interface DeconstructApiBody {
  rawNarrative?: unknown;
  projectName?: unknown;
  clientName?: unknown;
  businessType?: unknown;
  season?: unknown;
  targetSceneId?: unknown;
}

function jsonResponse(
  payload: unknown,
  status: number,
  setCookieHeader?: string | null
): Response {
  const headers = new Headers({
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    'X-Content-Type-Options': 'nosniff',
  });
  if (setCookieHeader) {
    headers.append('Set-Cookie', setCookieHeader);
  }
  return new Response(JSON.stringify(payload), { status, headers });
}

function getSigningSecret(env: WorkerEnv): string {
  if (env.VISITOR_SIGNING_SECRET && env.VISITOR_SIGNING_SECRET.trim().length >= 16) {
    return env.VISITOR_SIGNING_SECRET.trim();
  }
  // Safe fallback for local dev if only OPENAI_API_KEY is set — never exposed in responses/logs
  if (env.OPENAI_API_KEY && env.OPENAI_API_KEY.trim().length > 0) {
    return `sartoria-derived-visitor-hmac:${env.OPENAI_API_KEY.trim().slice(-24)}`;
  }
  return 'sartoria-local-dev-ephemeral-visitor-hmac-key';
}

function extractResponseOutputText(payload: Record<string, unknown>): string | null {
  if (typeof payload.output_text === 'string' && payload.output_text.trim()) {
    return payload.output_text.trim();
  }
  if (!Array.isArray(payload.output)) return null;
  for (const item of payload.output) {
    if (!item || typeof item !== 'object') continue;
    const msg = item as Record<string, unknown>;
    if (msg.type === 'message' && Array.isArray(msg.content)) {
      for (const block of msg.content) {
        if (!block || typeof block !== 'object') continue;
        const part = block as Record<string, unknown>;
        if (part.type === 'output_text' && typeof part.text === 'string' && part.text.trim()) {
          return part.text.trim();
        }
      }
    }
  }
  return null;
}

function logStructuredEvent(event: Record<string, unknown>): void {
  // Structured observability log: NEVER contains API key, Authorization header, raw IP, or raw user narrative
  console.log(JSON.stringify({ service: 'sartoria-worker', ...event }));
}

async function handleStatus(request: Request, env: WorkerEnv): Promise<Response> {
  if (request.method !== 'GET') {
    return jsonResponse({ ok: false, errorCode: 'METHOD_NOT_ALLOWED', message: '仅支持 GET 请求' }, 405);
  }

  const identity = await resolveVisitorIdentity(request, getSigningSecret(env));
  const ledger = env.QUOTA_LEDGER.getByName(LEDGER_SINGLETON_NAME);
  const quota = await ledger.getStatus(identity.visitorKey, identity.ipHash);
  const configured = Boolean(env.OPENAI_API_KEY && env.OPENAI_API_KEY.trim().length > 0);
  const model = env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;

  return jsonResponse(
    {
      ok: true,
      configured,
      model,
      reasoningEffort: DEFAULT_REASONING_EFFORT,
      schemaVersion: REQUIREMENT_SCHEMA_VERSION,
      quota,
    },
    200,
    identity.setCookieHeader
  );
}

async function handleDeconstruct(request: Request, env: WorkerEnv): Promise<Response> {
  if (request.method !== 'POST') {
    return jsonResponse(
      { ok: false, errorCode: 'METHOD_NOT_ALLOWED', message: '仅支持 POST 请求' },
      405
    );
  }

  const identity = await resolveVisitorIdentity(request, getSigningSecret(env));
  const ledger = env.QUOTA_LEDGER.getByName(LEDGER_SINGLETON_NAME);
  const model = env.OPENAI_MODEL?.trim() || DEFAULT_MODEL;

  // 1. Local input validation BEFORE touching quota or OpenAI (YOU-247 #4)
  let body: DeconstructApiBody;
  try {
    body = (await request.json()) as DeconstructApiBody;
  } catch {
    return jsonResponse(
      { ok: false, errorCode: 'INVALID_INPUT', message: '请求体必须是合法 JSON' },
      400,
      identity.setCookieHeader
    );
  }

  const rawNarrative = typeof body.rawNarrative === 'string' ? body.rawNarrative.trim() : '';
  if (!rawNarrative) {
    return jsonResponse(
      { ok: false, errorCode: 'INVALID_INPUT', message: '请输入客户定制需求后再拆解' },
      400,
      identity.setCookieHeader
    );
  }
  if (rawNarrative.length > QUOTA_LIMITS.maxInputChars) {
    return jsonResponse(
      {
        ok: false,
        errorCode: 'INPUT_TOO_LONG',
        message: `需求描述超过长度限制（最多 ${QUOTA_LIMITS.maxInputChars} 字符）`,
      },
      400,
      identity.setCookieHeader
    );
  }

  // 2. Check server-side Secret availability without leaking internal details (YOU-246 #4)
  const apiKey = env.OPENAI_API_KEY?.trim();
  if (!apiKey) {
    const quota = await ledger.getStatus(identity.visitorKey, identity.ipHash);
    logStructuredEvent({
      event: 'deconstruct_not_configured',
      dateShanghai: quota.dateShanghai,
      visitorTag: identity.visitorTag,
      model,
      rejectReason: 'NOT_CONFIGURED',
    });
    return jsonResponse(
      {
        ok: false,
        errorCode: 'NOT_CONFIGURED',
        message: '在线 AI 服务暂未配置服务端密钥，请直接使用本地规则引擎继续完成拆解与选配。',
        quota,
      },
      503,
      identity.setCookieHeader
    );
  }

  const businessType =
    body.businessType === 'corporate_uniform' ? '团体职业服' : '个人高级定制';
  const season = typeof body.season === 'string' ? body.season.slice(0, 24) : 'autumn';
  const projectName =
    typeof body.projectName === 'string' ? body.projectName.trim().slice(0, 80) : '';

  const userPrompt = [
    `业务类型：${businessType}`,
    `主穿季候：${season}`,
    projectName ? `项目参考名称：${projectName}` : '',
    `客户原始需求原文：`,
    rawNarrative,
  ]
    .filter(Boolean)
    .join('\n');

  // 3. Atomic pre-call quota & $40 budget reservation in Durable Object (YOU-247 #2, #3, #6)
  const reservedMicros = computeConservativeReserveMicros(
    model,
    userPrompt.length,
    QUOTA_LIMITS.maxOutputTokens
  );

  const reservation = await ledger.reserve({
    visitorKey: identity.visitorKey,
    visitorTag: identity.visitorTag,
    ipHash: identity.ipHash,
    model,
    reservedMicros,
  });

  if (!reservation.allowed) {
    logStructuredEvent({
      event: 'deconstruct_rejected',
      dateShanghai: reservation.snapshot.dateShanghai,
      visitorTag: identity.visitorTag,
      model,
      rejectReason: reservation.rejectCode,
      visitorUsed: reservation.snapshot.visitor.used,
      siteUsed: reservation.snapshot.site.used,
      spentUsd: reservation.snapshot.budget.spentUsd,
    });
    const httpStatus = reservation.rejectCode === 'BUDGET_EXHAUSTED' ? 402 : 429;
    return jsonResponse(
      {
        ok: false,
        errorCode: reservation.rejectCode,
        message: reservation.message,
        quota: reservation.snapshot,
      },
      httpStatus,
      identity.setCookieHeader
    );
  }

  // 4. Call OpenAI Responses API server-side with Strict JSON Schema (YOU-246 & YOU-241)
  let upstreamRes: Response;
  try {
    upstreamRes = await fetch(OPENAI_RESPONSES_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${apiKey}`,
      },
      signal: AbortSignal.timeout(QUOTA_LIMITS.upstreamTimeoutMs),
      body: JSON.stringify({
        model,
        reasoning: { effort: DEFAULT_REASONING_EFFORT },
        max_output_tokens: QUOTA_LIMITS.maxOutputTokens,
        store: false,
        input: [
          { role: 'system', content: SARTORIA_SYSTEM_PROMPT },
          { role: 'user', content: userPrompt },
        ],
        text: {
          format: {
            type: 'json_schema',
            name: REQUIREMENT_SCHEMA_VERSION,
            strict: true,
            schema: SARTORIA_REQUIREMENT_V1_SCHEMA,
          },
        },
      }),
    });
  } catch (err) {
    const isTimeout = err instanceof Error && (err.name === 'TimeoutError' || err.name === 'AbortError');
    const status = isTimeout ? 'timeout' : 'upstream_error';
    const quotaAfter = await ledger.settle(
      {
        reservationId: reservation.reservationId,
        status,
        settledMicros: isTimeout ? reservation.reservedMicros : 0,
        errorCode: isTimeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_NETWORK_ERROR',
      },
      identity.visitorKey,
      identity.ipHash
    );
    logStructuredEvent({
      event: 'deconstruct_upstream_exception',
      dateShanghai: quotaAfter.dateShanghai,
      visitorTag: identity.visitorTag,
      model,
      status,
      settledUsd: microsToUsd(isTimeout ? reservation.reservedMicros : 0),
    });
    return jsonResponse(
      {
        ok: false,
        errorCode: isTimeout ? 'UPSTREAM_TIMEOUT' : 'UPSTREAM_ERROR',
        message: isTimeout
          ? '在线 AI 响应超时，请稍后重试或切换本地规则引擎继续。'
          : '在线 AI 服务暂时不可用，请稍后重试或切换本地规则引擎继续。',
        quota: quotaAfter,
      },
      isTimeout ? 504 : 502,
      identity.setCookieHeader
    );
  }

  // Handle non-2xx upstream status cleanly without echoing sensitive headers/errors
  if (!upstreamRes.ok) {
    const upstreamStatus = upstreamRes.status;
    // Drain/cancel body safely without buffering unbounded data
    await upstreamRes.body?.cancel().catch(() => {});

    const quotaAfter = await ledger.settle(
      {
        reservationId: reservation.reservationId,
        status: 'upstream_error',
        settledMicros: 0,
        errorCode: `HTTP_${upstreamStatus}`,
      },
      identity.visitorKey,
      identity.ipHash
    );
    logStructuredEvent({
      event: 'deconstruct_upstream_http_error',
      dateShanghai: quotaAfter.dateShanghai,
      visitorTag: identity.visitorTag,
      model,
      upstreamStatus,
      settledUsd: 0,
    });
    return jsonResponse(
      {
        ok: false,
        errorCode: upstreamStatus === 429 ? 'UPSTREAM_RATE_LIMITED' : 'UPSTREAM_ERROR',
        message:
          upstreamStatus === 429
            ? '上游模型请求繁忙，请稍后再试或切换本地规则引擎继续。'
            : '在线 AI 服务返回异常，未暴露内部配置；请重试或切换本地规则引擎继续。',
        quota: quotaAfter,
      },
      upstreamStatus === 429 ? 503 : 502,
      identity.setCookieHeader
    );
  }

  let responseJson: Record<string, unknown>;
  try {
    responseJson = (await upstreamRes.json()) as Record<string, unknown>;
  } catch {
    const quotaAfter = await ledger.settle(
      {
        reservationId: reservation.reservationId,
        status: 'usage_missing',
        settledMicros: reservation.reservedMicros,
        errorCode: 'INVALID_UPSTREAM_JSON',
      },
      identity.visitorKey,
      identity.ipHash
    );
    return jsonResponse(
      {
        ok: false,
        errorCode: 'SCHEMA_VALIDATION_FAILED',
        message: '模型响应格式异常，已保守记账并拦截无效输出，请重试或切换本地规则引擎。',
        quota: quotaAfter,
      },
      502,
      identity.setCookieHeader
    );
  }

  // 5. Reconcile exact token usage cost (conservative fallback if usage missing — YOU-247 #7)
  const usage = responseJson.usage as OpenAIUsagePayload | undefined;
  const computedMicros = computeActualCostMicros(model, usage);
  const usageMissing = computedMicros === null;
  const settledMicros = usageMissing ? reservation.reservedMicros : computedMicros;

  const outputText = extractResponseOutputText(responseJson);
  if (!outputText) {
    const quotaAfter = await ledger.settle(
      {
        reservationId: reservation.reservationId,
        status: usageMissing ? 'usage_missing' : 'schema_invalid',
        inputTokens: usage?.input_tokens ?? null,
        cachedTokens: usage?.input_tokens_details?.cached_tokens ?? null,
        outputTokens: usage?.output_tokens ?? null,
        settledMicros,
        errorCode: 'EMPTY_OUTPUT_TEXT',
      },
      identity.visitorKey,
      identity.ipHash
    );
    return jsonResponse(
      {
        ok: false,
        errorCode: 'SCHEMA_VALIDATION_FAILED',
        message: '在线模型未返回可解析的结构化结果，请重试或改用本地规则引擎。',
        quota: quotaAfter,
      },
      422,
      identity.setCookieHeader
    );
  }

  let parsedOutput: unknown;
  try {
    parsedOutput = JSON.parse(outputText);
  } catch {
    const quotaAfter = await ledger.settle(
      {
        reservationId: reservation.reservationId,
        status: usageMissing ? 'usage_missing' : 'schema_invalid',
        inputTokens: usage?.input_tokens ?? null,
        cachedTokens: usage?.input_tokens_details?.cached_tokens ?? null,
        outputTokens: usage?.output_tokens ?? null,
        settledMicros,
        errorCode: 'JSON_PARSE_FAILED',
      },
      identity.visitorKey,
      identity.ipHash
    );
    return jsonResponse(
      {
        ok: false,
        errorCode: 'SCHEMA_VALIDATION_FAILED',
        message: '模型输出 JSON 解析失败，已阻止进入下游匹配，请重试或切换本地规则引擎。',
        quota: quotaAfter,
      },
      422,
      identity.setCookieHeader
    );
  }

  // 6. Strict Schema + Semantic Validation (YOU-241)
  const validation = validateStructuredRequirement(parsedOutput, rawNarrative);
  if (!validation.ok) {
    const quotaAfter = await ledger.settle(
      {
        reservationId: reservation.reservationId,
        status: usageMissing ? 'usage_missing' : 'schema_invalid',
        inputTokens: usage?.input_tokens ?? null,
        cachedTokens: usage?.input_tokens_details?.cached_tokens ?? null,
        outputTokens: usage?.output_tokens ?? null,
        settledMicros,
        errorCode: 'SEMANTIC_VALIDATION_FAILED',
      },
      identity.visitorKey,
      identity.ipHash
    );
    logStructuredEvent({
      event: 'deconstruct_schema_invalid',
      dateShanghai: quotaAfter.dateShanghai,
      visitorTag: identity.visitorTag,
      model,
      settledUsd: microsToUsd(settledMicros),
      rejectReason: validation.reason,
    });
    return jsonResponse(
      {
        ok: false,
        errorCode: 'SCHEMA_VALIDATION_FAILED',
        message: `模型输出未通过结构化业务校验（${validation.reason}），请重试或切换本地规则引擎。`,
        quota: quotaAfter,
      },
      422,
      identity.setCookieHeader
    );
  }

  const quotaAfter = await ledger.settle(
    {
      reservationId: reservation.reservationId,
      status: usageMissing ? 'usage_missing' : 'succeeded',
      inputTokens: usage?.input_tokens ?? null,
      cachedTokens: usage?.input_tokens_details?.cached_tokens ?? null,
      outputTokens: usage?.output_tokens ?? null,
      settledMicros,
    },
    identity.visitorKey,
    identity.ipHash
  );

  logStructuredEvent({
    event: 'deconstruct_succeeded',
    dateShanghai: quotaAfter.dateShanghai,
    visitorTag: identity.visitorTag,
    model,
    inputTokens: usage?.input_tokens ?? null,
    cachedTokens: usage?.input_tokens_details?.cached_tokens ?? null,
    outputTokens: usage?.output_tokens ?? null,
    settledUsd: microsToUsd(settledMicros),
    usageMissing,
    warningCount: validation.warnings.length,
  });

  return jsonResponse(
    {
      ok: true,
      result: validation.data,
      warnings: validation.warnings,
      meta: {
        model,
        reasoningEffort: DEFAULT_REASONING_EFFORT,
        schemaVersion: REQUIREMENT_SCHEMA_VERSION,
        usage: usage
          ? {
              inputTokens: usage.input_tokens ?? 0,
              cachedTokens: usage.input_tokens_details?.cached_tokens ?? 0,
              outputTokens: usage.output_tokens ?? 0,
              reasoningTokens: usage.output_tokens_details?.reasoning_tokens ?? 0,
            }
          : null,
        costUsd: microsToUsd(settledMicros),
        conservativeCostApplied: usageMissing,
      },
      quota: quotaAfter,
    },
    200,
    identity.setCookieHeader
  );
}

export default {
  async fetch(request: Request, env: WorkerEnv): Promise<Response> {
    const url = new URL(request.url);

    if (url.pathname === '/api/llm/status') {
      return handleStatus(request, env);
    }

    if (url.pathname === '/api/deconstruct') {
      return handleDeconstruct(request, env);
    }

    if (url.pathname.startsWith('/api/')) {
      return jsonResponse({ ok: false, errorCode: 'NOT_FOUND', message: 'API 路径不存在' }, 404);
    }

    if (url.pathname.startsWith('/video/') && url.pathname.endsWith('.mp4')) {
      return handleVideoRangeRequest(request, env.ASSETS);
    }

    return env.ASSETS.fetch(request);
  },
};
