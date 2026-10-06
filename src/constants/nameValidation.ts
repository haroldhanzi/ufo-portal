const RESERVED_PARTNER_NAME = /(ufo|you|four|4)/i;

export function validatePartnerName(value: string) {
  return (
    !RESERVED_PARTNER_NAME.test(value) ||
    'Names cannot contain "UFO", "YOU", "FOUR", or the number 4.'
  );
}
