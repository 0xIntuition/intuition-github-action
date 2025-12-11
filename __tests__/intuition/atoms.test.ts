/**
 * Unit tests for atom creation functions
 *
 * Covers:
 * - Project and contributor atom creation
 * - Existence checking via findAtomIds
 * - Retry logic and error handling
 * - Batch operations with configurable batch sizes
 * - Edge cases: empty arrays, boundary conditions
 *
 * Mocking considerations:
 * - Uses jest.unstable_mockModule for ESM compatibility
 * - Mocks @0xintuition/sdk functions for atom operations
 * - IntuitionClient is mocked to avoid network calls
 */
import { jest } from '@jest/globals'
import { describe, it, expect, beforeEach } from '@jest/globals'
import * as core from '../../__fixtures__/core.js'
import type { Hex } from 'viem'

// Mock @actions/core
jest.unstable_mockModule('@actions/core', () => core)

// Mock Intuition SDK
const mockFindAtomIds = jest.fn()
const mockCreateAtomFromThing = jest.fn()

jest.unstable_mockModule('@0xintuition/sdk', () => ({
  findAtomIds: mockFindAtomIds,
  createAtomFromThing: mockCreateAtomFromThing
}))

// Test constants
const TEST_MIN_DEPOSIT = 1000000000000000n
const TEST_BLOCK_NUMBER = 12345n
const TEST_WALLET_ADDRESS = '0x1234567890123456789012345678901234567890' as Hex

// Create mock IntuitionClient
const mockIntuitionClient = {
  getAddress: jest.fn(() => TEST_WALLET_ADDRESS),
  getWalletClient: jest.fn(() => ({})),
  getPublicClient: jest.fn(() => ({})),
  getMinDeposit: jest.fn(() => TEST_MIN_DEPOSIT),
  ensureSufficientBalance: jest.fn(async () => undefined),
  waitForConfirmation: jest.fn(async (hash: Hex) => ({
    hash,
    confirmed: true,
    blockNumber: TEST_BLOCK_NUMBER
  }))
}

// Import the module being tested
const {
  ensureProjectAtom,
  ensureContributorAtom,
  batchCreateContributorAtoms
} = await import('../../src/intuition/atoms.js')
const { TransactionFailedError } = await import('../../src/utils/errors.js')

describe('ensureProjectAtom', () => {
  const atomData = {
    name: 'testorg/testrepo',
    description: 'Test repository',
    url: 'https://github.com/testorg/testrepo',
    image: undefined
  }

  const retryOptions = {
    maxAttempts: 3,
    delayMs: 100
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns existing atom if found', async () => {
    const existingAtomId = '0xabc' as Hex
    mockFindAtomIds.mockResolvedValue([{ term_id: existingAtomId }])

    const result = await ensureProjectAtom(
      mockIntuitionClient as any,
      atomData,
      retryOptions
    )

    expect(result.atomId).toBe(existingAtomId)
    expect(result.existed).toBe(true)
    expect(result.cost).toBe(0n)
    expect(result.txHash).toBe('0x0')
    expect(mockCreateAtomFromThing).not.toHaveBeenCalled()
  })

  it('creates new atom if not found', async () => {
    mockFindAtomIds.mockResolvedValue([])
    mockCreateAtomFromThing.mockResolvedValue({
      transactionHash: '0x123' as Hex,
      state: { termId: '0xdef' as Hex }
    })

    const result = await ensureProjectAtom(
      mockIntuitionClient as any,
      atomData,
      retryOptions
    )

    expect(result.atomId).toBe('0xdef')
    expect(result.existed).toBe(false)
    expect(result.cost).toBe(1000000000000000n)
    expect(result.txHash).toBe('0x123')
    expect(mockCreateAtomFromThing).toHaveBeenCalledWith(
      expect.objectContaining({
        address: mockIntuitionClient.getAddress()
      }),
      atomData,
      1000000000000000n
    )
  })

  it('creates atom if findAtomIds fails', async () => {
    mockFindAtomIds.mockRejectedValue(new Error('API error'))
    mockCreateAtomFromThing.mockResolvedValue({
      transactionHash: '0x456' as Hex,
      state: { termId: '0x789' as Hex }
    })

    const result = await ensureProjectAtom(
      mockIntuitionClient as any,
      atomData,
      retryOptions
    )

    expect(result.atomId).toBe('0x789')
    expect(result.existed).toBe(false)
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('Failed to check atom existence')
    )
  })

  it('ensures sufficient balance before creating atom', async () => {
    mockFindAtomIds.mockResolvedValue([])
    mockCreateAtomFromThing.mockResolvedValue({
      transactionHash: '0x555' as Hex,
      state: { termId: '0x666' as Hex }
    })

    await ensureProjectAtom(mockIntuitionClient as any, atomData, retryOptions)

    expect(mockIntuitionClient.ensureSufficientBalance).toHaveBeenCalledWith(
      1000000000000000n
    )
  })

  it('waits for transaction confirmation', async () => {
    mockFindAtomIds.mockResolvedValue([])
    const txHash = '0x888' as Hex
    mockCreateAtomFromThing.mockResolvedValue({
      transactionHash: txHash,
      state: { termId: '0x999' as Hex }
    })

    await ensureProjectAtom(mockIntuitionClient as any, atomData, retryOptions)

    expect(mockIntuitionClient.waitForConfirmation).toHaveBeenCalledWith(txHash)
  })

  it('throws TransactionFailedError on creation failure', async () => {
    mockFindAtomIds.mockResolvedValue([])
    mockCreateAtomFromThing.mockRejectedValue(new Error('Transaction failed'))

    await expect(
      ensureProjectAtom(mockIntuitionClient as any, atomData, retryOptions)
    ).rejects.toThrow(TransactionFailedError)
  })

  it('retries on retryable errors', async () => {
    mockFindAtomIds
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue([])
    mockCreateAtomFromThing.mockResolvedValue({
      transactionHash: '0xaaa' as Hex,
      state: { termId: '0xbbb' as Hex }
    })

    const result = await ensureProjectAtom(
      mockIntuitionClient as any,
      atomData,
      retryOptions
    )

    expect(result.atomId).toBe('0xbbb')
  })
})

