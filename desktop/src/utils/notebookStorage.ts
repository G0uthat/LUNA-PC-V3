import { CanvasObject, LumaNotebook } from '../types';

/**
 * Persistent storage for Luma Notebooks, Custom Fonts, Swatch Palettes,
 * and Cross-Notebook Clipboard using IndexedDB + localStorage fallback
 * and BroadcastChannel for live multi-tab synchronization.
 */

const DB_NAME = 'luma_studio_db_v1';
const DB_VERSION = 1;
const STORE_NOTEBOOKS = 'notebooks';
const STORE_FONTS = 'fonts';

const LS_NOTEBOOK_PREFIX = 'luma_notebook_item_';
const LS_CLIPBOARD_KEY = 'luma_shared_clipboard_v1';
const LS_PALETTE_KEY = 'luma_saved_palette_v1';
const LS_RECENT_COLORS_KEY = 'luma_recent_colors_v1';
const SYNC_CHANNEL = 'luma_notebook_sync_v1';

export interface StoredCustomFont {
  id: string;
  name: string;
  fileName: string;
  mimeType: string;
  dataUrl: string;
  addedAt: number;
}

function openDB(): Promise<IDBDatabase | null> {
  if (typeof indexedDB === 'undefined') return Promise.resolve(null);
  return new Promise((resolve) => {
    try {
      const req = indexedDB.open(DB_NAME, DB_VERSION);
      req.onupgradeneeded = () => {
        const db = req.result;
        if (!db.objectStoreNames.contains(STORE_NOTEBOOKS)) {
          db.createObjectStore(STORE_NOTEBOOKS, { keyPath: 'id' });
        }
        if (!db.objectStoreNames.contains(STORE_FONTS)) {
          db.createObjectStore(STORE_FONTS, { keyPath: 'id' });
        }
      };
      req.onsuccess = () => resolve(req.result);
      req.onerror = () => resolve(null);
    } catch {
      resolve(null);
    }
  });
}

/**
 * Immediately saves a notebook to localStorage (sync, so a newly opened tab
 * finds it on frame 0) AND persists it to IndexedDB (large capacity for images).
 */
export async function saveNotebookRecord(notebook: LumaNotebook): Promise<void> {
  try {
    localStorage.setItem(`${LS_NOTEBOOK_PREFIX}${notebook.id}`, JSON.stringify(notebook));
  } catch {
    // Quota exceeded in localStorage -> IndexedDB below handles large notebooks
  }

  const db = await openDB();
  if (db) {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_NOTEBOOKS, 'readwrite');
        tx.objectStore(STORE_NOTEBOOKS).put(notebook);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }

  broadcastNotebookUpdate(notebook);
}

/**
 * Loads a single notebook by ID from IndexedDB or localStorage.
 */
export async function loadNotebookRecord(id: string): Promise<LumaNotebook | null> {
  const db = await openDB();
  if (db) {
    const fromIdb = await new Promise<LumaNotebook | null>((resolve) => {
      try {
        const tx = db.transaction(STORE_NOTEBOOKS, 'readonly');
        const req = tx.objectStore(STORE_NOTEBOOKS).get(id);
        req.onsuccess = () => resolve((req.result as LumaNotebook | undefined) ?? null);
        req.onerror = () => resolve(null);
      } catch {
        resolve(null);
      }
    });
    if (fromIdb) return fromIdb;
  }

  try {
    const raw = localStorage.getItem(`${LS_NOTEBOOK_PREFIX}${id}`);
    if (raw) return JSON.parse(raw) as LumaNotebook;
  } catch {
    // ignore
  }
  return null;
}

/**
 * Loads all notebooks persisted in IndexedDB to merge with workspace state.
 */
