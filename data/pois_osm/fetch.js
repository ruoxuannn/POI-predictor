#!/usr/bin/env node
/**
 * Fetch independent pubs in London from OSM/Overpass.
 * Queries Overpass for amenity=pub in London bbox, writes raw JSON.
 *
 * Usage: node fetch.js
 * Env: OVERPASS_URL (optional, default https://overpass-api.de/api/interpreter)
 * Output: ../storage/raw/pois_osm_raw.json
 */

const fs = require('fs');
const path = require('path');

const OVERPASS_URL = process.env.OVERPASS_URL || 'https://overpass-api.de/api/interpreter';

// London bbox (Greater London): south, west, north, east
const LONDON_BBOX = [51.28, -0.51, 51.69, 0.33];

// Query nodes and ways: "out geom" gives node coords + way geometry (for footprint area)
const OVERPASS_QUERY = `
[out:json][timeout:120];
(
  node["amenity"="pub"](${LONDON_BBOX.join(',')});
  way["amenity"="pub"](${LONDON_BBOX.join(',')});
);
out geom;
`.trim();

// Nodes-only query (fallback if full query times out)
const OVERPASS_QUERY_NODES_ONLY = `
[out:json][timeout:60];
node["amenity"="pub"](${LONDON_BBOX.join(',')});
out body;
`.trim();

// Second query: elements with opening_hours in bbox (for filling missing from nearby POIs)
const OVERPASS_QUERY_OPENING_HOURS = `
[out:json][timeout:90];
(
  node["opening_hours"](${LONDON_BBOX.join(',')});
  way["opening_hours"](${LONDON_BBOX.join(',')});
);
out body center;
`.trim();

const DIR = path.resolve(__dirname, '..');
const RAW_PATH = path.join(DIR, 'storage', 'raw', 'pois_osm_raw.json');
const OPENING_HOURS_RAW_PATH = path.join(DIR, 'storage', 'raw', 'opening_hours_osm_raw.json');

async function runQuery(query, label) {
  const res = await fetch(OVERPASS_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: 'data=' + encodeURIComponent(query),
  });
  if (!res.ok) throw new Error(`${label}: ${res.status} ${res.statusText}`);
  return res.json();
}

async function main() {
  console.log('Querying Overpass for London pubs...');
  let data;
  try {
    data = await runQuery(OVERPASS_QUERY, 'Full query');
  } catch (e) {
    if (e.message.includes('504') || e.message.includes('timeout')) {
      console.warn('Full query timed out; falling back to nodes-only...');
      data = await runQuery(OVERPASS_QUERY_NODES_ONLY, 'Nodes-only query');
    } else {
      throw e;
    }
  }

  const rawDir = path.dirname(RAW_PATH);
  if (!fs.existsSync(rawDir)) {
    fs.mkdirSync(rawDir, { recursive: true });
  }
  fs.writeFileSync(RAW_PATH, JSON.stringify(data, null, 2), 'utf8');
  const elements = (data.elements || []).length;
  console.log(`Wrote ${elements} elements to ${path.relative(DIR, RAW_PATH)}`);

  // Optional: fetch OSM elements with opening_hours for filling gaps (nearest-neighbour)
  try {
    console.log('Fetching OSM opening_hours fallback...');
    const ohData = await runQuery(OVERPASS_QUERY_OPENING_HOURS, 'Opening hours query');
    fs.writeFileSync(OPENING_HOURS_RAW_PATH, JSON.stringify(ohData, null, 2), 'utf8');
    const ohCount = (ohData.elements || []).length;
    console.log(`Wrote ${ohCount} opening_hours elements to ${path.relative(DIR, OPENING_HOURS_RAW_PATH)}`);
  } catch (e) {
    console.warn('Opening hours fallback fetch failed (optional):', e.message);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
