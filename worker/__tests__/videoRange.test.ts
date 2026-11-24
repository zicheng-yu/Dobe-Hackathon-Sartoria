import { describe, expect, it } from 'vitest';
import {
  handleVideoRangeRequest,
  parseByteRange,
  type AssetFetcherLike,
} from '../videoRange.ts';

function createDeterministicPayload(size: number): Uint8Array {
  const buf = new Uint8Array(size);
  for (let i = 0; i < size; i += 1) {
    buf[i] = i % 251;
  }
  return buf;
}

function createChunkedMockAssets(
  payload: Uint8Array,
  chunkSize = 500
): { assets: AssetFetcherLike; getChunksRead: () => number; wasCancelled: () => boolean } {
  let chunksRead = 0;
  let cancelled = false;

  const assets: AssetFetcherLike = {
    async fetch(input: Request): Promise<Response> {
      const url = new URL(input.url);
      if (url.pathname !== '/video/sartoria-demo-3min.mp4') {
        return new Response('Not Found', { status: 404 });
      }
      if (input.method === 'HEAD') {
        return new Response(null, {
          status: 200,
          headers: {
            'Content-Type': 'video/mp4',
            'Content-Length': String(payload.byteLength),
            ETag: '"demo-mp4-v1"',
          },
        });
      }

      let cursor = 0;
      const stream = new ReadableStream<Uint8Array>({
        pull(controller) {
          if (cursor >= payload.byteLength) {
            controller.close();
            return;
          }
          const next = Math.min(payload.byteLength, cursor + chunkSize);
          chunksRead += 1;
          controller.enqueue(payload.subarray(cursor, next));
          cursor = next;
        },
        cancel() {
          cancelled = true;
        },
      });

      return new Response(stream, {
        status: 200,
        headers: {
          'Content-Type': 'video/mp4',
          'Content-Length': String(payload.byteLength),
          ETag: '"demo-mp4-v1"',
        },
      });
    },
  };

  return {
    assets,
    getChunksRead: () => chunksRead,
    wasCancelled: () => cancelled,
  };
}

describe('parseByteRange', () => {
  it('parses closed, open-ended, suffix, and clamped ranges cleanly', () => {
    expect(parseByteRange('bytes=0-1023', 4096)).toEqual({ kind: 'ok', start: 0, end: 1023 });
    expect(parseByteRange('bytes=500-', 4096)).toEqual({ kind: 'ok', start: 500, end: 4095 });
    expect(parseByteRange('bytes=-256', 4096)).toEqual({ kind: 'ok', start: 3840, end: 4095 });
    expect(parseByteRange('bytes=4000-99999', 4096)).toEqual({
      kind: 'ok',
      start: 4000,
      end: 4095,
    });
  });

  it('flags out-of-bounds or malformed bytes specs as unsatisfiable', () => {
    expect(parseByteRange('bytes=4096-5000', 4096)).toEqual({ kind: 'unsatisfiable' });
    expect(parseByteRange('bytes=300-200', 4096)).toEqual({ kind: 'unsatisfiable' });
    expect(parseByteRange('bytes=-0', 4096)).toEqual({ kind: 'unsatisfiable' });
    expect(parseByteRange('bytes=0-10, 20-30', 4096)).toEqual({ kind: 'unsatisfiable' });
    expect(parseByteRange('items=0-10', 4096)).toEqual({ kind: 'ignore' });
  });
});

