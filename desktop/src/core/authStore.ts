/**
 * Almacén reactivo compartido de Bienvenida, Cuenta, Dispositivos y Estado sin conexión.
 *
 * Principios clave:
 * - La app funciona 100% sin conexión y sin cuenta.
 * - Iniciar o cerrar sesión actualiza la interfaz en vivo SIN reiniciar la app.
 * - Ningún token OAuth se guarda en localStorage; los tokens viven únicamente en memoria.
 * - Los archivos locales del usuario jamás se eliminan al cerrar sesión (solo si el usuario
 *   confirma explícitamente "Desconectar y borrar datos locales").
 */

import { useEffect, useState } from 'react';
import { LUMA_CORE_CONFIG } from './config';
import { getEntitlementService } from './entitlementService';
import {
  AuthSessionState,
  CloudUser,
  DeviceRecord,
  LumaProfileJson,
  StorageProvider,
} from './types';

const ONBOARDING_KEY = 'luma_core_onboarding_v1';
const DEVICE_ID_KEY = 'luma_core_device_id_v1';
const PROFILE_META_KEY = 'luma_core_profile_meta_v1';

interface PersistedOnboarding {
  welcomeCompleted: boolean;
  skippedOffline: boolean;
}

interface PersistedProfileMeta {
  displayName?: string;
  displayNameUpdatedAt?: string;
  devices?: DeviceRecord[];
  lastKnownUser?: CloudUser | null;
}

function detectPlatform(): DeviceRecord['platform'] {
  if (typeof navigator === 'undefined') return 'web';
  const ua = navigator.userAgent.toLowerCase();
  if (ua.includes('android')) return 'android';
  if (ua.includes('iphone') || ua.includes('ipad')) return 'ios';
  if (ua.includes('win')) return 'windows';
  if (ua.includes('mac')) return 'macos';
  if (ua.includes('linux')) return 'linux';
  return 'web';
}

function defaultDeviceLabel(platform: DeviceRecord['platform']): string {
  switch (platform) {
    case 'windows':
      return 'PC Windows';
    case 'macos':
      return 'Mac';
    case 'linux':
      return 'Equipo Linux';
    case 'android':
      return 'Teléfono Android';
    case 'ios':
      return 'iPhone / iPad';
    default:
      return 'Navegador Web';
  }
}

function getOrCreateDeviceId(): string {
  try {
    const existing = localStorage.getItem(DEVICE_ID_KEY);
    if (existing && existing.length >= 8) return existing;
    const generated =
      typeof crypto !== 'undefined' && typeof crypto.randomUUID === 'function'
        ? `dev_${crypto.randomUUID().slice(0, 12)}`
        : `dev_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 8)}`;
    localStorage.setItem(DEVICE_ID_KEY, generated);
    return generated;
  } catch {
    return `dev_session_${Date.now().toString(36)}`;
  }
}

function readOnboarding(): PersistedOnboarding {
  try {
    const raw = localStorage.getItem(ONBOARDING_KEY);
    if (!raw) return { welcomeCompleted: false, skippedOffline: false };
    const parsed = JSON.parse(raw) as Partial<PersistedOnboarding>;
    return {
      welcomeCompleted: Boolean(parsed.welcomeCompleted),
      skippedOffline: Boolean(parsed.skippedOffline),
    };
  } catch {
    return { welcomeCompleted: false, skippedOffline: false };
  }
}

function writeOnboarding(data: PersistedOnboarding): void {
  try {
    localStorage.setItem(ONBOARDING_KEY, JSON.stringify(data));
  } catch {
    // Ignorar en entornos de almacenamiento restringido
  }
}

function readProfileMeta(): PersistedProfileMeta {
  try {
    const raw = localStorage.getItem(PROFILE_META_KEY);
    if (!raw) return {};
    return JSON.parse(raw) as PersistedProfileMeta;
  } catch {
    return {};
  }
}

function writeProfileMeta(meta: PersistedProfileMeta): void {
  try {
    localStorage.setItem(PROFILE_META_KEY, JSON.stringify(meta));
  } catch {
    // Ignorar en entornos restringido
  }
}

function createCurrentDeviceRecord(deviceId: string, existingName?: string): DeviceRecord {
  const platform = detectPlatform();
  return {
    id: deviceId,
    name: existingName?.trim() || defaultDeviceLabel(platform),
    platform,
    appVersion: LUMA_CORE_CONFIG.appVersion,
    lastActiveAt: new Date().toISOString(),
    isCurrent: true,
  };
}

function sanitizeDisplayName(input: string): string {
  return input.replace(/[<>]/g, '').trim().slice(0, 64);
}

