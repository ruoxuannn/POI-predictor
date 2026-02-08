#!/usr/bin/env node
/**
 * Beer In The Evening (BITE) scraper — London pubs.
 *
 * - Scrapes list pages (results.shtml?l=london) for unique pub detail URLs.
 * - Fetches each detail page for: address, aggregate rating (X/10), rating count, review text.
 * - Merges to POIs by normalised address (postcode + street line).
 *
 * Outputs:
 *   ../storage/ratings_bite.json — { osm_id, avg_rating (0–5), rating_source_count }
 *   ../storage/beerintheevening_reviews.json — { osm_id, reviews: [ { text } ] }
 *
 * Env: BITE_DELAY_MS (optional, default 1500) — delay between requests
 *      BITE_LIST_PAGE_LIMIT (optional) — max list pages to scrape (0 = all)
 *      BITE_DETAIL_LIMIT (optional) — max detail pages to fetch (0 = all)
 *
 * Input: ../storage/pois_osm.json
 */

const fs = require('fs');
const path = require('path');

const DIR = path.resolve(__dirname, '..');
const POIS_PATH = path.join(DIR, 'storage', 'pois_osm.json');
const RATINGS_OUT = path.join(DIR, 'storage', 'ratings_bite.json');
const REVIEWS_OUT = path.join(DIR, 'storage', 'beerintheevening_reviews.json');

const BASE_LIST = 'https://www.beerintheevening.com/pubs/results.shtml?l=london';
const BASE_SITE = 'https://www.beerintheevening.com';

const DELAY_MS = parseInt(process.env.BITE_DELAY_MS || '1500', 10);
const LIST_PAGE_LIMIT = process.env.BITE_LIST_PAGE_LIMIT != null
  ? parseInt(process.env.BITE_LIST_PAGE_LIMIT, 10)
  : 0;
const DETAIL_LIMIT = process.env.BITE_DETAIL_LIMIT != null
  ? parseInt(process.env.BITE_DETAIL_LIMIT, 10)
  : 0;

function sleep(ms) {
  return new Promise((r) => setTimeout(r, ms));
}

/** Extract UK postcode from address string. */
function postcodeFromAddress(address) {
  if (!address || !String(address).trim()) return null;
  const match = String(address).match(/\b([A-Z]{1,2}[0-9][0-9A-Z]?\s*[0-9][A-Z]{2})\b/i);
  return match ? match[1].replace(/\s+/g, ' ').trim().toUpperCase() : null;
}

/** Normalise address for matching: lowercase, collapse spaces, trim. */
function normaliseAddress(address) {
  if (!address || !String(address).trim()) return '';
  return String(address)
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .replace(/,[\s,]*/g, ', ')
    .trim();
}

/** First line of address (number + street) for matching when postcode missing. */
function addressStreetLine(addr) {
  const n = normaliseAddress(addr);
  const first = n.split(',')[0].trim();
  return first || n;
}

/** Build a key from address for matching: prefer postcode, else street line. */
function addressKey(address) {
  const pc = postcodeFromAddress(address);
  if (pc) return `pc:${pc}`;
  return `street:${addressStreetLine(address)}`;
}

/** Match BITE address to POIs; returns best-matching osm_id or null. */
function matchPoiByAddress(biteAddress, pois) {
  const key = addressKey(biteAddress);
  const biteStreet = addressStreetLine(biteAddress);
  const bitePc = postcodeFromAddress(biteAddress);

  for (const poi of pois) {
    const a = (poi.address || '').trim();
    if (!a) continue;
    if (bitePc && postcodeFromAddress(a) === bitePc) return poi.osm_id;
    if (addressKey(a) === key) return poi.osm_id;
    if (normaliseAddress(a) === normaliseAddress(biteAddress)) return poi.osm_id;
    if (addressStreetLine(a) === biteStreet) return poi.osm_id;
  }
  return null;
}

/** Parse list page HTML for detail URLs (unique). */
function parseListPage(html) {
  const urls = new Set();
  const re = /href="(https:\/\/www\.beerintheevening\.com)?(\/pubs\/s\/[^"]+)"/gi;
  let m;
  while ((m = re.exec(html)) !== null) {
    const full = m[1] ? m[1] + m[2] : BASE_SITE + m[2];
    if (full.includes('/pubs/s/') && !full.includes('#') && !full.includes('mail_link')) {
      urls.add(full.split('#')[0]);
    }
  }
  return [...urls];
}

