/**
 * Unit tests for custom error classes
 */

import { describe, expect, it } from '@jest/globals'
import {
  ActionError,
  InvalidInputError,
  InsufficientFundsError,
  NetworkError,
  GitHubAPIError,
  TransactionFailedError
} from '../../src/utils/errors.js'

describe('ActionError', () => {
  it('creates an error with message and retryable flag', () => {
    const error = new ActionError('Test error', true)
    expect(error.message).toBe('Test error')
    expect(error.isRetryable).toBe(true)
    expect(error.name).toBe('ActionError')
    expect(error).toBeInstanceOf(Error)
  })

  it('defaults to non-retryable', () => {
    const error = new ActionError('Test error')
    expect(error.isRetryable).toBe(false)
  })

  it('captures stack trace', () => {
    const error = new ActionError('Test error')
    expect(error.stack).toBeDefined()
    expect(error.stack).toContain('ActionError')
  })
})

describe('InvalidInputError', () => {
  it('creates a non-retryable error', () => {
    const error = new InvalidInputError('Invalid input provided')
    expect(error.message).toBe('Invalid input provided')
    expect(error.isRetryable).toBe(false)
    expect(error.name).toBe('InvalidInputError')
    expect(error).toBeInstanceOf(ActionError)
  })
})

describe('InsufficientFundsError', () => {
  it('creates a non-retryable error', () => {
    const error = new InsufficientFundsError('Not enough TRUST tokens')
    expect(error.message).toBe('Not enough TRUST tokens')
    expect(error.isRetryable).toBe(false)
    expect(error.name).toBe('InsufficientFundsError')
    expect(error).toBeInstanceOf(ActionError)
  })
})

describe('NetworkError', () => {
  it('creates a retryable error', () => {
    const error = new NetworkError('Network timeout')
    expect(error.message).toBe('Network timeout')
    expect(error.isRetryable).toBe(true)
    expect(error.name).toBe('NetworkError')
    expect(error).toBeInstanceOf(ActionError)
  })
})

describe('GitHubAPIError', () => {
  it('creates a retryable error for 500 status', () => {
    const error = new GitHubAPIError('Internal server error', 500)
    expect(error.message).toBe('Internal server error')
    expect(error.statusCode).toBe(500)
    expect(error.isRetryable).toBe(true)
    expect(error.name).toBe('GitHubAPIError')
  })

  it('creates a non-retryable error for 404 status', () => {
    const error = new GitHubAPIError('Not found', 404)
    expect(error.message).toBe('Not found')
    expect(error.statusCode).toBe(404)
    expect(error.isRetryable).toBe(false)
  })

  it('creates a non-retryable error for 403 status', () => {
    const error = new GitHubAPIError('Forbidden', 403)
    expect(error.message).toBe('Forbidden')
    expect(error.statusCode).toBe(403)
    expect(error.isRetryable).toBe(false)
  })

  it('creates a retryable error without status code', () => {
    const error = new GitHubAPIError('Unknown error')
    expect(error.statusCode).toBeUndefined()
    expect(error.isRetryable).toBe(true)
  })
})

describe('TransactionFailedError', () => {
  it('creates a non-retryable error with transaction hash', () => {
    const txHash = '0xabc123def456'
    const error = new TransactionFailedError('Transaction reverted', txHash)
    expect(error.message).toBe('Transaction reverted')
    expect(error.txHash).toBe(txHash)
    expect(error.isRetryable).toBe(false)
    expect(error.name).toBe('TransactionFailedError')
  })

  it('creates a non-retryable error without transaction hash', () => {
    const error = new TransactionFailedError('Transaction failed')
    expect(error.txHash).toBeUndefined()
    expect(error.isRetryable).toBe(false)
  })
})
