/**
 * Tipos y esquemas JSON compartidos por el núcleo multiplataforma de Luma (PC y Móvil).
 * Todos los archivos en la nube viven únicamente en el Google Drive del propio usuario.
 */

export type StorageProvider = 'google' | 'microsoft' | 'terabox';

export type SyncButtonStatus =
  | 'disabled'
  | 'synced'
  | 'syncing'
  | 'pending'
  | 'offline'
  | 'error';

export type EntitlementPlan = 'beta_full' | 'free' | 'premium';

export interface CloudUser {
  id: string;
  email: string;
  name: string;
  displayName: string;
  avatarUrl?: string;
  provider: StorageProvider;
}

export interface DeviceRecord {
  id: string;
  name: string;
  platform: 'windows' | 'macos' | 'linux' | 'android' | 'ios' | 'web';
  appVersion: string;
  lastActiveAt: string; // ISO-8601
  isCurrent?: boolean;
}

export interface EntitlementInfo {
  plan: EntitlementPlan;
  isPremiumUnlocked: boolean;
  badgeLabel: string;
  expiresAt?: string | null;
  minVersion?: string;
  source: 'beta_stub' | 'remote_endpoint';
}

export interface EntitlementService {
  /**
   * Resuelve los permisos de interfaz del usuario actual.
   * NOTA: En cliente esto es únicamente informativo/UX; la verificación real
   * de pagos futuros se delegará a un endpoint seguro `{ plan, expira, min_version }`.
   */
  resolveEntitlement(user: CloudUser | null): Promise<EntitlementInfo>;
  getCachedEntitlement(user: CloudUser | null): EntitlementInfo;
}

/**
 * Esquema de `/Luma/luma-profile.json` almacenado en el Drive del usuario.
 * Se fusiona entre dispositivos por timestamp (`updatedAt`) sin pisar datos.
 */
export interface LumaProfileJson {
  schemaVersion: 1;
  updatedAt: string; // ISO-8601
  displayName: string;
  displayNameUpdatedAt: string; // ISO-8601
  provider: StorageProvider;
  activeRootFolderId?: string;
  activeRootFolderName?: string;
  devices: DeviceRecord[];
  preferencesSnapshot?: {
    theme?: string;
    readerFont?: string;
    fontSizePx?: number;
    updatedAt?: string;
  };
}

/**
 * Esquema de `/Luma/luma-index.json` almacenado en el Drive del usuario.
 * Permite listar la biblioteca completa al instante sin descargar cada archivo.
 */
export interface LumaIndexEntry {
  id: string;
  driveFileId: string;
  kind: 'book' | 'notebook' | 'document';
  title: string;
  author?: string;
  format: string;
  sizeBytes: number;
  updatedAt: string; // ISO-8601
  modifiedTime: string; // ISO-8601 de Drive
  seriesId?: string;
  progressPercent?: number;
  currentUnit?: number;
  coverThumbUrl?: string;
}

export interface LumaIndexJson {
  schemaVersion: 1;
  updatedAt: string;
  rootFolderId: string;
  items: LumaIndexEntry[];
}

/**
 * Esquema de `/Luma/series/{seriesId}.series.json` para agrupar sagas, manhwa o colecciones.
 */
export interface LumaSeriesManifest {
  schemaVersion: 1;
  id: string;
  title: string;
  description: string;
  accentColor: string;
  coverDriveFileId?: string;
  updatedAt: string;
  itemOrder: Array<{
    itemId: string;
    driveFileId?: string;
    order: number;
    label?: string;
  }>;
}

export interface AuthSessionState {
  /** true cuando el usuario ya completó o decidió omitir la pantalla de bienvenida */
  welcomeCompleted: boolean;
  /** true cuando el usuario eligió explícitamente "Omitir este paso (usar sin conexión)" */
  skippedOffline: boolean;
  /** true cuando hay sesión activa en la nube */
  connected: boolean;
  /** Proveedor activo cuando connected === true */
  provider: StorageProvider | null;
  /** Datos del usuario autenticado */
  user: CloudUser | null;
  /** Identificador estable de este dispositivo */
  currentDeviceId: string;
  /** Dispositivos conocidos (máximo 5 en cuenta activa) */
  devices: DeviceRecord[];
  /** Estado del plan / entitlement actual */
  entitlement: EntitlementInfo;
  /** Fecha del último perfil sincronizado */
  profileUpdatedAt: string;
}
