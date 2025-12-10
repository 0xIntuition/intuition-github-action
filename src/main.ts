/**
 * Main entry point for the Intuition Contributor Attestation GitHub Action
 */

import * as core from '@actions/core'
import * as github from '@actions/github'
import { IntuitionClient } from './intuition/client.js'
import { validateAndParseInputs } from './services/validation.js'
import { fetchRepositoryData } from './github/repository.js'
import { fetchContributors } from './github/contributors.js'
import { processAttestations } from './services/attestation.js'
import { InvalidInputError } from './utils/errors.js'

/**
 * The main function for the action
 * @returns Resolves when the action is complete
 */
export async function run(): Promise<void> {
  try {
    // Verify we're in a pull_request event
    if (github.context.eventName !== 'pull_request') {
      throw new InvalidInputError(
        `This action must be triggered by a pull_request event (current event: ${github.context.eventName})`
      )
    }

    // Verify the PR is merged
    if (!github.context.payload.pull_request?.merged) {
      core.info(
        'Pull request is not merged yet. Skipping attestation creation.'
      )
      return
    }

    core.info('='.repeat(64))
    core.info('Intuition Contributor Attestation Action')
    core.info('='.repeat(64))

    // Step 1: Validate and parse inputs
    core.info('Validating inputs...')
    const config = validateAndParseInputs()

    core.info(`Network: ${config.network}`)
    core.info(`Failure mode: ${config.failureMode}`)
    core.info(`Retry attempts: ${config.retryAttempts}`)
    core.info('')

    // Step 2: Initialize Intuition Protocol client
    core.info('Initializing Intuition Protocol client...')
    const intuitionClient = await IntuitionClient.create(
      config.privateKey,
      config.network,
      config.minDepositAmount,
      config.retryAttempts,
      config.retryDelay
    )
    core.info('')

    // Step 3: Fetch repository metadata
    core.info('Fetching repository data...')
    const repository = await fetchRepositoryData(config.githubToken)
    core.info('')

    // Step 4: Fetch all commit authors from the merged PR
    core.info('Fetching contributors from merged PR...')
    const contributors = await fetchContributors(config.githubToken)

    if (contributors.length === 0) {
      core.warning('No contributors found in this PR. Nothing to attest.')
      return
    }
    core.info('')

    // Step 5: Process attestations
    const retryOptions = {
      maxAttempts: config.retryAttempts,
      delayMs: config.retryDelay
    }

    const summary = await processAttestations(
      intuitionClient,
      repository,
      contributors,
      config.failureMode,
      retryOptions
    )

    // Step 6: Set action outputs
    core.info('')
    core.info('='.repeat(64))
    core.info('Setting action outputs...')
    core.info('='.repeat(64))

    core.setOutput('project-atom-id', summary.projectAtomId)
    core.setOutput('contributor-count', summary.contributorCount.toString())
    core.setOutput(
      'attestations-created',
      summary.attestationsCreated.toString()
    )
    core.setOutput(
      'attestations-updated',
      summary.attestationsUpdated.toString()
    )
    core.setOutput(
      'transaction-hashes',
      JSON.stringify(summary.transactionHashes)
    )
    core.setOutput('total-cost', summary.totalCost.toString())

    // Step 7: Log comprehensive summary
    core.info('')
    logFinalSummary(repository.fullName, summary)

    // Check final balance
    const finalBalance = await intuitionClient.checkBalance()
    core.info('')
    core.info(
      `Final wallet balance: ${finalBalance} wei (${Number(finalBalance) / 1e18} tokens)`
    )

    core.info('')
    core.info('='.repeat(64))
    core.info('✓ Attestation action completed successfully')
    core.info('='.repeat(64))
  } catch (error) {
    // Fail the workflow run if an error occurs
    if (error instanceof Error) {
      core.setFailed(`Action failed: ${error.message}`)
      core.debug(`Error stack: ${error.stack}`)
    } else {
      core.setFailed(`Action failed: ${String(error)}`)
    }
  }
}

/**
 * Log a comprehensive final summary
 * @param repositoryName Repository name
 * @param summary Attestation summary
 */
function logFinalSummary(
  repositoryName: string,
  summary: {
    projectAtomId: string
    contributorCount: number
    attestationsCreated: number
    attestationsUpdated: number
    transactionHashes: string[]
    totalCost: bigint
    results: Array<{ success: boolean }>
  }
): void {
  const successCount = summary.results.filter((r) => r.success).length
  const failureCount = summary.results.filter((r) => !r.success).length

  core.info('='.repeat(64))
  core.info('Intuition Contributor Attestation Summary')
  core.info('='.repeat(64))
  core.info(`Repository: ${repositoryName}`)
  core.info(`Project Atom: ${summary.projectAtomId}`)
  core.info('')
  core.info('Contributors:')
  core.info(`  Total: ${summary.contributorCount}`)
  core.info(`  ✓ Successfully processed: ${successCount}`)
  if (failureCount > 0) {
    core.info(`  ✗ Failed: ${failureCount}`)
  }
  core.info('')
  core.info('Attestations:')
  core.info(`  ✓ Created: ${summary.attestationsCreated}`)
  core.info(`  ✓ Updated: ${summary.attestationsUpdated}`)
  core.info('')
  core.info('Transactions:')
  core.info(`  Count: ${summary.transactionHashes.length}`)
  if (summary.transactionHashes.length > 0) {
    for (const hash of summary.transactionHashes) {
      core.info(`    - ${hash}`)
    }
  }
  core.info('')
  core.info(
    `Total Cost: ${summary.totalCost} wei (${Number(summary.totalCost) / 1e18} tokens)`
  )
  core.info('='.repeat(64))
}
