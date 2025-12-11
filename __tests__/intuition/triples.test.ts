/**
 * Unit tests for triple creation functions
 *
 * Covers:
 * - Attestation triple creation (contributor -> contributed to -> project)
 * - Triple existence checking and ID calculation
 * - Deposit handling for triples
 * - Retry logic and error handling
 * - Batch triple creation operations
 *
 * Mocking considerations:
 * - Uses jest.unstable_mockModule for ESM compatibility
 * - Mocks @0xintuition/sdk functions for triple operations
 * - IntuitionClient is mocked to avoid network calls
 */
import { jest } from '@jest/globals'
import { describe, it, expect, beforeEach } from '@jest/globals'
import * as core from '../../__fixtures__/core.js'
import type { Hex } from 'viem'

// Mock @actions/core
jest.unstable_mockModule('@actions/core', () => core)

// Mock Intuition SDK
const mockCalculateTripleId = jest.fn()
const mockFindTripleIds = jest.fn()
const mockCreateTripleStatement = jest.fn()
const mockDeposit = jest.fn()

jest.unstable_mockModule('@0xintuition/sdk', () => ({
  calculateTripleId: mockCalculateTripleId,
  findTripleIds: mockFindTripleIds,
  createTripleStatement: mockCreateTripleStatement,
  deposit: mockDeposit
}))

// Create mock IntuitionClient
const mockIntuitionClient = {
  getAddress: jest.fn(
    () => '0x1234567890123456789012345678901234567890' as Hex
  ),
  getWalletClient: jest.fn(() => ({})),
  getPublicClient: jest.fn(() => ({})),
  getMinDeposit: jest.fn(() => 1000000000000000n),
  ensureSufficientBalance: jest.fn(async () => undefined),
  waitForConfirmation: jest.fn(async (hash: Hex) => ({
    hash,
    confirmed: true,
    blockNumber: 12345n
  }))
} as unknown as import('../../src/intuition/client.js').IntuitionClient

// Import the module being tested
const { ensureAttestationTriple, batchCreateAttestationTriples } =
  await import('../../src/intuition/triples.js')
const { TransactionFailedError } = await import('../../src/utils/errors.js')

describe('ensureAttestationTriple', () => {
  const contributorAtomId = '0x1' as Hex
  const projectAtomId = '0x2' as Hex
  const tripleId = '0x3' as Hex

  const retryOptions = {
    maxAttempts: 3,
    delayMs: 100
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockCalculateTripleId.mockReturnValue(tripleId)
  })

  it('creates new triple if not found', async () => {
    mockFindTripleIds.mockResolvedValue([])
    mockCreateTripleStatement.mockResolvedValue({
      transactionHash: '0xtx123' as Hex
    })

    const result = await ensureAttestationTriple(
      mockIntuitionClient,
      contributorAtomId,
      projectAtomId,
      retryOptions
    )

    expect(result.tripleId).toBe(tripleId)
    expect(result.existed).toBe(false)
    expect(result.cost).toBe(1000000000000000n)
    expect(result.txHash).toBe('0xtx123')
    expect(mockCreateTripleStatement).toHaveBeenCalledWith(
      expect.objectContaining({
        address: mockIntuitionClient.getAddress()
      }),
      expect.objectContaining({
        args: expect.any(Array),
        value: 1000000000000000n
      })
    )
  })

  it('adds deposit to existing triple', async () => {
    mockFindTripleIds.mockResolvedValue([{ term_id: '0x3' as Hex }])
    mockDeposit.mockResolvedValue({
      transactionHash: '0x456' as Hex
    })

    const result = await ensureAttestationTriple(
      mockIntuitionClient,
      contributorAtomId,
      projectAtomId,
      retryOptions
    )

    expect(result.tripleId).toBe(tripleId)
    expect(result.existed).toBe(true)
    expect(result.cost).toBe(1000000000000000n)
    expect(result.txHash).toBe('0x456')
    expect(mockDeposit).toHaveBeenCalledWith(
      expect.any(Object),
      expect.objectContaining({
        args: expect.any(Array),
        value: 1000000000000000n
      })
    )
    expect(mockCreateTripleStatement).not.toHaveBeenCalled()
  })

  it('calculates triple ID correctly', async () => {
    mockFindTripleIds.mockResolvedValue([])
    mockCreateTripleStatement.mockResolvedValue({
      transactionHash: '0xtx' as Hex
    })

    await ensureAttestationTriple(
      mockIntuitionClient,
      contributorAtomId,
      projectAtomId,
      retryOptions
    )

    expect(mockCalculateTripleId).toHaveBeenCalledWith(
      contributorAtomId,
      expect.any(String), // WAS_ASSOCIATED_WITH_PREDICATE_ID
      projectAtomId
    )
  })

  it('ensures sufficient balance before creating triple', async () => {
    mockFindTripleIds.mockResolvedValue([])
    mockCreateTripleStatement.mockResolvedValue({
      transactionHash: '0xtx' as Hex
    })

    await ensureAttestationTriple(
      mockIntuitionClient,
      contributorAtomId,
      projectAtomId,
      retryOptions
    )

    expect(mockIntuitionClient.ensureSufficientBalance).toHaveBeenCalledWith(
      1000000000000000n
    )
  })

  it('waits for confirmation after creating triple', async () => {
    mockFindTripleIds.mockResolvedValue([])
    const txHash = '0x789' as Hex
    mockCreateTripleStatement.mockResolvedValue({
      transactionHash: txHash
    })

    await ensureAttestationTriple(
      mockIntuitionClient,
      contributorAtomId,
      projectAtomId,
      retryOptions
    )

    expect(mockIntuitionClient.waitForConfirmation).toHaveBeenCalledWith(txHash)
  })

  it('waits for confirmation after adding deposit', async () => {
    mockFindTripleIds.mockResolvedValue([{ term_id: '0x3' as Hex }])
    const txHash = '0x999' as Hex
    mockDeposit.mockResolvedValue({
      transactionHash: txHash
    })

    await ensureAttestationTriple(
      mockIntuitionClient,
      contributorAtomId,
      projectAtomId,
      retryOptions
    )

    expect(mockIntuitionClient.waitForConfirmation).toHaveBeenCalledWith(txHash)
  })

  it('creates triple if findTripleIds fails', async () => {
    mockFindTripleIds.mockRejectedValue(new Error('API error'))
    mockCreateTripleStatement.mockResolvedValue({
      transactionHash: '0xtx' as Hex
    })

    const result = await ensureAttestationTriple(
      mockIntuitionClient,
      contributorAtomId,
      projectAtomId,
      retryOptions
    )

    expect(result.existed).toBe(false)
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('Failed to check triple existence')
    )
  })

  it('throws TransactionFailedError on triple creation failure', async () => {
    mockFindTripleIds.mockResolvedValue([])
    mockCreateTripleStatement.mockRejectedValue(new Error('Transaction failed'))

    await expect(
      ensureAttestationTriple(
        mockIntuitionClient,
        contributorAtomId,
        projectAtomId,
        retryOptions
      )
    ).rejects.toThrow(TransactionFailedError)
  })

  it('throws TransactionFailedError on deposit failure', async () => {
    mockFindTripleIds.mockResolvedValue([{ term_id: tripleId }])
    mockDeposit.mockRejectedValue(new Error('Deposit failed'))

    await expect(
      ensureAttestationTriple(
        mockIntuitionClient,
        contributorAtomId,
        projectAtomId,
        retryOptions
      )
    ).rejects.toThrow(TransactionFailedError)
  })

  it('retries on retryable errors', async () => {
    mockFindTripleIds
      .mockRejectedValueOnce(new Error('Network error'))
      .mockResolvedValue([])
    mockCreateTripleStatement.mockResolvedValue({
      transactionHash: '0xtx' as Hex
    })

    const result = await ensureAttestationTriple(
      mockIntuitionClient,
      contributorAtomId,
      projectAtomId,
      retryOptions
    )

    expect(result.tripleId).toBe(tripleId)
  })
})

