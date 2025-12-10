# Implementation Plan: Intuition Contributor Attestation GitHub Action

## Overview

Transform this TypeScript GitHub Action template into a production-ready action that creates on-chain contributor attestations using the Intuition Protocol. When a PR is merged, the action will:

1. Create/verify an atom representing the repository
2. Create/verify atoms for all commit authors in the PR
3. Create attestation triples (or add deposits to existing ones) linking contributors to the project

## User Requirements Summary

- **Target audience:** Repository owners who want to reward contributors with on-chain attestations
- **Trigger:** On PR merge (pull_request.closed + merged == true)
- **Contributors:** Process ALL commit authors in the PR (not just PR opener)
- **Existing triples:** Always deposit minimal amount, even if triple exists
- **Networks:** Support both intuitionTestnet and intuitionMainnet (user-configurable)
- **Error handling:** Configurable (fail workflow or warn and continue)

## Architecture

### File Structure

```
src/
├── intuition/
│   ├── client.ts          # Protocol SDK wrapper with retry logic
│   ├── atoms.ts           # Atom creation and existence checking
│   ├── triples.ts         # Triple creation and deposit management
│   └── types.ts           # TypeScript interfaces for Intuition operations
├── github/
│   ├── repository.ts      # Fetch repository metadata
│   ├── contributors.ts    # Fetch PR commits and contributor profiles
│   └── types.ts           # GitHub-related type definitions
├── services/
│   ├── attestation.ts     # Main orchestration logic
│   └── validation.ts      # Input validation and sanitization
├── config/
│   ├── networks.ts        # Network configurations (testnet/mainnet)
│   └── constants.ts       # Predicate IDs and action constants
└── utils/
    ├── errors.ts          # Custom error classes
    └── retry.ts           # Retry logic with exponential backoff

__tests__/
├── intuition/             # Unit tests for protocol interactions
├── github/                # Tests for GitHub API interactions
├── services/              # Tests for business logic
└── main.test.ts           # Integration tests

__fixtures__/
├── github/                # Mock GitHub API responses
└── intuition/             # Mock protocol responses
```

### Key Components

#### 1. Action Configuration (action.yml)

**Inputs:**
- `private-key` (required): Transaction signing key from GitHub secrets
- `network` (optional, default: testnet): "testnet" or "mainnet"
- `failure-mode` (optional, default: warn): "fail" or "warn"
- `min-deposit-amount` (optional): Custom minimal deposit in TRUST tokens
- `github-token` (optional, default: automatic): GitHub API token
- `retry-attempts` (optional, default: 3): Network operation retries
- `retry-delay` (optional, default: 2000ms): Delay between retries

**Outputs:**
- `project-atom-id`: Vault ID of the project atom
- `contributor-count`: Number of contributors processed
- `attestations-created`: Count of new attestations
- `attestations-updated`: Count of deposit additions
- `transaction-hashes`: JSON array of transaction hashes
- `total-cost`: Total cost in TRUST tokens

#### 2. Main Execution Flow (src/main.ts)

```typescript
async function run(): Promise<void> {
  // 1. Validate inputs (private key format, network selection, etc.)
  const config = validateAndParseInputs();

  // 2. Initialize Intuition Protocol client and GitHub Octokit
  const intuitionClient = initializeIntuitionClient(config);
  const githubClient = initializeGitHubClient(config);

  // 3. Fetch repository metadata (name, description, URL)
  const repository = await fetchRepositoryData(githubClient);

  // 4. Fetch all commit authors from the merged PR
  const contributors = await fetchContributors(githubClient);

  // 5. Ensure project atom exists (create if not)
  const projectAtom = await ensureProjectAtom(intuitionClient, repository);

  // 6. Process each contributor (create atoms + triples)
  const results = await processContributors(
    intuitionClient,
    contributors,
    projectAtom,
    config
  );

  // 7. Set action outputs and log summary
  setOutputs(projectAtom, results);
  logSummary(results);
}
```

