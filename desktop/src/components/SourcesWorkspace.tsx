import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  CheckCircle2,
  ChevronRight,
  Cloud,
  FileImage,
  FileText,
  Folder,
  FolderPlus,
  LayoutGrid,
  List,
  MoreVertical,
  PenTool,
  Plus,
  RefreshCw,
  Search,
  Settings,
  Star,
  Trash2,
} from 'lucide-react';
import { DriveAuthState, DriveFileCategory, DriveFileItem, DriveSource } from '../drive/driveTypes';
import { formatBytes } from '../drive/driveCache';
import { getOrRenderDriveThumbnail } from '../drive/pdfThumbnailer';
import { ViewportProfile } from '../hooks/useViewportProfile';
import { GoogleSignInAction } from '../core';

interface SourcesWorkspaceProps {
  viewport: ViewportProfile;
  auth: DriveAuthState;
  sources: DriveSource[];
  filesBySource: Record<string, DriveFileItem[]>;
  loadingSourceId: string | null;
  onRefreshAll: () => void;
  onRefreshSource: (sourceId: string) => void;
  onOpenFolder: (sourceId: string, folderId: string, folderName: string) => void;
  breadcrumbs: Array<{ folderId: string; name: string }>;
  onBreadcrumbClick: (index: number) => void;
  activeBrowseSourceId: string | null;
  onSelectBrowseSource: (sourceId: string | null) => void;
  onTapDriveFile: (file: DriveFileItem, thumb?: string | null) => void;
  onOpenFileMenu: (file: DriveFileItem) => void;
  onAddSourceByLink: (linkOrId: string, customName: string, color: string) => Promise<void>;
  onPickFolderWithGooglePicker?: () => Promise<void>;
  onToggleSourceActive: (sourceId: string) => void;
  onSetDefaultSource: (sourceId: string) => void;
  onDeleteSource: (sourceId: string) => void;
  onOpenDriveSettings: () => void;
  onSignInGoogle: () => Promise<void>;
}

const SOURCE_COLORS = ['#2B64F5', '#C2642B', '#257A5E', '#7C3AED', '#E11D48', '#D97706'];

const TYPE_FILTERS: Array<{ id: 'all' | DriveFileCategory; label: string }> = [
  { id: 'all', label: 'Todos' },
  { id: 'pdf', label: 'PDF' },
  { id: 'docx', label: 'DOCX' },
  { id: 'image', label: 'Imágenes' },
  { id: 'notebook', label: 'Cuadernos Luma' },
  { id: 'book', label: 'Libros' },
];

/** Lazy thumbnail component with IntersectionObserver so large folders stay 60fps */
export const LazyDriveThumb: React.FC<{
  file: DriveFileItem;
  className?: string;
  onResolved?: (url: string | null) => void;
}> = ({ file, className = '', onResolved }) => {
  const [thumbUrl, setThumbUrl] = useState<string | null>(null);
  const hostRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const el = hostRef.current;
    if (!el || file.isFolder) return;
    let cancelled = false;
    const observer = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          observer.disconnect();
          getOrRenderDriveThumbnail(file.id, file.mimeType, file.thumbnailLink)
            .then((url) => {
              if (!cancelled) {
                setThumbUrl(url);
                onResolved?.(url);
              }
            })
            .catch(() => undefined);
        }
      },
      { rootMargin: '140px' }
    );
    observer.observe(el);
    return () => {
      cancelled = true;
      observer.disconnect();
    };
  }, [file.id, file.mimeType, file.thumbnailLink, file.isFolder, file.downloaded, onResolved]);

  const fallbackIcon = () => {
    if (file.isFolder) return <Folder className="w-8 h-8 text-amber-500" />;
    if (file.category === 'notebook') return <PenTool className="w-8 h-8 text-[var(--luma-accent)]" />;
    if (file.category === 'image') return <FileImage className="w-8 h-8 text-emerald-500" />;
    return <FileText className="w-8 h-8 text-[var(--luma-accent)]" />;
  };

  return (
    <div
      ref={hostRef}
      className={`relative flex items-center justify-center bg-[var(--luma-bg)] overflow-hidden ${className}`}
    >
      {thumbUrl ? (
        <img
          src={thumbUrl}
          alt={file.name}
          loading="lazy"
          className="w-full h-full object-cover"
        />
      ) : (
        fallbackIcon()
      )}
    </div>
  );
};

