/**
 * Mock GitHub repository data for testing
 */

export const mockRepository = {
  id: 123456789,
  name: 'intuition-ts',
  full_name: '0xIntuition/intuition-ts',
  description: 'TypeScript SDK for Intuition Protocol',
  html_url: 'https://github.com/0xIntuition/intuition-ts',
  owner: {
    login: '0xIntuition',
    id: 987654321
  }
}

export const mockRepositoryWithoutDescription = {
  ...mockRepository,
  description: null
}

export const mockRepositoryApiResponse = {
  data: mockRepository
}
