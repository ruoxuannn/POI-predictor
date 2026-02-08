'use client';

import { useEffect, useState } from 'react';

export default function PipelinePage() {
  const [schedule, setSchedule] = useState(null);
  const [pubs, setPubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [lastFetch, setLastFetch] = useState(null);
  const [liveFetch, setLiveFetch] = useState(false);
  const [pipelineStatus, setPipelineStatus] = useState(null);
  const [unlocked, setUnlocked] = useState(false);
  const [showPasswordPrompt, setShowPasswordPrompt] = useState(false);
  const [passwordInput, setPasswordInput] = useState('');
  const [passwordError, setPasswordError] = useState('');

  const fetchSchedule = async () => {
    const r = await fetch('/api/schedule');
    const d = await r.json();
    setSchedule(d);
  };

  const fetchPubs = async () => {
    const r = await fetch('/api/pubs');
    const d = await r.json();
    setPubs(Array.isArray(d) ? d : []);
    setLastFetch(new Date());
  };

  const fetchPipelineStatus = async () => {
    const r = await fetch('/api/pipeline/status');
    const d = await r.json();
    setPipelineStatus(d);
  };

  useEffect(() => {
    (async () => {
      setLoading(true);
      await Promise.all([fetchSchedule(), fetchPubs(), fetchPipelineStatus()]);
      setLoading(false);
    })();
  }, []);

  useEffect(() => {
    if (loading) return;
    const t = setInterval(fetchPubs, 8000);
    return () => clearInterval(t);
  }, [loading]);

  useEffect(() => {
    if (!liveFetch) return;
    (async () => {
      const r = await fetch('/api/pipeline/start', { method: 'POST' });
      const d = await r.json();
      if (!d.ok) return;
      fetchPipelineStatus();
    })();
  }, [liveFetch]);

  useEffect(() => {
    if (!liveFetch || (pipelineStatus && !pipelineStatus.running)) return;
    const t = setInterval(() => {
      fetchPipelineStatus();
    }, 1000);
    return () => clearInterval(t);
  }, [liveFetch, pipelineStatus?.running]);

  useEffect(() => {
    if (pipelineStatus && !pipelineStatus.running && !pipelineStatus.interrupted) fetchPubs();
  }, [pipelineStatus?.running, pipelineStatus?.interrupted]);

  const handleStop = async () => {
    await fetch('/api/pipeline/stop', { method: 'POST' });
    await fetchPipelineStatus();
  };

  const avgRev = pubs.length ? pubs.reduce((a, p) => a + (p.revenue_proxy || 0), 0) / pubs.length : 0;
  const totalRev = pubs.reduce((a, p) => a + (p.revenue_proxy || 0), 0);
  const top = [...pubs].sort((a, b) => (b.revenue_proxy || 0) - (a.revenue_proxy || 0)).slice(0, 10);
  const sortedPubs = [...pubs].sort((a, b) => (b.revenue_proxy || 0) - (a.revenue_proxy || 0));

  function stepProgress(s) {
    if (s.status === 'done' || s.status === 'interrupted') return { pct: 100, eta: null };
    if (s.status === 'pending') return { pct: 0, eta: s.estimatedSeconds ? `~${s.estimatedSeconds}s` : null };
    if (s.status === 'running' && s.startedAt && s.estimatedSeconds) {
      const elapsed = (Date.now() - new Date(s.startedAt).getTime()) / 1000;
      const pct = Math.min(95, Math.round((elapsed / s.estimatedSeconds) * 100));
      const etaSec = Math.max(0, Math.round(s.estimatedSeconds - elapsed));
      return { pct, eta: etaSec > 60 ? `~${Math.round(etaSec / 60)}m` : `~${etaSec}s` };
    }
    return { pct: 0, eta: null };
  }

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ fontWeight: 600, fontSize: '1.75rem', marginBottom: '0.5rem' }}>Pipeline</h1>
      <p style={{ color: '#a1a1aa', marginBottom: '2rem' }}>
        Snapshot for demo · Data ingestion scheduler turned off by default, turn on to fetch data at regular pre-defined intervals.
      </p>

      {loading ? (
        <p style={{ color: '#71717a' }}>Loading…</p>
      ) : (
        <>
          <section style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#a1a1aa' }}>
              Live fetch
            </h2>
            <div
              style={{
                background: '#18181b',
                borderRadius: 12,
                padding: '1rem 1.25rem',
                border: '1px solid #27272a',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'space-between',
                flexWrap: 'wrap',
                gap: '1rem',
              }}
            >
              <p style={{ margin: 0, fontSize: '0.9rem' }}>
                Run the pipeline from the site. When off, no fetch runs. Turn off while running to interrupt (data will not be updated).
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '0.75rem', flexWrap: 'wrap' }}>
                <button
                  type="button"
                  onClick={() => {
                    if (!liveFetch) {
                      if (unlocked) setLiveFetch(true);
                      else setShowPasswordPrompt(true);
                    } else if (pipelineStatus?.running) handleStop();
                    else setLiveFetch(false);
                  }}
                  style={{
                    padding: '0.5rem 1rem',
                    borderRadius: 8,
                    border: '1px solid #27272a',
                    background: !liveFetch ? '#27272a' : pipelineStatus?.interrupted ? '#451a1a' : '#1e3a2f',
                    color: !liveFetch ? '#e4e4e7' : pipelineStatus?.interrupted ? '#fca5a5' : '#86efac',
                    fontWeight: 500,
                    cursor: 'pointer',
                    fontSize: '0.875rem',
                  }}
                >
                  {!liveFetch && 'Off — turn on'}
                  {liveFetch && pipelineStatus?.running && 'Running… (click to stop)'}
                  {liveFetch && !pipelineStatus?.running && pipelineStatus?.interrupted && 'Interrupted (click to turn off)'}
                  {liveFetch && !pipelineStatus?.running && !pipelineStatus?.interrupted && pipelineStatus?.steps?.length > 0 && 'Done (click to turn off)'}
                  {liveFetch && !pipelineStatus?.running && !pipelineStatus?.interrupted && !pipelineStatus?.steps?.length && 'On (click to turn off)'}
                </button>
                {showPasswordPrompt && (
                  <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', flexWrap: 'wrap' }}>
                    <input
                      type="password"
                      placeholder="Password"
                      value={passwordInput}
                      onChange={(e) => {
                        setPasswordInput(e.target.value);
                        setPasswordError('');
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          if (passwordInput === 'ethpubdreamteam') {
                            setUnlocked(true);
                            setLiveFetch(true);
                            setShowPasswordPrompt(false);
                            setPasswordInput('');
                            setPasswordError('');
                          } else {
                            setPasswordError('Incorrect password');
                          }
                        }
                        if (e.key === 'Escape') {
                          setShowPasswordPrompt(false);
                          setPasswordInput('');
                          setPasswordError('');
                        }
                      }}
                      autoFocus
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderRadius: 8,
                        border: `1px solid ${passwordError ? '#7f1d1d' : '#27272a'}`,
                        background: '#27272a',
                        color: '#e4e4e7',
                        fontSize: '0.875rem',
                        minWidth: 180,
                      }}
                    />
                    <button
                      type="button"
                      onClick={() => {
                        if (passwordInput === 'ethpubdreamteam') {
                          setUnlocked(true);
                          setLiveFetch(true);
                          setShowPasswordPrompt(false);
                          setPasswordInput('');
                          setPasswordError('');
                        } else {
                          setPasswordError('Incorrect password');
                        }
                      }}
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderRadius: 8,
                        border: '1px solid #27272a',
                        background: '#3b82f6',
                        color: '#fff',
                        fontWeight: 500,
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                      }}
                    >
                      Unlock
                    </button>
                    <button
                      type="button"
                      onClick={() => {
                        setShowPasswordPrompt(false);
                        setPasswordInput('');
                        setPasswordError('');
                      }}
                      style={{
                        padding: '0.5rem 0.75rem',
                        borderRadius: 8,
                        border: '1px solid #27272a',
                        background: 'transparent',
                        color: '#a1a1aa',
                        cursor: 'pointer',
                        fontSize: '0.875rem',
                      }}
                    >
                      Cancel
                    </button>
                    {passwordError && (
                      <span style={{ fontSize: '0.8rem', color: '#fca5a5' }}>{passwordError}</span>
                    )}
                  </div>
                )}
              </div>
            </div>
            {liveFetch && pipelineStatus?.steps?.length > 0 && (
              <ul style={{ margin: '0.75rem 0 0', padding: 0, listStyle: 'none' }}>
                {pipelineStatus.steps.map((s, i) => {
                  const { pct, eta } = stepProgress(s);
                  return (
                    <li
                      key={i}
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '0.5rem',
                        padding: '0.4rem 0',
                        fontSize: '0.85rem',
                        color: s.status === 'done' ? '#86efac' : s.status === 'running' ? '#fcd34d' : s.status === 'interrupted' ? '#fca5a5' : '#71717a',
                      }}
                    >
                      <span style={{ width: 20 }}>{s.status === 'done' ? '✓' : s.status === 'running' ? '⋯' : s.status === 'interrupted' ? '✕' : '○'}</span>
                      <span style={{ flex: 1 }}>{s.name}{s.status === 'interrupted' && <span style={{ marginLeft: 4, fontSize: '0.75rem', color: '#fca5a5' }}>(interrupted)</span>}</span>
                      <div style={{ display: 'flex', alignItems: 'center', gap: '0.5rem', minWidth: 120 }}>
                        <div
                          style={{
                            width: 72,
                            height: 6,
                            borderRadius: 3,
                            background: '#27272a',
                            overflow: 'hidden',
                          }}
                          title={s.status === 'running' ? `${pct}% · ${eta ?? ''} left` : s.status}
                        >
                          <div
                            style={{
                              width: `${pct}%`,
                              height: '100%',
                              background: s.status === 'done' ? '#22c55e' : s.status === 'running' ? '#eab308' : s.status === 'interrupted' ? '#ef4444' : '#3f3f46',
                              transition: 'width 0.3s ease, background 0.2s',
                            }}
                          />
                        </div>
                        {eta && (s.status === 'running' || s.status === 'pending') && (
                          <span style={{ fontSize: '0.75rem', color: '#71717a', whiteSpace: 'nowrap' }}>{eta} left</span>
                        )}
                      </div>
                    </li>
                  );
                })}
              </ul>
            )}
          </section>

          {pubs.length === 0 && !loading && (
            <p style={{ padding: '1rem', background: '#18181b', borderRadius: 8, marginBottom: '1.5rem', fontSize: '0.9rem', color: '#a1a1aa' }}>
              No pub data yet. Run the pipeline: <code style={{ background: '#27272a', padding: '2px 6px', borderRadius: 4 }}>cd data && node jobs/run.js</code>
            </p>
          )}
          <section style={{ marginBottom: '2.5rem' }}>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#a1a1aa' }}>
              Schedule
            </h2>
            <div
              style={{
                background: '#18181b',
                borderRadius: 12,
                padding: '1rem 1.25rem',
                border: '1px solid #27272a',
              }}
            >
              <ul style={{ margin: 0, paddingLeft: '1.25rem', listStyle: 'none' }}>
                {(schedule?.sources ?? []).map((s, i) => (
                  <li key={i} style={{ marginBottom: '0.35rem', fontSize: '0.9rem', color: s.disabled ? '#71717a' : undefined }}>
                    {s.name}
                    {s.disabled ? ' (disabled)' : s.interval ? ` — ${s.interval}` : ''}
                  </li>
                ))}
              </ul>
            </div>
          </section>

          <section>
            <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#a1a1aa' }}>
              Revenue proxy (live)
            </h2>
            <div
              style={{
                background: '#18181b',
                borderRadius: 12,
                padding: '1.25rem',
                border: '1px solid #27272a',
              }}
            >
              <p style={{ margin: 0, fontSize: '0.8rem', color: '#71717a' }}>
                Last updated: {lastFetch ? lastFetch.toLocaleTimeString() : '—'} · refreshes every 8s
              </p>
              <div style={{ display: 'flex', gap: '1.5rem', flexWrap: 'wrap', marginTop: '1rem' }}>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#71717a' }}>Pubs</span>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '1.5rem', fontWeight: 600 }}>{pubs.length}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#71717a' }}>Avg revenue proxy</span>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '1.5rem', fontWeight: 600 }}>{Math.round(avgRev).toLocaleString()}</p>
                </div>
                <div>
                  <span style={{ fontSize: '0.75rem', color: '#71717a' }}>Total (proxy)</span>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '1.5rem', fontWeight: 600 }}>{Math.round(totalRev).toLocaleString()}</p>
                </div>
              </div>
              {top.length > 0 && (
                <div style={{ marginTop: '1.5rem' }}>
                  <p style={{ margin: 0, marginBottom: '0.5rem', fontSize: '0.8rem', color: '#71717a' }}>Top 10 by revenue proxy</p>
                  <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                    <thead>
                      <tr style={{ textAlign: 'left', borderBottom: '1px solid #27272a' }}>
                        <th style={{ padding: '0.5rem 0' }}>Name</th>
                        <th style={{ padding: '0.5rem 0' }}>revenue_proxy</th>
                      </tr>
                    </thead>
                    <tbody>
                      {top.map((p) => (
                        <tr key={p.osm_id} style={{ borderBottom: '1px solid #27272a' }}>
                          <td style={{ padding: '0.5rem 0' }}>{p.name || p.osm_id}</td>
                          <td style={{ padding: '0.5rem 0' }}>{p.revenue_proxy?.toLocaleString() ?? '—'}</td>
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
              )}
            </div>
          </section>

          {sortedPubs.length > 0 && (
            <section style={{ marginTop: '2.5rem' }}>
              <h2 style={{ fontSize: '1rem', fontWeight: 600, marginBottom: '0.75rem', color: '#a1a1aa' }}>
                Pubs — list view (by revenue proxy)
              </h2>
              <div
                style={{
                  background: '#18181b',
                  borderRadius: 12,
                  border: '1px solid #27272a',
                  maxHeight: 420,
                  overflow: 'auto',
                }}
              >
                <table style={{ width: '100%', fontSize: '0.85rem', borderCollapse: 'collapse' }}>
                  <thead style={{ position: 'sticky', top: 0, background: '#18181b', zIndex: 1 }}>
                    <tr style={{ textAlign: 'left', borderBottom: '1px solid #27272a' }}>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Name</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>Address</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}>revenue_proxy</th>
                      <th style={{ padding: '0.6rem 0.75rem' }}></th>
                    </tr>
                  </thead>
                  <tbody>
                    {sortedPubs.map((p) => (
                      <tr key={p.osm_id} style={{ borderBottom: '1px solid #27272a' }}>
                        <td style={{ padding: '0.5rem 0.75rem' }}>{p.name || '—'}</td>
                        <td style={{ padding: '0.5rem 0.75rem', color: '#a1a1aa', maxWidth: 200 }} title={p.address}>
                          {(p.address || '—').slice(0, 40)}{(p.address || '').length > 40 ? '…' : ''}
                        </td>
                        <td style={{ padding: '0.5rem 0.75rem', fontWeight: 500 }}>{p.revenue_proxy != null ? p.revenue_proxy.toLocaleString() : '—'}</td>
                        <td style={{ padding: '0.5rem 0.75rem' }}>
                          {p.lat != null && p.lng != null && (
                            <a
                              href={`https://www.openstreetmap.org/?mlat=${p.lat}&mlon=${p.lng}&zoom=17`}
                              target="_blank"
                              rel="noopener noreferrer"
                              style={{ color: '#7c3aed', fontSize: '0.8rem' }}
                            >
                              Map
                            </a>
                          )}
                        </td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            </section>
          )}
        </>
      )}
    </main>
  );
}
