import { DriveSource, StorageQuotaInfo, SyncQueueJob } from './driveTypes';

const CACHE_DB_NAME = 'luma_drive_cache_v1';
const CACHE_DB_VERSION = 1;
const FILES_STORE = 'cached_files';
const THUMBS_STORE = 'thumbnails';
const QUEUE_STORE = 'sync_queue';
const SOURCES_LS_KEY = 'luma_drive_sources_v1';

export interface CachedDriveFileRecord {
  fileId: string;
  name: string;
  mimeType: string;
  totalSize: number;
  modifiedTime: string;
  completed: boolean;
  /** Accumulated ArrayBuffer chunks or final single Blob */
  blob: Blob;
  downloadedBytes: number;
  updatedAt: number;
}

function openCacheDb(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const req = indexedDB.open(CACHE_DB_NAME, CACHE_DB_VERSION);
    req.onupgradeneeded = () => {
      const db = req.result;
      if (!db.objectStoreNames.contains(FILES_STORE)) {
        db.createObjectStore(FILES_STORE, { keyPath: 'fileId' });
      }
      if (!db.objectStoreNames.contains(THUMBS_STORE)) {
        db.createObjectStore(THUMBS_STORE);
      }
      if (!db.objectStoreNames.contains(QUEUE_STORE)) {
        db.createObjectStore(QUEUE_STORE, { keyPath: 'id' });
      }
    };
    req.onsuccess = () => resolve(req.result);
    req.onerror = () => reject(req.error);
  });
}

/* --------------------------------------------------------------------------
 * Drive Sources Persistence
 * ------------------------------------------------------------------------*/
