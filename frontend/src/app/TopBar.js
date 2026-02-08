'use client';

import Link from 'next/link';
import { usePathname } from 'next/navigation';
import { useAccount, useChainId, useConnect, useDisconnect, useSwitchChain } from 'wagmi';

const FLARE_COSTON2_CHAIN_ID = 114;

const NAV = [
  { href: '/', label: 'My Wallet' },
  { href: '/pub-wallet', label: 'Pub Wallet' },
  { href: '/activity-simulator', label: 'Activity & Risk' },
  { href: '/pipeline', label: 'Pipeline' },
  { href: '/documentation', label: 'Documentation' },
];

export default function TopBar() {
  const pathname = usePathname();
  const chainId = useChainId();
  const { address, isConnected } = useAccount();
  const { connect, connectors, isPending } = useConnect();
  const { disconnect } = useDisconnect();
  const { switchChainAsync, isPending: isSwitchPending } = useSwitchChain();
  const wrongNetwork = isConnected && chainId !== FLARE_COSTON2_CHAIN_ID;

  const handleSwitchToFlare = async () => {
    try {
      await switchChainAsync({ chainId: FLARE_COSTON2_CHAIN_ID });
    } catch (e) {
      console.error(e);
    }
  };

  return (
    <>
      {wrongNetwork && (
        <div
          style={{
            background: '#f97316',
            color: '#1c1917',
            padding: '0.5rem 1rem',
            textAlign: 'center',
            fontSize: '0.85rem',
            fontWeight: 500,
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            gap: '0.75rem',
            flexWrap: 'wrap',
          }}
        >
          <span>Transactions use Ethereum by default. Switch to Flare Coston2 so fees are in FLR (C2FLR)—no ETH.</span>
          <button
            type="button"
            onClick={handleSwitchToFlare}
            disabled={isSwitchPending}
            style={{
              padding: '0.35rem 0.75rem',
              fontSize: '0.8rem',
              fontWeight: 600,
              background: '#1c1917',
              color: '#f97316',
              border: 'none',
              borderRadius: 6,
              cursor: isSwitchPending ? 'wait' : 'pointer',
            }}
          >
            {isSwitchPending ? 'Switching…' : 'Switch to Flare Coston2'}
          </button>
        </div>
      )}
    <header
      style={{
        position: 'sticky',
        top: 0,
        zIndex: 50,
        background: '#18181b',
        borderBottom: '1px solid #27272a',
      }}
    >
      <nav
        style={{
          maxWidth: 1200,
          margin: '0 auto',
          padding: '0.75rem 1rem',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem',
          flexWrap: 'wrap',
        }}
      >
        {NAV.map(({ href, label }) => {
          const active = pathname === href || (href !== '/' && pathname?.startsWith(href));
          return (
            <Link
              key={href}
              href={href}
              style={{
                padding: '0.5rem 0.75rem',
                borderRadius: 8,
                fontSize: '0.9rem',
                fontWeight: 500,
                color: active ? '#e4e4e7' : '#a1a1aa',
                background: active ? '#27272a' : 'transparent',
                textDecoration: 'none',
              }}
            >
              {label}
            </Link>
          );
        })}
        <div style={{ marginLeft: 'auto', display: 'flex', alignItems: 'center', gap: '0.5rem' }}>
          {isConnected ? (
            <>
              <span style={{ fontSize: '0.8rem', color: '#71717a' }}>{address?.slice(0, 6)}…{address?.slice(-4)}</span>
              <button
                type="button"
                onClick={() => disconnect()}
                style={{
                  padding: '0.4rem 0.75rem',
                  fontSize: '0.8rem',
                  background: '#27272a',
                  border: '1px solid #3f3f46',
                  borderRadius: 8,
                  color: '#e4e4e7',
                  cursor: 'pointer',
                }}
              >
                Disconnect
              </button>
            </>
          ) : (
            <button
              type="button"
              onClick={() => connectors[0] && connect({ connector: connectors[0] })}
              disabled={isPending || !connectors[0]}
              style={{
                padding: '0.4rem 0.75rem',
                fontSize: '0.8rem',
                background: '#7c3aed',
                border: 'none',
                borderRadius: 8,
                color: '#fff',
                cursor: isPending || !connectors[0] ? 'not-allowed' : 'pointer',
              }}
            >
              {isPending ? 'Connecting…' : connectors[0] ? 'Connect' : 'No wallet'}
            </button>
          )}
        </div>
      </nav>
    </header>
    </>
  );
}
