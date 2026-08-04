const ALPHABET = "ABCDEFGHJKMNPQRSTUVWXYZ23456789";

export function requestId(): string {
  let s = "";
  for (let i = 0; i < 6; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return `RS-${s}`;
}

export function otp(): string {
  return String(Math.floor(1000 + Math.random() * 9000));
}

export function guardianToken(): string {
  let s = "";
  for (let i = 0; i < 14; i++) {
    s += ALPHABET[Math.floor(Math.random() * ALPHABET.length)];
  }
  return s.toLowerCase();
}