export function loadDriveSources(): DriveSource[] {
  try {
    const raw = localStorage.getItem(SOURCES_LS_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as DriveSource[];
    return Array.isArray(parsed) ? parsed : [];
  } catch {
    return [];
  }
}

export function saveDriveSources(sources: DriveSource[]): void {
  try {
    localStorage.setItem(SOURCES_LS_KEY, JSON.stringify(sources));
  } catch {
    // ignore quota issues
  }
}

/* --------------------------------------------------------------------------
 * Cached Files (Full + Resumable Partial Blobs)
 * ------------------------------------------------------------------------*/
export async function getCachedDriveFile(fileId: string): Promise<CachedDriveFileRecord | null> {
  try {
    const db = await openCacheDb();
    const record = await new Promise<CachedDriveFileRecord | undefined>((resolve, reject) => {
      const tx = db.transaction(FILES_STORE, 'readonly');
      const req = tx.objectStore(FILES_STORE).get(fileId);
      req.onsuccess = () => resolve(req.result as CachedDriveFileRecord | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return record ?? null;
  } catch {
    return null;
  }
}

export async function putCachedDriveFile(record: CachedDriveFileRecord): Promise<void> {
  const db = await openCacheDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(FILES_STORE, 'readwrite');
    tx.objectStore(FILES_STORE).put(record);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function deleteCachedDriveFile(fileId: string): Promise<void> {
  try {
    const db = await openCacheDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(FILES_STORE, 'readwrite');
      tx.objectStore(FILES_STORE).delete(fileId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore
  }
}

export async function listCachedDriveFileSummaries(): Promise<
  Array<{ fileId: string; completed: boolean; downloadedBytes: number; totalSize: number }>
> {
  try {
    const db = await openCacheDb();
    const items = await new Promise<CachedDriveFileRecord[]>((resolve, reject) => {
      const tx = db.transaction(FILES_STORE, 'readonly');
      const req = tx.objectStore(FILES_STORE).getAll();
      req.onsuccess = () => resolve((req.result as CachedDriveFileRecord[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return items.map((r) => ({
      fileId: r.fileId,
      completed: r.completed,
      downloadedBytes: r.downloadedBytes,
      totalSize: r.totalSize,
    }));
  } catch {
    return [];
  }
}

export async function clearAllCachedDriveFiles(): Promise<void> {
  try {
    const db = await openCacheDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction([FILES_STORE, THUMBS_STORE], 'readwrite');
      tx.objectStore(FILES_STORE).clear();
      tx.objectStore(THUMBS_STORE).clear();
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore
  }
}

/* --------------------------------------------------------------------------
 * Thumbnail Cache (PDF page 1, images, notebooks)
 * ------------------------------------------------------------------------*/
export async function getCachedThumbnail(fileId: string): Promise<string | null> {
  try {
    const db = await openCacheDb();
    const val = await new Promise<string | undefined>((resolve, reject) => {
      const tx = db.transaction(THUMBS_STORE, 'readonly');
      const req = tx.objectStore(THUMBS_STORE).get(fileId);
      req.onsuccess = () => resolve(req.result as string | undefined);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return val ?? null;
  } catch {
    return null;
  }
}

export async function putCachedThumbnail(fileId: string, dataUrl: string): Promise<void> {
  try {
    const db = await openCacheDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(THUMBS_STORE, 'readwrite');
      tx.objectStore(THUMBS_STORE).put(dataUrl, fileId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore
  }
}

/* --------------------------------------------------------------------------
 * Offline Sync Queue (Persisted in IndexedDB)
 * ------------------------------------------------------------------------*/
export async function loadSyncQueue(): Promise<SyncQueueJob[]> {
  try {
    const db = await openCacheDb();
    const jobs = await new Promise<SyncQueueJob[]>((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readonly');
      const req = tx.objectStore(QUEUE_STORE).getAll();
      req.onsuccess = () => resolve((req.result as SyncQueueJob[]) ?? []);
      req.onerror = () => reject(req.error);
    });
    db.close();
    return jobs.sort((a, b) => a.createdAt - b.createdAt);
  } catch {
    return [];
  }
}

export async function enqueueSyncJob(job: SyncQueueJob): Promise<void> {
  const db = await openCacheDb();
  await new Promise<void>((resolve, reject) => {
    const tx = db.transaction(QUEUE_STORE, 'readwrite');
    tx.objectStore(QUEUE_STORE).put(job);
    tx.oncomplete = () => resolve();
    tx.onerror = () => reject(tx.error);
  });
  db.close();
}

export async function removeSyncJob(jobId: string): Promise<void> {
  try {
    const db = await openCacheDb();
    await new Promise<void>((resolve, reject) => {
      const tx = db.transaction(QUEUE_STORE, 'readwrite');
      tx.objectStore(QUEUE_STORE).delete(jobId);
      tx.oncomplete = () => resolve();
      tx.onerror = () => reject(tx.error);
    });
    db.close();
  } catch {
    // ignore
  }
}

/* --------------------------------------------------------------------------
 * Storage Quota Estimator
 * ------------------------------------------------------------------------*/
export async function estimateStorageQuota(): Promise<StorageQuotaInfo> {
  let usageBytes = 0;
  let quotaBytes = 0;
  try {
    if (navigator.storage?.estimate) {
      const est = await navigator.storage.estimate();
      usageBytes = est.usage ?? 0;
      quotaBytes = est.quota ?? 0;
    }
  } catch {
    // ignore
  }

  const summaries = await listCachedDriveFileSummaries();
  const cachedBytes = summaries.reduce((acc, item) => acc + item.downloadedBytes, 0);
  const lowSpaceWarning =
    quotaBytes > 0 && (usageBytes / quotaBytes > 0.85 || quotaBytes - usageBytes < 50 * 1024 * 1024);

  return {
    usageBytes,
    quotaBytes,
    cachedFilesCount: summaries.filter((s) => s.completed).length,
    cachedBytes,
    lowSpaceWarning,
  };
}

export function formatBytes(bytes: number): string {
  if (!bytes || bytes <= 0) return '0 B';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  if (bytes < 1024 * 1024 * 1024) return `${(bytes / (1024 * 1024)).toFixed(2)} MB`;
  return `${(bytes / (1024 * 1024 * 1024)).toFixed(2)} GB`;
}
