import { randomBytes } from 'node:crypto';
import bcrypt from 'bcrypt';

const BCRYPT_ROUNDS = 12;
const INVITE_ALPHABET = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';

export async function hashSecret(plain) {
  return bcrypt.hash(plain, BCRYPT_ROUNDS);
}

export async function verifySecret(plain, hash) {
  if (!hash) return false;
  return bcrypt.compare(plain, hash);
}

export function generateInviteCode() {
  const bytes = randomBytes(8);
  let out = '';
  for (let i = 0; i < 8; i += 1) {
    out += INVITE_ALPHABET[bytes[i] % INVITE_ALPHABET.length];
    if (i === 3) out += '-';
  }
  return out;
}

export function generateToken() {
  return randomBytes(32).toString('hex');
}

export function validatePasswordStrength(password) {
  if (typeof password !== 'string') return 'Passord mangler.';
  if (password.length < 8) return 'Passordet må være minst 8 tegn.';
  if (password.length > 200) return 'Passordet er for langt.';
  return null;
}