describe('batchCreateAttestationTriples', () => {
  const contributorAtomIds = ['0x11', '0x22', '0x33'] as Hex[]
  const projectAtomId = '0x2' as Hex

  const retryOptions = {
    maxAttempts: 3,
    delayMs: 100
  }

  beforeEach(() => {
    jest.clearAllMocks()
    mockCalculateTripleId.mockImplementation((contrib: Hex) => {
      // Return a valid hex that can be converted to BigInt
      const num = parseInt(contrib, 16)
      return `0x${(num * 100).toString(16)}` as Hex
    })
  })

  it('creates all attestation triples', async () => {
    mockFindTripleIds.mockResolvedValue([])
    mockCreateTripleStatement.mockResolvedValue({
      transactionHash: '0xtx' as Hex
    })

    const results = await batchCreateAttestationTriples(
      mockIntuitionClient,
      contributorAtomIds,
      projectAtomId,
      retryOptions
    )

    expect(results).toHaveLength(3)
    expect(mockCreateTripleStatement).toHaveBeenCalledTimes(3)
  })

  it('continues processing after individual failures', async () => {
    mockFindTripleIds.mockResolvedValue([])
    mockCreateTripleStatement
      .mockResolvedValueOnce({ transactionHash: '0xc1' as Hex })
      .mockRejectedValueOnce(new Error('Failed'))
      .mockResolvedValueOnce({ transactionHash: '0xc3' as Hex })

    const results = await batchCreateAttestationTriples(
      mockIntuitionClient,
      contributorAtomIds,
      projectAtomId,
      retryOptions
    )

    // Should have 2 successful results (1st and 3rd)
    expect(results).toHaveLength(2)
    expect(core.error).toHaveBeenCalledWith(
      expect.stringContaining('Failed to create triple')
    )
  })

  it('handles mix of new triples and deposits', async () => {
    mockFindTripleIds
      .mockResolvedValueOnce([])
      .mockResolvedValueOnce([{ term_id: '0x88' as Hex }])
      .mockResolvedValueOnce([])

    mockCreateTripleStatement.mockResolvedValue({
      transactionHash: '0xaa' as Hex
    })
    mockDeposit.mockResolvedValue({
      transactionHash: '0xbb' as Hex
    })

    const results = await batchCreateAttestationTriples(
      mockIntuitionClient,
      contributorAtomIds,
      projectAtomId,
      retryOptions
    )

    expect(results).toHaveLength(3)
    expect(results[0].existed).toBe(false)
    expect(results[1].existed).toBe(true)
    expect(results[2].existed).toBe(false)
    expect(mockCreateTripleStatement).toHaveBeenCalledTimes(2)
    expect(mockDeposit).toHaveBeenCalledTimes(1)
  })

  it('logs progress messages', async () => {
    mockFindTripleIds.mockResolvedValue([])
    mockCreateTripleStatement.mockResolvedValue({
      transactionHash: '0xtx' as Hex
    })

    await batchCreateAttestationTriples(
      mockIntuitionClient,
      contributorAtomIds,
      projectAtomId,
      retryOptions
    )

    expect(core.info).toHaveBeenCalledWith(
      expect.stringContaining('Creating 3 attestation triples')
    )
  })
})