export async function loadAllNotebookRecords(): Promise<LumaNotebook[]> {
  const db = await openDB();
  if (!db) return [];
  return new Promise((resolve) => {
    try {
      const tx = db.transaction(STORE_NOTEBOOKS, 'readonly');
      const req = tx.objectStore(STORE_NOTEBOOKS).getAll();
      req.onsuccess = () => resolve(Array.isArray(req.result) ? (req.result as LumaNotebook[]) : []);
      req.onerror = () => resolve([]);
    } catch {
      resolve([]);
    }
  });
}

export async function deleteNotebookRecord(id: string): Promise<void> {
  try {
    localStorage.removeItem(`${LS_NOTEBOOK_PREFIX}${id}`);
  } catch {
    // ignore
  }
  const db = await openDB();
  if (db) {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_NOTEBOOKS, 'readwrite');
        tx.objectStore(STORE_NOTEBOOKS).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
}

/**
 * Cross-tab synchronization so editing a notebook in /cuaderno/{id}
 * immediately reflects in the main Luma tab and vice versa.
 */
let syncChannel: BroadcastChannel | null = null;
function getChannel(): BroadcastChannel | null {
  if (typeof BroadcastChannel === 'undefined') return null;
  if (!syncChannel) {
    try {
      syncChannel = new BroadcastChannel(SYNC_CHANNEL);
    } catch {
      return null;
    }
  }
  return syncChannel;
}

export function broadcastNotebookUpdate(notebook: LumaNotebook): void {
  try {
    getChannel()?.postMessage({ type: 'NOTEBOOK_UPDATED', notebook });
  } catch {
    // ignore
  }
}

export function subscribeNotebookSync(
  onUpdate: (notebook: LumaNotebook) => void
): () => void {
  const ch = getChannel();
  const handleChannelMsg = (ev: MessageEvent) => {
    if (ev.data?.type === 'NOTEBOOK_UPDATED' && ev.data.notebook) {
      onUpdate(ev.data.notebook as LumaNotebook);
    }
  };
  const handleStorage = (ev: StorageEvent) => {
    if (ev.key && ev.key.startsWith(LS_NOTEBOOK_PREFIX) && ev.newValue) {
      try {
        onUpdate(JSON.parse(ev.newValue) as LumaNotebook);
      } catch {
        // ignore
      }
    }
  };

  ch?.addEventListener('message', handleChannelMsg);
  window.addEventListener('storage', handleStorage);
  return () => {
    ch?.removeEventListener('message', handleChannelMsg);
    window.removeEventListener('storage', handleStorage);
  };
}

/**
 * Builds the canonical URL for opening a notebook in a new browser tab (/cuaderno/{id}),
 * with automatic hash fallback when running from Electron file:// protocol.
 */
export function buildNotebookTabUrl(notebookId: string): string {
  if (typeof window === 'undefined') return `/cuaderno/${encodeURIComponent(notebookId)}`;
  if (window.location.protocol === 'file:') {
    const base = window.location.href.split('#')[0];
    return `${base}#/cuaderno/${encodeURIComponent(notebookId)}`;
  }
  return `${window.location.origin}/cuaderno/${encodeURIComponent(notebookId)}`;
}

/**
 * Extracts notebook ID if the current URL is /cuaderno/{id} or #/cuaderno/{id} or ?cuaderno={id}.
 */
