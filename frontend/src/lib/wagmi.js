'use client';

import { createConfig, http, injected } from 'wagmi';
import { coston2 } from './chains';

export const config = createConfig({
  chains: [coston2],
  transports: {
    [coston2.id]: http(),
  },
  connectors: [injected()],
});
