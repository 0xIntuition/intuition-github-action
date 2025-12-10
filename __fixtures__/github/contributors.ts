/**
 * Mock GitHub contributor and commit data for testing
 */

export const mockCommit1 = {
  sha: 'abc123def456',
  commit: {
    author: {
      name: 'John Doe',
      email: 'john@example.com',
      date: '2024-01-15T10:00:00Z'
    },
    message: 'feat: add new feature'
  },
  author: {
    login: 'johndoe',
    id: 111111,
    avatar_url: 'https://avatars.githubusercontent.com/u/111111',
    html_url: 'https://github.com/johndoe'
  }
}

export const mockCommit2 = {
  sha: 'def456ghi789',
  commit: {
    author: {
      name: 'Jane Smith',
      email: 'jane@example.com',
      date: '2024-01-16T14:30:00Z'
    },
    message: 'fix: resolve bug'
  },
  author: {
    login: 'janesmith',
    id: 222222,
    avatar_url: 'https://avatars.githubusercontent.com/u/222222',
    html_url: 'https://github.com/janesmith'
  }
}

// Commit without GitHub author (deleted account or non-GitHub user)
export const mockCommitNoGitHubUser = {
  sha: 'ghi789jkl012',
  commit: {
    author: {
      name: 'Bob Johnson',
      email: 'bob@example.com',
      date: '2024-01-17T09:15:00Z'
    },
    message: 'docs: update README'
  },
  author: null
}

export const mockCommits = [mockCommit1, mockCommit2, mockCommitNoGitHubUser]

export const mockGitHubUser1 = {
  login: 'johndoe',
  id: 111111,
  name: 'John Doe',
  email: 'john@example.com',
  avatar_url: 'https://avatars.githubusercontent.com/u/111111',
  html_url: 'https://github.com/johndoe',
  bio: 'Software Engineer',
  company: 'Acme Corp'
}

export const mockGitHubUser2 = {
  login: 'janesmith',
  id: 222222,
  name: 'Jane Smith',
  email: 'jane@example.com',
  avatar_url: 'https://avatars.githubusercontent.com/u/222222',
  html_url: 'https://github.com/janesmith',
  bio: 'Developer',
  company: null
}

export const mockPullRequest = {
  number: 42,
  merged: true,
  merged_at: '2024-01-18T12:00:00Z',
  base: {
    ref: 'main',
    repo: {
      name: 'intuition-ts',
      full_name: '0xIntuition/intuition-ts'
    }
  },
  head: {
    ref: 'feature/new-feature'
  }
}

export const mockContributor1 = {
  username: 'johndoe',
  name: 'John Doe',
  email: 'john@example.com',
  profileUrl: 'https://github.com/johndoe',
  avatarUrl: 'https://avatars.githubusercontent.com/u/111111',
  bio: 'Software Engineer',
  commitCount: 1
}

export const mockContributor2 = {
  username: 'janesmith',
  name: 'Jane Smith',
  email: 'jane@example.com',
  profileUrl: 'https://github.com/janesmith',
  avatarUrl: 'https://avatars.githubusercontent.com/u/222222',
  bio: 'Developer',
  commitCount: 1
}

export const mockContributor3NoGitHub = {
  username: undefined,
  name: 'Bob Johnson',
  email: 'bob@example.com',
  profileUrl: undefined,
  avatarUrl: undefined,
  bio: undefined,
  commitCount: 1
}

export const mockContributors = [
  mockContributor1,
  mockContributor2,
  mockContributor3NoGitHub
]
