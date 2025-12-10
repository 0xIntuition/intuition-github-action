/**
 * GitHub-related type definitions
 */

/**
 * Repository metadata
 */
export interface RepositoryData {
  name: string
  fullName: string
  description: string
  url: string
  owner: string
}

/**
 * Contributor information
 */
export interface ContributorData {
  username?: string
  name: string
  email: string
  profileUrl: string
  avatarUrl?: string
  commitCount: number
}

/**
 * Commit author information from GitHub
 */
export interface CommitAuthor {
  name: string
  email: string
  username?: string
}