describe('handleVideoRangeRequest', () => {
  const payload = createDeterministicPayload(4096);
  const videoUrl = 'https://sartoria.zichengyu.com/video/sartoria-demo-3min.mp4';

  it('serves HEAD with 200, Accept-Ranges, Content-Length, and empty body', async () => {
    const { assets, getChunksRead } = createChunkedMockAssets(payload);
    const res = await handleVideoRangeRequest(new Request(videoUrl, { method: 'HEAD' }), assets);
    expect(res.status).toBe(200);
    expect(res.headers.get('Accept-Ranges')).toBe('bytes');
    expect(res.headers.get('Content-Type')).toBe('video/mp4');
    expect(res.headers.get('Content-Length')).toBe('4096');
    expect(res.headers.get('ETag')).toBe('"demo-mp4-v1"');
    expect((await res.arrayBuffer()).byteLength).toBe(0);
    expect(getChunksRead()).toBe(0);
  });

  it('serves full GET without Range as 200 with Accept-Ranges: bytes', async () => {
    const { assets } = createChunkedMockAssets(payload);
    const res = await handleVideoRangeRequest(new Request(videoUrl, { method: 'GET' }), assets);
    expect(res.status).toBe(200);
    expect(res.headers.get('Accept-Ranges')).toBe('bytes');
    expect(res.headers.get('Content-Length')).toBe('4096');
    const body = new Uint8Array(await res.arrayBuffer());
    expect(body).toEqual(payload);
  });

  it('streams Range: bytes=0-1023 as 206 with exact bytes and cancels upstream early', async () => {
    const { assets, getChunksRead, wasCancelled } = createChunkedMockAssets(payload, 500);
    const res = await handleVideoRangeRequest(
      new Request(videoUrl, { headers: { Range: 'bytes=0-1023' } }),
      assets
    );
    expect(res.status).toBe(206);
    expect(res.headers.get('Accept-Ranges')).toBe('bytes');
    expect(res.headers.get('Content-Range')).toBe('bytes 0-1023/4096');
    expect(res.headers.get('Content-Length')).toBe('1024');
    const body = new Uint8Array(await res.arrayBuffer());
    expect(body.byteLength).toBe(1024);
    expect(body).toEqual(payload.subarray(0, 1024));
    expect(wasCancelled()).toBe(true);
    // 500-byte chunks: needs only 3 chunks (1500 bytes) instead of all 9 chunks (4096 bytes)
    expect(getChunksRead()).toBeLessThanOrEqual(4);
  });

  it('streams mid-file Range: bytes=1024-2047 across chunk boundaries cleanly', async () => {
    const { assets } = createChunkedMockAssets(payload, 500);
    const res = await handleVideoRangeRequest(
      new Request(videoUrl, { headers: { Range: 'bytes=1024-2047' } }),
      assets
    );
    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Range')).toBe('bytes 1024-2047/4096');
    expect(res.headers.get('Content-Length')).toBe('1024');
    const body = new Uint8Array(await res.arrayBuffer());
    expect(body).toEqual(payload.subarray(1024, 2048));
  });

  it('streams open-ended Range: bytes=500- to EOF', async () => {
    const { assets } = createChunkedMockAssets(payload, 500);
    const res = await handleVideoRangeRequest(
      new Request(videoUrl, { headers: { Range: 'bytes=500-' } }),
      assets
    );
    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Range')).toBe('bytes 500-4095/4096');
    expect(res.headers.get('Content-Length')).toBe('3596');
    const body = new Uint8Array(await res.arrayBuffer());
    expect(body).toEqual(payload.subarray(500));
  });

  it('streams suffix Range: bytes=-256 cleanly', async () => {
    const { assets } = createChunkedMockAssets(payload, 500);
    const res = await handleVideoRangeRequest(
      new Request(videoUrl, { headers: { Range: 'bytes=-256' } }),
      assets
    );
    expect(res.status).toBe(206);
    expect(res.headers.get('Content-Range')).toBe('bytes 3840-4095/4096');
    expect(res.headers.get('Content-Length')).toBe('256');
    const body = new Uint8Array(await res.arrayBuffer());
    expect(body).toEqual(payload.subarray(3840));
  });

  it('returns 416 Range Not Satisfiable for out-of-bounds ranges', async () => {
    const { assets } = createChunkedMockAssets(payload, 500);
    const res = await handleVideoRangeRequest(
      new Request(videoUrl, { headers: { Range: 'bytes=5000-6000' } }),
      assets
    );
    expect(res.status).toBe(416);
    expect(res.headers.get('Content-Range')).toBe('bytes */4096');
    expect(res.headers.get('Accept-Ranges')).toBe('bytes');
  });

  it('returns 404 for missing video and 405 for unsupported HTTP methods', async () => {
    const { assets } = createChunkedMockAssets(payload);
    const missing = await handleVideoRangeRequest(
      new Request('https://sartoria.zichengyu.com/video/missing.mp4'),
      assets
    );
    expect(missing.status).toBe(404);

    const post = await handleVideoRangeRequest(
      new Request(videoUrl, { method: 'POST' }),
      assets
    );
    expect(post.status).toBe(405);
  });
});
