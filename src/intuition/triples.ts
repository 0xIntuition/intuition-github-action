/**
 * Triple creation and deposit management
 */

import * as core from '@actions/core'
import type { Hex } from 'viem'
import {
  calculateTripleId,
  createTripleStatement,
  deposit,
  findTripleIds
} from '@0xintuition/sdk'
import type { IntuitionClient } from './client.js'
import type { TripleCreationResult } from './types.js'
import { TransactionFailedError } from '../utils/errors.js'
import { withRetry, type RetryOptions } from '../utils/retry.js'
import { WAS_ASSOCIATED_WITH_PREDICATE_ID } from '../config/constants.js'

/**
 * Ensure an attestation triple exists (contributor -> project relationship)
 * Creates the triple if it doesn't exist, or adds a deposit if it does
 * @param client Intuition client
 * @param contributorAtomId Contributor atom ID
 * @param projectAtomId Project atom ID
 * @param retryOptions Retry configuration
 * @returns Triple creation/deposit result
 */
export async function ensureAttestationTriple(
  client: IntuitionClient,
  contributorAtomId: Hex,
  projectAtomId: Hex,
  retryOptions: RetryOptions
): Promise<TripleCreationResult> {
  return await withRetry(async () => {
    // Calculate triple ID
    const tripleId = calculateTripleId(
      contributorAtomId,
      WAS_ASSOCIATED_WITH_PREDICATE_ID,
      projectAtomId
    )

    core.debug(
      `Calculated triple ID: ${tripleId} (${contributorAtomId} -> ${projectAtomId})`
    )

    // Check if triple already exists
    let tripleExists = false
    try {
      const existingTriples = await findTripleIds(client.getAddress(), [
        [contributorAtomId, WAS_ASSOCIATED_WITH_PREDICATE_ID, projectAtomId]
      ])

      if (existingTriples.length > 0 && existingTriples[0].term_id) {
        tripleExists = true
        core.info(`Triple already exists: ${tripleId}`)
      }
    } catch (error) {
      core.warning(
        `Failed to check triple existence, will attempt creation: ${error instanceof Error ? error.message : String(error)}`
      )
    }

    const minDeposit = client.getMinDeposit()
    await client.ensureSufficientBalance(minDeposit)

    if (tripleExists) {
      // Add deposit to existing triple
      core.info(`Adding deposit to existing triple: ${tripleId}`)

      try {
        const result = await deposit(
          {
            address: client.getAddress(),
            walletClient: client.getWalletClient(),
            publicClient: client.getPublicClient()
          },
          {
            args: [client.getAddress(), tripleId, 0n, minDeposit, 0n] as const,
            value: minDeposit
          }
        )

        core.debug(`Deposit transaction submitted: ${result.transactionHash}`)

        // Wait for confirmation
        const txResult = await client.waitForConfirmation(
          result.transactionHash
        )

        core.info(`Deposit added to triple: ${tripleId}`)

        return {
          tripleId,
          vaultId: BigInt(tripleId),
          txHash: txResult.hash,
          cost: minDeposit,
          existed: true
        }
      } catch (error) {
        throw new TransactionFailedError(
          `Failed to deposit to triple: ${error instanceof Error ? error.message : String(error)}`,
          undefined
        )
      }
    } else {
      // Create new triple
      core.info(`Creating new attestation triple: ${tripleId}`)

      try {
        const result = await createTripleStatement(
          {
            address: client.getAddress(),
            walletClient: client.getWalletClient(),
            publicClient: client.getPublicClient()
          },
          {
            args: [
              [contributorAtomId],
              [WAS_ASSOCIATED_WITH_PREDICATE_ID],
              [projectAtomId],
              [minDeposit]
            ],
            value: minDeposit
          }
        )

        core.debug(
          `Triple creation transaction submitted: ${result.transactionHash}`
        )

        // Wait for confirmation
        const txResult = await client.waitForConfirmation(
          result.transactionHash
        )

        core.info(`Attestation triple created: ${tripleId}`)

        return {
          tripleId,
          vaultId: BigInt(tripleId),
          txHash: txResult.hash,
          cost: minDeposit,
          existed: false
        }
      } catch (error) {
        throw new TransactionFailedError(
          `Failed to create triple: ${error instanceof Error ? error.message : String(error)}`,
          undefined
        )
      }
    }
  }, retryOptions)
}

/**
 * Batch create attestation triples
 * @param client Intuition client
 * @param contributorAtomIds Array of contributor atom IDs
 * @param projectAtomId Project atom ID
 * @param retryOptions Retry configuration
 * @returns Array of triple creation results
 */
export async function batchCreateAttestationTriples(
  client: IntuitionClient,
  contributorAtomIds: Hex[],
  projectAtomId: Hex,
  retryOptions: RetryOptions
): Promise<TripleCreationResult[]> {
  core.info(`Creating ${contributorAtomIds.length} attestation triples`)

  const results: TripleCreationResult[] = []

  // Process individually with error handling
  for (const contributorAtomId of contributorAtomIds) {
    try {
      const result = await ensureAttestationTriple(
        client,
        contributorAtomId,
        projectAtomId,
        retryOptions
      )
      results.push(result)
    } catch (error) {
      core.error(
        `Failed to create triple for contributor ${contributorAtomId}: ${error instanceof Error ? error.message : String(error)}`
      )
      // Continue with other contributors
    }
  }

  return results
}