#### 3. Intuition Protocol Integration

**Client Wrapper (src/intuition/client.ts):**
- Initialize viem/ethers wallet from private key
- Configure network (intuitionTestnet or intuitionMainnet)
- Provide retry-wrapped methods for protocol operations
- Check TRUST token balance before operations

**Atom Management (src/intuition/atoms.ts):**
- `ensureProjectAtom()`: Check existence, create if needed with Thing schema
- `ensureContributorAtom()`: Check existence, create if needed with GitHub profile data
- Calculate atom IDs: `keccak256(abi.encodePacked(data))`

**Triple Management (src/intuition/triples.ts):**
- `ensureAttestationTriple()`: Create triple or add deposit if exists
- Use predicate: "was associated with" (termId: 0x4ca4033b5e5e3e274225a9145170a0183f0a9ebe6ba7c4b28cce5e8cf536674c)
- Calculate triple IDs: `keccak256(abi.encodePacked(subjectId, predicateId, objectId))`

#### 4. GitHub Integration

**Repository Data (src/github/repository.ts):**
- Extract name, description, URL from GitHub API
- Handle missing descriptions with defaults

**Contributor Data (src/github/contributors.ts):**
- Fetch all commits in the merged PR (with pagination)
- Extract unique commit authors
- Fetch GitHub profiles for each author
- Handle deleted/missing accounts gracefully
- Deduplicate by username/email

#### 5. Error Handling Strategy

**Error Types:**
- `InvalidInputError`: Bad configuration (always fails)
- `InsufficientFundsError`: Not enough TRUST (always fails)
- `NetworkError`: Transient network issues (retryable)
- `GitHubAPIError`: GitHub API failures (retryable)
- `TransactionFailedError`: Transaction reverts (configurable)

**Retry Logic:**
- Exponential backoff for network errors
- Configurable max attempts and delay
- Skip retry for permanent errors (invalid input, insufficient funds)

**Failure Modes:**
- `fail`: Stop and fail the workflow on errors
- `warn`: Log warning and continue processing remaining contributors

#### 6. Security Measures

**Private Key Protection:**
- Validate format (0x + 64 hex chars)
- Mask in logs using `core.setSecret()`
- Never output or log the key

**Input Sanitization:**
- Trim whitespace
- Check for injection attempts
- Validate all numeric values
- Validate URL formats

**Transaction Safety:**
- Verify parameters before signing
- Use HTTPS for all API calls
- Configure reasonable timeouts
- Wait for confirmations on mainnet

## Dependencies to Add

### Production Dependencies
```json
{
  "@0xintuition/protocol": "latest",
  "@actions/github": "^6.0.0",
  "viem": "^2.x.x"  // or "ethers": "^6.x.x" (depends on SDK)
}
```

### Development Dependencies
```json
{
  "nock": "^13.x.x"  // HTTP mocking for tests
}
```

## Testing Strategy

### Unit Tests
- Intuition client initialization and operations
- Atom existence checking and creation
- Triple creation and deposit logic
- GitHub data fetching and parsing
- Input validation and sanitization
- Error handling for each error type

### Integration Tests
- Complete flow from PR data to attestations
- Existing atom/triple handling
- Multiple contributors processing
- Failure mode behaviors
- Retry logic under network failures

### Mocking
- Mock `@0xintuition/protocol` SDK methods
- Mock GitHub API with nock
- Mock environment variables for action inputs
- Use fixtures for realistic test data

## Performance Optimizations

1. **Batch Operations:** Check multiple atom existence in parallel
2. **Parallel Processing:** Process contributors with concurrency limit
3. **Caching:** Cache GitHub user profiles to avoid duplicate API calls
4. **Balance Pre-check:** Verify sufficient funds before processing

## Edge Cases to Handle

