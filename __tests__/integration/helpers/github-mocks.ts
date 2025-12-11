/**
 * GitHub context mocking utilities for integration tests
 * These mocks provide GitHub data without making actual GitHub API calls
 */
import type {
  ContributorData,
  RepositoryData
} from '../../../src/github/types.js'

/**
 * Create a mock GitHub context object
 * Mimics @actions/github context structure for integration testing
 */
export function createMockGitHubContext(
  repo: RepositoryData,
  prNumber: number = Date.now()
) {
  return {
    eventName: 'pull_request',
    payload: {
      pull_request: {
        merged: true,
        number: prNumber,
        id: prNumber,
        html_url: `https://github.com/${repo.fullName}/pull/${prNumber}`,
        title: 'Test PR',
        user: {
          login: repo.owner,
          id: 1,
          avatar_url: `https://avatars.githubusercontent.com/u/1?v=4`,
          html_url: `https://github.com/${repo.owner}`
        },
        head: {
          ref: 'test-branch',
          sha: '0'.repeat(40)
        },
        base: {
          ref: 'main',
          sha: '0'.repeat(40)
        }
      },
      repository: {
        name: repo.name,
        full_name: repo.fullName,
        owner: {
          login: repo.owner
        },
        description: repo.description,
        html_url: repo.url,
        private: false
      }
    },
    repo: {
      owner: repo.owner,
      repo: repo.name
    },
    issue: {
      number: prNumber
    }
  }
}

/**
 * Create mock commit data for contributors
 */
export function createMockCommits(contributors: ContributorData[]) {
  return contributors.map((contributor, index) => ({
    sha: index.toString().padStart(40, '0'),
    commit: {
      author: {
        name: contributor.name,
        email: contributor.email
      },
      message: `Test commit ${index + 1}`
    },
    author: contributor.username
      ? {
          login: contributor.username,
          id: index + 1,
          avatar_url: contributor.avatarUrl,
          html_url: contributor.profileUrl
        }
      : null
  }))
}

/**
 * Create mock Octokit response for repository data
 */
export function createMockRepoResponse(repo: RepositoryData) {
  return {
    data: {
      name: repo.name,
      full_name: repo.fullName,
      owner: {
        login: repo.owner
      },
      description: repo.description,
      html_url: repo.url,
      private: false
    }
  }
}

/**
 * Create mock Octokit response for PR commits
 */
export function createMockCommitsResponse(contributors: ContributorData[]) {
  return {
    data: createMockCommits(contributors)
  }
}

/**
 * Create mock Octokit response for user data
 */
export function createMockUserResponse(contributor: ContributorData) {
  return {
    data: {
      login: contributor.username || 'unknown',
      id: Date.now(),
      name: contributor.name,
      email: contributor.email,
      avatar_url: contributor.avatarUrl,
      html_url: contributor.profileUrl
    }
  }
}
