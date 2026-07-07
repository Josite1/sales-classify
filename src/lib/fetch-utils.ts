/**
 * Safe fetch wrapper with AbortError handling.
 *
 * Next.js 16 + Turbopack may abort in-flight requests during HMR or React
 * concurrent re-renders, producing "signal is aborted without reason" errors.
 * This wrapper catches AbortError and auto-retries once before giving up.
 */

const MAX_RETRIES = 1;
const RETRY_DELAY_MS = 300;

function isAbortError(err: unknown): boolean {
  if (err instanceof DOMException && err.name === 'AbortError') return true;
  // Fallback for server-side (Node.js) where DOMException may not be available
  if (err instanceof Error && err.name === 'AbortError') return true;
  return false;
}

export async function safeFetch(
  input: RequestInfo | URL,
  init?: RequestInit,
  retries: number = MAX_RETRIES,
): Promise<Response> {
  for (let attempt = 0; attempt <= retries; attempt++) {
    try {
      const res = await fetch(input, init);
      return res;
    } catch (err) {
      // Only retry on AbortError — let other errors (network, etc.) propagate
      if (isAbortError(err) && attempt < retries) {
        console.warn(
          `[safeFetch] Request aborted, retrying (${attempt + 1}/${retries}): ${typeof input === 'string' ? input : input.toString()}`,
        );
        await new Promise((r) => setTimeout(r, RETRY_DELAY_MS * (attempt + 1)));
        continue;
      }
      throw err;
    }
  }
  // TypeScript narrows: unreachable, but satisfies return type
  throw new Error('safeFetch: unexpected — exhausted retries');
}
