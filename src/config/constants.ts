/**
 * Constants for the Intuition GitHub Action
 */

/**
 * Predicate ID for "was associated with" relationship
 * This is used to link contributors to projects
 */
export const WAS_ASSOCIATED_WITH_PREDICATE_ID =
  '0x4ca4033b5e5e3e274225a9145170a0183f0a9ebe6ba7c4b28cce5e8cf536674c' as const

/**
 * Default minimum deposit amounts in wei (TRUST tokens)
 */
export const DEFAULT_MIN_DEPOSIT = {
  testnet: 1000000000000000n, // 0.001 TRUST
  mainnet: 10000000000000000n // 0.01 TRUST
} as const

/**
 * Network configuration defaults
 */
export const NETWORK_DEFAULTS = {
  testnet: {
    minDeposit: DEFAULT_MIN_DEPOSIT.testnet,
    confirmations: 1,
    gasLimit: 5000000n
  },
  mainnet: {
    minDeposit: DEFAULT_MIN_DEPOSIT.mainnet,
    confirmations: 2,
    gasLimit: 5000000n
  }
} as const

/**
 * Action failure modes
 */
export const FAILURE_MODES = {
  FAIL: 'fail',
  WARN: 'warn'
} as const

/**
 * Supported networks
 */
export const NETWORKS = {
  TESTNET: 'testnet',
  MAINNET: 'mainnet'
} as const
