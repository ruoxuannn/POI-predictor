#!/usr/bin/env node
/**
 * Fetch price_level from Google Places API (REST). Only runs for pubs that already
 * have full data: floor_area_m2, employees, avg_rating, opening_hours.
 *
 * API usage (per-request billing, NOT tokens):
 * - Find Place from Text: request only field "place_id".
 * - Place Details: request only field "price_level" (0–4 → £, ££, £££).
 * No AI/generative APIs; cost is per request.
 *
 * Env: GOOGLE_MAPS_API_KEY (required)
 * Input: storage/pubs_merged.json (current data), storage/pois_osm.json (for name/address/coords). No other API calls.
 * Output: storage/price_range.json  [{ osm_id, price_range }, ...]
 */

const fs = require('fs');
const path = require('path');

const DIR = path.resolve(__dirname, '..');
const STORAGE = path.join(DIR, 'storage');
const MERGED_PATH = path.join(STORAGE, 'pubs_merged.json');
const POIS_PATH = path.join(STORAGE, 'pois_osm.json');
const OUT_PATH = path.join(STORAGE, 'price_range.json');

function loadEnv() {
  for (const f of ['.env', '.env.local']) {
    const p = path.join(DIR, f);
    if (!fs.existsSync(p)) continue;
    for (const line of fs.readFileSync(p, 'utf8').split('\n')) {
      const t = line.replace(/#.*/, '').trim();
      const eq = t.indexOf('=');
      if (eq > 0) {
        const k = t.slice(0, eq).trim();
        let v = t.slice(eq + 1).trim();
        if (/^["']|["']$/.test(v)) v = v.slice(1, -1);
        if (k && !process.env[k]) process.env[k] = v;
      }
    }
  }
}
loadEnv();

const API_KEY = process.env.GOOGLE_MAPS_API_KEY;
const DELAY_MS = parseInt(process.env.GOOGLE_PLACES_DELAY_MS || '500', 10);
const MAX_PUBS = process.env.GOOGLE_PLACES_LIMIT != null ? parseInt(process.env.GOOGLE_PLACES_LIMIT, 10) : 0;
const PLACE_DETAILS_CAP = 1000;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

function priceLevelToSymbol(level) {
  if (level == null || level === '') return '';
  const n = parseInt(level, 10);
  if (Number.isNaN(n)) return '';
  if (n <= 1) return '£';
  if (n === 2) return '££';
  return '£££';
}

async function findPlaceId(name, address, lat, lng, key) {
  const query = [name, address].filter(Boolean).join(' ');
  if (!query.trim()) return null;
  const bias = lat != null && lng != null ? `circle:500@${lat},${lng}` : '';
  const params = new URLSearchParams({
    input: query.trim(),
    inputtype: 'textquery',
    fields: 'place_id',
    key,
  });
  if (bias) params.set('locationbias', bias);
  const url = `https://maps.googleapis.com/maps/api/place/findplacefromtext/json?${params}`;
  const res = await fetch(url);
  const data = await res.json();
  // #region agent log
  fetch('http://127.0.0.1:7246/ingest/f5b2bf40-6a6e-4eab-9be8-6ef04831f52a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'googlemaps/fetch.js:findPlaceId',message:'Find Place response',data:{status:data.status,candidatesLength:(data.candidates||[]).length,placeId:data.candidates?.[0]?.place_id ?? null,queryTrim:query.trim().slice(0,40)},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  if (data.status === 'REQUEST_DENIED') {
    const msg = data.error_message || 'Key restricted or Places API not enabled.';
    throw new Error(`Google Places Find Place: REQUEST_DENIED. ${msg} Enable "Places API" in Google Cloud, turn on Billing, and ensure the API key is allowed for server-side use (no HTTP referrer restriction if running from Node).`);
  }
  const candidate = data.candidates && data.candidates[0];
  return candidate ? candidate.place_id : null;
}

async function getPlacePriceLevel(placeId, key) {
  if (!placeId) return null;
  const params = new URLSearchParams({
    place_id: placeId,
    fields: 'price_level',
    key,
  });
  const url = `https://maps.googleapis.com/maps/api/place/details/json?${params}`;
  const res = await fetch(url);
  const data = await res.json();
  // #region agent log
  fetch('http://127.0.0.1:7246/ingest/f5b2bf40-6a6e-4eab-9be8-6ef04831f52a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'googlemaps/fetch.js:getPlacePriceLevel',message:'Place Details response',data:{status:data.status,hasResult:!!data.result,price_level:data.result&&data.result.price_level,levelType:typeof (data.result&&data.result.price_level)},timestamp:Date.now(),hypothesisId:'B'})}).catch(()=>{});
  // #endregion
  if (data.status === 'REQUEST_DENIED') {
    const msg = data.error_message || 'Key restricted or Places API not enabled.';
    throw new Error(`Google Places Details: REQUEST_DENIED. ${msg}`);
  }
  const hasResult = data.status === 'OK' && data.result;
  return hasResult && data.result.price_level != null ? data.result.price_level : null;
}

function loadJson(name) {
  const p = path.join(STORAGE, name);
  if (!fs.existsSync(p)) return [];
  const raw = fs.readFileSync(p, 'utf8').trim();
  if (!raw) return [];
  try {
    const d = JSON.parse(raw);
    return Array.isArray(d) ? d : [];
  } catch {
    return [];
  }
}

const AREA_MAX = 500;
const EMPLOYEES_MAX = 100;
const RATING_MIN = 0;
const RATING_MAX = 5;

function isInsurableFromRow(pub) {
  const area = Number(pub.floor_area_m2);
  const emp = Number(pub.employees);
  const rating = Number(pub.avg_rating);
  const oh = pub.opening_hours;
  const hasOh = typeof oh === 'string' && oh.trim() !== '';
  return (
    !Number.isNaN(area) && area <= AREA_MAX &&
    !Number.isNaN(emp) && emp <= EMPLOYEES_MAX &&
    !Number.isNaN(rating) && rating >= RATING_MIN && rating <= RATING_MAX &&
    hasOh
  );
}

async function main() {
  if (!API_KEY) {
    console.error('Set GOOGLE_MAPS_API_KEY in data/.env');
    process.exit(1);
  }
  if (!fs.existsSync(MERGED_PATH)) {
    console.error('Missing storage/pubs_merged.json. Run merge first: node jobs/run.js');
    process.exit(1);
  }
  if (!fs.existsSync(POIS_PATH)) {
    console.error('Missing storage/pois_osm.json.');
    process.exit(1);
  }

  const merged = JSON.parse(fs.readFileSync(MERGED_PATH, 'utf8'));
  const mergedList = Array.isArray(merged) ? merged : [];
  const insurableOsmIds = new Set(mergedList.filter(isInsurableFromRow).map((p) => p.osm_id));

  const pois = JSON.parse(fs.readFileSync(POIS_PATH, 'utf8'));
  const allPois = Array.isArray(pois) ? pois : [];
  let toProcess = allPois.filter((p) => insurableOsmIds.has(p.osm_id));
  console.log(`From current pubs_merged.json: insurable (area<=${AREA_MAX}, employees<=${EMPLOYEES_MAX}, rating ${RATING_MIN}-${RATING_MAX}): ${toProcess.length} pubs`);
  if (MAX_PUBS > 0) toProcess = toProcess.slice(0, MAX_PUBS);
  toProcess = toProcess.slice(0, PLACE_DETAILS_CAP);

  const out = [];
  let countPlaceId = 0;
  let countLevel = 0;
  let countPriceRange = 0;

  console.log(`Fetching only field "price_level" for ${toProcess.length} pubs (Place Details cap ${PLACE_DETAILS_CAP}, delay ${DELAY_MS}ms)...`);

  for (let i = 0; i < toProcess.length; i++) {
    const p = toProcess[i];
    const lat = p.coordinates?.lat ?? p.lat;
    const lng = p.coordinates?.lng ?? p.coordinates?.lon ?? p.lng;
    const name = p.name || '';
    const address = p.address || '';

    const placeId = await findPlaceId(name, address, lat, lng, API_KEY);
    await sleep(DELAY_MS);
    if (placeId) countPlaceId++;

    let level = null;
    if (placeId) {
      level = await getPlacePriceLevel(placeId, API_KEY);
      await sleep(DELAY_MS);
      if (level != null) countLevel++;
    }

    const priceRange = priceLevelToSymbol(level);
    if (priceRange) countPriceRange++;
    out.push({ osm_id: p.osm_id, price_range: priceRange || '' });
    // #region agent log
    if (i < 3) fetch('http://127.0.0.1:7246/ingest/f5b2bf40-6a6e-4eab-9be8-6ef04831f52a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'googlemaps/fetch.js:main_loop',message:'Sample row',data:{i,osm_id:p.osm_id,name:name.slice(0,30),placeId:!!placeId,level,priceRange},timestamp:Date.now(),hypothesisId:'D'})}).catch(()=>{});
    // #endregion
    if ((i + 1) % 100 === 0) console.log(`  ${i + 1}/${toProcess.length}`);
  }

  // #region agent log
  fetch('http://127.0.0.1:7246/ingest/f5b2bf40-6a6e-4eab-9be8-6ef04831f52a',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({location:'googlemaps/fetch.js:main_end',message:'Counts',data:{total:toProcess.length,countPlaceId,countLevel,countPriceRange},timestamp:Date.now(),hypothesisId:'A'})}).catch(()=>{});
  // #endregion
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2), 'utf8');
  const withPrice = out.filter((r) => r.price_range).length;
  console.log(`Wrote ${OUT_PATH}: ${out.length} rows, ${withPrice} with price_range.`);
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