- PR with 50+ contributors → batch operations
- Contributor without GitHub profile → use commit author data
- Network gas spikes → gas estimation with configurable limits
- Insufficient TRUST balance → pre-check and clear error
- GitHub API rate limits → exponential backoff
- Repository without description → use default description
- Deleted GitHub accounts → handle 404s gracefully
- Duplicate PR events → idempotent operations (check existence)

## Workflow Example

```yaml
name: Contributor Attestation

on:
  pull_request:
    types: [closed]

jobs:
  attest:
    if: github.event.pull_request.merged == true
    runs-on: ubuntu-latest

    steps:
      - name: Create Contributor Attestations
        uses: 0xIntuition/intuition-github-action@v1
        with:
          private-key: ${{ secrets.INTUITION_PRIVATE_KEY }}
          network: 'testnet'
          failure-mode: 'warn'
```

## Critical Files for Implementation

1. **src/main.ts** - Entry point and orchestration
2. **src/intuition/client.ts** - Protocol SDK wrapper
3. **src/services/attestation.ts** - Business logic
4. **src/github/contributors.ts** - PR commit author fetching
5. **action.yml** - Action interface definition

## Implementation Sequence

1. **Phase 1: Dependencies & Configuration**
   - Install npm packages
   - Update action.yml with inputs/outputs
   - Create network configurations and constants

2. **Phase 2: Core Infrastructure**
   - Implement custom error classes
   - Implement retry utility
   - Implement input validation
   - Set up Intuition Protocol client wrapper

3. **Phase 3: GitHub Integration**
   - Implement repository data fetching
   - Implement contributor data fetching with pagination
   - Handle edge cases (missing profiles, deleted accounts)

4. **Phase 4: Intuition Protocol Operations**
   - Implement atom creation and existence checking
   - Implement triple creation and deposit logic
   - Add balance checking

5. **Phase 5: Main Orchestration**
   - Implement attestation service
   - Wire up main execution flow
   - Add comprehensive logging
   - Set action outputs

6. **Phase 6: Testing**
   - Create test fixtures
   - Write unit tests for each module
   - Write integration tests for main flow
   - Test error scenarios and retry logic

7. **Phase 7: Documentation**
   - Update README with usage instructions
   - Document setup process (wallet, funding)
   - Add troubleshooting guide
   - Document architecture

8. **Phase 8: Build & Verification**
   - Run `npm run bundle` to generate dist/index.js
   - Verify all tests pass
   - Test locally with .env file
   - Verify CI workflows pass

## User Decisions Summary

### Confirmed Behaviors

1. **Batching:** YES - Use batch operations (`createAtoms([...])`, `createTriples([...])`)
   - More gas-efficient
   - Process multiple contributors per transaction
   - Requires careful error handling (one failure affects batch)

2. **Non-GitHub Contributors:** Use commit metadata
   - Create atoms using commit author name/email when GitHub profile unavailable
   - Construct profile URL as `https://github.com/{username}` even if user doesn't exist
   - Gracefully handle 404s on profile fetch

3. **Transaction Confirmations:** Wait for confirmations
   - Wait for configurable number of block confirmations
   - Ensure transactions are finalized before marking as complete
   - Add `confirmations` to network configuration

4. **Network Selection:** Use library-provided networks
   - Import `intuitionTestnet` and `intuitionMainnet` from `@0xintuition/protocol`
   - User selects via action input

5. **Contributors:** All commit authors (not just PR opener)

6. **Existing Triples:** Always deposit (even if exists)

7. **Error Handling:** Configurable (fail or warn mode)

## Implementation Clarifications Based on Decisions

### Batching Strategy

**Approach:**
- Batch ALL contributor atoms creation in single transaction
- Batch ALL triple creations in single transaction
- Separate batch for deposits to existing triples

**Error Handling with Batching:**
- If batch fails, fall back to individual transactions
- Log which items succeeded/failed
- In `warn` mode: continue after batch failure
- In `fail` mode: stop on batch failure

