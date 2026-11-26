import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import {
  HighlightNote,
  LumaDocument,
  LumaNotebook,
  LumaWorkspaceState,
  NotebookPageSize,
  UserProfile,
  WorkspacePreferences,
  WorkspaceTab,
} from './types';
import { applyThemeToDocument } from './themes';
import { createNotebookFromTemplate, createSeedWorkspace } from './data/seedWorkspace';
import { useViewportProfile } from './hooks/useViewportProfile';
import { importFromBase64File, importFromBrowserFile } from './utils/documentImporter';
import { TitlebarAndTabs } from './components/TitlebarAndTabs';
import { NotionSidebar } from './components/NotionSidebar';
import { LibraryWorkspace } from './components/LibraryWorkspace';
import { ReaderWorkspace } from './components/ReaderWorkspace';
import { NotebookStudio } from './components/NotebookStudio';
import { SourcesWorkspace } from './components/SourcesWorkspace';
import { MobileBottomNav } from './components/MobileBottomNav';
import { OfflineIndicator } from './components/PWAInstallButton';
import { CommandPalette } from './components/CommandPalette';
import { SettingsModal, SettingsTabId } from './components/SettingsModal';
import { AccountFriendsModal, AccountTabId } from './components/AccountFriendsModal';
import { CreateActionModal, NotebookTemplateId } from './components/CreateActionModal';
import { GuideModal } from './components/GuideModal';
import {
  ClientIdGuideModal,
  ContextMenuTarget,
  DownloadConfirmModal,
  DriveContextMenu,
  SaveDestinationModal,
  SyncConflictModal,
} from './components/DriveModals';
import {
  deleteNotebookRecord,
  loadAllNotebookRecords,
  loadNotebookRecord,
  parseNotebookIdFromUrl,
  saveNotebookRecord,
  subscribeNotebookSync,
} from './utils/notebookStorage';
import {
  DownloadProgressState,
  DriveAuthState,
  DriveCredentials,
  DriveFileItem,
  DriveSource,
  StorageQuotaInfo,
  SyncConflict,
  SyncQueueJob,
} from './drive/driveTypes';
import {
  loadEncryptedCredentials,
  saveEncryptedCredentials,
} from './drive/cryptoVault';
import {
  clearAllCachedDriveFiles,
  deleteCachedDriveFile,
  enqueueSyncJob,
  estimateStorageQuota,
  getCachedDriveFile,
  loadDriveSources,
  loadSyncQueue,
  removeSyncJob,
  saveDriveSources,
} from './drive/driveCache';
import {
  canAutoSyncNow,
  deleteDriveFile,
  downloadDriveFileResumable,
  extractDriveFolderId,
  getDriveAuthState,
  getDriveFileMetadata,
  listDriveFolderPage,
  listDriveFolderRecursive,
  moveDriveFile,
  pickDriveFolderWithGooglePicker,
  renameDriveFile,
  ResumableDownloadController,
  signInWithGoogleDrive,
  signOutGoogleDrive,
  subscribeDriveAuth,
  translateDriveError,
  uploadFileResumable,
  validateDriveFolder,
} from './drive/googleDriveClient';
import { LiveFpsMetrics, subscribeLiveFps } from './utils/frameEngine';
import {
  completeWelcomeWithSkip,
  connectAccountSession,
  disconnectAccountSession,
  MyAccountView,
  removeConnectedDevice,
  renameConnectedDevice,
  resetCoreLocalMetadata,
  SyncButtonStatus,
  SyncStatusButton,
  updateAccountDisplayName,
  useAuthCore,
  WelcomeScreen,
} from './core';

const STORAGE_KEY = 'luma_desktop_workspace_v1';

const DEFAULT_DRIVE_CREDS: DriveCredentials = {
  clientId: '',
  apiKey: '',
  scopeMode: 'drive',
};

function sanitizeDriveFileName(title: string, ext: string): string {
  const cleaned = title
    .trim()
    .replace(/[\\/:*?"<>|]+/g, ' ')
    .replace(/\s+/g, ' ');
  const base = cleaned || 'Cuaderno Luma';
  return base.toLowerCase().endsWith(ext) ? base : `${base}${ext}`;
}

function blobToDataUrl(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result ?? ''));
    reader.onerror = () => reject(reader.error ?? new Error('No se pudo leer la imagen'));
    reader.readAsDataURL(blob);
  });
}

function parseLumaNotebookBundle(rawText: string): LumaNotebook | null {
  try {
    const parsed = JSON.parse(rawText) as
      | { format?: string; notebook?: LumaNotebook }
      | LumaNotebook;
    if (
      parsed &&
      typeof parsed === 'object' &&
      'notebook' in parsed &&
      parsed.notebook &&
      Array.isArray(parsed.notebook.pages)
    ) {
      return parsed.notebook;
    }
    if (parsed && typeof parsed === 'object' && 'pages' in parsed && Array.isArray(parsed.pages)) {
      return parsed as LumaNotebook;
    }
    return null;
  } catch {
    return null;
  }
}