/** Parse detail page for address, rating, count, and review texts. */
function parseDetailPage(html) {
  const out = { address: null, rating: null, ratingCount: null, reviews: [] };

  const addrMatch = html.match(/Address:\s*<\/?b>?\s*([^<]+)/i);
  if (addrMatch) out.address = addrMatch[1].replace(/\s+/g, ' ').trim();

  const ratingMatch = html.match(/Current user rating:\s*[^0-9]*([0-9.]+)\/10[^)]*\(rated by (\d+) users?\)/i);
  if (ratingMatch) {
    out.rating = parseFloat(ratingMatch[1], 10);
    out.ratingCount = parseInt(ratingMatch[2], 10);
  }

  const tableRe = /<td class="pubtable">([\s\S]*?)<\/td>/g;
  let cell;
  while ((cell = tableRe.exec(html)) !== null) {
    let raw = cell[1].replace(/<br\s*\/?>/gi, ' ').replace(/<[^>]+>/g, ' ');
    const reportIdx = raw.toLowerCase().indexOf('report this for removal');
    if (reportIdx > 0) raw = raw.slice(0, reportIdx);
    const text = raw.replace(/\s+/g, ' ').trim();
    if (text.length > 30) out.reviews.push({ text });
  }

  return out;
}

async function main() {
  if (!fs.existsSync(POIS_PATH)) {
    console.error('Not found: pois_osm.json. Run pois_osm fetch + normalize first.');
    process.exit(1);
  }

  const pois = JSON.parse(fs.readFileSync(POIS_PATH, 'utf8'));
  const withAddress = pois.filter((p) => (p.address || '').trim());
  console.log(`POIs with address: ${withAddress.length} / ${pois.length}`);

  const detailUrls = new Set();
  let page = 0;
  const maxPages = LIST_PAGE_LIMIT > 0 ? LIST_PAGE_LIMIT : 250;

  console.log('Scraping list pages for detail URLs...');
  while (page < maxPages) {
    const url = page === 0 ? BASE_LIST : `${BASE_LIST}&page=${page}`;
    const res = await fetch(url, {
      headers: { 'User-Agent': 'POI-predictor/1 (hackathon data)' },
    });
    if (!res.ok) {
      console.warn(`List ${url} → ${res.status}`);
      break;
    }
    const html = await res.text();
    const urls = parseListPage(html);
    if (urls.length === 0) break;
    urls.forEach((u) => detailUrls.add(u));
    console.log(`  page ${page}: +${urls.length} URLs (total unique: ${detailUrls.size})`);
    await sleep(DELAY_MS);
    page++;
  }

  const urlsToFetch = DETAIL_LIMIT > 0 ? [...detailUrls].slice(0, DETAIL_LIMIT) : [...detailUrls];
  console.log(`Fetching ${urlsToFetch.length} detail pages (delay ${DELAY_MS}ms)...`);

  const ratingsByOsm = new Map();
  const reviewsByOsm = new Map();

  for (let i = 0; i < urlsToFetch.length; i++) {
    const url = urlsToFetch[i];
    if ((i + 1) % 20 === 0 || i === 0) process.stdout.write(`  ${i + 1}/${urlsToFetch.length}\r`);
    await sleep(DELAY_MS);
    try {
      const res = await fetch(url, {
        headers: { 'User-Agent': 'POI-predictor/1 (hackathon data)' },
      });
      if (!res.ok) continue;
      const html = await res.text();
      const d = parseDetailPage(html);
      if (!d.address) continue;

      const osmId = matchPoiByAddress(d.address, pois);
      if (!osmId) continue;

      if (d.rating != null && d.ratingCount != null) {
        const avg5 = d.rating / 2;
        ratingsByOsm.set(osmId, {
          osm_id: osmId,
          avg_rating: Math.round(avg5 * 100) / 100,
          rating_source_count: d.ratingCount,
        });
      }
      if (d.reviews.length) {
        const existing = reviewsByOsm.get(osmId) || [];
        reviewsByOsm.set(osmId, existing.concat(d.reviews));
      }
    } catch (e) {
      if (i < 3) console.warn(`  ${url}: ${e.message}`);
    }
  }

  const ratingsArray = [...ratingsByOsm.values()];
  const reviewsArray = [...reviewsByOsm.entries()].map(([osm_id, reviews]) => ({ osm_id, reviews }));

  const storageDir = path.join(DIR, 'storage');
  if (!fs.existsSync(storageDir)) fs.mkdirSync(storageDir, { recursive: true });
  fs.writeFileSync(RATINGS_OUT, JSON.stringify(ratingsArray, null, 2), 'utf8');
  fs.writeFileSync(REVIEWS_OUT, JSON.stringify(reviewsArray, null, 2), 'utf8');

  console.log('');
  console.log(`Wrote ${ratingsArray.length} ratings → storage/ratings_bite.json`);
  console.log(`Wrote ${reviewsArray.length} pubs with reviews → storage/beerintheevening_reviews.json`);
  console.log('Merge ratings_bite with other sources by osm_id; use beerintheevening_reviews for sentiment.');
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
