#!/usr/bin/env node
/**
 * Match pubs to Companies House companies and fetch a size proxy (officer count).
 *
 * IMPORTANT: Companies House API does NOT expose "number of employees". Employee
 * counts appear in filed accounts (PDFs), not as structured API data. This script:
 * 1. Searches CH by pub name and matches by name + postcode (registered office).
 * 2. Uses active officer count as a proxy for "employees" (directors/secretary;
 *    for small pubs often 1–5). Document as proxy in README.
 *
 * Env: COMPANIES_HOUSE_API_KEY (required)
 *      EMPLOYEES_FETCH_LIMIT (optional) — max pubs to process (default 200; 0 = all)
 *      CH_REQUEST_DELAY_MS (optional) — delay between API calls (default 400 for rate limit)
 * Input: ../storage/pois_osm.json
 * Output: ../storage/employees.json  [{ osm_id, employees }, ...]
 */

const fs = require('fs');
const path = require('path');

const DIR = path.resolve(__dirname, '..');
const POIS_PATH = path.join(DIR, 'storage', 'pois_osm.json');
const OUT_PATH = path.join(DIR, 'storage', 'employees.json');

// Load data/.env and data/.env.local (Node doesn't load .env by default)
function loadEnv(file, override) {
  const envPath = path.join(DIR, file);
  if (!fs.existsSync(envPath)) return;
  const content = fs.readFileSync(envPath, 'utf8');
  for (const line of content.split('\n')) {
    const trimmed = line.replace(/#.*/, '').trim();
    const eq = trimmed.indexOf('=');
    if (eq > 0) {
      const key = trimmed.slice(0, eq).trim();
      let value = trimmed.slice(eq + 1).trim();
      if (/^["']|["']$/.test(value)) value = value.slice(1, -1);
      if (key && (override || !process.env[key])) process.env[key] = value;
    }
  }
}
loadEnv('.env', false);
loadEnv('.env.local', true);

const API_KEY = process.env.COMPANIES_HOUSE_API_KEY;
const LIMIT = process.env.EMPLOYEES_FETCH_LIMIT != null
  ? parseInt(process.env.EMPLOYEES_FETCH_LIMIT, 10)
  : 200;
const DELAY_MS = process.env.CH_REQUEST_DELAY_MS != null
  ? parseInt(process.env.CH_REQUEST_DELAY_MS, 10)
  : 400;

const BASE = 'https://api.company-information.service.gov.uk';

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

async function chGet(pathname) {
  const url = BASE + pathname;
  const res = await fetch(url, {
    headers: { Authorization: 'Basic ' + Buffer.from(API_KEY + ':').toString('base64') },
  });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`CH API ${res.status}: ${url}`);
  return res.json();
}

/** Extract postcode from pub address (e.g. "123 High St, London, N12 0BP" -> "N12 0BP"). */
function postcodeFromAddress(address) {
  if (!address || !address.trim()) return null;
  const match = address.match(/\b([A-Z]{1,2}[0-9][0-9A-Z]?\s*[0-9][A-Z]{2})\b/i);
  return match ? match[1].replace(/\s+/g, ' ').trim().toUpperCase() : null;
}

/** Normalize company/pub name for matching: lowercase, remove common suffixes. */
function normalizeName(name) {
  if (!name || !name.trim()) return '';
  return name
    .toLowerCase()
    .replace(/\b(ltd|limited|llp|plc|pub|the)\b/gi, '')
    .replace(/[^\w\s]/g, '')
    .replace(/\s+/g, ' ')
    .trim();
}

/** Score match: 0 = no match, higher = better. */
function matchScore(pub, company) {
  const nameScore =
    normalizeName(pub.name) === normalizeName(company.title)
      ? 2
      : normalizeName(pub.name).includes(normalizeName(company.title)) ||
        normalizeName(company.title).includes(normalizeName(pub.name))
        ? 1
        : 0;
  if (nameScore === 0) return 0;
  const pubPc = postcodeFromAddress(pub.address);
  const reg = company.address && company.address.postal_code;
  const pcMatch = pubPc && reg && pubPc.replace(/\s/g, '') === reg.replace(/\s/g, '');
  return nameScore + (pcMatch ? 1 : 0);
}

async function main() {
  if (!API_KEY || !String(API_KEY).trim()) {
    console.error('Set COMPANIES_HOUSE_API_KEY in data/.env or data/.env.local');
    process.exit(1);
  }
  if (!fs.existsSync(POIS_PATH)) {
    console.error(`Not found: ${POIS_PATH}. Run pois_osm fetch + normalize first.`);
    process.exit(1);
  }

  const pois = JSON.parse(fs.readFileSync(POIS_PATH, 'utf8'));
  const totalPois = pois.length;
  const toProcessCount = LIMIT > 0 ? Math.min(LIMIT, totalPois) : totalPois;
  console.log(
    `Pois: ${totalPois}. Calling Companies House for first ${toProcessCount} (set EMPLOYEES_FETCH_LIMIT=0 for all).`
  );
  console.log(`~2 API calls per pub, ${DELAY_MS}ms delay → ~${Math.ceil((toProcessCount * 2 * DELAY_MS) / 60000)} min.`);
  const out = []; // will hold one entry per pub: same order and osm_ids as pois_osm
  let matched = 0;
  let errors = 0;

  for (let i = 0; i < pois.length; i++) {
    const pub = pois[i];
    const willCallApi = i < toProcessCount;
    if (willCallApi) {
      if ((i + 1) % 25 === 0 || i === 0) {
        process.stdout.write(`  ${i + 1}/${toProcessCount}\r`);
      }
    }
    const searchName = (pub.name || '').trim();
    if (!willCallApi || !searchName) {
      out.push({ osm_id: pub.osm_id, employees: null });
      continue;
    }

    try {
      await sleep(DELAY_MS);
      const searchRes = await chGet(
        '/search/companies?q=' + encodeURIComponent(searchName) + '&items_per_page=10'
      );
      if (!searchRes || !searchRes.items || searchRes.items.length === 0) {
        out.push({ osm_id: pub.osm_id, employees: null });
        continue;
      }

      const companyNumber = searchRes.items[0].company_number;
      const companyTitle = searchRes.items[0].title;
      const companyAddress = searchRes.items[0].address || {};

      let best = { company_number: companyNumber, title: companyTitle, address: companyAddress };
      let bestScore = matchScore(pub, { title: companyTitle, address: companyAddress });
      for (let k = 1; k < searchRes.items.length; k++) {
        const c = searchRes.items[k];
        const score = matchScore(pub, { title: c.title, address: c.address || {} });
        if (score > bestScore) {
          bestScore = score;
          best = { company_number: c.company_number, title: c.title, address: c.address || {} };
        }
      }

      await sleep(DELAY_MS);
      const officersRes = await chGet('/company/' + best.company_number + '/officers');
      const count =
        officersRes && officersRes.items
          ? officersRes.items.filter((o) => o.resigned_on == null).length
          : 0;

      out.push({ osm_id: pub.osm_id, employees: count > 0 ? count : null });
      if (count > 0) matched++;
    } catch (e) {
      errors++;
      out.push({ osm_id: pub.osm_id, employees: null });
      if (errors <= 3) console.warn(`Warning for ${pub.name} (${pub.osm_id}):`, e.message);
    }
  }

  const outDir = path.dirname(OUT_PATH);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2), 'utf8');

  console.log(''); // newline after progress
  console.log(
    `Wrote ${out.length} records (1 per poi) → ${path.relative(DIR, OUT_PATH)} (CH matched: ${matched}, errors: ${errors})`
  );
  console.log(
    'Note: "employees" is officer count (proxy); Companies House does not provide employee count in the API.'
  );
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
