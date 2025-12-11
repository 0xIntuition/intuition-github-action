# Intuition Contributor Attestation GitHub Action

Automatically create on-chain attestations for contributors when pull requests
are merged, using the [Intuition Protocol](https://intuition.systems).

## Features

- Creates on-chain attestations for ALL commit authors in merged PRs
- Supports both Intuition testnet and mainnet
- Handles contributors without GitHub profiles using commit metadata
- Batch operations for gas efficiency
- Configurable error handling (fail or warn mode)
- Comprehensive logging of transactions, costs, and atom IDs
- Waits for blockchain confirmations before proceeding

## Usage

### Basic Setup

Add this workflow to your repository at
`.github/workflows/contributor-attestation.yml`:

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

### Required Secrets

1. **INTUITION_PRIVATE_KEY**: Private key for signing blockchain transactions
   - Generate a new wallet specifically for this action
   - Fund the wallet with enough tokens for gas and attestation deposits
   - Never commit or expose this key - only add it to GitHub secrets

To add the secret:

1. Go to your repository Settings → Secrets and variables → Actions
2. Click "New repository secret"
3. Name: `INTUITION_PRIVATE_KEY`
4. Value: Your wallet's private key (format: `0x...`)

## Inputs

| Input                | Required | Default                            | Description                                     |
| -------------------- | -------- | ---------------------------------- | ----------------------------------------------- |
| `private-key`        | Yes      | -                                  | Private key for signing transactions            |
| `network`            | No       | `testnet`                          | Network to use: `testnet` or `mainnet`          |
| `failure-mode`       | No       | `warn`                             | How to handle errors: `fail` or `warn`          |
| `min-deposit-amount` | No       | Auto (0.001 testnet, 0.01 mainnet) | Minimum deposit in TRUST tokens (wei)           |
| `github-token`       | No       | Auto                               | GitHub API token (automatically provided)       |
| `retry-attempts`     | No       | `3`                                | Number of retry attempts for network operations |
| `retry-delay`        | No       | `2000`                             | Delay between retries in milliseconds           |

## Outputs

| Output                 | Description                            |
| ---------------------- | -------------------------------------- |
| `project-atom-id`      | Vault ID of the project atom           |
| `contributor-count`    | Number of contributors processed       |
| `attestations-created` | Count of new attestations created      |
| `attestations-updated` | Count of existing attestations updated |
| `transaction-hashes`   | JSON array of transaction hashes       |
| `total-cost`           | Total cost in TRUST tokens (wei)       |

## Advanced Configuration

### Mainnet Usage

```yaml
- name: Create Contributor Attestations
  uses: 0xIntuition/intuition-github-action@v1
  with:
    private-key: ${{ secrets.INTUITION_MAINNET_PRIVATE_KEY }}
    network: 'mainnet'
    failure-mode: 'fail'
    min-deposit-amount: '100000000000000000' # 0.1 TRUST
```

### Using Outputs

```yaml
- name: Create Contributor Attestations
  id: attestation
  uses: 0xIntuition/intuition-github-action@v1
  with:
    private-key: ${{ secrets.INTUITION_PRIVATE_KEY }}
    network: 'testnet'

- name: Display Results
  run: |
    echo "Project Atom: ${{ steps.attestation.outputs.project-atom-id }}"
    echo "Contributors: ${{ steps.attestation.outputs.contributor-count }}"
    echo "Created: ${{ steps.attestation.outputs.attestations-created }}"
    echo "Updated: ${{ steps.attestation.outputs.attestations-updated }}"
    echo "Total Cost: ${{ steps.attestation.outputs.total-cost }} wei"
```

## How It Works

When a pull request is merged, this action:

1. **Fetches repository metadata** - Name, description, and URL
2. **Identifies all contributors** - Extracts all commit authors from the PR
3. **Creates project atom** - On-chain representation of the repository
4. **Creates contributor atoms** - On-chain representations of each contributor
5. **Creates attestation triples** - Links contributors to the project using the
   "was associated with" predicate
6. **Handles existing data** - Adds deposits to existing atoms/triples instead
   of recreating

### Attestation Structure

Each attestation creates a triple:

```
[Contributor Atom] --[was associated with]--> [Project Atom]
```

- **Subject**: Contributor (GitHub profile or commit author data)
- **Predicate**: "was associated with" (ID:
  `0x4ca4033b5e5e3e274225a9145170a0183f0a9ebe6ba7c4b28cce5e8cf536674c`)
- **Object**: Repository

## Wallet Funding

### Testnet (Intuition Testnet)

- Get test tTRUST tokens from the
  [Intuition Testnet faucet](https://testnet.hub.intuition.systems/)
- tTRUST is used for both gas fees and attestation deposits

### Mainnet (Intuition)

- Fund wallet with TRUST tokens for gas and attestation deposits

**Cost Estimation**:

- Each atom creation: ~0.001-0.01 TRUST (tTRUST on testnet)
- Each triple creation: ~0.001-0.01 TRUST (tTRUST on testnet)
- Plus gas costs (paid in TRUST/tTRUST)

For a PR with 3 contributors:

- 1 project atom (if new)
- 3 contributor atoms (if new)
- 3 attestation triples
- Estimated: 0.007-0.07 TRUST/tTRUST total (gas + deposits)

## Error Handling

### Failure Modes

**`warn` mode (default)**:

- Logs warnings for failures
- Continues processing other contributors
- Workflow succeeds even if some attestations fail

**`fail` mode**:

- Stops on first error
- Fails the entire workflow
- Use for critical attestation requirements

### Common Issues

1. **Insufficient Balance**
   - Error: `Insufficient balance`
   - Solution: Fund the wallet with more TRUST/tTRUST tokens from the faucet

2. **Network Errors**
   - Automatically retried with exponential backoff
   - Configure `retry-attempts` and `retry-delay` if needed

3. **GitHub API Rate Limits**
   - Automatically handled with retries
   - Use a GitHub token with higher limits if needed

## Contributing

This action is built with TypeScript and uses:

- [@0xintuition/sdk](https://www.npmjs.com/package/@0xintuition/sdk) -
  High-level Intuition Protocol software development kit (SDK)
- [@0xintuition/protocol](https://www.npmjs.com/package/@0xintuition/protocol) -
  Contract ABIs and addresses
- [viem](https://viem.sh) - Ethereum library
- [@actions/core](https://github.com/actions/toolkit/tree/main/packages/core) -
  GitHub Actions toolkit

### Development

```bash
# Install dependencies
npm install

# Run tests
npm test

# Build and bundle
npm run bundle

# Format code
npm run format:write

# Lint
npm run lint

# Run all checks
npm run all
```

### Testing Locally

```bash
# Create a .env file with test configuration
echo "INPUT_PRIVATE-KEY=0x..." > .env
echo "INPUT_NETWORK=testnet" >> .env
echo "INPUT_GITHUB-TOKEN=$GITHUB_TOKEN" >> .env

# Run locally
npm run local-action
```

### Integration Testing

The project includes comprehensive integration tests that make **real network
calls** to Intuition Testnet:

```bash
# Setup (one-time)
cp .env.integration.example .env.local
# Edit .env.local with your test wallet private key

# Run integration tests
npm run test:integration

# Run specific test file
npm run test:integration -- client.integration.test.ts

# Run in watch mode
npm run test:integration:watch
```

**Important Notes:**

- Integration tests create actual on-chain transactions
- Tests cost testnet tTRUST tokens (gas and deposits)
- Tests take 20-30 minutes to complete
- Tests are excluded from CI and `npm test`
- See [`__tests__/integration/README.md`](__tests__/integration/README.md) for
  detailed setup instructions

**Test Coverage:**

- ✅ Real client initialization and balance checking
- ✅ Atom creation on Intuition Testnet
- ✅ Triple creation and deposits
- ✅ End-to-end attestation flows
- ✅ Cost tracking and transaction verification

### Post-Merge Testing Workflow

An automated test workflow runs after PRs merge to main to validate the action
in a real-world scenario:

**Workflow:** `.github/workflows/test-attestation-post-merge.yml`

**Behavior:**

- Triggers automatically when PRs are merged to main
- Runs the action against the actual merged PR
- Creates real attestations on Intuition Testnet
- Validates outputs and provides Intuition Explorer transaction links
- Non-blocking: failures don't prevent PR merges

**Setup:**

1. Add `INTUITION_PRIVATE_KEY` secret to repository:
   - Navigate to: Settings → Secrets and variables → Actions
   - Create new secret: `INTUITION_PRIVATE_KEY`
   - Use a dedicated testnet wallet (separate from production)

2. Fund the test wallet:
   - Intuition Testnet native tokens (tTRUST) for gas and deposits
   - Faucet: https://testnet.hub.intuition.systems/
   - Recommended: 0.1 tTRUST

3. Workflow runs automatically on merge

**View results:** Actions tab → "Test Post-Merge Attestation"

**Expected costs per PR (3 contributors):**

- 0.007-0.07 tTRUST tokens (gas + deposits)

## Security

- **Never commit private keys** - Always use GitHub secrets
- **Use dedicated wallets** - Create a wallet specifically for this action
- **Start with testnet** - Test thoroughly before using mainnet
- **Monitor wallet balance** - Set up alerts for low balances
- **Review transactions** - Check transaction hashes in action logs

## License

MIT

## Support

- [Intuition Documentation](https://docs.intuition.systems)
- [GitHub Issues](https://github.com/0xIntuition/intuition-github-action/issues)
- [Intuition Discord](https://discord.gg/intuition)

## Acknowledgments

Built with the Intuition Protocol - enabling verifiable, on-chain reputation and
attestations.
