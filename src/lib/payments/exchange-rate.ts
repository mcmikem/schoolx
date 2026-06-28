import { createSupabaseServerClient } from "../supabase/server";

const FALLBACK_RATE = Number(process.env.FX_RATE_FALLBACK) || 3700;

export async function getExchangeRate(
  from = "USD",
  to = "UGX",
): Promise<number> {
  try {
    const supabase = await createSupabaseServerClient();
    const { data, error } = await supabase
      .from("exchange_rates")
      .select("rate")
      .eq("from_currency", from.toUpperCase())
      .eq("to_currency", to.toUpperCase())
      .is("valid_until", null)
      .order("created_at", { ascending: false })
      .limit(1)
      .single();

    if (error || !data) return FALLBACK_RATE;
    return Number(data.rate);
  } catch {
    return FALLBACK_RATE;
  }
}

export function getCentsToUgx(cents: number, rate: number): number {
  return Math.round((cents / 100) * rate);
}
