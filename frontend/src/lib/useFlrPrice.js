'use client';

import { useReadContract } from 'wagmi';
import { addresses, oracleAbi } from './contracts';

/** FLR/USD price (1e18 = 1 FLR in USD). Returns null if no oracle or not configured. */
export function useFlrPrice() {
  const { data, isLoading } = useReadContract({
    address: addresses.oracle || undefined,
    abi: oracleAbi,
    functionName: 'flrUsdWei',
  });
  if (!addresses.oracle || !data) return { priceWei: null, isLoading: !!addresses.oracle && isLoading };
  const [priceWei] = data;
  return { priceWei, isLoading };
}

/** Format native FLR wei in chosen currency. */
export function formatInCurrency(wei, currency, flrUsdWei) {
  const n = Number(wei) / 1e18;
  if (currency === 'FLR') return `${n.toFixed(4)} FLR`;
  if (currency === 'USD' || currency === 'GBP') {
    if (!flrUsdWei || flrUsdWei === 0n) return `— ${currency}`;
    const usd = n * (Number(flrUsdWei) / 1e18);
    const sym = currency === 'GBP' ? '£' : '$';
    return `${sym}${usd.toFixed(2)}`;
  }
  return `${n.toFixed(4)}`;
}

/** Format stable (ERC20 18 decimals) in chosen currency. For FLR we convert via flrUsdWei. */
export function formatStableInCurrency(stableWei, currency, flrUsdWei) {
  const stableNum = Number(stableWei) / 1e18;
  if (currency === 'USD' || currency === 'GBP') {
    const sym = currency === 'GBP' ? '£' : '$';
    return `${sym}${stableNum.toFixed(2)}`;
  }
  if (currency === 'FLR') {
    if (!flrUsdWei || flrUsdWei === 0n) return `— FLR`;
    const flr = stableNum / (Number(flrUsdWei) / 1e18);
    return `${flr.toFixed(4)} FLR`;
  }
  return `${stableNum.toFixed(2)}`;
}
