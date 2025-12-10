/**
 * Unit tests for GitHub contributor fetching
 */

import { jest, describe, expect, it, beforeEach } from '@jest/globals'
import { GitHubAPIError } from '../../src/utils/errors.js'
import {
  mockCommits,
  mockGitHubUser1,
  mockGitHubUser2
} from '../../__fixtures__/github/contributors.js'

// Mock @actions/core
const mockCore = {
  info: jest.fn(),
  warning: jest.fn()
}

// Mock @actions/github
const mockOctokit = {
  rest: {
    pulls: {
      listCommits: jest.fn()
    },
    users: {
      getByUsername: jest.fn()
    }
  },
  paginate: jest.fn()
}

const mockGithub = {
  getOctokit: jest.fn(() => mockOctokit),
  context: {
    repo: {
      owner: '0xIntuition',
      repo: 'intuition-ts'
    },
    payload: {
      pull_request: {
        number: 42
      }
    }
  }
}

jest.unstable_mockModule('@actions/core', () => mockCore)
jest.unstable_mockModule('@actions/github', () => mockGithub)

const { fetchContributors } = await import('../../src/github/contributors.js')

describe('fetchContributors', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('fetches contributors with GitHub profiles successfully', async () => {
    mockOctokit.paginate.mockResolvedValue(mockCommits)
    mockOctokit.rest.users.getByUsername
      .mockResolvedValueOnce({ data: mockGitHubUser1 })
      .mockResolvedValueOnce({ data: mockGitHubUser2 })
      .mockRejectedValueOnce({ status: 404 }) // Third contributor has no profile

    const result = await fetchContributors('ghp_test_token')

    expect(result).toHaveLength(3)

    // First contributor with profile
    expect(result[0]).toMatchObject({
      username: 'johndoe',
      name: 'John Doe',
      email: 'john@example.com',
      profileUrl: 'https://github.com/johndoe',
      avatarUrl: 'https://avatars.githubusercontent.com/u/111111',
      commitCount: 1
    })

    // Second contributor with profile
    expect(result[1]).toMatchObject({
      username: 'janesmith',
      name: 'Jane Smith',
      email: 'jane@example.com',
      profileUrl: 'https://github.com/janesmith',
      commitCount: 1
    })

    // Third contributor without GitHub profile (fallback)
    expect(result[2]).toMatchObject({
      username: undefined,
      name: 'Bob Johnson',
      email: 'bob@example.com',
      profileUrl: expect.stringContaining('github.com'),
      commitCount: 1
    })
  })

  it('deduplicates contributors by email', async () => {
    const duplicateCommits = [
      mockCommits[0],
      mockCommits[0], // Duplicate
      mockCommits[1]
    ]

    mockOctokit.paginate.mockResolvedValue(duplicateCommits)
    mockOctokit.rest.users.getByUsername
      .mockResolvedValueOnce({ data: mockGitHubUser1 })
      .mockResolvedValueOnce({ data: mockGitHubUser2 })

    const result = await fetchContributors('ghp_test_token')

    expect(result).toHaveLength(2)
  })

  it('counts commits correctly per contributor', async () => {
    const multipleCommits = [
      mockCommits[0],
      mockCommits[0], // Same author
      mockCommits[1]
    ]

    mockOctokit.paginate.mockResolvedValue(multipleCommits)
    mockOctokit.rest.users.getByUsername
      .mockResolvedValueOnce({ data: mockGitHubUser1 })
      .mockResolvedValueOnce({ data: mockGitHubUser2 })

    const result = await fetchContributors('ghp_test_token')

    const johndoe = result.find((c) => c.username === 'johndoe')
    expect(johndoe?.commitCount).toBe(2)
  })

  it('handles GitHub profile 404 gracefully', async () => {
    mockOctokit.paginate.mockResolvedValue([mockCommits[0]])

    const error = new Error('Not Found')
    Object.assign(error, { status: 404 })
    mockOctokit.rest.users.getByUsername.mockRejectedValue(error)

    const result = await fetchContributors('ghp_test_token')

    expect(result).toHaveLength(1)
    expect(result[0].profileUrl).toContain('github.com')
    // Should use fallback profile URL when 404 occurs
    expect(result[0].username).toBe('johndoe')
  })

  it('handles contributor without GitHub account', async () => {
    mockOctokit.paginate.mockResolvedValue([mockCommits[2]])

    const result = await fetchContributors('ghp_test_token')

    expect(result).toHaveLength(1)
    expect(result[0]).toMatchObject({
      username: undefined,
      name: 'Bob Johnson',
      email: 'bob@example.com'
    })
    expect(result[0].profileUrl).toContain('github.com')
    expect(mockCore.warning).toHaveBeenCalledWith(
      expect.stringContaining('fallback data')
    )
  })

  it('skips commits without author email', async () => {
    const commitWithoutEmail = {
      ...mockCommits[0],
      commit: {
        author: {
          name: 'Test User',
          email: null
        }
      }
    }

    mockOctokit.paginate.mockResolvedValue([commitWithoutEmail, mockCommits[0]])
    mockOctokit.rest.users.getByUsername.mockResolvedValue({
      data: mockGitHubUser1
    })

    const result = await fetchContributors('ghp_test_token')

    expect(result).toHaveLength(1)
    expect(mockCore.warning).toHaveBeenCalledWith(
      expect.stringContaining('no author email')
    )
  })

  it('throws error when not in pull_request event', async () => {
    const originalPayload = mockGithub.context.payload
    mockGithub.context.payload = {}

    await expect(fetchContributors('ghp_test_token')).rejects.toThrow(
      GitHubAPIError
    )
    await expect(fetchContributors('ghp_test_token')).rejects.toThrow(
      /must be run on a pull_request event/
    )

    mockGithub.context.payload = originalPayload
  })

  it('throws GitHubAPIError on API failure', async () => {
    const error = new Error('Rate limit exceeded')
    Object.assign(error, { status: 403 })
    mockOctokit.paginate.mockRejectedValue(error)

    await expect(fetchContributors('ghp_test_token')).rejects.toThrow(
      GitHubAPIError
    )

    const thrownError = await fetchContributors('ghp_test_token').catch(
      (e) => e
    )
    expect(thrownError.statusCode).toBe(403)
  })

  it('handles pagination correctly', async () => {
    mockOctokit.paginate.mockResolvedValue(mockCommits)

    await fetchContributors('ghp_test_token')

    expect(mockOctokit.paginate).toHaveBeenCalledWith(
      mockOctokit.rest.pulls.listCommits,
      {
        owner: '0xIntuition',
        repo: 'intuition-ts',
        pull_number: 42,
        per_page: 100
      }
    )
  })

  it('logs contributor summary', async () => {
    mockOctokit.paginate.mockResolvedValue([mockCommits[0]])
    mockOctokit.rest.users.getByUsername.mockResolvedValue({
      data: mockGitHubUser1
    })

    await fetchContributors('ghp_test_token')

    expect(mockCore.info).toHaveBeenCalledWith(
      expect.stringContaining('Found 1 commits')
    )
    expect(mockCore.info).toHaveBeenCalledWith(
      expect.stringContaining('Found 1 unique contributor')
    )
    expect(mockCore.info).toHaveBeenCalledWith(
      expect.stringContaining('@johndoe')
    )
  })

  it('updates username if initially missing', async () => {
    // First commit without GitHub author, second with
    const commit1 = {
      ...mockCommits[0],
      author: null
    }
    const commit2 = mockCommits[0]

    mockOctokit.paginate.mockResolvedValue([commit1, commit2])
    mockOctokit.rest.users.getByUsername.mockResolvedValue({
      data: mockGitHubUser1
    })

    const result = await fetchContributors('ghp_test_token')

    expect(result).toHaveLength(1)
    expect(result[0].username).toBe('johndoe')
  })

  it('handles user API error gracefully', async () => {
    mockOctokit.paginate.mockResolvedValue([mockCommits[0]])

    const error = new Error('Service Unavailable')
    Object.assign(error, { status: 503 })
    mockOctokit.rest.users.getByUsername.mockRejectedValue(error)

    const result = await fetchContributors('ghp_test_token')

    expect(result).toHaveLength(1)
    expect(result[0].profileUrl).toContain('github.com')
    expect(mockCore.warning).toHaveBeenCalledWith(
      expect.stringContaining('Failed to fetch profile')
    )
  })
})
