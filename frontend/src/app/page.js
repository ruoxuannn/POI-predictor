'use client';

import { useState, useEffect } from 'react';
import { useAccount, useBalance, useChainId, useConnect, usePublicClient, useReadContract, useSimulateContract, useSwitchChain, useWriteContract } from 'wagmi';
import { parseUnits } from 'viem';
import { addresses, hasContracts, poolAbi, stableAbi, pubIdFromOsmId } from '../lib/contracts';
import { useFlrPrice, formatInCurrency, formatStableInCurrency } from '../lib/useFlrPrice';
import { yieldForTier } from '../lib/activity-index';
import { coston2 } from '../lib/chains';

const CARD_STYLE = {
  background: '#18181b',
  borderRadius: 12,
  border: '1px solid #27272a',
  padding: '1.25rem',
};

const FLARE_COSTON2_CHAIN_ID = 114;

export default function MyWalletPage() {
  const { address, isConnected } = useAccount();
  const chainId = useChainId();
  const { switchChainAsync } = useSwitchChain();
  const { connect, connectors, isPending: isConnectPending, error: connectError } = useConnect();
  const { data: flrBalance } = useBalance({ address });
  const { priceWei } = useFlrPrice();
  const [currency, setCurrency] = useState('FLR');
  const [pubs, setPubs] = useState([]);
  const [selectedOsmId, setSelectedOsmId] = useState('');
  const [investAmount, setInvestAmount] = useState('');
  const [loadingPubs, setLoadingPubs] = useState(true);

  useEffect(() => {
    fetch('/api/pubs?all=1')
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d) ? d : [];
        setPubs(list.filter((p) => p.insurable === true));
        if (list.length && !selectedOsmId) setSelectedOsmId(String(list[0]?.osm_id ?? ''));
      })
      .finally(() => setLoadingPubs(false));
  }, []);

  const pubId = selectedOsmId ? pubIdFromOsmId(Number(selectedOsmId)) : undefined;
  const publicClient = usePublicClient({ chainId: coston2.id });
  const [investSimFeeWei, setInvestSimFeeWei] = useState(null);

  const investAmountWei = investAmount ? (() => { try { return parseUnits(String(investAmount), 18); } catch { return 0n; } })() : 0n;
  const { data: investSimulation } = useSimulateContract({
    address: addresses.pool || undefined,
    abi: poolAbi,
    functionName: 'depositStableInvestorForPub',
    args: pubId && investAmountWei > 0n ? [pubId, investAmountWei] : undefined,
    account: address ?? undefined,
  });

  useEffect(() => {
    if (!investSimulation?.request?.gas || !publicClient) {
      setInvestSimFeeWei(null);
      return;
    }
    let cancelled = false;
    publicClient.getGasPrice().then((gasPrice) => {
      if (cancelled) return;
      setInvestSimFeeWei((investSimulation.request.gas * 120n / 100n) * gasPrice);
    });
    return () => { cancelled = true; };
  }, [investSimulation?.request?.gas, publicClient]);

  const { writeContract: writePool, isPending: isPoolPending } = useWriteContract();
  const { writeContract: writeApprove, isPending: isApprovePending } = useWriteContract();

  const handleInvest = async () => {
    if (!addresses.pool || !addresses.stable || !selectedOsmId || !investAmount) return;
    const amountWei = parseUnits(String(investAmount), 18);
    if (amountWei === 0n) return;
    try {
      if (chainId !== FLARE_COSTON2_CHAIN_ID) {
        await switchChainAsync({ chainId: FLARE_COSTON2_CHAIN_ID });
      }
      await writeApprove({
        address: addresses.stable,
        abi: stableAbi,
        functionName: 'approve',
        args: [addresses.pool, amountWei],
      });
      await writePool({
        address: addresses.pool,
        abi: poolAbi,
        functionName: 'depositStableInvestorForPub',
        args: [pubIdFromOsmId(Number(selectedOsmId)), amountWei],
      });
      setInvestAmount('');
    } catch (e) {
      console.error(e);
    }
  };

  if (!isConnected) {
    const connector = connectors[0];
    return (
      <main style={{ maxWidth: 960, margin: '0 auto', padding: '2rem 1rem' }}>
        <h1 style={{ fontWeight: 600, fontSize: '1.75rem', marginBottom: '0.5rem' }}>My Wallet</h1>
        <p style={{ color: '#a1a1aa', marginBottom: '2rem' }}>
          Connect your Flare wallet to view balance, invest in pubs, and see positions.
        </p>
        <div style={{ ...CARD_STYLE, textAlign: 'center', padding: '3rem 2rem', color: '#71717a' }}>
          <p style={{ margin: 0, fontSize: '1rem', marginBottom: '1rem' }}>
            {connector ? 'Connect your browser wallet (e.g. MetaMask) to Flare Coston2.' : 'No wallet detected.'}
          </p>
          {!connector && (
            <div style={{ textAlign: 'left', maxWidth: 360, margin: '1rem auto 0', fontSize: '0.9rem' }}>
              <p style={{ marginBottom: '0.5rem' }}><strong>Install a wallet:</strong></p>
              <ol style={{ margin: 0, paddingLeft: '1.25rem', color: '#a1a1aa' }}>
                <li>Install <a href="https://metamask.io/download/" target="_blank" rel="noopener noreferrer" style={{ color: '#7c3aed' }}>MetaMask</a> (browser extension).</li>
                <li>Create or import a wallet.</li>
                <li>Add Flare Coston2 testnet: Chain ID <strong>114</strong>, RPC <code style={{ fontSize: '0.8rem' }}>https://coston2-api.flare.network/ext/C/rpc</code>.</li>
                <li>Refresh this page and click Connect.</li>
              </ol>
            </div>
          )}
          {connector && (
            <button
              type="button"
              onClick={() => connect({ connector })}
              disabled={isConnectPending}
              style={{
                padding: '0.6rem 1.25rem',
                fontSize: '1rem',
                background: '#7c3aed',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                cursor: isConnectPending ? 'wait' : 'pointer',
              }}
            >
              {isConnectPending ? 'Connecting…' : 'Connect wallet'}
            </button>
          )}
          {connectError && (
            <p style={{ marginTop: '1rem', fontSize: '0.85rem', color: '#f87171' }}>{connectError.message}</p>
          )}
        </div>
      </main>
    );
  }

  return (
    <main style={{ maxWidth: 960, margin: '0 auto', padding: '2rem 1rem' }}>
      <h1 style={{ fontWeight: 600, fontSize: '1.75rem', marginBottom: '0.5rem' }}>My Wallet</h1>
      <p style={{ color: '#a1a1aa', marginBottom: '1.5rem' }}>
        Investor wallet. Invest in pubs to earn risk-based yield; payouts reduce pool when thresholds trigger.
      </p>

      {/* Currency toggle */}
      <div style={{ marginBottom: '1.5rem', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
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

      {/* Balance */}
      <div style={{ ...CARD_STYLE, marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '0.75rem' }}>Balance</h2>
        <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>
          {formatInCurrency(flrBalance?.value ?? 0n, currency, priceWei)}
        </div>
        <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#71717a' }}>Native FLR (Coston2: C2FLR). Network fees are paid in FLR only—no ETH.</p>
      </div>

      {!hasContracts() && (
        <div style={{ ...CARD_STYLE, marginBottom: '1.5rem', borderColor: '#f97316', color: '#fdba74' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>Contracts not configured</p>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#e4e4e7' }}>
            Create <code style={{ background: '#27272a', padding: '0.1rem 0.3rem', borderRadius: 4 }}>frontend/.env.local</code> with the five contract addresses (see <code style={{ background: '#27272a', padding: '0.1rem 0.3rem', borderRadius: 4 }}>.env.local.example</code>). Deploy first from <code style={{ background: '#27272a', padding: '0.1rem 0.3rem', borderRadius: 4 }}>contracts/</code>, then paste addresses and restart the dev server.
          </p>
        </div>
      )}

      {hasContracts() && (
        <>
          {/* Invest in a pub */}
          <div style={{ ...CARD_STYLE, marginBottom: '1.5rem' }}>
            <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '1rem' }}>Invest in a pub</h2>
            <p style={{ fontSize: '0.8rem', color: '#71717a', marginBottom: '0.75rem' }}>Add stable to a pub&apos;s capital pool. Yield is risk-based (4–12% APY). Simulate first; network fees are in FLR (C2FLR) only—no ETH.</p>
            {investSimulation?.request && investAmountWei > 0n && (
              <p style={{ fontSize: '0.8rem', color: '#22c55e', marginBottom: '0.5rem' }}>
                Simulate OK. Estimated fee: {formatInCurrency(investSimFeeWei ?? 0n, 'FLR', priceWei)} (C2FLR)
              </p>
            )}
            <div style={{ display: 'flex', flexWrap: 'wrap', gap: '0.75rem', alignItems: 'flex-end' }}>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#71717a', marginBottom: '0.25rem' }}>Pub</label>
                <select
                  value={selectedOsmId}
                  onChange={(e) => setSelectedOsmId(e.target.value)}
                  style={{
                    padding: '0.5rem',
                    background: '#27272a',
                    border: '1px solid #3f3f46',
                    borderRadius: 8,
                    color: '#e4e4e7',
                    fontSize: '0.9rem',
                    minWidth: 200,
                  }}
                >
                  {pubs.map((p) => (
                    <option key={p.osm_id} value={p.osm_id}>{p.name || `Pub ${p.osm_id}`}</option>
                  ))}
                </select>
              </div>
              <div>
                <label style={{ display: 'block', fontSize: '0.75rem', color: '#71717a', marginBottom: '0.25rem' }}>Amount (stable, 18 decimals)</label>
                <input
                  type="text"
                  placeholder="e.g. 100"
                  value={investAmount}
                  onChange={(e) => setInvestAmount(e.target.value)}
                  style={{
                    padding: '0.5rem',
                    background: '#27272a',
                    border: '1px solid #3f3f46',
                    borderRadius: 8,
                    color: '#e4e4e7',
                    fontSize: '0.9rem',
                    width: 120,
                  }}
                />
              </div>
              <button
                type="button"
                onClick={handleInvest}
                disabled={isPoolPending || isApprovePending || !investAmount}
                style={{
                  padding: '0.5rem 1rem',
                  background: '#7c3aed',
                  border: 'none',
                  borderRadius: 8,
                  color: '#fff',
                  fontSize: '0.9rem',
                  cursor: isPoolPending || isApprovePending ? 'wait' : 'pointer',
                }}
              >
                {isPoolPending || isApprovePending ? 'Confirming…' : 'Invest'}
              </button>
            </div>
          </div>

          {/* My positions */}
          <PositionsList address={address} currency={currency} priceWei={priceWei} />
        </>
      )}
    </main>
  );
}

function PositionsList({ address, currency, priceWei }) {
  const [pubs, setPubs] = useState([]);
  useEffect(() => {
    fetch('/api/pubs?all=1').then((r) => r.json()).then((d) => setPubs(Array.isArray(d) ? d.filter((p) => p.insurable) : []));
  }, []);

  return (
    <div style={CARD_STYLE}>
      <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '1rem' }}>My positions</h2>
      {pubs.length === 0 ? (
        <p style={{ color: '#71717a', fontSize: '0.9rem' }}>No pubs loaded.</p>
      ) : (
        <ul style={{ listStyle: 'none', margin: 0, padding: 0 }}>
          {pubs.map((pub) => (
            <PositionRow
              key={pub.osm_id}
              pub={pub}
              address={address}
              currency={currency}
              priceWei={priceWei}
            />
          ))}
        </ul>
      )}
    </div>
  );
}

function PositionRow({ pub, address, currency, priceWei }) {
  const pubId = pubIdFromOsmId(pub.osm_id);
  const { data: stake } = useReadContract({
    address: addresses.pool || undefined,
    abi: poolAbi,
    functionName: 'investorStableInPub',
    args: address ? [address, pubId] : undefined,
  });
  const stakeWei = stake ?? 0n;
  if (stakeWei === 0n) return null;
  const tier = 'Medium';
  const yieldPct = yieldForTier(tier);

  return (
    <li
      style={{
        display: 'flex',
        justifyContent: 'space-between',
        alignItems: 'center',
        padding: '0.75rem 0',
        borderBottom: '1px solid #27272a',
      }}
    >
      <div>
        <div style={{ fontWeight: 600 }}>{pub.name || `Pub ${pub.osm_id}`}</div>
        <div style={{ fontSize: '0.8rem', color: '#71717a' }}>Yield {yieldPct}% APY (risk-based)</div>
      </div>
      <div style={{ fontWeight: 600 }}>
        {formatStableInCurrency(stakeWei, currency, priceWei)}
      </div>
    </li>
  );
}
