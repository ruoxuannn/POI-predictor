'use client';

import { useEffect, useState, useMemo, useCallback } from 'react';
import dynamic from 'next/dynamic';
import Link from 'next/link';
import { useAccount, useChainId, usePublicClient, useSimulateContract, useSwitchChain, useWriteContract } from 'wagmi';
import { useQueryClient } from '@tanstack/react-query';
import { keccak256, encodePacked } from 'viem';
import { revenueProxy, activityLevel } from '../../lib/simulator-calcs';
import {
  ACTIVITY_INDEX_BASELINE,
  currentActivityIndex,
  riskTierFromIndex,
  TIER_INTERPRETATION,
  yieldForTier,
  payoutForTier,
  isPayoutTriggered,
  POOL_INITIAL_GBP,
  THRESHOLDS,
} from '../../lib/activity-index';
import { parseOpeningHours } from '../../lib/opening-hours';
import { addresses, hasContracts, engineAbi, pubIdFromOsmId } from '../../lib/contracts';
import { useFlrPrice, formatStableInCurrency, formatInCurrency } from '../../lib/useFlrPrice';
import { coston2 } from '../../lib/chains';

const LondonMap = dynamic(() => import('./LondonMap'), { ssr: false });

function Slider({ label, value, min, max, step, format, onChange }) {
  return (
    <div style={{ marginBottom: '1rem' }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '0.25rem', fontSize: '0.8rem' }}>
        <span style={{ color: '#a1a1aa' }}>{label}</span>
        <span style={{ fontWeight: 600, color: '#e4e4e7' }}>{format(value)}</span>
      </div>
      <input
        type="range"
        min={min}
        max={max}
        step={step ?? 1}
        value={value}
        onChange={(e) => onChange(Number(e.target.value))}
        style={{ width: '100%', accentColor: '#7c3aed' }}
      />
    </div>
  );
}

/** Threshold bar: red (left, low index) → orange → yellow → green (right, high index). Marker at current index. */
function ThresholdBar({ activityIndex }) {
  const pct = Math.max(0, Math.min(100, activityIndex));
  return (
    <div style={{ position: 'relative', marginTop: '0.5rem' }}>
      <div style={{ display: 'flex', gap: 2 }}>
        <div style={{ flex: 1, height: 10, background: '#ef4444', borderRadius: 2 }} title="<65 Severe" />
        <div style={{ flex: 1, height: 10, background: '#f97316', borderRadius: 2 }} title="65–80 High" />
        <div style={{ flex: 1, height: 10, background: '#eab308', borderRadius: 2 }} title="80–90 Medium" />
        <div style={{ flex: 1, height: 10, background: '#22c55e', borderRadius: 2 }} title="≥90 Low" />
      </div>
      <div
        style={{
          position: 'absolute',
          left: `${pct}%`,
          top: '50%',
          transform: 'translate(-50%, -50%)',
          width: 14,
          height: 14,
          borderRadius: 7,
          background: '#fff',
          border: '2px solid #18181b',
          boxShadow: '0 0 0 1px #27272a',
          pointerEvents: 'none',
        }}
      />
    </div>
  );
}

function getPubRealValues(pub) {
  const { dailyHours, lateHours } = parseOpeningHours(pub.opening_hours || '');
  return {
    eventMult: Math.max(0.5, Math.min(2, Number(pub.event_multiplier) || 1)),
    rating: Math.max(1, Math.min(5, Number(pub.avg_rating) || 3.5)),
    ratingCount: Math.max(0, Math.min(100, Number(pub.rating_source_count) || 0)),
    area: Math.max(20, Math.min(500, Number(pub.floor_area_m2) || 100)),
    employees: Math.max(0, Math.min(50, Number(pub.employees) || 0)),
    hours: dailyHours,
    lateHours,
  };
}

