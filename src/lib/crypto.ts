import CryptoJS from 'crypto-js';

const SECRET_KEY = 'finanai-secure-vault-2298';

/**
 * Encrypts a string value.
 */
export const encryptValue = (value: string): string => {
  if (!value) return '';
  return CryptoJS.AES.encrypt(value, SECRET_KEY).toString();
};

/**
 * Decrypts a string value.
 */
export const decryptValue = (encryptedValue: string): string => {
  if (!encryptedValue) return '';
  try {
    const bytes = CryptoJS.AES.decrypt(encryptedValue, SECRET_KEY);
    return bytes.toString(CryptoJS.enc.Utf8);
  } catch (e) {
    console.error('Decryption failed:', e);
    return '';
  }
};

/**
 * Saves an encrypted value to localStorage.
 */
export const saveSecureSetting = (key: string, value: string) => {
  const encrypted = encryptValue(value);
  localStorage.setItem(`secure_${key}`, encrypted);
};

/**
 * Loads and decrypts a value from localStorage.
 */
export const loadSecureSetting = (key: string): string => {
  const encrypted = localStorage.getItem(`secure_${key}`);
  if (!encrypted) return '';
  return decryptValue(encrypted);
};
