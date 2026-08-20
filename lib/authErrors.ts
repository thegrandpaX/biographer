/**
 * True for Google API failures caused by a bad/expired/revoked/under-scoped
 * credential (401 invalid credentials, 403 insufficient scope) - as opposed
 * to a genuine unexpected error. Callers use this to fall back to the
 * "not signed in" path instead of crashing.
 */
export function isGoogleAuthError(error: unknown): boolean {
  const status = (error as { status?: number; response?: { status?: number } })?.status
    ?? (error as { response?: { status?: number } })?.response?.status;
  return status === 401 || status === 403;
}
