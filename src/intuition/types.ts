/**
 * TypeScript interfaces for Intuition Protocol operations
 */

import { Hex, PublicClient, WalletClient } from 'viem'

/**
 * Atom data for creating a Thing
 */
export interface ThingAtomData {
  name: string
  description: string
  url: string
  image?: string
}

/**
 * Result of atom creation
 */
export interface AtomCreationResult {
  atomId: Hex
  vaultId: bigint
  txHash: Hex
  cost: bigint
  existed: boolean
}

/**
 * Result of triple creation
 */
export interface TripleCreationResult {
  tripleId: Hex
  vaultId: bigint
  txHash: Hex
  cost: bigint
  existed: boolean
}

/**
 * Intuition client configuration
 */
export interface IntuitionClientConfig {
  walletClient: WalletClient
  publicClient: PublicClient
  network: 'testnet' | 'mainnet'
  minDeposit: bigint
}

/**
 * Transaction result with confirmations
 */
export interface TransactionResult {
  hash: Hex
  confirmed: boolean
  blockNumber?: bigint
}

/**
 * Batch operation result
 */
export interface BatchOperationResult<T> {
  success: boolean
  results: T[]
  txHash?: Hex
  error?: Error
}
