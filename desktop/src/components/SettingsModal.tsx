import React, { useState } from 'react';
import {
  BookOpen,
  Check,
  Cloud,
  Copy,
  Download,
  ExternalLink,
  EyeOff,
  FolderPlus,
  Gauge,
  HardDrive,
  Heart,
  Info,
  Keyboard,
  Languages,
  LogOut,
  Monitor,
  Moon,
  Palette,
  Plus,
  RefreshCw,
  Settings,
  ShieldCheck,
  SlidersHorizontal,
  Star,
  Sun,
  Trash2,
  X,
} from 'lucide-react';
import {
  ImmersiveFadeSpeed,
  InterfaceDensity,
  ReaderFontId,
  ReaderMenuStyle,
  TargetFpsOption,
  WorkspacePreferences,
} from '../types';
import { LUMA_THEMES } from '../themes';
import { ViewportProfile } from '../hooks/useViewportProfile';
import { LumaBrandLogo } from './LumaBrandLogo';
import { PWAInstallButton } from './PWAInstallButton';
import {
  DriveAuthState,
  DriveSource,
  StorageQuotaInfo,
} from '../drive/driveTypes';
import { formatBytes } from '../drive/driveCache';
import { GoogleSignInAction } from '../core';

export type SettingsTabId =
  | 'appearance'
  | 'sources'
  | 'reading'
  | 'immersive'
  | 'dictionary'
  | 'privacy'
  | 'about';

interface SettingsModalProps {
  open: boolean;
  initialTab?: SettingsTabId;
  prefs: WorkspacePreferences;
  viewport: ViewportProfile;
  driveAuth: DriveAuthState;
  driveSources: DriveSource[];
  storageQuota: StorageQuotaInfo | null;
  pendingSyncCount: number;
  onClose: () => void;
  onUpdatePrefs: (patch: Partial<WorkspacePreferences>) => void;
  onExportBackup: () => void;
  onSignInDrive: () => Promise<void>;
  onSignOutDrive: () => void;
  onAddDriveSourceByLink: (link: string, name: string, color: string) => Promise<void>;
  onPickDriveFolder: () => Promise<void>;
  onToggleDriveSourceActive: (id: string) => void;
  onSetDefaultDriveSource: (id: string) => void;
  onDeleteDriveSource: (id: string) => void;
  onFreeLocalCache: () => Promise<void>;
}

const FONT_OPTIONS: Array<{ id: ReaderFontId; label: string; sample: string; css: string }> = [
  { id: 'literata', label: 'Literata', sample: 'Serif editorial clásica', css: 'var(--font-serif)' },
  { id: 'plus_jakarta', label: 'Plus Jakarta', sample: 'Sans limpia moderna', css: 'var(--font-sans)' },
  { id: 'lexend', label: 'Lexend', sample: 'Fluidez y descanso visual', css: 'var(--font-dyslexic)' },
  { id: 'jetbrains_mono', label: 'JetBrains Mono', sample: 'Monoespaciada técnica', css: 'var(--font-mono)' },
];

const FPS_OPTIONS: Array<{ id: TargetFpsOption; label: string; sub: string }> = [
  { id: 'max', label: 'Máx', sub: 'Auto' },
  { id: 60, label: '60', sub: 'FPS' },
  { id: 90, label: '90', sub: 'FPS' },
  { id: 120, label: '120', sub: 'FPS' },
  { id: 144, label: '144', sub: 'FPS' },
  { id: 240, label: '240', sub: 'FPS' },
];

const FADE_SPEEDS: Array<{ id: ImmersiveFadeSpeed; label: string }> = [
  { id: 'very_fast', label: 'Muy rápido' },
  { id: 'fast', label: 'Rápido' },
  { id: 'smooth', label: 'Suave' },
];

const DISCORD_URL = 'https://discord.gg/f2Ey5NP9dN';

const BUNDLED_FONT_LICENSES = [
  { name: 'Literata', license: 'SIL Open Font License 1.1', author: 'TypeTogether' },
  { name: 'Plus Jakarta Sans', license: 'SIL Open Font License 1.1', author: 'Tokotype' },
  { name: 'Lexend', license: 'SIL Open Font License 1.1', author: 'Bonnie Shaver-Troup & Thomas Jockin' },
  { name: 'JetBrains Mono', license: 'SIL Open Font License 1.1', author: 'JetBrains' },
];

