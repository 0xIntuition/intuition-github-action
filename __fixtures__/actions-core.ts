/**
 * Mock for @actions/core for testing
 */

import { jest } from '@jest/globals'

export const getInput =
  jest.fn<(name: string, options?: { required?: boolean }) => string>()
export const setOutput = jest.fn<(name: string, value: string) => void>()
export const setFailed = jest.fn<(message: string) => void>()
export const setSecret = jest.fn<(secret: string) => void>()
export const info = jest.fn<(message: string) => void>()
export const debug = jest.fn<(message: string) => void>()
export const warning = jest.fn<(message: string) => void>()
export const error = jest.fn<(message: string) => void>()
