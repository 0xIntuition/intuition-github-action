/**
 * Unit tests for retry utility
 */

import { jest, describe, expect, it, beforeEach } from '@jest/globals'
import { NetworkError, InvalidInputError } from '../../src/utils/errors.js'

// Mock @actions/core
const mockCore = {
  warning: jest.fn()
}
jest.unstable_mockModule('@actions/core', () => mockCore)

const { withRetry } = await import('../../src/utils/retry.js')

describe('withRetry', () => {
  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('returns result on first successful attempt', async () => {
    const fn = jest.fn().mockResolvedValue('success')
    const result = await withRetry(fn, { maxAttempts: 3, delayMs: 100 })

    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(1)
    expect(mockCore.warning).not.toHaveBeenCalled()
  })

  it('retries on retryable errors', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new NetworkError('Network timeout'))
      .mockRejectedValueOnce(new NetworkError('Network timeout'))
      .mockResolvedValue('success')

    const result = await withRetry(fn, { maxAttempts: 3, delayMs: 10 })

    expect(result).toBe('success')
    expect(fn).toHaveBeenCalledTimes(3)
    expect(mockCore.warning).toHaveBeenCalledTimes(2)
  })

  it('does not retry on non-retryable errors', async () => {
    const fn = jest
      .fn()
      .mockRejectedValue(new InvalidInputError('Invalid input'))

    await expect(
      withRetry(fn, { maxAttempts: 3, delayMs: 10 })
    ).rejects.toThrow(InvalidInputError)

    expect(fn).toHaveBeenCalledTimes(1)
    expect(mockCore.warning).not.toHaveBeenCalled()
  })

  it('throws error after max attempts', async () => {
    const error = new NetworkError('Persistent network error')
    const fn = jest.fn().mockRejectedValue(error)

    await expect(
      withRetry(fn, { maxAttempts: 3, delayMs: 10 })
    ).rejects.toThrow('Persistent network error')

    expect(fn).toHaveBeenCalledTimes(3)
    expect(mockCore.warning).toHaveBeenCalledTimes(2) // Only warns before retries, not on last attempt
  })

  it('uses exponential backoff by default', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new NetworkError('Error'))
      .mockRejectedValueOnce(new NetworkError('Error'))
      .mockResolvedValue('success')

    const startTime = Date.now()
    await withRetry(fn, { maxAttempts: 3, delayMs: 10 })
    const elapsed = Date.now() - startTime

    // With exponential backoff: 10ms + 20ms = 30ms minimum
    expect(elapsed).toBeGreaterThanOrEqual(25)
  })

  it('uses linear backoff when disabled', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new NetworkError('Error'))
      .mockRejectedValueOnce(new NetworkError('Error'))
      .mockResolvedValue('success')

    const startTime = Date.now()
    await withRetry(fn, {
      maxAttempts: 3,
      delayMs: 10,
      exponentialBackoff: false
    })
    const elapsed = Date.now() - startTime

    // With linear backoff: 10ms + 10ms = 20ms minimum
    expect(elapsed).toBeGreaterThanOrEqual(15)
    expect(elapsed).toBeLessThan(35) // Should be faster than exponential
  })

  it('respects maxDelayMs', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new NetworkError('Error'))
      .mockRejectedValueOnce(new NetworkError('Error'))
      .mockResolvedValue('success')

    await withRetry(fn, {
      maxAttempts: 3,
      delayMs: 1000,
      maxDelayMs: 50
    })

    // Should have been called with capped delays
    expect(mockCore.warning).toHaveBeenCalledWith(
      expect.stringContaining('Retrying in 50ms')
    )
  })

  it('handles non-Error exceptions', async () => {
    const fn = jest.fn().mockRejectedValue('string error')

    await expect(
      withRetry(fn, { maxAttempts: 2, delayMs: 10 })
    ).rejects.toThrow('string error')

    expect(fn).toHaveBeenCalledTimes(2)
  })

  it('logs retry attempts with correct information', async () => {
    const fn = jest
      .fn()
      .mockRejectedValueOnce(new NetworkError('Network timeout'))
      .mockResolvedValue('success')

    await withRetry(fn, { maxAttempts: 3, delayMs: 10 })

    expect(mockCore.warning).toHaveBeenCalledWith(
      expect.stringMatching(
        /Attempt 1\/3 failed: Network timeout\. Retrying in \d+ms\.\.\./
      )
    )
  })
})
