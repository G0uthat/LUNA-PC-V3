import {
  DriveAuthState,
  DriveCredentials,
  DriveFileCategory,
  DriveFileItem,
  DriveScopeMode,
} from './driveTypes';
import {
  deleteCachedDriveFile,
  getCachedDriveFile,
  listCachedDriveFileSummaries,
  putCachedDriveFile,
} from './driveCache';

const DRIVE_API = 'https://www.googleapis.com/drive/v3';
const DRIVE_UPLOAD_API = 'https://www.googleapis.com/upload/drive/v3';
const FOLDER_MIME = 'application/vnd.google-apps.folder';

// Strict in-memory token store (NEVER written to localStorage/sessionStorage!)
let inMemoryAccessToken: string | null = null;
let inMemoryTokenExpiresAt = 0;
let inMemoryCreds: DriveCredentials | null = null;
let inMemoryUser: { email?: string; name?: string; picture?: string } = {};
let refreshTimerId: number | null = null;

type AuthListener = (state: DriveAuthState) => void;
const authListeners = new Set<AuthListener>();

function emitAuthState() {
  const snapshot = getDriveAuthState();
  authListeners.forEach((cb) => cb(snapshot));
}

export function subscribeDriveAuth(listener: AuthListener): () => void {
  authListeners.add(listener);
  listener(getDriveAuthState());
  return () => {
    authListeners.delete(listener);
  };
}

export function getDriveAuthState(): DriveAuthState {
  const valid = Boolean(inMemoryAccessToken && Date.now() < inMemoryTokenExpiresAt - 15_000);
  return {
    connected: valid,
    email: valid ? inMemoryUser.email : undefined,
    name: valid ? inMemoryUser.name : undefined,
    picture: valid ? inMemoryUser.picture : undefined,
    expiresAt: valid ? inMemoryTokenExpiresAt : undefined,
    scopeMode: inMemoryCreds?.scopeMode ?? 'drive',
  };
}

export function getInMemoryAccessToken(): string | null {
  if (!inMemoryAccessToken) return null;
  if (Date.now() >= inMemoryTokenExpiresAt - 10_000) return null;
  return inMemoryAccessToken;
}

/* --------------------------------------------------------------------------
 * Folder URL Parser — Supports ALL Google Drive link formats
 * ------------------------------------------------------------------------*/
export function extractDriveFolderId(rawInput: string): string | null {
  const input = rawInput.trim();
  if (!input) return null;

  // 1. /folders/{ID} (supports /drive/folders/ID, /drive/u/0/folders/ID, ?usp=sharing, etc.)
  const folderMatch = input.match(/\/folders\/([a-zA-Z0-9_-]{10,})/);
  if (folderMatch) return folderMatch[1];

  // 2. ?id={ID} or &id={ID}
  const queryIdMatch = input.match(/[?&]id=([a-zA-Z0-9_-]{10,})/);
  if (queryIdMatch) return queryIdMatch[1];

  // 3. Raw Google Drive folder ID (20-64 alphanumeric + _ -)
  if (/^[a-zA-Z0-9_-]{15,80}$/.test(input)) {
    return input;
  }

  return null;
}

/* --------------------------------------------------------------------------
 * Friendly Spanish Error Translator
 * ------------------------------------------------------------------------*/
export function translateDriveError(err: unknown): string {
  if (!navigator.onLine) {
    return 'Sin conexión a internet. Luma guardará tus cambios localmente y sincronizará al volver la red.';
  }
  const msg = err instanceof Error ? err.message : String(err ?? '');
  const lower = msg.toLowerCase();

  if (lower.includes('401') || lower.includes('invalid credentials') || lower.includes('unauthenticated')) {
    return 'Tu sesión de Google Drive expiró. Pulsa «Iniciar sesión con Google» para renovarla.';
  }
  if (lower.includes('403') || lower.includes('insufficient') || lower.includes('forbidden')) {
    if (lower.includes('storagequotaexceeded') || lower.includes('quota')) {
      return 'Tu Google Drive no tiene espacio disponible o alcanzó el límite de cuota.';
    }
    return 'Sin permisos suficientes para acceder a esa carpeta. Comprueba que tu cuenta tenga acceso o activa el alcance de lectura de carpetas.';
  }
  if (lower.includes('404') || lower.includes('not found')) {
    return 'La carpeta o archivo ya no existe en Google Drive o fue eliminado.';
  }
  if (lower.includes('429') || lower.includes('rate limit')) {
    return 'Google Drive pidió esperar unos segundos por demasiadas solicitudes. Intenta de nuevo en un momento.';
  }
  if (lower.includes('popup_closed') || lower.includes('access_denied')) {
    return 'Inicio de sesión cancelado o permiso rechazado en Google.';
  }
  if (lower.includes('failed to fetch') || lower.includes('network')) {
    return 'No se pudo contactar con Google Drive. Revisa tu conexión a internet.';
  }
  return msg || 'Ocurrió un error al comunicarse con Google Drive.';
}

