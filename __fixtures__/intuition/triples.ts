/**
 * Mock Intuition Protocol triple data for testing
 */

export const mockPredicateId =
  '0x4ca4033b5e5e3e274225a9145170a0183f0a9ebe6ba7c4b28cce5e8cf536674c'

export const mockTriple1Id =
  '0x111111111111111111111111111111111111111111111111'
export const mockTriple2Id =
  '0x222222222222222222222222222222222222222222222222'

export const mockCreateTripleResult = {
  tripleId: mockTriple1Id,
  vaultId: mockTriple1Id,
  transactionHash: '0xtxhash_triple_1',
  cost: 1000000000000000n, // 0.001 in wei
  blockNumber: 12347
}

export const mockCreateTriplesBatchResult = {
  tripleIds: [mockTriple1Id, mockTriple2Id],
  vaultIds: [mockTriple1Id, mockTriple2Id],
  transactionHash: '0xtxhash_batch_triples',
  totalCost: 2000000000000000n, // 0.002 in wei
  blockNumber: 12348
}

export const mockDepositResult = {
  tripleId: mockTriple1Id,
  transactionHash: '0xtxhash_deposit',
  depositAmount: 1000000000000000n,
  blockNumber: 12349
}

export const mockTripleExistsResponse = {
  exists: true,
  tripleId: mockTriple1Id,
  vaultId: mockTriple1Id
}

export const mockTripleDoesNotExistResponse = {
  exists: false,
  tripleId: null,
  vaultId: null
}
