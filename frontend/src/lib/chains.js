import { defineChain } from 'viem';

/** Flare Coston2 testnet – only chain used by this app. Fees paid in native FLR (C2FLR), not ETH. */
export const coston2 = defineChain({
  id: 114,
  name: 'Flare Coston2',
  nativeCurrency: { name: 'C2FLR', symbol: 'C2FLR', decimals: 18 },
  rpcUrls: {
    default: { http: ['https://coston2-api.flare.network/ext/C/rpc'] },
  },
  blockExplorers: {
    default: { name: 'Coston2', url: 'https://coston2-explorer.flare.network' },
  },
});
