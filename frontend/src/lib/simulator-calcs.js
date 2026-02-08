/**
 * Activity level & revenue proxy calculations for the simulator.
 * Combines:
 * - Extended revenue_proxy from data pipeline (run.js): employees, area, rating, price, popularity, tips, event_mult
 * - Optional rating_source_count (review count) as confidence/volume boost
 * - Java-style Insurance, Adjusted Revenue, Risk, Yield (Web3InsuranceSimulator) for the calculation panel
 */

const BASE = 5000;
const LONDON_CRIME = 65;
const LONDON_DENSITY = 100;
const MARKET_PRICE = 4.5;
const TH1 = 0.9;
const TH2 = 0.8;
const TH3 = 0.7;

/** Price tier to multiplier (revenue proxy). */
function priceMult(price) {
  if (!price) return 1;
  if (price === '£') return 1;
  if (price === '££') return 1.5;
  if (price === '£££') return 2;
  return 1;
}

/** Price tier to numeric GBP (for Java-style insurance formula). */
function priceToGbp(price) {
  if (price === '£££') return 6.5;
  if (price === '££') return 5.5;
  return 4.5;
}

/**
 * Extended revenue proxy (index, dimensionless).
 * Uses only fields present in pubs.csv: employees, floor_area_m2, avg_rating,
 * price_range, rating_source_count, event_multiplier. No popularity/total_tips.
 * Formula:
 *   revenue_proxy = BASE
 *     × (1 + 0.2 × employees)
 *     × (1 + 0.05 × (area/100))
 *     × (rating/5)                      // default 0.5 if missing
 *     × priceMult(price_range)
 *     × event_multiplier
 *     × (1 + 0.01 × min(rating_count, 100))
 */
export function revenueProxy(pub, opts = {}) {
  const emp = Math.max(0, opts.employees !== undefined ? Number(opts.employees) : Number(pub.employees) ?? 0);
  const area = Math.max(0, opts.area !== undefined ? Number(opts.area) : Number(pub.floor_area_m2) ?? 0);
  const rawRating = opts.rating !== undefined ? Number(opts.rating) : Number(pub.avg_rating);
  const rating = (Math.min(5, Math.max(0, rawRating ?? 0)) / 5) || 0.5;
  const ev = Math.max(0.5, Math.min(2, Number(opts.eventMult ?? pub.event_multiplier ?? 1)));
  const ratingCount = Math.min(100, Math.max(0, Number(opts.ratingCount ?? pub.rating_source_count ?? 0)));
  const hours = opts.hours !== undefined ? Number(opts.hours) : (pub._parsedHours?.dailyHours ?? 12);
  const lateHours = opts.lateHours !== undefined ? Number(opts.lateHours) : (pub._parsedHours?.lateHours ?? 0);
  const hoursMult = 1 + 0.08 * (hours - 12) / 12 + 0.12 * Math.log(1 + lateHours / 2);

  const v =
    BASE *
    (1 + 0.2 * emp) *
    (1 + 0.05 * (area / 100)) *
    (rating || 0.5) *
    priceMult(opts.price_range ?? pub.price_range) *
    ev *
    (1 + 0.01 * ratingCount) *
    Math.max(0.5, hoursMult);

  return Math.round(Math.max(0, v));
}

/**
 * Activity level: revenue_proxy normalized to 0–1 given current max.
 * Used for map colour/size.
 */
export function activityLevel(revenueProxyValue, maxRevenueProxy) {
  if (!maxRevenueProxy || maxRevenueProxy <= 0) return 0.5;
  return Math.min(1, Math.max(0, revenueProxyValue / maxRevenueProxy));
}

// ---------- Java-style metrics (for calculation panel) ----------

/**
 * Insurance premium (GBP). Same formula as Web3InsuranceSimulator.
 * pBase = area*2.5 + emp*450 + (rev/100k)*1200 + 800
 * risk terms: hours, price, rating, rent
 * ins = pBase * (1 + totalRisk) * londonMult
 */
export function insurancePremium(params) {
  const { area, employees, revenue, rent, rating, price, hours, lateHours } = params;
  const R = revenue / 100000;
  const pBase = area * 2.5 + employees * 450 + R * 1200 + 800;
  const hR = 0.15 * Math.log(1 + lateHours / 4) + 0.08 * (hours - 12) / 12;
  const pR = -0.08 * (price - MARKET_PRICE) / MARKET_PRICE + 0.12 * Math.pow(price / MARKET_PRICE, 2);
  const rR = 0.35 * Math.exp(-0.8 * (rating - 2.5)) - 0.15;
  const rnR = 0.05 * (rent / 40000 - 1);
  const tR = hR + pR + rR + rnR;
  const lM = 1 + 0.3 * (LONDON_CRIME / 100) + 0.15 * (LONDON_DENSITY / 100);
  return pBase * (1 + tR) * lM;
}

/**
 * Adjusted revenue (GBP). demand_mult from hours, late, rating; rev = inputRevenue * demand_mult.
 */
export function adjustedRevenue(params) {
  const { revenue, rating, hours, lateHours } = params;
  let dM = 1 + 0.08 * (hours - 12) / 12 + 0.12 * Math.log(1 + lateHours / 2) + 0.25 * (rating - 4);
  dM = Math.max(dM, 0.5);
  return revenue * dM;
}

export function riskLevel(revRatio) {
  if (revRatio >= 1) return 'Very Low';
  if (revRatio >= TH1) return 'Low';
  if (revRatio >= TH2) return 'Medium';
  if (revRatio >= TH3) return 'High';
  return 'Very High';
}

export function payoutAmount(revRatio, baseRev) {
  if (revRatio >= TH1) return 0;
  if (revRatio >= TH2) return baseRev * 0.05;
  if (revRatio >= TH3) return baseRev * 0.15;
  return baseRev * 0.3;
}

export function payoutPct(revRatio) {
  if (revRatio >= TH1) return 0;
  if (revRatio >= TH2) return 5;
  if (revRatio >= TH3) return 15;
  return 30;
}

export function payoutStatus(revRatio) {
  if (revRatio >= TH1) return 'Safe (>=90%)';
  if (revRatio >= TH2) return 'Warning (<90%)';
  if (revRatio >= TH3) return 'Alert (<80%)';
  return 'Critical (<70%)';
}

/** Build representative params from a pub (for panel). Revenue proxy → synthetic GBP. */
export function pubToPanelParams(pub, overrides = {}) {
  const revenueProxyVal = revenueProxy(pub, overrides);
  const revenueGbp = revenueProxyVal * 50; // scale to GBP for Java formulas
  const rent = revenueGbp * 0.08;
  const area = Math.max(50, Math.min(500, Number(pub.floor_area_m2) || 100));
  const employees = Math.max(1, Math.min(50, Number(pub.employees) || 5));
  const rating = Math.max(1, Math.min(5, Number(pub.avg_rating) || 4));
  const price = priceToGbp(pub.price_range);
  const hours = Math.max(8, Math.min(24, overrides.hours ?? 12));
  const lateHours = Math.max(0, Math.min(5, overrides.lateHours ?? 0));
  return {
    area,
    employees,
    revenue: revenueGbp,
    rent,
    rating: overrides.rating ?? rating,
    price: overrides.price ?? price,
    hours,
    lateHours,
  };
}
