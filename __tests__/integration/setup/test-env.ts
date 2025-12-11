/**
 * Integration test environment setup
 * Validates required environment variables and provides test configuration
 */
import { config } from 'dotenv'
import { existsSync } from 'fs'
import { resolve } from 'path'

// Load .env.local for integration tests
const envPath = resolve(process.cwd(), '.env.local')

if (!existsSync(envPath)) {
  throw new Error(
    `Integration tests require .env.local file with INTUITION_PRIVATE_KEY.

    To set up integration tests:
    1. Copy .env.integration.example to .env.local
    2. Add your test wallet private key
    3. Fund the wallet with testnet ETH and TRUST tokens

    See __tests__/integration/README.md for details.`
  )
}

config({ path: envPath })

// Validate required environment variables
const requiredEnvVars = ['INTUITION_PRIVATE_KEY']

for (const envVar of requiredEnvVars) {
  if (!process.env[envVar]) {
    throw new Error(
      `Integration tests require ${envVar} environment variable in .env.local`
    )
  }
}

// Validate private key format
const privateKey = process.env.INTUITION_PRIVATE_KEY
if (!privateKey?.startsWith('0x') || privateKey.length !== 66) {
  throw new Error(
    'INTUITION_PRIVATE_KEY must be a valid hex string (0x + 64 hex chars)'
  )
}

// Set test environment markers
process.env.INTEGRATION_TEST = 'true'
process.env.NODE_ENV = 'test'

// Log setup info (with masked key for security)
const maskedKey = `${privateKey.slice(0, 6)}...${privateKey.slice(-4)}`
console.log('\n='.repeat(64))
console.log('Integration Test Environment Validated')
console.log('='.repeat(64))
console.log(`Network: Base Sepolia (testnet)`)
console.log(`Wallet: ${maskedKey}`)
console.log('='.repeat(64))
console.log('WARNING: Tests will make REAL blockchain transactions')
console.log('='.repeat(64) + '\n')
