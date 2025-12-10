# Intuition Contributor Attestation GitHub Action

Automatically create on-chain attestations for contributors when pull requests
are merged, using the [Intuition Protocol](https://intuition.systems).

## Features

- Creates on-chain attestations for ALL commit authors in merged PRs
- Supports both Intuition testnet (Base Sepolia) and mainnet (Base)
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

### Testnet (Base Sepolia)

- Get test ETH from
  [Base Sepolia faucet](https://www.alchemy.com/faucets/base-sepolia)
- Obtain test TRUST tokens from the Intuition testnet

### Mainnet (Base)

- Fund wallet with ETH for gas
- Obtain TRUST tokens for attestation deposits

**Cost Estimation**:

- Each atom creation: ~0.001-0.01 TRUST
- Each triple creation: ~0.001-0.01 TRUST
- Plus gas costs in ETH

For a PR with 3 contributors:

- 1 project atom (if new)
- 3 contributor atoms (if new)
- 3 attestation triples
- Estimated: 0.007-0.07 TRUST + gas

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
   - Solution: Fund the wallet with more TRUST tokens

2. **Network Errors**
   - Automatically retried with exponential backoff
   - Configure `retry-attempts` and `retry-delay` if needed

3. **GitHub API Rate Limits**
   - Automatically handled with retries
   - Use a GitHub token with higher limits if needed

## Contributing

This action is built with TypeScript and uses:

- [@0xintuition/sdk](https://www.npmjs.com/package/@0xintuition/sdk) -
  High-level Intuition Protocol SDK
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
