/**
 * Unit tests for GitHub repository data fetching
 */

import { jest, describe, expect, it, beforeEach } from '@jest/globals'
import { GitHubAPIError } from '../../src/utils/errors.js'
import {
  mockRepository,
  mockRepositoryWithoutDescription
} from '../../__fixtures__/github/repository.js'

// Mock @actions/core
const mockCore = {
  info: jest.fn(),
  debug: jest.fn()
}

// Mock @actions/github
const mockOctokit = {
  rest: {
    repos: {
      get: jest.fn()
    }
  }
}

const mockGithub = {
  getOctokit: jest.fn(() => mockOctokit),
  context: {
    repo: {
      owner: '0xIntuition',
      repo: 'intuition-ts'
    }
  }
}

jest.unstable_mockModule('@actions/core', () => mockCore)
jest.unstable_mockModule('@actions/github', () => mockGithub)

const { fetchRepositoryData } = await import('../../src/github/repository.js')

describe('fetchRepositoryData', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('fetches repository data successfully', async () => {
    mockOctokit.rest.repos.get.mockResolvedValue({
      data: mockRepository
    })

    const result = await fetchRepositoryData('ghp_test_token')

    expect(result).toEqual({
      name: 'intuition-ts',
      fullName: '0xIntuition/intuition-ts',
      description: 'TypeScript SDK for Intuition Protocol',
      url: 'https://github.com/0xIntuition/intuition-ts',
      owner: '0xIntuition'
    })

    expect(mockOctokit.rest.repos.get).toHaveBeenCalledWith({
      owner: '0xIntuition',
      repo: 'intuition-ts'
    })

    expect(mockCore.info).toHaveBeenCalledWith(
      expect.stringContaining('Fetching repository data')
    )
    expect(mockCore.info).toHaveBeenCalledWith(
      expect.stringContaining('0xIntuition/intuition-ts')
    )
  })

  it('handles missing description with default', async () => {
    mockOctokit.rest.repos.get.mockResolvedValue({
      data: mockRepositoryWithoutDescription
    })

    const result = await fetchRepositoryData('ghp_test_token')

    expect(result.description).toBe('Repository: intuition-ts')
  })

  it('throws GitHubAPIError on 404', async () => {
    const error = new Error('Not Found')
    Object.assign(error, { status: 404 })
    mockOctokit.rest.repos.get.mockRejectedValue(error)

    await expect(fetchRepositoryData('ghp_test_token')).rejects.toThrow(
      GitHubAPIError
    )

    const thrownError = await fetchRepositoryData('ghp_test_token').catch(
      (e) => e
    )
    expect(thrownError.statusCode).toBe(404)
    expect(thrownError.isRetryable).toBe(false)
  })

  it('throws GitHubAPIError on 500', async () => {
    const error = new Error('Internal Server Error')
    Object.assign(error, { status: 500 })
    mockOctokit.rest.repos.get.mockRejectedValue(error)

    await expect(fetchRepositoryData('ghp_test_token')).rejects.toThrow(
      GitHubAPIError
    )

    const thrownError = await fetchRepositoryData('ghp_test_token').catch(
      (e) => e
    )
    expect(thrownError.statusCode).toBe(500)
    expect(thrownError.isRetryable).toBe(true)
  })

  it('throws GitHubAPIError on network error without status', async () => {
    mockOctokit.rest.repos.get.mockRejectedValue(new Error('Network timeout'))

    await expect(fetchRepositoryData('ghp_test_token')).rejects.toThrow(
      GitHubAPIError
    )
    await expect(fetchRepositoryData('ghp_test_token')).rejects.toThrow(
      /Failed to fetch repository data/
    )
  })

  it('uses provided GitHub token', async () => {
    mockOctokit.rest.repos.get.mockResolvedValue({
      data: mockRepository
    })

    await fetchRepositoryData('custom_token_123')

    expect(mockGithub.getOctokit).toHaveBeenCalledWith('custom_token_123')
  })

  it('logs debug information', async () => {
    mockOctokit.rest.repos.get.mockResolvedValue({
      data: mockRepository
    })

    await fetchRepositoryData('ghp_test_token')

    expect(mockCore.debug).toHaveBeenCalledWith(
      expect.stringContaining('Description:')
    )
    expect(mockCore.debug).toHaveBeenCalledWith(expect.stringContaining('URL:'))
  })
})