**Code Structure:**
```typescript
// Try batch first
try {
  await createAtomsBatch(contributors);
} catch (batchError) {
  core.warning('Batch creation failed, falling back to individual transactions');
  // Retry individually
  for (const contributor of contributors) {
    try {
      await createAtom(contributor);
    } catch (error) {
      handleError(error, failureMode);
    }
  }
}
```

### Non-GitHub User Handling

**Atom Data for Non-GitHub Users:**
```typescript
// When GitHub profile fetch returns 404
{
  name: commitAuthor.name || commitAuthor.email,
  description: `Contributor: ${commitAuthor.email}`,
  url: `https://github.com/${inferredUsername}` // fallback URL
}
```

**Detection Strategy:**
- Try to fetch GitHub profile
- On 404: use commit author metadata
- On other errors: retry with backoff

### Confirmation Strategy

**Implementation:**
```typescript
interface TransactionResult {
  hash: string;
  confirmed: boolean;
  blockNumber?: number;
}

async function waitForConfirmation(
  txHash: string,
  requiredConfirmations: number
): Promise<TransactionResult> {
  // Wait for transaction receipt
  const receipt = await waitForReceipt(txHash);

  // Wait for additional confirmations
  if (requiredConfirmations > 1) {
    const currentBlock = await getCurrentBlock();
    const confirmations = currentBlock - receipt.blockNumber;

    if (confirmations < requiredConfirmations) {
      await waitForBlocks(requiredConfirmations - confirmations);
    }
  }

  return {
    hash: txHash,
    confirmed: true,
    blockNumber: receipt.blockNumber
  };
}
```

**Network Defaults:**
```typescript
export const NETWORK_DEFAULTS = {
  testnet: {
    minDeposit: 1000000000000000n, // 0.001 TRUST
    confirmations: 1,
    gasLimit: 5000000n
  },
  mainnet: {
    minDeposit: 10000000000000000n, // 0.01 TRUST
    confirmations: 2,  // Wait for 2 confirmations on mainnet
    gasLimit: 5000000n
  }
};
```

## Updated Implementation Sequence

1. **Phase 1: Dependencies & Configuration**
   - Install `@0xintuition/protocol`, `@actions/github`, `viem` (or `ethers`)
   - Update action.yml with all inputs/outputs
   - Create network configurations with confirmation settings
   - Define constants (predicate ID, defaults)

2. **Phase 2: Core Infrastructure**
   - Custom error classes (InvalidInputError, InsufficientFundsError, etc.)
   - Retry utility with exponential backoff
   - Input validation and sanitization
   - Confirmation waiting utility

3. **Phase 3: Intuition Protocol Client**
   - Initialize wallet from private key
   - Configure network (testnet/mainnet)
   - Wrapper methods for createAtoms, createTriples, deposit
   - Balance checking
   - Transaction confirmation waiting

4. **Phase 4: GitHub Integration**
   - Fetch repository metadata
   - Fetch PR commits with pagination
   - Fetch contributor profiles with fallback to commit metadata
   - Handle 404s gracefully
   - Deduplicate contributors

5. **Phase 5: Atom & Triple Management**
   - Check atom existence (batch if possible)
   - Create atoms with batching + fallback to individual
   - Check triple existence (batch if possible)
   - Create triples with batching + fallback to individual
   - Deposit to existing triples

6. **Phase 6: Main Orchestration**
   - Wire up complete flow in src/main.ts
   - Pre-check balance before operations
   - Batch contributor processing
   - Handle errors per failure mode
   - Set outputs with comprehensive stats

7. **Phase 7: Testing**
   - Mock protocol SDK with batch operations
   - Mock GitHub API with various response scenarios
   - Test batching success and fallback
   - Test non-GitHub contributors
   - Test confirmation waiting
   - Test all error scenarios

8. **Phase 8: Documentation & Build**
   - Update README with usage
   - Document batching behavior
   - Document non-GitHub user handling
   - Run `npm run bundle`
   - Verify all tests pass

## Logging Strategy

The action will include comprehensive logging at multiple levels:

### 1. Transaction Details
- Transaction hash for each operation
- Gas used per transaction
- Block number where transaction was confirmed
- Confirmation count
- Example: `✓ Transaction confirmed: 0xabc123... (Block: 12345, Gas: 250000, Confirmations: 2)`

### 2. Atom IDs
- Vault ID for project atom (created or existing)
- Vault ID for each contributor atom
- Clear indication of whether atom was created or already existed
- Example: `✓ Project atom: 0x789def... (existing)`
- Example: `✓ Contributor atom for @johndoe: 0x456ghi... (created)`

### 3. Cost Breakdown
- TRUST token cost for each atom creation
- TRUST token cost for each triple creation/deposit
- Cumulative total cost
- Balance before and after operations
- Example:
  ```
  Cost Summary:
    Project atom: 0.001 TRUST
    Contributor atoms: 0.003 TRUST (3 atoms)
    Attestation triples: 0.009 TRUST (3 triples)
    Total: 0.013 TRUST
  Balance: 1.500 TRUST → 1.487 TRUST
  ```

### 4. GitHub Data
- Repository name and URL
- Number of commits in PR
- Contributor usernames and names
- Contributor profile URLs
- Commit counts per contributor
- Contributors without GitHub profiles (if any)
- Example:
  ```
  Repository: 0xIntuition/intuition-ts
  PR Commits: 12
  Contributors: 3
    - @johndoe (John Doe, 8 commits) → https://github.com/johndoe
    - @janedoe (Jane Doe, 3 commits) → https://github.com/janedoe
    - contributor@email.com (1 commit, no GitHub profile)
  ```

### Logging Levels

**core.info()** - Normal progress updates:
- Starting operation
- Successfully completed operations
- Summary statistics

**core.debug()** - Detailed information (only when ACTIONS_STEP_DEBUG=true):
- Raw GitHub API responses
- Atom/triple ID calculations
- Network configuration details
- Transaction parameters before signing

**core.warning()** - Non-critical issues:
- Batch operation fallback to individual
- Contributors without GitHub profiles
- Rate limiting encountered
- Retries in progress

**core.error()** - Errors:
- Transaction failures
- Insufficient funds
- Invalid inputs
- API errors

### Summary Output Format

```
================================================================
Intuition Contributor Attestation Summary
================================================================
Repository: 0xIntuition/intuition-ts
Project Atom: 0x789def... (existing)

