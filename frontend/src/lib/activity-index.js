/**
 * Activity Index – based parametric risk pricing (Flare Data Connector demo).
 * Transparent logic: baseline = 100, sliders affect index multiplicatively.
 * Thresholds and yields are explicit constants for judge-friendly tweaking.
 *
 * === MATHEMATICAL FORMULA FOR CURRENT ACTIVITY INDEX ===
 *
 *   Current Activity Index = 100 × (P_current / P_baseline)
 *
 * where P_current and P_baseline are the same "activity proxy" formula P below,
 * evaluated at different inputs:
 *   P_baseline = P(pub's real data)   → index 100 when sliders match real data
 *   P_current  = P(current slider values)
 *
 * So the index is a ratio: >100 means scenario is better than baseline, <100 worse.
 *
 * === ACTIVITY PROXY P (underlying formula) ===
 *
 *   P = 5000
 *     × (1 + 0.2 × E)              — staffing factor
 *     × (1 + 0.05 × A/100)         — floor space factor
 *     × (R/5)                      — quality factor (rating 0–5 → 0–1)
 *     × M_price                    — price tier (£=1, ££=1.5, £££=2)
 *     × Φ                          — event multiplier (e.g. football days)
 *     × (1 + 0.01 × min(N, 100))   — review volume factor
 *     × H                          — trading hours factor
 *
 * Factor justifications:
 *   E (employees): More staff → higher capacity and turnover. +20% per employee.
 *   A (floor_area_m²): Larger premises → more capacity. +5% per 100 m².
 *   R (avg_rating 1–5): Quality signal; scales 0–1. Missing → 0.5.
 *   M_price: Higher price tier → higher spend per head.
 *   Φ (event_multiplier): e.g. match days boost footfall; 0.5–2.
 *   N (rating_source_count): More reviews → more visibility/confidence; cap 100, +1% each.
 *   H (hours factor): H = max(0.5, 1 + 0.08×(hours−12)/12 + 0.12×ln(1 + late/2)).
 *     Longer hours and late trading → more revenue opportunity.
 *
 * P is dimensionless (an index). Only the ratio P_current/P_baseline matters for the Activity Index.
 */

// --- Activity Index (normalized to 100 at baseline) ---
export const ACTIVITY_INDEX_BASELINE = 100;

/**
 * Current activity index for a pub.
 * Index = 100 × (currentProxy / baselineProxy).
 */
export function currentActivityIndex(baselineProxy, currentProxy) {
  if (!baselineProxy || baselineProxy <= 0) return ACTIVITY_INDEX_BASELINE;
  const ratio = currentProxy / baselineProxy;
  return Math.round(ratio * ACTIVITY_INDEX_BASELINE);
}

// --- Parametric threshold bands (easy to tweak) ---
export const THRESHOLDS = {
  /** ≥ this = Low (normal variance) */
  LOW: 90,
  /** 80–90 = Medium (mild external shock) */
  MEDIUM: 80,
  /** 65–80 = High (multiple negative signals). Below = Severe */
  HIGH: 65,
};

export const RISK_TIERS = ['Low', 'Medium', 'High', 'Severe'];

/** Risk tier from current activity index. */
export function riskTierFromIndex(activityIndex) {
  if (activityIndex >= THRESHOLDS.LOW) return 'Low';
  if (activityIndex >= THRESHOLDS.MEDIUM) return 'Medium';
  if (activityIndex >= THRESHOLDS.HIGH) return 'High';
  return 'Severe';
}

/** Short interpretation for UI. */
export const TIER_INTERPRETATION = {
  Low: 'Normal variance',
  Medium: 'Mild external shock',
  High: 'Multiple negative signals',
  Severe: 'Compound shock',
};

// --- Yield (compensation for absorbing downside risk) ---
export const YIELD_BY_TIER = {
  Low: 4,
  Medium: 6,
  High: 9,
  Severe: 12,
};

/** Annualized yield % for a risk tier. */
export function yieldForTier(tier) {
  return YIELD_BY_TIER[tier] ?? YIELD_BY_TIER.Low;
}

// --- Payout (parametric: when index falls below thresholds) ---
/** Payout as fraction of exposure when in each tier (0 = no payout in Low). */
export const PAYOUT_FRACTION_BY_TIER = {
  Low: 0,
  Medium: 0.05,
  High: 0.15,
  Severe: 0.30,
};

/** Demo exposure per pub (GBP). Single number for clarity. */
export const EXPOSURE_PER_PUB = 10_000;

/** Payout amount when in a given tier (0 if Low). */
export function payoutForTier(tier) {
  const frac = PAYOUT_FRACTION_BY_TIER[tier] ?? 0;
  return Math.round(EXPOSURE_PER_PUB * frac);
}

/** Whether current tier triggers a payout. */
export function isPayoutTriggered(tier) {
  return tier !== 'Low';
}

// --- Capital pool (demo) ---
export const POOL_INITIAL_GBP = 500_000;
