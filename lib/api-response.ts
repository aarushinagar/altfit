/**
 * API Response Helper Utilities
 * 
 * Provides consistent response formatting across all endpoints
 */

import { NextResponse } from 'next/server'
import type { ApiResponse } from '@/types/api'

/**
 * Send a successful API response
 */
export function successResponse<T>(
  data: T,
  message: string = 'Success',
  statusCode: number = 200
): NextResponse<ApiResponse<T>> {
  console.log(`[API Response] Success (${statusCode}): ${message}`)

  return NextResponse.json(
    {
      success: true,
      data,
      message,
      statusCode,
    },
    { status: statusCode }
  )
}

/**
 * Send an error API response
 */
export function errorResponse(
  error: string | Error,
  statusCode: number = 400
): NextResponse<ApiResponse> {
  const errorMessage = error instanceof Error ? error.message : error

  console.error(`[API Response] Error (${statusCode}): ${errorMessage}`)

  return NextResponse.json(
    {
      success: false,
      error: errorMessage,
      statusCode,
    },
    { status: statusCode }
  )
}

/**
 * Handle API errors
 */
export function handleApiError(error: unknown, context?: string): NextResponse<ApiResponse> {
  const contextStr = context ? ` [${context}]` : ''

  if (error instanceof Error) {
    console.error(`[API Error]${contextStr} ${error.message}`, error.stack)
    return errorResponse(error.message, 500)
  }

  const errorMsg = String(error)
  console.error(`[API Error]${contextStr} ${errorMsg}`)
  return errorResponse(errorMsg, 500)
}

/**
 * Validate required fields in request body
 */
export function validateRequired(
  body: any,
  requiredFields: string[]
): NextResponse<ApiResponse> | null {
  const missing: string[] = []

  for (const field of requiredFields) {
    if (!body[field]) {
      missing.push(field)
    }
  }

  if (missing.length > 0) {
    console.warn(`[Validation] Missing required fields: ${missing.join(', ')}`)
    return errorResponse(`Missing required fields: ${missing.join(', ')}`, 400)
  }

  return null
}

/**
 * Validate email format
 */
export function isValidEmail(email: string): boolean {
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/
  return emailRegex.test(email)
}

/**
 * Validate password strength
 */
export function validatePassword(password: string): {
  valid: boolean
  message?: string
} {
  if (password.length < 8) {
    return {
      valid: false,
      message: 'Password must be at least 8 characters long',
    }
  }

  if (!/[A-Z]/.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one uppercase letter',
    }
  }

  if (!/[a-z]/.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one lowercase letter',
    }
  }

  if (!/[0-9]/.test(password)) {
    return {
      valid: false,
      message: 'Password must contain at least one number',
    }
  }

  return { valid: true }
}

/**
 * Clear refresh token cookie
 */
export function clearRefreshTokenCookie(response: NextResponse): void {
  console.log('[API Response] Clearing refresh token cookie')

  response.cookies.set('refreshToken', '', {
    httpOnly: true,
    secure: process.env.NODE_ENV === 'production',
    sameSite: 'lax',
    maxAge: 0,
    path: '/',
  })
}
