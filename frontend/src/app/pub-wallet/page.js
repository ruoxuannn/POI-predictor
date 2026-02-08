'use client';

import { useState, useEffect } from 'react';
import { useReadContract, useAccount, useConnect } from 'wagmi';
import { addresses, hasContracts, poolAbi, registryAbi, pubIdFromOsmId } from '../../lib/contracts';
import { useFlrPrice, formatInCurrency, formatStableInCurrency } from '../../lib/useFlrPrice';
import { useBalance } from 'wagmi';

const CARD_STYLE = {
  background: '#18181b',
  borderRadius: 12,
  border: '1px solid #27272a',
  padding: '1.25rem',
};

export default function PubWalletPage() {
  const { isConnected } = useAccount();
  const { connect, connectors, isPending: isConnectPending, error: connectError } = useConnect();
  const { priceWei } = useFlrPrice();
  const [currency, setCurrency] = useState('FLR');
  const [pubs, setPubs] = useState([]);
  const [selectedOsmId, setSelectedOsmId] = useState('');

  useEffect(() => {
    fetch('/api/pubs?all=1')
      .then((r) => r.json())
      .then((d) => {
        const list = Array.isArray(d) ? d : [];
        setPubs(list.filter((p) => p.insurable === true));
        if (list.length && !selectedOsmId) setSelectedOsmId(String(list[0]?.osm_id ?? ''));
      });
  }, []);

  const pubId = selectedOsmId ? pubIdFromOsmId(Number(selectedOsmId)) : undefined;
  const { data: pubRecord } = useReadContract({
    address: addresses.registry || undefined,
    abi: registryAbi,
    functionName: 'getPub',
    args: pubId ? [pubId] : undefined,
  });
  // getPub returns struct (wallet, payoutToken, exists) – viem may give object or tuple
  const pubExists = pubRecord && (pubRecord.exists === true || pubRecord[2] === true);
  const pubWallet = pubExists ? (pubRecord.wallet ?? pubRecord[0]) : null;

  const { data: poolStable } = useReadContract({
    address: addresses.pool || undefined,
    abi: poolAbi,
    functionName: 'pubPoolStable',
    args: pubId ? [pubId] : undefined,
  });
  const { data: poolCap } = useReadContract({
    address: addresses.pool || undefined,
    abi: poolAbi,
    functionName: 'pubPoolStableCap',
    args: pubId ? [pubId] : undefined,
  });

  const { data: walletBalance } = useBalance({ address: pubWallet ?? undefined });

  if (!isConnected) {
    const connector = connectors[0];
    return (
      <main style={{ maxWidth: 960, margin: '0 auto', padding: '2rem 1rem' }}>
        <h1 style={{ fontWeight: 600, fontSize: '1.75rem', marginBottom: '0.5rem' }}>Pub Wallet</h1>
        <p style={{ color: '#a1a1aa', marginBottom: '2rem' }}>
          Connect wallet to view pub coverage and capital pool. Select a pub to see its registered wallet and pool.
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
                <li>Add Flare Coston2: Chain ID <strong>114</strong>, RPC <code style={{ fontSize: '0.8rem' }}>https://coston2-api.flare.network/ext/C/rpc</code>.</li>
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
      <h1 style={{ fontWeight: 600, fontSize: '1.75rem', marginBottom: '0.5rem' }}>Pub Wallet</h1>
      <p style={{ color: '#a1a1aa', marginBottom: '1.5rem' }}>
        View capital pool and wallet balance for each insured pub. Payouts (FLR by default) increase pub wallet when thresholds trigger. Fees on Flare Coston2 are paid in FLR (C2FLR) only—no ETH.
      </p>

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

      {!hasContracts() && (
        <div style={{ ...CARD_STYLE, marginBottom: '1.5rem', borderColor: '#f97316', color: '#fdba74' }}>
          <p style={{ margin: 0, fontSize: '0.9rem', fontWeight: 600 }}>Contracts not configured</p>
          <p style={{ margin: '0.5rem 0 0', fontSize: '0.85rem', color: '#e4e4e7' }}>
            Create <code style={{ background: '#27272a', padding: '0.1rem 0.3rem', borderRadius: 4 }}>frontend/.env.local</code> with the five contract addresses (see <code style={{ background: '#27272a', padding: '0.1rem 0.3rem', borderRadius: 4 }}>.env.local.example</code>). Deploy first from the <code style={{ background: '#27272a', padding: '0.1rem 0.3rem', borderRadius: 4 }}>contracts/</code> folder, then paste the addresses and restart the dev server.
          </p>
        </div>
      )}

      <div style={{ ...CARD_STYLE, marginBottom: '1.5rem' }}>
        <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '0.75rem' }}>Select pub</h2>
        <select
          value={selectedOsmId}
          onChange={(e) => setSelectedOsmId(e.target.value)}
          style={{
            width: '100%',
            maxWidth: 400,
            padding: '0.5rem',
            background: '#27272a',
            border: '1px solid #3f3f46',
            borderRadius: 8,
            color: '#e4e4e7',
            fontSize: '0.9rem',
          }}
        >
          {pubs.map((p) => (
            <option key={p.osm_id} value={p.osm_id}>{p.name || `Pub ${p.osm_id}`}</option>
          ))}
        </select>
      </div>

      {hasContracts() && selectedOsmId && (
        <>
          {pubRecord && !pubExists && (
            <div style={{ ...CARD_STYLE, marginBottom: '1.5rem', borderColor: '#eab308', color: '#fde047' }}>
              <p style={{ margin: 0, fontSize: '0.9rem' }}>This pub is not registered on-chain. Register via contract to receive payouts.</p>
            </div>
          )}

          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '1rem' }}>
            <div style={CARD_STYLE}>
              <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '0.75rem' }}>Capital pool (this pub)</h2>
              <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                {formatStableInCurrency(poolStable ?? 0n, currency, priceWei)}
              </div>
              <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#71717a' }}>
                Investor stable allocated to this pub. Increases when investors invest; decreases when payout triggers.
              </p>
              {poolCap !== undefined && poolCap !== 0n && (
                <p style={{ margin: '0.5rem 0 0', fontSize: '0.8rem', color: '#71717a' }}>
                  Cap: {formatStableInCurrency(poolCap, currency, priceWei)}
                </p>
              )}
            </div>
            <div style={CARD_STYLE}>
              <h2 style={{ fontSize: '0.9rem', fontWeight: 600, color: '#a1a1aa', marginBottom: '0.75rem' }}>Pub wallet balance</h2>
              {pubWallet ? (
                <>
                  <div style={{ fontSize: '1.25rem', fontWeight: 600 }}>
                    {formatInCurrency(walletBalance?.value ?? 0n, currency, priceWei)}
                  </div>
                  <p style={{ margin: '0.25rem 0 0', fontSize: '0.8rem', color: '#71717a' }}>
                    {pubWallet.slice(0, 10)}…{pubWallet.slice(-8)}
                  </p>
                </>
              ) : (
                <p style={{ color: '#71717a', fontSize: '0.9rem' }}>No wallet registered for this pub.</p>
              )}
            </div>
          </div>
        </>
      )}
    </main>
  );
}
