/**
 * Main attestation orchestration logic
 */

import * as core from '@actions/core'
import type { Hex } from 'viem'
import type { IntuitionClient } from '../intuition/client.js'
import type {
  AtomCreationResult,
  TripleCreationResult
} from '../intuition/types.js'
import type { ContributorData, RepositoryData } from '../github/types.js'
import { ensureProjectAtom, ensureContributorAtom } from '../intuition/atoms.js'
import { ensureAttestationTriple } from '../intuition/triples.js'
import { ActionError } from '../utils/errors.js'
import type { RetryOptions } from '../utils/retry.js'

/**
 * Result of processing a single contributor
 */
export interface ContributorProcessingResult {
  contributor: ContributorData
  atomResult?: AtomCreationResult
  tripleResult?: TripleCreationResult
  success: boolean
  error?: string
}

/**
 * Summary of attestation processing
 */
export interface AttestationSummary {
  projectAtomId: Hex
  projectAtomTxHash?: Hex
  contributorCount: number
  attestationsCreated: number
  attestationsUpdated: number
  transactionHashes: Hex[]
  totalCost: bigint
  results: ContributorProcessingResult[]
}

/**
 * Process all contributors and create attestations
 * @param client Intuition client
 * @param repository Repository data
 * @param contributors Array of contributors
 * @param failureMode How to handle errors ('fail' or 'warn')
 * @param retryOptions Retry configuration
 * @returns Attestation summary
 */
export async function processAttestations(
  client: IntuitionClient,
  repository: RepositoryData,
  contributors: ContributorData[],
  failureMode: 'fail' | 'warn',
  retryOptions: RetryOptions
): Promise<AttestationSummary> {
  const summary: AttestationSummary = {
    projectAtomId: '0x0' as Hex,
    contributorCount: contributors.length,
    attestationsCreated: 0,
    attestationsUpdated: 0,
    transactionHashes: [],
    totalCost: 0n,
    results: []
  }

  try {
    // Step 1: Ensure project atom exists
    core.info('='.repeat(64))
    core.info('Step 1: Creating/verifying project atom')
    core.info('='.repeat(64))

    const projectAtomResult = await ensureProjectAtom(
      client,
      {
        name: repository.fullName,
        description: repository.description,
        url: repository.url
      },
      retryOptions
    )

    summary.projectAtomId = projectAtomResult.atomId

    if (projectAtomResult.txHash !== '0x0') {
      summary.transactionHashes.push(projectAtomResult.txHash)
      summary.projectAtomTxHash = projectAtomResult.txHash
    }
    summary.totalCost += projectAtomResult.cost

    if (projectAtomResult.existed) {
      core.info(`✓ Project atom (existing): ${projectAtomResult.atomId}`)
    } else {
      core.info(`✓ Project atom (created): ${projectAtomResult.atomId}`)
      core.info(`  Transaction: ${projectAtomResult.txHash}`)
      core.info(`  Cost: ${projectAtomResult.cost} wei`)
    }

    // Step 2: Process each contributor
    core.info('')
    core.info('='.repeat(64))
    core.info(`Step 2: Processing ${contributors.length} contributor(s)`)
    core.info('='.repeat(64))

    for (const contributor of contributors) {
      const result = await processContributor(
        client,
        contributor,
        projectAtomResult.atomId,
        failureMode,
        retryOptions
      )

      summary.results.push(result)

      if (result.success) {
        // Add transaction hashes
        if (result.atomResult?.txHash && result.atomResult.txHash !== '0x0') {
          summary.transactionHashes.push(result.atomResult.txHash)
        }
        if (
          result.tripleResult?.txHash &&
          result.tripleResult.txHash !== '0x0'
        ) {
          summary.transactionHashes.push(result.tripleResult.txHash)
        }

        // Add costs
        summary.totalCost +=
          (result.atomResult?.cost || 0n) + (result.tripleResult?.cost || 0n)

        // Count attestations
        if (result.tripleResult?.existed) {
          summary.attestationsUpdated++
        } else {
          summary.attestationsCreated++
        }
      }
    }

    return summary
  } catch (error) {
    if (error instanceof ActionError) {
      throw error
    }
    throw new ActionError(
      `Failed to process attestations: ${error instanceof Error ? error.message : String(error)}`,
      false
    )
  }
}

/**
 * Process a single contributor
 * @param client Intuition client
 * @param contributor Contributor data
 * @param projectAtomId Project atom ID
 * @param failureMode How to handle errors
 * @param retryOptions Retry configuration
 * @returns Processing result
 */
async function processContributor(
  client: IntuitionClient,
  contributor: ContributorData,
  projectAtomId: Hex,
  failureMode: 'fail' | 'warn',
  retryOptions: RetryOptions
): Promise<ContributorProcessingResult> {
  const displayName = contributor.username
    ? `@${contributor.username}`
    : contributor.name

  core.info('')
  core.info(`Processing contributor: ${displayName}`)

  try {
    // Create/verify contributor atom
    const atomResult = await ensureContributorAtom(
      client,
      {
        name: contributor.name,
        description: `Contributor: ${contributor.username || contributor.email}`,
        url: contributor.profileUrl,
        image: contributor.avatarUrl
      },
      retryOptions
    )

    if (atomResult.existed) {
      core.info(`  ✓ Contributor atom (existing): ${atomResult.atomId}`)
    } else {
      core.info(`  ✓ Contributor atom (created): ${atomResult.atomId}`)
      core.info(`    Transaction: ${atomResult.txHash}`)
      core.info(`    Cost: ${atomResult.cost} wei`)
    }

    // Create/update attestation triple
    const tripleResult = await ensureAttestationTriple(
      client,
      atomResult.atomId,
      projectAtomId,
      retryOptions
    )

    if (tripleResult.existed) {
      core.info(`  ✓ Attestation (deposit added): ${tripleResult.tripleId}`)
    } else {
      core.info(`  ✓ Attestation (created): ${tripleResult.tripleId}`)
    }
    core.info(`    Transaction: ${tripleResult.txHash}`)
    core.info(`    Cost: ${tripleResult.cost} wei`)

    return {
      contributor,
      atomResult,
      tripleResult,
      success: true
    }
  } catch (error) {
    const errorMessage = error instanceof Error ? error.message : String(error)

    if (failureMode === 'fail') {
      core.error(
        `  ✗ Failed to process contributor ${displayName}: ${errorMessage}`
      )
      throw error
    } else {
      core.warning(
        `  ✗ Failed to process contributor ${displayName}: ${errorMessage}`
      )
      return {
        contributor,
        success: false,
        error: errorMessage
      }
    }
  }
}
