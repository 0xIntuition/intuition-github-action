/**
 * Unit tests for input validation
 */

import { jest, describe, expect, it, beforeEach } from '@jest/globals'
import { InvalidInputError } from '../../src/utils/errors.js'

// Mock @actions/core
const mockCore = {
  getInput: jest.fn(),
  setSecret: jest.fn()
}
jest.unstable_mockModule('@actions/core', () => mockCore)

const { validateAndParseInputs, validateUrl } =
  await import('../../src/services/validation.js')

describe('validateAndParseInputs', () => {
  beforeEach(() => {
    jest.clearAllMocks()

    // Set default valid inputs
    mockCore.getInput.mockImplementation((name: string) => {
      const inputs: Record<string, string> = {
        'private-key':
          '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890',
        network: 'testnet',
        'failure-mode': 'warn',
        'min-deposit-amount': '',
        'github-token': 'ghp_test123',
        'retry-attempts': '3',
        'retry-delay': '2000'
      }
      return inputs[name] || ''
    })
  })

  it('parses valid inputs correctly', () => {
    const config = validateAndParseInputs()

    expect(config.privateKey).toBe(
      '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
    )
    expect(config.network).toBe('testnet')
    expect(config.failureMode).toBe('warn')
    expect(config.minDepositAmount).toBeUndefined()
    expect(config.githubToken).toBe('ghp_test123')
    expect(config.retryAttempts).toBe(3)
    expect(config.retryDelay).toBe(2000)

    // Verify private key was masked
    expect(mockCore.setSecret).toHaveBeenCalledWith(
      '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
    )
  })

  it('parses mainnet network', () => {
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === 'network') return 'mainnet'
      if (name === 'private-key')
        return '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      if (name === 'github-token') return 'ghp_test'
      return ''
    })

    const config = validateAndParseInputs()
    expect(config.network).toBe('mainnet')
  })

  it('parses fail failure mode', () => {
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === 'failure-mode') return 'fail'
      if (name === 'private-key')
        return '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      if (name === 'github-token') return 'ghp_test'
      return ''
    })

    const config = validateAndParseInputs()
    expect(config.failureMode).toBe('fail')
  })

  it('parses custom min deposit amount', () => {
    mockCore.getInput.mockImplementation((name: string) => {
      if (name === 'min-deposit-amount') return '5000000000000000'
      if (name === 'private-key')
        return '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      if (name === 'github-token') return 'ghp_test'
      return ''
    })

    const config = validateAndParseInputs()
    expect(config.minDepositAmount).toBe(5000000000000000n)
  })

  describe('private key validation', () => {
    it('rejects private key without 0x prefix', () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'private-key')
          return 'abcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
        if (name === 'github-token') return 'ghp_test'
        return ''
      })

      expect(() => validateAndParseInputs()).toThrow(InvalidInputError)
      expect(() => validateAndParseInputs()).toThrow(
        /Private key must be in format/
      )
    })

    it('rejects private key with wrong length', () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'private-key') return '0xabc123'
        if (name === 'github-token') return 'ghp_test'
        return ''
      })

      expect(() => validateAndParseInputs()).toThrow(InvalidInputError)
    })

    it('rejects private key with invalid characters', () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'private-key')
          return '0xghij1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
        if (name === 'github-token') return 'ghp_test'
        return ''
      })

      expect(() => validateAndParseInputs()).toThrow(InvalidInputError)
    })

    it('rejects private key with newline injection', () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'private-key')
          return '0xabcdef1234567890\nabcdef1234567890abcdef1234567890abcdef1234567890'
        if (name === 'github-token') return 'ghp_test'
        return ''
      })

      expect(() => validateAndParseInputs()).toThrow(InvalidInputError)
      expect(() => validateAndParseInputs()).toThrow(/invalid characters/)
    })

    it('rejects private key with semicolon injection', () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'private-key')
          return '0xabcdef1234567890;abcdef1234567890abcdef1234567890abcdef1234567890'
        if (name === 'github-token') return 'ghp_test'
        return ''
      })

      expect(() => validateAndParseInputs()).toThrow(InvalidInputError)
    })

    it('trims whitespace from private key', () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'private-key')
          return '  0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890  '
        if (name === 'github-token') return 'ghp_test'
        return ''
      })

      const config = validateAndParseInputs()
      expect(config.privateKey).toBe(
        '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
      )
    })
  })

  describe('network validation', () => {
    it('rejects invalid network', () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'network') return 'invalid'
        if (name === 'private-key')
          return '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
        if (name === 'github-token') return 'ghp_test'
        return ''
      })

      expect(() => validateAndParseInputs()).toThrow(InvalidInputError)
      expect(() => validateAndParseInputs()).toThrow(
        /Invalid network.*Must be 'testnet' or 'mainnet'/
      )
    })

    it('handles network case-insensitively', () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'network') return 'TESTNET'
        if (name === 'private-key')
          return '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
        if (name === 'github-token') return 'ghp_test'
        return ''
      })

      const config = validateAndParseInputs()
      expect(config.network).toBe('testnet')
    })
  })

  describe('failure mode validation', () => {
    it('rejects invalid failure mode', () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'failure-mode') return 'invalid'
        if (name === 'private-key')
          return '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
        if (name === 'github-token') return 'ghp_test'
        return ''
      })

      expect(() => validateAndParseInputs()).toThrow(InvalidInputError)
      expect(() => validateAndParseInputs()).toThrow(
        /Invalid failure-mode.*Must be 'fail' or 'warn'/
      )
    })

    it('handles failure mode case-insensitively', () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'failure-mode') return 'FAIL'
        if (name === 'private-key')
          return '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
        if (name === 'github-token') return 'ghp_test'
        return ''
      })

      const config = validateAndParseInputs()
      expect(config.failureMode).toBe('fail')
    })
  })

  describe('min deposit validation', () => {
    it('rejects negative deposit', () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'min-deposit-amount') return '-1000'
        if (name === 'private-key')
          return '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
        if (name === 'github-token') return 'ghp_test'
        return ''
      })

      expect(() => validateAndParseInputs()).toThrow(InvalidInputError)
      expect(() => validateAndParseInputs()).toThrow(
        /must be a valid positive integer/
      )
    })

    it('rejects zero deposit', () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'min-deposit-amount') return '0'
        if (name === 'private-key')
          return '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
        if (name === 'github-token') return 'ghp_test'
        return ''
      })

      // Note: Due to catch-all block, this returns "must be a valid positive integer"
      // instead of "must be greater than 0"
      expect(() => validateAndParseInputs()).toThrow(InvalidInputError)
      expect(() => validateAndParseInputs()).toThrow(
        /must be a valid positive integer/
      )
    })

    it('rejects invalid bigint format', () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'min-deposit-amount') return 'not-a-number'
        if (name === 'private-key')
          return '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
        if (name === 'github-token') return 'ghp_test'
        return ''
      })

      expect(() => validateAndParseInputs()).toThrow(InvalidInputError)
      expect(() => validateAndParseInputs()).toThrow(
        /must be a valid positive integer/
      )
    })
  })

  describe('retry configuration validation', () => {
    it('rejects retry attempts below minimum', () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'retry-attempts') return '0'
        if (name === 'private-key')
          return '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
        if (name === 'github-token') return 'ghp_test'
        return ''
      })

      expect(() => validateAndParseInputs()).toThrow(InvalidInputError)
      expect(() => validateAndParseInputs()).toThrow(/must be at least 1/)
    })

    it('rejects retry attempts above maximum', () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'retry-attempts') return '11'
        if (name === 'private-key')
          return '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
        if (name === 'github-token') return 'ghp_test'
        return ''
      })

      expect(() => validateAndParseInputs()).toThrow(InvalidInputError)
      expect(() => validateAndParseInputs()).toThrow(/must be at most 10/)
    })

    it('rejects retry delay below minimum', () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'retry-delay') return '50'
        if (name === 'private-key')
          return '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
        if (name === 'github-token') return 'ghp_test'
        return ''
      })

      expect(() => validateAndParseInputs()).toThrow(InvalidInputError)
      expect(() => validateAndParseInputs()).toThrow(/must be at least 100/)
    })

    it('rejects retry delay above maximum', () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'retry-delay') return '31000'
        if (name === 'private-key')
          return '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
        if (name === 'github-token') return 'ghp_test'
        return ''
      })

      expect(() => validateAndParseInputs()).toThrow(InvalidInputError)
      expect(() => validateAndParseInputs()).toThrow(/must be at most 30000/)
    })

    it('rejects non-numeric retry values', () => {
      mockCore.getInput.mockImplementation((name: string) => {
        if (name === 'retry-attempts') return 'abc'
        if (name === 'private-key')
          return '0xabcdef1234567890abcdef1234567890abcdef1234567890abcdef1234567890'
        if (name === 'github-token') return 'ghp_test'
        return ''
      })

      expect(() => validateAndParseInputs()).toThrow(InvalidInputError)
      expect(() => validateAndParseInputs()).toThrow(/must be a valid number/)
    })
  })
})

describe('validateUrl', () => {
  it('accepts valid HTTPS URL', () => {
    const url = 'https://github.com/0xIntuition/intuition-ts'
    expect(validateUrl(url)).toBe(url)
  })

  it('accepts valid HTTP URL', () => {
    const url = 'http://example.com'
    expect(validateUrl(url)).toBe(url)
  })

  it('rejects invalid URL', () => {
    expect(() => validateUrl('not-a-url')).toThrow(InvalidInputError)
    expect(() => validateUrl('not-a-url')).toThrow(/Invalid URL format/)
  })

  it('rejects empty string', () => {
    expect(() => validateUrl('')).toThrow(InvalidInputError)
  })
})
