#!/usr/bin/env node
/**
 * Pipeline: optionally run all ingestion scripts, then merge by osm_id, compute revenue_proxy, write CSV + JSON.
 * Run from data/: node jobs/run.js [--fetch]
 * --fetch: run each source script before merge (default: merge only, using existing storage).
 */

const fs = require('fs');
const path = require('path');
const { spawnSync } = require('child_process');

const DATA_DIR = path.resolve(__dirname, '..');
const STORAGE = path.join(DATA_DIR, 'storage');

function loadEnv() {
  for (const file of ['.env', '.env.local']) {
    const p = path.join(DATA_DIR, file);
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

function runScript(scriptPath) {
  const full = path.join(DATA_DIR, scriptPath);
  if (!fs.existsSync(full)) return { ok: false, error: 'not found' };
  const r = spawnSync('node', [full], { cwd: DATA_DIR, stdio: 'inherit', shell: true });
  return { ok: r.status === 0, code: r.status };
}

function loadJson(name) {
  const p = path.join(STORAGE, name);
  if (!fs.existsSync(p)) return [];
  const raw = fs.readFileSync(p, 'utf8').trim();
  if (!raw) return [];
  try {
    const d = JSON.parse(raw);
    return Array.isArray(d) ? d : d.data != null ? d.data : [d];
  } catch {
    return [];
  }
}

function loadEvents() {
  const p = path.join(STORAGE, 'events.json');
  if (!fs.existsSync(p)) return { multiplier_by_date: {} };
  try {
    return JSON.parse(fs.readFileSync(p, 'utf8'));
  } catch {
    return { multiplier_by_date: {} };
  }
}

function priceMult(price) {
  if (!price) return 1;
  if (price === '£') return 1;
  if (price === '££') return 1.5;
  if (price === '£££') return 2;
  return 1;
}

/**
 * Companies House provides officer count (directors/secretary), not employee count.
 * Convert officer count to estimated employee count for pubs (typical ratio ~1:5).
 * Missing/zero officer count -> null (no estimate).
 */
function estimatedEmployeesFromOfficerCount(officerCount) {
  const n = Number(officerCount);
  if (n === 0 || Number.isNaN(n)) return null;
  return Math.min(100, Math.round(n * 5));
}

function revenueProxy(pub, eventMult) {
  const emp = Math.max(0, Number(pub.employees) || 0);
  const area = Math.max(0, Number(pub.floor_area_m2) || 0);
  const rating = Math.min(5, Math.max(0, Number(pub.avg_rating) || 0)) / 5 || 0.5;
  const pop = Math.min(1, Math.max(0, Number(pub.popularity) || 0)) || 0.5;
  const tips = Math.min(20, Math.max(0, Number(pub.total_tips) || 0));
  const ev = Math.max(0.5, Math.min(2, Number(eventMult) || 1));
  const base = 5000;
  const v =
    base *
    (1 + 0.2 * emp) *
    (1 + 0.05 * (area / 100)) *
    (rating || 0.5) *
    priceMult(pub.price_range) *
    pop *
    (1 + 0.05 * tips) *
    ev;
  return Math.round(Math.max(0, v));
}

function escapeCsv(val) {
  if (val == null) return '';
  const s = String(val);
  if (/[,"\n\r]/.test(s)) return '"' + s.replace(/"/g, '""') + '"';
  return s;
}

const AREA_MAX = 500;
const EMPLOYEES_MAX = 100;
const RATING_MIN = 0;
const RATING_MAX = 5;

function isInsurable(pub) {
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

const ESTIMATED_PINT_PRICE = '£';

function setEstimatedPriceWhenMissing(rows) {
  for (const r of rows) {
    if (r.price_range == null || r.price_range === '') r.price_range = ESTIMATED_PINT_PRICE;
  }
}


async function main() {
  loadEnv();
  const doFetch = process.argv.includes('--fetch');

  if (doFetch) {
    const schedulePath = path.join(DATA_DIR, 'config', 'schedule.json');
    const schedule = fs.existsSync(schedulePath) ? JSON.parse(fs.readFileSync(schedulePath, 'utf8')) : { sources: [] };
    for (const src of schedule.sources || []) {
      console.log('Running: ' + src.name + '...');
      if (src.script && !runScript(src.script).ok) process.exit(1);
      if (src.then && !runScript(src.then).ok) process.exit(1);
    }
  }

  const pois = loadJson('pois_osm.json');
  if (!pois.length) {
    console.error('No pois_osm.json. Run pois_osm fetch + normalize first.');
    process.exit(1);
  }

  const floorByOsm = {};
  for (const r of loadJson('floor_area.json')) if (r.osm_id != null) floorByOsm[r.osm_id] = r.floor_area_m2;
  // employees.json holds officer count (Companies House); we convert to estimated employee count
  const officerCountByOsm = {};
  for (const r of loadJson('employees.json')) if (r.osm_id != null) officerCountByOsm[r.osm_id] = r.employees;
  const ratingByOsm = {};
  for (const r of loadJson('ratings_bite.json')) {
    if (r.osm_id != null) ratingByOsm[r.osm_id] = { avg_rating: r.avg_rating, rating_source_count: r.rating_source_count };
  }
  const priceByOsm = {};
  for (const r of loadJson('price_range.json')) if (r.osm_id != null) priceByOsm[r.osm_id] = r.price_range;
  const activityByOsm = {};
  const events = loadEvents();
  const today = new Date().toISOString().slice(0, 10);
  const eventMultByDate = events.multiplier_by_date || {};

  const rows = [];
  for (const p of pois) {
    const osmId = p.osm_id;
    const eventMult = eventMultByDate[today] != null ? eventMultByDate[today] : 1;
    const pub = {
      osm_id: osmId,
      name: p.name || '',
      address: p.address || '',
      lat: p.coordinates?.lat ?? '',
      lng: p.coordinates?.lng ?? p.coordinates?.lon ?? '',
      category: p.category || '',
      opening_hours: p.opening_hours || '',
      floor_area_m2: floorByOsm[osmId] ?? p.floor_area_m2 ?? '',
      employees: estimatedEmployeesFromOfficerCount(officerCountByOsm[osmId]) ?? '',
      avg_rating: ratingByOsm[osmId]?.avg_rating ?? '',
      rating_source_count: ratingByOsm[osmId]?.rating_source_count ?? '',
      price_range: priceByOsm[osmId] ?? '',
      popularity: activityByOsm[osmId]?.popularity ?? '',
      total_tips: activityByOsm[osmId]?.total_tips ?? '',
      event_multiplier: eventMult,
      revenue_proxy: null,
    };
    pub.revenue_proxy = revenueProxy(pub, eventMult);
    pub.insurable = isInsurable(pub);
    rows.push(pub);
  }

  setEstimatedPriceWhenMissing(rows);
  for (const pub of rows) {
    pub.revenue_proxy = revenueProxy(pub, pub.event_multiplier);
  }

  const insurableRows = rows.filter((r) => r.insurable);
  const cols = ['osm_id', 'name', 'address', 'lat', 'lng', 'category', 'opening_hours', 'floor_area_m2', 'employees', 'avg_rating', 'rating_source_count', 'price_range', 'popularity', 'total_tips', 'event_multiplier', 'revenue_proxy', 'insurable'];
  const csvLines = [cols.map(escapeCsv).join(',')];
  for (const r of rows) csvLines.push(cols.map((c) => escapeCsv(r[c])).join(','));

  if (!fs.existsSync(STORAGE)) fs.mkdirSync(STORAGE, { recursive: true });
  fs.writeFileSync(path.join(STORAGE, 'pubs.csv'), csvLines.join('\n'), 'utf8');
  fs.writeFileSync(path.join(STORAGE, 'pubs_merged.json'), JSON.stringify(rows, null, 2), 'utf8');

  const avgRev = rows.reduce((a, r) => a + (r.revenue_proxy || 0), 0) / (rows.length || 1);
  const avgRevInsurable = insurableRows.length ? insurableRows.reduce((a, r) => a + (r.revenue_proxy || 0), 0) / insurableRows.length : 0;
  console.log('Merged ' + rows.length + ' pubs → storage/pubs.csv, storage/pubs_merged.json');
  console.log('Insurable (sanity filter): ' + insurableRows.length);
  console.log('Avg revenue_proxy (all): ' + Math.round(avgRev) + ', (insurable): ' + Math.round(avgRevInsurable));
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
