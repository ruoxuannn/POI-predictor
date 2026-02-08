#!/usr/bin/env node
/**
 * Normalize raw OSM output to schema: osm_id, name, coordinates, address,
 * category, opening_hours, floor_area_m2. Standardize coordinates and address format.
 *
 * Input: ../storage/raw/pois_osm_raw.json
 * Output: ../storage/pois_osm.json (see schema.json and ../schemas/pub_merged.json)
 */

const fs = require('fs');
const path = require('path');

const DIR = path.resolve(__dirname, '..');
const RAW_PATH = path.join(DIR, 'storage', 'raw', 'pois_osm_raw.json');
const OPENING_HOURS_RAW_PATH = path.join(DIR, 'storage', 'raw', 'opening_hours_osm_raw.json');
const OUT_PATH = path.join(DIR, 'storage', 'pois_osm.json');

// Exclude likely chains: has operator tag (optional; set to false to keep all)
const EXCLUDE_OPERATOR = true;
// Max distance (m) to use opening_hours from a nearby OSM element
const OPENING_HOURS_NEAR_M = 25;

function formatAddress(tags) {
  const parts = [];
  if (tags['addr:housenumber']) parts.push(tags['addr:housenumber']);
  if (tags['addr:street']) parts.push(tags['addr:street']);
  const street = parts.length ? parts.join(' ') : null;
  const city = tags['addr:city'] || tags['addr:suburb'] || null;
  const postcode = tags['addr:postcode'] || null;
  if (tags['addr:full']) return tags['addr:full'];
  return [street, city, postcode].filter(Boolean).join(', ') || '';
}

function parseFloorAreaM2(tags) {
  const raw = tags.floor_area || tags['building:floor_area'];
  if (raw == null) return null;
  const n = parseFloat(String(raw).replace(/\s*m²?\s*/i, ''));
  return Number.isFinite(n) ? Math.round(n) : null;
}

// Approximate m per degree at London (~51.5°N): lat 111320, lon ~69600
function latLonToMeters(lat) {
  const latPerM = 1 / 111320;
  const lonPerM = 1 / (111320 * Math.cos((lat * Math.PI) / 180));
  return { latPerM, lonPerM };
}

/** Polygon area in m² from geometry [{lat, lon}, ...] (shoelace in projected m). */
function geometryAreaM2(geometry) {
  if (!geometry || geometry.length < 3) return null;
  const lat0 = geometry[0].lat;
  const { latPerM, lonPerM } = latLonToMeters(lat0);
  const toX = (p) => (p.lon - geometry[0].lon) / lonPerM;
  const toY = (p) => (p.lat - geometry[0].lat) / latPerM;
  let area = 0;
  for (let i = 0; i < geometry.length; i++) {
    const j = (i + 1) % geometry.length;
    area += toX(geometry[i]) * toY(geometry[j]) - toX(geometry[j]) * toY(geometry[i]);
  }
  return Math.round(Math.abs(area) / 2);
}

function getCoordinates(el) {
  if (el.lat != null && el.lon != null) return { lat: el.lat, lng: el.lon };
  if (el.center) return { lat: el.center.lat, lng: el.center.lon };
  if (el.bounds) {
    const b = el.bounds;
    return { lat: (b.minlat + b.maxlat) / 2, lng: (b.minlon + b.maxlon) / 2 };
  }
  if (el.geometry && el.geometry.length) {
    const g = el.geometry;
    const lat = g.reduce((s, p) => s + p.lat, 0) / g.length;
    const lon = g.reduce((s, p) => s + p.lon, 0) / g.length;
    return { lat, lng: lon };
  }
  return null;
}

function haversineM(lat1, lon1, lat2, lon2) {
  const R = 6371000; // m
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) * Math.cos((lat2 * Math.PI) / 180) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function elementToRecord(el) {
  const tags = el.tags || {};
  if (EXCLUDE_OPERATOR && tags.operator) return null;

  const coords = getCoordinates(el);
  if (!coords) return null;

  // Unique numeric osm_id: nodes use id, ways use -id to avoid collision
  const osm_id = el.type === 'way' ? -el.id : el.id;
  const name = tags.name || '';
  const address = formatAddress(tags);
  const category = tags.amenity || 'pub';
  const opening_hours = tags.opening_hours || '';
  // Floor area: tag first, then from way geometry (building footprint)
  let floor_area_m2 = parseFloorAreaM2(tags);
  if (floor_area_m2 == null && el.type === 'way' && el.geometry && el.geometry.length >= 3) {
    const area = geometryAreaM2(el.geometry);
    if (area != null && area > 0) floor_area_m2 = area;
  }

  return {
    osm_id,
    name,
    coordinates: coords,
    address,
    category,
    opening_hours,
    floor_area_m2,
  };
}

function loadOpeningHoursFallback() {
  if (!fs.existsSync(OPENING_HOURS_RAW_PATH)) return [];
  const raw = JSON.parse(fs.readFileSync(OPENING_HOURS_RAW_PATH, 'utf8'));
  const out = [];
  for (const el of raw.elements || []) {
    const hours = (el.tags || {}).opening_hours;
    if (!hours) continue;
    let lat, lng;
    if (el.lat != null && el.lon != null) {
      lat = el.lat;
      lng = el.lon;
    } else if (el.center) {
      lat = el.center.lat;
      lng = el.center.lon;
    } else continue;
    out.push({ lat, lng, opening_hours: hours });
  }
  return out;
}

function main() {
  if (!fs.existsSync(RAW_PATH)) {
    console.error(`Raw file not found: ${RAW_PATH}. Run fetch.js first.`);
    process.exit(1);
  }

  const raw = JSON.parse(fs.readFileSync(RAW_PATH, 'utf8'));
  const elements = raw.elements || [];
  const records = elements.map(elementToRecord).filter(Boolean);

  const ohFallback = loadOpeningHoursFallback();
  if (ohFallback.length > 0) {
    let filled = 0;
    for (const rec of records) {
      if (rec.opening_hours) continue;
      const { lat, lng } = rec.coordinates;
      let best = null;
      let bestD = OPENING_HOURS_NEAR_M;
      for (const o of ohFallback) {
        const d = haversineM(lat, lng, o.lat, o.lng);
        if (d < bestD) {
          bestD = d;
          best = o.opening_hours;
        }
      }
      if (best) {
        rec.opening_hours = best;
        filled++;
      }
    }
    if (filled) console.log(`Filled ${filled} opening_hours from nearby OSM (within ${OPENING_HOURS_NEAR_M}m)`);
  }

  const outDir = path.dirname(OUT_PATH);
  if (!fs.existsSync(outDir)) fs.mkdirSync(outDir, { recursive: true });
  fs.writeFileSync(OUT_PATH, JSON.stringify(records, null, 2), 'utf8');

  const withArea = records.filter((r) => r.floor_area_m2 != null).length;
  const withHours = records.filter((r) => r.opening_hours && r.opening_hours.length > 0).length;
  console.log(
    `Normalized ${records.length} pubs → ${path.relative(DIR, OUT_PATH)} (floor_area: ${withArea}, opening_hours: ${withHours})`
  );
}

main();
