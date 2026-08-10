// Indian mobile number helpers. All numbers are stored as +91XXXXXXXXXX.
export const COUNTRY_CODE = '+91';

/** Keep digits only and reduce to the local 10-digit part. */
export function localDigits(input: string): string {
  let d = (input || '').replace(/\D/g, '');
  if (d.length > 10) d = d.slice(-10);
  return d;
}

/** Valid Indian mobile: 10 digits starting with 6-9. */
export function isValidIndianMobile(input: string): boolean {
  return /^[6-9]\d{9}$/.test(localDigits(input));
}

/**
 * Spam / fake number detection:
 * - fewer than 3 distinct digits (1111111111, 8787878787)
 * - a straight ascending or descending run (1234567890, 9876543210)
 */
export function isSpamPhone(input: string): boolean {
  const d = localDigits(input);
  if (d.length !== 10) return true;
  if (new Set(d.split('')).size <= 2) return true;

  let asc = true;
  let desc = true;
  for (let i = 1; i < d.length; i++) {
    const prev = Number(d[i - 1]);
    const cur = Number(d[i]);
    if (cur !== (prev + 1) % 10) asc = false;
    if (cur !== (prev + 9) % 10) desc = false;
  }
  return asc || desc;
}

/** Returns +91XXXXXXXXXX or null when invalid. */
export function toE164(input: string): string | null {
  const d = localDigits(input);
  return isValidIndianMobile(d) ? `${COUNTRY_CODE}${d}` : null;
}

/** Human-friendly validation message, or null when the number is fine. */
export function phoneError(input: string): string | null {
  const d = localDigits(input);
  if (!d) return 'Phone number is required';
  if (!isValidIndianMobile(d)) return 'Enter a valid 10-digit Indian mobile number';
  if (isSpamPhone(d)) return 'This looks like a fake number. Please enter your real mobile number';
  return null;
}

/** Maps a backend error from set_my_phone / signup to a readable message. */
export function phoneRpcError(message?: string): string {
  const m = message || '';
  if (m.includes('PHONE_TAKEN')) return 'This number is already linked to another account';
  if (m.includes('SPAM_PHONE')) return 'This looks like a fake number. Please enter your real mobile number';
  if (m.includes('INVALID_PHONE')) return 'Enter a valid 10-digit Indian mobile number';
  return 'Could not save your number. Please try again';
}
