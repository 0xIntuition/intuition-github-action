/**
 * Unit tests for IntuitionClient
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

const mockPublicClient = {
  getBalance: jest.fn(async () => 1000000000000000000n),
  getBlockNumber: jest.fn(async () => 12345n),
  waitForTransactionReceipt: jest.fn(async (params: any) => ({
    blockNumber: 12346n,
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
  const testPrivateKey =
    '0x1234567890123456789012345678901234567890123456789012345678901234' as `0x${string}`

  beforeEach(() => {
    jest.clearAllMocks()
    mockPublicClient.getBalance.mockResolvedValue(1000000000000000000n)
    mockPublicClient.getBlockNumber.mockResolvedValue(12345n)
    mockPublicClient.waitForTransactionReceipt.mockResolvedValue({
      blockNumber: 12346n,
      transactionHash: '0xabc' as Hex,
      status: 'success'
    })
  })

  describe('create', () => {
    it('creates a client with testnet configuration', async () => {
      const client = await IntuitionClient.create(
        testPrivateKey,
        'testnet',
        1000000000000000n
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
        1000000000000000n
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
        .mockResolvedValueOnce(1000000000000000000n)

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

      expect(balance).toBe(1000000000000000000n)
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
      mockPublicClient.getBalance.mockResolvedValue(1000000000000000000n)

      await expect(
        client.ensureSufficientBalance(500000000000000000n)
      ).resolves.not.toThrow()
    })

    it('throws InsufficientFundsError when balance is too low', async () => {
      const client = await IntuitionClient.create(testPrivateKey, 'testnet')
      mockPublicClient.getBalance.mockResolvedValue(100000000000000n)

      await expect(
        client.ensureSufficientBalance(1000000000000000000n)
      ).rejects.toThrow(InsufficientFundsError)
      await expect(
        client.ensureSufficientBalance(1000000000000000000n)
      ).rejects.toThrow('Insufficient balance')
    })
  })

  describe('waitForConfirmation', () => {
    it('waits for transaction confirmation', async () => {
      const client = await IntuitionClient.create(testPrivateKey, 'testnet')
      const txHash = '0xabc123' as Hex

      mockPublicClient.waitForTransactionReceipt.mockResolvedValue({
        blockNumber: 12346n,
        transactionHash: txHash,
        status: 'success'
      })

      const result = await client.waitForConfirmation(txHash)

      expect(result.hash).toBe(txHash)
      expect(result.confirmed).toBe(true)
      expect(result.blockNumber).toBe(12346n)
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

      expect(blockNumber).toBe(12345n)
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
