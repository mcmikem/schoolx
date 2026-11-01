// Client-side semantic search powered by @xenova/transformers.
// Lazy-loaded so the ML model only downloads when actually used.

let pipeline: any = null;
let loading = false;

export async function ensureEmbedder() {
  if (pipeline) return pipeline;
  if (loading) return null;
  loading = true;
  try {
    const { pipeline: createPipeline } = await import("@xenova/transformers");
    pipeline = await createPipeline("feature-extraction", "Xenova/all-MiniLM-L6-v2");
    return pipeline;
  } catch (e) {
    const { logger } = await import("./logger");
    logger.error("Failed to load AI embedder:", e);
    loading = false;
    return null;
  }
}

export async function embedText(text: string): Promise<number[] | null> {
  const p = await ensureEmbedder();
  if (!p) return null;
  try {
    const out = await p(text, { pooling: "mean", normalize: true });
    return Array.from(out.data as number[]);
  } catch {
    return null;
  }
}

export function cosineSimilarity(a: number[], b: number[]): number {
  let dot = 0,
    na = 0,
    nb = 0;
  for (let i = 0; i < a.length; i++) {
    dot += a[i] * b[i];
    na += a[i] * a[i];
    nb += b[i] * b[i];
  }
  return dot / (Math.sqrt(na) * Math.sqrt(nb) || 1);
}
