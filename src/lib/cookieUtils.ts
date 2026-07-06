import { GitHubCredentials } from "../types";

/**
 * Encrypts/Obfuscates a string to avoid storing raw credentials in plain text cookies.
 */
export function obfuscate(str: string): string {
  try {
    return btoa(
      str
        .split("")
        .map((char) => String.fromCharCode(char.charCodeAt(0) ^ 42))
        .join("")
    );
  } catch (e) {
    return "";
  }
}

/**
 * Decrypts/Deobfuscates an obfuscated string back to its original plain text.
 */
export function deobfuscate(str: string): string {
  try {
    return atob(str)
      .split("")
      .map((char) => String.fromCharCode(char.charCodeAt(0) ^ 42))
      .join("");
  } catch (e) {
    return "";
  }
}

const COOKIE_NAME = "gh_pusher_creds";

/**
 * Saves credentials in an obfuscated cookie.
 */
export function saveCredentials(creds: GitHubCredentials): void {
  const jsonStr = JSON.stringify(creds);
  const encryptedValue = obfuscate(jsonStr);
  const maxAge = 365 * 24 * 60 * 60; // 1 year in seconds
  document.cookie = `${COOKIE_NAME}=${encodeURIComponent(encryptedValue)}; path=/; max-age=${maxAge}; SameSite=Lax; Secure`;
}

/**
 * Retrieves ofubscated credentials from cookies.
 */
export function getCredentials(): GitHubCredentials | null {
  const value = `; ${document.cookie}`;
  const parts = value.split(`; ${COOKIE_NAME}=`);
  if (parts.length === 2) {
    try {
      const encryptedValue = decodeURIComponent(parts.pop()!.split(";").shift()!);
      const decryptedJson = deobfuscate(encryptedValue);
      if (decryptedJson) {
        const creds = JSON.parse(decryptedJson) as GitHubCredentials;
        if (creds.username && creds.token) {
          return creds;
        }
      }
    } catch (e) {
      console.error("Failed to parse credentials from cookie", e);
    }
  }
  return null;
}

/**
 * Removes cached credentials cookie.
 */
export function clearCredentials(): void {
  document.cookie = `${COOKIE_NAME}=; path=/; expires=Thu, 01 Jan 1970 00:00:00 GMT; SameSite=Lax; Secure`;
}
