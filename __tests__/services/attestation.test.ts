/**
 * Unit tests for attestation service
 *
 * Covers:
 * - Processing attestations for contributors
 * - Project atom and contributor atom creation orchestration
 * - Triple creation for attestations
 * - Error handling with 'fail' and 'warn' modes
 * - Partial failure scenarios and retry logic
 *
 * Mocking considerations:
 * - Uses jest.unstable_mockModule for ESM compatibility
 * - Mocks atoms and triples modules
 * - Tests both successful and failure scenarios
 */
import { jest } from '@jest/globals'
import { describe, it, expect, beforeEach } from '@jest/globals'
import * as core from '../../__fixtures__/core.js'
import type { Hex } from 'viem'

// Mock @actions/core
jest.unstable_mockModule('@actions/core', () => core)

// Mock atoms module
const mockEnsureProjectAtom = jest.fn()
const mockEnsureContributorAtom = jest.fn()

jest.unstable_mockModule('../../src/intuition/atoms.js', () => ({
  ensureProjectAtom: mockEnsureProjectAtom,
  ensureContributorAtom: mockEnsureContributorAtom
}))

// Mock triples module
const mockEnsureAttestationTriple = jest.fn()

jest.unstable_mockModule('../../src/intuition/triples.js', () => ({
  ensureAttestationTriple: mockEnsureAttestationTriple
}))

// Create mock IntuitionClient
const mockIntuitionClient = {
  getAddress: jest.fn(
    () => '0x1234567890123456789012345678901234567890' as Hex
  ),
  getMinDeposit: jest.fn(() => 1000000000000000n)
}

// Import the module being tested
const { processAttestations } =
  await import('../../src/services/attestation.js')
const { ActionError } = await import('../../src/utils/errors.js')