/* --------------------------------------------------------------------------
 * Google Identity Services (OAuth 2.0 Token Client — Zero Backend)
 * ------------------------------------------------------------------------*/
function buildScopes(mode: DriveScopeMode): string {
  const driveScope =
    mode === 'drive.file'
      ? 'https://www.googleapis.com/auth/drive.file'
      : 'https://www.googleapis.com/auth/drive';
  return `${driveScope} https://www.googleapis.com/auth/userinfo.email https://www.googleapis.com/auth/userinfo.profile`;
}

function scheduleSilentRefresh(creds: DriveCredentials, expiresInSec: number) {
  if (refreshTimerId) {
    window.clearTimeout(refreshTimerId);
    refreshTimerId = null;
  }
  const delayMs = Math.max(60_000, (expiresInSec - 240) * 1000);
  refreshTimerId = window.setTimeout(() => {
    if (!inMemoryAccessToken || !navigator.onLine) return;
    signInWithGoogleDrive(creds, { silent: true }).catch(() => {
      // If silent refresh fails, user will be prompted clearly on next Drive call
      inMemoryAccessToken = null;
      inMemoryTokenExpiresAt = 0;
      emitAuthState();
    });
  }, delayMs);
}

async function fetchGoogleUserInfo(token: string): Promise<void> {
  try {
    const res = await fetch('https://www.googleapis.com/oauth2/v3/userinfo', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return;
    const data = (await res.json()) as { email?: string; name?: string; picture?: string };
    inMemoryUser = { email: data.email, name: data.name, picture: data.picture };
  } catch {
    // non-fatal
  }
}

export async function signInWithGoogleDrive(
  creds: DriveCredentials,
  options?: { silent?: boolean }
): Promise<DriveAuthState> {
  if (!navigator.onLine) {
    throw new Error('Sin conexión a internet para iniciar sesión con Google.');
  }
  const cleanClientId = creds.clientId.trim();
  if (!cleanClientId) {
    throw new Error('Primero introduce tu Client ID de Google OAuth en Ajustes → Fuentes.');
  }

  // Wait up to 3s for GIS script to load
  let waited = 0;
  while (!window.google?.accounts?.oauth2 && waited < 3000) {
    await new Promise((r) => window.setTimeout(r, 120));
    waited += 120;
  }
  const oauth2 = window.google?.accounts?.oauth2;
  if (!oauth2) {
    throw new Error(
      'No se pudo cargar Google Identity Services. Verifica tu conexión o bloqueadores de scripts.'
    );
  }

  inMemoryCreds = { ...creds, clientId: cleanClientId };

  return new Promise<DriveAuthState>((resolve, reject) => {
    try {
      const client = oauth2.initTokenClient({
        client_id: cleanClientId,
        scope: buildScopes(creds.scopeMode),
        callback: async (resp) => {
          if (resp.error || !resp.access_token) {
            reject(new Error(resp.error_description || resp.error || 'access_denied'));
            return;
          }
          const expiresIn = resp.expires_in ?? 3500;
          inMemoryAccessToken = resp.access_token;
          inMemoryTokenExpiresAt = Date.now() + expiresIn * 1000;
          await fetchGoogleUserInfo(resp.access_token);
          scheduleSilentRefresh(inMemoryCreds!, expiresIn);
          emitAuthState();
          resolve(getDriveAuthState());
        },
        error_callback: (err) => {
          reject(new Error(err.message || err.type || 'popup_closed'));
        },
      });

      client.requestAccessToken({
        prompt: options?.silent ? '' : inMemoryAccessToken ? '' : 'consent',
        hint: inMemoryUser.email,
      });
    } catch (err) {
      reject(err);
    }
  });
}

export function signOutGoogleDrive(): void {
  if (refreshTimerId) {
    window.clearTimeout(refreshTimerId);
    refreshTimerId = null;
  }
  const token = inMemoryAccessToken;
  inMemoryAccessToken = null;
  inMemoryTokenExpiresAt = 0;
  inMemoryUser = {};
  if (token && window.google?.accounts?.oauth2?.revoke) {
    try {
      window.google.accounts.oauth2.revoke(token);
    } catch {
      // ignore
    }
  }
  emitAuthState();
}

/* --------------------------------------------------------------------------
 * Google Picker (for selecting folders cleanly under drive.file or drive)
 * ------------------------------------------------------------------------*/
export async function pickDriveFolderWithGooglePicker(
  apiKey?: string
): Promise<{ id: string; name: string } | null> {
  const token = getInMemoryAccessToken();
  if (!token) {
    throw new Error('Inicia sesión con Google antes de abrir el selector de carpetas.');
  }
  if (!window.gapi) {
    throw new Error('Google Picker aún no está listo. Intenta de nuevo en unos segundos.');
  }

  await new Promise<void>((resolve) => {
    window.gapi!.load('picker', () => resolve());
  });

  const pickerNs = window.google?.picker;
  if (!pickerNs) {
    throw new Error('No se pudo inicializar Google Picker.');
  }

  return new Promise<{ id: string; name: string } | null>((resolve) => {
    const view = new pickerNs.DocsView(pickerNs.ViewId.FOLDERS);
    view.setIncludeFolders(true);
    view.setSelectFolderEnabled(true);
    view.setMimeTypes(FOLDER_MIME);

    const builder = new pickerNs.PickerBuilder();
    builder.addView(view);
    builder.setOAuthToken(token);
    if (apiKey?.trim()) {
      builder.setDeveloperKey(apiKey.trim());
    }
    builder.setTitle('Selecciona una carpeta de Google Drive para Luma');
    builder.setCallback((data) => {
      if (data.action === pickerNs.Action.PICKED && data.docs && data.docs[0]) {
        resolve({ id: data.docs[0].id, name: data.docs[0].name });
      } else if (data.action === pickerNs.Action.CANCEL) {
        resolve(null);
      }
    });
    builder.build().setVisible(true);
  });
}

/* --------------------------------------------------------------------------
 * Authenticated Fetch Helper
 * ------------------------------------------------------------------------*/
async function driveFetch(url: string, init?: RequestInit): Promise<Response> {
  if (!navigator.onLine) {
    throw new Error('offline');
  }
  const token = getInMemoryAccessToken();
  if (!token) {
    throw new Error('401 unauthenticated');
  }
  const headers = new Headers(init?.headers ?? {});
  headers.set('Authorization', `Bearer ${token}`);
  const res = await fetch(url, { ...init, headers });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(`${res.status} ${text || res.statusText}`);
  }
  return res;
}

