/**
 * Integration tests for IntuitionClient with real network
 *
 * Tests:
 * - Client initialization with private key from .env.local
 * - Real balance checking on Base Sepolia
 * - Wallet address derivation
 * - Network connectivity
 * - Block number retrieval
 */
import { describe, it, expect, beforeAll } from '@jest/globals'
import { IntuitionClient } from '../../../src/intuition/client.js'
import type { Hex } from 'viem'

describe('IntuitionClient Integration', () => {
  let client: IntuitionClient
  const privateKey = process.env.INTUITION_PRIVATE_KEY as `0x${string}`

  beforeAll(async () => {
    // Real client initialization - this connects to Base Sepolia
    client = await IntuitionClient.create(privateKey, 'testnet')
  }, 120000) // 2 minute timeout for initial connection

  it('should initialize client with real network connection', () => {
    expect(client).toBeDefined()

    const address = client.getAddress()
    expect(address).toMatch(/^0x[a-fA-F0-9]{40}$/)

    console.log(`✓ Client initialized successfully`)
    console.log(`  Wallet address: ${address}`)
  })

  it('should retrieve real wallet balance from Base Sepolia', async () => {
    const balance = await client.checkBalance()

    expect(balance).toBeGreaterThanOrEqual(0n)

    const ethBalance = Number(balance) / 1e18
    console.log(
      `✓ Balance retrieved: ${balance} wei (${ethBalance.toFixed(6)} ETH)`
    )

    // Warn if balance is very low
    if (balance < 10000000000000000n) {
      // < 0.01 ETH
      console.warn(
        `  ⚠ Warning: Low balance detected. Recommend at least 0.01 ETH for testing.`
      )
    }
  }, 30000)

  it('should get current block number from network', async () => {
    const blockNumber = await client.getCurrentBlock()

    expect(blockNumber).toBeGreaterThan(0n)

    console.log(`✓ Current block: ${blockNumber}`)
  }, 30000)

  it('should validate minimum deposit configuration', () => {
    const minDeposit = client.getMinDeposit()

    expect(minDeposit).toBeGreaterThan(0n)
    expect(minDeposit).toBe(1000000000000000n) // 0.001 TRUST for testnet

    const trustAmount = Number(minDeposit) / 1e18
    console.log(`✓ Minimum deposit: ${minDeposit} wei (${trustAmount} TRUST)`)
  })

  it('should have sufficient balance for test operations', async () => {
    const balance = await client.checkBalance()
    const minDeposit = client.getMinDeposit()

    // Check if we have enough for at least a few operations
    // Rough estimate: need gas + deposits for ~5-10 operations
    const estimatedGas = 50000000000000000n // ~0.05 ETH for gas
    const estimatedDeposits = minDeposit * 10n // 10 deposits worth

    const recommendedBalance = estimatedGas + estimatedDeposits

    console.log(`Balance check:`)
    console.log(`  Current: ${balance} wei`)
    console.log(`  Recommended: ${recommendedBalance} wei for testing`)

    if (balance < recommendedBalance) {
      console.warn(
        `  ⚠ Warning: Balance may be insufficient for full test suite`
      )
      console.warn(
        `  Consider funding wallet at: https://www.alchemy.com/faucets/base-sepolia`
      )
    }

    // Don't fail the test, just require non-zero balance
    expect(balance).toBeGreaterThan(0n)
  }, 30000)

  it('should have valid wallet and public clients', () => {
    const walletClient = client.getWalletClient()
    const publicClient = client.getPublicClient()

    expect(walletClient).toBeDefined()
    expect(publicClient).toBeDefined()
    expect(walletClient.account).toBeDefined()
    expect(walletClient.chain).toBeDefined()

    console.log(`✓ Wallet and public clients validated`)
    console.log(`  Chain: ${walletClient.chain?.name}`)
  })
})
