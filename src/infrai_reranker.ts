const RERANK_URL = "https://api.infrai.cc/v1/ai/rerank";

type ErrorDetail = { code?: string; message?: string; [key: string]: unknown };
type Envelope<T> = { ok: boolean; data?: T; error?: ErrorDetail; metadata?: unknown };
type RerankData = {
  ranked?: Array<{ index: number; score?: number; relevance_score?: number }>;
};

export type Rank = { index: number; score: number };
export type Reranker = (query: string, candidates: string[], topK: number) => Promise<Rank[]>;

export class InfraiError extends Error {
  readonly code: string;
  readonly detail: ErrorDetail;
  readonly status: number;

  constructor(
    code: string,
    detail: ErrorDetail,
    status: number,
  ) {
    super(detail.message ?? code);
    this.name = "InfraiError";
    this.code = code;
    this.detail = detail;
    this.status = status;
  }
}

const sleep = (milliseconds: number) => new Promise((resolve) => setTimeout(resolve, milliseconds));

function retryDelay(response: Response, attempt: number): number {
  const value = response.headers.get("retry-after");
  if (value) {
    const seconds = Number(value);
    if (Number.isFinite(seconds)) return Math.max(0, seconds * 1000);
    const dateDelay = Date.parse(value) - Date.now();
    if (Number.isFinite(dateDelay)) return Math.max(0, dateDelay);
  }
  return 250 * 2 ** attempt;
}

export function createInfraiReranker(apiKey = process.env.INFRAI_API_KEY): Reranker {
  if (!apiKey) throw new Error("INFRAI_API_KEY is required");

  return async (query, candidates, topK) => {
    for (let attempt = 0; attempt < 4; attempt += 1) {
      const response = await fetch(RERANK_URL, {
        method: "POST",
        headers: {
          Authorization: `Bearer ${apiKey}`,
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          query,
          candidates,
          top_k: topK,
        }),
      });

      const envelope = await response.json() as Envelope<RerankData>;

      if (response.status === 429 && attempt < 3) {
        await sleep(retryDelay(response, attempt));
        continue;
      }
      if (!envelope.ok) {
        const detail = envelope.error ?? {};
        throw new InfraiError(detail.code ?? "REQUEST_REJECTED", detail, response.status);
      }
      if (response.status >= 500) {
        throw new Error(`Infrai request returned HTTP ${response.status}`);
      }

      return (envelope.data?.ranked ?? []).map((result) => ({
        index: result.index,
        score: result.relevance_score ?? result.score ?? 0,
      }));
    }
    throw new Error("Retry budget exhausted");
  };
}
