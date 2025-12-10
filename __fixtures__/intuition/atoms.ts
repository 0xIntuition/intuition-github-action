/**
 * Mock Intuition Protocol atom data for testing
 */

export const mockProjectAtomId = '0x1234567890abcdef1234567890abcdef12345678'
export const mockContributor1AtomId =
  '0xabcdef1234567890abcdef1234567890abcdef12'
export const mockContributor2AtomId =
  '0xfedcba0987654321fedcba0987654321fedcba09'

export const mockProjectAtomData = {
  name: '0xIntuition/intuition-ts',
  description: 'TypeScript SDK for Intuition Protocol',
  url: 'https://github.com/0xIntuition/intuition-ts',
  image: undefined
}

export const mockContributor1AtomData = {
  name: 'John Doe',
  description: 'Software Engineer',
  url: 'https://github.com/johndoe',
  image: 'https://avatars.githubusercontent.com/u/111111'
}

export const mockContributor2AtomData = {
  name: 'Jane Smith',
  description: 'Contributor: jane@example.com',
  url: 'https://github.com/janesmith',
  image: 'https://avatars.githubusercontent.com/u/222222'
}

export const mockCreateAtomResult = {
  atomId: mockProjectAtomId,
  vaultId: mockProjectAtomId,
  transactionHash: '0xtxhash1234567890abcdef',
  cost: 1000000000000000n, // 0.001 in wei
  blockNumber: 12345
}

export const mockCreateAtomsBatchResult = {
  atomIds: [mockContributor1AtomId, mockContributor2AtomId],
  vaultIds: [mockContributor1AtomId, mockContributor2AtomId],
  transactionHash: '0xtxhash_batch_atoms',
  totalCost: 2000000000000000n, // 0.002 in wei
  blockNumber: 12346
}

export const mockAtomExistsResponse = {
  exists: true,
  atomId: mockProjectAtomId,
  vaultId: mockProjectAtomId
}

export const mockAtomDoesNotExistResponse = {
  exists: false,
  atomId: null,
  vaultId: null
}
