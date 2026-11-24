/**
 * Streaming HTTP 206 Byte-Range handler for static MP4 assets served via Cloudflare Workers ASSETS.
 * Avoids buffering full video payloads in Worker memory by slicing ReadableStream chunks on the fly
 * and cancelling the upstream stream immediately once the requested end byte has been delivered.
 */

export interface AssetFetcherLike {
  fetch(input: Request): Promise<Response>;
}

export type ParsedByteRange =
  | { kind: 'ok'; start: number; end: number }
  | { kind: 'unsatisfiable' }
  | { kind: 'ignore' };

export function parseByteRange(rangeHeader: string, totalSize: number): ParsedByteRange {
  const trimmed = rangeHeader.trim();
  const eqIdx = trimmed.indexOf('=');
  if (eqIdx <= 0) {
    return { kind: 'ignore' };
  }

  const unit = trimmed.slice(0, eqIdx).trim().toLowerCase();
  if (unit !== 'bytes') {
    return { kind: 'ignore' };
  }

  if (totalSize <= 0) {
    return { kind: 'unsatisfiable' };
  }

  const spec = trimmed.slice(eqIdx + 1).trim();
  // Reject multi-range or empty specs
  if (!spec || spec.includes(',')) {
    return { kind: 'unsatisfiable' };
  }

  const dashIdx = spec.indexOf('-');
  if (dashIdx === -1) {
    return { kind: 'unsatisfiable' };
  }

  const startStr = spec.slice(0, dashIdx).trim();
  const endStr = spec.slice(dashIdx + 1).trim();

  // Suffix range: bytes=-<suffixLength>
  if (startStr === '') {
    if (!/^\d+$/.test(endStr)) {
      return { kind: 'unsatisfiable' };
    }
    const suffix = Number(endStr);
    if (!Number.isSafeInteger(suffix) || suffix <= 0) {
      return { kind: 'unsatisfiable' };
    }
    const start = Math.max(0, totalSize - suffix);
    return { kind: 'ok', start, end: totalSize - 1 };
  }

  if (!/^\d+$/.test(startStr)) {
    return { kind: 'unsatisfiable' };
  }
  const start = Number(startStr);
  if (!Number.isSafeInteger(start) || start < 0 || start >= totalSize) {
    return { kind: 'unsatisfiable' };
  }

  // Open-ended range: bytes=<start>-
  if (endStr === '') {
    return { kind: 'ok', start, end: totalSize - 1 };
  }

  if (!/^\d+$/.test(endStr)) {
    return { kind: 'unsatisfiable' };
  }
  const requestedEnd = Number(endStr);
  if (!Number.isSafeInteger(requestedEnd) || requestedEnd < start) {
    return { kind: 'unsatisfiable' };
  }

  const end = Math.min(requestedEnd, totalSize - 1);
  return { kind: 'ok', start, end };
}

export function createByteRangeStream(
  source: ReadableStream<Uint8Array>,
  start: number,
  end: number
): ReadableStream<Uint8Array> {
  const reader = source.getReader();
  let offset = 0;
  let finished = false;

  return new ReadableStream<Uint8Array>({
    async pull(controller) {
      if (finished) return;
      try {
        while (true) {
          const { done, value } = await reader.read();
          if (done || !value) {
            finished = true;
            controller.close();
            return;
          }

          const chunkStart = offset;
          const chunkEnd = offset + value.byteLength - 1;
          offset += value.byteLength;

          if (chunkEnd < start) {
            continue;
          }

          const sliceStart = Math.max(0, start - chunkStart);
          const sliceEndExclusive = Math.min(value.byteLength, end - chunkStart + 1);

          if (sliceEndExclusive > sliceStart) {
            controller.enqueue(value.subarray(sliceStart, sliceEndExclusive));
          }

          if (chunkEnd >= end) {
            finished = true;
            await reader.cancel().catch(() => {});
            controller.close();
            return;
          }

          if (sliceEndExclusive > sliceStart) {
            return;
          }
        }
      } catch (err) {
        finished = true;
        await reader.cancel().catch(() => {});
        controller.error(err);
      }
    },
    async cancel(reason) {
      finished = true;
      await reader.cancel(reason).catch(() => {});
    },
  });
}

function buildBaseVideoHeaders(upstream: Response): Headers {
  const headers = new Headers({
    'Content-Type': 'video/mp4',
    'Accept-Ranges': 'bytes',
    'Cache-Control': 'public, max-age=3600',
    'X-Content-Type-Options': 'nosniff',
  });
  const etag = upstream.headers.get('ETag');
  if (etag) {
    headers.set('ETag', etag);
  }
  const lastModified = upstream.headers.get('Last-Modified');
  if (lastModified) {
    headers.set('Last-Modified', lastModified);
  }
  return headers;
}

