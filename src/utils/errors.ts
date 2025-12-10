/**
 * Custom error classes for the Intuition GitHub Action
 */

/**
 * Base error class for all action-specific errors
 */
export class ActionError extends Error {
  constructor(
    message: string,
    public readonly isRetryable: boolean = false
  ) {
    super(message)
    this.name = this.constructor.name
    Error.captureStackTrace(this, this.constructor)
  }
}

/**
 * Error thrown when action inputs are invalid
 */
export class InvalidInputError extends ActionError {
  constructor(message: string) {
    super(message, false)
  }
}

/**
 * Error thrown when wallet has insufficient funds
 */
export class InsufficientFundsError extends ActionError {
  constructor(message: string) {
    super(message, false)
  }
}

/**
 * Error thrown for transient network issues
 */
export class NetworkError extends ActionError {
  constructor(message: string) {
    super(message, true)
  }
}

/**
 * Error thrown when GitHub API calls fail
 */
export class GitHubAPIError extends ActionError {
  constructor(
    message: string,
    public readonly statusCode?: number
  ) {
    super(message, statusCode !== 404 && statusCode !== 403)
  }
}

/**
 * Error thrown when blockchain transaction fails
 */
export class TransactionFailedError extends ActionError {
  constructor(
    message: string,
    public readonly txHash?: string
  ) {
    super(message, false)
  }
}