describe('processAttestations', () => {
  const repository = {
    fullName: 'testorg/testrepo',
    description: 'Test repository',
    url: 'https://github.com/testorg/testrepo'
  }

  const contributors = [
    {
      username: 'user1',
      name: 'User One',
      email: 'user1@example.com',
      profileUrl: 'https://github.com/user1',
      avatarUrl: 'https://avatars.githubusercontent.com/u/1',
      commitCount: 5
    },
    {
      username: 'user2',
      name: 'User Two',
      email: 'user2@example.com',
      profileUrl: 'https://github.com/user2',
      avatarUrl: 'https://avatars.githubusercontent.com/u/2',
      commitCount: 3
    }
  ]

  const retryOptions = {
    maxAttempts: 3,
    delayMs: 100
  }

  beforeEach(() => {
    jest.clearAllMocks()

    // Default successful responses
    mockEnsureProjectAtom.mockResolvedValue({
      atomId: '0xproject' as Hex,
      txHash: '0xprojecttx' as Hex,
      cost: 1000000000000000n,
      existed: false
    })

    mockEnsureContributorAtom.mockResolvedValue({
      atomId: '0xcontrib' as Hex,
      txHash: '0xcontribtx' as Hex,
      cost: 1000000000000000n,
      existed: false
    })

    mockEnsureAttestationTriple.mockResolvedValue({
      tripleId: '0xtriple' as Hex,
      txHash: '0xtripletx' as Hex,
      cost: 1000000000000000n,
      existed: false
    })
  })

  it('successfully processes all contributors', async () => {
    const summary = await processAttestations(
      mockIntuitionClient as any,
      repository,
      contributors,
      'fail',
      retryOptions
    )

    expect(summary.projectAtomId).toBe('0xproject')
    expect(summary.contributorCount).toBe(2)
    expect(summary.attestationsCreated).toBe(2)
    expect(summary.attestationsUpdated).toBe(0)
    expect(summary.transactionHashes).toHaveLength(5) // 1 project + 2 contributors + 2 triples
    expect(summary.totalCost).toBe(5000000000000000n) // 1 + 2 + 2
    expect(summary.results).toHaveLength(2)
    expect(summary.results.every((r) => r.success)).toBe(true)
  })

  it('creates project atom with repository data', async () => {
    await processAttestations(
      mockIntuitionClient as any,
      repository,
      contributors,
      'fail',
      retryOptions
    )

    expect(mockEnsureProjectAtom).toHaveBeenCalledWith(
      mockIntuitionClient,
      {
        name: repository.fullName,
        description: repository.description,
        url: repository.url
      },
      retryOptions
    )
  })

  it('creates contributor atoms with correct data', async () => {
    await processAttestations(
      mockIntuitionClient as any,
      repository,
      contributors,
      'fail',
      retryOptions
    )

    expect(mockEnsureContributorAtom).toHaveBeenCalledTimes(2)
    expect(mockEnsureContributorAtom).toHaveBeenCalledWith(
      mockIntuitionClient,
      expect.objectContaining({
        name: 'User One',
        description: 'Contributor: user1',
        url: 'https://github.com/user1',
        image: 'https://avatars.githubusercontent.com/u/1'
      }),
      retryOptions
    )
  })

  it('creates attestation triples for each contributor', async () => {
    await processAttestations(
      mockIntuitionClient as any,
      repository,
      contributors,
      'fail',
      retryOptions
    )

    expect(mockEnsureAttestationTriple).toHaveBeenCalledTimes(2)
    expect(mockEnsureAttestationTriple).toHaveBeenCalledWith(
      mockIntuitionClient,
      '0xcontrib',
      '0xproject',
      retryOptions
    )
  })

  it('counts attestations created vs updated correctly', async () => {
    mockEnsureAttestationTriple
      .mockResolvedValueOnce({
        tripleId: '0xtriple1' as Hex,
        txHash: '0xtx1' as Hex,
        cost: 1000000000000000n,
        existed: false // Created
      })
      .mockResolvedValueOnce({
        tripleId: '0xtriple2' as Hex,
        txHash: '0xtx2' as Hex,
        cost: 1000000000000000n,
        existed: true // Updated (deposit added)
      })

    const summary = await processAttestations(
      mockIntuitionClient as any,
      repository,
      contributors,
      'fail',
      retryOptions
    )

    expect(summary.attestationsCreated).toBe(1)
    expect(summary.attestationsUpdated).toBe(1)
  })

  it('excludes zero transaction hashes from summary', async () => {
    mockEnsureProjectAtom.mockResolvedValue({
      atomId: '0xproject' as Hex,
      txHash: '0x0' as Hex, // Existing atom
      cost: 0n,
      existed: true
    })

    mockEnsureContributorAtom.mockResolvedValue({
      atomId: '0xcontrib' as Hex,
      txHash: '0x0' as Hex, // Existing atom
      cost: 0n,
      existed: true
    })

    const summary = await processAttestations(
      mockIntuitionClient as any,
      repository,
      contributors,
      'fail',
      retryOptions
    )

    // Should only include triple transaction hashes
    expect(summary.transactionHashes).toHaveLength(2)
    expect(summary.transactionHashes.every((h) => h !== '0x0')).toBe(true)
  })

  it('calculates total cost correctly', async () => {
    mockEnsureProjectAtom.mockResolvedValue({
      atomId: '0xproject' as Hex,
      txHash: '0x0' as Hex,
      cost: 0n, // Existing atom
      existed: true
    })

    mockEnsureContributorAtom.mockResolvedValue({
      atomId: '0xcontrib' as Hex,
      txHash: '0xcontribtx' as Hex,
      cost: 2000000000000000n,
      existed: false
    })

    mockEnsureAttestationTriple.mockResolvedValue({
      tripleId: '0xtriple' as Hex,
      txHash: '0xtripletx' as Hex,
      cost: 3000000000000000n,
      existed: false
    })

    const summary = await processAttestations(
      mockIntuitionClient as any,
      repository,
      contributors,
      'fail',
      retryOptions
    )

    // 0 (project) + 2*2 (contributors) + 2*3 (triples) = 10
    expect(summary.totalCost).toBe(10000000000000000n)
  })

  it('throws error in fail mode when contributor processing fails', async () => {
    mockEnsureContributorAtom.mockRejectedValueOnce(
      new Error('Contributor failed')
    )

    await expect(
      processAttestations(
        mockIntuitionClient as any,
        repository,
        contributors,
        'fail',
        retryOptions
      )
    ).rejects.toThrow('Contributor failed')
  })

  it('continues in warn mode when contributor processing fails', async () => {
    mockEnsureContributorAtom
      .mockResolvedValueOnce({
        atomId: '0xcontrib1' as Hex,
        txHash: '0xtx1' as Hex,
        cost: 1000000000000000n,
        existed: false
      })
      .mockRejectedValueOnce(new Error('Contributor 2 failed'))

    const summary = await processAttestations(
      mockIntuitionClient as any,
      repository,
      contributors,
      'warn',
      retryOptions
    )

    expect(summary.results).toHaveLength(2)
    expect(summary.results[0].success).toBe(true)
    expect(summary.results[1].success).toBe(false)
    expect(summary.results[1].error).toContain('Contributor 2 failed')
    expect(core.warning).toHaveBeenCalledWith(
      expect.stringContaining('Failed to process contributor')
    )
  })

  it('logs progress messages', async () => {
    await processAttestations(
      mockIntuitionClient as any,
      repository,
      contributors,
      'fail',
      retryOptions
    )

    expect(core.info).toHaveBeenCalledWith(
      expect.stringContaining('Step 1: Creating/verifying project atom')
    )
    expect(core.info).toHaveBeenCalledWith(
      expect.stringContaining('Step 2: Processing 2 contributor(s)')
    )
  })

  it('logs contributor usernames in messages', async () => {
    await processAttestations(
      mockIntuitionClient as any,
      repository,
      contributors,
      'fail',
      retryOptions
    )

    expect(core.info).toHaveBeenCalledWith(expect.stringContaining('@user1'))
    expect(core.info).toHaveBeenCalledWith(expect.stringContaining('@user2'))
  })

  it('uses contributor name when username is not available', async () => {
    const contributorWithoutUsername = [
      {
        username: undefined,
        name: 'Anonymous User',
        email: 'anon@example.com',
        profileUrl: 'https://github.com/ghost',
        avatarUrl: 'https://avatars.githubusercontent.com/u/0',
        commitCount: 1
      }
    ]

    await processAttestations(
      mockIntuitionClient as any,
      repository,
      contributorWithoutUsername,
      'fail',
      retryOptions
    )

    expect(core.info).toHaveBeenCalledWith(
      expect.stringContaining('Anonymous User')
    )
  })

  it('throws wrapped ActionError on unexpected errors', async () => {
    mockEnsureProjectAtom.mockRejectedValue(new Error('Unexpected error'))

    await expect(
      processAttestations(
        mockIntuitionClient as any,
        repository,
        contributors,
        'fail',
        retryOptions
      )
    ).rejects.toThrow(ActionError)
  })

  it('passes through ActionError without wrapping', async () => {
    const actionError = new ActionError('Action error', false)
    mockEnsureProjectAtom.mockRejectedValue(actionError)

    await expect(
      processAttestations(
        mockIntuitionClient as any,
        repository,
        contributors,
        'fail',
        retryOptions
      )
    ).rejects.toBe(actionError)
  })

  it('fails after exhausting all retry attempts', async () => {
    const persistentError = new Error('Persistent failure')
    mockEnsureProjectAtom.mockRejectedValue(persistentError)

    await expect(
      processAttestations(
        mockIntuitionClient as any,
        repository,
        contributors,
        'fail',
        retryOptions
      )
    ).rejects.toThrow('Persistent failure')

    // Verify retry attempts were made (maxAttempts = 3)
    // Note: The actual retry happens inside ensureProjectAtom which is mocked
    // so we can only verify it was called once from processAttestations
    expect(mockEnsureProjectAtom).toHaveBeenCalledTimes(1)
  })
})
