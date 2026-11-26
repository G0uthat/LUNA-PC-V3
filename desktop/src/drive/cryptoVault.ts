import { DriveCredentials } from './driveTypes';

const VAULT_DB_NAME = 'luma_crypto_vault_v1';
const VAULT_STORE = 'keys';
const VAULT_KEY_ID = 'device_aes_key';
const CREDENTIALS_LS_KEY = 'luma_drive_creds_enc_v1';

function openVaultDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(VAULT_DB_NAME, 1);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(VAULT_STORE)) {
        db.createObjectStore(VAULT_STORE);
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

async function getOrCreateDeviceKey(): Promise<CryptoKey | null> {
  if (typeof crypto === 'undefined' || !crypto.subtle) return null;
  try {
    const db = await openVaultDb();
    const existing = await new Promise<CryptoKey | undefined>((resolve, reject) => {
      const tx = db.transaction(VAULT_STORE, 'readonly');
      const req = tx.objectStore(VAULT_STORE).get(VAULT_KEY_ID);
      req.onsuccess = () => resolve(req.result as CryptoKey | undefined);
      req.onerror = () => reject(req.error);
    });
    if (existing) {
      db.close();
      return existing;
    }

    const generated = await crypto.subtle.generateKey(
      { name: 'AES-GCM', length: 256 },
      false, // non-extractable device key!
      ['encrypt', 'decrypt']
    );

    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(VAULT_STORE, 'readwrite');
      tx.objectStore(VAULT_STORE).put(generated, VAULT_KEY_ID);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
    return generated;
  } catch {
    return null;
  }
}

function bytesToBase64(bytes: Uint8Array): string {
  let binary = '';
  for (let i = 0; i < bytes.length; i++) {
    binary += String.fromCharCode(bytes[i]);
  }
  return btoa(binary);
}

function base64ToBytes(b64: string): Uint8Array {
  const binary = atob(b64);
  const out = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    out[i] = binary.charCodeAt(i);
  }
  return out;
}

export async function saveEncryptedCredentials(creds: DriveCredentials): Promise<{ encrypted: boolean }> {
  const payload = JSON.stringify({
    clientId: creds.clientId.trim(),
    apiKey: creds.apiKey?.trim() || '',
    scopeMode: creds.scopeMode,
  });

  const key = await getOrCreateDeviceKey();
  if (key && crypto.subtle) {
    const iv = crypto.getRandomValues(new Uint8Array(12));
    const encoded = new TextEncoder().encode(payload);
    const cipherBuf = await crypto.subtle.encrypt({ name: 'AES-GCM', iv }, key, encoded);
    const wrapped = JSON.stringify({
      v: 1,
      enc: true,
      iv: bytesToBase64(iv),
      ct: bytesToBase64(new Uint8Array(cipherBuf)),
    });
    localStorage.setItem(CREDENTIALS_LS_KEY, wrapped);
    return { encrypted: true };
  }

  // Fallback for non-secure HTTP contexts where crypto.subtle is unavailable
  localStorage.setItem(
    CREDENTIALS_LS_KEY,
    JSON.stringify({ v: 1, enc: false, raw: btoa(unescape(encodeURIComponent(payload))) })
  );
  return { encrypted: false };
}

export async function loadEncryptedCredentials(): Promise<DriveCredentials | null> {
  const raw = localStorage.getItem(CREDENTIALS_LS_KEY);
  if (!raw) return null;
  try {
    const parsed = JSON.parse(raw) as {
      v: number;
      enc: boolean;
      iv?: string;
      ct?: string;
      raw?: string;
    };

    if (parsed.enc && parsed.iv && parsed.ct) {
      const key = await getOrCreateDeviceKey();
      if (!key || !crypto.subtle) return null;
      const ivBytes = base64ToBytes(parsed.iv);
      const ctBytes = base64ToBytes(parsed.ct);
      const ivBuf = ivBytes.buffer.slice(ivBytes.byteOffset, ivBytes.byteOffset + ivBytes.byteLength) as ArrayBuffer;
      const ctBuf = ctBytes.buffer.slice(ctBytes.byteOffset, ctBytes.byteOffset + ctBytes.byteLength) as ArrayBuffer;
      const plainBuf = await crypto.subtle.decrypt(
        { name: 'AES-GCM', iv: new Uint8Array(ivBuf) },
        key,
        ctBuf
      );
      const text = new TextDecoder().decode(plainBuf);
      const data = JSON.parse(text) as DriveCredentials;
      return {
        clientId: data.clientId || '',
        apiKey: data.apiKey || '',
        scopeMode: data.scopeMode === 'drive.file' ? 'drive.file' : 'drive',
      };
    }

    if (!parsed.enc && parsed.raw) {
      const text = decodeURIComponent(escape(atob(parsed.raw)));
      const data = JSON.parse(text) as DriveCredentials;
      return {
        clientId: data.clientId || '',
        apiKey: data.apiKey || '',
        scopeMode: data.scopeMode === 'drive.file' ? 'drive.file' : 'drive',
      };
    }
  } catch {
    return null;
  }
  return null;
}

export function clearEncryptedCredentials(): void {
  localStorage.removeItem(CREDENTIALS_LS_KEY);
}
