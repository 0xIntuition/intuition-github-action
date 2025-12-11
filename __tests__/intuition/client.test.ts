/**
 * Unit tests for IntuitionClient
 *
 * Covers:
 * - Client initialization with testnet/mainnet configurations
 * - Balance checking and validation
 * - Transaction confirmation waiting
 * - Error handling and retry logic
 * - Network error wrapping
 *
 * Mocking considerations:
 * - Uses jest.unstable_mockModule for ESM compatibility
 * - Mocks viem wallet/public clients and account creation
 * - Mocks Intuition Protocol network configurations
 */
import { jest } from '@jest/globals'
import { describe, it, expect, beforeEach } from '@jest/globals'
import * as core from '../../__fixtures__/core.js'
import type { Hex } from 'viem'

// Mock viem module
const mockAccount = {
  address: '0x1234567890123456789012345678901234567890' as Hex
}

const mockWalletClient = {
  account: mockAccount,
  transport: { url: 'http://test.rpc' }
}

// Test constants defined at module level for reuse
const TEST_BALANCE = 1000000000000000000n
const TEST_BLOCK_NUMBER = 12345n

const mockPublicClient = {
  getBalance: jest.fn(async () => TEST_BALANCE),
  getBlockNumber: jest.fn(async () => TEST_BLOCK_NUMBER),
  waitForTransactionReceipt: jest.fn(async (params: { hash: string }) => ({
    blockNumber: TEST_BLOCK_NUMBER + 1n,
    transactionHash: params.hash,
    status: 'success'
  }))
}

jest.unstable_mockModule('viem', () => ({
  createPublicClient: jest.fn(() => mockPublicClient),
  createWalletClient: jest.fn(() => mockWalletClient),
  http: jest.fn(() => ({}))
}))

jest.unstable_mockModule('viem/accounts', () => ({
  privateKeyToAccount: jest.fn(() => mockAccount)
}))

jest.unstable_mockModule('@0xintuition/protocol', () => ({
  intuitionMainnet: { id: 1, name: 'mainnet' },
  intuitionTestnet: { id: 11155111, name: 'testnet' }
}))

jest.unstable_mockModule('@actions/core', () => core)

// Import the module being tested
const { IntuitionClient } = await import('../../src/intuition/client.js')
const { NetworkError, InsufficientFundsError } =
  await import('../../src/utils/errors.js')