Contributors Processed: 3
  ✓ Attestations Created: 2
  ✓ Attestations Updated: 1
  ✗ Failed: 0

Transaction Hashes:
  - 0xabc123... (project atom)
  - 0xdef456... (contributor atoms batch)
  - 0xghi789... (attestation triples batch)

Total Cost: 0.013 TRUST
Remaining Balance: 1.487 TRUST
================================================================
```

## SDK Investigation Notes

Based on the Intuition documentation and the user's reference to three packages:
- `@0xintuition/sdk` - High-level TypeScript SDK
- `@0xintuition/protocol` - Contract ABIs, addresses, network configs
- `@0xintuition/graphql` - Query existing data

### Implementation Strategy

**Phase 1 of implementation will include:**
1. Install all three packages
2. Examine exported types and methods
3. Check for examples in node_modules/@0xintuition/*/README.md
4. Refer to documentation at docs.intuition.systems and tech.docs.intuition.systems
5. Determine the correct API pattern:
   - Option A: Use high-level SDK methods
   - Option B: Use contract ABIs with viem/ethers directly
   - Option C: Hybrid approach (SDK + direct contract calls)

### Expected API Patterns (to verify)

```typescript
// Expected pattern based on earlier documentation fetch
import { createClient } from '@0xintuition/sdk';
import { intuitionTestnet, intuitionMainnet } from '@0xintuition/protocol';

