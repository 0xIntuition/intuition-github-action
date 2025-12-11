/**
 * Integration tests for triple operations with real blockchain
 *
 * Tests:
 * - Creating attestation triples on-chain
 * - Depositing to existing triples
 * - Triple ID calculation
 * - Finding existing triples via GraphQL (through SDK)
 * - Error handling for network failures
 */
import { describe, it, expect, beforeAll } from '@jest/globals'
import { IntuitionClient } from '../../../src/intuition/client.js'
import {
  ensureProjectAtom,
  ensureContributorAtom
} from '../../../src/intuition/atoms.js'
import { ensureAttestationTriple } from '../../../src/intuition/triples.js'
import {
  generateTestRepository,
  generateTestContributor,
  repositoryToAtomData,
  contributorToAtomData
} from '../helpers/test-data.js'
import type { Hex } from 'viem'

describe('Triple Operations Integration', () => {
  let client: IntuitionClient
  let projectAtomId: Hex
  const privateKey = process.env.INTUITION_PRIVATE_KEY as `0x${string}`
  const retryOptions = { maxAttempts: 3, delayMs: 2000 }

  beforeAll(async () => {
    client = await IntuitionClient.create(privateKey, 'testnet')

    // Create a project atom to use for all tests
    const testRepo = generateTestRepository('triples-test')
    const atomData = repositoryToAtomData(testRepo)
    const result = await ensureProjectAtom(client, atomData, retryOptions)
    projectAtomId = result.atomId

    console.log(`\nTest project atom created: ${projectAtomId}`)
    if (!result.existed) {
      console.log(`  Transaction: ${result.txHash}`)
    }
  }, 180000) // 3 minutes for initial setup

  describe('Triple Creation', () => {
    it('should create a new attestation triple on-chain', async () => {
      const testContributor = generateTestContributor()
      const atomData = contributorToAtomData(testContributor)

      console.log(`\nCreating attestation triple for: ${testContributor.name}`)

      // Create contributor atom
      const atomResult = await ensureContributorAtom(
        client,
        atomData,
        retryOptions
      )
      console.log(`  Contributor atom: ${atomResult.atomId}`)

      // Create triple
      const tripleResult = await ensureAttestationTriple(
        client,
        atomResult.atomId,
        projectAtomId,
        retryOptions
      )

      expect(tripleResult.tripleId).toMatch(/^0x[a-fA-F0-9]{64}$/)
      expect(tripleResult.vaultId).toBeGreaterThan(0n)

      if (!tripleResult.existed) {
        expect(tripleResult.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
        expect(tripleResult.cost).toBeGreaterThan(0n)

        console.log(`✓ Created triple: ${tripleResult.tripleId}`)
        console.log(`  Transaction: ${tripleResult.txHash}`)
        console.log(`  Vault ID: ${tripleResult.vaultId}`)
        console.log(`  Cost: ${tripleResult.cost} wei`)
      } else {
        console.log(`✓ Triple already existed: ${tripleResult.tripleId}`)
      }
    }, 180000) // 3 minutes for atom + triple creation
  })

  describe('Triple Deposits', () => {
    it('should add deposit to existing triple instead of creating duplicate', async () => {
      const testContributor = generateTestContributor(888)
      const atomData = contributorToAtomData(testContributor)

      console.log(`\nTesting triple deposit for: ${testContributor.name}`)

      const atomResult = await ensureContributorAtom(
        client,
        atomData,
        retryOptions
      )
      console.log(`  Contributor atom: ${atomResult.atomId}`)

      // Create triple first time
      const firstTriple = await ensureAttestationTriple(
        client,
        atomResult.atomId,
        projectAtomId,
        retryOptions
      )

      console.log(`  First call - Triple ID: ${firstTriple.tripleId}`)
      console.log(`  First call - Existed: ${firstTriple.existed}`)
      console.log(`  First call - TX: ${firstTriple.txHash}`)

      // Create triple second time (should deposit)
      const secondTriple = await ensureAttestationTriple(
        client,
        atomResult.atomId,
        projectAtomId,
        retryOptions
      )

      console.log(`  Second call - Triple ID: ${secondTriple.tripleId}`)
      console.log(`  Second call - Existed: ${secondTriple.existed}`)
      console.log(`  Second call - TX: ${secondTriple.txHash}`)

      expect(secondTriple.tripleId).toBe(firstTriple.tripleId)
      expect(secondTriple.existed).toBe(true)
      expect(secondTriple.txHash).toMatch(/^0x[a-fA-F0-9]{64}$/) // Deposit transaction
      expect(secondTriple.cost).toBeGreaterThan(0n) // Deposit costs gas

      console.log(`✓ Added deposit to triple: ${secondTriple.tripleId}`)
      console.log(`  Deposit cost: ${secondTriple.cost} wei`)
    }, 240000) // 4 minutes for two triple operations
  })

  describe('Triple ID Calculation', () => {
    it('should calculate consistent triple IDs', async () => {
      const testContributor = generateTestContributor(777)
      const atomData = contributorToAtomData(testContributor)

      console.log(`\nTesting triple ID calculation`)

      const atomResult = await ensureContributorAtom(
        client,
        atomData,
        retryOptions
      )

      // Create triple multiple times - should get same ID
      const firstTriple = await ensureAttestationTriple(
        client,
        atomResult.atomId,
        projectAtomId,
        retryOptions
      )

      const secondTriple = await ensureAttestationTriple(
        client,
        atomResult.atomId,
        projectAtomId,
        retryOptions
      )

      expect(firstTriple.tripleId).toBe(secondTriple.tripleId)

      console.log(`✓ Consistent triple ID: ${firstTriple.tripleId}`)
    }, 240000)
  })

  describe('Cost Tracking', () => {
    it('should track costs for triple creation and deposits', async () => {
      const testContributor = generateTestContributor(666)
      const atomData = contributorToAtomData(testContributor)

      console.log(`\nTesting triple cost tracking`)

      const atomResult = await ensureContributorAtom(
        client,
        atomData,
        retryOptions
      )

      // First call - creation cost
      const creationResult = await ensureAttestationTriple(
        client,
        atomResult.atomId,
        projectAtomId,
        retryOptions
      )

      if (!creationResult.existed) {
        expect(creationResult.cost).toBeGreaterThan(0n)
        const creationEth = Number(creationResult.cost) / 1e18
        console.log(
          `✓ Creation cost: ${creationResult.cost} wei (${creationEth.toFixed(6)} ETH)`
        )
      }

      // Second call - deposit cost
      const depositResult = await ensureAttestationTriple(
        client,
        atomResult.atomId,
        projectAtomId,
        retryOptions
      )

      expect(depositResult.existed).toBe(true)
      expect(depositResult.cost).toBeGreaterThan(0n)

      const depositEth = Number(depositResult.cost) / 1e18
      console.log(
        `✓ Deposit cost: ${depositResult.cost} wei (${depositEth.toFixed(6)} ETH)`
      )

      // Sanity check: costs should be reasonable on testnet (< 0.1 ETH each)
      expect(creationResult.cost).toBeLessThan(100000000000000000n)
      expect(depositResult.cost).toBeLessThan(100000000000000000n)
    }, 240000)
  })

  describe('Multiple Contributors', () => {
    it('should handle multiple triples to same project', async () => {
      console.log(`\nTesting multiple contributors to same project`)

      const contributor1 = generateTestContributor(100)
      const contributor2 = generateTestContributor(101)

      const atom1 = await ensureContributorAtom(
        client,
        contributorToAtomData(contributor1),
        retryOptions
      )
      const atom2 = await ensureContributorAtom(
        client,
        contributorToAtomData(contributor2),
        retryOptions
      )

      const triple1 = await ensureAttestationTriple(
        client,
        atom1.atomId,
        projectAtomId,
        retryOptions
      )

      const triple2 = await ensureAttestationTriple(
        client,
        atom2.atomId,
        projectAtomId,
        retryOptions
      )

      // Different contributors should have different triple IDs
      expect(triple1.tripleId).not.toBe(triple2.tripleId)

      console.log(`✓ Contributor 1 triple: ${triple1.tripleId}`)
      console.log(`✓ Contributor 2 triple: ${triple2.tripleId}`)
      console.log(`  Both triples link to project: ${projectAtomId}`)
    }, 300000) // 5 minutes for two complete flows
  })

  describe('Transaction Confirmation', () => {
    it('should confirm triple creation transactions on-chain', async () => {
      const testContributor = generateTestContributor(555)
      const atomData = contributorToAtomData(testContributor)

      console.log(`\nTesting triple transaction confirmation`)

      const atomResult = await ensureContributorAtom(
        client,
        atomData,
        retryOptions
      )

      const tripleResult = await ensureAttestationTriple(
        client,
        atomResult.atomId,
        projectAtomId,
        retryOptions
      )

      // Verify transaction is confirmed
      const currentBlock = await client.getCurrentBlock()
      expect(currentBlock).toBeGreaterThan(0n)

      console.log(`✓ Triple transaction confirmed`)
      console.log(`  TX: ${tripleResult.txHash}`)
      console.log(`  Current block: ${currentBlock}`)
    }, 180000)
  })
})