export const SourcesWorkspace: React.FC<SourcesWorkspaceProps> = ({
  viewport,
  auth,
  sources,
  filesBySource,
  loadingSourceId,
  onRefreshAll,
  onRefreshSource,
  onOpenFolder,
  breadcrumbs,
  onBreadcrumbClick,
  activeBrowseSourceId,
  onSelectBrowseSource,
  onTapDriveFile,
  onOpenFileMenu,
  onAddSourceByLink,
  onPickFolderWithGooglePicker,
  onToggleSourceActive,
  onSetDefaultSource,
  onDeleteSource,
  onOpenDriveSettings,
  onSignInGoogle,
}) => {
  const [searchQuery, setSearchQuery] = useState('');
  const [typeFilter, setTypeFilter] = useState<'all' | DriveFileCategory>('all');
  const [sortBy, setSortBy] = useState<'date' | 'name' | 'size'>('date');
  const [viewMode, setViewMode] = useState<'grid' | 'list'>('grid');
  const [visibleLimit, setVisibleLimit] = useState(36);

  const [showAddForm, setShowAddForm] = useState(false);
  const [folderLink, setFolderLink] = useState('');
  const [sourceName, setSourceName] = useState('');
  const [sourceColor, setSourceColor] = useState(SOURCE_COLORS[0]);
  const [addingError, setAddingError] = useState<string | null>(null);
  const [addingBusy, setAddingBusy] = useState(false);

  // Pull-to-refresh touch tracking for mobile
  const scrollRef = useRef<HTMLDivElement>(null);
  const pullStartYRef = useRef<number | null>(null);
  const [pullOffset, setPullOffset] = useState(0);

  // Long-press timer for mobile context menu
  const longPressRef = useRef<number | null>(null);
  const thumbMapRef = useRef<Record<string, string | null>>({});

  const activeSources = useMemo(() => sources.filter((s) => s.active), [sources]);

  const combinedFiles = useMemo(() => {
    let list: DriveFileItem[] = [];
    if (activeBrowseSourceId) {
      list = filesBySource[activeBrowseSourceId] ?? [];
    } else {
      for (const s of activeSources) {
        list = list.concat(filesBySource[s.id] ?? []);
      }
    }

    const q = searchQuery.trim().toLowerCase();
    const filtered = list.filter((f) => {
      if (typeFilter !== 'all' && !f.isFolder && f.category !== typeFilter) return false;
      if (q && !f.name.toLowerCase().includes(q) && !(f.folderPath ?? '').toLowerCase().includes(q)) {
        return false;
      }
      return true;
    });

    return [...filtered].sort((a, b) => {
      if (a.isFolder !== b.isFolder) return a.isFolder ? -1 : 1;
      if (sortBy === 'name') return a.name.localeCompare(b.name, 'es');
      if (sortBy === 'size') return b.size - a.size;
      return new Date(b.modifiedTime).getTime() - new Date(a.modifiedTime).getTime();
    });
  }, [activeBrowseSourceId, activeSources, filesBySource, searchQuery, typeFilter, sortBy]);

  const handleAddSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!folderLink.trim()) return;
    setAddingBusy(true);
    setAddingError(null);
    try {
      await onAddSourceByLink(folderLink.trim(), sourceName.trim(), sourceColor);
      setFolderLink('');
      setSourceName('');
      setShowAddForm(false);
    } catch (err) {
      setAddingError(err instanceof Error ? err.message : 'No se pudo agregar la carpeta.');
    } finally {
      setAddingBusy(false);
    }
  };

  const containerPadding =
    viewport.tier === 'compact'
      ? 'px-4 py-4 pb-24'
      : viewport.tier === 'tablet'
        ? 'px-6 py-6'
        : 'px-8 py-7';

  return (
    <div
      ref={scrollRef}
      onTouchStart={(e) => {
        if ((scrollRef.current?.scrollTop ?? 0) <= 0) {
          pullStartYRef.current = e.touches[0].clientY;
        }
      }}
      onTouchMove={(e) => {
        if (pullStartYRef.current === null) return;
        const delta = e.touches[0].clientY - pullStartYRef.current;
        if (delta > 0 && delta < 110) {
          setPullOffset(delta);
        }
      }}
      onTouchEnd={() => {
        if (pullOffset > 65) {
          onRefreshAll();
        }
        pullStartYRef.current = null;
        setPullOffset(0);
      }}
      className={`h-full overflow-y-auto bg-[var(--luma-bg)] text-[var(--luma-ink)] ${containerPadding}`}
    >
      <div className="max-w-[1240px] mx-auto space-y-5">
        {pullOffset > 12 && (
          <div className="text-center text-xs font-semibold text-[var(--luma-accent)] py-1">
            {pullOffset > 65 ? 'Suelta para actualizar Drive...' : 'Desliza hacia abajo para actualizar'}
          </div>
        )}

        {/* Header */}
        <div className="flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight">Fuentes de Google Drive</h1>
            <p className="text-sm text-[var(--luma-ink-muted)] mt-1">
              {auth.connected
                ? `Conectado como ${auth.email || auth.name || 'tu cuenta Google'} · ${sources.length} ${sources.length === 1 ? 'carpeta' : 'carpetas'}`
                : 'Conecta tu propio Google Drive sin backend ni servidores externos.'}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={onRefreshAll}
              disabled={!auth.connected || Boolean(loadingSourceId)}
              className="h-11 sm:h-9 px-3.5 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-surface)] hover:bg-[var(--luma-surface-alt)] text-xs font-semibold inline-flex items-center gap-1.5 disabled:opacity-45"
            >
              <RefreshCw className={`w-3.5 h-3.5 ${loadingSourceId ? 'animate-spin' : ''}`} />
              <span>Actualizar</span>
            </button>
            <button
              type="button"
              onClick={() => setShowAddForm((v) => !v)}
              className="h-11 sm:h-9 px-3.5 rounded-xl bg-[var(--luma-accent)] text-[var(--luma-on-accent)] text-xs font-semibold inline-flex items-center gap-1.5 hover:opacity-95"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Agregar carpeta</span>
            </button>
            <button
              type="button"
              onClick={onOpenDriveSettings}
              className="h-11 sm:h-9 px-3 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-surface)] hover:bg-[var(--luma-surface-alt)] text-xs font-semibold inline-flex items-center gap-1.5"
            >
              <Settings className="w-3.5 h-3.5" />
              <span>Ajustes Drive</span>
            </button>
          </div>
        </div>

        {/* Not Connected Callout */}
        {!auth.connected && (
          <div className="p-5 rounded-2xl border border-[var(--luma-accent)]/40 bg-[var(--luma-surface)] space-y-4">
            <div className="space-y-1">
              <div className="text-sm font-bold flex items-center gap-2">
                <Cloud className="w-4 h-4 text-[var(--luma-accent)]" />
                <span>Conecta tu cuenta de Google Drive</span>
              </div>
              <p className="text-xs text-[var(--luma-ink-muted)] max-w-xl leading-relaxed">
                Inicia sesión con tu cuenta de Google para leer carpetas vinculadas, descargar libros con pausa/reanudación y sincronizar tus cuadernos Luma entre dispositivos.
              </p>
            </div>
            <GoogleSignInAction
              label="Iniciar sesión con Google"
              onSignInGoogle={onSignInGoogle}
              showDriveNote
              compact
              fullWidth={false}
            />
          </div>
        )}

        {/* Add Folder Form */}
        {showAddForm && (
          <form
            onSubmit={handleAddSubmit}
            className="p-4 rounded-2xl border border-[var(--luma-border)] bg-[var(--luma-surface)] space-y-3"
          >
            <div className="flex items-center justify-between gap-2">
              <div className="text-xs font-bold flex items-center gap-1.5">
                <FolderPlus className="w-4 h-4 text-[var(--luma-accent)]" />
                <span>Agregar carpeta de Google Drive por enlace</span>
              </div>
              {onPickFolderWithGooglePicker && auth.connected && (
                <button
                  type="button"
                  onClick={() => {
                    void onPickFolderWithGooglePicker();
                  }}
                  className="h-8 px-3 rounded-lg bg-[var(--luma-accent-soft)] text-[var(--luma-accent)] text-xs font-semibold"
                >
                  Elegir con Google Picker
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--luma-ink-muted)] mb-1">
                  Enlace o ID de la carpeta de Google Drive
                </label>
                <input
                  type="text"
                  value={folderLink}
                  onChange={(e) => setFolderLink(e.target.value)}
                  placeholder="https://drive.google.com/drive/folders/... o ?usp=sharing"
                  required
                  className="w-full h-11 sm:h-9 px-3 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-bg)] text-xs outline-none focus:border-[var(--luma-accent)]"
                />
              </div>
              <div>
                <label className="block text-[11px] font-semibold text-[var(--luma-ink-muted)] mb-1">
                  Nombre personalizado (opcional)
                </label>
                <input
                  type="text"
                  value={sourceName}
                  onChange={(e) => setSourceName(e.target.value)}
                  placeholder="Ej. Libros Universidad, Manga, Cuadernos"
                  className="w-full h-11 sm:h-9 px-3 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-bg)] text-xs outline-none focus:border-[var(--luma-accent)]"
                />
              </div>
            </div>

            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1.5">
                <span className="text-[11px] text-[var(--luma-ink-muted)] mr-1">Color:</span>
                {SOURCE_COLORS.map((c) => (
                  <button
                    key={c}
                    type="button"
                    onClick={() => setSourceColor(c)}
                    className={`w-6 h-6 rounded-full ${
                      sourceColor === c ? 'ring-2 ring-offset-2 ring-[var(--luma-ink)]' : ''
                    }`}
                    style={{ backgroundColor: c }}
                  />
                ))}
              </div>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setShowAddForm(false)}
                  className="h-10 sm:h-8 px-3 rounded-lg border border-[var(--luma-border)] text-xs font-medium"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  disabled={addingBusy}
                  className="h-10 sm:h-8 px-4 rounded-lg bg-[var(--luma-accent)] text-[var(--luma-on-accent)] text-xs font-semibold disabled:opacity-50"
                >
                  {addingBusy ? 'Validando carpeta...' : 'Validar y agregar'}
                </button>
              </div>
            </div>

            {addingError && (
              <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-xs text-red-600 dark:text-red-400">
                {addingError}
              </div>
            )}
          </form>
        )}

        {/* Sources Cards Strip */}
        {sources.length > 0 && (
          <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
            {sources.map((src) => {
              const selected = activeBrowseSourceId === src.id;
              const isLoading = loadingSourceId === src.id;
              return (
                <div
                  key={src.id}
                  onClick={() => onSelectBrowseSource(selected ? null : src.id)}
                  className={`p-3.5 rounded-2xl border transition-colors cursor-pointer space-y-2.5 ${
                    selected
                      ? 'border-[var(--luma-accent)] bg-[var(--luma-accent-soft)]/50'
                      : 'border-[var(--luma-border)] bg-[var(--luma-surface)] hover:border-[var(--luma-accent)]/50'
                  } ${src.active ? '' : 'opacity-60'}`}
                >
                  <div className="flex items-center justify-between gap-2">
                    <div className="flex items-center gap-2.5 min-w-0">
                      <span
                        className="w-3.5 h-3.5 rounded-full shrink-0"
                        style={{ backgroundColor: src.color }}
                      />
                      <div className="min-w-0">
                        <div className="text-xs font-bold truncate flex items-center gap-1.5">
                          <span className="truncate">{src.name}</span>
                          {src.isDefault && (
                            <Star className="w-3 h-3 text-amber-500 fill-amber-500 shrink-0" />
                          )}
                        </div>
                        <div className="text-[11px] text-[var(--luma-ink-muted)] truncate">
                          {src.fileCount ?? (filesBySource[src.id]?.length ?? 0)} elementos
                          {src.isDefault ? ' · Guardado por defecto' : ''}
                        </div>
                      </div>
                    </div>

                    <div
                      className="flex items-center gap-1 shrink-0"
                      onClick={(e) => e.stopPropagation()}
                    >
                      <button
                        type="button"
                        onClick={() => onRefreshSource(src.id)}
                        title="Actualizar carpeta"
                        className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-[var(--luma-surface-alt)]"
                      >
                        <RefreshCw className={`w-3.5 h-3.5 ${isLoading ? 'animate-spin' : ''}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onSetDefaultSource(src.id)}
                        title="Marcar como carpeta de guardado por defecto"
                        className={`h-8 w-8 rounded-lg flex items-center justify-center hover:bg-[var(--luma-surface-alt)] ${
                          src.isDefault ? 'text-amber-500' : 'text-[var(--luma-ink-muted)]'
                        }`}
                      >
                        <Star className={`w-3.5 h-3.5 ${src.isDefault ? 'fill-amber-500' : ''}`} />
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteSource(src.id)}
                        title="Quitar fuente de Luma (no borra archivos en Drive)"
                        className="h-8 w-8 rounded-lg flex items-center justify-center text-[var(--luma-ink-muted)] hover:text-red-500 hover:bg-red-500/10"
                      >
                        <Trash2 className="w-3.5 h-3.5" />
                      </button>
                    </div>
                  </div>

                  <div
                    className="flex items-center justify-between pt-1.5 border-t border-[var(--luma-border)]/70 text-[11px]"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <label className="flex items-center gap-1.5 cursor-pointer">
                      <input
                        type="checkbox"
                        checked={src.active}
                        onChange={() => onToggleSourceActive(src.id)}
                        className="w-3.5 h-3.5 accent-[var(--luma-accent)]"
                      />
                      <span>Activa en Inicio</span>
                    </label>
                    {src.errorMessage ? (
                      <span className="text-red-500 truncate max-w-[160px]">{src.errorMessage}</span>
                    ) : (
                      <span className="text-[var(--luma-ink-muted)]">
                        {src.lastSyncedAt
                          ? new Date(src.lastSyncedAt).toLocaleTimeString('es-ES', {
                              hour: '2-digit',
                              minute: '2-digit',
                            })
                          : 'Sin sincronizar'}
                      </span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {/* Breadcrumbs + Search + Filter + Sort + Grid/List */}
        <div className="space-y-3 pt-2 border-t border-[var(--luma-border)]">
          {breadcrumbs.length > 0 && (
            <nav aria-label="Ruta de carpetas" className="flex items-center flex-wrap gap-1 text-xs">
              <button
                type="button"
                onClick={() => onSelectBrowseSource(null)}
                className="px-2 py-1 rounded-md hover:bg-[var(--luma-surface-alt)] text-[var(--luma-ink-muted)] font-medium"
              >
                Todas las fuentes
              </button>
              {breadcrumbs.map((bc, idx) => (
                <React.Fragment key={bc.folderId}>
                  <ChevronRight className="w-3.5 h-3.5 text-[var(--luma-ink-muted)]" />
                  <button
                    type="button"
                    onClick={() => onBreadcrumbClick(idx)}
                    className={`px-2 py-1 rounded-md font-semibold ${
                      idx === breadcrumbs.length - 1
                        ? 'bg-[var(--luma-accent-soft)] text-[var(--luma-accent)]'
                        : 'hover:bg-[var(--luma-surface-alt)]'
                    }`}
                  >
                    {bc.name}
                  </button>
                </React.Fragment>
              ))}
            </nav>
          )}

          <div className="flex flex-col sm:flex-row gap-2.5 items-stretch sm:items-center">
            <div className="relative flex-1">
              <Search className="w-4 h-4 absolute left-3 top-1/2 -translate-y-1/2 text-[var(--luma-ink-muted)]" />
              <input
                type="search"
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                placeholder="Buscar archivo o subcarpeta por nombre..."
                className="w-full h-11 sm:h-9 pl-9 pr-3 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-surface)] text-xs outline-none focus:border-[var(--luma-accent)]"
              />
            </div>

            <div className="flex items-center gap-2 shrink-0">
              <select
                value={sortBy}
                onChange={(e) => setSortBy(e.target.value as 'date' | 'name' | 'size')}
                aria-label="Ordenar archivos"
                className="h-11 sm:h-9 px-2.5 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-surface)] text-xs"
              >
                <option value="date">Fecha</option>
                <option value="name">Nombre</option>
                <option value="size">Tamaño</option>
              </select>

              <div className="flex items-center p-0.5 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-surface)]">
                <button
                  type="button"
                  onClick={() => setViewMode('grid')}
                  title="Vista cuadrícula"
                  className={`h-9 sm:h-8 w-9 sm:w-8 rounded-lg flex items-center justify-center ${
                    viewMode === 'grid'
                      ? 'bg-[var(--luma-surface-alt)] text-[var(--luma-accent)]'
                      : 'text-[var(--luma-ink-muted)]'
                  }`}
                >
                  <LayoutGrid className="w-4 h-4" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('list')}
                  title="Vista lista"
                  className={`h-9 sm:h-8 w-9 sm:w-8 rounded-lg flex items-center justify-center ${
                    viewMode === 'list'
                      ? 'bg-[var(--luma-surface-alt)] text-[var(--luma-accent)]'
                      : 'text-[var(--luma-ink-muted)]'
                  }`}
                >
                  <List className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-1 p-1 rounded-xl bg-[var(--luma-surface-alt)] overflow-x-auto no-scrollbar">
            {TYPE_FILTERS.map((tf) => {
              const active = typeFilter === tf.id;
              return (
                <button
                  key={tf.id}
                  type="button"
                  onClick={() => setTypeFilter(tf.id)}
                  className={`h-9 sm:h-8 px-3 rounded-lg text-xs font-semibold whitespace-nowrap transition-colors ${
                    active
                      ? 'bg-[var(--luma-surface)] text-[var(--luma-ink)] shadow-xs'
                      : 'text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)]'
                  }`}
                >
                  {tf.label}
                </button>
              );
            })}
          </div>
        </div>

        {/* File Listing (Grid or List) */}
        {combinedFiles.length === 0 ? (
          <div className="py-12 px-6 text-center rounded-2xl border border-dashed border-[var(--luma-border)] bg-[var(--luma-surface)] space-y-2">
            <Cloud className="w-8 h-8 mx-auto text-[var(--luma-ink-muted)] opacity-60" />
            <p className="text-sm font-semibold">
              {sources.length === 0
                ? 'Todavía no has agregado carpetas de Google Drive'
                : 'No hay archivos que coincidan con este filtro'}
            </p>
            <p className="text-xs text-[var(--luma-ink-muted)] max-w-md mx-auto">
              Pega el enlace de cualquier carpeta de Drive con PDFs, DOCX, imágenes o cuadernos Luma y aparecerán aquí con vista previa.
            </p>
          </div>
        ) : viewMode === 'grid' ? (
          <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 gap-3.5">
            {combinedFiles.slice(0, visibleLimit).map((file) => (
              <article
                key={`${file.sourceId}_${file.id}`}
                onClick={() => {
                  if (file.isFolder) {
                    onOpenFolder(file.sourceId, file.id, file.name);
                  } else {
                    onTapDriveFile(file, thumbMapRef.current[file.id]);
                  }
                }}
                onContextMenu={(e) => {
                  if (file.isFolder) return;
                  e.preventDefault();
                  onOpenFileMenu(file);
                }}
                onTouchStart={() => {
                  if (file.isFolder) return;
                  longPressRef.current = window.setTimeout(() => {
                    onOpenFileMenu(file);
                  }, 520);
                }}
                onTouchEnd={() => {
                  if (longPressRef.current) {
                    window.clearTimeout(longPressRef.current);
                    longPressRef.current = null;
                  }
                }}
                className="group rounded-2xl border border-[var(--luma-border)] bg-[var(--luma-surface)] hover:border-[var(--luma-accent)]/70 transition-all cursor-pointer overflow-hidden flex flex-col"
              >
                <div className="relative aspect-[4/5]">
                  <LazyDriveThumb
                    file={file}
                    className="w-full h-full"
                    onResolved={(u) => {
                      thumbMapRef.current[file.id] = u;
                    }}
                  />

                  {/* Cloud vs Downloaded Check Badge */}
                  {!file.isFolder && (
                    <div
                      title={file.downloaded ? 'Descargado localmente' : 'Solo en la nube (toca para descargar)'}
                      className={`absolute top-2 left-2 h-6 px-2 rounded-lg text-[10px] font-bold flex items-center gap-1 shadow ${
                        file.downloaded
                          ? 'bg-emerald-600 text-white'
                          : 'bg-black/65 text-white backdrop-blur-xs'
                      }`}
                    >
                      {file.downloaded ? (
                        <>
                          <CheckCircle2 className="w-3 h-3" />
                          <span>Local</span>
                        </>
                      ) : (
                        <>
                          <Cloud className="w-3 h-3" />
                          <span>{file.partialPercent ? `${file.partialPercent}%` : 'Drive'}</span>
                        </>
                      )}
                    </div>
                  )}

                  {!file.isFolder && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenFileMenu(file);
                      }}
                      aria-label="Opciones de archivo"
                      className="absolute top-2 right-2 h-8 w-8 rounded-lg bg-black/55 text-white hover:bg-black/75 flex items-center justify-center"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  )}
                </div>

                <div className="p-2.5 space-y-1">
                  <div className="text-xs font-semibold line-clamp-2 leading-snug">{file.name}</div>
                  <div className="flex items-center justify-between text-[11px] text-[var(--luma-ink-muted)] tabular-nums">
                    <span className="uppercase font-mono text-[10px]">{file.category}</span>
                    {!file.isFolder && <span>{formatBytes(file.size)}</span>}
                  </div>
                </div>
              </article>
            ))}
          </div>
        ) : (
          <div className="rounded-2xl border border-[var(--luma-border)] bg-[var(--luma-surface)] divide-y divide-[var(--luma-border)]">
            {combinedFiles.slice(0, visibleLimit).map((file) => (
              <div
                key={`${file.sourceId}_${file.id}`}
                onClick={() => {
                  if (file.isFolder) {
                    onOpenFolder(file.sourceId, file.id, file.name);
                  } else {
                    onTapDriveFile(file, thumbMapRef.current[file.id]);
                  }
                }}
                onContextMenu={(e) => {
                  if (file.isFolder) return;
                  e.preventDefault();
                  onOpenFileMenu(file);
                }}
                className="px-4 py-3 flex items-center justify-between gap-3 hover:bg-[var(--luma-surface-alt)] cursor-pointer"
              >
                <div className="flex items-center gap-3 min-w-0">
                  <LazyDriveThumb file={file} className="w-10 h-12 rounded-lg shrink-0" />
                  <div className="min-w-0">
                    <div className="text-xs font-semibold truncate">{file.name}</div>
                    <div className="text-[11px] text-[var(--luma-ink-muted)] flex items-center gap-2 mt-0.5">
                      {!file.isFolder && <span>{formatBytes(file.size)}</span>}
                      {file.folderPath && <span className="truncate">· {file.folderPath}</span>}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-2 shrink-0">
                  {!file.isFolder &&
                    (file.downloaded ? (
                      <CheckCircle2 className="w-4 h-4 text-emerald-500" />
                    ) : (
                      <Cloud className="w-4 h-4 text-[var(--luma-ink-muted)]" />
                    ))}
                  {!file.isFolder && (
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        onOpenFileMenu(file);
                      }}
                      className="h-9 w-9 rounded-lg flex items-center justify-center hover:bg-[var(--luma-bg)]"
                    >
                      <MoreVertical className="w-4 h-4" />
                    </button>
                  )}
                </div>
              </div>
            ))}
          </div>
        )}

        {combinedFiles.length > visibleLimit && (
          <div className="text-center pt-2">
            <button
              type="button"
              onClick={() => setVisibleLimit((v) => v + 36)}
              className="h-10 px-5 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-surface)] hover:bg-[var(--luma-surface-alt)] text-xs font-semibold"
            >
              Mostrar más ({combinedFiles.length - visibleLimit} restantes)
            </button>
          </div>
        )}
      </div>
    </div>
  );
};
