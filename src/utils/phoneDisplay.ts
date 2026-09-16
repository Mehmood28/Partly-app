/**
 * Formats common North American phone numbers for display without changing the
 * stored value. Non-North-American or partial values are returned unchanged.
 */
export const formatPhoneForDisplay = (phone?: string): string => {
  if (!phone) return '';

  const digits = phone.replace(/\D/g, '');
  const northAmericanNumber = digits.length === 11 && digits.startsWith('1')
    ? digits.slice(1)
    : digits;

  if (northAmericanNumber.length !== 10) return phone;

  return `(${northAmericanNumber.slice(0, 3)}) ${northAmericanNumber.slice(3, 6)}-${northAmericanNumber.slice(6)}`;
};

export const phoneHref = (phone: string): string => `tel:${phone.replace(/\D/g, '')}`;