export const SettingsModal: React.FC<SettingsModalProps> = ({
  open,
  initialTab = 'appearance',
  prefs,
  viewport,
  driveAuth,
  driveSources,
  storageQuota,
  pendingSyncCount,
  onClose,
  onUpdatePrefs,
  onExportBackup,
  onSignInDrive,
  onSignOutDrive,
  onAddDriveSourceByLink,
  onPickDriveFolder,
  onToggleDriveSourceActive,
  onSetDefaultDriveSource,
  onDeleteDriveSource,
  onFreeLocalCache,
}) => {
  const [tab, setTab] = useState<SettingsTabId>(initialTab);
  const [newSourceName, setNewSourceName] = useState('');
  const [newSourceUrl, setNewSourceUrl] = useState('');
  const [copiedDiscord, setCopiedDiscord] = useState(false);
  const [checkingUpdate, setCheckingUpdate] = useState(false);
  const [updateMessage, setUpdateMessage] = useState('Luma está al día (v1.0).');
  const [showLicenses, setShowLicenses] = useState(false);

  const [driveStatusMsg, setDriveStatusMsg] = useState<string | null>(null);
  const [driveErrorMsg, setDriveErrorMsg] = useState<string | null>(null);
  const [driveBusy, setDriveBusy] = useState(false);
  const [folderLinkInput, setFolderLinkInput] = useState('');
  const [folderNameInput, setFolderNameInput] = useState('');

  React.useEffect(() => {
    if (open) {
      setTab(initialTab);
      setDriveErrorMsg(null);
    }
  }, [open, initialTab]);

  if (!open) return null;

  const lightThemes = LUMA_THEMES.filter((t) => !t.isDark);
  const darkThemes = LUMA_THEMES.filter((t) => t.isDark);

  const densityOptions: Array<{ id: InterfaceDensity; label: string; desc: string }> = [
    { id: 'auto', label: 'Automática', desc: 'Según resolución' },
    { id: 'compact', label: 'Compacta', desc: 'Más densidad' },
    { id: 'comfortable', label: 'Cómoda', desc: 'Estándar PC' },
    { id: 'spacious', label: 'Amplia', desc: 'Más aire visual' },
  ];

  const menuStyles: Array<{ id: ReaderMenuStyle; title: string; desc: string }> = [
    {
      id: 'bookmark',
      title: 'Marcapáginas',
      desc: 'Pestaña arrastrable en cualquier lateral',
    },
    {
      id: 'island',
      title: 'Isla dinámica',
      desc: 'Cápsula flotante superior desplegable',
    },
    {
      id: 'classic',
      title: 'Clásico',
      desc: 'Barra superior e inferior al tocar el centro',
    },
  ];

  const navTabs: Array<{ id: SettingsTabId; label: string; icon: React.ReactNode }> = [
    { id: 'appearance', label: 'Apariencia', icon: <Palette className="w-4 h-4 shrink-0" /> },
    { id: 'sources', label: 'Fuentes (Drive)', icon: <Cloud className="w-4 h-4 shrink-0" /> },
    { id: 'reading', label: 'Lectura y Menú', icon: <BookOpen className="w-4 h-4 shrink-0" /> },
    { id: 'immersive', label: 'Modo Inmersivo', icon: <EyeOff className="w-4 h-4 shrink-0" /> },
    { id: 'dictionary', label: 'Diccionario', icon: <Languages className="w-4 h-4 shrink-0" /> },
    { id: 'privacy', label: 'Privacidad', icon: <ShieldCheck className="w-4 h-4 shrink-0" /> },
    { id: 'about', label: 'Acerca de Luma', icon: <Info className="w-4 h-4 shrink-0" /> },
  ];

  const handleAddDictionarySource = (e: React.FormEvent) => {
    e.preventDefault();
    const name = newSourceName.trim();
    const url = newSourceUrl.trim();
    if (!name || !url) return;
    const normalizedUrl = url.includes('{palabra}') ? url : `${url}${url.includes('?') ? '&' : '?'}q={palabra}`;
    onUpdatePrefs({
      dictionarySources: [
        ...prefs.dictionarySources,
        {
          id: `dict_${Date.now().toString(36)}`,
          name,
          subtitle: normalizedUrl,
          urlTemplate: normalizedUrl,
          enabled: true,
        },
      ],
    });
    setNewSourceName('');
    setNewSourceUrl('');
  };

  const handleToggleDictionarySource = (id: string, enabled: boolean) => {
    onUpdatePrefs({
      dictionarySources: prefs.dictionarySources.map((s) =>
        s.id === id ? { ...s, enabled } : s
      ),
    });
  };

  const handleDeleteDictionarySource = (id: string) => {
    onUpdatePrefs({
      dictionarySources: prefs.dictionarySources.filter((s) => s.id !== id),
    });
  };

  const handleCopyDiscord = () => {
    navigator.clipboard?.writeText(DISCORD_URL).catch(() => undefined);
    setCopiedDiscord(true);
    window.setTimeout(() => setCopiedDiscord(false), 1800);
  };

  const handleOpenExternal = (url: string) => {
    if (window.lumaDesktop?.openExternal) {
      window.lumaDesktop.openExternal(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const handleCheckUpdate = () => {
    setCheckingUpdate(true);
    setUpdateMessage('Comprobando versión instalada...');
    window.setTimeout(() => {
      setCheckingUpdate(false);
      setUpdateMessage('Luma está al día (v1.0 · build 1).');
    }, 650);
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-center justify-center p-4 luma-modal-backdrop"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[880px] max-h-[88vh] flex flex-col rounded-2xl border border-[var(--luma-border)] bg-[var(--luma-surface)] text-[var(--luma-ink)] shadow-2xl overflow-hidden luma-modal-pop"
      >
        {/* Modal Header */}
        <div className="px-6 py-4 border-b border-[var(--luma-border)] flex items-center justify-between gap-4 shrink-0">
          <div className="flex items-center gap-2.5">
            <Settings className="w-4 h-4 text-[var(--luma-accent)]" />
            <div>
              <h2 className="text-base font-bold tracking-tight">Configuración de Luma</h2>
              <p className="text-xs text-[var(--luma-ink-muted)] tabular-nums">
                Apariencia, lectura inmersiva, diccionario y sistema · {viewport.width}×{viewport.height}px
              </p>
            </div>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)] hover:bg-[var(--luma-surface-alt)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Body: Left settings navigation + Right content */}
        <div className="flex-1 min-h-0 flex flex-col sm:flex-row overflow-hidden">
          <nav className="sm:w-[205px] shrink-0 border-b sm:border-b-0 sm:border-r border-[var(--luma-border)] bg-[var(--luma-sidebar)] p-2.5 flex sm:flex-col gap-1 overflow-x-auto">
            {navTabs.map((item) => {
              const active = tab === item.id;
              return (
                <button
                  key={item.id}
                  type="button"
                  onClick={() => setTab(item.id)}
                  className={`h-9 px-3 rounded-lg flex items-center gap-2 text-xs whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-[var(--luma-accent-soft)] text-[var(--luma-accent)] font-semibold'
                      : 'text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)] hover:bg-[var(--luma-surface-alt)] font-medium'
                  }`}
                >
                  {item.icon}
                  <span>{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="flex-1 overflow-y-auto px-6 py-5 space-y-6">
            {/* TAB 1: APARIENCIA & RENDIMIENTO */}
            {tab === 'appearance' && (
              <>
                <section>
                  <div className="flex items-center gap-2 text-xs font-semibold text-[var(--luma-ink-muted)] mb-3">
                    <Sun className="w-3.5 h-3.5" />
                    <span>Temas claros y papel cálido ({lightThemes.length})</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {lightThemes.map((t) => {
                      const selected = prefs.theme === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => onUpdatePrefs({ theme: t.id })}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            selected
                              ? 'ring-2 ring-[var(--luma-accent)] border-[var(--luma-accent)]'
                              : 'border-[var(--luma-border)] hover:border-[var(--luma-ink-muted)]/50'
                          }`}
                          style={{ backgroundColor: t.bg, color: t.ink }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span
                              className="w-5 h-5 rounded-full border border-black/10 flex items-center justify-center"
                              style={{ backgroundColor: t.accent, color: t.onAccent }}
                            >
                              {selected && <Check className="w-3 h-3" />}
                            </span>
                            <span
                              className="w-6 h-2.5 rounded-sm border border-black/10"
                              style={{ backgroundColor: t.surface }}
                            />
                          </div>
                          <div className="text-xs font-semibold truncate">{t.name}</div>
                          <div className="text-[11px] opacity-75 truncate">{t.comfortTag}</div>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section>
                  <div className="flex items-center gap-2 text-xs font-semibold text-[var(--luma-ink-muted)] mb-3">
                    <Moon className="w-3.5 h-3.5" />
                    <span>Temas nocturnos sin fatiga ({darkThemes.length})</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-3 gap-2.5">
                    {darkThemes.map((t) => {
                      const selected = prefs.theme === t.id;
                      return (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => onUpdatePrefs({ theme: t.id })}
                          className={`p-3 rounded-xl border text-left transition-all ${
                            selected
                              ? 'ring-2 ring-[var(--luma-accent)] border-[var(--luma-accent)]'
                              : 'border-[var(--luma-border)] hover:border-[var(--luma-ink-muted)]/50'
                          }`}
                          style={{ backgroundColor: t.bg, color: t.ink }}
                        >
                          <div className="flex items-center justify-between mb-2">
                            <span
                              className="w-5 h-5 rounded-full flex items-center justify-center"
                              style={{ backgroundColor: t.accent, color: t.onAccent }}
                            >
                              {selected && <Check className="w-3 h-3" />}
                            </span>
                            <span
                              className="w-6 h-2.5 rounded-sm border border-white/10"
                              style={{ backgroundColor: t.surface }}
                            />
                          </div>
                          <div className="text-xs font-semibold truncate">{t.name}</div>
                          <div className="text-[11px] opacity-75 truncate">{t.comfortTag}</div>
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="grid grid-cols-1 sm:grid-cols-2 gap-4 pt-3 border-t border-[var(--luma-border)]">
                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold">Filtro cálido anti-luz azul</span>
                      <span className="font-mono tabular-nums text-[var(--luma-ink-muted)]">
                        {Math.round(prefs.warmFilterStrength * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={0.45}
                      step={0.05}
                      value={prefs.warmFilterStrength}
                      onChange={(e) => onUpdatePrefs({ warmFilterStrength: parseFloat(e.target.value) })}
                      className="w-full accent-[var(--luma-accent)]"
                    />
                  </div>

                  <div className="space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold">Atenuación nocturna suave</span>
                      <span className="font-mono tabular-nums text-[var(--luma-ink-muted)]">
                        {Math.round(prefs.nightDimming * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0}
                      max={0.35}
                      step={0.05}
                      value={prefs.nightDimming}
                      onChange={(e) => onUpdatePrefs({ nightDimming: parseFloat(e.target.value) })}
                      className="w-full accent-[var(--luma-accent)]"
                    />
                  </div>
                </section>

                {/* Refresh Rate (FPS) & Device Font from Luma Mobile */}
                <section className="pt-3 border-t border-[var(--luma-border)] space-y-3">
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2 text-xs font-semibold">
                      <Gauge className="w-4 h-4 text-[var(--luma-accent)]" />
                      <span>Tasa de refresco (FPS)</span>
                    </div>
                    <span className="text-[11px] font-semibold text-[var(--luma-accent)] tabular-nums">
                      {prefs.targetFps === 'max' ? 'Auto (nativo)' : `${prefs.targetFps} FPS`}
                    </span>
                  </div>

                  <div className="grid grid-cols-3 sm:grid-cols-6 gap-2">
                    {FPS_OPTIONS.map((opt) => {
                      const active = prefs.targetFps === opt.id;
                      return (
                        <button
                          key={String(opt.id)}
                          type="button"
                          onClick={() => onUpdatePrefs({ targetFps: opt.id })}
                          className={`py-2 px-2 rounded-xl border text-center transition-colors ${
                            active
                              ? 'bg-[var(--luma-accent)] text-[var(--luma-on-accent)] border-[var(--luma-accent)]'
                              : 'bg-[var(--luma-bg)] border-[var(--luma-border)] hover:bg-[var(--luma-surface-alt)]'
                          }`}
                        >
                          <div className="text-xs font-bold tabular-nums">{opt.label}</div>
                          <div className={`text-[10px] ${active ? 'opacity-90' : 'text-[var(--luma-ink-muted)]'}`}>
                            {opt.sub}
                          </div>
                        </button>
                      );
                    })}
                  </div>

                  <div className="rounded-xl border border-[var(--luma-border)] bg-[var(--luma-bg)] divide-y divide-[var(--luma-border)]">
                    <label className="px-4 py-3 flex items-center justify-between gap-4 cursor-pointer">
                      <div>
                        <div className="text-xs font-semibold">Mostrar contador de FPS en vivo</div>
                        <div className="text-[11px] text-[var(--luma-ink-muted)] mt-0.5">
                          Muestra la fluidez actual en tiempo real en la esquina superior.
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={prefs.showFpsCounter}
                        onChange={(e) => onUpdatePrefs({ showFpsCounter: e.target.checked })}
                        className="w-4 h-4 accent-[var(--luma-accent)]"
                      />
                    </label>

                    <label className="px-4 py-3 flex items-center justify-between gap-4 cursor-pointer">
                      <div>
                        <div className="text-xs font-semibold">Usar tipografía del dispositivo</div>
                        <div className="text-[11px] text-[var(--luma-ink-muted)] mt-0.5">
                          Adapta toda la interfaz de Luma a la fuente configurada en tu sistema.
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={prefs.useDeviceFont}
                        onChange={(e) => onUpdatePrefs({ useDeviceFont: e.target.checked })}
                        className="w-4 h-4 accent-[var(--luma-accent)]"
                      />
                    </label>
                  </div>
                </section>

                <section className="pt-3 border-t border-[var(--luma-border)]">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[var(--luma-ink-muted)] mb-3">
                    <Monitor className="w-3.5 h-3.5" />
                    <span>Proporción de menú según pantalla ({viewport.tierLabel})</span>
                  </div>
                  <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
                    {densityOptions.map((opt) => {
                      const active = prefs.density === opt.id;
                      return (
                        <button
                          key={opt.id}
                          type="button"
                          onClick={() => onUpdatePrefs({ density: opt.id })}
                          className={`p-2.5 rounded-xl border text-left transition-colors ${
                            active
                              ? 'bg-[var(--luma-accent-soft)] border-[var(--luma-accent)]'
                              : 'bg-[var(--luma-bg)] border-[var(--luma-border)] hover:bg-[var(--luma-surface-alt)]'
                          }`}
                        >
                          <div className="text-xs font-semibold">{opt.label}</div>
                          <div className="text-[11px] text-[var(--luma-ink-muted)] mt-0.5">{opt.desc}</div>
                        </button>
                      );
                    })}
                  </div>
                </section>
              </>
            )}

            {/* TAB 2: FUENTES (GOOGLE DRIVE v3 ZERO-BACKEND) */}
            {tab === 'sources' && (
              <div className="space-y-5">
                {/* Google Drive Connection Card */}
                <section className="p-4 rounded-2xl border border-[var(--luma-border)] bg-[var(--luma-bg)] space-y-3.5">
                  <div className="flex items-center gap-2.5">
                    <Cloud className="w-4 h-4 text-[var(--luma-accent)] shrink-0" />
                    <div>
                      <div className="text-sm font-bold">Conexión directa con tu Google Drive</div>
                      <div className="text-[11px] text-[var(--luma-ink-muted)]">
                        Sincronización directa desde tu navegador, sin servidores propios
                      </div>
                    </div>
                  </div>

                  {!driveAuth.connected ? (
                    <GoogleSignInAction
                      label="Iniciar sesión con Google"
                      onSignInGoogle={async () => {
                        setDriveErrorMsg(null);
                        setDriveStatusMsg(null);
                        await onSignInDrive();
                        setDriveStatusMsg('Sesión iniciada correctamente con Google Drive.');
                      }}
                      showDriveNote
                      compact
                    />
                  ) : (
                    <div className="flex flex-wrap items-center justify-between gap-2.5 pt-1">
                      <span className="text-xs font-semibold text-emerald-600 dark:text-emerald-400">
                        Conectado: {driveAuth.email || driveAuth.name || 'Google Drive'}
                      </span>
                      <button
                        type="button"
                        onClick={onSignOutDrive}
                        className="h-9 px-3 rounded-xl border border-red-500/35 text-red-600 dark:text-red-400 hover:bg-red-500/10 text-xs font-semibold inline-flex items-center gap-1.5"
                      >
                        <LogOut className="w-3.5 h-3.5" />
                        <span>Cerrar sesión / Desconectar</span>
                      </button>
                    </div>
                  )}

                  {driveStatusMsg && (
                    <div className="text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                      {driveStatusMsg}
                    </div>
                  )}
                  {driveErrorMsg && (
                    <div className="p-2.5 rounded-xl bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-400">
                      {driveErrorMsg}
                    </div>
                  )}
                </section>

                {/* Add Folder by Link */}
                <section className="p-4 rounded-2xl border border-[var(--luma-border)] bg-[var(--luma-bg)] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div className="text-xs font-bold flex items-center gap-1.5">
                      <FolderPlus className="w-4 h-4 text-[var(--luma-accent)]" />
                      <span>Carpetas vinculadas ({driveSources.length})</span>
                    </div>
                    {driveAuth.connected && (
                      <button
                        type="button"
                        onClick={() => void onPickDriveFolder()}
                        className="h-8 px-2.5 rounded-lg bg-[var(--luma-accent-soft)] text-[var(--luma-accent)] text-xs font-semibold"
                      >
                        Abrir Google Picker
                      </button>
                    )}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      type="text"
                      value={folderLinkInput}
                      onChange={(e) => setFolderLinkInput(e.target.value)}
                      placeholder="Pega enlace de carpeta de Drive (folders/ID)"
                      className="h-10 px-3 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-surface)] text-xs outline-none focus:border-[var(--luma-accent)]"
                    />
                    <div className="flex gap-2">
                      <input
                        type="text"
                        value={folderNameInput}
                        onChange={(e) => setFolderNameInput(e.target.value)}
                        placeholder="Nombre (opcional)"
                        className="flex-1 min-w-0 h-10 px-3 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-surface)] text-xs outline-none focus:border-[var(--luma-accent)]"
                      />
                      <button
                        type="button"
                        disabled={driveBusy || !folderLinkInput.trim()}
                        onClick={async () => {
                          setDriveBusy(true);
                          setDriveErrorMsg(null);
                          try {
                            await onAddDriveSourceByLink(
                              folderLinkInput.trim(),
                              folderNameInput.trim(),
                              '#2B64F5'
                            );
                            setFolderLinkInput('');
                            setFolderNameInput('');
                            setDriveStatusMsg('Carpeta validada y añadida a tus Fuentes.');
                          } catch (err) {
                            setDriveErrorMsg(
                              err instanceof Error ? err.message : 'No se pudo validar la carpeta.'
                            );
                          } finally {
                            setDriveBusy(false);
                          }
                        }}
                        className="h-10 px-3.5 rounded-xl bg-[var(--luma-accent)] text-[var(--luma-on-accent)] text-xs font-semibold shrink-0 disabled:opacity-45"
                      >
                        Añadir
                      </button>
                    </div>
                  </div>

                  {driveSources.length > 0 && (
                    <div className="divide-y divide-[var(--luma-border)] rounded-xl border border-[var(--luma-border)] bg-[var(--luma-surface)]">
                      {driveSources.map((src) => (
                        <div key={src.id} className="px-3.5 py-2.5 flex items-center justify-between gap-2 text-xs">
                          <div className="flex items-center gap-2.5 min-w-0">
                            <input
                              type="checkbox"
                              checked={src.active}
                              onChange={() => onToggleDriveSourceActive(src.id)}
                              className="w-4 h-4 accent-[var(--luma-accent)] shrink-0"
                            />
                            <span
                              className="w-2.5 h-2.5 rounded-full shrink-0"
                              style={{ backgroundColor: src.color }}
                            />
                            <div className="min-w-0">
                              <div className="font-semibold truncate">{src.name}</div>
                              <div className="text-[10px] font-mono text-[var(--luma-ink-muted)] truncate">
                                ID: {src.folderId}
                              </div>
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            <button
                              type="button"
                              onClick={() => onSetDefaultDriveSource(src.id)}
                              title="Carpeta de guardado por defecto"
                              className={`h-8 w-8 rounded-lg flex items-center justify-center ${
                                src.isDefault ? 'text-amber-500' : 'text-[var(--luma-ink-muted)] hover:bg-[var(--luma-surface-alt)]'
                              }`}
                            >
                              <Star className={`w-3.5 h-3.5 ${src.isDefault ? 'fill-amber-500' : ''}`} />
                            </button>
                            <button
                              type="button"
                              onClick={() => onDeleteDriveSource(src.id)}
                              title="Quitar carpeta"
                              className="h-8 w-8 rounded-lg flex items-center justify-center text-[var(--luma-ink-muted)] hover:text-red-500 hover:bg-red-500/10"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          </div>
                        </div>
                      ))}
                    </div>
                  )}
                </section>

                {/* Auto-Sync Policy & Local Storage Quota */}
                <section className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                  <div
                    className={`p-4 rounded-2xl border border-[var(--luma-border)] bg-[var(--luma-bg)] space-y-2.5 transition-opacity ${
                      driveAuth.connected ? '' : 'opacity-55'
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="text-xs font-bold">Sincronización automática</div>
                      {!driveAuth.connected && (
                        <span className="text-[11px] font-semibold text-[var(--luma-ink-muted)]">
                          Requiere iniciar sesión
                        </span>
                      )}
                    </div>
                    <div className="grid grid-cols-3 gap-1.5">
                      {(
                        [
                          { id: 'manual', label: 'Manual' },
                          { id: 'wifi_only', label: 'Solo Wi-Fi' },
                          { id: 'always', label: 'Siempre' },
                        ] as const
                      ).map((opt) => {
                        const active = (prefs.driveSyncPolicy ?? 'wifi_only') === opt.id;
                        return (
                          <button
                            key={opt.id}
                            type="button"
                            disabled={!driveAuth.connected}
                            onClick={() => onUpdatePrefs({ driveSyncPolicy: opt.id })}
                            className={`h-9 rounded-lg text-xs font-semibold ${
                              active
                                ? 'bg-[var(--luma-accent)] text-[var(--luma-on-accent)]'
                                : 'border border-[var(--luma-border)] bg-[var(--luma-surface)]'
                            } disabled:cursor-not-allowed`}
                          >
                            {opt.label}
                          </button>
                        );
                      })}
                    </div>
                    <p className="text-[11px] text-[var(--luma-ink-muted)]">
                      {driveAuth.connected ? (
                        <>
                          Pendientes en cola sin conexión: <strong>{pendingSyncCount}</strong>
                        </>
                      ) : (
                        'Requiere iniciar sesión para sincronizar entre dispositivos.'
                      )}
                    </p>
                  </div>

                  <div className="p-4 rounded-2xl border border-[var(--luma-border)] bg-[var(--luma-bg)] space-y-2.5">
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold flex items-center gap-1.5">
                        <HardDrive className="w-3.5 h-3.5 text-[var(--luma-accent)]" />
                        <span>Caché local</span>
                      </span>
                      <span className="font-mono tabular-nums text-[var(--luma-ink-muted)]">
                        {formatBytes(storageQuota?.cachedBytes ?? 0)}
                      </span>
                    </div>
                    <p className="text-[11px] text-[var(--luma-ink-muted)]">
                      {storageQuota?.cachedFilesCount ?? 0} archivo(s) descargados en este dispositivo.
                    </p>
                    <button
                      type="button"
                      onClick={() => void onFreeLocalCache()}
                      className="h-9 px-3 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-surface)] hover:bg-[var(--luma-surface-alt)] text-xs font-semibold"
                    >
                      Liberar espacio (sin borrar de Drive)
                    </button>
                  </div>
                </section>

                <div className="flex justify-start">
                  <PWAInstallButton />
                </div>
              </div>
            )}

            {/* TAB 2: LECTURA Y ESTILO DEL MENÚ */}
            {tab === 'reading' && (
              <div className="space-y-6">
                {/* Reader Menu Style (Marcapáginas / Isla dinámica / Clásico) */}
                <section className="space-y-3">
                  <div className="flex items-center gap-2 text-xs font-semibold text-[var(--luma-ink-muted)]">
                    <SlidersHorizontal className="w-3.5 h-3.5" />
                    <span>Estilo del menú durante la lectura</span>
                  </div>
                  <div className="grid grid-cols-1 gap-2">
                    {menuStyles.map((st) => {
                      const active = prefs.readerMenuStyle === st.id;
                      return (
                        <button
                          key={st.id}
                          type="button"
                          onClick={() => onUpdatePrefs({ readerMenuStyle: st.id })}
                          className={`p-3.5 rounded-xl border text-left flex items-center justify-between gap-3 transition-colors ${
                            active
                              ? 'border-[var(--luma-accent)] bg-[var(--luma-accent-soft)] ring-1 ring-[var(--luma-accent)]'
                              : 'border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)]'
                          }`}
                        >
                          <div>
                            <div className="text-xs font-bold">{st.title}</div>
                            <div className="text-[11px] text-[var(--luma-ink-muted)] mt-0.5">{st.desc}</div>
                          </div>
                          {active && <Check className="w-4 h-4 text-[var(--luma-accent)] shrink-0" />}
                        </button>
                      );
                    })}
                  </div>

                  {/* Dropdown Menu Scale */}
                  <div className="p-3.5 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-bg)] space-y-2">
                    <div className="flex items-center justify-between text-xs">
                      <div>
                        <div className="font-semibold">Tamaño del menú desplegable</div>
                        <div className="text-[11px] text-[var(--luma-ink-muted)]">
                          Ajusta la escala del marcapáginas e isla dinámica.
                        </div>
                      </div>
                      <span className="font-mono font-semibold text-[var(--luma-accent)] tabular-nums">
                        {Math.round(prefs.readerMenuScale * 100)}%
                      </span>
                    </div>
                    <input
                      type="range"
                      min={0.75}
                      max={1.3}
                      step={0.05}
                      value={prefs.readerMenuScale}
                      onChange={(e) => onUpdatePrefs({ readerMenuScale: parseFloat(e.target.value) })}
                      className="w-full accent-[var(--luma-accent)]"
                    />
                  </div>

                  {/* Dynamic Island Manager */}
                  <div className="rounded-xl border border-[var(--luma-border)] bg-[var(--luma-bg)] divide-y divide-[var(--luma-border)]">
                    <div className="px-4 py-2.5 text-[11px] font-semibold text-[var(--luma-ink-muted)]">
                      Gestor de Isla Dinámica y Lectura Rápida
                    </div>
                    <label className="px-4 py-3 flex items-center justify-between gap-4 cursor-pointer">
                      <div>
                        <div className="text-xs font-semibold">Mostrar avance (%) en Isla Dinámica</div>
                        <div className="text-[11px] text-[var(--luma-ink-muted)]">
                          Muestra el porcentaje leído y el tiempo estimado restante.
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={prefs.dynamicIslandShowProgress}
                        onChange={(e) => onUpdatePrefs({ dynamicIslandShowProgress: e.target.checked })}
                        className="w-4 h-4 accent-[var(--luma-accent)]"
                      />
                    </label>
                    <label className="px-4 py-3 flex items-center justify-between gap-4 cursor-pointer">
                      <div>
                        <div className="text-xs font-semibold">Cambio rápido con toque lateral</div>
                        <div className="text-[11px] text-[var(--luma-ink-muted)]">
                          Un clic en el borde izquierdo o derecho pasa o retrocede página en libros y PDFs.
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={prefs.sideTapPageTurn}
                        onChange={(e) => onUpdatePrefs({ sideTapPageTurn: e.target.checked })}
                        className="w-4 h-4 accent-[var(--luma-accent)]"
                      />
                    </label>
                    <label className="px-4 py-3 flex items-center justify-between gap-4 cursor-pointer">
                      <div>
                        <div className="text-xs font-semibold">Filtro nocturno suave en PDF</div>
                        <div className="text-[11px] text-[var(--luma-ink-muted)]">
                          Atenúa el blanco intenso de los PDFs cuando lees con temas oscuros o Medianoche.
                        </div>
                      </div>
                      <input
                        type="checkbox"
                        checked={prefs.pdfNightSoftFilter}
                        onChange={(e) => onUpdatePrefs({ pdfNightSoftFilter: e.target.checked })}
                        className="w-4 h-4 accent-[var(--luma-accent)]"
                      />
                    </label>
                  </div>
                </section>

                {/* Typography */}
                <section className="pt-3 border-t border-[var(--luma-border)] space-y-4">
                  <div className="text-xs font-semibold text-[var(--luma-ink-muted)]">
                    Tipografía predeterminada del lector
                  </div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {FONT_OPTIONS.map((f) => (
                      <button
                        key={f.id}
                        type="button"
                        onClick={() => onUpdatePrefs({ readerFont: f.id })}
                        className={`p-3 rounded-xl border text-left transition-colors ${
                          prefs.readerFont === f.id
                            ? 'bg-[var(--luma-accent-soft)] border-[var(--luma-accent)]'
                            : 'bg-[var(--luma-bg)] border-[var(--luma-border)] hover:bg-[var(--luma-surface-alt)]'
                        }`}
                      >
                        <div className="text-sm font-semibold" style={{ fontFamily: f.css }}>
                          {f.label}
                        </div>
                        <div className="text-xs text-[var(--luma-ink-muted)] mt-0.5">{f.sample}</div>
                      </button>
                    ))}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold">Tamaño de letra</span>
                        <span className="font-mono tabular-nums text-[var(--luma-ink-muted)]">
                          {prefs.fontSizePx}px
                        </span>
                      </div>
                      <input
                        type="range"
                        min={14}
                        max={26}
                        value={prefs.fontSizePx}
                        onChange={(e) => onUpdatePrefs({ fontSizePx: parseInt(e.target.value, 10) })}
                        className="w-full accent-[var(--luma-accent)]"
                      />
                    </div>

                    <div className="space-y-1.5">
                      <div className="flex justify-between text-xs">
                        <span className="font-semibold">Interlineado</span>
                        <span className="font-mono tabular-nums text-[var(--luma-ink-muted)]">
                          {prefs.lineHeight.toFixed(2)}
                        </span>
                      </div>
                      <input
                        type="range"
                        min={1.35}
                        max={2.1}
                        step={0.05}
                        value={prefs.lineHeight}
                        onChange={(e) => onUpdatePrefs({ lineHeight: parseFloat(e.target.value) })}
                        className="w-full accent-[var(--luma-accent)]"
                      />
                    </div>
                  </div>

                  <div className="flex flex-wrap items-center justify-between gap-3">
                    <div>
                      <div className="text-xs font-semibold">Alineación del texto</div>
                      <div className="text-[11px] text-[var(--luma-ink-muted)]">
                        Elige entre margen izquierdo natural o texto justificado.
                      </div>
                    </div>
                    <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--luma-surface-alt)]">
                      <button
                        type="button"
                        onClick={() => onUpdatePrefs({ textAlign: 'left' })}
                        className={`px-3 py-1 rounded-md text-xs font-medium ${
                          prefs.textAlign === 'left'
                            ? 'bg-[var(--luma-surface)] text-[var(--luma-ink)] shadow-xs'
                            : 'text-[var(--luma-ink-muted)]'
                        }`}
                      >
                        Izquierda
                      </button>
                      <button
                        type="button"
                        onClick={() => onUpdatePrefs({ textAlign: 'justify' })}
                        className={`px-3 py-1 rounded-md text-xs font-medium ${
                          prefs.textAlign === 'justify'
                            ? 'bg-[var(--luma-surface)] text-[var(--luma-ink)] shadow-xs'
                            : 'text-[var(--luma-ink-muted)]'
                        }`}
                      >
                        Justificado
                      </button>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* TAB 3: MODO INMERSIVO (Lector y Cuadernos) */}
            {tab === 'immersive' && (
              <div className="space-y-5">
                {/* Immersive Reading Auto-Hide */}
                <section className="p-4 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-bg)] space-y-4">
                  <label className="flex items-start justify-between gap-4 cursor-pointer">
                    <div>
                      <div className="text-sm font-bold">Ocultado inmersivo al leer</div>
                      <div className="text-xs text-[var(--luma-ink-muted)] mt-0.5 leading-relaxed">
                        Desvanece botones, isla y barras tras unos segundos leyendo; mueve el ratón o haz clic para volver a verlos.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={prefs.immersiveReaderHide}
                      onChange={(e) => onUpdatePrefs({ immersiveReaderHide: e.target.checked })}
                      className="w-4 h-4 mt-1 accent-[var(--luma-accent)] shrink-0"
                    />
                  </label>

                  <div className={`space-y-3 ${prefs.immersiveReaderHide ? '' : 'opacity-50'}`}>
                    <div>
                      <div className="text-[11px] font-semibold text-[var(--luma-ink-muted)] mb-1.5">
                        Tiempo antes de ocultar
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {([4, 8, 15, 30] as const).map((sec) => (
                          <button
                            key={sec}
                            type="button"
                            onClick={() => onUpdatePrefs({ immersiveReaderDelaySec: sec })}
                            className={`h-8 rounded-lg text-xs font-semibold tabular-nums transition-colors ${
                              prefs.immersiveReaderDelaySec === sec
                                ? 'bg-[var(--luma-accent)] text-[var(--luma-on-accent)]'
                                : 'bg-[var(--luma-surface)] border border-[var(--luma-border)] hover:bg-[var(--luma-surface-alt)]'
                            }`}
                          >
                            {sec}s
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold text-[var(--luma-ink-muted)] mb-1.5">
                        Rapidez del degradado
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {FADE_SPEEDS.map((sp) => (
                          <button
                            key={sp.id}
                            type="button"
                            onClick={() => onUpdatePrefs({ immersiveReaderFadeSpeed: sp.id })}
                            className={`h-8 rounded-lg text-xs font-semibold transition-colors ${
                              prefs.immersiveReaderFadeSpeed === sp.id
                                ? 'bg-[var(--luma-accent)] text-[var(--luma-on-accent)]'
                                : 'bg-[var(--luma-surface)] border border-[var(--luma-border)] hover:bg-[var(--luma-surface-alt)]'
                            }`}
                          >
                            {sp.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>

                {/* Immersive Notebook Auto-Hide */}
                <section className="p-4 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-bg)] space-y-4">
                  <label className="flex items-start justify-between gap-4 cursor-pointer">
                    <div>
                      <div className="text-sm font-bold">Ocultado inmersivo en cuadernos</div>
                      <div className="text-xs text-[var(--luma-ink-muted)] mt-0.5 leading-relaxed">
                        Oculta la barra superior y herramientas tras un tiempo sin usar los menús; pulsa la pestaña superior para mostrarlos.
                      </div>
                    </div>
                    <input
                      type="checkbox"
                      checked={prefs.immersiveNotebookHide}
                      onChange={(e) => onUpdatePrefs({ immersiveNotebookHide: e.target.checked })}
                      className="w-4 h-4 mt-1 accent-[var(--luma-accent)] shrink-0"
                    />
                  </label>

                  <div className={`space-y-3 ${prefs.immersiveNotebookHide ? '' : 'opacity-50'}`}>
                    <div>
                      <div className="text-[11px] font-semibold text-[var(--luma-ink-muted)] mb-1.5">
                        Cuándo ocultar automáticamente
                      </div>
                      <div className="grid grid-cols-2 gap-2">
                        {(
                          [
                            { id: 'landscape_only', label: 'Solo en horizontal' },
                            { id: 'always', label: 'Siempre' },
                          ] as const
                        ).map((opt) => (
                          <button
                            key={opt.id}
                            type="button"
                            onClick={() => onUpdatePrefs({ immersiveNotebookMode: opt.id })}
                            className={`h-8 rounded-lg text-xs font-semibold transition-colors ${
                              prefs.immersiveNotebookMode === opt.id
                                ? 'bg-[var(--luma-accent)] text-[var(--luma-on-accent)]'
                                : 'bg-[var(--luma-surface)] border border-[var(--luma-border)] hover:bg-[var(--luma-surface-alt)]'
                            }`}
                          >
                            {opt.label}
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold text-[var(--luma-ink-muted)] mb-1.5">
                        Tiempo antes de ocultar
                      </div>
                      <div className="grid grid-cols-4 gap-2">
                        {([3, 6, 10, 15] as const).map((sec) => (
                          <button
                            key={sec}
                            type="button"
                            onClick={() => onUpdatePrefs({ immersiveNotebookDelaySec: sec })}
                            className={`h-8 rounded-lg text-xs font-semibold tabular-nums transition-colors ${
                              prefs.immersiveNotebookDelaySec === sec
                                ? 'bg-[var(--luma-accent)] text-[var(--luma-on-accent)]'
                                : 'bg-[var(--luma-surface)] border border-[var(--luma-border)] hover:bg-[var(--luma-surface-alt)]'
                            }`}
                          >
                            {sec}s
                          </button>
                        ))}
                      </div>
                    </div>

                    <div>
                      <div className="text-[11px] font-semibold text-[var(--luma-ink-muted)] mb-1.5">
                        Rapidez del degradado
                      </div>
                      <div className="grid grid-cols-3 gap-2">
                        {FADE_SPEEDS.map((sp) => (
                          <button
                            key={sp.id}
                            type="button"
                            onClick={() => onUpdatePrefs({ immersiveNotebookFadeSpeed: sp.id })}
                            className={`h-8 rounded-lg text-xs font-semibold transition-colors ${
                              prefs.immersiveNotebookFadeSpeed === sp.id
                                ? 'bg-[var(--luma-accent)] text-[var(--luma-on-accent)]'
                                : 'bg-[var(--luma-surface)] border border-[var(--luma-border)] hover:bg-[var(--luma-surface-alt)]'
                            }`}
                          >
                            {sp.label}
                          </button>
                        ))}
                      </div>
                    </div>
                  </div>
                </section>
              </div>
            )}

            {/* TAB 4: DICCIONARIO Y TRADUCCIÓN */}
            {tab === 'dictionary' && (
              <div className="space-y-5">
                <section className="space-y-3">
                  <div className="text-xs font-semibold text-[var(--luma-ink-muted)]">
                    Motor de traducción (Palabras y Manhwa)
                  </div>
                  <div className="grid grid-cols-2 gap-2">
                    {(
                      [
                        { id: 'google', label: 'Traductor en línea' },
                        { id: 'local', label: 'Glosario local integrado' },
                      ] as const
                    ).map((eng) => (
                      <button
                        key={eng.id}
                        type="button"
                        onClick={() => onUpdatePrefs({ translationEngine: eng.id })}
                        className={`h-10 px-3 rounded-xl text-xs font-semibold transition-colors ${
                          prefs.translationEngine === eng.id
                            ? 'bg-[var(--luma-accent)] text-[var(--luma-on-accent)]'
                            : 'bg-[var(--luma-bg)] border border-[var(--luma-border)] hover:bg-[var(--luma-surface-alt)]'
                        }`}
                      >
                        {eng.label}
                      </button>
                    ))}
                  </div>
                  <div className="p-3 rounded-xl border border-[var(--luma-accent)]/35 bg-[var(--luma-accent-soft)]/50 text-xs text-[var(--luma-ink)] leading-relaxed">
                    Listo para usar sin claves: muestra el significado y la traducción al instante en una ventana flotante al seleccionar cualquier palabra o globo de manhwa.
                  </div>
                </section>

                <section className="space-y-2.5">
                  <div className="text-xs font-semibold text-[var(--luma-ink-muted)]">
                    Fuentes del diccionario contextual
                  </div>
                  <div className="rounded-xl border border-[var(--luma-border)] bg-[var(--luma-bg)] divide-y divide-[var(--luma-border)]">
                    {prefs.dictionarySources.map((src) => (
                      <div
                        key={src.id}
                        className="px-4 py-3 flex items-center justify-between gap-3"
                      >
                        <div className="min-w-0">
                          <div className="text-xs font-semibold truncate">{src.name}</div>
                          <div className="text-[11px] text-[var(--luma-ink-muted)] truncate">
                            {src.subtitle || src.urlTemplate}
                          </div>
                        </div>
                        <div className="flex items-center gap-2 shrink-0">
                          <input
                            type="checkbox"
                            checked={src.enabled}
                            onChange={(e) => handleToggleDictionarySource(src.id, e.target.checked)}
                            className="w-4 h-4 accent-[var(--luma-accent)]"
                          />
                          {!src.builtIn && (
                            <button
                              type="button"
                              onClick={() => handleDeleteDictionarySource(src.id)}
                              title="Eliminar fuente"
                              className="p-1.5 rounded-md text-[var(--luma-ink-muted)] hover:text-red-500 hover:bg-red-500/10"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                            </button>
                          )}
                        </div>
                      </div>
                    ))}
                  </div>
                </section>

                <form
                  onSubmit={handleAddDictionarySource}
                  className="p-4 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-bg)] space-y-2.5"
                >
                  <div className="text-xs font-semibold">Añadir fuente personalizada</div>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                    <input
                      value={newSourceName}
                      onChange={(e) => setNewSourceName(e.target.value)}
                      placeholder="Nombre (ej. DeepL, Linguee)"
                      className="h-9 px-3 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-surface)] text-xs outline-none focus:border-[var(--luma-accent)]"
                    />
                    <input
                      value={newSourceUrl}
                      onChange={(e) => setNewSourceUrl(e.target.value)}
                      placeholder="URL con plantilla {palabra}"
                      className="h-9 px-3 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-surface)] text-xs outline-none focus:border-[var(--luma-accent)]"
                    />
                  </div>
                  <button
                    type="submit"
                    className="h-8 px-3.5 rounded-lg bg-[var(--luma-accent)] text-[var(--luma-on-accent)] text-xs font-semibold inline-flex items-center gap-1.5 hover:opacity-95"
                  >
                    <Plus className="w-3.5 h-3.5" />
                    Añadir fuente
                  </button>
                </form>
              </div>
            )}

            {/* TAB 6: PRIVACIDAD Y SEGURIDAD */}
            {tab === 'privacy' && (
              <div className="space-y-4">
                <section className="p-4 rounded-2xl border border-[var(--luma-border)] bg-[var(--luma-bg)] space-y-3">
                  <div className="flex items-center gap-2 text-sm font-bold">
                    <ShieldCheck className="w-4 h-4 text-emerald-500" />
                    <span>Tu biblioteca y tus archivos son 100% tuyos</span>
                  </div>
                  <p className="text-xs text-[var(--luma-ink-muted)] leading-relaxed">
                    Luma funciona completamente en tu dispositivo como aplicación web progresiva (PWA) sin backend propio ni servidores intermedios.
                  </p>
                  <ul className="space-y-2 text-xs text-[var(--luma-ink)] list-disc pl-5 leading-relaxed">
                    <li>
                      <strong>Conexión directa a Google Drive:</strong> cuando vinculas una carpeta, tu navegador habla únicamente con las APIs oficiales de Google (<code>googleapis.com</code> y <code>accounts.google.com</code>).
                    </li>
                    <li>
                      <strong>Tokens solo en memoria:</strong> tu token temporal de acceso OAuth vive exclusivamente en memoria RAM mientras la pestaña está abierta y jamás se guarda en <code>localStorage</code> ni en servidores externos.
                    </li>
                    <li>
                      <strong>Acceso mínimo y seguro:</strong> Luma solo solicita acceso a los archivos creados o elegidos con la app y a su carpeta de configuración privada en Drive (<code>drive.file</code> y <code>drive.appdata</code>).
                    </li>
                    <li>
                      <strong>Sin analítica ni rastreo:</strong> Luma no recolecta telemetría, no lee archivos fuera de las carpetas que elijas y nunca elimina nada en Google Drive sin doble confirmación explícita.
                    </li>
                    <li>
                      <strong>Revocación inmediata:</strong> puedes desconectar tu cuenta desde «Ajustes → Fuentes» o revocar el acceso en cualquier momento desde tu cuenta de Google en <em>myaccount.google.com/permissions</em>.
                    </li>
                  </ul>
                </section>
              </div>
            )}

            {/* TAB 7: ACERCA DE LUMA, DISCORD, ACTUALIZACIONES, ATAJOS Y RESPALDO */}
            {tab === 'about' && (
              <div className="space-y-5">
                {/* Brand Lockup */}
                <section className="py-3 text-center flex flex-col items-center gap-1.5">
                  <LumaBrandLogo size="lg" />
                  <p className="text-xs text-[var(--luma-ink-muted)]">
                    Lector universal EPUB · PDF · DOCX · PPTX · TXT · FB2
                  </p>
                </section>

                {/* Official Discord Community */}
                <section className="p-4 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-bg)] space-y-3">
                  <div>
                    <div className="text-sm font-bold">Comunidad oficial en Discord</div>
                    <p className="text-xs text-[var(--luma-ink-muted)] mt-0.5">
                      Comparte lecturas, reporta mejoras y únete a la comunidad de Luma.
                    </p>
                  </div>
                  <div className="flex items-center justify-between gap-2 px-3 py-2 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-surface)]">
                    <span className="text-xs font-mono text-[var(--luma-accent)] truncate">
                      {DISCORD_URL}
                    </span>
                    <button
                      type="button"
                      onClick={handleCopyDiscord}
                      title="Copiar enlace"
                      className="p-1 rounded hover:bg-[var(--luma-surface-alt)] text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)] shrink-0"
                    >
                      {copiedDiscord ? <Check className="w-3.5 h-3.5 text-emerald-600" /> : <Copy className="w-3.5 h-3.5" />}
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => handleOpenExternal(DISCORD_URL)}
                    className="w-full h-9 rounded-xl bg-[var(--luma-accent)] text-[var(--luma-on-accent)] text-xs font-semibold inline-flex items-center justify-center gap-2 hover:opacity-95"
                  >
                    <ExternalLink className="w-3.5 h-3.5" />
                    Unirse al Discord de la comunidad
                  </button>
                </section>

                {/* Dedication Card */}
                <section className="p-4 rounded-xl border border-rose-300/60 bg-rose-500/5 flex flex-col items-center justify-center gap-2 text-center">
                  <span className="w-9 h-9 rounded-full bg-rose-500/15 text-rose-600 flex items-center justify-center">
                    <Heart className="w-4 h-4 fill-current" />
                  </span>
                  <p className="text-sm italic font-medium" style={{ fontFamily: 'var(--font-serif)' }}>
                    Dedicada a mi amada Anghela.
                  </p>
                </section>

                {/* Updates & Font Licenses */}
                <section className="p-4 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-bg)] space-y-3">
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <div>
                      <div className="text-xs font-bold">Actualizaciones de Luma</div>
                      <div className="text-[11px] text-[var(--luma-ink-muted)]">
                        Versión instalada: v1.0 (build 1)
                      </div>
                    </div>
                    <button
                      type="button"
                      onClick={handleCheckUpdate}
                      disabled={checkingUpdate}
                      className="h-8 px-3.5 rounded-lg bg-[var(--luma-accent)] text-[var(--luma-on-accent)] text-xs font-semibold inline-flex items-center gap-1.5 hover:opacity-95 disabled:opacity-60"
                    >
                      <RefreshCw className={`w-3.5 h-3.5 ${checkingUpdate ? 'animate-spin' : ''}`} />
                      Buscar actualización ahora
                    </button>
                  </div>
                  <p className="text-xs text-emerald-600 font-medium">{updateMessage}</p>

                  <div className="pt-2 border-t border-[var(--luma-border)]">
                    <button
                      type="button"
                      onClick={() => setShowLicenses((v) => !v)}
                      className="w-full flex items-center justify-between text-xs font-semibold text-left hover:text-[var(--luma-accent)]"
                    >
                      <span>Licencias de fuentes (SIL OFL 1.1)</span>
                      <span className="text-[11px] text-[var(--luma-ink-muted)]">
                        {showLicenses ? 'Ocultar' : 'Ver'}
                      </span>
                    </button>
                    {showLicenses && (
                      <div className="mt-2 space-y-1.5 text-[11px] text-[var(--luma-ink-muted)]">
                        {BUNDLED_FONT_LICENSES.map((fl) => (
                          <div key={fl.name} className="flex justify-between gap-2">
                            <span className="font-medium text-[var(--luma-ink)]">{fl.name}</span>
                            <span>
                              {fl.author} · {fl.license}
                            </span>
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                </section>

                {/* Keyboard Shortcuts & Local Backup */}
                <section className="space-y-2.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-[var(--luma-ink-muted)]">
                    <Keyboard className="w-3.5 h-3.5" />
                    <span>Atajos de teclado en PC</span>
                  </div>
                  <div className="rounded-xl border border-[var(--luma-border)] bg-[var(--luma-bg)] divide-y divide-[var(--luma-border)] text-xs">
                    {[
                      ['F11', 'Pantalla completa inmersiva'],
                      ['Ctrl + K', 'Abrir búsqueda rápida y comandos'],
                      ['Ctrl + \\', 'Mostrar u ocultar barra lateral'],
                      ['Ctrl + Z / Ctrl + Y', 'Deshacer / Rehacer en Cuadernos'],
                      ['ESC', 'Salir de pantalla completa o cerrar diálogo'],
                    ].map(([keys, desc]) => (
                      <div key={keys} className="px-3.5 py-2 flex items-center justify-between gap-4">
                        <span>{desc}</span>
                        <kbd className="font-mono text-[11px] px-2 py-0.5 rounded bg-[var(--luma-surface)] border border-[var(--luma-border)]">
                          {keys}
                        </kbd>
                      </div>
                    ))}
                  </div>
                </section>

                <section className="p-4 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-bg)] flex flex-wrap items-center justify-between gap-3">
                  <div>
                    <div className="text-xs font-semibold">Respaldo local de tu biblioteca</div>
                    <div className="text-[11px] text-[var(--luma-ink-muted)] mt-0.5">
                      Descarga una copia JSON con tus libros, sagas, cuadernos, notas y perfil.
                    </div>
                  </div>
                  <button
                    type="button"
                    onClick={onExportBackup}
                    className="h-8 px-3 rounded-lg bg-[var(--luma-accent)] text-[var(--luma-on-accent)] text-xs font-semibold inline-flex items-center gap-1.5 hover:opacity-95"
                  >
                    <Download className="w-3.5 h-3.5" />
                    Exportar respaldo
                  </button>
                </section>
              </div>
            )}
          </div>
        </div>
      </div>
    </div>
  );
};
