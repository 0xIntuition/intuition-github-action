/**
 * Test data generators for integration tests
 * Uses timestamps to ensure uniqueness across test runs
 */
import type {
  ContributorData,
  RepositoryData
} from '../../../src/github/types.js'
import type { ThingAtomData } from '../../../src/intuition/types.js'

/**
 * Generate unique test repository data
 * Uses timestamp to ensure uniqueness across test runs
 */
export function generateTestRepository(suffix?: string): RepositoryData {
  const timestamp = Date.now()
  const uniqueSuffix = suffix || timestamp.toString()

  return {
    owner: 'test-org',
    name: `test-repo-${uniqueSuffix}`,
    fullName: `test-org/test-repo-${uniqueSuffix}`,
    description: `Integration test repository created at ${new Date().toISOString()}`,
    url: `https://github.com/test-org/test-repo-${uniqueSuffix}`
  }
}

/**
 * Generate test contributor data
 */
export function generateTestContributor(index: number = 0): ContributorData {
  const timestamp = Date.now()

  return {
    username: `test-contributor-${timestamp}-${index}`,
    name: `Test Contributor ${index}`,
    email: `test-${timestamp}-${index}@example.com`,
    profileUrl: `https://github.com/test-contributor-${timestamp}-${index}`,
    avatarUrl: `https://avatars.githubusercontent.com/u/${timestamp}${index}`,
    commitCount: 1
  }
}

/**
 * Generate multiple test contributors
 */
export function generateTestContributors(count: number): ContributorData[] {
  return Array.from({ length: count }, (_, i) => generateTestContributor(i))
}

/**
 * Convert repository to atom data
 */
export function repositoryToAtomData(repo: RepositoryData): ThingAtomData {
  return {
    name: repo.fullName,
    description: repo.description,
    url: repo.url
  }
}

/**
 * Convert contributor to atom data
 */
export function contributorToAtomData(
  contributor: ContributorData
): ThingAtomData {
  return {
    name: contributor.name,
    description: `Contributor: ${contributor.username || contributor.email}`,
    url: contributor.profileUrl,
    image: contributor.avatarUrl
  }
}