/* --------------------------------------------------------------------------
 * File Categorizer
 * ------------------------------------------------------------------------*/
export function categorizeDriveFile(name: string, mimeType: string): DriveFileCategory {
  if (mimeType === FOLDER_MIME) return 'folder';
  const lower = name.toLowerCase();
  if (lower.endsWith('.luma.json') || lower.endsWith('.luma')) return 'notebook';
  if (mimeType === 'application/pdf' || lower.endsWith('.pdf')) return 'pdf';
  if (
    mimeType === 'application/vnd.openxmlformats-officedocument.wordprocessingml.document' ||
    lower.endsWith('.docx')
  ) {
    return 'docx';
  }
  if (
    mimeType.startsWith('image/') ||
    /\.(png|jpe?g|webp|gif|bmp|avif)$/i.test(lower)
  ) {
    return 'image';
  }
  if (/\.(epub|pptx|txt|md|fb2)$/i.test(lower)) return 'book';
  return 'other';
}

/* --------------------------------------------------------------------------
 * Validate Folder & List Folder Contents (with pagination + optional subfolders)
 * ------------------------------------------------------------------------*/
export async function validateDriveFolder(
  folderId: string
): Promise<{ id: string; name: string; canEdit: boolean }> {
  const fields = encodeURIComponent('id,name,mimeType,trashed,capabilities(canAddChildren)');
  const res = await driveFetch(
    `${DRIVE_API}/files/${encodeURIComponent(folderId)}?fields=${fields}&supportsAllDrives=true`
  );
  const data = (await res.json()) as {
    id: string;
    name: string;
    mimeType: string;
    trashed?: boolean;
    capabilities?: { canAddChildren?: boolean };
  };
  if (data.trashed) {
    throw new Error('404 carpeta en papelera');
  }
  if (data.mimeType !== FOLDER_MIME) {
    throw new Error('El enlace ingresado no corresponde a una carpeta de Google Drive.');
  }
  return {
    id: data.id,
    name: data.name,
    canEdit: data.capabilities?.canAddChildren !== false,
  };
}