const client = createClient({
  network: intuitionTestnet,
  wallet: walletClient // viem wallet
});

// Check existence
const exists = await client.isTermCreated(termId);

// Create atoms
const atomResult = await client.createAtoms({
  atoms: [{ data: thingData, deposit: amount }]
});

// Create triples
const tripleResult = await client.createTriples({
  triples: [{
    subjectId,
    predicateId,
    objectId,
    deposit: amount
  }]
});
```

**If SDK doesn't provide high-level methods:**
- Use contract ABIs from `@0xintuition/protocol`
- Call MultiVault contract directly with viem
- Reference the contract functions from documentation

**GraphQL usage:**
- Use for checking existence of atoms/triples
- Reduces blockchain calls
- May be faster than contract reads

### Dependencies Decision

Will determine during Phase 1 implementation whether to use:
- `viem` (modern, TypeScript-first, tree-shakeable)
- `ethers` (established, widely used)
- Based on `@0xintuition/sdk` peer dependencies

## Feature Suggestions for Future Improvements

1. **Multiple Predicates:** Support custom predicates beyond "was associated with"
2. **Contribution Weighting:** Larger deposits based on lines of code changed
3. **Time-Based Attestations:** Track contribution over time periods
4. **Team Recognition:** Create team/organization atoms and link contributors
5. **Achievement Badges:** Create special atoms for milestones (1st PR, 100th commit)
6. **Reputation Scores:** Aggregate attestation counts into reputation metrics
7. **Cross-Repo Attestations:** Link contributor across multiple repositories
8. **Revocation:** Support removing attestations for reverted/harmful contributions
9. **GraphQL Integration:** Query existing attestations before creating
10. **Dashboard Integration:** Link to Intuition Portal to view attestations
11. **Notification System:** Notify contributors when they receive attestations
12. **Gas Optimization:** Dynamic gas pricing based on network conditions
13. **Multi-Chain Support:** Extend beyond Base to other EVM chains
14. **Attestation Templates:** Pre-configured attestation types (bug fix, feature, docs)

---

## Summary: Ready for Implementation

This plan provides a comprehensive roadmap for transforming the TypeScript GitHub Action template into a production-ready Intuition Protocol contributor attestation system.

### What We're Building

A GitHub Action that:
- ✅ Triggers on PR merge
- ✅ Creates on-chain attestations for ALL commit authors
- ✅ Uses Intuition Protocol (testnet/mainnet)
- ✅ Batch operations for gas efficiency with individual fallback
- ✅ Handles contributors without GitHub profiles using commit metadata
- ✅ Waits for transaction confirmations before proceeding
- ✅ Configurable error handling (fail or warn mode)
- ✅ Comprehensive logging (transactions, costs, IDs, GitHub data)

### Key Technical Decisions

1. **Batching:** Batch atom/triple creation, fallback to individual on failure
2. **Non-GitHub Contributors:** Use commit author name/email as fallback
3. **Confirmations:** Wait for network-specific confirmations (testnet: 1, mainnet: 2)
4. **Error Handling:** Respect user's failure-mode configuration
5. **Logging:** Four-level logging (transaction details, atom IDs, costs, GitHub data)
6. **SDK:** Investigate `@0xintuition/sdk`, `@0xintuition/protocol`, `@0xintuition/graphql` during implementation

### Critical Success Factors

- Modular architecture with clear separation of concerns
- Comprehensive error handling with retry logic
- Thorough testing with mocked dependencies
- Security-first approach (private key handling, input validation)
- Production-ready logging and debugging capabilities
- Clear documentation for end users

### Implementation Timeline

8 phases covering dependencies → infrastructure → integrations → orchestration → testing → documentation → build verification

The plan is detailed enough to execute systematically while remaining flexible for SDK API adjustments during implementation.
