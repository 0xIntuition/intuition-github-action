/**
 * Intuition Protocol SDK wrapper with retry logic and balance checking
 */

import * as core from '@actions/core'
import {
  createPublicClient,
  createWalletClient,
  http,
  type Hex,
  type PublicClient,
  type WalletClient
} from 'viem'
import { privateKeyToAccount } from 'viem/accounts'
import {
  intuitionMainnet,
  intuitionTestnet,
  getMultiVaultAddressFromChainId
} from '@0xintuition/protocol'
import type { IntuitionClientConfig, TransactionResult } from './types.js'
import { InsufficientFundsError, NetworkError } from '../utils/errors.js'
import { withRetry } from '../utils/retry.js'
import { getNetworkConfig } from '../config/networks.js'

/**
 * Intuition Protocol client wrapper
 */
export class IntuitionClient {
  private walletClient: WalletClient
  private publicClient: PublicClient
  private network: 'testnet' | 'mainnet'
  private minDeposit: bigint
  private requiredConfirmations: number

  constructor(config: IntuitionClientConfig) {
    this.walletClient = config.walletClient
    this.publicClient = config.publicClient
    this.network = config.network
    this.minDeposit = config.minDeposit
    const networkConfig = getNetworkConfig(config.network)
    this.requiredConfirmations = networkConfig.confirmations
  }

  /**
   * Create an Intuition client from private key
   * @param privateKey Wallet private key
   * @param network Network to connect to
   * @param minDeposit Minimum deposit amount
   * @param retryAttempts Number of retry attempts
   * @param retryDelay Delay between retries
   * @returns Configured Intuition client
   */
  static async create(
    privateKey: `0x${string}`,
    network: 'testnet' | 'mainnet',
    minDeposit?: bigint,
    retryAttempts: number = 3,
    retryDelay: number = 2000
  ): Promise<IntuitionClient> {
    const networkConfig = getNetworkConfig(network)
    const account = privateKeyToAccount(privateKey)

    const chain = network === 'mainnet' ? intuitionMainnet : intuitionTestnet

    // Create wallet client
    const walletClient = createWalletClient({
      account,
      chain,
      transport: http()
    })

    // Create public client
    const publicClient = createPublicClient({
      chain,
      transport: http()
    })

    const client = new IntuitionClient({
      walletClient,
      publicClient,
      network,
      minDeposit: minDeposit ?? networkConfig.minDeposit
    })

    // Check balance on creation
    await withRetry(
      async () => {
        const balance = await client.checkBalance()
        core.info(
          `Wallet balance: ${balance} wei (${Number(balance) / 1e18} TRUST) on ${network}`
        )
      },
      {
        maxAttempts: retryAttempts,
        delayMs: retryDelay
      }
    )

    return client
  }

  /**
   * Get the wallet address
   */
  getAddress(): Hex {
    return this.walletClient.account!.address
  }

  /**
   * Get the public client
   */
  getPublicClient(): PublicClient {
    return this.publicClient
  }

  /**
   * Get the wallet client
   */
  getWalletClient(): WalletClient {
    return this.walletClient
  }

  /**
   * Get the minimum deposit amount
   */
  getMinDeposit(): bigint {
    return this.minDeposit
  }

  /**
   * Get the MultiVault contract address for the current network
   */
  getMultiVaultAddress(): Hex {
    const chainId = this.publicClient.chain?.id
    if (!chainId) {
      throw new Error('Chain ID not available from public client')
    }
    return getMultiVaultAddressFromChainId(chainId)
  }

  /**
   * Check wallet balance
   * @returns Balance in wei
   */
  async checkBalance(): Promise<bigint> {
    try {
      const balance = await this.publicClient.getBalance({
        address: this.getAddress()
      })
      return balance
    } catch (error) {
      throw new NetworkError(
        `Failed to check balance: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Ensure wallet has sufficient balance
   * @param requiredAmount Required amount in wei
   */
  async ensureSufficientBalance(requiredAmount: bigint): Promise<void> {
    const balance = await this.checkBalance()
    if (balance < requiredAmount) {
      throw new InsufficientFundsError(
        `Insufficient balance. Required: ${requiredAmount} wei, Available: ${balance} wei`
      )
    }
  }

  /**
   * Wait for transaction confirmation
   * @param txHash Transaction hash
   * @returns Transaction result with confirmation
   */
  async waitForConfirmation(txHash: Hex): Promise<TransactionResult> {
    try {
      core.debug(`Waiting for transaction ${txHash} to be mined...`)

      // Wait for transaction receipt
      const receipt = await this.publicClient.waitForTransactionReceipt({
        hash: txHash,
        confirmations: this.requiredConfirmations
      })

      core.debug(
        `Transaction ${txHash} confirmed in block ${receipt.blockNumber} with ${this.requiredConfirmations} confirmation(s)`
      )

      return {
        hash: txHash,
        confirmed: true,
        blockNumber: receipt.blockNumber
      }
    } catch (error) {
      throw new NetworkError(
        `Failed to confirm transaction ${txHash}: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }

  /**
   * Get current block number
   */
  async getCurrentBlock(): Promise<bigint> {
    try {
      return await this.publicClient.getBlockNumber()
    } catch (error) {
      throw new NetworkError(
        `Failed to get current block: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }
}
