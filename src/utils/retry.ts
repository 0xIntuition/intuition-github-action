/**
 * Retry utility with exponential backoff
 */

import * as core from '@actions/core'
import { ActionError } from './errors.js'

export interface RetryOptions {
  maxAttempts: number
  delayMs: number
  exponentialBackoff?: boolean
  maxDelayMs?: number
}

/**
 * Executes an async function with retry logic
 * @param fn Function to execute
 * @param options Retry configuration
 * @returns Result of the function
 */
export async function withRetry<T>(
  fn: () => Promise<T>,
  options: RetryOptions
): Promise<T> {
  const {
    maxAttempts,
    delayMs,
    exponentialBackoff = true,
    maxDelayMs = 30000
  } = options
  let lastError: Error | undefined

  for (let attempt = 1; attempt <= maxAttempts; attempt++) {
    try {
      return await fn()
    } catch (error) {
      lastError = error instanceof Error ? error : new Error(String(error))

      // Don't retry if it's not a retryable error
      if (error instanceof ActionError && !error.isRetryable) {
        throw error
      }

      // Don't retry on last attempt
      if (attempt === maxAttempts) {
        break
      }

      // Calculate delay with exponential backoff
      const currentDelay = exponentialBackoff
        ? Math.min(delayMs * Math.pow(2, attempt - 1), maxDelayMs)
        : delayMs

      core.warning(
        `Attempt ${attempt}/${maxAttempts} failed: ${lastError.message}. Retrying in ${currentDelay}ms...`
      )

      await sleep(currentDelay)
    }
  }

  throw lastError
}

/**
 * Sleep for specified milliseconds
 * @param ms Milliseconds to sleep
 */
function sleep(ms: number): Promise<void> {
  return new Promise((resolve) => setTimeout(resolve, ms))
}
