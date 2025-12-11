/**
 * Network configuration for Intuition Protocol
 */

import { NETWORK_DEFAULTS } from './constants.js'

export interface NetworkConfig {
  name: string
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
      ...NETWORK_DEFAULTS.mainnet
    }
  }

  return {
    name: 'testnet',
    ...NETWORK_DEFAULTS.testnet
  }
}
