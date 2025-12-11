# Integration Tests

Integration tests for the Intuition GitHub Action that use **real network
calls** to Intuition Testnet and the Intuition GraphQL API.

## ⚠️ Important Warnings

- **Real Blockchain Transactions**: These tests create actual on-chain data
- **Costs Real Funds**: Each test consumes testnet tTRUST tokens
- **Slow Execution**: Tests take 2-6 minutes each due to block confirmations
- **Not for CI**: These tests run **only locally**, never in CI/CD

## Prerequisites

### 1. Test Wallet Setup

Create a dedicated test wallet:

- Generate a new wallet or use an existing testnet-only wallet
- **NEVER use a wallet with mainnet funds**

### 2. Fund the Wallet

Your test wallet needs:

**Intuition Testnet tokens (tTRUST)** (for gas and deposits):

- Faucet: https://testnet.hub.intuition.systems/
- Recommended: 0.1 tTRUST
- Note: tTRUST is used for both gas fees and attestation deposits on Intuition
  Testnet

### 3. Environment Configuration

```bash
# Copy the example file
cp .env.integration.example .env.local

# Edit .env.local and add your private key
INTUITION_PRIVATE_KEY=0x...
```

**Security Note**: `.env.local` is in `.gitignore`. Never commit this file!

## Running Tests

### Run all integration tests

```bash
npm run test:integration
```

### Run specific test file

```bash
npm run test:integration -- client.integration.test.ts
```

### Run in watch mode (for development)

```bash
npm run test:integration:watch
```

### Run with verbose output

```bash
npm run test:integration:verbose
```

## What Gets Tested

### Client Tests (`client.integration.test.ts`)

✅ Real wallet initialization ✅ Balance checking from Intuition Testnet ✅
Block number retrieval ✅ Network connectivity

### Atom Tests (`atoms.integration.test.ts`)

✅ Create project atoms on-chain ✅ Create contributor atoms on-chain ✅ Find
existing atoms via GraphQL ✅ Idempotent creation (no duplicates) ✅ Transaction
confirmations ✅ Cost tracking

### Triple Tests (`triples.integration.test.ts`)

✅ Create attestation triples on-chain ✅ Deposit to existing triples ✅ Triple
ID calculation ✅ Multiple contributors

### Full Flow Tests (`attestation.integration.test.ts`)

✅ End-to-end attestation process ✅ Multiple contributors ✅ Cost tracking ✅
Transaction collection ✅ Project atom reuse ✅ Error handling modes

## Expected Costs

Approximate costs per test run (Intuition Testnet):

| Test Suite | Transactions | tTRUST (gas + deposits) |
| ---------- | ------------ | ----------------------- |
| Client     | 0            | ~0                      |
| Atoms      | ~4-6         | ~0.005-0.007            |
| Triples    | ~4-6         | ~0.006-0.008            |
| Full Flow  | ~10-15       | ~0.013-0.025            |

**Total for full suite**: ~0.03-0.07 tTRUST (testnet)

## Execution Time

- Client tests: ~10-15 seconds
- Atom tests: ~3-5 minutes
- Triple tests: ~5-8 minutes
- Full flow tests: ~10-15 minutes

**Total full suite**: ~20-30 minutes

## Assertions

### What Integration Tests Verify

```typescript
// Real blockchain data
expect(txHash).toMatch(/^0x[a-fA-F0-9]{64}$/)
expect(atomId).toMatch(/^0x[a-fA-F0-9]{64}$/)
expect(balance).toBeGreaterThan(0n)

// On-chain state
const block = await client.getCurrentBlock()
expect(block).toBeGreaterThan(0n)

// Idempotency
const second = await ensureAtom(...)
expect(second.existed).toBe(true)
expect(second.cost).toBe(0n)
```

### Unit Tests vs Integration Tests

| Aspect      | Unit Tests             | Integration Tests       |
| ----------- | ---------------------- | ----------------------- |
| **Mocking** | Mock all external deps | No mocking - real calls |
| **Network** | No network calls       | Real blockchain RPC     |
| **Speed**   | Milliseconds           | Minutes                 |
| **Cost**    | Free                   | Costs test tokens       |
| **Focus**   | Logic correctness      | Real-world behavior     |

## Troubleshooting

### "Insufficient balance" error

```
Solution: Fund your wallet with more testnet tTRUST
Check balance: https://testnet.explorer.intuition.systems/address/YOUR_ADDRESS
Get tTRUST: https://testnet.hub.intuition.systems/
```

### "Transaction timeout" error

```
Solution:
1. Check Intuition Testnet network status
2. Verify RPC endpoint is responsive
3. Tests have 2-minute timeouts, network may be slow
```

### Tests are very slow

```
Expected: Integration tests are slow due to block confirmations
- Each transaction waits for 1 block confirmation
- Block time on Intuition Testnet: ~2 seconds
- Multiple operations per test = minutes per test
```

### ".env.local not found" error

```
Solution:
1. Copy .env.integration.example to .env.local
2. Add your test wallet private key
3. See Prerequisites section above
```

## Best Practices

1. **Run selectively**: Don't run all integration tests on every change
2. **Use watch mode**: `npm run test:integration:watch` for targeted development
3. **Monitor balance**: Check wallet balance regularly
4. **Unique data**: Tests use timestamps to avoid conflicts
5. **Sequential execution**: Tests run with `--runInBand` to avoid race
   conditions

## CI/CD Exclusion

Integration tests are **excluded from CI** because:

- They cost real tokens (even testnet)
- They're slow (20-30 minutes)
- They require private key secrets
- Network failures can cause flaky CI

Only unit tests run in CI via `npm run ci-test`.

## Test Data

Tests use timestamp-based unique identifiers:

- Each test run creates fresh atoms/triples
- No conflicts with previous test runs
- Old test data doesn't interfere with new tests

## Cleanup

**Do you need to clean up test data?**

No! Testnet data cleanup is optional because:

- Testnet atoms/triples don't cost real money
- Old test data doesn't interfere (unique timestamps)
- Blockchain data is immutable anyway

However, you can verify your test data:

- Check transaction hashes in console output
- View on Intuition Testnet Explorer: https://testnet.explorer.intuition.systems
- Query by wallet address

## Support

If you encounter issues:

1. Check wallet balance on Intuition Testnet Explorer
2. Verify `.env.local` configuration
3. Review test output for specific errors
4. Ensure Intuition Testnet is operational
5. Check Intuition Protocol status