interface RawDriveFile {
  id: string;
  name: string;
  mimeType: string;
  size?: string;
  modifiedTime?: string;
  thumbnailLink?: string;
  webViewLink?: string;
}

export async function listDriveFolderPage(
  sourceId: string,
  folderId: string,
  pageToken?: string,
  pageSize = 60
): Promise<{ files: DriveFileItem[]; nextPageToken?: string }> {
  const q = encodeURIComponent(`'${folderId}' in parents and trashed = false`);
  const fields = encodeURIComponent(
    'nextPageToken,files(id,name,mimeType,size,modifiedTime,thumbnailLink,webViewLink)'
  );
  const tokenParam = pageToken ? `&pageToken=${encodeURIComponent(pageToken)}` : '';
  const url = `${DRIVE_API}/files?q=${q}&fields=${fields}&pageSize=${pageSize}&orderBy=folder,modifiedTime desc&supportsAllDrives=true&includeItemsFromAllDrives=true${tokenParam}`;

  const res = await driveFetch(url);
  const data = (await res.json()) as { files?: RawDriveFile[]; nextPageToken?: string };
  const cachedSummaries = await listCachedDriveFileSummaries();
  const cacheMap = new Map(cachedSummaries.map((s) => [s.fileId, s]));

  const items: DriveFileItem[] = (data.files ?? []).map((f) => {
    const isFolder = f.mimeType === FOLDER_MIME;
    const category = categorizeDriveFile(f.name, f.mimeType);
    const cacheEntry = cacheMap.get(f.id);
    const sizeNum = Number(f.size ?? 0) || 0;
    const partialPct =
      cacheEntry && !cacheEntry.completed && sizeNum > 0
        ? Math.min(99, Math.round((cacheEntry.downloadedBytes / sizeNum) * 100))
        : undefined;

    return {
      id: f.id,
      name: f.name,
      mimeType: f.mimeType,
      size: sizeNum,
      modifiedTime: f.modifiedTime ?? new Date().toISOString(),
      sourceId,
      parentFolderId: folderId,
      thumbnailLink: f.thumbnailLink,
      webViewLink: f.webViewLink,
      isFolder,
      category,
      downloaded: Boolean(cacheEntry?.completed),
      partialPercent: partialPct,
      syncState: 'synced',
    };
  });

  return { files: items, nextPageToken: data.nextPageToken };
}

/** Recursively indexes a folder + its subfolders (capped cleanly for mobile memory) */
export async function listDriveFolderRecursive(
  sourceId: string,
  rootFolderId: string,
  maxDepth = 3
): Promise<DriveFileItem[]> {
  const allFiles: DriveFileItem[] = [];
  const queue: Array<{ folderId: string; path: string; depth: number }> = [
    { folderId: rootFolderId, path: '', depth: 0 },
  ];

  while (queue.length > 0 && allFiles.length < 300) {
    const current = queue.shift()!;
    let pageToken: string | undefined;
    do {
      const page = await listDriveFolderPage(sourceId, current.folderId, pageToken, 60);
      for (const item of page.files) {
        if (item.isFolder) {
          if (current.depth < maxDepth) {
            queue.push({
              folderId: item.id,
              path: current.path ? `${current.path} / ${item.name}` : item.name,
              depth: current.depth + 1,
            });
          }
        } else {
          allFiles.push({
            ...item,
            folderPath: current.path || undefined,
          });
        }
      }
      pageToken = page.nextPageToken;
    } while (pageToken && allFiles.length < 300);
  }

  return allFiles;
}

