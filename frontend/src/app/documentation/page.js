'use client';

import Link from 'next/link';

const dataSources = [
  { source: 'OpenStreetMap (Overpass)', script: 'pois_osm/fetch.js', output: 'pois_osm.json (raw), then normalize', description: 'London pub POIs: amenity=pub in London bbox. Provides name, address, coordinates, opening_hours, category. No API key.' },
  { source: 'Floor area (OSM)', script: 'floor_area/fetch.js', output: 'floor_area.json', description: 'Floor area (m²) from OSM way footprint or building lookup; optional Mapbox height estimate. Key for capacity.' },
  { source: 'Companies House', script: 'employees/fetch.js', output: 'employees.json', description: 'Officer count (directors/secretary) matched by pub name + postcode. Converted to estimated employees (×5) in merge. API key required.' },
  { source: 'Beer In The Evening (BITE)', script: 'beerintheevening/fetch.js', output: 'ratings_bite.json', description: 'Scraped ratings and review count; merged by address. Provides avg_rating (0–5) and rating_source_count.' },
  { source: 'Football Web Pages', script: 'events/fetch.js', output: 'events.json', description: 'Premier League fixtures per date; builds event_multiplier by date (e.g. 1.0 + 0.1×matches, cap 5). No API key.' },
  { source: 'Google Places (optional)', script: 'googlemaps/fetch.js', output: 'price_range.json', description: 'Price level (£/££/£££) from Places API. If missing, merge infers from revenue_proxy quartiles.' },
  { source: 'Merge (run.js)', script: 'jobs/run.js', output: 'pubs.csv, pubs_merged.json', description: 'Joins all above by osm_id; computes revenue_proxy and insurable flag. Run after any fetch.' },
];

const formulaFactors = [
  { factor: 'Current Activity Index', formula: '100 × (P_current ÷ P_baseline)', meaning: 'Ratio of activity proxy under scenario vs under pub’s real data.', justification: 'Baseline 100 = no change. >100 = scenario better than real data; <100 = worse. Transparent and multiplicative.' },
  { factor: 'P_baseline', formula: 'P evaluated at this pub’s real data', meaning: 'Activity proxy when all inputs equal the pub’s actual/derived values (sliders at “real”).', justification: 'Ensures index = 100 when sliders match real data; avoids spurious >100 from missing fields.' },
  { factor: 'P_current', formula: 'P evaluated at current slider values', meaning: 'Activity proxy under the user’s scenario (event mult, rating, area, employees, hours, etc.).', justification: 'What-if: sliders represent stress or improvement relative to baseline.' },
  { factor: 'Base scale', formula: '5000', meaning: 'Constant multiplier so P sits in a readable range.', justification: 'Only the ratio P_current/P_baseline matters for the index; base is arbitrary.' },
  { factor: 'Staffing', formula: '(1 + 0.2 × E)', meaning: 'E = number of employees (estimated from Companies House officer count ×5).', justification: 'More staff → higher capacity and turnover. +20% per employee.' },
  { factor: 'Floor space', formula: '(1 + 0.05 × A/100)', meaning: 'A = floor area in m² (from OSM/floor_area).', justification: 'Larger premises → more capacity. +5% per 100 m².' },
  { factor: 'Quality (rating)', formula: 'R/5', meaning: 'R = average rating 1–5 (from BITE). Missing → 0.5.', justification: 'Quality signal; normalised to 0–1. Higher rating → more custom.' },
  { factor: 'Price tier', formula: 'M_price: £=1, ££=1.5, £££=2', meaning: 'Price band from Google Places or inferred from proxy quartiles.', justification: 'Higher tier → higher spend per head.' },
  { factor: 'Event multiplier', formula: 'Φ, clamped 0.5–2', meaning: 'e.g. match days (from events.json).', justification: 'One-off demand boost (e.g. football); parametric and bounded.' },
  { factor: 'Review volume', formula: '(1 + 0.01 × min(N, 100))', meaning: 'N = number of reviews (rating_source_count).', justification: 'More reviews → visibility and confidence; +1% per review, cap 100.' },
  { factor: 'Trading hours', formula: 'H = max(0.5, 1 + 0.08×(h−12)/12 + 0.12×ln(1 + late/2))', meaning: 'h = daily opening hours (from opening_hours); late = hours after 23:00.', justification: 'Longer and later trading → more revenue opportunity.' },
];