export default function App() {
  const [workspace, setWorkspace] = useState<LumaWorkspaceState>(() => createSeedWorkspace());
  const [hydrated, setHydrated] = useState(false);
  const [tabs, setTabs] = useState<WorkspaceTab[]>([
    { id: 'tab_home', kind: 'home', title: 'Inicio' },
  ]);
  const [activeTabId, setActiveTabId] = useState('tab_home');
  const [selectedSagaId, setSelectedSagaId] = useState<string | undefined>(undefined);
  const [splitEnabled, setSplitEnabled] = useState(false);
  const [splitNotebookId, setSplitNotebookId] = useState<string | null>(null);
  const [isZenMode, setIsZenMode] = useState(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState(false);
  const [settingsOpen, setSettingsOpen] = useState(false);
  const [settingsTab, setSettingsTab] = useState<SettingsTabId>('appearance');
  const [accountModalOpen, setAccountModalOpen] = useState(false);
  const [accountModalTab, setAccountModalTab] = useState<AccountTabId>('profile');
  const [createModalOpen, setCreateModalOpen] = useState(false);
  const [createModalSection, setCreateModalSection] = useState<'notebook' | 'saga'>('notebook');
  const [guideOpen, setGuideOpen] = useState(false);
  const [fpsMetrics, setFpsMetrics] = useState<LiveFpsMetrics>({
    fps: 60,
    displayHz: 60,
    targetLabel: 'Máx',
    frameMs: 16.7,
  });
  const [isOnline, setIsOnline] = useState<boolean>(() =>
    typeof navigator === 'undefined' ? true : navigator.onLine
  );
  const [isDraggingFile, setIsDraggingFile] = useState(false);
  const [platform, setPlatform] = useState('win32');
  const [isMaximized, setIsMaximized] = useState(false);
  const [drawerOpenMobile, setDrawerOpenMobile] = useState(false);
  const [standaloneNotebookId, setStandaloneNotebookId] = useState<string | null>(() =>
    parseNotebookIdFromUrl()
  );

  // Google Drive v3 & Sync Engine state
  const [driveCredentials, setDriveCredentials] = useState<DriveCredentials>(DEFAULT_DRIVE_CREDS);
  const [driveAuth, setDriveAuth] = useState<DriveAuthState>(() => getDriveAuthState());
  const [driveSources, setDriveSources] = useState<DriveSource[]>(() => loadDriveSources());
  const [filesBySource, setFilesBySource] = useState<Record<string, DriveFileItem[]>>({});
  const [loadingSourceId, setLoadingSourceId] = useState<string | null>(null);
  const [activeBrowseSourceId, setActiveBrowseSourceId] = useState<string | null>(null);
  const [breadcrumbs, setBreadcrumbs] = useState<Array<{ folderId: string; name: string }>>([]);
  const [syncQueue, setSyncQueue] = useState<SyncQueueJob[]>([]);
  const [isSyncing, setIsSyncing] = useState(false);
  const [storageQuota, setStorageQuota] = useState<StorageQuotaInfo | null>(null);

  // Drive Modals & Toast state
  const [downloadModalFile, setDownloadModalFile] = useState<DriveFileItem | null>(null);
  const [downloadModalThumb, setDownloadModalThumb] = useState<string | null>(null);
  const [downloadProgress, setDownloadProgress] = useState<DownloadProgressState | null>(null);
  const [contextTarget, setContextTarget] = useState<ContextMenuTarget | null>(null);
  const [activeConflict, setActiveConflict] = useState<SyncConflict | null>(null);
  const [clientIdGuideOpen, setClientIdGuideOpen] = useState(false);
  const [pendingSaveDest, setPendingSaveDest] = useState<
    | { kind: 'notebook'; notebook: LumaNotebook }
    | { kind: 'files'; files: Array<{ doc: LumaDocument; rawFile?: File }> }
    | null
  >(null);
  const [driveToast, setDriveToast] = useState<{
    message: string;
    tone: 'info' | 'success' | 'error';
  } | null>(null);

  const fileInputRef = useRef<HTMLInputElement>(null);
  const downloadCtrlRef = useRef<ResumableDownloadController | null>(null);
  const toastTimerRef = useRef<number | null>(null);
  const workspaceRef = useRef(workspace);
  workspaceRef.current = workspace;
  const driveSourcesRef = useRef(driveSources);
  driveSourcesRef.current = driveSources;
  const driveAuthRef = useRef(driveAuth);
  driveAuthRef.current = driveAuth;

  const viewport = useViewportProfile(workspace.prefs.density);
  const authSession = useAuthCore();

  const showToast = useCallback(
    (message: string, tone: 'info' | 'success' | 'error' = 'info') => {
      setDriveToast({ message, tone });
      if (toastTimerRef.current) window.clearTimeout(toastTimerRef.current);
      toastTimerRef.current = window.setTimeout(() => {
        setDriveToast(null);
      }, 4200);
    },
    []
  );

  const refreshStorageQuota = useCallback(async () => {
    const q = await estimateStorageQuota();
    setStorageQuota(q);
  }, []);

  // Sync Google Drive OAuth status with core multiplatform AuthSession (zero app restart)
  useEffect(() => {
    if (driveAuth.connected) {
      const resolvedEmail = driveAuth.email || 'usuario@google.com';
      if (!authSession.connected || authSession.user?.email !== resolvedEmail) {
        connectAccountSession({
          provider: 'google',
          email: resolvedEmail,
          name: driveAuth.name || resolvedEmail.split('@')[0] || 'Usuario Luma',
          avatarUrl: driveAuth.picture,
        });
      }
    } else if (authSession.connected) {
      disconnectAccountSession();
    }
  }, [
    driveAuth.connected,
    driveAuth.email,
    driveAuth.name,
    driveAuth.picture,
    authSession.connected,
    authSession.user?.email,
  ]);

  // Live network connectivity tracker for SyncStatusButton
  useEffect(() => {
    const onUp = () => setIsOnline(true);
    const onDown = () => setIsOnline(false);
    window.addEventListener('online', onUp);
    window.addEventListener('offline', onDown);
    return () => {
      window.removeEventListener('online', onUp);
      window.removeEventListener('offline', onDown);
    };
  }, []);

  // Hydrate encrypted Drive credentials, offline sync queue, quota & auth subscription
  useEffect(() => {
    const unsub = subscribeDriveAuth(setDriveAuth);
    loadEncryptedCredentials()
      .then((creds) => {
        if (creds) setDriveCredentials(creds);
      })
      .catch(() => undefined);
    loadSyncQueue()
      .then(setSyncQueue)
      .catch(() => undefined);
    void refreshStorageQuota();
    return unsub;
  }, [refreshStorageQuota]);

  // Persist Drive sources list whenever updated
  useEffect(() => {
    saveDriveSources(driveSources);
  }, [driveSources]);

  // Load persisted workspace (Electron disk file or browser localStorage)
  useEffect(() => {
    let cancelled = false;
    async function load() {
      try {
        let raw: string | null = null;
        if (window.lumaDesktop?.loadWorkspace) {
          raw = await window.lumaDesktop.loadWorkspace();
        } else {
          raw = localStorage.getItem(STORAGE_KEY);
        }
        const idbNotebooks = await loadAllNotebookRecords();
        const routeNb = standaloneNotebookId
          ? await loadNotebookRecord(standaloneNotebookId)
          : null;

        if (!cancelled) {
          const seed = createSeedWorkspace();
          const parsed = raw ? (JSON.parse(raw) as Partial<LumaWorkspaceState>) : {};
          const baseNotebooks =
            Array.isArray(parsed.notebooks) && parsed.notebooks.length > 0
              ? parsed.notebooks
              : seed.notebooks;

          // Merge IndexedDB / localStorage notebooks by ID (newest updatedAt wins)
          const nbMap = new Map<string, LumaNotebook>();
          for (const nb of baseNotebooks) nbMap.set(nb.id, nb);
          for (const nb of idbNotebooks) {
            const existing = nbMap.get(nb.id);
            if (!existing || nb.updatedAt >= existing.updatedAt) {
              nbMap.set(nb.id, nb);
            }
          }
          if (routeNb) {
            const existing = nbMap.get(routeNb.id);
            if (!existing || routeNb.updatedAt >= existing.updatedAt) {
              nbMap.set(routeNb.id, routeNb);
            }
          }

          const mergedNotebooks = Array.from(nbMap.values()).sort(
            (a, b) => b.updatedAt - a.updatedAt
          );

          setWorkspace({
            documents:
              Array.isArray(parsed.documents) && parsed.documents.length > 0
                ? parsed.documents
                : seed.documents,
            playlists: Array.isArray(parsed.playlists) ? parsed.playlists : seed.playlists,
            notebooks: mergedNotebooks,
            highlights: Array.isArray(parsed.highlights) ? parsed.highlights : seed.highlights,
            bookmarks: Array.isArray(parsed.bookmarks) ? parsed.bookmarks : seed.bookmarks,
            prefs: {
              ...seed.prefs,
              ...(parsed.prefs ?? {}),
              dictionarySources:
                Array.isArray(parsed.prefs?.dictionarySources) &&
                parsed.prefs.dictionarySources.length > 0
                  ? parsed.prefs.dictionarySources
                  : seed.prefs.dictionarySources,
            },
            profile: parsed.profile
              ? {
                  ...seed.profile,
                  ...parsed.profile,
                  privacy: { ...seed.profile.privacy, ...(parsed.profile.privacy ?? {}) },
                }
              : seed.profile,
            friends: Array.isArray(parsed.friends) ? parsed.friends : seed.friends,
          });
        }
      } catch {
        // Fallback to seed workspace
      } finally {
        if (!cancelled) setHydrated(true);
      }
    }
    load();
    return () => {
      cancelled = true;
    };
  }, [standaloneNotebookId]);

  // Live sync across browser tabs when editing a notebook
  useEffect(() => {
    return subscribeNotebookSync((incoming) => {
      setWorkspace((prev) => {
        const exists = prev.notebooks.some((n) => n.id === incoming.id);
        const nextNotebooks = exists
          ? prev.notebooks.map((n) => (n.id === incoming.id ? incoming : n))
          : [incoming, ...prev.notebooks];
        return { ...prev, notebooks: nextNotebooks };
      });
    });
  }, []);

  // Sync Electron platform & maximize state
  useEffect(() => {
    if (!window.lumaDesktop) return;
    window.lumaDesktop.getPlatform().then(setPlatform).catch(() => undefined);
    window.lumaDesktop.isMaximized().then(setIsMaximized).catch(() => undefined);
    const unsub = window.lumaDesktop.onWindowState((st) => setIsMaximized(st.maximized));
    return unsub;
  }, []);

  // Persist workspace debounced
  useEffect(() => {
    if (!hydrated) return;
    const timer = window.setTimeout(() => {
      try {
        const serialized = JSON.stringify(workspace);
        if (window.lumaDesktop?.saveWorkspace) {
          window.lumaDesktop.saveWorkspace(serialized);
        } else {
          localStorage.setItem(STORAGE_KEY, serialized);
        }
      } catch {
        // Ignore storage quota issues for huge PDFs
      }
    }, 350);
    return () => window.clearTimeout(timer);
  }, [workspace, hydrated]);

  // Apply active Luma theme variables & device font toggle
  useEffect(() => {
    applyThemeToDocument(workspace.prefs.theme);
  }, [workspace.prefs.theme]);

  useEffect(() => {
    document.documentElement.style.setProperty(
      '--font-sans',
      workspace.prefs.useDeviceFont
        ? 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
        : '"Plus Jakarta Sans", system-ui, -apple-system, sans-serif'
    );
  }, [workspace.prefs.useDeviceFont]);

  // Real continuous FPS engine & FPS-adaptive CSS motion timing (active at all times)
  useEffect(() => {
    return subscribeLiveFps(workspace.prefs.targetFps, setFpsMetrics);
  }, [workspace.prefs.targetFps]);

  const toggleImmersiveFullscreen = useCallback(() => {
    setIsZenMode((prev) => {
      const next = !prev;
      if (next) {
        if (!document.fullscreenElement && document.documentElement.requestFullscreen) {
          document.documentElement.requestFullscreen().catch(() => undefined);
        }
      } else if (document.fullscreenElement && document.exitFullscreen) {
        document.exitFullscreen().catch(() => undefined);
      }
      return next;
    });
  }, []);

  useEffect(() => {
    const onFsChange = () => {
      if (!document.fullscreenElement && isZenMode) {
        setIsZenMode(false);
      }
    };
    document.addEventListener('fullscreenchange', onFsChange);
    return () => document.removeEventListener('fullscreenchange', onFsChange);
  }, [isZenMode]);

  const activeTab = useMemo(
    () => tabs.find((t) => t.id === activeTabId) ?? tabs[0],
    [tabs, activeTabId]
  );

  const updatePrefs = useCallback((patch: Partial<WorkspacePreferences>) => {
    setWorkspace((prev) => ({ ...prev, prefs: { ...prev.prefs, ...patch } }));
  }, []);

  const toggleSidebar = useCallback(() => {
    if (viewport.sidebarMode === 'drawer' || viewport.sidebarMode === 'rail') {
      setDrawerOpenMobile((v) => !v);
    } else {
      updatePrefs({ sidebarCollapsed: !workspace.prefs.sidebarCollapsed });
    }
  }, [viewport.sidebarMode, workspace.prefs.sidebarCollapsed, updatePrefs]);

  // Global keyboard shortcuts (Ctrl+K Command Palette, Ctrl+\ Sidebar, F11 Fullscreen, Escape Zen)
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'k') {
        e.preventDefault();
        setCommandPaletteOpen((v) => !v);
      } else if ((e.ctrlKey || e.metaKey) && e.key === '\\') {
        e.preventDefault();
        toggleSidebar();
      } else if (e.key === 'F11') {
        e.preventDefault();
        toggleImmersiveFullscreen();
      } else if (e.key === 'Escape' && isZenMode) {
        if (document.fullscreenElement && document.exitFullscreen) {
          document.exitFullscreen().catch(() => undefined);
        }
        setIsZenMode(false);
      }
    };
    window.addEventListener('keydown', onKeyDown);
    return () => window.removeEventListener('keydown', onKeyDown);
  }, [isZenMode, toggleImmersiveFullscreen, toggleSidebar]);

  const sidebarIsOpen = isZenMode
    ? false
    : viewport.sidebarMode === 'drawer' || viewport.sidebarMode === 'rail'
      ? drawerOpenMobile
      : !workspace.prefs.sidebarCollapsed;

  const effectiveSidebarWidth = Math.min(
    viewport.maxSidebarWidth,
    Math.max(
      viewport.minSidebarWidth,
      workspace.prefs.sidebarWidth || viewport.recommendedSidebarWidth
    )
  );

  // Navigation & Tab Management
  const navigatePrimary = useCallback(
    (kind: 'home' | 'library' | 'sagas' | 'notebooks' | 'sources', sagaId?: string) => {
      if (kind === 'sagas') setSelectedSagaId(sagaId);
      const tabId = `tab_${kind}`;
      const labelMap: Record<typeof kind, string> = {
        home: 'Inicio',
        library: 'Biblioteca',
        sagas: 'Sagas',
        notebooks: 'Cuadernos',
        sources: 'Fuentes',
      };
      setTabs((prev) => {
        if (prev.some((t) => t.id === tabId)) return prev;
        return [...prev, { id: tabId, kind, title: labelMap[kind] }];
      });
      setActiveTabId(tabId);
    },
    []
  );

  const openDocumentTabDirect = useCallback((doc: LumaDocument, unitIndex?: number) => {
    const tabId = `doc_${doc.id}`;
    setTabs((prev) => {
      if (prev.some((t) => t.id === tabId)) {
        return prev.map((t) => (t.id === tabId ? { ...t, title: doc.title } : t));
      }
      return [...prev, { id: tabId, kind: 'reader', title: doc.title, targetId: doc.id }];
    });
    setActiveTabId(tabId);
    setWorkspace((prev) => ({
      ...prev,
      documents: prev.documents.map((d) =>
        d.id === doc.id
          ? {
              ...d,
              lastOpenedAt: Date.now(),
              currentUnit: typeof unitIndex === 'number' ? unitIndex : d.currentUnit,
            }
          : d
      ),
    }));
  }, []);

  const openDocument = useCallback(
    (docId: string, unitIndex?: number) => {
      const doc = workspaceRef.current.documents.find((d) => d.id === docId);
      if (!doc) return;
      openDocumentTabDirect(doc, unitIndex);
    },
    [openDocumentTabDirect]
  );

  const openNotebookTabDirect = useCallback(
    (nb: LumaNotebook) => {
      const tabId = `nb_${nb.id}`;
      setTabs((prev) => {
        if (prev.some((t) => t.id === tabId)) {
          return prev.map((t) => (t.id === tabId ? { ...t, title: nb.title } : t));
        }
        return [...prev, { id: tabId, kind: 'studio', title: nb.title, targetId: nb.id }];
      });
      setActiveTabId(tabId);
      if (viewport.tier === 'laptop' && !workspaceRef.current.prefs.sidebarCollapsed) {
        updatePrefs({ sidebarCollapsed: true });
      }
    },
    [viewport.tier, updatePrefs]
  );

  const openNotebook = useCallback(
    (nbId: string) => {
      const nb = workspaceRef.current.notebooks.find((n) => n.id === nbId);
      if (!nb) return;
      openNotebookTabDirect(nb);
    },
    [openNotebookTabDirect]
  );

  const closeTab = useCallback(
    (tabId: string) => {
      setTabs((prev) => {
        const next = prev.filter((t) => t.id !== tabId);
        if (activeTabId === tabId && next.length > 0) {
          setActiveTabId(next[next.length - 1].id);
        }
        return next.length > 0 ? next : [{ id: 'tab_home', kind: 'home', title: 'Inicio' }];
      });
    },
    [activeTabId]
  );

  /* ============================================================================
   * Google Drive v3 Operations (Zero Backend, Direct Browser <-> Drive API v3)
   * ==========================================================================*/
  const refreshSource = useCallback(
    async (sourceId: string, specificFolderId?: string) => {
      const src = driveSourcesRef.current.find((s) => s.id === sourceId);
      if (!src) return;
      if (!driveAuthRef.current.connected) return;
      setLoadingSourceId(sourceId);
      try {
        let items: DriveFileItem[];
        if (specificFolderId) {
          const page = await listDriveFolderPage(sourceId, specificFolderId);
          items = page.files;
        } else if (src.includeSubfolders) {
          items = await listDriveFolderRecursive(sourceId, src.folderId);
        } else {
          const page = await listDriveFolderPage(sourceId, src.folderId);
          items = page.files;
        }
        setFilesBySource((prev) => ({ ...prev, [sourceId]: items }));
        setDriveSources((prev) =>
          prev.map((s) =>
            s.id === sourceId
              ? {
                  ...s,
                  lastSyncedAt: Date.now(),
                  fileCount: items.filter((f) => !f.isFolder).length,
                  errorMessage: undefined,
                }
              : s
          )
        );
      } catch (err) {
        const friendly = translateDriveError(err);
        setDriveSources((prev) =>
          prev.map((s) => (s.id === sourceId ? { ...s, errorMessage: friendly } : s))
        );
        showToast(friendly, 'error');
      } finally {
        setLoadingSourceId((cur) => (cur === sourceId ? null : cur));
      }
    },
    [showToast]
  );

  const refreshAllSources = useCallback(async () => {
    if (!driveAuthRef.current.connected) return;
    const active = driveSourcesRef.current.filter((s) => s.active);
    if (active.length === 0) return;
    setIsSyncing(true);
    try {
      for (const src of active) {
        await refreshSource(src.id);
      }
    } finally {
      setIsSyncing(false);
    }
  }, [refreshSource]);

  const handleSaveDriveCredentials = useCallback(
    async (creds: DriveCredentials) => {
      const res = await saveEncryptedCredentials(creds);
      setDriveCredentials(creds);
      showToast(
        res.encrypted
          ? 'Credenciales guardadas y cifradas localmente (AES-GCM).'
          : 'Credenciales guardadas localmente.',
        'success'
      );
      return res;
    },
    [showToast]
  );

  const handleSignInDrive = useCallback(
    async (creds: DriveCredentials) => {
      await saveEncryptedCredentials(creds);
      setDriveCredentials(creds);
      const auth = await signInWithGoogleDrive(creds);
      setDriveAuth(auth);
      showToast(`Conectado a Google Drive (${auth.email || 'cuenta activa'}).`, 'success');
      // Immediately fetch active Drive folders
      window.setTimeout(() => {
        void refreshAllSources();
      }, 150);
    },
    [refreshAllSources, showToast]
  );

  const handleSignOutDrive = useCallback(() => {
    signOutGoogleDrive();
    disconnectAccountSession();
    setFilesBySource({});
    setActiveBrowseSourceId(null);
    setBreadcrumbs([]);
    showToast('Sesión cerrada. Tus archivos locales siguen disponibles sin conexión.', 'info');
  }, [showToast]);

  const handleCoreSignInGoogle = useCallback(
    async (clientId: string) => {
      const creds: DriveCredentials = {
        ...driveCredentials,
        clientId: clientId.trim(),
      };
      await handleSignInDrive(creds);
    },
    [driveCredentials, handleSignInDrive]
  );

  const handleWipeLocalAndDisconnect = useCallback(async () => {
    signOutGoogleDrive();
    await clearAllCachedDriveFiles();
    resetCoreLocalMetadata();
    setFilesBySource({});
    setActiveBrowseSourceId(null);
    setBreadcrumbs([]);
    await refreshStorageQuota();
    showToast('Cuenta desconectada y caché local borrada. Tus archivos en Drive están intactos.', 'info');
  }, [refreshStorageQuota, showToast]);

  const handleAddDriveSourceByLink = useCallback(
    async (linkOrId: string, customName: string, color: string) => {
      const folderId = extractDriveFolderId(linkOrId);
      if (!folderId) {
        throw new Error(
          'No reconocimos un ID de carpeta válido. Pega el enlace completo de tu carpeta de Google Drive.'
        );
      }
      if (driveSourcesRef.current.some((s) => s.folderId === folderId)) {
        throw new Error('Esta carpeta de Google Drive ya está agregada en tus fuentes.');
      }

      let resolvedName = customName.trim();
      if (driveAuthRef.current.connected) {
        const meta = await validateDriveFolder(folderId);
        if (!resolvedName) resolvedName = meta.name;
      } else if (!resolvedName) {
        resolvedName = `Carpeta Drive (${folderId.slice(0, 6)}…)`;
      }

      const newSource: DriveSource = {
        id: `src_${Date.now().toString(36)}`,
        name: resolvedName,
        folderId,
        folderUrl: linkOrId.trim().startsWith('http')
          ? linkOrId.trim()
          : `https://drive.google.com/drive/folders/${folderId}`,
        color,
        active: true,
        isDefault: driveSourcesRef.current.length === 0,
        includeSubfolders: true,
      };

      setDriveSources((prev) => [...prev, newSource]);
      showToast(`Fuente «${resolvedName}» agregada.`, 'success');

      if (driveAuthRef.current.connected) {
        window.setTimeout(() => {
          void refreshSource(newSource.id);
        }, 120);
      }
    },
    [refreshSource, showToast]
  );

  const handlePickDriveFolder = useCallback(async () => {
    try {
      const picked = await pickDriveFolderWithGooglePicker(driveCredentials.apiKey);
      if (!picked) return;
      await handleAddDriveSourceByLink(
        `https://drive.google.com/drive/folders/${picked.id}`,
        picked.name,
        '#2B64F5'
      );
    } catch (err) {
      showToast(translateDriveError(err), 'error');
    }
  }, [driveCredentials.apiKey, handleAddDriveSourceByLink, showToast]);

  const handleToggleDriveSourceActive = useCallback((sourceId: string) => {
    setDriveSources((prev) =>
      prev.map((s) => (s.id === sourceId ? { ...s, active: !s.active } : s))
    );
  }, []);

  const handleSetDefaultDriveSource = useCallback(
    (sourceId: string) => {
      setDriveSources((prev) =>
        prev.map((s) => ({ ...s, isDefault: s.id === sourceId }))
      );
      showToast('Carpeta de guardado por defecto actualizada.', 'success');
    },
    [showToast]
  );

  const handleDeleteDriveSource = useCallback(
    (sourceId: string) => {
      setDriveSources((prev) => {
        const next = prev.filter((s) => s.id !== sourceId);
        if (next.length > 0 && !next.some((s) => s.isDefault)) {
          next[0] = { ...next[0], isDefault: true };
        }
        return next;
      });
      setFilesBySource((prev) => {
        const clone = { ...prev };
        delete clone[sourceId];
        return clone;
      });
      if (activeBrowseSourceId === sourceId) {
        setActiveBrowseSourceId(null);
        setBreadcrumbs([]);
      }
      showToast('Fuente eliminada de Luma (tus archivos en Drive siguen intactos).', 'info');
    },
    [activeBrowseSourceId, showToast]
  );

  const handleOpenDriveFolder = useCallback(
    (sourceId: string, folderId: string, folderName: string) => {
      setActiveBrowseSourceId(sourceId);
      setBreadcrumbs((prev) => {
        const src = driveSourcesRef.current.find((s) => s.id === sourceId);
        const base =
          prev.length === 0 && src
            ? [{ folderId: src.folderId, name: src.name }]
            : prev;
        return [...base, { folderId, name: folderName }];
      });
      void refreshSource(sourceId, folderId);
    },
    [refreshSource]
  );

  const handleBreadcrumbClick = useCallback(
    (index: number) => {
      if (!activeBrowseSourceId) return;
      if (index < 0) {
        setBreadcrumbs([]);
        void refreshSource(activeBrowseSourceId);
        return;
      }
      const next = breadcrumbs.slice(0, index + 1);
      setBreadcrumbs(next);
      const target = next[next.length - 1];
      if (target) {
        void refreshSource(activeBrowseSourceId, target.folderId);
      }
    },
    [activeBrowseSourceId, breadcrumbs, refreshSource]
  );

  const handleSelectBrowseSource = useCallback(
    (sourceId: string | null) => {
      setActiveBrowseSourceId(sourceId);
      setBreadcrumbs([]);
      if (sourceId && driveAuthRef.current.connected) {
        void refreshSource(sourceId);
      }
    },
    [refreshSource]
  );

  /* --------------------------------------------------------------------------
   * Open Cached Drive Blob (Notebook .luma.json, PDF, DOCX, EPUB, Images...)
   * ------------------------------------------------------------------------*/
  const openCachedDriveBlob = useCallback(
    async (file: DriveFileItem, blob: Blob) => {
      if (file.category === 'notebook' || file.name.toLowerCase().endsWith('.luma.json')) {
        const rawText = await blob.text();
        const parsedNb = parseLumaNotebookBundle(rawText);
        if (!parsedNb) {
          showToast('El archivo .luma.json no tiene un formato de cuaderno válido.', 'error');
          return;
        }
        const linkedNb: LumaNotebook = {
          ...parsedNb,
          driveFileId: file.id,
          driveSourceId: file.sourceId,
          driveModifiedTime: file.modifiedTime,
          syncState: 'synced',
        };
        setWorkspace((prev) => {
          const exists = prev.notebooks.some(
            (n) => n.id === linkedNb.id || n.driveFileId === file.id
          );
          return {
            ...prev,
            notebooks: exists
              ? prev.notebooks.map((n) =>
                  n.id === linkedNb.id || n.driveFileId === file.id ? linkedNb : n
                )
              : [linkedNb, ...prev.notebooks],
          };
        });
        void saveNotebookRecord(linkedNb);
        openNotebookTabDirect(linkedNb);
        return;
      }

      // Check if an already imported document matches this Drive file ID
      const existingDoc = workspaceRef.current.documents.find((d) => d.driveFileId === file.id);
      if (existingDoc) {
        openDocumentTabDirect(existingDoc);
        return;
      }

      let importedDoc: LumaDocument;
      if (file.category === 'image' || file.mimeType.startsWith('image/')) {
        const dataUrl = await blobToDataUrl(blob);
        importedDoc = {
          id: `doc_img_${Date.now().toString(36)}`,
          title: file.name.replace(/\.[^.]+$/, ''),
          author: 'Google Drive',
          year: String(new Date().getFullYear()),
          genre: 'Imagen',
          format: 'PDF',
          badgeTag: 'IMG · DRIVE',
          coverColor: '#257A5E',
          coverAccent: '#195944',
          synopsis: `Imagen sincronizada desde Google Drive (${file.name}).`,
          totalWords: 1,
          progressPercent: 0,
          currentUnit: 0,
          addedAt: Date.now(),
          lastOpenedAt: Date.now(),
          chapters: [
            {
              id: 'ch_img_1',
              title: file.name,
              blocks: [
                {
                  id: 'blk_img_1',
                  type: 'image',
                  text: file.name,
                  imageDataUrl: dataUrl,
                  imageAlt: file.name,
                },
              ],
            },
          ],
          annotationsByUnit: {},
        };
      } else {
        const browserFile = new File([blob], file.name, {
          type: file.mimeType || 'application/octet-stream',
        });
        importedDoc = await importFromBrowserFile(browserFile);
      }

      const linkedDoc: LumaDocument = {
        ...importedDoc,
        driveFileId: file.id,
        driveSourceId: file.sourceId,
        driveModifiedTime: file.modifiedTime,
        driveMimeType: file.mimeType,
        fileSizeBytes: file.size || blob.size,
        syncState: 'synced',
      };

      setWorkspace((prev) => ({
        ...prev,
        documents: [linkedDoc, ...prev.documents],
      }));
      openDocumentTabDirect(linkedDoc);
    },
    [openDocumentTabDirect, openNotebookTabDirect, showToast]
  );

  const handleTapDriveFile = useCallback(
    async (file: DriveFileItem, thumb?: string | null) => {
      if (file.isFolder) {
        handleOpenDriveFolder(file.sourceId, file.id, file.name);
        return;
      }
      const cached = await getCachedDriveFile(file.id);
      if (cached?.completed && cached.blob) {
        await openCachedDriveBlob(file, cached.blob);
        return;
      }

      await refreshStorageQuota();
      setDownloadModalFile(file);
      setDownloadModalThumb(thumb ?? null);
      const partialBytes = cached && !cached.completed ? cached.downloadedBytes : 0;
      const totalBytes = file.size || cached?.totalSize || 0;
      const pct = totalBytes > 0 ? Math.min(99, Math.round((partialBytes / totalBytes) * 100)) : 0;
      setDownloadProgress({
        fileId: file.id,
        fileName: file.name,
        totalBytes,
        loadedBytes: partialBytes,
        percent: pct,
        speedBytesPerSec: 0,
        status: partialBytes > 0 ? 'paused' : 'confirm',
      });
    },
    [handleOpenDriveFolder, openCachedDriveBlob, refreshStorageQuota]
  );

  const startOrResumeDownload = useCallback(async () => {
    const file = downloadModalFile;
    if (!file) return;
    setDownloadProgress((prev) => ({
      fileId: file.id,
      fileName: file.name,
      totalBytes: file.size || prev?.totalBytes || 0,
      loadedBytes: prev?.loadedBytes ?? 0,
      percent: prev?.percent ?? 0,
      speedBytesPerSec: 0,
      status: 'downloading',
    }));

    try {
      const result = await downloadDriveFileResumable(file, {
        onControllerReady: (ctrl) => {
          downloadCtrlRef.current = ctrl;
        },
        onProgress: (info) => {
          setDownloadProgress({
            fileId: file.id,
            fileName: file.name,
            totalBytes: info.totalBytes,
            loadedBytes: info.loadedBytes,
            percent: info.percent,
            speedBytesPerSec: info.speedBytesPerSec,
            status: 'downloading',
          });
        },
      });

      if (result.status === 'paused') {
        setDownloadProgress((prev) => (prev ? { ...prev, status: 'paused', speedBytesPerSec: 0 } : null));
        return;
      }
      if (result.status === 'cancelled') {
        setDownloadModalFile(null);
        setDownloadProgress(null);
        void refreshStorageQuota();
        return;
      }

      // Mark downloaded across Drive listings & auto-open!
      setFilesBySource((prev) => {
        const next: Record<string, DriveFileItem[]> = {};
        for (const [k, list] of Object.entries(prev)) {
          next[k] = list.map((f) =>
            f.id === file.id ? { ...f, downloaded: true, partialPercent: undefined } : f
          );
        }
        return next;
      });
      await refreshStorageQuota();
      setDownloadModalFile(null);
      setDownloadProgress(null);
      await openCachedDriveBlob({ ...file, downloaded: true }, result.blob);
    } catch (err) {
      setDownloadProgress((prev) =>
        prev
          ? {
              ...prev,
              status: 'error',
              speedBytesPerSec: 0,
              errorMessage: translateDriveError(err),
            }
          : null
      );
    }
  }, [downloadModalFile, openCachedDriveBlob, refreshStorageQuota]);

  /* --------------------------------------------------------------------------
   * Sync Notebook / File to Google Drive + Conflict Detection + Offline Queue
   * ------------------------------------------------------------------------*/
  const resolveTargetDriveSource = useCallback((preferredSourceId?: string): DriveSource | null => {
    const list = driveSourcesRef.current;
    if (preferredSourceId) {
      const found = list.find((s) => s.id === preferredSourceId);
      if (found) return found;
    }
    return list.find((s) => s.active && s.isDefault) ?? list.find((s) => s.active) ?? null;
  }, []);

  const syncNotebookToDrive = useCallback(
    async (nb: LumaNotebook, explicitSourceId?: string, forceOverwrite = false) => {
      const targetSource = resolveTargetDriveSource(explicitSourceId ?? nb.driveSourceId);
      if (!targetSource) {
        showToast('Agrega primero una carpeta en Fuentes para sincronizar con Drive.', 'info');
        setSettingsTab('sources');
        setSettingsOpen(true);
        return;
      }

      // If offline or disconnected -> queue offline job in IndexedDB
      if (!navigator.onLine || !driveAuthRef.current.connected) {
        const job: SyncQueueJob = {
          id: `job_nb_${nb.id}`,
          kind: 'upload_notebook',
          targetId: nb.id,
          title: nb.title,
          sourceId: targetSource.id,
          folderId: targetSource.folderId,
          driveFileId: nb.driveFileId,
          createdAt: Date.now(),
          attempts: 0,
        };
        await enqueueSyncJob(job);
        setSyncQueue(await loadSyncQueue());
        setWorkspace((prev) => ({
          ...prev,
          notebooks: prev.notebooks.map((n) =>
            n.id === nb.id ? { ...n, driveSourceId: targetSource.id, syncState: 'pending' } : n
          ),
        }));
        showToast(
          !navigator.onLine
            ? `Sin conexión: «${nb.title}» quedó en cola para sincronizar automáticamente.`
            : `«${nb.title}» quedó pendiente. Inicia sesión en Fuentes para subirlo.`,
          'info'
        );
        return;
      }

      try {
        // Conflict detection before overwriting an existing Drive file
        if (nb.driveFileId && !forceOverwrite) {
          const remoteMeta = await getDriveFileMetadata(nb.driveFileId);
          if (
            remoteMeta &&
            nb.driveModifiedTime &&
            remoteMeta.modifiedTime &&
            remoteMeta.modifiedTime !== nb.driveModifiedTime &&
            Date.parse(remoteMeta.modifiedTime) > Date.parse(nb.driveModifiedTime) + 2000
          ) {
            setWorkspace((prev) => ({
              ...prev,
              notebooks: prev.notebooks.map((n) =>
                n.id === nb.id ? { ...n, syncState: 'conflict' } : n
              ),
            }));
            setActiveConflict({
              id: `conf_${nb.id}`,
              kind: 'notebook',
              localId: nb.id,
              driveFileId: nb.driveFileId,
              title: nb.title,
              localUpdatedAt: nb.updatedAt,
              driveModifiedTime: remoteMeta.modifiedTime,
              sourceId: targetSource.id,
              folderId: targetSource.folderId,
            });
            return;
          }
        }

        setWorkspace((prev) => ({
          ...prev,
          notebooks: prev.notebooks.map((n) =>
            n.id === nb.id ? { ...n, syncState: 'uploading' } : n
          ),
        }));

        const bundle = JSON.stringify(
          {
            format: 'luma-notebook-v1',
            version: 1,
            exportedAt: Date.now(),
            notebook: nb,
          },
          null,
          2
        );

        const uploaded = await uploadFileResumable({
          parentFolderId: targetSource.folderId,
          fileName: sanitizeDriveFileName(nb.title, '.luma.json'),
          mimeType: 'application/json',
          content: bundle,
          existingFileId: nb.driveFileId,
        });

        const updatedNb: LumaNotebook = {
          ...nb,
          driveFileId: uploaded.id,
          driveSourceId: targetSource.id,
          driveModifiedTime: uploaded.modifiedTime,
          syncState: 'synced',
        };

        setWorkspace((prev) => ({
          ...prev,
          notebooks: prev.notebooks.map((n) => (n.id === nb.id ? updatedNb : n)),
        }));
        void saveNotebookRecord(updatedNb);
        await removeSyncJob(`job_nb_${nb.id}`);
        setSyncQueue(await loadSyncQueue());
        showToast(`«${nb.title}» sincronizado con ${targetSource.name}.`, 'success');
        void refreshSource(targetSource.id);
      } catch (err) {
        const friendly = translateDriveError(err);
        setWorkspace((prev) => ({
          ...prev,
          notebooks: prev.notebooks.map((n) =>
            n.id === nb.id ? { ...n, syncState: 'error' } : n
          ),
        }));
        showToast(friendly, 'error');
      }
    },
    [refreshSource, resolveTargetDriveSource, showToast]
  );

  const uploadImportedDocToDrive = useCallback(
    async (doc: LumaDocument, rawFile: File | undefined, sourceId: string) => {
      const targetSource = resolveTargetDriveSource(sourceId);
      if (!targetSource) return;

      const contentBlob: Blob =
        rawFile ??
        new Blob(
          [
            JSON.stringify(
              {
                format: 'luma-document-v1',
                document: doc,
              },
              null,
              2
            ),
          ],
          { type: 'application/json' }
        );
      const fileName = rawFile?.name ?? sanitizeDriveFileName(doc.title, '.json');
      const mimeType = rawFile?.type || 'application/octet-stream';

      if (!navigator.onLine || !driveAuthRef.current.connected) {
        setWorkspace((prev) => ({
          ...prev,
          documents: prev.documents.map((d) =>
            d.id === doc.id ? { ...d, driveSourceId: targetSource.id, syncState: 'pending' } : d
          ),
        }));
        showToast(`«${doc.title}» guardado localmente. Conecta Drive para subirlo.`, 'info');
        return;
      }

      try {
        setWorkspace((prev) => ({
          ...prev,
          documents: prev.documents.map((d) =>
            d.id === doc.id ? { ...d, syncState: 'uploading' } : d
          ),
        }));

        const uploaded = await uploadFileResumable({
          parentFolderId: targetSource.folderId,
          fileName,
          mimeType,
          content: contentBlob,
          existingFileId: doc.driveFileId,
        });

        setWorkspace((prev) => ({
          ...prev,
          documents: prev.documents.map((d) =>
            d.id === doc.id
              ? {
                  ...d,
                  driveFileId: uploaded.id,
                  driveSourceId: targetSource.id,
                  driveModifiedTime: uploaded.modifiedTime,
                  driveMimeType: mimeType,
                  fileSizeBytes: uploaded.size,
                  syncState: 'synced',
                }
              : d
          ),
        }));
        showToast(`«${fileName}» subido a ${targetSource.name}.`, 'success');
        void refreshSource(targetSource.id);
      } catch (err) {
        setWorkspace((prev) => ({
          ...prev,
          documents: prev.documents.map((d) =>
            d.id === doc.id ? { ...d, syncState: 'error' } : d
          ),
        }));
        showToast(translateDriveError(err), 'error');
      }
    },
    [refreshSource, resolveTargetDriveSource, showToast]
  );

  const flushSyncQueue = useCallback(async () => {
    if (!navigator.onLine || !driveAuthRef.current.connected) return;
    const jobs = await loadSyncQueue();
    if (jobs.length === 0) return;
    setIsSyncing(true);
    try {
      for (const job of jobs) {
        if (job.kind === 'upload_notebook') {
          const nb = workspaceRef.current.notebooks.find((n) => n.id === job.targetId);
          if (nb) {
            await syncNotebookToDrive(nb, job.sourceId);
          } else {
            await removeSyncJob(job.id);
          }
        } else if (job.kind === 'rename' && job.driveFileId && job.newName) {
          await renameDriveFile(job.driveFileId, job.newName);
          await removeSyncJob(job.id);
        } else if (job.kind === 'move' && job.driveFileId && job.oldFolderId) {
          await moveDriveFile(job.driveFileId, job.oldFolderId, job.folderId);
          await removeSyncJob(job.id);
        }
      }
      setSyncQueue(await loadSyncQueue());
    } finally {
      setIsSyncing(false);
    }
  }, [syncNotebookToDrive]);

  // Automatically flush offline queue when internet returns (respecting Wi-Fi policy)
  useEffect(() => {
    const onOnline = () => {
      const policy = workspaceRef.current.prefs.driveSyncPolicy ?? 'wifi_only';
      if (canAutoSyncNow(policy) && driveAuthRef.current.connected) {
        void flushSyncQueue().then(() => refreshAllSources());
      }
    };
    window.addEventListener('online', onOnline);
    return () => window.removeEventListener('online', onOnline);
  }, [flushSyncQueue, refreshAllSources]);

  const handleSyncNow = useCallback(async () => {
    if (!driveAuthRef.current.connected) {
      if (driveSourcesRef.current.length === 0) {
        setSettingsTab('sources');
        setSettingsOpen(true);
        showToast('Conecta tu cuenta de Google Drive en Ajustes → Fuentes.', 'info');
      } else {
        navigatePrimary('sources');
        showToast('Inicia sesión con Google Drive para sincronizar tus carpetas.', 'info');
      }
      return;
    }
    setIsSyncing(true);
    try {
      await flushSyncQueue();
      await refreshAllSources();
      showToast('Sincronización con Google Drive completada.', 'success');
    } finally {
      setIsSyncing(false);
    }
  }, [flushSyncQueue, navigatePrimary, refreshAllSources, showToast]);

  const handleResolveConflict = useCallback(
    async (choice: 'keep_local' | 'keep_drive' | 'keep_both') => {
      const conflict = activeConflict;
      if (!conflict) return;
      setActiveConflict(null);

      const localNb = workspaceRef.current.notebooks.find((n) => n.id === conflict.localId);
      if (!localNb) return;

      if (choice === 'keep_local') {
        await syncNotebookToDrive(localNb, conflict.sourceId, true);
        return;
      }

      try {
        const fakeDriveItem: DriveFileItem = {
          id: conflict.driveFileId,
          name: sanitizeDriveFileName(conflict.title, '.luma.json'),
          mimeType: 'application/json',
          size: 0,
          modifiedTime: conflict.driveModifiedTime,
          sourceId: conflict.sourceId,
          parentFolderId: conflict.folderId,
          isFolder: false,
          category: 'notebook',
          downloaded: false,
        };
        const res = await downloadDriveFileResumable(fakeDriveItem, {
          onProgress: () => undefined,
        });
        const remoteNb = parseLumaNotebookBundle(await res.blob.text());
        if (!remoteNb) {
          showToast('No se pudo leer la versión remota del cuaderno.', 'error');
          return;
        }

        if (choice === 'keep_both') {
          const localCopy: LumaNotebook = {
            ...localNb,
            id: `nb_${Date.now().toString(36)}_copy`,
            title: `${localNb.title} (copia local)`,
            driveFileId: undefined,
            driveModifiedTime: undefined,
            syncState: 'pending',
            updatedAt: Date.now(),
          };
          const syncedRemote: LumaNotebook = {
            ...remoteNb,
            id: localNb.id,
            driveFileId: conflict.driveFileId,
            driveSourceId: conflict.sourceId,
            driveModifiedTime: conflict.driveModifiedTime,
            syncState: 'synced',
          };
          setWorkspace((prev) => ({
            ...prev,
            notebooks: [
              localCopy,
              ...prev.notebooks.map((n) => (n.id === localNb.id ? syncedRemote : n)),
            ],
          }));
          void saveNotebookRecord(localCopy);
          void saveNotebookRecord(syncedRemote);
          showToast('Se conservaron ambas versiones sin perder cambios.', 'success');
        } else {
          // keep_drive
          const replaced: LumaNotebook = {
            ...remoteNb,
            id: localNb.id,
            driveFileId: conflict.driveFileId,
            driveSourceId: conflict.sourceId,
            driveModifiedTime: conflict.driveModifiedTime,
            syncState: 'synced',
          };
          setWorkspace((prev) => ({
            ...prev,
            notebooks: prev.notebooks.map((n) => (n.id === localNb.id ? replaced : n)),
          }));
          void saveNotebookRecord(replaced);
          showToast('Se descargó y conservó la versión de Google Drive.', 'success');
        }
      } catch (err) {
        showToast(translateDriveError(err), 'error');
      }
    },
    [activeConflict, showToast, syncNotebookToDrive]
  );

  const handleFreeLocalCache = useCallback(async () => {
    await clearAllCachedDriveFiles();
    setFilesBySource((prev) => {
      const next: Record<string, DriveFileItem[]> = {};
      for (const [k, list] of Object.entries(prev)) {
        next[k] = list.map((f) => ({ ...f, downloaded: false, partialPercent: undefined }));
      }
      return next;
    });
    await refreshStorageQuota();
    showToast('Copias locales liberadas. Tus archivos en Google Drive siguen seguros.', 'success');
  }, [refreshStorageQuota, showToast]);

  /* ============================================================================
   * Notebook Creation (IN-APP TAB — Never opens literal new browser tab!)
   * ==========================================================================*/
  const handleCreateNotebook = (
    tpl: NotebookTemplateId = 'cornell',
    title?: string,
    pageSize: NotebookPageSize = 'A4'
  ) => {
    const nb = createNotebookFromTemplate(tpl, title, pageSize);
    setWorkspace((prev) => ({ ...prev, notebooks: [nb, ...prev.notebooks] }));
    void saveNotebookRecord(nb);
    // Open directly inside Luma's top in-app tab strip for fast tab switching!
    openNotebookTabDirect(nb);

    // If user has active Drive sources configured, ask where to save/sync
    if (driveSourcesRef.current.some((s) => s.active)) {
      setPendingSaveDest({ kind: 'notebook', notebook: nb });
    }
  };

  const openCreateModal = (section: 'notebook' | 'saga' = 'notebook') => {
    setCreateModalSection(section);
    setCreateModalOpen(true);
  };

  const appendImportedDocs = (docs: LumaDocument[], rawFiles?: File[]) => {
    if (docs.length === 0) return;
    setWorkspace((prev) => ({ ...prev, documents: [...docs, ...prev.documents] }));
    openDocumentTabDirect(docs[0]);
    if (driveSourcesRef.current.some((s) => s.active)) {
      setPendingSaveDest({
        kind: 'files',
        files: docs.map((doc, idx) => ({ doc, rawFile: rawFiles?.[idx] })),
      });
    }
  };

  const handleImportFiles = async () => {
    if (window.lumaDesktop?.pickFiles) {
      const picked = await window.lumaDesktop.pickFiles('document');
      if (picked.length === 0) return;
      const imported: LumaDocument[] = [];
      for (const f of picked) {
        imported.push(await importFromBase64File(f));
      }
      appendImportedDocs(imported);
    } else {
      fileInputRef.current?.click();
    }
  };

  const handleBrowserFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;
    const imported: LumaDocument[] = [];
    for (const f of files) {
      imported.push(await importFromBrowserFile(f));
    }
    appendImportedDocs(imported, files);
  };

  const handleDropFiles = async (e: React.DragEvent) => {
    const allFiles = Array.from(e.dataTransfer.files ?? []);
    if (
      (standaloneNotebookId || activeTab.kind === 'studio') &&
      allFiles.length > 0 &&
      allFiles.every((f) => f.type.startsWith('image/'))
    ) {
      setIsDraggingFile(false);
      return;
    }
    e.preventDefault();
    setIsDraggingFile(false);
    if (allFiles.length === 0) return;
    const imported: LumaDocument[] = [];
    for (const f of allFiles) {
      imported.push(await importFromBrowserFile(f));
    }
    appendImportedDocs(imported, allFiles);
  };

  const handleUpdateDocument = (docId: string, updater: (doc: LumaDocument) => LumaDocument) => {
    setWorkspace((prev) => ({
      ...prev,
      documents: prev.documents.map((d) => (d.id === docId ? updater(d) : d)),
    }));
  };

  const handleChangeNotebook = (updated: LumaNotebook) => {
    const withSyncState: LumaNotebook = updated.driveFileId
      ? { ...updated, syncState: updated.syncState === 'uploading' ? 'uploading' : 'pending' }
      : updated;
    setWorkspace((prev) => ({
      ...prev,
      notebooks: prev.notebooks.map((n) => (n.id === updated.id ? withSyncState : n)),
    }));
    void saveNotebookRecord(withSyncState);
    setTabs((prev) =>
      prev.map((t) =>
        t.kind === 'studio' && t.targetId === updated.id ? { ...t, title: updated.title } : t
      )
    );
  };

  const handleAddHighlight = (item: Omit<HighlightNote, 'id' | 'createdAt'>) => {
    const created: HighlightNote = {
      ...item,
      id: `hl_${Date.now().toString(36)}`,
      createdAt: Date.now(),
    };
    setWorkspace((prev) => ({ ...prev, highlights: [created, ...prev.highlights] }));
  };

  const handleDeleteHighlight = (id: string) => {
    setWorkspace((prev) => ({
      ...prev,
      highlights: prev.highlights.filter((h) => h.id !== id),
    }));
  };

  const handleToggleBookmark = (docId: string, unitIndex: number, label: string) => {
    setWorkspace((prev) => {
      const exists = prev.bookmarks.find(
        (b) => b.documentId === docId && b.unitIndex === unitIndex
      );
      if (exists) {
        return { ...prev, bookmarks: prev.bookmarks.filter((b) => b.id !== exists.id) };
      }
      return {
        ...prev,
        bookmarks: [
          {
            id: `bm_${Date.now().toString(36)}`,
            documentId: docId,
            unitIndex,
            label,
            createdAt: Date.now(),
          },
          ...prev.bookmarks,
        ],
      };
    });
  };

  const handleToggleSplit = () => {
    setSplitEnabled((prev) => {
      const next = !prev;
      if (next && !splitNotebookId && workspace.notebooks.length > 0) {
        setSplitNotebookId(workspace.notebooks[0].id);
      }
      return next;
    });
  };

  const handleUpdateProfile = (patch: Partial<UserProfile>) => {
    setWorkspace((prev) => ({
      ...prev,
      profile: {
        ...prev.profile,
        ...patch,
        privacy: patch.privacy
          ? { ...prev.profile.privacy, ...patch.privacy }
          : prev.profile.privacy,
      },
    }));
  };

  const handleAddFriend = (code: string, name: string) => {
    const normalized = code.trim().toUpperCase();
    if (!normalized) return;
    setWorkspace((prev) => {
      if (prev.friends.some((f) => f.peerCode.toUpperCase() === normalized)) {
        return prev;
      }
      const colors = ['#2B64F5', '#257A5E', '#7C3AED', '#C2642B', '#E11D48'];
      const accentColor = colors[prev.friends.length % colors.length];
      const friendName = name.trim() || `Lector ${normalized.slice(-4)}`;
      return {
        ...prev,
        friends: [
          {
            peerCode: normalized,
            displayName: friendName,
            accentColor,
            readingBookTitle: 'Sin lectura activa',
            readingProgressPct: 0,
            isOnline: true,
            messages: [
              {
                id: `msg_${Date.now().toString(36)}`,
                senderName: friendName,
                text: '¡Hola! Ya estamos conectados para compartir lecturas.',
                timestampMs: Date.now(),
                isFromMe: false,
              },
            ],
          },
          ...prev.friends,
        ],
      };
    });
  };

  const handleSendMessage = (friendCode: string, text: string) => {
    const clean = text.trim();
    if (!clean) return;
    setWorkspace((prev) => ({
      ...prev,
      friends: prev.friends.map((f) =>
        f.peerCode === friendCode
          ? {
              ...f,
              messages: [
                ...f.messages,
                {
                  id: `msg_${Date.now().toString(36)}`,
                  senderName: prev.profile.username || 'Tú',
                  text: clean,
                  timestampMs: Date.now(),
                  isFromMe: true,
                },
              ],
            }
          : f
      ),
    }));
  };

  const handleExportBackup = () => {
    const payload = JSON.stringify(workspace, null, 2);
    const blob = new Blob([payload], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const link = document.createElement('a');
    link.href = url;
    link.download = `luma-respaldo-${new Date().toISOString().slice(0, 10)}.json`;
    link.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
  };

  const openSettings = (tab: SettingsTabId = 'appearance') => {
    setSettingsTab(tab);
    setSettingsOpen(true);
  };

  const openAccountHub = (tab: AccountTabId = 'profile') => {
    setAccountModalTab(tab);
    setAccountModalOpen(true);
  };

  // All files across active Drive sources (for Inicio preview)
  const activeDriveFiles = useMemo(() => {
    const activeIds = new Set(driveSources.filter((s) => s.active).map((s) => s.id));
    const list: DriveFileItem[] = [];
    for (const [sourceId, items] of Object.entries(filesBySource)) {
      if (activeIds.has(sourceId)) {
        list.push(...items);
      }
    }
    return list.sort((a, b) => Date.parse(b.modifiedTime) - Date.parse(a.modifiedTime));
  }, [driveSources, filesBySource]);

  const openDriveFileContextMenu = useCallback((file: DriveFileItem) => {
    setContextTarget({
      kind: 'drive_file',
      id: file.id,
      title: file.name,
      sizeBytes: file.size,
      modifiedLabel: new Date(file.modifiedTime).toLocaleString('es-ES'),
      syncState: file.syncState ?? 'synced',
      downloaded: file.downloaded,
      driveFileId: file.id,
      sourceId: file.sourceId,
      folderPath: file.folderPath,
      driveFile: file,
    });
  }, []);

  const openLocalDocContextMenu = useCallback((doc: LumaDocument) => {
    setContextTarget({
      kind: 'local_doc',
      id: doc.id,
      title: doc.title,
      sizeBytes: doc.fileSizeBytes,
      modifiedLabel: new Date(doc.lastOpenedAt).toLocaleString('es-ES'),
      syncState: doc.syncState ?? (doc.driveFileId ? 'synced' : 'local'),
      downloaded: true,
      driveFileId: doc.driveFileId,
      sourceId: doc.driveSourceId,
    });
  }, []);

  const openLocalNotebookContextMenu = useCallback((nb: LumaNotebook) => {
    setContextTarget({
      kind: 'local_notebook',
      id: nb.id,
      title: nb.title,
      modifiedLabel: new Date(nb.updatedAt).toLocaleString('es-ES'),
      syncState: nb.syncState ?? (nb.driveFileId ? 'synced' : 'local'),
      downloaded: true,
      driveFileId: nb.driveFileId,
      sourceId: nb.driveSourceId,
    });
  }, []);

  const activeDocument =
    activeTab.kind === 'reader'
      ? workspace.documents.find((d) => d.id === activeTab.targetId)
      : undefined;
  const activeNotebook =
    activeTab.kind === 'studio'
      ? workspace.notebooks.find((n) => n.id === activeTab.targetId)
      : undefined;
  const splitNotebook =
    workspace.notebooks.find((n) => n.id === splitNotebookId) ?? workspace.notebooks[0];

  const showSplitPane =
    splitEnabled &&
    viewport.canSplitView &&
    activeTab.kind !== 'studio' &&
    activeTab.kind !== 'sources' &&
    Boolean(splitNotebook);

  const hasPendingSync =
    syncQueue.length > 0 ||
    workspace.notebooks.some((n) => n.syncState === 'pending') ||
    workspace.documents.some((d) => d.syncState === 'pending');

  const syncButtonStatus: SyncButtonStatus = !driveAuth.connected
    ? 'disabled'
    : isSyncing
      ? 'syncing'
      : !isOnline
        ? 'offline'
        : activeConflict
          ? 'error'
          : hasPendingSync
            ? 'pending'
            : 'synced';

  const renderSyncButton = (compact = false) => (
    <SyncStatusButton
      connected={driveAuth.connected}
      status={syncButtonStatus}
      pendingCount={syncQueue.length}
      compact={compact}
      onSyncNow={() => void handleSyncNow()}
      onOpenAccount={() => openAccountHub('profile')}
    />
  );

  // Standalone browser tab view if someone visits /cuaderno/{id} directly
  if (standaloneNotebookId) {
    const standaloneNb = workspace.notebooks.find((n) => n.id === standaloneNotebookId);
    if (!hydrated && !standaloneNb) {
      return (
        <div className="h-screen w-screen flex items-center justify-center bg-[var(--luma-bg)] text-[var(--luma-ink)] text-sm">
          Cargando cuaderno...
        </div>
      );
    }

    if (!standaloneNb) {
      return (
        <div className="h-screen w-screen flex flex-col items-center justify-center gap-4 bg-[var(--luma-bg)] text-[var(--luma-ink)] p-6 text-center">
          <h1 className="text-lg font-bold">Cuaderno no encontrado</h1>
          <p className="text-xs text-[var(--luma-ink-muted)] max-w-sm">
            No encontramos el cuaderno «{standaloneNotebookId}» en este navegador. Puedes volver al inicio de Luma o crear uno nuevo.
          </p>
          <button
            type="button"
            onClick={() => {
              window.history.replaceState({}, '', '/');
              setStandaloneNotebookId(null);
            }}
            className="h-9 px-4 rounded-lg bg-[var(--luma-accent)] text-[var(--luma-on-accent)] text-xs font-semibold"
          >
            Ir a Luma Inicio
          </button>
        </div>
      );
    }

    return (
      <div className="h-screen w-screen overflow-hidden bg-[var(--luma-bg)] text-[var(--luma-ink)] relative">
        <NotebookStudio
          notebook={standaloneNb}
          viewport={viewport}
          prefs={workspace.prefs}
          isStandaloneTab
          onChangeNotebook={handleChangeNotebook}
          onSyncToDrive={() => void syncNotebookToDrive(standaloneNb)}
          syncButtonSlot={renderSyncButton(true)}
          onToggleDarkLight={(theme) => updatePrefs({ theme })}
          onBackToHome={() => {
            window.history.replaceState({}, '', '/');
            setStandaloneNotebookId(null);
          }}
        />
        {workspace.prefs.showFpsCounter && (
          <div className="fixed top-12 right-3 z-[96] px-2.5 py-0.5 rounded-md bg-neutral-900/88 text-emerald-400 font-mono text-[11px] font-bold tabular-nums pointer-events-none border border-white/10 shadow-sm">
            {fpsMetrics.fps} FPS · {fpsMetrics.frameMs}ms ({fpsMetrics.targetLabel})
          </div>
        )}
      </div>
    );
  }

  return (
    <div
      onDragOver={(e) => {
        e.preventDefault();
        setIsDraggingFile(true);
      }}
      onDragLeave={(e) => {
        if (e.currentTarget === e.target) setIsDraggingFile(false);
      }}
      onDrop={handleDropFiles}
      className="h-screen w-screen flex flex-col overflow-hidden bg-[var(--luma-bg)] text-[var(--luma-ink)] relative"
    >
      {/* Offline Banner */}
      <OfflineIndicator />

      {/* Hidden browser file picker fallback */}
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".epub,.pdf,.docx,.pptx,.txt,.md,.fb2"
        onChange={handleBrowserFileChange}
        className="hidden"
      />

      {/* Top Native Frameless PC Titlebar + Notion/Arc Tabs */}
      {!isZenMode && (
        <TitlebarAndTabs
          tabs={tabs}
          activeTabId={activeTab.id}
          viewport={viewport}
          platform={platform}
          isMaximized={isMaximized}
          isZenMode={isZenMode}
          splitEnabled={splitEnabled}
          sidebarOpen={sidebarIsOpen}
          onSelectTab={setActiveTabId}
          onCloseTab={closeTab}
          onNewNotebook={() => openCreateModal('notebook')}
          onToggleSidebar={toggleSidebar}
          onToggleSplit={handleToggleSplit}
          onToggleZen={toggleImmersiveFullscreen}
          onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        />
      )}

      {/* Main Proportional Body: Notion Sidebar + Primary Viewport (+ Optional Split Notebook) */}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        {!isZenMode && (
          <NotionSidebar
            viewport={viewport}
            open={sidebarIsOpen}
            width={effectiveSidebarWidth}
            activeNav={activeTab.kind}
            activeTargetId={activeTab.targetId}
            documents={workspace.documents}
            playlists={workspace.playlists}
            notebooks={workspace.notebooks}
            profile={workspace.profile}
            friends={workspace.friends}
            sourcesCount={driveSources.filter((s) => s.active).length}
            pendingSyncCount={syncQueue.length}
            onCloseDrawer={() => setDrawerOpenMobile(false)}
            onResizeWidth={(w) => updatePrefs({ sidebarWidth: w })}
            onNavigate={navigatePrimary}
            onOpenDocument={openDocument}
            onOpenNotebook={openNotebook}
            onImportFiles={handleImportFiles}
            onNewNotebook={() => openCreateModal('notebook')}
            onOpenCommandPalette={() => setCommandPaletteOpen(true)}
            onOpenProfile={() => openAccountHub('profile')}
            onOpenFriends={() => openAccountHub('friends')}
            onOpenSettings={() => openSettings('appearance')}
            onOpenGuide={() => setGuideOpen(true)}
          />
        )}

        {/* Primary Content Area */}
        <main className="flex-1 min-w-0 h-full flex overflow-hidden">
          <div
            className={
              showSplitPane
                ? 'w-1/2 min-w-0 h-full border-r border-[var(--luma-border)]'
                : 'flex-1 min-w-0 h-full'
            }
          >
            {activeTab.kind === 'reader' && activeDocument ? (
              <div key={activeTab.id} className="h-full w-full luma-view-enter">
                <ReaderWorkspace
                  document={activeDocument}
                  prefs={workspace.prefs}
                  viewport={viewport}
                  highlights={workspace.highlights}
                  bookmarks={workspace.bookmarks}
                  compactSplit={showSplitPane}
                  isImmersiveFullscreen={isZenMode}
                  syncButtonSlot={renderSyncButton(true)}
                  onUpdateDocument={(fn) => handleUpdateDocument(activeDocument.id, fn)}
                  onUpdatePrefs={updatePrefs}
                  onAddHighlight={handleAddHighlight}
                  onDeleteHighlight={handleDeleteHighlight}
                  onToggleBookmark={handleToggleBookmark}
                  onToggleImmersiveFullscreen={toggleImmersiveFullscreen}
                  onOpenAppearance={() => openSettings('appearance')}
                  onOpenSettings={() => openSettings('reading')}
                  onBackToLibrary={() => navigatePrimary('library')}
                />
              </div>
            ) : activeTab.kind === 'studio' && activeNotebook ? (
              <NotebookStudio
                notebook={activeNotebook}
                viewport={viewport}
                prefs={workspace.prefs}
                onChangeNotebook={handleChangeNotebook}
                onSyncToDrive={() => void syncNotebookToDrive(activeNotebook)}
                syncButtonSlot={renderSyncButton(true)}
                onToggleDarkLight={(theme) => updatePrefs({ theme })}
              />
            ) : activeTab.kind === 'sources' ? (
              <div key={activeTab.id} className="h-full w-full luma-view-enter">
                <SourcesWorkspace
                  viewport={viewport}
                  auth={driveAuth}
                  sources={driveSources}
                  filesBySource={filesBySource}
                  loadingSourceId={loadingSourceId}
                  onRefreshAll={() => void handleSyncNow()}
                  onRefreshSource={(srcId) => void refreshSource(srcId)}
                  onOpenFolder={handleOpenDriveFolder}
                  breadcrumbs={breadcrumbs}
                  onBreadcrumbClick={handleBreadcrumbClick}
                  activeBrowseSourceId={activeBrowseSourceId}
                  onSelectBrowseSource={handleSelectBrowseSource}
                  onTapDriveFile={(file, thumb) => void handleTapDriveFile(file, thumb)}
                  onOpenFileMenu={openDriveFileContextMenu}
                  onAddSourceByLink={handleAddDriveSourceByLink}
                  onPickFolderWithGooglePicker={handlePickDriveFolder}
                  onToggleSourceActive={handleToggleDriveSourceActive}
                  onSetDefaultSource={handleSetDefaultDriveSource}
                  onDeleteSource={handleDeleteDriveSource}
                  onOpenDriveSettings={() => openSettings('sources')}
                />
              </div>
            ) : (
              <div key={activeTab.id} className="h-full w-full luma-view-enter">
                <LibraryWorkspace
                  mode={
                    activeTab.kind === 'library' ||
                    activeTab.kind === 'sagas' ||
                    activeTab.kind === 'notebooks'
                      ? activeTab.kind
                      : 'home'
                  }
                  selectedSagaId={selectedSagaId}
                  viewport={viewport}
                  documents={workspace.documents}
                  playlists={workspace.playlists}
                  notebooks={workspace.notebooks}
                  driveFiles={activeDriveFiles}
                  driveConnected={driveAuth.connected}
                  pendingSyncCount={syncQueue.length}
                  isSyncing={isSyncing}
                  syncButtonSlot={renderSyncButton(false)}
                  onSyncNow={() => void handleSyncNow()}
                  onTapDriveFile={(file, thumb) => void handleTapDriveFile(file, thumb)}
                  onOpenDriveFileMenu={openDriveFileContextMenu}
                  onOpenLocalDocMenu={openLocalDocContextMenu}
                  onOpenLocalNotebookMenu={openLocalNotebookContextMenu}
                  onOpenSourcesTab={() => navigatePrimary('sources')}
                  onNavigateTab={(kind) => navigatePrimary(kind)}
                  onOpenCreateModal={openCreateModal}
                  onOpenDocument={openDocument}
                  onOpenNotebook={openNotebook}
                  onCreateNotebookFromTemplate={handleCreateNotebook}
                  onImportFiles={handleImportFiles}
                  onTogglePinDocument={(docId) =>
                    handleUpdateDocument(docId, (d) => ({ ...d, pinned: !d.pinned }))
                  }
                  onDeleteDocument={(docId) => {
                    setWorkspace((prev) => ({
                      ...prev,
                      documents: prev.documents.filter((d) => d.id !== docId),
                      playlists: prev.playlists.map((p) => ({
                        ...p,
                        documentIds: p.documentIds.filter((id) => id !== docId),
                      })),
                    }));
                    closeTab(`doc_${docId}`);
                  }}
                  onDeleteNotebook={(nbId) => {
                    setWorkspace((prev) => ({
                      ...prev,
                      notebooks: prev.notebooks.filter((n) => n.id !== nbId),
                    }));
                    void deleteNotebookRecord(nbId);
                    closeTab(`nb_${nbId}`);
                  }}
                  onCreateSaga={(name, description, accentColor) => {
                    const id = `pl_${Date.now().toString(36)}`;
                    setWorkspace((prev) => ({
                      ...prev,
                      playlists: [
                        ...prev.playlists,
                        { id, name, description, accentColor, documentIds: [], createdAt: Date.now() },
                      ],
                    }));
                    setSelectedSagaId(id);
                  }}
                  onToggleDocInSaga={(sagaId, docId) => {
                    setWorkspace((prev) => ({
                      ...prev,
                      playlists: prev.playlists.map((p) => {
                        if (p.id !== sagaId) return p;
                        const exists = p.documentIds.includes(docId);
                        return {
                          ...p,
                          documentIds: exists
                            ? p.documentIds.filter((id) => id !== docId)
                            : [...p.documentIds, docId],
                        };
                      }),
                    }));
                  }}
                  onSelectSaga={setSelectedSagaId}
                />
              </div>
            )}
          </div>

          {/* Side-by-Side Split View: Canva Study Notebook */}
          {showSplitPane && splitNotebook && (
            <div className="w-1/2 min-w-0 h-full flex flex-col">
              <NotebookStudio
                notebook={splitNotebook}
                viewport={viewport}
                prefs={workspace.prefs}
                compactSplit
                onChangeNotebook={handleChangeNotebook}
                onSyncToDrive={() => void syncNotebookToDrive(splitNotebook)}
                syncButtonSlot={renderSyncButton(true)}
                onToggleDarkLight={(theme) => updatePrefs({ theme })}
              />
            </div>
          )}
        </main>

        {/* Floating Exit Zen Mode Button */}
        {isZenMode && activeTab.kind !== 'reader' && (
          <button
            type="button"
            onClick={toggleImmersiveFullscreen}
            className="fixed top-3 right-3 z-40 h-8 px-3 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-surface)]/90 text-xs font-medium shadow-md hover:bg-[var(--luma-surface)]"
          >
            Salir de pantalla completa (ESC)
          </button>
        )}
      </div>

      {/* Mobile Bottom Navigation Bar (Inicio / Biblioteca / Fuentes / Ajustes) */}
      {!isZenMode && activeTab.kind !== 'reader' && (
        <MobileBottomNav
          activeNav={activeTab.kind}
          pendingSyncCount={syncQueue.length}
          onNavigate={(kind) => navigatePrimary(kind)}
          onOpenSettings={() => openSettings('sources')}
        />
      )}

      {/* Drag & Drop File Overlay */}
      {isDraggingFile && (
        <div className="fixed inset-0 z-50 bg-[var(--luma-accent)]/15 backdrop-blur-[2px] border-2 border-dashed border-[var(--luma-accent)] flex items-center justify-center pointer-events-none">
          <div className="px-6 py-4 rounded-xl bg-[var(--luma-surface)] border border-[var(--luma-border)] shadow-xl text-sm font-semibold">
            Suelta tus archivos EPUB, PDF, DOCX, PPTX, TXT o FB2 para importarlos a Luma
          </div>
        </div>
      )}

      {/* Command Palette (Ctrl+K) */}
      <CommandPalette
        open={commandPaletteOpen}
        documents={workspace.documents}
        notebooks={workspace.notebooks}
        playlists={workspace.playlists}
        canSplitView={viewport.canSplitView}
        onClose={() => setCommandPaletteOpen(false)}
        onOpenDocument={openDocument}
        onOpenNotebook={openNotebook}
        onSelectTheme={(id) => updatePrefs({ theme: id })}
        onImportFiles={handleImportFiles}
        onNewNotebook={() => openCreateModal('notebook')}
        onToggleSplit={handleToggleSplit}
        onOpenSagas={(sagaId) => navigatePrimary('sagas', sagaId)}
      />

      {/* ¿Qué quieres crear? Modal */}
      <CreateActionModal
        open={createModalOpen}
        initialSection={createModalSection}
        onClose={() => setCreateModalOpen(false)}
        onCreateNotebook={handleCreateNotebook}
        onImportFiles={handleImportFiles}
        onCreateSaga={(name, description, accentColor) => {
          const id = `pl_${Date.now().toString(36)}`;
          setWorkspace((prev) => ({
            ...prev,
            playlists: [
              ...prev.playlists,
              { id, name, description, accentColor, documentIds: [], createdAt: Date.now() },
            ],
          }));
          navigatePrimary('sagas', id);
        }}
      />

      {/* Guía rápida de Luma */}
      <GuideModal open={guideOpen} onClose={() => setGuideOpen(false)} />

      {/* Configuración (Apariencia, Fuentes Drive, Lectura, Inmersivo, Diccionario, Privacidad, Acerca) */}
      <SettingsModal
        open={settingsOpen}
        initialTab={settingsTab}
        prefs={workspace.prefs}
        viewport={viewport}
        driveAuth={driveAuth}
        driveCredentials={driveCredentials}
        driveSources={driveSources}
        storageQuota={storageQuota}
        pendingSyncCount={syncQueue.length}
        onClose={() => setSettingsOpen(false)}
        onUpdatePrefs={updatePrefs}
        onExportBackup={handleExportBackup}
        onSaveDriveCredentials={handleSaveDriveCredentials}
        onSignInDrive={handleSignInDrive}
        onSignOutDrive={handleSignOutDrive}
        onAddDriveSourceByLink={handleAddDriveSourceByLink}
        onPickDriveFolder={handlePickDriveFolder}
        onToggleDriveSourceActive={handleToggleDriveSourceActive}
        onSetDefaultDriveSource={handleSetDefaultDriveSource}
        onDeleteDriveSource={handleDeleteDriveSource}
        onFreeLocalCache={handleFreeLocalCache}
        onOpenClientIdGuide={() => setClientIdGuideOpen(true)}
      />

      {/* Perfil de Usuario, Cuenta Multiplataforma y Amigos */}
      <AccountFriendsModal
        open={accountModalOpen}
        initialTab={accountModalTab}
        profile={workspace.profile}
        friends={workspace.friends}
        currentBookTitle={activeDocument?.title ?? workspace.documents[0]?.title}
        onClose={() => setAccountModalOpen(false)}
        onUpdateProfile={handleUpdateProfile}
        onAddFriend={handleAddFriend}
        onSendMessage={handleSendMessage}
        cloudAccountSection={
          <MyAccountView
            session={authSession}
            initialClientId={driveCredentials.clientId}
            onSignInGoogle={handleCoreSignInGoogle}
            onSignOut={handleSignOutDrive}
            onWipeLocalAndDisconnect={handleWipeLocalAndDisconnect}
            onUpdateDisplayName={updateAccountDisplayName}
            onRenameDevice={renameConnectedDevice}
            onRemoveDevice={removeConnectedDevice}
            onOpenClientIdGuide={() => setClientIdGuideOpen(true)}
          />
        }
      />

      {/* Drive Download Confirmation + Resumable Progress Modal */}
      <DownloadConfirmModal
        file={downloadModalFile}
        thumbnailUrl={downloadModalThumb}
        progress={downloadProgress}
        storageQuota={storageQuota}
        onStartDownload={() => void startOrResumeDownload()}
        onPause={() => downloadCtrlRef.current?.pause()}
        onResume={() => void startOrResumeDownload()}
        onCancel={() => {
          downloadCtrlRef.current?.cancel();
          setDownloadModalFile(null);
          setDownloadProgress(null);
        }}
        onFreeSpace={() => void handleFreeLocalCache()}
        onClose={() => {
          setDownloadModalFile(null);
          setDownloadProgress(null);
        }}
      />

      {/* Context Menu (Long-Press / Right-Click) with Double-Confirmation Delete */}
      <DriveContextMenu
        target={contextTarget}
        sources={driveSources}
        onClose={() => setContextTarget(null)}
        onOpen={() => {
          if (!contextTarget) return;
          if (contextTarget.kind === 'drive_file' && contextTarget.driveFile) {
            void handleTapDriveFile(contextTarget.driveFile);
          } else if (contextTarget.kind === 'local_doc') {
            openDocument(contextTarget.id);
          } else if (contextTarget.kind === 'local_notebook') {
            openNotebook(contextTarget.id);
          }
        }}
        onSync={() => {
          if (!contextTarget) return;
          if (contextTarget.kind === 'local_notebook') {
            const nb = workspace.notebooks.find((n) => n.id === contextTarget.id);
            if (nb) void syncNotebookToDrive(nb);
          } else if (contextTarget.kind === 'local_doc') {
            const doc = workspace.documents.find((d) => d.id === contextTarget.id);
            const targetSrc = resolveTargetDriveSource(doc?.driveSourceId);
            if (doc && targetSrc) {
              void uploadImportedDocToDrive(doc, undefined, targetSrc.id);
            } else {
              openSettings('sources');
            }
          } else if (contextTarget.sourceId) {
            void refreshSource(contextTarget.sourceId);
          }
        }}
        onDownload={
          contextTarget?.kind === 'drive_file' && contextTarget.driveFile
            ? () => void handleTapDriveFile(contextTarget.driveFile!)
            : undefined
        }
        onRename={(newName) => {
          if (!contextTarget) return;
          if (contextTarget.kind === 'local_notebook') {
            const nb = workspace.notebooks.find((n) => n.id === contextTarget.id);
            if (nb) {
              handleChangeNotebook({ ...nb, title: newName, updatedAt: Date.now() });
              if (nb.driveFileId && driveAuth.connected) {
                void renameDriveFile(
                  nb.driveFileId,
                  sanitizeDriveFileName(newName, '.luma.json')
                ).catch((err) => showToast(translateDriveError(err), 'error'));
              }
            }
          } else if (contextTarget.kind === 'local_doc') {
            handleUpdateDocument(contextTarget.id, (d) => ({ ...d, title: newName }));
            if (contextTarget.driveFileId && driveAuth.connected) {
              void renameDriveFile(contextTarget.driveFileId, newName).catch((err) =>
                showToast(translateDriveError(err), 'error')
              );
            }
          } else if (contextTarget.kind === 'drive_file' && contextTarget.driveFileId) {
            void renameDriveFile(contextTarget.driveFileId, newName)
              .then(() => {
                if (contextTarget.sourceId) void refreshSource(contextTarget.sourceId);
                showToast(`Renombrado a «${newName}».`, 'success');
              })
              .catch((err) => showToast(translateDriveError(err), 'error'));
          }
        }}
        onMoveToSource={(targetSourceId) => {
          if (!contextTarget?.driveFileId) return;
          const oldSrc = driveSources.find((s) => s.id === contextTarget.sourceId);
          const newSrc = driveSources.find((s) => s.id === targetSourceId);
          if (!oldSrc || !newSrc) return;
          const oldParentId = contextTarget.driveFile?.parentFolderId ?? oldSrc.folderId;
          void moveDriveFile(contextTarget.driveFileId, oldParentId, newSrc.folderId)
            .then(() => {
              void refreshSource(oldSrc.id);
              void refreshSource(newSrc.id);
              showToast(`Movido a «${newSrc.name}».`, 'success');
            })
            .catch((err) => showToast(translateDriveError(err), 'error'));
        }}
        onDeleteLocal={
          contextTarget?.downloaded
            ? () => {
                if (!contextTarget) return;
                if (contextTarget.kind === 'drive_file') {
                  void deleteCachedDriveFile(contextTarget.id).then(() => {
                    setFilesBySource((prev) => {
                      const next: Record<string, DriveFileItem[]> = {};
                      for (const [k, list] of Object.entries(prev)) {
                        next[k] = list.map((f) =>
                          f.id === contextTarget.id
                            ? { ...f, downloaded: false, partialPercent: undefined }
                            : f
                        );
                      }
                      return next;
                    });
                    void refreshStorageQuota();
                    showToast('Copia local eliminada (sigue disponible en Google Drive).', 'info');
                  });
                } else if (contextTarget.kind === 'local_doc') {
                  setWorkspace((prev) => ({
                    ...prev,
                    documents: prev.documents.filter((d) => d.id !== contextTarget.id),
                  }));
                  closeTab(`doc_${contextTarget.id}`);
                } else if (contextTarget.kind === 'local_notebook') {
                  setWorkspace((prev) => ({
                    ...prev,
                    notebooks: prev.notebooks.filter((n) => n.id !== contextTarget.id),
                  }));
                  void deleteNotebookRecord(contextTarget.id);
                  closeTab(`nb_${contextTarget.id}`);
                }
              }
            : undefined
        }
        onDeleteFromDrive={
          contextTarget?.driveFileId
            ? () => {
                const fileId = contextTarget.driveFileId!;
                void deleteDriveFile(fileId)
                  .then(async () => {
                    await deleteCachedDriveFile(fileId);
                    setFilesBySource((prev) => {
                      const next: Record<string, DriveFileItem[]> = {};
                      for (const [k, list] of Object.entries(prev)) {
                        next[k] = list.filter((f) => f.id !== fileId);
                      }
                      return next;
                    });
                    setWorkspace((prev) => ({
                      ...prev,
                      notebooks: prev.notebooks.map((n) =>
                        n.driveFileId === fileId
                          ? { ...n, driveFileId: undefined, driveSourceId: undefined, syncState: undefined }
                          : n
                      ),
                      documents: prev.documents.map((d) =>
                        d.driveFileId === fileId
                          ? { ...d, driveFileId: undefined, driveSourceId: undefined, syncState: undefined }
                          : d
                      ),
                    }));
                    void refreshStorageQuota();
                    showToast('Archivo eliminado permanentemente de Google Drive.', 'info');
                  })
                  .catch((err) => showToast(translateDriveError(err), 'error'));
              }
            : undefined
        }
      />

      {/* Sync Conflict Resolution Modal */}
      <SyncConflictModal
        conflict={activeConflict}
        onResolve={(choice) => void handleResolveConflict(choice)}
        onClose={() => setActiveConflict(null)}
      />

      {/* Save Destination Modal when creating notebook or importing files with active Drive sources */}
      <SaveDestinationModal
        open={Boolean(pendingSaveDest)}
        itemLabel={
          pendingSaveDest?.kind === 'notebook'
            ? pendingSaveDest.notebook.title
            : pendingSaveDest?.kind === 'files'
              ? pendingSaveDest.files.map((f) => f.doc.title).join(', ')
              : ''
        }
        sources={driveSources}
        onConfirm={(sourceId) => {
          const item = pendingSaveDest;
          setPendingSaveDest(null);
          if (!item || !sourceId) return;
          if (item.kind === 'notebook') {
            void syncNotebookToDrive(item.notebook, sourceId);
          } else {
            for (const f of item.files) {
              void uploadImportedDocToDrive(f.doc, f.rawFile, sourceId);
            }
          }
        }}
        onClose={() => setPendingSaveDest(null)}
      />

      {/* Pantalla de Bienvenida (solo en el primer arranque) */}
      {hydrated && !authSession.welcomeCompleted && (
        <WelcomeScreen
          initialClientId={driveCredentials.clientId}
          onSignInGoogle={handleCoreSignInGoogle}
          onSkipOffline={completeWelcomeWithSkip}
          onOpenClientIdGuide={() => setClientIdGuideOpen(true)}
        />
      )}

      {/* Step-by-Step Client ID Visual Guide Modal */}
      <ClientIdGuideModal open={clientIdGuideOpen} onClose={() => setClientIdGuideOpen(false)} />

      {/* Live FPS Counter Badge */}
      {workspace.prefs.showFpsCounter && (
        <div className="fixed top-12 right-3 z-[96] px-2.5 py-0.5 rounded-md bg-neutral-900/88 text-emerald-400 font-mono text-[11px] font-bold tabular-nums pointer-events-none border border-white/10 shadow-sm">
          {fpsMetrics.fps} FPS · {fpsMetrics.frameMs}ms ({fpsMetrics.targetLabel})
        </div>
      )}

      {/* Optical Blue-Light & Night Dimming Overlay */}
      {workspace.prefs.warmFilterStrength > 0.01 && (
        <div
          className="fixed inset-0 pointer-events-none z-[60]"
          style={{
            backgroundColor: '#FF9E3D',
            opacity: workspace.prefs.warmFilterStrength * 0.45,
          }}
        />
      )}
      {workspace.prefs.nightDimming > 0.01 && (
        <div
          className="fixed inset-0 pointer-events-none z-[60]"
          style={{
            backgroundColor: '#000000',
            opacity: workspace.prefs.nightDimming * 0.5,
          }}
        />
      )}

      {/* Drive / Sync Toast Banner */}
      {driveToast && (
        <div
          role="status"
          className={`fixed bottom-20 md:bottom-5 right-4 left-4 md:left-auto z-[98] max-w-[400px] px-4 py-3 rounded-xl border shadow-xl text-xs font-semibold flex items-center justify-between gap-3 ${
            driveToast.tone === 'error'
              ? 'border-red-500/40 bg-red-600 text-white'
              : driveToast.tone === 'success'
                ? 'border-emerald-500/40 bg-emerald-600 text-white'
                : 'border-[var(--luma-border)] bg-[var(--luma-surface)] text-[var(--luma-ink)]'
          }`}
        >
          <span className="leading-snug">{driveToast.message}</span>
          <button
            type="button"
            onClick={() => setDriveToast(null)}
            className="opacity-80 hover:opacity-100 shrink-0 text-[11px] underline"
          >
            Cerrar
          </button>
        </div>
      )}
    </div>
  );
}