/* --------------------------------------------------------------------------
 * Resumable Download with HTTP Range, Speed, Pause, Resume, Cancel
 * ------------------------------------------------------------------------*/
export interface ResumableDownloadController {
  pause: () => void;
  cancel: () => void;
}

export async function downloadDriveFileResumable(
  file: DriveFileItem,
  callbacks: {
    onProgress: (info: {
      loadedBytes: number;
      totalBytes: number;
      percent: number;
      speedBytesPerSec: number;
    }) => void;
    onControllerReady?: (ctrl: ResumableDownloadController) => void;
  }
): Promise<{ blob: Blob; status: 'completed' | 'paused' | 'cancelled' }> {
  const token = getInMemoryAccessToken();
  if (!token) throw new Error('401 unauthenticated');

  const existing = await getCachedDriveFile(file.id);
  if (existing?.completed && existing.blob) {
    callbacks.onProgress({
      loadedBytes: existing.totalSize || existing.blob.size,
      totalBytes: existing.totalSize || existing.blob.size,
      percent: 100,
      speedBytesPerSec: 0,
    });
    return { blob: existing.blob, status: 'completed' };
  }

  let paused = false;
  let cancelled = false;
  let abortCtrl = new AbortController();

  callbacks.onControllerReady?.({
    pause: () => {
      paused = true;
      abortCtrl.abort();
    },
    cancel: () => {
      cancelled = true;
      abortCtrl.abort();
    },
  });

  const chunks: BlobPart[] = [];
  let loadedBytes = 0;
  if (existing && !existing.completed && existing.blob && existing.downloadedBytes > 0) {
    chunks.push(existing.blob);
    loadedBytes = existing.downloadedBytes;
  }

  const totalExpected = file.size > 0 ? file.size : 0;
  const CHUNK_SIZE = 512 * 1024; // 512KB ranges so pause/resume works reliably on mobile!
  const url = `${DRIVE_API}/files/${encodeURIComponent(file.id)}?alt=media&supportsAllDrives=true`;

  try {
    // If file size is known and > 0, download in resumable HTTP Range chunks
    if (totalExpected > 0) {
      while (loadedBytes < totalExpected) {
        if (paused || cancelled) break;
        const rangeEnd = Math.min(totalExpected - 1, loadedBytes + CHUNK_SIZE - 1);
        abortCtrl = new AbortController();
        const t0 = performance.now();

        const res = await fetch(url, {
          headers: {
            Authorization: `Bearer ${token}`,
            Range: `bytes=${loadedBytes}-${rangeEnd}`,
          },
          signal: abortCtrl.signal,
        });

        if (!res.ok && res.status !== 206) {
          throw new Error(`${res.status} ${res.statusText}`);
        }

        const buf = await res.arrayBuffer();
        chunks.push(buf);
        loadedBytes += buf.byteLength;
        const elapsedSec = Math.max(0.05, (performance.now() - t0) / 1000);
        const speed = Math.round(buf.byteLength / elapsedSec);
        const percent = Math.min(100, Math.round((loadedBytes / totalExpected) * 100));

        callbacks.onProgress({
          loadedBytes,
          totalBytes: totalExpected,
          percent,
          speedBytesPerSec: speed,
        });

        // Checkpoint partial blob so resume works even after closing the modal/tab
        const partialBlob = new Blob(chunks, { type: file.mimeType || 'application/octet-stream' });
        await putCachedDriveFile({
          fileId: file.id,
          name: file.name,
          mimeType: file.mimeType,
          totalSize: totalExpected,
          modifiedTime: file.modifiedTime,
          completed: loadedBytes >= totalExpected,
          blob: partialBlob,
          downloadedBytes: loadedBytes,
          updatedAt: Date.now(),
        });

        if (buf.byteLength === 0) break;
      }
    } else {
      // Unknown file size: stream directly
      abortCtrl = new AbortController();
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${token}` },
        signal: abortCtrl.signal,
      });
      if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
      const t0 = performance.now();
      const reader = res.body?.getReader();
      if (reader) {
        while (true) {
          if (paused || cancelled) break;
          const { done, value } = await reader.read();
          if (done) break;
          if (value) {
            chunks.push(value);
            loadedBytes += value.byteLength;
            const elapsedSec = Math.max(0.1, (performance.now() - t0) / 1000);
            callbacks.onProgress({
              loadedBytes,
              totalBytes: loadedBytes,
              percent: 50,
              speedBytesPerSec: Math.round(loadedBytes / elapsedSec),
            });
          }
        }
      } else {
        const buf = await res.arrayBuffer();
        chunks.push(buf);
        loadedBytes = buf.byteLength;
      }
    }
  } catch (err) {
    if (cancelled) {
      await deleteCachedDriveFile(file.id);
      return { blob: new Blob(), status: 'cancelled' };
    }
    if (paused) {
      const partialBlob = new Blob(chunks, { type: file.mimeType || 'application/octet-stream' });
      await putCachedDriveFile({
        fileId: file.id,
        name: file.name,
        mimeType: file.mimeType,
        totalSize: totalExpected || loadedBytes,
        modifiedTime: file.modifiedTime,
        completed: false,
        blob: partialBlob,
        downloadedBytes: loadedBytes,
        updatedAt: Date.now(),
      });
      return { blob: partialBlob, status: 'paused' };
    }
    throw err;
  }

  if (cancelled) {
    await deleteCachedDriveFile(file.id);
    return { blob: new Blob(), status: 'cancelled' };
  }

  const finalBlob = new Blob(chunks, { type: file.mimeType || 'application/octet-stream' });
  if (paused) {
    await putCachedDriveFile({
      fileId: file.id,
      name: file.name,
      mimeType: file.mimeType,
      totalSize: totalExpected || loadedBytes,
      modifiedTime: file.modifiedTime,
      completed: false,
      blob: finalBlob,
      downloadedBytes: loadedBytes,
      updatedAt: Date.now(),
    });
    return { blob: finalBlob, status: 'paused' };
  }

  await putCachedDriveFile({
    fileId: file.id,
    name: file.name,
    mimeType: file.mimeType,
    totalSize: finalBlob.size,
    modifiedTime: file.modifiedTime,
    completed: true,
    blob: finalBlob,
    downloadedBytes: finalBlob.size,
    updatedAt: Date.now(),
  });

  callbacks.onProgress({
    loadedBytes: finalBlob.size,
    totalBytes: finalBlob.size,
    percent: 100,
    speedBytesPerSec: 0,
  });

  return { blob: finalBlob, status: 'completed' };
}

/* --------------------------------------------------------------------------
 * Drive v3 Resumable Upload Protocol (Notebooks .luma.json & Imported Files)
 * ------------------------------------------------------------------------*/
export async function uploadFileResumable(params: {
  parentFolderId: string;
  fileName: string;
  mimeType: string;
  content: Blob | string;
  existingFileId?: string;
  onProgress?: (percent: number) => void;
}): Promise<{ id: string; modifiedTime: string; size: number }> {
  const token = getInMemoryAccessToken();
  if (!token) throw new Error('401 unauthenticated');

  const blob =
    typeof params.content === 'string'
      ? new Blob([params.content], { type: params.mimeType })
      : params.content;

  const isUpdate = Boolean(params.existingFileId);
  const initUrl = isUpdate
    ? `${DRIVE_UPLOAD_API}/files/${encodeURIComponent(params.existingFileId!)}?uploadType=resumable&fields=id,modifiedTime,size&supportsAllDrives=true`
    : `${DRIVE_UPLOAD_API}/files?uploadType=resumable&fields=id,modifiedTime,size&supportsAllDrives=true`;

  const metadata: Record<string, unknown> = {
    name: params.fileName,
    mimeType: params.mimeType,
  };
  if (!isUpdate) {
    metadata.parents = [params.parentFolderId];
  }

  // Step 1: Initiate resumable upload session
  const initRes = await fetch(initUrl, {
    method: isUpdate ? 'PATCH' : 'POST',
    headers: {
      Authorization: `Bearer ${token}`,
      'Content-Type': 'application/json; charset=UTF-8',
      'X-Upload-Content-Type': params.mimeType,
      'X-Upload-Content-Length': String(blob.size),
    },
    body: JSON.stringify(metadata),
  });

  if (!initRes.ok) {
    const errText = await initRes.text().catch(() => '');
    throw new Error(`${initRes.status} ${errText || initRes.statusText}`);
  }

  const uploadUrl = initRes.headers.get('Location');
  if (!uploadUrl) {
    throw new Error('Google Drive no devolvió la URL de subida reanudable.');
  }

  // Step 2: Upload bytes in 512KB chunks (multiple of 256KB as required by Google Drive resumable API)
  const CHUNK_SIZE = 512 * 1024;
  let offset = 0;
  let finalMeta: { id: string; modifiedTime?: string; size?: string } | null = null;

  if (blob.size === 0) {
    const emptyRes = await fetch(uploadUrl, {
      method: 'PUT',
      headers: { 'Content-Type': params.mimeType },
      body: blob,
    });
    if (!emptyRes.ok) throw new Error(`${emptyRes.status} ${emptyRes.statusText}`);
    finalMeta = (await emptyRes.json()) as { id: string; modifiedTime?: string; size?: string };
    params.onProgress?.(100);
  } else {
    while (offset < blob.size) {
      const end = Math.min(blob.size, offset + CHUNK_SIZE);
      const chunk = blob.slice(offset, end);
      const putRes = await fetch(uploadUrl, {
        method: 'PUT',
        headers: {
          'Content-Type': params.mimeType,
          'Content-Range': `bytes ${offset}-${end - 1}/${blob.size}`,
        },
        body: chunk,
      });

      if (putRes.status === 308) {
        offset = end;
        params.onProgress?.(Math.round((offset / blob.size) * 100));
        continue;
      }
      if (!putRes.ok) {
        const errText = await putRes.text().catch(() => '');
        throw new Error(`${putRes.status} ${errText || putRes.statusText}`);
      }
      finalMeta = (await putRes.json()) as { id: string; modifiedTime?: string; size?: string };
      offset = blob.size;
      params.onProgress?.(100);
    }
  }

  return {
    id: finalMeta?.id ?? params.existingFileId ?? '',
    modifiedTime: finalMeta?.modifiedTime ?? new Date().toISOString(),
    size: Number(finalMeta?.size ?? blob.size) || blob.size,
  };
}

/* --------------------------------------------------------------------------
 * Metadata, Rename, Move, Delete (Drive v3)
 * ------------------------------------------------------------------------*/
export async function getDriveFileMetadata(
  fileId: string
): Promise<{ id: string; name: string; modifiedTime: string; size: number } | null> {
  try {
    const res = await driveFetch(
      `${DRIVE_API}/files/${encodeURIComponent(fileId)}?fields=id,name,modifiedTime,size,trashed&supportsAllDrives=true`
    );
    const data = (await res.json()) as {
      id: string;
      name: string;
      modifiedTime?: string;
      size?: string;
      trashed?: boolean;
    };
    if (data.trashed) return null;
    return {
      id: data.id,
      name: data.name,
      modifiedTime: data.modifiedTime ?? '',
      size: Number(data.size ?? 0) || 0,
    };
  } catch {
    return null;
  }
}

export async function renameDriveFile(fileId: string, newName: string): Promise<void> {
  await driveFetch(
    `${DRIVE_API}/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`,
    {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ name: newName.trim() }),
    }
  );
}

export async function moveDriveFile(
  fileId: string,
  oldParentFolderId: string,
  newParentFolderId: string
): Promise<void> {
  const qs = `addParents=${encodeURIComponent(newParentFolderId)}&removeParents=${encodeURIComponent(oldParentFolderId)}&supportsAllDrives=true`;
  await driveFetch(`${DRIVE_API}/files/${encodeURIComponent(fileId)}?${qs}`, {
    method: 'PATCH',
  });
}

export async function deleteDriveFile(fileId: string): Promise<void> {
  await driveFetch(
    `${DRIVE_API}/files/${encodeURIComponent(fileId)}?supportsAllDrives=true`,
    { method: 'DELETE' }
  );
}

/** Check if network is Wi-Fi / non-cellular when policy === 'wifi_only' */
export function canAutoSyncNow(policy: 'manual' | 'wifi_only' | 'always'): boolean {
  if (!navigator.onLine) return false;
  if (policy === 'manual') return false;
  if (policy === 'always') return true;
  const conn = (navigator as unknown as { connection?: { type?: string; saveData?: boolean } })
    .connection;
  if (!conn) return true;
  if (conn.saveData) return false;
  if (conn.type && conn.type === 'cellular') return false;
  return true;
}