export default function DocumentationPage() {
  return (
    <main style={{ maxWidth: 900, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ fontWeight: 600, fontSize: '1.75rem', marginBottom: '0.5rem' }}>Documentation</h1>
      <p style={{ color: '#a1a1aa', marginBottom: '2rem' }}>
        Data sources for live pub data and the Activity Index formula with factor justification.
      </p>

      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '1rem' }}>Data sources</h2>
        <p style={{ fontSize: '0.9rem', color: '#a1a1aa', marginBottom: '1rem' }}>
          All live data is produced by the pipeline in the <code style={{ background: '#27272a', padding: '2px 6px', borderRadius: 4 }}>data/</code> folder. Merge key: <strong>osm_id</strong>. Outputs: <code style={{ background: '#27272a', padding: '2px 6px', borderRadius: 4 }}>storage/pubs.csv</code> and <code style={{ background: '#27272a', padding: '2px 6px', borderRadius: 4 }}>storage/pubs_merged.json</code>.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse', background: '#18181b', borderRadius: 12, overflow: 'hidden', border: '1px solid #27272a' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #27272a' }}>
                <th style={{ padding: '0.75rem', color: '#a1a1aa', fontWeight: 600 }}>Source</th>
                <th style={{ padding: '0.75rem', color: '#a1a1aa', fontWeight: 600 }}>Script</th>
                <th style={{ padding: '0.75rem', color: '#a1a1aa', fontWeight: 600 }}>Output</th>
                <th style={{ padding: '0.75rem', color: '#a1a1aa', fontWeight: 600 }}>Description</th>
              </tr>
            </thead>
            <tbody>
              {dataSources.map((row, i) => (
                <tr key={i} style={{ borderBottom: i < dataSources.length - 1 ? '1px solid #27272a' : 'none' }}>
                  <td style={{ padding: '0.75rem', color: '#e4e4e7' }}>{row.source}</td>
                  <td style={{ padding: '0.75rem', color: '#a1a1aa', fontFamily: 'monospace', fontSize: '0.8rem' }}>{row.script}</td>
                  <td style={{ padding: '0.75rem', color: '#a1a1aa', fontFamily: 'monospace', fontSize: '0.8rem' }}>{row.output}</td>
                  <td style={{ padding: '0.75rem', color: '#a1a1aa' }}>{row.description}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section style={{ marginBottom: '2.5rem' }}>
        <h2 style={{ fontSize: '1.1rem', fontWeight: 600, color: '#e4e4e7', marginBottom: '1rem' }}>Activity Index — formula & factor justification</h2>
        <p style={{ fontSize: '0.9rem', color: '#a1a1aa', marginBottom: '1rem' }}>
          The Activity & Risk page uses an <strong>activity proxy</strong> P; the <strong>Current Activity Index</strong> is 100 × (P_current ÷ P_baseline). Below: each factor in P, its formula, meaning, and justification.
        </p>
        <div style={{ overflowX: 'auto' }}>
          <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse', background: '#18181b', borderRadius: 12, overflow: 'hidden', border: '1px solid #27272a' }}>
            <thead>
              <tr style={{ textAlign: 'left', borderBottom: '1px solid #27272a' }}>
                <th style={{ padding: '0.75rem', color: '#a1a1aa', fontWeight: 600, width: '18%' }}>Factor</th>
                <th style={{ padding: '0.75rem', color: '#a1a1aa', fontWeight: 600, width: '28%' }}>Formula</th>
                <th style={{ padding: '0.75rem', color: '#a1a1aa', fontWeight: 600, width: '26%' }}>Meaning</th>
                <th style={{ padding: '0.75rem', color: '#a1a1aa', fontWeight: 600 }}>Justification</th>
              </tr>
            </thead>
            <tbody>
              {formulaFactors.map((row, i) => (
                <tr key={i} style={{ borderBottom: i < formulaFactors.length - 1 ? '1px solid #27272a' : 'none' }}>
                  <td style={{ padding: '0.75rem', color: '#e4e4e7', fontWeight: 500 }}>{row.factor}</td>
                  <td style={{ padding: '0.75rem', color: '#a1a1aa', fontFamily: 'monospace', fontSize: '0.8rem', whiteSpace: 'pre-wrap' }}>{row.formula}</td>
                  <td style={{ padding: '0.75rem', color: '#a1a1aa' }}>{row.meaning}</td>
                  <td style={{ padding: '0.75rem', color: '#a1a1aa' }}>{row.justification}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
        <div style={{ marginTop: '1rem', padding: '1rem', background: '#27272a', borderRadius: 8, fontSize: '0.85rem', fontFamily: 'monospace', whiteSpace: 'pre-wrap', color: '#a1a1aa' }}>
{`Full activity proxy P (single expression):

  P = 5000 × (1 + 0.2×E) × (1 + 0.05×A/100) × (R/5) × M_price × Φ × (1 + 0.01×min(N,100)) × H

  where  H = max(0.5, 1 + 0.08×(hours−12)/12 + 0.12×ln(1 + late/2))
  E = employees, A = area (m²), R = rating 1–5, N = review count, late = hours after 23:00.`}
        </div>
      </section>

      <p style={{ fontSize: '0.9rem', color: '#71717a' }}>
        <Link href="/activity-simulator" style={{ color: '#7c3aed' }}>→ Activity & Risk</Link> · <Link href="/pipeline" style={{ color: '#7c3aed' }}>→ Pipeline</Link>
      </p>
    </main>
  );
}
