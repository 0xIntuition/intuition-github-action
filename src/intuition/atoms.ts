/**
 * Atom creation and existence checking
 */

import * as core from '@actions/core'
import type { Hex } from 'viem'
import { createAtomFromThing, findAtomIds } from '@0xintuition/sdk'
import type { IntuitionClient } from './client.js'
import type { AtomCreationResult, ThingAtomData } from './types.js'
import { TransactionFailedError } from '../utils/errors.js'
import { withRetry, type RetryOptions } from '../utils/retry.js'

/**
 * Ensure a project atom exists, creating it if necessary
 * @param client Intuition client
 * @param atomData Thing data for the atom
 * @param retryOptions Retry configuration
 * @returns Atom creation result
 */
export async function ensureProjectAtom(
  client: IntuitionClient,
  atomData: ThingAtomData,
  retryOptions: RetryOptions
): Promise<AtomCreationResult> {
  return await withRetry(async () => {
    core.info(`Checking if project atom exists for: ${atomData.name}`)

    // Check if atom already exists first
    try {
      const existingAtoms = await findAtomIds([atomData.url])
      if (existingAtoms.length > 0 && existingAtoms[0].term_id) {
        const atomId = existingAtoms[0].term_id as Hex
        core.info(`Project atom already exists with ID: ${atomId}`)
        return {
          atomId,
          vaultId: BigInt(atomId),
          txHash: '0x0' as Hex,
          cost: 0n,
          existed: true
        }
      }
    } catch (error) {
      core.warning(
        `Failed to check atom existence, will attempt creation: ${error instanceof Error ? error.message : String(error)}`
      )
    }

    // Create atom if it doesn't exist
    core.info(`Creating project atom: ${atomData.name}`)

    try {
      const minDeposit = client.getMinDeposit()
      await client.ensureSufficientBalance(minDeposit)

      const result = await createAtomFromThing(
        {
          address: client.getAddress(),
          walletClient: client.getWalletClient(),
          publicClient: client.getPublicClient()
        },
        {
          name: atomData.name,
          description: atomData.description,
          url: atomData.url,
          image: atomData.image
        },
        minDeposit
      )

      core.debug(
        `Atom creation transaction submitted: ${result.transactionHash}`
      )

      // Wait for confirmation
      const txResult = await client.waitForConfirmation(result.transactionHash)

      const atomId = result.state.termId
      core.info(`Project atom created successfully: ${atomId}`)

      return {
        atomId,
        vaultId: BigInt(atomId),
        txHash: txResult.hash,
        cost: minDeposit,
        existed: false
      }
    } catch (error) {
      throw new TransactionFailedError(
        `Failed to create project atom: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }, retryOptions)
}

/**
 * Ensure a contributor atom exists, creating it if necessary
 * @param client Intuition client
 * @param atomData Thing data for the contributor
 * @param retryOptions Retry configuration
 * @returns Atom creation result
 */
export async function ensureContributorAtom(
  client: IntuitionClient,
  atomData: ThingAtomData,
  retryOptions: RetryOptions
): Promise<AtomCreationResult> {
  return await withRetry(async () => {
    core.info(`Checking if contributor atom exists for: ${atomData.name}`)

    // Check if atom already exists first
    try {
      const existingAtoms = await findAtomIds([atomData.url])
      if (existingAtoms.length > 0 && existingAtoms[0].term_id) {
        const atomId = existingAtoms[0].term_id as Hex
        core.info(
          `Contributor atom already exists: ${atomData.name} (${atomId})`
        )
        return {
          atomId,
          vaultId: BigInt(atomId),
          txHash: '0x0' as Hex,
          cost: 0n,
          existed: true
        }
      }
    } catch (error) {
      core.warning(
        `Failed to check contributor atom existence, will attempt creation: ${error instanceof Error ? error.message : String(error)}`
      )
    }

    // Create atom if it doesn't exist
    core.info(`Creating contributor atom: ${atomData.name}`)

    try {
      const minDeposit = client.getMinDeposit()
      await client.ensureSufficientBalance(minDeposit)

      const result = await createAtomFromThing(
        {
          address: client.getAddress(),
          walletClient: client.getWalletClient(),
          publicClient: client.getPublicClient()
        },
        {
          name: atomData.name,
          description: atomData.description,
          url: atomData.url,
          image: atomData.image
        },
        minDeposit
      )

      core.debug(
        `Contributor atom creation transaction submitted: ${result.transactionHash}`
      )

      // Wait for confirmation
      const txResult = await client.waitForConfirmation(result.transactionHash)

      const atomId = result.state.termId
      core.info(`Contributor atom created: ${atomData.name} (${atomId})`)

      return {
        atomId,
        vaultId: BigInt(atomId),
        txHash: txResult.hash,
        cost: minDeposit,
        existed: false
      }
    } catch (error) {
      throw new TransactionFailedError(
        `Failed to create contributor atom: ${error instanceof Error ? error.message : String(error)}`
      )
    }
  }, retryOptions)
}

/**
 * Batch create contributor atoms
 * @param client Intuition client
 * @param atomsData Array of Thing data for contributors
 * @param retryOptions Retry configuration
 * @returns Array of atom creation results
 */
export async function batchCreateContributorAtoms(
  client: IntuitionClient,
  atomsData: ThingAtomData[],
  retryOptions: RetryOptions
): Promise<AtomCreationResult[]> {
  core.info(`Attempting to batch create ${atomsData.length} contributor atoms`)

  // Try batch creation first
  try {
    const results: AtomCreationResult[] = []

    // Process in batches to avoid gas limits
    const batchSize = 10
    for (let i = 0; i < atomsData.length; i += batchSize) {
      const batch = atomsData.slice(
        i,
        Math.min(i + batchSize, atomsData.length)
      )

      // Create atoms individually for now (SDK batch functions may need specific format)
      for (const atomData of batch) {
        const result = await ensureContributorAtom(
          client,
          atomData,
          retryOptions
        )
        results.push(result)
      }
    }

    return results
  } catch (error) {
    core.warning(
      `Batch atom creation failed: ${error instanceof Error ? error.message : String(error)}`
    )
    throw error
  }
}
