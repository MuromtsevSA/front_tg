export function normalizePhone(input) {
  let digits = String(input ?? '').replace(/\D/g, '');
  if (digits.startsWith('00')) digits = digits.slice(2);
  if (digits.length === 11 && digits.startsWith('8')) {
    digits = `7${digits.slice(1)}`;
  }
  return digits;
}

export function isValidPhone(phone) {
  return phone.length >= 10 && phone.length <= 15;
}

export function phoneToChatId(phone) {
  return `${phone}@c.us`;
}

export function formatPhone(phone) {
  if (!phone) return '';
  if (phone.length === 11 && phone.startsWith('7')) {
    return `+7 ${phone.slice(1, 4)} ${phone.slice(4, 7)}-${phone.slice(7, 9)}-${phone.slice(9)}`;
  }
  return `+${phone}`;
}

export function digitsFromPersonalChatId(chatId) {
  const raw = String(chatId ?? '');
  if (!raw.endsWith('@c.us')) return '';
  return raw.slice(0, -5).replace(/\D/g, '');
}
