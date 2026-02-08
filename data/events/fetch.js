#!/usr/bin/env node
/**
 * Fetch Premier League fixtures for the current month from Football Web Pages,
 * count matches per date, and output date -> frequency for use as activity multiplier.
 *
 * URL: https://www.footballwebpages.co.uk/premier-league/fixtures-results/{current_month}
 * No API key. Parses HTML table for dates (d/m/yyyy), then outputs:
 *   match_dates, matches_per_date (date -> count), multiplier_by_date (date -> 1.0 + scale * min(count, cap))
 *
 * Env: EVENTS_MULTIPLIER_CAP (optional) — max matches per date for multiplier scaling (default 5)
 *      EVENTS_MULTIPLIER_STEP (optional) — multiplier increment per match up to cap (default 0.1)
 * Output: ../storage/events.json
 */

const fs = require('fs');
const path = require('path');

const DIR = path.resolve(__dirname, '..');
const STORAGE = path.join(DIR, 'storage');
const OUT_PATH = path.join(STORAGE, 'events.json');

const MONTHS = ['january', 'february', 'march', 'april', 'may', 'june', 'july', 'august', 'september', 'october', 'november', 'december'];
const BASE_URL = 'https://www.footballwebpages.co.uk/premier-league/fixtures-results';

const MULTIPLIER_CAP = Math.max(1, parseInt(process.env.EVENTS_MULTIPLIER_CAP || '5', 10));
const MULTIPLIER_STEP = Math.max(0, parseFloat(process.env.EVENTS_MULTIPLIER_STEP || '0.1') || 0.1);

/** d/m/yyyy -> YYYY-MM-DD */
function toISODate(d, m, y) {
  const day = String(parseInt(d, 10)).padStart(2, '0');
  const month = String(parseInt(m, 10)).padStart(2, '0');
  return `${y}-${month}-${day}`;
}

/** Extract all d/m/yyyy from HTML (fixture rows). */
function parseDatesFromHtml(html) {
  const dates = [];
  const re = /(\d{1,2})\/(\d{1,2})\/(\d{4})/g;
  let m;
  while ((m = re.exec(html)) !== null) {
    dates.push(toISODate(m[1], m[2], m[3]));
  }
  return dates;
}

/** Count occurrences per date; return { date -> count }. */
function countPerDate(dateStrings) {
  const counts = {};
  for (const d of dateStrings) {
    counts[d] = (counts[d] || 0) + 1;
  }
  return counts;
}

/** Base 1.0 + step per match, capped at cap matches. */
function multiplierForCount(count) {
  const n = Math.min(count, MULTIPLIER_CAP);
  return Math.round((1.0 + MULTIPLIER_STEP * n) * 100) / 100;
}

async function main() {
  const now = new Date();
  const monthName = MONTHS[now.getMonth()];
  const url = `${BASE_URL}/${monthName}`;

  console.log('Fetching Premier League fixtures for current month: ' + monthName + '...');
  let html;
  try {
    const res = await fetch(url, {
      headers: { 'User-Agent': 'POI-predictor/1 (London pubs activity)' },
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);
    html = await res.text();
  } catch (e) {
    console.error('Failed to fetch ' + url + ': ' + e.message);
    process.exit(1);
  }

  const dateStrings = parseDatesFromHtml(html);
  const matchesPerDate = countPerDate(dateStrings);
  const matchDates = [...new Set(dateStrings)].sort();

  const multiplierByDate = {};
  for (const d of matchDates) {
    multiplierByDate[d] = multiplierForCount(matchesPerDate[d] || 0);
  }

  const out = {
    match_dates: matchDates,
    matches_per_date: matchesPerDate,
    multiplier_by_date: multiplierByDate,
    event_multiplier_match_day: multiplierForCount(1),
    meta: {
      source: url,
      month: monthName,
      year: now.getFullYear(),
      total_fixtures: dateStrings.length,
    },
  };

  if (!fs.existsSync(STORAGE)) fs.mkdirSync(STORAGE, { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(out, null, 2), 'utf8');

  console.log('Wrote ' + out.match_dates.length + ' match days, ' + dateStrings.length + ' fixtures → storage/events.json');
  console.log('Use multiplier_by_date for activity level (e.g. 1.1 for 1 match, 1.5 for 5+ matches on a date).');
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});
