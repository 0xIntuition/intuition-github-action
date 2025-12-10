/**
 * Network configuration for Intuition Protocol
 */

import { base, baseSepolia } from 'viem/chains'
import { NETWORK_DEFAULTS } from './constants.js'

export interface NetworkConfig {
  name: string
  chain: typeof base | typeof baseSepolia
  minDeposit: bigint
  confirmations: number
  gasLimit: bigint
}

/**
 * Get network configuration based on network name
 * @param network Network name ('testnet' or 'mainnet')
 * @returns Network configuration
 */
export function getNetworkConfig(
  network: 'testnet' | 'mainnet'
): NetworkConfig {
  if (network === 'mainnet') {
    return {
      name: 'mainnet',
      chain: base,
      ...NETWORK_DEFAULTS.mainnet
    }
  }

  return {
    name: 'testnet',
    chain: baseSepolia,
    ...NETWORK_DEFAULTS.testnet
  }
}
