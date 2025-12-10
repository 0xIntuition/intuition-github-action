/**
 * Fetch PR commits and contributor profiles from GitHub
 */

import * as core from '@actions/core'
import * as github from '@actions/github'
import { GitHubAPIError } from '../utils/errors.js'
import type { CommitAuthor, ContributorData } from './types.js'

/**
 * Fetch all contributors from the merged PR
 * @param githubToken GitHub API token
 * @returns Array of unique contributors
 */
export async function fetchContributors(
  githubToken: string
): Promise<ContributorData[]> {
  const octokit = github.getOctokit(githubToken)
  const context = github.context

  // Ensure we're in a pull_request event
  if (!context.payload.pull_request) {
    throw new GitHubAPIError('This action must be run on a pull_request event')
  }

  const prNumber = context.payload.pull_request.number

  try {
    core.info(`Fetching commits for PR #${prNumber}`)

    // Fetch all commits in the PR with pagination
    const commits = await octokit.paginate(octokit.rest.pulls.listCommits, {
      owner: context.repo.owner,
      repo: context.repo.repo,
      pull_number: prNumber,
      per_page: 100
    })

    core.info(`Found ${commits.length} commits in PR #${prNumber}`)

    // Extract unique commit authors
    const authorsMap = new Map<string, CommitAuthor>()

    for (const commit of commits) {
      const authorEmail = commit.commit.author?.email
      const authorName = commit.commit.author?.name || 'Unknown'
      const authorUsername = commit.author?.login

      if (!authorEmail) {
        core.warning(`Skipping commit ${commit.sha}: no author email`)
        continue
      }

      // Use email as unique key to deduplicate
      const key = authorEmail.toLowerCase()

      if (!authorsMap.has(key)) {
        authorsMap.set(key, {
          name: authorName,
          email: authorEmail,
          username: authorUsername
        })
      } else if (authorUsername && !authorsMap.get(key)?.username) {
        // Update with username if we didn't have it before
        const existing = authorsMap.get(key)!
        authorsMap.set(key, {
          ...existing,
          username: authorUsername
        })
      }
    }

    core.info(`Found ${authorsMap.size} unique contributor(s)`)

    // Fetch contributor profiles and construct contributor data
    const contributors: ContributorData[] = []

    for (const [email, author] of authorsMap) {
      const contributorData = await getContributorData(
        octokit,
        author,
        commits.filter((c) => c.commit.author?.email?.toLowerCase() === email)
          .length
      )
      contributors.push(contributorData)
    }

    // Log contributor summary
    core.info('Contributors:')
    for (const contributor of contributors) {
      const displayName = contributor.username
        ? `@${contributor.username} (${contributor.name})`
        : contributor.name
      core.info(
        `  - ${displayName} (${contributor.commitCount} commit(s)) → ${contributor.profileUrl}`
      )
    }

    return contributors
  } catch (error) {
    if (error instanceof GitHubAPIError) {
      throw error
    }
    if (error && typeof error === 'object' && 'status' in error) {
      throw new GitHubAPIError(
        `Failed to fetch contributors: ${error instanceof Error ? error.message : String(error)}`,
        error.status as number
      )
    }
    throw new GitHubAPIError(
      `Failed to fetch contributors: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}

/**
 * Get contributor data, fetching GitHub profile if available
 * @param octokit GitHub API client
 * @param author Commit author
 * @param commitCount Number of commits by this author
 * @returns Contributor data
 */
async function getContributorData(
  octokit: ReturnType<typeof github.getOctokit>,
  author: CommitAuthor,
  commitCount: number
): Promise<ContributorData> {
  // If we have a username, try to fetch the GitHub profile
  if (author.username) {
    try {
      const { data: user } = await octokit.rest.users.getByUsername({
        username: author.username
      })

      return {
        username: author.username,
        name: user.name || author.name,
        email: author.email,
        profileUrl: user.html_url,
        avatarUrl: user.avatar_url,
        commitCount
      }
    } catch (error) {
      // Profile not found (404) or other error - fall back to commit metadata
      if (error && typeof error === 'object' && 'status' in error) {
        const status = error.status as number
        if (status === 404) {
          core.warning(
            `GitHub profile not found for @${author.username}, using commit metadata`
          )
        } else {
          core.warning(
            `Failed to fetch profile for @${author.username}: ${error instanceof Error ? error.message : String(error)}`
          )
        }
      }
    }
  }

  // Fallback: use commit metadata and construct profile URL
  const inferredUsername = author.username || author.email.split('@')[0]
  const profileUrl = `https://github.com/${inferredUsername}`

  core.warning(
    `Using fallback data for contributor: ${author.name} (${author.email})`
  )

  return {
    username: author.username,
    name: author.name,
    email: author.email,
    profileUrl,
    commitCount
  }
}
