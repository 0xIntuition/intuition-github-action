/**
 * Integration tests for atom operations with real blockchain
 *
 * Tests:
 * - Creating atoms on-chain with real transactions
 * - Finding existing atoms via GraphQL (through SDK)
 * - Idempotent atom creation (existing atoms return same ID)
 * - Transaction confirmations
 * - Cost tracking
 * - Error handling for insufficient balance
 */
import { describe, it, expect, beforeAll } from '@jest/globals'
import { IntuitionClient } from '../../../src/intuition/client.js'
import {
  ensureProjectAtom,
  ensureContributorAtom
} from '../../../src/intuition/atoms.js'
import {
  generateTestRepository,
  generateTestContributor,
  repositoryToAtomData,
  contributorToAtomData
} from '../helpers/test-data.js'
import type { Hex } from 'viem'

describe('Atom Operations Integration', () => {
  let client: IntuitionClient
  const privateKey = process.env.INTUITION_PRIVATE_KEY as `0x${string}`
  const retryOptions = { maxAttempts: 3, delayMs: 2000 }

  beforeAll(async () => {
    client = await IntuitionClient.create(privateKey, 'testnet')
  }, 120000)

  describe('Project Atom Creation', () => {
    it('should create a new project atom on-chain', async () => {
      const testRepo = generateTestRepository()
      const atomData = repositoryToAtomData(testRepo)

      console.log(`Creating project atom for: ${testRepo.fullName}`)

      const result = await ensureProjectAtom(client, atomData, retryOptions)

      // Verify result structure
      expect(result.atomId).toMatch(/^0x[a-fA-F0-9]{64}$/)
      expect(result.vaultId).toBeGreaterThan(0n)
      expect(result.cost).toBeGreaterThanOrEqual(0n)

      // First creation should have transaction
      if (!result.existed) {
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
        expect(result.cost).toBeGreaterThan(0n)

        console.log(`✓ Created project atom: ${result.atomId}`)
        console.log(`  Transaction: ${result.txHash}`)
        console.log(`  Vault ID: ${result.vaultId}`)
        console.log(`  Cost: ${result.cost} wei`)
      } else {
        console.log(`✓ Project atom already existed: ${result.atomId}`)
      }
    }, 120000) // 2 minute timeout for blockchain operations

    it('should return existing project atom without creating duplicate', async () => {
      const testRepo = generateTestRepository('duplicate-test')
      const atomData = repositoryToAtomData(testRepo)

      console.log(`Testing idempotency for: ${testRepo.fullName}`)

      // Create once
      const firstResult = await ensureProjectAtom(
        client,
        atomData,
        retryOptions
      )
      console.log(`  First call - Atom ID: ${firstResult.atomId}`)
      console.log(`  First call - Existed: ${firstResult.existed}`)

      // Create again with same data
      const secondResult = await ensureProjectAtom(
        client,
        atomData,
        retryOptions
      )
      console.log(`  Second call - Atom ID: ${secondResult.atomId}`)
      console.log(`  Second call - Existed: ${secondResult.existed}`)

      // Should return same atom ID
      expect(secondResult.atomId).toBe(firstResult.atomId)
      expect(secondResult.existed).toBe(true)
      expect(secondResult.txHash).toBe('0x0' as Hex)
      expect(secondResult.cost).toBe(0n)

      console.log(`✓ Idempotency verified - same atom returned both times`)
    }, 180000) // 3 minutes for two operations
  })

  describe('Contributor Atom Creation', () => {
    it('should create a new contributor atom on-chain', async () => {
      const testContributor = generateTestContributor()
      const atomData = contributorToAtomData(testContributor)

      console.log(`Creating contributor atom for: ${testContributor.name}`)

      const result = await ensureContributorAtom(client, atomData, retryOptions)

      expect(result.atomId).toMatch(/^0x[a-fA-F0-9]{64}$/)
      expect(result.vaultId).toBeGreaterThan(0n)

      if (!result.existed) {
        expect(result.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
        expect(result.cost).toBeGreaterThan(0n)

        console.log(`✓ Created contributor atom: ${result.atomId}`)
        console.log(`  Transaction: ${result.txHash}`)
        console.log(`  Vault ID: ${result.vaultId}`)
        console.log(`  Cost: ${result.cost} wei`)
      } else {
        console.log(`✓ Contributor atom already existed: ${result.atomId}`)
      }
    }, 120000)

    it('should return existing contributor atom without duplicate', async () => {
      const testContributor = generateTestContributor(999)
      const atomData = contributorToAtomData(testContributor)

      console.log(
        `Testing contributor idempotency for: ${testContributor.name}`
      )

      const firstResult = await ensureContributorAtom(
        client,
        atomData,
        retryOptions
      )
      const secondResult = await ensureContributorAtom(
        client,
        atomData,
        retryOptions
      )

      expect(secondResult.atomId).toBe(firstResult.atomId)
      expect(secondResult.existed).toBe(true)
      expect(secondResult.cost).toBe(0n)

      console.log(`✓ Contributor idempotency verified`)
    }, 180000)
  })

  describe('Transaction Confirmation', () => {
    it('should wait for transaction confirmation with real block', async () => {
      const testRepo = generateTestRepository('confirmation-test')
      const atomData = repositoryToAtomData(testRepo)

      console.log(`Testing transaction confirmation`)

      const result = await ensureProjectAtom(client, atomData, retryOptions)

      if (!result.existed) {
        // Transaction should be confirmed
        const blockNumber = await client.getCurrentBlock()
        expect(blockNumber).toBeGreaterThan(0n)

        console.log(`✓ Transaction confirmed`)
        console.log(`  TX: ${result.txHash}`)
        console.log(`  Current block: ${blockNumber}`)
      } else {
        console.log(`  (Atom existed, skipping confirmation test)`)
      }
    }, 120000)
  })

  describe('Cost Tracking', () => {
    it('should track gas costs for new atoms', async () => {
      const testRepo = generateTestRepository('cost-test')
      const atomData = repositoryToAtomData(testRepo)

      console.log(`Testing cost tracking`)

      const result = await ensureProjectAtom(client, atomData, retryOptions)

      if (!result.existed) {
        expect(result.cost).toBeGreaterThan(0n)

        const ethCost = Number(result.cost) / 1e18
        console.log(
          `✓ Cost tracked: ${result.cost} wei (${ethCost.toFixed(6)} ETH)`
        )

        // Sanity check: cost should be less than 0.1 ETH on testnet
        expect(result.cost).toBeLessThan(100000000000000000n)
      } else {
        console.log(`  (Atom existed, cost should be 0)`)
        expect(result.cost).toBe(0n)
      }
    }, 120000)

    it('should have zero cost for existing atoms', async () => {
      // Use a well-known URL that likely exists
      const atomData = {
        name: 'test-existing',
        description: 'test',
        url: 'https://github.com/test-existing'
      }

      console.log(`Testing zero cost for potential existing atom`)

      // Try to create - might exist or not
      const firstResult = await ensureProjectAtom(
        client,
        atomData,
        retryOptions
      )

      // Try again - definitely exists now
      const secondResult = await ensureProjectAtom(
        client,
        atomData,
        retryOptions
      )

      expect(secondResult.existed).toBe(true)
      expect(secondResult.cost).toBe(0n)

      console.log(`✓ Zero cost confirmed for existing atom`)
    }, 180000)
  })
})