export function parseNotebookIdFromUrl(): string | null {
  if (typeof window === 'undefined') return null;
  const pathMatch = window.location.pathname.match(/\/cuaderno\/([^/?#]+)/);
  if (pathMatch?.[1]) return decodeURIComponent(pathMatch[1]);

  const hashMatch = window.location.hash.match(/\/cuaderno\/([^/?#]+)/);
  if (hashMatch?.[1]) return decodeURIComponent(hashMatch[1]);

  const params = new URLSearchParams(window.location.search);
  const queryId = params.get('cuaderno');
  if (queryId) return queryId;

  return null;
}

/** Custom Fonts persistence */
export async function saveCustomFontRecord(font: StoredCustomFont): Promise<void> {
  const db = await openDB();
  if (db) {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_FONTS, 'readwrite');
        tx.objectStore(STORE_FONTS).put(font);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  } else {
    try {
      const existing = await loadAllCustomFonts();
      const next = [font, ...existing.filter((f) => f.id !== font.id)];
      localStorage.setItem('luma_custom_fonts_v1', JSON.stringify(next));
    } catch {
      // ignore
    }
  }
}

export async function loadAllCustomFonts(): Promise<StoredCustomFont[]> {
  const db = await openDB();
  if (db) {
    return new Promise((resolve) => {
      try {
        const tx = db.transaction(STORE_FONTS, 'readonly');
        const req = tx.objectStore(STORE_FONTS).getAll();
        req.onsuccess = () => {
          const list = Array.isArray(req.result) ? (req.result as StoredCustomFont[]) : [];
          resolve(list.sort((a, b) => b.addedAt - a.addedAt));
        };
        req.onerror = () => resolve([]);
      } catch {
        resolve([]);
      }
    });
  }
  try {
    const raw = localStorage.getItem('luma_custom_fonts_v1');
    return raw ? (JSON.parse(raw) as StoredCustomFont[]) : [];
  } catch {
    return [];
  }
}

export async function deleteCustomFontRecord(id: string): Promise<void> {
  const db = await openDB();
  if (db) {
    await new Promise<void>((resolve) => {
      try {
        const tx = db.transaction(STORE_FONTS, 'readwrite');
        tx.objectStore(STORE_FONTS).delete(id);
        tx.oncomplete = () => resolve();
        tx.onerror = () => resolve();
      } catch {
        resolve();
      }
    });
  }
}

/** Shared Cross-Notebook Object Clipboard */
export function writeSharedClipboard(objects: CanvasObject[]): void {
  try {
    localStorage.setItem(
      LS_CLIPBOARD_KEY,
      JSON.stringify({ objects, copiedAt: Date.now() })
    );
  } catch {
    // ignore
  }
}

export function readSharedClipboard(): CanvasObject[] {
  try {
    const raw = localStorage.getItem(LS_CLIPBOARD_KEY);
    if (!raw) return [];
    const parsed = JSON.parse(raw) as { objects?: CanvasObject[] };
    return Array.isArray(parsed.objects) ? parsed.objects : [];
  } catch {
    return [];
  }
}

/** Saved Palette & Recent Colors */
const DEFAULT_PALETTE = [
  '#1A2233',
  '#2B64F5',
  '#C2642B',
  '#257A5E',
  '#E11D48',
  '#5B4BDB',
  '#F59E0B',
  '#0EA5E9',
  '#10B981',
  '#EC4899',
  '#64748B',
  '#FFFFFF',
];

export function loadSavedPalette(): string[] {
  try {
    const raw = localStorage.getItem(LS_PALETTE_KEY);
    if (!raw) return DEFAULT_PALETTE;
    const arr = JSON.parse(raw) as string[];
    return Array.isArray(arr) && arr.length > 0 ? arr : DEFAULT_PALETTE;
  } catch {
    return DEFAULT_PALETTE;
  }
}

export function savePaletteColors(colors: string[]): void {
  try {
    localStorage.setItem(LS_PALETTE_KEY, JSON.stringify(colors.slice(0, 24)));
  } catch {
    // ignore
  }
}

export function loadRecentColors(): string[] {
  try {
    const raw = localStorage.getItem(LS_RECENT_COLORS_KEY);
    if (!raw) return ['#2B64F5', '#1A2233', '#E11D48', '#257A5E', '#F59E0B'];
    const arr = JSON.parse(raw) as string[];
    return Array.isArray(arr) ? arr : [];
  } catch {
    return [];
  }
}

export function pushRecentColor(color: string): string[] {
  const normalized = color.toUpperCase();
  const next = [normalized, ...loadRecentColors().filter((c) => c.toUpperCase() !== normalized)].slice(0, 12);
  try {
    localStorage.setItem(LS_RECENT_COLORS_KEY, JSON.stringify(next));
  } catch {
    // ignore
  }
  return next;
}