function buildInitialState(): AuthSessionState {
  const deviceId = getOrCreateDeviceId();
  const onboarding = readOnboarding();
  const meta = readProfileMeta();

  const existingDevices = Array.isArray(meta.devices) ? meta.devices : [];
  const currentExisting = existingDevices.find((d) => d.id === deviceId);
  const currentDevice = createCurrentDeviceRecord(deviceId, currentExisting?.name);
  const devices: DeviceRecord[] = [
    currentDevice,
    ...existingDevices
      .filter((d) => d.id !== deviceId)
      .map((d) => ({ ...d, isCurrent: false })),
  ].slice(0, LUMA_CORE_CONFIG.maxConnectedDevices);

  return {
    welcomeCompleted: onboarding.welcomeCompleted,
    skippedOffline: onboarding.skippedOffline,
    connected: false,
    provider: null,
    user: null,
    currentDeviceId: deviceId,
    devices,
    entitlement: getEntitlementService().getCachedEntitlement(null),
    profileUpdatedAt: meta.displayNameUpdatedAt ?? new Date().toISOString(),
  };
}

let state: AuthSessionState = buildInitialState();
const listeners = new Set<(next: AuthSessionState) => void>();

function emit(next: AuthSessionState): void {
  state = next;
  listeners.forEach((fn) => fn(next));
}

export function getAuthSession(): AuthSessionState {
  return state;
}

export function subscribeAuthSession(listener: (next: AuthSessionState) => void): () => void {
  listeners.add(listener);
  listener(state);
  return () => {
    listeners.delete(listener);
  };
}

/** Hook React para suscribirse al estado global de cuenta y bienvenida */
export function useAuthCore(): AuthSessionState {
  const [snap, setSnap] = useState<AuthSessionState>(() => getAuthSession());
  useEffect(() => subscribeAuthSession(setSnap), []);
  return snap;
}

/** El usuario elige "Omitir este paso (usar sin conexión)" en el primer arranque */
export function completeWelcomeWithSkip(): void {
  writeOnboarding({ welcomeCompleted: true, skippedOffline: true });
  emit({
    ...state,
    welcomeCompleted: true,
    skippedOffline: true,
  });
}

/**
 * Sincroniza el núcleo con una sesión autenticada (por ejemplo tras OAuth de Google).
 * Actualiza el estado inmediatamente sin reiniciar la app y preserva archivos locales.
 */
export function connectAccountSession(params: {
  provider: StorageProvider;
  email: string;
  name: string;
  avatarUrl?: string;
}): void {
  const meta = readProfileMeta();
  const cleanName = sanitizeDisplayName(params.name) || params.email.split('@')[0] || 'Usuario Luma';
  const resolvedDisplayName = sanitizeDisplayName(meta.displayName || '') || cleanName;
  const nowIso = new Date().toISOString();

  const user: CloudUser = {
    id: `${params.provider}:${params.email.toLowerCase()}`,
    email: params.email,
    name: cleanName,
    displayName: resolvedDisplayName,
    avatarUrl: params.avatarUrl,
    provider: params.provider,
  };

  const currentExisting = state.devices.find((d) => d.id === state.currentDeviceId);
  const currentDevice = createCurrentDeviceRecord(state.currentDeviceId, currentExisting?.name);
  const nextDevices: DeviceRecord[] = [
    currentDevice,
    ...state.devices
      .filter((d) => d.id !== state.currentDeviceId)
      .map((d) => ({ ...d, isCurrent: false })),
  ].slice(0, LUMA_CORE_CONFIG.maxConnectedDevices);

  writeOnboarding({ welcomeCompleted: true, skippedOffline: false });
  writeProfileMeta({
    displayName: resolvedDisplayName,
    displayNameUpdatedAt: meta.displayNameUpdatedAt ?? nowIso,
    devices: nextDevices,
    lastKnownUser: user,
  });

  const entitlement = getEntitlementService().getCachedEntitlement(user);

  emit({
    ...state,
    welcomeCompleted: true,
    skippedOffline: false,
    connected: true,
    provider: params.provider,
    user,
    devices: nextDevices,
    entitlement,
    profileUpdatedAt: nowIso,
  });
}

/**
 * Cierra la sesión en la nube y vuelve al modo sin conexión conservando
 * todos los libros, cuadernos y sagas locales del dispositivo.
 */
export function disconnectAccountSession(): void {
  writeOnboarding({ welcomeCompleted: true, skippedOffline: true });
  emit({
    ...state,
    welcomeCompleted: true,
    skippedOffline: true,
    connected: false,
    provider: null,
    user: null,
    entitlement: getEntitlementService().getCachedEntitlement(null),
  });
}

/**
 * Actualiza el nombre visible del perfil y registra timestamp para fusión multi-dispositivo.
 */