export default function ActivitySimulatorPage() {
  const [pubs, setPubs] = useState([]);
  const [loading, setLoading] = useState(true);
  const [selectedOsmId, setSelectedOsmId] = useState(null);

  const [eventMult, setEventMult] = useState(1.2);
  const [rating, setRating] = useState(4);
  const [ratingCount, setRatingCount] = useState(0);
  const [area, setArea] = useState(100);
  const [employees, setEmployees] = useState(5);
  const [hours, setHours] = useState(12);
  const [lateHours, setLateHours] = useState(0);

  useEffect(() => {
    fetch('/api/pubs?all=1')
      .then((r) => r.json())
      .then((d) => {
        const list = (Array.isArray(d) ? d : []).map((p) => ({
          ...p,
          _parsedHours: parseOpeningHours(p.opening_hours),
        }));
        setPubs(list);
      })
      .finally(() => setLoading(false));
  }, []);

  const scenarioOverrides = useMemo(
    () => ({ eventMult, rating, ratingCount, area, employees, hours, lateHours }),
    [eventMult, rating, ratingCount, area, employees, hours, lateHours]
  );

  // Map shows only insurable pubs with valid coords; dropdown uses same list so selected pub always has a marker (and tooltip)
  const { simulatedPubs, maxProxy, pubsWithLocation } = useMemo(() => {
    if (!pubs.length) return { simulatedPubs: [], maxProxy: 1, pubsWithLocation: [] };
    const withSim = pubs.map((p) => {
      const base =
        p.osm_id === selectedOsmId
          ? revenueProxy(p, getPubRealValues(p))
          : revenueProxy(p, {});
      const sim = p.osm_id === selectedOsmId ? revenueProxy(p, scenarioOverrides) : base;
      return { ...p, baselineProxy: base, simulatedProxy: sim };
    });
    const maxProxy = Math.max(...withSim.map((p) => p.simulatedProxy), 1);
    const withLocation = withSim.filter(
      (p) => p.insurable === true && Number.isFinite(Number(p.lat)) && Number.isFinite(Number(p.lng))
    );
    return { simulatedPubs: withSim, maxProxy, pubsWithLocation: withLocation };
  }, [pubs, selectedOsmId, scenarioOverrides]);

  // When we have map pubs, ensure selection is one of them (so tooltip has a marker to attach to)
  useEffect(() => {
    if (!pubsWithLocation.length) return;
    const isInList = pubsWithLocation.some((p) => p.osm_id === selectedOsmId);
    if (selectedOsmId == null || !isInList) {
      setSelectedOsmId(pubsWithLocation[0].osm_id);
    }
  }, [pubsWithLocation, selectedOsmId]);

  const selectedPub = useMemo(() => pubs.find((p) => p.osm_id === selectedOsmId) || pubs[0], [pubs, selectedOsmId]);
  const realValues = useMemo(() => (selectedPub ? getPubRealValues(selectedPub) : null), [selectedPub]);

  useEffect(() => {
    const pub = pubs.find((p) => p.osm_id === selectedOsmId);
    if (!pub) return;
    const v = getPubRealValues(pub);
    setEventMult(v.eventMult);
    setRating(v.rating);
    setRatingCount(v.ratingCount);
    setArea(v.area);
    setEmployees(v.employees);
    setHours(v.hours);
    setLateHours(v.lateHours);
  }, [selectedOsmId, pubs]);

  const resetToRealData = useCallback(() => {
    if (realValues) {
      setEventMult(realValues.eventMult);
      setRating(realValues.rating);
      setRatingCount(realValues.ratingCount);
      setArea(realValues.area);
      setEmployees(realValues.employees);
      setHours(realValues.hours);
      setLateHours(realValues.lateHours);
    }
  }, [realValues]);

  const selectedPubResult = useMemo(
    () => simulatedPubs.find((p) => p.osm_id === selectedOsmId),
    [simulatedPubs, selectedOsmId]
  );

  const baselineProxy = selectedPubResult?.baselineProxy ?? 1;
  const currentProxy = selectedPubResult?.simulatedProxy ?? baselineProxy;
  const activityIndex = currentActivityIndex(baselineProxy, currentProxy);
  const riskTier = riskTierFromIndex(activityIndex);
  const yieldPct = yieldForTier(riskTier);
  const payoutAmount = payoutForTier(riskTier);
  const payoutTriggered = isPayoutTriggered(riskTier);
  const availableLiquidity = POOL_INITIAL_GBP - payoutAmount;
  const outstandingExposure = payoutAmount;

  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { priceWei } = useFlrPrice();
  const [currency, setCurrency] = useState('FLR');
  const [estimatedFeeWei, setEstimatedFeeWei] = useState(null);
  const queryClient = useQueryClient();
  const publicClient = usePublicClient({ chainId: coston2.id });

  const payoutStableWei = BigInt(payoutAmount) * 10n ** 18n;
  const premiumStableWei = 10n ** 19n; // 10 units demo premium (pub must prefund buffer)
  const settleDateKey = useMemo(() => {
    if (!selectedOsmId) return null;
    const dateKeyStr = `${new Date().toISOString().slice(0, 10)}_${selectedOsmId}`;
    return keccak256(encodePacked(['string'], [dateKeyStr]));
  }, [selectedOsmId]);
  const settlePubId = useMemo(() => (selectedOsmId ? pubIdFromOsmId(selectedOsmId) : null), [selectedOsmId]);

  const { data: settleSimulation } = useSimulateContract({
    address: addresses.engine || undefined,
    abi: engineAbi,
    functionName: 'settleWithQuote',
    args: settlePubId && settleDateKey ? [settlePubId, settleDateKey, premiumStableWei, payoutStableWei] : undefined,
    account: address ?? undefined,
  });

  useEffect(() => {
    if (!settleSimulation?.request?.gas || !publicClient) {
      setEstimatedFeeWei(null);
      return;
    }
    let cancelled = false;
    publicClient.getGasPrice().then((gasPrice) => {
      if (cancelled) return;
      const feeWei = (settleSimulation.request.gas * 120n / 100n) * gasPrice; // ~20% buffer
      setEstimatedFeeWei(feeWei);
    });
    return () => { cancelled = true; };
  }, [settleSimulation?.request?.gas, publicClient]);

  const { writeContractAsync: writeSettleAsync, isPending: isSettlePending } = useWriteContract();

  const handleSettle = useCallback(async () => {
    if (!addresses.engine || !settlePubId || !settleDateKey || !payoutTriggered) return;
    try {
      if (chainId !== coston2.id) {
        await switchChainAsync({ chainId: coston2.id });
      }
      await writeSettleAsync({
        address: addresses.engine,
        abi: engineAbi,
        functionName: 'settleWithQuote',
        args: [settlePubId, settleDateKey, premiumStableWei, payoutStableWei],
      });
      await queryClient.invalidateQueries();
    } catch (e) {
      console.error(e);
    }
  }, [addresses.engine, chainId, settlePubId, settleDateKey, payoutTriggered, switchChainAsync, writeSettleAsync, queryClient]);

  if (loading) {
    return (
      <main style={{ maxWidth: 1200, margin: '0 auto', padding: '2rem 1rem' }}>
        <p style={{ color: '#71717a' }}>Loading pubs…</p>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 1400, margin: '0 auto', padding: '1.5rem 1rem' }}>
      <div style={{ marginBottom: '1.5rem' }}>
        <h1 style={{ fontWeight: 600, fontSize: '1.75rem', margin: 0 }}>Activity & Risk</h1>
      </div>
      <p style={{ color: '#a1a1aa', marginBottom: '1rem', fontSize: '0.9rem' }}>
        Activity Index–based parametric risk pricing using Flare Data Connector. Select a pub and move sliders; index is baseline 100, modified multiplicatively. Map shows {pubsWithLocation.length} insurable London pubs (location + full data per run.js) by activity level.
      </p>
      <div style={{ marginBottom: '1rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
        <span style={{ fontSize: '0.85rem', color: '#71717a' }}>Display:</span>
        {['FLR', 'USD', 'GBP'].map((c) => (
          <button
            key={c}
            type="button"
            onClick={() => setCurrency(c)}
            style={{
              padding: '0.35rem 0.6rem',
              fontSize: '0.8rem',
              background: currency === c ? '#7c3aed' : '#27272a',
              border: '1px solid #3f3f46',
              borderRadius: 6,
              color: '#e4e4e7',
              cursor: 'pointer',
            }}
          >
            {c}
          </button>
        ))}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '320px 1fr', gap: '1.5rem', alignItems: 'start' }}>
        {/* Left: pub selector + sliders */}
        <div
          style={{
            background: '#18181b',
            borderRadius: 12,
            border: '1px solid #27272a',
            padding: '1.25rem',
            position: 'sticky',
            top: '1rem',
          }}
        >
          <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '0.5rem' }}>Select pub</h2>
          <select
            value={selectedOsmId ?? ''}
            onChange={(e) => setSelectedOsmId(Number(e.target.value))}
            style={{
              width: '100%',
              padding: '0.5rem',
              marginBottom: '1rem',
              background: '#27272a',
              border: '1px solid #3f3f46',
              borderRadius: 8,
              color: '#e4e4e7',
              fontSize: '0.9rem',
            }}
          >
            {pubsWithLocation.map((p) => (
              <option key={p.osm_id} value={p.osm_id}>{p.name || `Pub ${p.osm_id}`}</option>
            ))}
          </select>

          <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '1rem' }}>Scenario parameters</h2>
          <Slider label="Event multiplier (e.g. football)" value={eventMult} min={0.5} max={2} step={0.1} format={(v) => v.toFixed(1)} onChange={setEventMult} />
          <Slider label="Star rating (1–5)" value={rating} min={1} max={5} step={0.1} format={(v) => v.toFixed(1)} onChange={setRating} />
          <Slider label="Review count" value={ratingCount} min={0} max={100} format={(v) => v} onChange={setRatingCount} />
          <Slider label="Floor area (m²)" value={area} min={20} max={500} format={(v) => v} onChange={setArea} />
          <Slider label="Employees" value={employees} min={0} max={50} format={(v) => v} onChange={setEmployees} />
          <Slider label="Daily hours" value={hours} min={8} max={24} format={(v) => `${v}h`} onChange={setHours} />
          <Slider label="Late night hours (after 23:00)" value={lateHours} min={0} max={5} format={(v) => v} onChange={setLateHours} />
          <button
            type="button"
            onClick={resetToRealData}
            style={{ marginTop: '0.5rem', padding: '0.4rem 0.75rem', background: '#27272a', border: '1px solid #3f3f46', borderRadius: 6, color: '#e4e4e7', fontSize: '0.8rem', cursor: 'pointer' }}
          >
            Reset to this pub’s real data
          </button>
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: '1.5rem' }}>
          {/* Map */}
          <div style={{ background: '#18181b', borderRadius: 12, border: '1px solid #27272a', overflow: 'hidden', height: 420 }}>
            <LondonMap pubs={pubsWithLocation} maxProxy={maxProxy} selectedOsmId={selectedOsmId} selectedPubActivityIndex={activityIndex} />
          </div>

          {/* Activity Index + Risk + Yield + Pool */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 280px', gap: '1rem' }}>
            <div style={{ background: '#18181b', borderRadius: 12, border: '1px solid #27272a', padding: '1.25rem' }}>
              <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '1rem' }}>Activity Index & risk</h2>
              <p style={{ marginBottom: '1rem', fontSize: '0.8rem', color: '#71717a' }}>
                Current = 100 × (proxy with sliders) ÷ (proxy at this pub&apos;s real data). Full formula and factor justification: <Link href="/documentation" style={{ color: '#7c3aed' }}>Documentation</Link>.
              </p>
              <div style={{ display: 'flex', alignItems: 'center', gap: '1.5rem', flexWrap: 'wrap', marginBottom: '1rem' }}>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#71717a' }}>Baseline</div>
                  <span style={{ fontSize: '1.75rem', fontWeight: 700 }}>{ACTIVITY_INDEX_BASELINE}</span>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#71717a' }}>Current (sliders)</div>
                  <span style={{ fontSize: '1.75rem', fontWeight: 700, color: activityIndex >= THRESHOLDS.LOW ? '#22c55e' : activityIndex >= THRESHOLDS.MEDIUM ? '#eab308' : activityIndex >= THRESHOLDS.HIGH ? '#f97316' : '#ef4444' }}>
                    {activityIndex}
                  </span>
                </div>
                <div>
                  <div style={{ fontSize: '0.75rem', color: '#71717a' }}>Risk tier</div>
                  <span style={{ fontSize: '1.1rem', fontWeight: 600 }}>{riskTier}</span>
                  <span style={{ marginLeft: '0.5rem', fontSize: '0.8rem', color: '#71717a' }}>{TIER_INTERPRETATION[riskTier]}</span>
                </div>
                {payoutTriggered && (
                  <span
                    style={{
                      padding: '0.25rem 0.5rem',
                      background: '#7f1d1d',
                      color: '#fca5a5',
                      borderRadius: 6,
                      fontSize: '0.8rem',
                      fontWeight: 600,
                    }}
                  >
                    Payout triggered
                  </span>
                )}
              </div>
              <div style={{ position: 'relative', height: 24 }}>
                <ThresholdBar activityIndex={activityIndex} />
              </div>
              <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#71717a' }}>
                &lt;{THRESHOLDS.HIGH} Severe · {THRESHOLDS.HIGH}–{THRESHOLDS.MEDIUM} High · {THRESHOLDS.MEDIUM}–{THRESHOLDS.LOW} Medium · ≥{THRESHOLDS.LOW} Low
              </p>

              <div style={{ marginTop: '1.25rem', paddingTop: '1rem', borderTop: '1px solid #27272a' }}>
                <div style={{ fontSize: '0.75rem', color: '#71717a' }}>Investor yield (risk-based)</div>
                <p style={{ margin: '0.25rem 0 0', fontSize: '1.5rem', fontWeight: 600 }}>{yieldPct}% APY</p>
                <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#71717a' }}>Compensation for absorbing downside risk; increases with tier.</p>
              </div>

              {payoutTriggered && (
                <div style={{ marginTop: '1rem' }}>
                  <div style={{ fontSize: '0.75rem', color: '#71717a' }}>Payout (this scenario, default FLR on-chain)</div>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '1.25rem', fontWeight: 600, color: '#f97316' }}>
                    {formatStableInCurrency(payoutStableWei, currency, priceWei)}
                  </p>
                  <p style={{ marginTop: '0.5rem', fontSize: '0.75rem', color: '#71717a' }}>
                    Simulate first (no broadcast); fees on Flare are paid in FLR (C2FLR) only—no ETH.
                  </p>
                  {hasContracts() && isConnected && (
                    <>
                      {settleSimulation?.request && (
                        <p style={{ marginTop: '0.5rem', fontSize: '0.8rem', color: '#22c55e' }}>
                          Simulate OK. Estimated network fee: {formatInCurrency(estimatedFeeWei ?? 0n, 'FLR', priceWei)} (C2FLR)
                        </p>
                      )}
                      <button
                        type="button"
                        onClick={handleSettle}
                        disabled={isSettlePending}
                        style={{
                          marginTop: '0.75rem',
                          padding: '0.5rem 1rem',
                          background: '#7c3aed',
                          border: 'none',
                          borderRadius: 8,
                          color: '#fff',
                          fontSize: '0.9rem',
                          cursor: isSettlePending ? 'wait' : 'pointer',
                        }}
                      >
                        {isSettlePending ? 'Settling…' : 'Settle on-chain'}
                      </button>
                    </>
                  )}
                </div>
              )}
            </div>

            {/* Capital pool */}
            <div style={{ background: '#18181b', borderRadius: 12, border: '1px solid #27272a', padding: '1.25rem' }}>
              <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '1rem' }}>Capital pool (sim)</h2>
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#71717a' }}>Total liquidity</div>
                <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{formatStableInCurrency(BigInt(POOL_INITIAL_GBP) * 10n ** 18n, currency, priceWei)}</div>
              </div>
              <div style={{ marginBottom: '0.75rem' }}>
                <div style={{ fontSize: '0.75rem', color: '#71717a' }}>Available (after this payout)</div>
                <div style={{ fontWeight: 600, fontSize: '1.1rem' }}>{formatStableInCurrency(BigInt(availableLiquidity) * 10n ** 18n, currency, priceWei)}</div>
              </div>
              <div>
                <div style={{ fontSize: '0.75rem', color: '#71717a' }}>Outstanding exposure</div>
                <div style={{ fontWeight: 600, color: payoutTriggered ? '#f97316' : undefined }}>{formatStableInCurrency(BigInt(outstandingExposure) * 10n ** 18n, currency, priceWei)}</div>
              </div>
              <p style={{ marginTop: '1rem', fontSize: '0.75rem', color: '#71717a' }}>
                When payout triggers, pool balance decreases. Settle on-chain to pay pub (FLR by default). Fees on Flare Coston2 are in FLR (C2FLR) only—no ETH.
              </p>
            </div>
          </div>
        </div>
      </div>
    </main>
  );
}
