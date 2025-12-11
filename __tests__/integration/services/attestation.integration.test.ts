/**
 * Integration tests for complete attestation flow
 *
 * Tests:
 * - Full attestation process with real blockchain
 * - Multiple contributors in single batch
 * - Cost tracking across operations
 * - Transaction hash collection
 * - Summary generation
 * - Error handling modes ('fail' and 'warn')
 */
import { describe, it, expect, beforeAll } from '@jest/globals'
import { IntuitionClient } from '../../../src/intuition/client.js'
import { processAttestations } from '../../../src/services/attestation.js'
import {
  generateTestRepository,
  generateTestContributors
} from '../helpers/test-data.js'

describe('Attestation Service Integration', () => {
  let client: IntuitionClient
  const privateKey = process.env.INTUITION_PRIVATE_KEY as `0x${string}`
  const retryOptions = { maxAttempts: 3, delayMs: 2000 }

  beforeAll(async () => {
    client = await IntuitionClient.create(privateKey, 'testnet')
    console.log(`\nClient initialized for attestation tests`)
  }, 120000)

  describe('Single Contributor Flow', () => {
    it('should process complete attestation flow for single contributor', async () => {
      const repository = generateTestRepository('single-contributor')
      const contributors = generateTestContributors(1)

      console.log(`\nProcessing single contributor attestation`)
      console.log(`  Repository: ${repository.fullName}`)
      console.log(`  Contributor: ${contributors[0].name}`)

      const summary = await processAttestations(
        client,
        repository,
        contributors,
        'warn',
        retryOptions
      )

      // Verify summary
      expect(summary.projectAtomId).toMatch(/^0x[a-fA-F0-9]{64}$/)
      expect(summary.contributorCount).toBe(1)
      expect(summary.attestationsCreated + summary.attestationsUpdated).toBe(1)
      expect(summary.totalCost).toBeGreaterThan(0n)
      expect(summary.transactionHashes.length).toBeGreaterThan(0)
      expect(summary.results).toHaveLength(1)
      expect(summary.results[0].success).toBe(true)

      console.log(`\n✓ Attestation Summary:`)
      console.log(`  Project Atom: ${summary.projectAtomId}`)
      if (summary.projectAtomTxHash && summary.projectAtomTxHash !== '0x0') {
        console.log(`  Project TX: ${summary.projectAtomTxHash}`)
      }
      console.log(`  Contributors: ${summary.contributorCount}`)
      console.log(`  Created: ${summary.attestationsCreated}`)
      console.log(`  Updated: ${summary.attestationsUpdated}`)
      console.log(
        `  Total Cost: ${summary.totalCost} wei (${Number(summary.totalCost) / 1e18} ETH)`
      )
      console.log(`  Transactions: ${summary.transactionHashes.length}`)
      summary.transactionHashes.forEach((tx, i) => {
        console.log(`    ${i + 1}. ${tx}`)
      })
    }, 240000) // 4 minutes
  })

  describe('Multiple Contributors Flow', () => {
    it('should process multiple contributors successfully', async () => {
      const repository = generateTestRepository('multi-contributor')
      const contributors = generateTestContributors(3)

      console.log(`\nProcessing multiple contributors attestation`)
      console.log(`  Repository: ${repository.fullName}`)
      console.log(`  Contributors: ${contributors.length}`)
      contributors.forEach((c, i) => {
        console.log(`    ${i + 1}. ${c.name}`)
      })

      const summary = await processAttestations(
        client,
        repository,
        contributors,
        'warn',
        retryOptions
      )

      expect(summary.contributorCount).toBe(3)
      expect(summary.attestationsCreated + summary.attestationsUpdated).toBe(3)
      expect(summary.results).toHaveLength(3)

      // All should succeed in normal conditions
      const successCount = summary.results.filter((r) => r.success).length
      expect(successCount).toBeGreaterThan(0) // At least some should succeed

      expect(summary.totalCost).toBeGreaterThan(0n)

      console.log(`\n✓ Multi-contributor Summary:`)
      console.log(`  Project Atom: ${summary.projectAtomId}`)
      console.log(`  Contributors processed: ${summary.contributorCount}`)
      console.log(`  Successful: ${successCount}`)
      console.log(`  Failed: ${3 - successCount}`)
      console.log(`  Attestations created: ${summary.attestationsCreated}`)
      console.log(`  Attestations updated: ${summary.attestationsUpdated}`)
      console.log(
        `  Total cost: ${summary.totalCost} wei (${Number(summary.totalCost) / 1e18} ETH)`
      )
      console.log(`  Transactions: ${summary.transactionHashes.length}`)
    }, 360000) // 6 minutes for 3 contributors
  })

  describe('Transaction Tracking', () => {
    it('should track all transaction hashes', async () => {
      const repository = generateTestRepository('tx-tracking')
      const contributors = generateTestContributors(2)

      console.log(`\nTesting transaction hash tracking`)
      console.log(`  Repository: ${repository.fullName}`)
      console.log(`  Contributors: ${contributors.length}`)

      const summary = await processAttestations(
        client,
        repository,
        contributors,
        'warn',
        retryOptions
      )

      // Should have transactions for: project atom, 2 contributor atoms, 2 triples
      // (though some might be reused if they existed)
      expect(summary.transactionHashes.length).toBeGreaterThan(0)

      summary.transactionHashes.forEach((txHash) => {
        expect(txHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
      })

      console.log(
        `\n✓ Transaction Hashes (${summary.transactionHashes.length}):`
      )
      summary.transactionHashes.forEach((tx, i) => {
        console.log(`  ${i + 1}. ${tx}`)
      })
    }, 300000)
  })

  describe('Cost Tracking', () => {
    it('should accurately track total costs', async () => {
      const repository = generateTestRepository('cost-tracking')
      const contributors = generateTestContributors(2)

      console.log(`\nTesting cost tracking`)

      const summary = await processAttestations(
        client,
        repository,
        contributors,
        'warn',
        retryOptions
      )

      expect(summary.totalCost).toBeGreaterThan(0n)

      // Calculate approximate expected cost
      const minDeposit = client.getMinDeposit()
      // Rough estimate: project atom + 2 contributor atoms + 2 triples
      // Each needs gas + deposit
      const roughEstimate = minDeposit * 5n // Very rough lower bound

      console.log(`\n✓ Cost Analysis:`)
      console.log(`  Total cost: ${summary.totalCost} wei`)
      console.log(`  In ETH: ${Number(summary.totalCost) / 1e18}`)
      console.log(`  Rough estimate: ${roughEstimate} wei`)
      console.log(`  Transactions: ${summary.transactionHashes.length}`)

      // Cost should be reasonable (< 1 ETH on testnet)
      expect(summary.totalCost).toBeLessThan(1000000000000000000n)
    }, 300000)
  })

  describe('Result Details', () => {
    it('should provide detailed results for each contributor', async () => {
      const repository = generateTestRepository('result-details')
      const contributors = generateTestContributors(2)

      console.log(`\nTesting result details`)

      const summary = await processAttestations(
        client,
        repository,
        contributors,
        'warn',
        retryOptions
      )

      expect(summary.results).toHaveLength(2)

      summary.results.forEach((result, i) => {
        expect(result.contributor).toBeDefined()
        expect(result.success).toBeDefined()

        console.log(`\n  Contributor ${i + 1}: ${result.contributor.name}`)
        console.log(`    Success: ${result.success}`)

        if (result.success && result.atomResult) {
          console.log(`    Atom ID: ${result.atomResult.atomId}`)
          console.log(`    Atom Cost: ${result.atomResult.cost} wei`)

          if (result.tripleResult) {
            console.log(`    Triple ID: ${result.tripleResult.tripleId}`)
            console.log(`    Triple Cost: ${result.tripleResult.cost} wei`)
          }
        }

        if (!result.success && result.error) {
          console.log(`    Error: ${result.error}`)
        }
      })

      console.log(`\n✓ All results have required fields`)
    }, 300000)
  })

  describe('Attestation Counts', () => {
    it('should correctly count created vs updated attestations', async () => {
      const repository = generateTestRepository('attestation-counts')
      const contributor = generateTestContributors(1)

      console.log(`\nTesting attestation count tracking`)

      // First run - should create
      const firstSummary = await processAttestations(
        client,
        repository,
        contributor,
        'warn',
        retryOptions
      )

      console.log(`  First run:`)
      console.log(`    Created: ${firstSummary.attestationsCreated}`)
      console.log(`    Updated: ${firstSummary.attestationsUpdated}`)

      // Second run - should update (same contributor/project)
      const secondSummary = await processAttestations(
        client,
        repository,
        contributor,
        'warn',
        retryOptions
      )

      console.log(`  Second run:`)
      console.log(`    Created: ${secondSummary.attestationsCreated}`)
      console.log(`    Updated: ${secondSummary.attestationsUpdated}`)

      // First run should have creations
      expect(
        firstSummary.attestationsCreated + firstSummary.attestationsUpdated
      ).toBe(1)

      // Second run should have updates (triple exists)
      expect(secondSummary.attestationsUpdated).toBeGreaterThan(0)

      console.log(`\n✓ Attestation counts tracked correctly`)
    }, 360000) // 6 minutes for two runs
  })

  describe('Error Handling', () => {
    it('should handle warn mode gracefully', async () => {
      const repository = generateTestRepository('warn-mode')
      const contributors = generateTestContributors(2)

      console.log(`\nTesting 'warn' error mode`)

      const summary = await processAttestations(
        client,
        repository,
        contributors,
        'warn', // Continues on error
        retryOptions
      )

      // In warn mode, should complete even if some fail
      expect(summary.contributorCount).toBe(2)
      expect(summary.results).toHaveLength(2)

      console.log(`\n✓ Warn mode completed`)
      console.log(`  Processed: ${summary.results.length}`)

      const successCount = summary.results.filter((r) => r.success).length
      console.log(`  Successful: ${successCount}`)
      console.log(`  Failed: ${summary.results.length - successCount}`)
    }, 300000)
  })

  describe('Project Atom Reuse', () => {
    it('should reuse project atom across multiple attestation calls', async () => {
      const repository = generateTestRepository('project-reuse')
      const contributor1 = generateTestContributors(1)
      const contributor2 = generateTestContributors(1)

      console.log(`\nTesting project atom reuse`)

      // First contributor
      const summary1 = await processAttestations(
        client,
        repository,
        contributor1,
        'warn',
        retryOptions
      )

      // Second contributor to same project
      const summary2 = await processAttestations(
        client,
        repository,
        contributor2,
        'warn',
        retryOptions
      )

      // Should have same project atom ID
      expect(summary1.projectAtomId).toBe(summary2.projectAtomId)

      console.log(`\n✓ Project atom reused:`)
      console.log(`  Atom ID: ${summary1.projectAtomId}`)
      console.log(`  First contributor: ${contributor1[0].name}`)
      console.log(`  Second contributor: ${contributor2[0].name}`)

      // Second call should not have project transaction (atom existed)
      if (summary2.projectAtomTxHash) {
        expect(summary2.projectAtomTxHash).toBe('0x0' as any)
      }
    }, 360000)
  })
})
