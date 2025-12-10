/**
 * Mock Intuition Protocol client for testing
 */

export const mockWalletAddress = '0x742d35Cc6634C0532925a3b844Bc9e7595f0bEb27'
export const mockPrivateKey =
  '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'

export const mockBalance = 5000000000000000000n // 5 tokens in wei

export const mockTransactionReceipt = {
  transactionHash: '0xtxhash123',
  blockNumber: 12345,
  status: 'success' as const,
  gasUsed: 250000n,
  effectiveGasPrice: 1000000000n
}

export const mockNetworkConfig = {
  id: 1,
  name: 'intuitionTestnet',
  rpcUrl: 'https://rpc.testnet.intuition.systems',
  explorerUrl: 'https://explorer.testnet.intuition.systems'
}
