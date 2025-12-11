/**
 * Unit tests for the action's main functionality, src/main.ts
 */
import { jest } from '@jest/globals'
import * as core from '../__fixtures__/core.js'

// Create mock GitHub context
const mockGitHubContext = {
  eventName: 'pull_request',
  payload: {
    pull_request: {
      merged: true,
      number: 123,
      head: { ref: 'feature-branch' },
      base: { ref: 'main' }
    },
    repository: {
      owner: { login: 'testorg' },
      name: 'testrepo'
    }
  },
  repo: { owner: 'testorg', repo: 'testrepo' },
  issue: { owner: 'testorg', repo: 'testrepo', number: 123 },
  sha: 'abc123',
  ref: 'refs/heads/main',
  workflow: 'test',
  action: 'test',
  actor: 'testuser',
  job: 'test',
  runNumber: 1,
  runId: 1,
  apiUrl: 'https://api.github.com',
  serverUrl: 'https://github.com',
  graphqlUrl: 'https://api.github.com/graphql'
}

// Mock GitHub Actions modules
jest.unstable_mockModule('@actions/core', () => core)
jest.unstable_mockModule('@actions/github', () => ({
  context: mockGitHubContext,
  getOctokit: jest.fn()
}))

// Mock validation service
jest.unstable_mockModule('../src/services/validation.js', () => ({
  validateAndParseInputs: jest.fn(() => ({
    privateKey:
      '0x1234567890123456789012345678901234567890123456789012345678901234' as `0x${string}`,
    githubToken: 'ghp_test123',
    network: 'testnet' as const,
    failureMode: 'warn' as const,
    minDepositAmount: 1000000000000000n,
    retryAttempts: 3,
    retryDelay: 1000
  }))
}))

// Mock repository service
jest.unstable_mockModule('../src/github/repository.js', () => ({
  fetchRepositoryData: jest.fn(async () => ({
    fullName: 'testorg/testrepo',
    description: 'Test repository',
    url: 'https://github.com/testorg/testrepo'
  }))
}))

// Mock contributors service
jest.unstable_mockModule('../src/github/contributors.js', () => ({
  fetchContributors: jest.fn(async () => [
    {
      username: 'testuser',
      name: 'Test User',
      email: 'test@example.com',
      profileUrl: 'https://github.com/testuser',
      avatarUrl: 'https://avatars.githubusercontent.com/u/123',
      commitCount: 5
    }
  ])
}))

// Mock Intuition client
const mockIntuitionClient = {
  checkBalance: jest.fn(async () => 1000000000000000000n),
  getAddress: jest.fn(
    () => '0x1234567890123456789012345678901234567890' as `0x${string}`
  ),
  getMinDeposit: jest.fn(() => 1000000000000000n),
  ensureSufficientBalance: jest.fn(async () => undefined),
  waitForConfirmation: jest.fn(async (hash: `0x${string}`) => ({
    hash,
    confirmed: true,
    blockNumber: 12345n
  }))
}

jest.unstable_mockModule('../src/intuition/client.js', () => ({
  IntuitionClient: {
    create: jest.fn(async () => mockIntuitionClient)
  }
}))

// Mock attestation service
jest.unstable_mockModule('../src/services/attestation.js', () => ({
  processAttestations: jest.fn(async () => ({
    projectAtomId: '0xabc123' as `0x${string}`,
    contributorCount: 1,
    attestationsCreated: 1,
    attestationsUpdated: 0,
    transactionHashes: ['0xtx1', '0xtx2'] as `0x${string}`[],
    totalCost: 2000000000000000n,
    results: [{ success: true }]
  }))
}))

// Import the module being tested dynamically
const { run } = await import('../src/main.js')

describe('main.ts', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('successfully processes a merged PR', async () => {
    await run()

    expect(core.info).toHaveBeenCalledWith(
      expect.stringContaining('Intuition Contributor Attestation Action')
    )
    expect(core.setOutput).toHaveBeenCalledWith('project-atom-id', '0xabc123')
    expect(core.setOutput).toHaveBeenCalledWith('contributor-count', '1')
    expect(core.setOutput).toHaveBeenCalledWith('attestations-created', '1')
    expect(core.setOutput).toHaveBeenCalledWith('attestations-updated', '0')
  })

  it('skips when PR is not merged', async () => {
    // Temporarily modify the context
    const originalMerged = mockGitHubContext.payload.pull_request!.merged
    mockGitHubContext.payload.pull_request!.merged = false

    await run()

    expect(core.info).toHaveBeenCalledWith(
      'Pull request is not merged yet. Skipping attestation creation.'
    )
    expect(core.setOutput).not.toHaveBeenCalled()

    // Restore the context
    mockGitHubContext.payload.pull_request!.merged = originalMerged
  })

  it('fails when not triggered by pull_request event', async () => {
    // Temporarily modify the event name
    const originalEventName = mockGitHubContext.eventName
    mockGitHubContext.eventName = 'push'

    await run()

    expect(core.setFailed).toHaveBeenCalledWith(
      expect.stringContaining(
        'This action must be triggered by a pull_request event'
      )
    )

    // Restore the event name
    mockGitHubContext.eventName = originalEventName
  })

  it('handles errors gracefully', async () => {
    // Mock validation to throw an error
    const { validateAndParseInputs } =
      await import('../src/services/validation.js')
    const mockFn = validateAndParseInputs as jest.MockedFunction<
      typeof validateAndParseInputs
    >
    mockFn.mockImplementationOnce(() => {
      throw new Error('Invalid input')
    })

    await run()

    expect(core.setFailed).toHaveBeenCalledWith('Action failed: Invalid input')
  })
})