describe('ensureContributorAtom', () => {
  const atomData = {
    name: 'Test User',
    description: 'Contributor: testuser',
    url: 'https://github.com/testuser',
    image: 'https://avatars.githubusercontent.com/u/123'
  }

  const retryOptions = {
    maxAttempts: 3,
    delayMs: 100
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns existing atom if found', async () => {
    const existingAtomId = '0x11' as Hex
    mockFindAtomIds.mockResolvedValue([{ term_id: existingAtomId }])

    const result = await ensureContributorAtom(
      mockIntuitionClient as any,
      atomData,
      retryOptions
    )

    expect(result.atomId).toBe(existingAtomId)
    expect(result.existed).toBe(true)
    expect(result.cost).toBe(0n)
    expect(mockCreateAtomFromThing).not.toHaveBeenCalled()
  })

  it('creates new atom if not found', async () => {
    mockFindAtomIds.mockResolvedValue([])
    mockCreateAtomFromThing.mockResolvedValue({
      transactionHash: '0x22' as Hex,
      state: { termId: '0x33' as Hex }
    })

    const result = await ensureContributorAtom(
      mockIntuitionClient as any,
      atomData,
      retryOptions
    )

    expect(result.atomId).toBe('0x33')
    expect(result.existed).toBe(false)
    expect(result.cost).toBe(1000000000000000n)
    expect(mockCreateAtomFromThing).toHaveBeenCalledWith(
      expect.any(Object),
      atomData,
      1000000000000000n
    )
  })

  it('logs contributor name in messages', async () => {
    mockFindAtomIds.mockResolvedValue([{ term_id: '0x44' as Hex }])

    await ensureContributorAtom(
      mockIntuitionClient as any,
      atomData,
      retryOptions
    )

    expect(core.info).toHaveBeenCalledWith(
      expect.stringContaining(atomData.name)
    )
  })
})