export function updateAccountDisplayName(newName: string): void {
  const clean = sanitizeDisplayName(newName);
  if (!clean) return;
  const nowIso = new Date().toISOString();
  const meta = readProfileMeta();
  writeProfileMeta({
    ...meta,
    displayName: clean,
    displayNameUpdatedAt: nowIso,
  });
  emit({
    ...state,
    user: state.user ? { ...state.user, displayName: clean } : null,
    profileUpdatedAt: nowIso,
  });
}

/** Renombra un dispositivo conectado (por ejemplo "Laptop de estudio") */
export function renameConnectedDevice(deviceId: string, newName: string): void {
  const clean = sanitizeDisplayName(newName);
  if (!clean) return;
  const nextDevices = state.devices.map((d) =>
    d.id === deviceId ? { ...d, name: clean, lastActiveAt: new Date().toISOString() } : d
  );
  const meta = readProfileMeta();
  writeProfileMeta({ ...meta, devices: nextDevices });
  emit({ ...state, devices: nextDevices, profileUpdatedAt: new Date().toISOString() });
}

/** Elimina otro dispositivo de la lista de dispositivos conectados */
export function removeConnectedDevice(deviceId: string): void {
  if (deviceId === state.currentDeviceId) return;
  const nextDevices = state.devices.filter((d) => d.id !== deviceId);
  const meta = readProfileMeta();
  writeProfileMeta({ ...meta, devices: nextDevices });
  emit({ ...state, devices: nextDevices, profileUpdatedAt: new Date().toISOString() });
}

/** Construye el archivo `luma-profile.json` listo para subir a `/Luma/` en Drive */
export function buildLumaProfileJson(rootFolder?: { id: string; name: string }): LumaProfileJson {
  const nowIso = new Date().toISOString();
  return {
    schemaVersion: 1,
    updatedAt: nowIso,
    displayName: state.user?.displayName || state.user?.name || 'Usuario Luma',
    displayNameUpdatedAt: state.profileUpdatedAt || nowIso,
    provider: state.provider ?? 'google',
    activeRootFolderId: rootFolder?.id,
    activeRootFolderName: rootFolder?.name,
    devices: state.devices.slice(0, LUMA_CORE_CONFIG.maxConnectedDevices).map((d) => ({
      id: d.id,
      name: d.name,
      platform: d.platform,
      appVersion: d.appVersion,
      lastActiveAt: d.lastActiveAt,
    })),
  };
}

/**
 * Fusiona dos `luma-profile.json` (local y remoto) por timestamp más reciente,
 * uniendo la lista de dispositivos sin perder entradas ni superar el límite de 5.
 */
export function mergeLumaProfiles(
  local: LumaProfileJson,
  remote: LumaProfileJson
): LumaProfileJson {
  const useRemoteName =
    Date.parse(remote.displayNameUpdatedAt || remote.updatedAt) >
    Date.parse(local.displayNameUpdatedAt || local.updatedAt);

  const deviceMap = new Map<string, DeviceRecord>();
  for (const d of [...remote.devices, ...local.devices]) {
    const prev = deviceMap.get(d.id);
    if (!prev || Date.parse(d.lastActiveAt) >= Date.parse(prev.lastActiveAt)) {
      deviceMap.set(d.id, d);
    }
  }
  const mergedDevices = Array.from(deviceMap.values())
    .sort((a, b) => Date.parse(b.lastActiveAt) - Date.parse(a.lastActiveAt))
    .slice(0, LUMA_CORE_CONFIG.maxConnectedDevices);

  return {
    schemaVersion: 1,
    updatedAt: new Date().toISOString(),
    displayName: useRemoteName ? remote.displayName : local.displayName,
    displayNameUpdatedAt: useRemoteName
      ? remote.displayNameUpdatedAt
      : local.displayNameUpdatedAt,
    provider: local.provider || remote.provider,
    activeRootFolderId: local.activeRootFolderId ?? remote.activeRootFolderId,
    activeRootFolderName: local.activeRootFolderName ?? remote.activeRootFolderName,
    devices: mergedDevices,
    preferencesSnapshot:
      Date.parse(remote.preferencesSnapshot?.updatedAt || '0') >
      Date.parse(local.preferencesSnapshot?.updatedAt || '0')
        ? remote.preferencesSnapshot
        : local.preferencesSnapshot,
  };
}

/** Limpia los metadatos del núcleo (usado por "Desconectar y borrar datos locales") */
export function resetCoreLocalMetadata(): void {
  try {
    localStorage.removeItem(PROFILE_META_KEY);
    writeOnboarding({ welcomeCompleted: true, skippedOffline: true });
  } catch {
    // Ignorar
  }
  const freshDevice = createCurrentDeviceRecord(state.currentDeviceId);
  emit({
    ...state,
    welcomeCompleted: true,
    skippedOffline: true,
    connected: false,
    provider: null,
    user: null,
    devices: [freshDevice],
    entitlement: getEntitlementService().getCachedEntitlement(null),
    profileUpdatedAt: new Date().toISOString(),
  });
}
