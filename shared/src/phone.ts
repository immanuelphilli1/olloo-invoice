/**
 * Normalise a phone number to E.164. Ghanaian local numbers ("024 123 4567")
 * become +233241234567. Returns null if it doesn't look like a phone number.
 */
export function normalizePhone(input: string): string | null {
  const trimmed = input.trim();
  const digits = trimmed.replace(/\D/g, '');
  let e164: string;
  if (trimmed.startsWith('+')) e164 = digits;
  else if (digits.startsWith('00')) e164 = digits.slice(2);
  else if (digits.length === 10 && digits.startsWith('0')) e164 = `233${digits.slice(1)}`;
  else if (digits.length === 9) e164 = `233${digits}`;
  else e164 = digits;
  if (e164.length < 10 || e164.length > 15) return null;
  return `+${e164}`;
}

/** Digits only, for wa.me links. */
export function whatsappDigits(phone: string): string {
  return (normalizePhone(phone) ?? phone).replace(/\D/g, '');
}
