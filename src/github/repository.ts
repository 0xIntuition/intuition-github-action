/**
 * Repository data fetching from GitHub
 */

import * as core from '@actions/core'
import * as github from '@actions/github'
import { GitHubAPIError } from '../utils/errors.js'
import type { RepositoryData } from './types.js'

/**
 * Fetch repository metadata from GitHub
 * @param githubToken GitHub API token
 * @returns Repository data
 */
export async function fetchRepositoryData(
  githubToken: string
): Promise<RepositoryData> {
  const octokit = github.getOctokit(githubToken)
  const context = github.context

  try {
    core.info(
      `Fetching repository data for: ${context.repo.owner}/${context.repo.repo}`
    )

    const { data: repo } = await octokit.rest.repos.get({
      owner: context.repo.owner,
      repo: context.repo.repo
    })

    const repositoryData: RepositoryData = {
      name: repo.name,
      fullName: repo.full_name,
      description: repo.description || `Repository: ${repo.name}`,
      url: repo.html_url,
      owner: repo.owner.login
    }

    core.info(`Repository: ${repositoryData.fullName}`)
    core.debug(`Description: ${repositoryData.description}`)
    core.debug(`URL: ${repositoryData.url}`)

    return repositoryData
  } catch (error) {
    if (error && typeof error === 'object' && 'status' in error) {
      throw new GitHubAPIError(
        `Failed to fetch repository data: ${error instanceof Error ? error.message : String(error)}`,
        error.status as number
      )
    }
    throw new GitHubAPIError(
      `Failed to fetch repository data: ${error instanceof Error ? error.message : String(error)}`
    )
  }
}