function parseContentLength(res: Response): number | null {
  const raw = res.headers.get('Content-Length');
  if (!raw || !/^\d+$/.test(raw.trim())) {
    return null;
  }
  const parsed = Number(raw.trim());
  return Number.isSafeInteger(parsed) && parsed >= 0 ? parsed : null;
}

export async function handleVideoRangeRequest(
  request: Request,
  assets: AssetFetcherLike
): Promise<Response> {
  const method = request.method.toUpperCase();
  if (method !== 'GET' && method !== 'HEAD') {
    return new Response('Method Not Allowed', {
      status: 405,
      headers: { Allow: 'GET, HEAD' },
    });
  }

  // For HEAD requests, try upstream HEAD first so we avoid opening a body stream whenever possible.
  if (method === 'HEAD') {
    const headReq = new Request(request.url, {
      method: 'HEAD',
      headers: { 'Accept-Encoding': 'identity' },
    });
    const headRes = await assets.fetch(headReq);
    if (headRes.status === 404) {
      return headRes;
    }
    const headSize = headRes.ok ? parseContentLength(headRes) : null;
    if (headRes.ok && headSize !== null) {
      await headRes.body?.cancel().catch(() => {});
      const headers = buildBaseVideoHeaders(headRes);
      headers.set('Content-Length', String(headSize));
      return new Response(null, { status: 200, headers });
    }
    await headRes.body?.cancel().catch(() => {});
  }

  // Fetch uncompressed full asset without client Range header so byte offsets are deterministic.
  const assetReq = new Request(request.url, {
    method: 'GET',
    headers: { 'Accept-Encoding': 'identity' },
  });
  const assetRes = await assets.fetch(assetReq);
  if (!assetRes.ok) {
    return assetRes;
  }

  const headers = buildBaseVideoHeaders(assetRes);
  const headerSize = parseContentLength(assetRes);

  // Fast streaming path when upstream provides exact Content-Length (standard for Cloudflare ASSETS)
  if (headerSize !== null) {
    if (method === 'HEAD') {
      await assetRes.body?.cancel().catch(() => {});
      headers.set('Content-Length', String(headerSize));
      return new Response(null, { status: 200, headers });
    }

    const rangeHeader = request.headers.get('Range');
    if (!rangeHeader) {
      headers.set('Content-Length', String(headerSize));
      return new Response(assetRes.body, { status: 200, headers });
    }

    const parsed = parseByteRange(rangeHeader, headerSize);
    if (parsed.kind === 'ignore') {
      headers.set('Content-Length', String(headerSize));
      return new Response(assetRes.body, { status: 200, headers });
    }

    if (parsed.kind === 'unsatisfiable') {
      await assetRes.body?.cancel().catch(() => {});
      headers.set('Content-Range', `bytes */${headerSize}`);
      return new Response(null, { status: 416, headers });
    }

    const { start, end } = parsed;
    const sliceLen = end - start + 1;
    headers.set('Content-Range', `bytes ${start}-${end}/${headerSize}`);
    headers.set('Content-Length', String(sliceLen));

    if (!assetRes.body) {
      return new Response(null, { status: 500 });
    }

    const rangedStream = createByteRangeStream(assetRes.body, start, end);
    return new Response(rangedStream, { status: 206, headers });
  }

  // Defensive fallback only if upstream omits Content-Length
  const fullBytes = new Uint8Array(await assetRes.arrayBuffer());
  const totalSize = fullBytes.byteLength;

  if (method === 'HEAD') {
    headers.set('Content-Length', String(totalSize));
    return new Response(null, { status: 200, headers });
  }

  const rangeHeader = request.headers.get('Range');
  if (!rangeHeader) {
    headers.set('Content-Length', String(totalSize));
    return new Response(fullBytes, { status: 200, headers });
  }

  const parsed = parseByteRange(rangeHeader, totalSize);
  if (parsed.kind === 'ignore') {
    headers.set('Content-Length', String(totalSize));
    return new Response(fullBytes, { status: 200, headers });
  }

  if (parsed.kind === 'unsatisfiable') {
    headers.set('Content-Range', `bytes */${totalSize}`);
    return new Response(null, { status: 416, headers });
  }

  const slice = fullBytes.subarray(parsed.start, parsed.end + 1);
  headers.set('Content-Range', `bytes ${parsed.start}-${parsed.end}/${totalSize}`);
  headers.set('Content-Length', String(slice.byteLength));
  return new Response(slice, { status: 206, headers });
}
