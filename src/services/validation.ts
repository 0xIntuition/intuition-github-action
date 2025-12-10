/**
 * Input validation and sanitization
 */

import * as core from '@actions/core'
import { InvalidInputError } from '../utils/errors.js'
import { FAILURE_MODES, NETWORKS } from '../config/constants.js'

export interface ActionConfig {
  privateKey: `0x${string}`
  network: 'testnet' | 'mainnet'
  failureMode: 'fail' | 'warn'
  minDepositAmount?: bigint
  githubToken: string
  retryAttempts: number
  retryDelay: number
}

/**
 * Validates and parses action inputs
 * @returns Parsed and validated configuration
 */
export function validateAndParseInputs(): ActionConfig {
  // Get and validate private key
  const privateKey = core.getInput('private-key', { required: true })
  core.setSecret(privateKey) // Mask in logs
  const validatedPrivateKey = validatePrivateKey(privateKey)

  // Get and validate network
  const network = validateNetwork(core.getInput('network') || 'testnet')

  // Get and validate failure mode
  const failureMode = validateFailureMode(
    core.getInput('failure-mode') || 'warn'
  )

  // Get optional min deposit amount
  const minDepositStr = core.getInput('min-deposit-amount')
  const minDepositAmount = minDepositStr
    ? validateBigInt(minDepositStr, 'min-deposit-amount')
    : undefined

  // Get GitHub token
  const githubToken = core.getInput('github-token', { required: true })

  // Get retry configuration
  const retryAttempts = validateNumber(
    core.getInput('retry-attempts') || '3',
    'retry-attempts',
    1,
    10
  )

  const retryDelay = validateNumber(
    core.getInput('retry-delay') || '2000',
    'retry-delay',
    100,
    30000
  )

  return {
    privateKey: validatedPrivateKey,
    network,
    failureMode,
    minDepositAmount,
    githubToken,
    retryAttempts,
    retryDelay
  }
}

/**
 * Validates private key format
 * @param key Private key string
 * @returns Validated private key
 */
function validatePrivateKey(key: string): `0x${string}` {
  const trimmed = key.trim()

  // Check for common injection patterns
  if (
    trimmed.includes('\n') ||
    trimmed.includes('\r') ||
    trimmed.includes(';')
  ) {
    throw new InvalidInputError('Private key contains invalid characters')
  }

  // Validate hex format
  const hexPattern = /^0x[0-9a-fA-F]{64}$/
  if (!hexPattern.test(trimmed)) {
    throw new InvalidInputError(
      'Private key must be in format: 0x followed by 64 hexadecimal characters'
    )
  }

  return trimmed as `0x${string}`
}

/**
 * Validates network selection
 * @param network Network name
 * @returns Validated network
 */
function validateNetwork(network: string): 'testnet' | 'mainnet' {
  const trimmed = network.trim().toLowerCase()

  if (trimmed !== NETWORKS.TESTNET && trimmed !== NETWORKS.MAINNET) {
    throw new InvalidInputError(
      `Invalid network: ${network}. Must be 'testnet' or 'mainnet'`
    )
  }

  return trimmed as 'testnet' | 'mainnet'
}

/**
 * Validates failure mode
 * @param mode Failure mode
 * @returns Validated failure mode
 */
function validateFailureMode(mode: string): 'fail' | 'warn' {
  const trimmed = mode.trim().toLowerCase()

  if (trimmed !== FAILURE_MODES.FAIL && trimmed !== FAILURE_MODES.WARN) {
    throw new InvalidInputError(
      `Invalid failure-mode: ${mode}. Must be 'fail' or 'warn'`
    )
  }

  return trimmed as 'fail' | 'warn'
}

/**
 * Validates and parses a BigInt value
 * @param value String value
 * @param fieldName Field name for error messages
 * @returns Parsed BigInt
 */
function validateBigInt(value: string, fieldName: string): bigint {
  const trimmed = value.trim()

  try {
    const parsed = BigInt(trimmed)
    if (parsed <= 0n) {
      throw new InvalidInputError(`${fieldName} must be greater than 0`)
    }
    return parsed
  } catch {
    throw new InvalidInputError(`${fieldName} must be a valid positive integer`)
  }
}

/**
 * Validates and parses a number with optional range
 * @param value String value
 * @param fieldName Field name for error messages
 * @param min Optional minimum value
 * @param max Optional maximum value
 * @returns Parsed number
 */
function validateNumber(
  value: string,
  fieldName: string,
  min?: number,
  max?: number
): number {
  const trimmed = value.trim()
  const parsed = parseInt(trimmed, 10)

  if (isNaN(parsed)) {
    throw new InvalidInputError(`${fieldName} must be a valid number`)
  }

  if (min !== undefined && parsed < min) {
    throw new InvalidInputError(`${fieldName} must be at least ${min}`)
  }

  if (max !== undefined && parsed > max) {
    throw new InvalidInputError(`${fieldName} must be at most ${max}`)
  }

  return parsed
}

/**
 * Validates URL format
 * @param url URL string
 * @returns Validated URL
 */
export function validateUrl(url: string): string {
  try {
    new URL(url)
    return url
  } catch {
    throw new InvalidInputError(`Invalid URL format: ${url}`)
  }
}