describe('IntuitionClient', () => {
  // Note: Real private keys must be cryptographically secure random values
  // This test key uses a simple pattern for testing purposes only
  const testPrivateKey =
    '0x1234567890123456789012345678901234567890123456789012345678901234' as `0x${string}`

  const TEST_MIN_DEPOSIT = 1000000000000000n

  beforeEach(() => {
    jest.clearAllMocks()
    mockPublicClient.getBalance.mockResolvedValue(TEST_BALANCE)
    mockPublicClient.getBlockNumber.mockResolvedValue(TEST_BLOCK_NUMBER)
    mockPublicClient.waitForTransactionReceipt.mockResolvedValue({
      blockNumber: TEST_BLOCK_NUMBER + 1n,
      transactionHash: '0xabc' as Hex,
      status: 'success'
    })
  })

  describe('create', () => {
    it('creates a client with testnet configuration', async () => {
      const client = await IntuitionClient.create(
        testPrivateKey,
        'testnet',
        TEST_MIN_DEPOSIT
      )

      expect(client).toBeInstanceOf(IntuitionClient)
      expect(client.getAddress()).toBe(mockAccount.address)
      expect(mockPublicClient.getBalance).toHaveBeenCalled()
      expect(core.info).toHaveBeenCalledWith(expect.stringContaining('testnet'))
    })

    it('creates a client with mainnet configuration', async () => {
      const client = await IntuitionClient.create(
        testPrivateKey,
        'mainnet',
        TEST_MIN_DEPOSIT
      )

      expect(client).toBeInstanceOf(IntuitionClient)
      expect(core.info).toHaveBeenCalledWith(expect.stringContaining('mainnet'))
    })

    it('uses default minimum deposit if not provided', async () => {
      const client = await IntuitionClient.create(testPrivateKey, 'testnet')

      expect(client).toBeInstanceOf(IntuitionClient)
      expect(client.getMinDeposit()).toBeGreaterThan(0n)
    })

    it('retries balance check on failure', async () => {
      mockPublicClient.getBalance
        .mockRejectedValueOnce(new Error('Network error'))
        .mockResolvedValueOnce(TEST_BALANCE)

      const client = await IntuitionClient.create(testPrivateKey, 'testnet')

      expect(client).toBeInstanceOf(IntuitionClient)
      expect(mockPublicClient.getBalance).toHaveBeenCalledTimes(2)
    })
  })

  describe('getAddress', () => {
    it('returns the wallet address', async () => {
      const client = await IntuitionClient.create(testPrivateKey, 'testnet')
      const address = client.getAddress()

      expect(address).toBe(mockAccount.address)
    })
  })

  describe('getMinDeposit', () => {
    it('returns the configured minimum deposit', async () => {
      const minDeposit = 2000000000000000n
      const client = await IntuitionClient.create(
        testPrivateKey,
        'testnet',
        minDeposit
      )

      expect(client.getMinDeposit()).toBe(minDeposit)
    })
  })

  describe('checkBalance', () => {
    it('returns the wallet balance', async () => {
      const client = await IntuitionClient.create(testPrivateKey, 'testnet')
      const balance = await client.checkBalance()

      expect(balance).toBe(TEST_BALANCE)
      expect(mockPublicClient.getBalance).toHaveBeenCalledWith({
        address: mockAccount.address
      })
    })

    it('throws NetworkError on failure', async () => {
      const client = await IntuitionClient.create(testPrivateKey, 'testnet')

      mockPublicClient.getBalance.mockRejectedValue(new Error('RPC error'))

      await expect(client.checkBalance()).rejects.toThrow(NetworkError)
      await expect(client.checkBalance()).rejects.toThrow(
        'Failed to check balance'
      )
    })
  })

  describe('ensureSufficientBalance', () => {
    it('succeeds when balance is sufficient', async () => {
      const client = await IntuitionClient.create(testPrivateKey, 'testnet')
      mockPublicClient.getBalance.mockResolvedValue(TEST_BALANCE)

      await expect(
        client.ensureSufficientBalance(TEST_BALANCE / 2n)
      ).resolves.not.toThrow()
    })

    it('throws InsufficientFundsError when balance is too low', async () => {
      const client = await IntuitionClient.create(testPrivateKey, 'testnet')
      const lowBalance = 100000000000000n
      mockPublicClient.getBalance.mockResolvedValue(lowBalance)

      await expect(
        client.ensureSufficientBalance(TEST_BALANCE)
      ).rejects.toThrow(InsufficientFundsError)
      await expect(
        client.ensureSufficientBalance(TEST_BALANCE)
      ).rejects.toThrow('Insufficient balance')
    })
  })

  describe('waitForConfirmation', () => {
    it('waits for transaction confirmation', async () => {
      const client = await IntuitionClient.create(testPrivateKey, 'testnet')
      const txHash = '0xabc123' as Hex

      mockPublicClient.waitForTransactionReceipt.mockResolvedValue({
        blockNumber: TEST_BLOCK_NUMBER + 1n,
        transactionHash: txHash,
        status: 'success'
      })

      const result = await client.waitForConfirmation(txHash)

      expect(result.hash).toBe(txHash)
      expect(result.confirmed).toBe(true)
      expect(result.blockNumber).toBe(TEST_BLOCK_NUMBER + 1n)
      expect(mockPublicClient.waitForTransactionReceipt).toHaveBeenCalledWith(
        expect.objectContaining({ hash: txHash })
      )
    })

    it('throws NetworkError on confirmation failure', async () => {
      const client = await IntuitionClient.create(testPrivateKey, 'testnet')
      const txHash = '0xabc123' as Hex

      mockPublicClient.waitForTransactionReceipt.mockRejectedValue(
        new Error('Transaction reverted')
      )

      await expect(client.waitForConfirmation(txHash)).rejects.toThrow(
        NetworkError
      )
      await expect(client.waitForConfirmation(txHash)).rejects.toThrow(
        'Failed to confirm transaction'
      )
    })
  })

  describe('getCurrentBlock', () => {
    it('returns the current block number', async () => {
      const client = await IntuitionClient.create(testPrivateKey, 'testnet')

      const blockNumber = await client.getCurrentBlock()

      expect(blockNumber).toBe(TEST_BLOCK_NUMBER)
      expect(mockPublicClient.getBlockNumber).toHaveBeenCalled()
    })

    it('throws NetworkError on failure', async () => {
      const client = await IntuitionClient.create(testPrivateKey, 'testnet')

      mockPublicClient.getBlockNumber.mockRejectedValue(new Error('RPC error'))

      await expect(client.getCurrentBlock()).rejects.toThrow(NetworkError)
      await expect(client.getCurrentBlock()).rejects.toThrow(
        'Failed to get current block'
      )
    })
  })
})
