import { keccak256, encodePacked } from 'viem';

/**
 * Contract addresses (from env). Deploy with contracts/script/DeployAndDemo.s.sol then set in .env.local.
 */
export const addresses = {
  pool: process.env.NEXT_PUBLIC_POOL_ADDRESS || null,
  registry: process.env.NEXT_PUBLIC_REGISTRY_ADDRESS || null,
  engine: process.env.NEXT_PUBLIC_ENGINE_ADDRESS || null,
  stable: process.env.NEXT_PUBLIC_STABLE_ADDRESS || null,
  oracle: process.env.NEXT_PUBLIC_ORACLE_ADDRESS || null,
};

export const hasContracts = () =>
  addresses.pool && addresses.registry && addresses.engine && addresses.stable;

// Minimal ABIs for the functions we use
export const poolAbi = [
  { inputs: [{ name: 'pubId', type: 'bytes32' }, { name: 'amount', type: 'uint256' }], name: 'depositStableInvestorForPub', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'pubId', type: 'bytes32' }, { name: 'amount', type: 'uint256' }], name: 'withdrawStableInvestorFromPub', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'pubId', type: 'bytes32' }], name: 'pubPoolStable', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'pubId', type: 'bytes32' }], name: 'getTotalStableInPub', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: '', type: 'address' }, { name: '', type: 'bytes32' }], name: 'investorStableInPub', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'poolFLRBalance', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'poolStableBalance', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
  { inputs: [], name: 'stable', outputs: [{ name: '', type: 'address' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'pubId', type: 'bytes32' }], name: 'pubPoolStableCap', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
];

export const registryAbi = [
  { inputs: [{ name: 'pubId', type: 'bytes32' }], name: 'getPub', outputs: [{ name: 'wallet', type: 'address' }, { name: 'payoutToken', type: 'address' }, { name: 'exists', type: 'bool' }], stateMutability: 'view', type: 'function' },
  { inputs: [{ name: 'pubId', type: 'bytes32' }, { name: 'wallet', type: 'address' }], name: 'registerPub', outputs: [], stateMutability: 'nonpayable', type: 'function' },
];

export const engineAbi = [
  { inputs: [{ name: 'pubId', type: 'bytes32' }, { name: 'dateKey', type: 'bytes32' }, { name: 'activityScore', type: 'uint256' }], name: 'settleWithScore', outputs: [], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'pubId', type: 'bytes32' }, { name: 'dateKey', type: 'bytes32' }, { name: 'premiumStable', type: 'uint256' }, { name: 'payoutStable', type: 'uint256' }], name: 'settleWithQuote', outputs: [], stateMutability: 'nonpayable', type: 'function' },
];

export const stableAbi = [
  { inputs: [{ name: 'spender', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'approve', outputs: [{ name: '', type: 'bool' }], stateMutability: 'nonpayable', type: 'function' },
  { inputs: [{ name: 'account', type: 'address' }, { name: 'amount', type: 'uint256' }], name: 'balanceOf', outputs: [{ name: '', type: 'uint256' }], stateMutability: 'view', type: 'function' },
];

export const oracleAbi = [
  { inputs: [], name: 'flrUsdWei', outputs: [{ name: 'priceWei', type: 'uint256' }, { name: 'ts', type: 'uint64' }], stateMutability: 'view', type: 'function' },
];

/** bytes32 pubId from API osm_id (must match backend/contract registration). */
export function pubIdFromOsmId(osmId) {
  return keccak256(encodePacked(['string'], [`pub_${osmId}`]));
}
