// Response Utilities - Smart Office POC
// Standardized API response format

/**
 * Wrap successful response data
 */
export function wrapResponse<T>(data: T) {
  return {
    success: true,
    data,
  };
}

/**
 * Wrap error response
 */
export function wrapError(code: string, message: string) {
  return {
    success: false,
    error: {
      code,
      message,
    },
  };
}