describe('batchCreateContributorAtoms', () => {
  const atomsData = [
    {
      name: 'User 1',
      description: 'Contributor: user1',
      url: 'https://github.com/user1',
      image: 'https://avatars.githubusercontent.com/u/1'
    },
    {
      name: 'User 2',
      description: 'Contributor: user2',
      url: 'https://github.com/user2',
      image: 'https://avatars.githubusercontent.com/u/2'
    },
    {
      name: 'User 3',
      description: 'Contributor: user3',
      url: 'https://github.com/user3',
      image: 'https://avatars.githubusercontent.com/u/3'
    }
  ]

  const retryOptions = {
    maxAttempts: 3,
    delayMs: 100
  }

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('creates all contributor atoms', async () => {
    mockFindAtomIds.mockResolvedValue([])
    mockCreateAtomFromThing
      .mockResolvedValueOnce({
        transactionHash: '0xa1' as Hex,
        state: { termId: '0xb1' as Hex }
      })
      .mockResolvedValueOnce({
        transactionHash: '0xa2' as Hex,
        state: { termId: '0xb2' as Hex }
      })
      .mockResolvedValueOnce({
        transactionHash: '0xa3' as Hex,
        state: { termId: '0xb3' as Hex }
      })

    const results = await batchCreateContributorAtoms(
      mockIntuitionClient as any,
      atomsData,
      retryOptions
    )

    expect(results).toHaveLength(3)
    expect(results[0].atomId).toBe('0xb1')
    expect(results[1].atomId).toBe('0xb2')
    expect(results[2].atomId).toBe('0xb3')
  })

  it('processes atoms in batches', async () => {
    mockFindAtomIds.mockResolvedValue([])
    mockCreateAtomFromThing.mockResolvedValue({
      transactionHash: '0xcc' as Hex,
      state: { termId: '0xdd' as Hex }
    })

    const manyAtoms = Array.from({ length: 15 }, (_, i) => ({
      name: `User ${i}`,
      description: `Contributor: user${i}`,
      url: `https://github.com/user${i}`,
      image: `https://avatars.githubusercontent.com/u/${i}`
    }))

    const results = await batchCreateContributorAtoms(
      mockIntuitionClient as any,
      manyAtoms,
      retryOptions
    )

    expect(results).toHaveLength(15)
  })

  it('handles mixed existing and new atoms', async () => {
    mockFindAtomIds
      .mockResolvedValueOnce([{ term_id: '0xe1' as Hex }])
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ term_id: '0xe3' as Hex }])

    mockCreateAtomFromThing.mockResolvedValue({
      transactionHash: '0xee' as Hex,
      state: { termId: '0xff' as Hex }
    })

    const results = await batchCreateContributorAtoms(
      mockIntuitionClient as any,
      atomsData,
      retryOptions
    )

    expect(results).toHaveLength(3)
    expect(results[0].existed).toBe(true)
    expect(results[1].existed).toBe(false)
    expect(results[2].existed).toBe(true)
  })

  it('handles empty contributor array', async () => {
    const results = await batchCreateContributorAtoms(
      mockIntuitionClient as any,
      [],
      retryOptions
    )

    expect(results).toHaveLength(0)
    expect(mockFindAtomIds).not.toHaveBeenCalled()
    expect(mockCreateAtomFromThing).not.toHaveBeenCalled()
  })

  it('handles exactly one batch (10 items)', async () => {
    mockFindAtomIds.mockResolvedValue([])
    mockCreateAtomFromThing.mockResolvedValue({
      transactionHash: '0xaa' as Hex,
      state: { termId: '0xbb' as Hex }
    })

    const exactBatchAtoms = Array.from({ length: 10 }, (_, i) => ({
      name: `User ${i}`,
      description: `Contributor: user${i}`,
      url: `https://github.com/user${i}`,
      image: `https://avatars.githubusercontent.com/u/${i}`
    }))

    const results = await batchCreateContributorAtoms(
      mockIntuitionClient as any,
      exactBatchAtoms,
      retryOptions
    )

    expect(results).toHaveLength(10)
    expect(mockCreateAtomFromThing).toHaveBeenCalledTimes(10)
  })

  it('handles multiple of batch size (20 items)', async () => {
    mockFindAtomIds.mockResolvedValue([])
    mockCreateAtomFromThing.mockResolvedValue({
      transactionHash: '0xcc' as Hex,
      state: { termId: '0xdd' as Hex }
    })

    const multipleOfBatchSize = Array.from({ length: 20 }, (_, i) => ({
      name: `User ${i}`,
      description: `Contributor: user${i}`,
      url: `https://github.com/user${i}`,
      image: `https://avatars.githubusercontent.com/u/${i}`
    }))

    const results = await batchCreateContributorAtoms(
      mockIntuitionClient as any,
      multipleOfBatchSize,
      retryOptions
    )

    expect(results).toHaveLength(20)
    expect(mockCreateAtomFromThing).toHaveBeenCalledTimes(20)
  })
})
