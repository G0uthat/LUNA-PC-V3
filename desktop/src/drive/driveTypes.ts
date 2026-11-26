export type DriveScopeMode = 'drive' | 'drive.file';
export type DriveSyncPolicy = 'manual' | 'wifi_only' | 'always';
export type SyncItemState = 'synced' | 'pending' | 'uploading' | 'error' | 'conflict';
export type DriveFileCategory = 'pdf' | 'docx' | 'image' | 'notebook' | 'book' | 'folder' | 'other';

export interface DriveCredentials {
  clientId: string;
  apiKey?: string;
  scopeMode: DriveScopeMode;
}

export interface DriveAuthState {
  connected: boolean;
  email?: string;
  name?: string;
  picture?: string;
  expiresAt?: number;
  scopeMode: DriveScopeMode;
}

export interface DriveSource {
  id: string;
  name: string;
  folderId: string;
  folderUrl: string;
  color: string;
  active: boolean;
  isDefault: boolean;
  includeSubfolders: boolean;
  lastSyncedAt?: number;
  fileCount?: number;
  errorMessage?: string;
}

export interface DriveFileItem {
  id: string;
  name: string;
  mimeType: string;
  size: number;
  modifiedTime: string;
  sourceId: string;
  parentFolderId: string;
  folderPath?: string;
  thumbnailLink?: string;
  webViewLink?: string;
  isFolder: boolean;
  category: DriveFileCategory;
  /** True when full file blob exists in local IndexedDB cache */
  downloaded: boolean;
  /** Partial download progress 0..100 if paused */
  partialPercent?: number;
  syncState?: SyncItemState;
}

export interface DownloadProgressState {
  fileId: string;
  fileName: string;
  totalBytes: number;
  loadedBytes: number;
  percent: number;
  speedBytesPerSec: number;
  status: 'confirm' | 'downloading' | 'paused' | 'completed' | 'error' | 'cancelled';
  errorMessage?: string;
}

export interface SyncQueueJob {
  id: string;
  kind: 'upload_notebook' | 'upload_document' | 'rename' | 'move' | 'delete';
  targetId: string; // local notebook/doc id or drive file id
  title: string;
  sourceId: string;
  folderId: string;
  driveFileId?: string;
  newName?: string;
  oldFolderId?: string;
  createdAt: number;
  attempts: number;
  lastError?: string;
}

export interface SyncConflict {
  id: string;
  kind: 'notebook' | 'document';
  localId: string;
  driveFileId: string;
  title: string;
  localUpdatedAt: number;
  driveModifiedTime: string;
  sourceId: string;
  folderId: string;
}

export interface StorageQuotaInfo {
  usageBytes: number;
  quotaBytes: number;
  cachedFilesCount: number;
  cachedBytes: number;
  lowSpaceWarning: boolean;
}
