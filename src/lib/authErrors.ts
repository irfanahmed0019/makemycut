/**
 * Maps Supabase auth errors to messages a salon owner / customer can act on,
 * without leaking internal details.
 */
export const authErrorMessage = (error: { message?: string } | null | undefined): string => {
  const raw = (error?.message || '').toLowerCase();
  if (raw.includes('invalid login credentials')) {
    return 'Email or password is incorrect. Passwords are case-sensitive — check for extra spaces or Caps Lock.';
  }
  if (raw.includes('email not confirmed')) {
    return 'This email has not been verified yet. Open the verification link we emailed you, then sign in again.';
  }
  if (raw.includes('rate limit') || raw.includes('too many')) {
    return 'Too many attempts. Please wait a minute and try again.';
  }
  if (raw.includes('failed to fetch') || raw.includes('network')) {
    return 'Could not reach the server. Check your connection and try again.';
  }
  return error?.message || 'Something went wrong. Please try again.';
};