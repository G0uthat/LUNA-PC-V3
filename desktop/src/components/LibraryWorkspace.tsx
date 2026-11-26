import React, { useMemo, useRef, useState } from 'react';
import {
  AlertCircle,
  AlertTriangle,
  ArrowRight,
  BookOpen,
  CheckCircle2,
  Clock,
  Cloud,
  FileSearch,
  FolderPlus,
  LayoutGrid,
  List,
  MoreVertical,
  PenTool,
  Pin,
  Plus,
  RefreshCw,
  Search,
  Trash2,
  Upload,
  X,
} from 'lucide-react';
import {
  DocumentFormat,
  LumaDocument,
  LumaNotebook,
  SagaPlaylist,
} from '../types';
import { ViewportProfile } from '../hooks/useViewportProfile';
import { DriveFileItem, SyncItemState } from '../drive/driveTypes';
import { formatBytes } from '../drive/driveCache';
import { LazyDriveThumb } from './SourcesWorkspace';

interface LibraryWorkspaceProps {
  mode: 'home' | 'library' | 'sagas' | 'notebooks';
  selectedSagaId?: string;
  viewport: ViewportProfile;
  documents: LumaDocument[];
  playlists: SagaPlaylist[];
  notebooks: LumaNotebook[];
  driveFiles?: DriveFileItem[];
  driveConnected?: boolean;
  pendingSyncCount?: number;
  isSyncing?: boolean;
  syncButtonSlot?: React.ReactNode;
  onSyncNow?: () => void;
  onTapDriveFile?: (file: DriveFileItem, thumb?: string | null) => void;
  onOpenDriveFileMenu?: (file: DriveFileItem) => void;
  onOpenLocalDocMenu?: (doc: LumaDocument) => void;
  onOpenLocalNotebookMenu?: (nb: LumaNotebook) => void;
  onOpenSourcesTab?: () => void;
  onNavigateTab: (kind: 'library' | 'sagas' | 'notebooks') => void;
  onOpenCreateModal: (section?: 'notebook' | 'saga') => void;
  onOpenDocument: (docId: string, unitIndex?: number) => void;
  onOpenNotebook: (nbId: string) => void;
  onCreateNotebookFromTemplate: (
    tpl: 'blank' | 'ruled' | 'grid' | 'cornell' | 'planner' | 'concept_map' | 'comparison'
  ) => void;
  onImportFiles: () => void;
  onTogglePinDocument: (docId: string) => void;
  onDeleteDocument: (docId: string) => void;
  onDeleteNotebook: (nbId: string) => void;
  onCreateSaga: (name: string, description: string, accentColor: string) => void;
  onToggleDocInSaga: (sagaId: string, docId: string) => void;
  onSelectSaga: (sagaId?: string) => void;
}

interface DocumentSearchHit {
  doc: LumaDocument;
  matchedIn: 'title' | 'content';
  unitIndex?: number;
  unitTitle?: string;
  snippet?: string;
}

const FORMAT_FILTERS: Array<{ id: 'ALL' | DocumentFormat; label: string }> = [
  { id: 'ALL', label: 'Todos' },
  { id: 'EPUB', label: 'EPUB' },
  { id: 'PDF', label: 'PDF / Manhwa' },
  { id: 'DOCX', label: 'DOCX' },
  { id: 'PPTX', label: 'PPTX' },
  { id: 'FB2', label: 'FB2' },
  { id: 'TXT', label: 'TXT' },
];

const SAGA_COLORS = ['#2B64F5', '#C2642B', '#C44672', '#257A5E', '#5B4BDB', '#D97706'];

function buildSnippet(text: string, query: string): string {
  const lower = text.toLowerCase();
  const idx = lower.indexOf(query);
  if (idx < 0) return text.slice(0, 120);
  const start = Math.max(0, idx - 42);
  const end = Math.min(text.length, idx + query.length + 74);
  const prefix = start > 0 ? '…' : '';
  const suffix = end < text.length ? '…' : '';
  return `${prefix}${text.slice(start, end)}${suffix}`;
}

function searchDocument(doc: LumaDocument, rawQuery: string): DocumentSearchHit | null {
  const q = rawQuery.trim().toLowerCase();
  if (!q) return { doc, matchedIn: 'title' };

  // 1. Metadata match (title, author, genre, format, synopsis)
  const metaHit =
    doc.title.toLowerCase().includes(q) ||
    doc.author.toLowerCase().includes(q) ||
    doc.genre.toLowerCase().includes(q) ||
    doc.format.toLowerCase().includes(q) ||
    doc.synopsis.toLowerCase().includes(q);

  // 2. Full-text content match inside chapters
  for (let chIdx = 0; chIdx < doc.chapters.length; chIdx++) {
    const ch = doc.chapters[chIdx];
    if (ch.title.toLowerCase().includes(q)) {
      return {
        doc,
        matchedIn: 'content',
        unitIndex: chIdx,
        unitTitle: ch.title,
        snippet: buildSnippet(ch.title, q),
      };
    }
    for (const block of ch.blocks) {
      if (block.text.toLowerCase().includes(q)) {
        return {
          doc,
          matchedIn: 'content',
          unitIndex: chIdx,
          unitTitle: ch.title,
          snippet: buildSnippet(block.text, q),
        };
      }
    }
  }

  // 3. Full-text content match inside PPTX slides
  if (doc.slides) {
    for (let sIdx = 0; sIdx < doc.slides.length; sIdx++) {
      const s = doc.slides[sIdx];
      const combined = [s.title, s.subtitle ?? '', ...s.bullets, s.notes].join(' · ');
      if (combined.toLowerCase().includes(q)) {
        return {
          doc,
          matchedIn: 'content',
          unitIndex: sIdx,
          unitTitle: `Lámina ${sIdx + 1}: ${s.title}`,
          snippet: buildSnippet(combined, q),
        };
      }
    }
  }

  // 4. Full-text content match inside Manhwa speech bubbles (EN + ES)
  if (doc.manhwaPanels) {
    for (const panel of doc.manhwaPanels) {
      for (const b of panel.bubbles) {
        if (b.original.toLowerCase().includes(q) || b.translated.toLowerCase().includes(q)) {
          const matchedText = b.translated.toLowerCase().includes(q) ? b.translated : b.original;
          return {
            doc,
            matchedIn: 'content',
            unitIndex: 0,
            unitTitle: panel.episodeLabel,
            snippet: buildSnippet(matchedText, q),
          };
        }
      }
    }
  }

  if (metaHit) {
    return {
      doc,
      matchedIn: 'title',
      snippet: doc.synopsis.toLowerCase().includes(q) ? buildSnippet(doc.synopsis, q) : undefined,
    };
  }

  return null;
}

export const LibraryWorkspace: React.FC<LibraryWorkspaceProps> = ({
  mode,
  selectedSagaId,
  viewport,
  documents,
  playlists,
  notebooks,
  driveFiles = [],
  driveConnected = false,
  pendingSyncCount = 0,
  isSyncing = false,
  syncButtonSlot,
  onSyncNow,
  onTapDriveFile,
  onOpenDriveFileMenu,
  onOpenLocalDocMenu,
  onOpenLocalNotebookMenu,
  onOpenSourcesTab,
  onNavigateTab,
  onOpenCreateModal,
  onOpenDocument,
  onOpenNotebook,
  onCreateNotebookFromTemplate,
  onImportFiles,
  onTogglePinDocument,
  onDeleteDocument,
  onDeleteNotebook,
  onCreateSaga,
  onToggleDocInSaga,
  onSelectSaga,
}) => {
  const [globalQuery, setGlobalQuery] = useState('');
  const [homeShelf, setHomeShelf] = useState<'books' | 'series' | 'notebooks'>('books');
  const [formatFilter, setFormatFilter] = useState<'ALL' | DocumentFormat>('ALL');
  const [viewMode, setViewMode] = useState<'gallery' | 'table'>('gallery');
  const [showNewSagaForm, setShowNewSagaForm] = useState(false);
  const [newSagaName, setNewSagaName] = useState('');
  const [newSagaDesc, setNewSagaDesc] = useState('');
  const [newSagaColor, setNewSagaColor] = useState(SAGA_COLORS[0]);
  const [assignSagaDocId, setAssignSagaDocId] = useState<string | null>(null);
  const [pullOffset, setPullOffset] = useState(0);

  const scrollRef = useRef<HTMLDivElement>(null);
  const touchStartYRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const driveThumbMapRef = useRef<Record<string, string | null>>({});

  const startLongPress = (cb: () => void) => {
    if (longPressTimerRef.current) window.clearTimeout(longPressTimerRef.current);
    longPressTimerRef.current = window.setTimeout(() => {
      longPressTimerRef.current = null;
      cb();
    }, 520);
  };

  const cancelLongPress = () => {
    if (longPressTimerRef.current) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
  };

  const renderSyncBadge = (state?: SyncItemState, hasDrive?: boolean) => {
    if (!driveConnected) return null;
    const effective = state ?? (hasDrive ? 'synced' : undefined);
    if (!effective) return null;
    if (effective === 'synced') {
      return (
        <span
          title="Sincronizado con Google Drive"
          className="inline-flex items-center gap-1 text-[10px] font-semibold text-emerald-600 dark:text-emerald-400"
        >
          <CheckCircle2 className="w-3 h-3 shrink-0" />
          <span>Drive</span>
        </span>
      );
    }
    if (effective === 'uploading') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-[var(--luma-accent)]">
          <RefreshCw className="w-3 h-3 animate-spin shrink-0" />
          <span>Subiendo</span>
        </span>
      );
    }
    if (effective === 'pending') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
          <Clock className="w-3 h-3 shrink-0" />
          <span>Pendiente</span>
        </span>
      );
    }
    if (effective === 'conflict') {
      return (
        <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-amber-600 dark:text-amber-400">
          <AlertTriangle className="w-3 h-3 shrink-0" />
          <span>Conflicto</span>
        </span>
      );
    }
    return (
      <span className="inline-flex items-center gap-1 text-[10px] font-semibold text-red-500">
        <AlertCircle className="w-3 h-3 shrink-0" />
        <span>Error</span>
      </span>
    );
  };

  const sortedDocs = useMemo(
    () => [...documents].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt),
    [documents]
  );

  const heroDoc = sortedDocs[0];
  const activeSaga = playlists.find((p) => p.id === selectedSagaId);
  const trimmedQuery = globalQuery.trim();

  const filteredDriveFiles = useMemo(() => {
    const onlyFiles = driveFiles.filter((f) => !f.isFolder);
    if (!trimmedQuery) return onlyFiles.slice(0, 12);
    const q = trimmedQuery.toLowerCase();
    return onlyFiles
      .filter(
        (f) =>
          f.name.toLowerCase().includes(q) ||
          (f.folderPath ?? '').toLowerCase().includes(q)
      )
      .slice(0, 12);
  }, [driveFiles, trimmedQuery]);

  // Global search across ALL documents (title, metadata & full chapter/slide/manhwa text)
  const documentHits = useMemo<DocumentSearchHit[]>(() => {
    const hits: DocumentSearchHit[] = [];
    for (const doc of sortedDocs) {
      if (mode === 'sagas' && activeSaga && !activeSaga.documentIds.includes(doc.id)) {
        continue;
      }
      if (formatFilter !== 'ALL' && doc.format !== formatFilter) continue;
      const hit = searchDocument(doc, trimmedQuery);
      if (hit) hits.push(hit);
    }
    return hits;
  }, [sortedDocs, mode, activeSaga, formatFilter, trimmedQuery]);

  // Also match notebooks in global search (title, subtitle, and canvas text blocks!)
  const filteredNotebooks = useMemo(() => {
    const q = trimmedQuery.toLowerCase();
    const list = [...notebooks].sort((a, b) => b.updatedAt - a.updatedAt);
    if (!q) return list;
    return list.filter((n) => {
      if (n.title.toLowerCase().includes(q) || n.subtitle.toLowerCase().includes(q)) return true;
      return n.pages.some((p) =>
        p.objects.some((o) => {
          if (o.kind === 'text' || o.kind === 'sticky') {
            return o.text.toLowerCase().includes(q);
          }
          if (o.kind === 'table') {
            return o.cells.some((c) => c.toLowerCase().includes(q));
          }
          return false;
        })
      );
    });
  }, [notebooks, trimmedQuery]);

  const containerPadding =
    viewport.tier === 'compact'
      ? 'px-4 py-5'
      : viewport.tier === 'tablet'
        ? 'px-6 py-6'
        : viewport.tier === 'ultrawide'
          ? 'px-12 py-8'
          : 'px-8 py-7';

  const handleCreateSagaSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = newSagaName.trim();
    if (!clean) return;
    onCreateSaga(clean, newSagaDesc.trim() || 'Colección personalizada', newSagaColor);
    setNewSagaName('');
    setNewSagaDesc('');
    setShowNewSagaForm(false);
  };

  const renderHighlightedSnippet = (snippet: string, query: string) => {
    const q = query.trim();
    if (!q) return snippet;
    const escaped = q.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const parts = snippet.split(new RegExp(`(${escaped})`, 'gi'));
    return parts.map((part, idx) =>
      part.toLowerCase() === q.toLowerCase() ? (
        <mark
          key={idx}
          className="px-0.5 rounded bg-[var(--luma-accent-soft)] text-[var(--luma-ink)] font-semibold"
        >
          {part}
        </mark>
      ) : (
        <React.Fragment key={idx}>{part}</React.Fragment>
      )
    );
  };

  const renderBookGrid = (hits: DocumentSearchHit[]) => {
    if (hits.length === 0) {
      return (
        <div className="py-14 px-6 text-center rounded-xl border border-dashed border-[var(--luma-border)] bg-[var(--luma-surface)]">
          <p className="text-sm font-medium text-[var(--luma-ink)]">
            {trimmedQuery
              ? `No se encontraron documentos que coincidan con “${trimmedQuery}”.`
              : 'No hay obras que coincidan con este filtro.'}
          </p>
          <p className="text-xs text-[var(--luma-ink-muted)] mt-1">
            Importa archivos EPUB, PDF, DOCX, PPTX, TXT o FB2 desde tu PC o arrástralos a esta ventana.
          </p>
          <button
            type="button"
            onClick={onImportFiles}
            className="mt-4 h-9 px-4 rounded-lg bg-[var(--luma-accent)] text-[var(--luma-on-accent)] text-xs font-semibold inline-flex items-center gap-2 hover:opacity-95"
          >
            <Upload className="w-3.5 h-3.5" />
            Importar archivos
          </button>
        </div>
      );
    }

    if (viewMode === 'table') {
      return (
        <div className="rounded-xl border border-[var(--luma-border)] bg-[var(--luma-surface)] overflow-x-auto">
          <table className="w-full text-left border-collapse min-w-[600px]">
            <thead>
              <tr className="border-b border-[var(--luma-border)] text-[11px] font-semibold text-[var(--luma-ink-muted)]">
                <th className="py-2.5 px-4">Título</th>
                <th className="py-2.5 px-3">Autor</th>
                <th className="py-2.5 px-3">Formato</th>
                <th className="py-2.5 px-3 text-right">Progreso</th>
                <th className="py-2.5 px-3 text-right">Palabras</th>
                <th className="py-2.5 px-4 text-right">Acciones</th>
              </tr>
            </thead>
            <tbody>
              {hits.map(({ doc, unitIndex, snippet, unitTitle }) => (
                <tr
                  key={doc.id}
                  onClick={() => onOpenDocument(doc.id, unitIndex)}
                  className="border-b last:border-b-0 border-[var(--luma-border)] hover:bg-[var(--luma-surface-alt)] transition-colors cursor-pointer"
                >
                  <td className="py-2.5 px-4">
                    <div className="flex items-start gap-2.5 min-w-0">
                      <span
                        className="w-2.5 h-6 rounded-sm shrink-0 mt-0.5"
                        style={{ backgroundColor: doc.coverColor }}
                      />
                      <div className="min-w-0">
                        <div className="text-sm font-medium truncate text-[var(--luma-ink)]">
                          {doc.title}
                        </div>
                        {trimmedQuery && snippet && (
                          <div className="text-[11px] text-[var(--luma-ink-muted)] line-clamp-1 mt-0.5">
                            {unitTitle ? `${unitTitle}: ` : ''}
                            {renderHighlightedSnippet(snippet, trimmedQuery)}
                          </div>
                        )}
                      </div>
                    </div>
                  </td>
                  <td className="py-2.5 px-3 text-xs text-[var(--luma-ink-muted)] whitespace-nowrap">
                    {doc.author}
                  </td>
                  <td className="py-2.5 px-3 text-xs font-mono text-[var(--luma-ink-muted)] whitespace-nowrap">
                    {doc.badgeTag}
                  </td>
                  <td className="py-2.5 px-3 text-xs text-right tabular-nums font-medium">
                    {Math.round(doc.progressPercent * 100)}%
                  </td>
                  <td className="py-2.5 px-3 text-xs text-right tabular-nums text-[var(--luma-ink-muted)]">
                    {doc.totalWords.toLocaleString('es-ES')}
                  </td>
                  <td
                    className="py-2.5 px-4 text-right whitespace-nowrap"
                    onClick={(e) => e.stopPropagation()}
                  >
                    <button
                      type="button"
                      onClick={() => onTogglePinDocument(doc.id)}
                      title={doc.pinned ? 'Quitar de fijados' : 'Fijar en menú lateral'}
                      className={`p-1.5 rounded hover:bg-[var(--luma-bg)] ${
                        doc.pinned ? 'text-[var(--luma-accent)]' : 'text-[var(--luma-ink-muted)]'
                      }`}
                    >
                      <Pin className="w-3.5 h-3.5" />
                    </button>
                    <button
                      type="button"
                      onClick={() => onDeleteDocument(doc.id)}
                      title="Eliminar de la biblioteca"
                      className="p-1.5 rounded hover:bg-red-500/10 text-[var(--luma-ink-muted)] hover:text-red-500 ml-1"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }

    return (
      <div
        className="grid gap-5"
        style={{
          gridTemplateColumns: `repeat(auto-fill, minmax(${viewport.cardMinWidth}px, 1fr))`,
        }}
      >
        {hits.map(({ doc, unitIndex, snippet, unitTitle }) => (
          <article
            key={doc.id}
            onClick={() => onOpenDocument(doc.id, unitIndex)}
            onContextMenu={(e) => {
              if (!onOpenLocalDocMenu) return;
              e.preventDefault();
              onOpenLocalDocMenu(doc);
            }}
            onTouchStart={() => {
              if (onOpenLocalDocMenu) startLongPress(() => onOpenLocalDocMenu(doc));
            }}
            onTouchEnd={cancelLongPress}
            onTouchMove={cancelLongPress}
            className="group relative flex flex-col rounded-xl border border-[var(--luma-border)] bg-[var(--luma-surface)] hover:border-[var(--luma-accent)]/60 transition-all cursor-pointer overflow-hidden luma-card-motion"
          >
            {/* Editorial Book Cover */}
            <div
              className="relative aspect-[4/5] p-4 flex flex-col justify-between text-white overflow-hidden"
              style={{
                background: `linear-gradient(155deg, ${doc.coverColor} 0%, ${doc.coverAccent} 100%)`,
              }}
            >
              <div className="flex items-center justify-between text-[11px] font-medium opacity-90">
                <span className="font-mono tracking-wide">{doc.badgeTag}</span>
                <div
                  className="flex items-center gap-1 opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                  onClick={(e) => e.stopPropagation()}
                >
                  <button
                    type="button"
                    onClick={() => onTogglePinDocument(doc.id)}
                    title={doc.pinned ? 'Desfijar' : 'Fijar'}
                    className="w-7 h-7 rounded-md bg-black/25 hover:bg-black/45 flex items-center justify-center"
                  >
                    <Pin className="w-3 h-3" />
                  </button>
                  <button
                    type="button"
                    onClick={() => setAssignSagaDocId(assignSagaDocId === doc.id ? null : doc.id)}
                    title="Asignar a Saga"
                    className="w-7 h-7 rounded-md bg-black/25 hover:bg-black/45 flex items-center justify-center"
                  >
                    <FolderPlus className="w-3 h-3" />
                  </button>
                  {onOpenLocalDocMenu && (
                    <button
                      type="button"
                      onClick={() => onOpenLocalDocMenu(doc)}
                      title="Más opciones y Drive"
                      className="w-7 h-7 rounded-md bg-black/25 hover:bg-black/45 flex items-center justify-center"
                    >
                      <MoreVertical className="w-3.5 h-3.5" />
                    </button>
                  )}
                  <button
                    type="button"
                    onClick={() => onDeleteDocument(doc.id)}
                    title="Eliminar"
                    className="w-7 h-7 rounded-md bg-black/25 hover:bg-red-600/80 flex items-center justify-center"
                  >
                    <Trash2 className="w-3 h-3" />
                  </button>
                </div>
              </div>

              <div>
                <h3
                  className="text-base font-semibold leading-snug line-clamp-3"
                  style={{ fontFamily: 'var(--font-serif)' }}
                >
                  {doc.title}
                </h3>
                <p className="text-xs opacity-85 mt-1.5 truncate">{doc.author}</p>
              </div>

              <div className="w-full h-1 bg-white/25 rounded-full overflow-hidden">
                <div
                  className="h-full bg-white rounded-full"
                  style={{ width: `${Math.max(4, Math.round(doc.progressPercent * 100))}%` }}
                />
              </div>
            </div>

            {/* Quiet unboxed metadata footer + sync badge + content match snippet when searching */}
            <div className="px-3.5 py-3 space-y-1.5">
              <div className="flex items-center justify-between gap-2 text-xs text-[var(--luma-ink-muted)]">
                <span className="truncate">{doc.genre}</span>
                <div className="flex items-center gap-2 shrink-0">
                  {renderSyncBadge(doc.syncState, Boolean(doc.driveFileId))}
                  <span className="tabular-nums font-medium text-[var(--luma-ink)]">
                    {Math.round(doc.progressPercent * 100)}%
                  </span>
                </div>
              </div>

              {trimmedQuery && snippet && (
                <div className="pt-1.5 border-t border-[var(--luma-border)] text-[11px] leading-snug text-[var(--luma-ink-muted)]">
                  {unitTitle && (
                    <div className="font-semibold text-[var(--luma-accent)] truncate mb-0.5">
                      {unitTitle}
                    </div>
                  )}
                  <p className="line-clamp-2">{renderHighlightedSnippet(snippet, trimmedQuery)}</p>
                </div>
              )}
            </div>

            {/* Inline Saga Assignment Popover */}
            {assignSagaDocId === doc.id && (
              <div
                onClick={(e) => e.stopPropagation()}
                className="px-3.5 py-2.5 border-t border-[var(--luma-border)] bg-[var(--luma-surface-alt)] space-y-1.5"
              >
                <div className="text-[11px] font-semibold text-[var(--luma-ink-muted)]">
                  Añadir a saga:
                </div>
                {playlists.map((pl) => {
                  const inside = pl.documentIds.includes(doc.id);
                  return (
                    <button
                      key={pl.id}
                      type="button"
                      onClick={() => onToggleDocInSaga(pl.id, doc.id)}
                      className="w-full flex items-center justify-between text-xs py-1 px-2 rounded hover:bg-[var(--luma-surface)]"
                    >
                      <span className="truncate">{pl.name}</span>
                      <span className="font-semibold text-[var(--luma-accent)]">
                        {inside ? 'En saga' : '+ Añadir'}
                      </span>
                    </button>
                  );
                })}
              </div>
            )}
          </article>
        ))}
      </div>
    );
  };

  return (
    <div
      ref={scrollRef}
      onTouchStart={(e) => {
        if ((scrollRef.current?.scrollTop ?? 0) <= 0) {
          touchStartYRef.current = e.touches[0].clientY;
        }
      }}
      onTouchMove={(e) => {
        if (touchStartYRef.current === null) return;
        const delta = e.touches[0].clientY - touchStartYRef.current;
        if (delta > 0 && (scrollRef.current?.scrollTop ?? 0) <= 0) {
          setPullOffset(Math.min(72, delta * 0.45));
        }
      }}
      onTouchEnd={() => {
        if (pullOffset > 44 && onSyncNow) {
          onSyncNow();
        }
        touchStartYRef.current = null;
        setPullOffset(0);
      }}
      className={`h-full overflow-y-auto bg-[var(--luma-bg)] text-[var(--luma-ink)] ${containerPadding} pb-24 md:pb-8`}
    >
      {pullOffset > 10 && (
        <div
          style={{ height: `${pullOffset}px` }}
          className="flex items-center justify-center text-xs text-[var(--luma-ink-muted)] gap-2 overflow-hidden transition-all"
        >
          <RefreshCw className={`w-3.5 h-3.5 ${pullOffset > 44 ? 'animate-spin text-[var(--luma-accent)]' : ''}`} />
          <span>{pullOffset > 44 ? 'Suelta para sincronizar con Drive' : 'Desliza para sincronizar'}</span>
        </div>
      )}

      <div className="max-w-[1240px] mx-auto space-y-6">
        {/* Top Workspace Header + Primary Action + Sincronizar */}
        <div className="flex flex-wrap items-end justify-between gap-4">
          <div>
            <h1 className="text-2xl md:text-3xl font-bold tracking-tight text-balance">
              {mode === 'home' && 'Tu espacio en Luma'}
              {mode === 'library' && 'Biblioteca de Lectura'}
              {mode === 'notebooks' && 'Cuadernos Visuales'}
              {mode === 'sagas' && (activeSaga ? activeSaga.name : 'Sagas y Listas de Lectura')}
            </h1>
            <p className="text-sm text-[var(--luma-ink-muted)] mt-1">
              {mode === 'home' &&
                `${documents.length} obras · ${notebooks.length} cuadernos · ${playlists.length} sagas${
                  driveFiles.length > 0 ? ` · ${driveFiles.filter((f) => !f.isFolder).length} en Drive` : ''
                }`}
              {mode === 'library' &&
                'EPUB, PDF, Manhwa, DOCX, PPTX, TXT y FB2 listos para leer, anotar y estudiar.'}
              {mode === 'notebooks' &&
                'Lienzos estilo Canva con plantillas Cornell, mapas conceptuales, capas y exportación HD.'}
              {mode === 'sagas' &&
                (activeSaga
                  ? activeSaga.description
                  : 'Organiza series, temarios universitarios y listas de documentos.')}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {syncButtonSlot ? (
              syncButtonSlot
            ) : (
              onSyncNow && (
                <button
                  type="button"
                  onClick={onSyncNow}
                  disabled={isSyncing}
                  title={
                    driveConnected
                      ? 'Sincronizar fuentes de Google Drive ahora'
                      : 'Inicia sesión para sincronizar'
                  }
                  className="relative h-10 md:h-9 px-3.5 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-surface)] hover:bg-[var(--luma-surface-alt)] text-xs font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap disabled:opacity-70"
                >
                  <RefreshCw
                    className={`w-3.5 h-3.5 ${
                      isSyncing ? 'animate-spin text-[var(--luma-accent)]' : 'text-[var(--luma-accent)]'
                    }`}
                  />
                  <span>{isSyncing ? 'Sincronizando...' : 'Sincronizar'}</span>
                  {pendingSyncCount > 0 && (
                    <span className="min-w-[18px] h-[18px] px-1 rounded-full bg-amber-500 text-white text-[10px] font-bold inline-flex items-center justify-center tabular-nums">
                      {pendingSyncCount}
                    </span>
                  )}
                </button>
              )
            )}
            <button
              type="button"
              onClick={onImportFiles}
              className="h-10 md:h-9 px-3.5 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-surface)] hover:bg-[var(--luma-surface-alt)] text-xs font-semibold inline-flex items-center gap-2 transition-colors whitespace-nowrap"
            >
              <Upload className="w-3.5 h-3.5 text-[var(--luma-accent)]" />
              <span>Importar archivo</span>
            </button>
            <button
              type="button"
              onClick={() => onOpenCreateModal(mode === 'sagas' ? 'saga' : 'notebook')}
              className="h-10 md:h-9 px-3.5 rounded-lg bg-[var(--luma-accent)] text-[var(--luma-on-accent)] hover:opacity-95 text-xs font-semibold inline-flex items-center gap-2 transition-opacity whitespace-nowrap"
            >
              <Plus className="w-3.5 h-3.5" />
              <span>Crear nuevo</span>
            </button>
          </div>
        </div>

        {/* Global Full-Text Search Bar + Mobile-Luma Style Section Tabs */}
        <div className="flex flex-col md:flex-row items-stretch md:items-center gap-3 pb-5 border-b border-[var(--luma-border)]">
          {/* Global Search Input (searches title, author, genre, AND chapter/slide/manhwa content) */}
          <div className="relative flex-1 min-w-0">
            <Search className="w-4 h-4 absolute left-3.5 top-1/2 -translate-y-1/2 text-[var(--luma-ink-muted)] pointer-events-none" />
            <input
              type="search"
              value={globalQuery}
              onChange={(e) => setGlobalQuery(e.target.value)}
              placeholder="Buscar documentos por título, autor o contenido interno de capítulos..."
              aria-label="Buscar documentos por título o contenido"
              className="w-full h-10 pl-10 pr-9 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-surface)] text-sm text-[var(--luma-ink)] placeholder:text-[var(--luma-ink-muted)] focus:border-[var(--luma-accent)] outline-none transition-colors"
            />
            {globalQuery && (
              <button
                type="button"
                onClick={() => setGlobalQuery('')}
                title="Limpiar búsqueda"
                className="absolute right-2.5 top-1/2 -translate-y-1/2 h-6 w-6 rounded-md flex items-center justify-center text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)] hover:bg-[var(--luma-surface-alt)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            )}
          </div>

          {/* Clean Luma Phone-Style Tabs (Libros / Sagas / Cuadernos) */}
          <div className="flex items-center p-1 rounded-xl bg-[var(--luma-surface-alt)] shrink-0 self-start md:self-auto">
            {(
              [
                { id: 'library', label: 'Libros', count: documents.length },
                { id: 'sagas', label: 'Sagas', count: playlists.length },
                { id: 'notebooks', label: 'Cuadernos', count: notebooks.length },
              ] as const
            ).map((t) => {
              const active = mode === t.id || (mode === 'home' && t.id === 'library');
              return (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => onNavigateTab(t.id)}
                  className={`h-8 px-3 rounded-lg text-xs font-semibold inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                    active
                      ? 'bg-[var(--luma-surface)] text-[var(--luma-ink)] shadow-xs'
                      : 'text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)]'
                  }`}
                >
                  <span>{t.label}</span>
                  <span className="text-[11px] font-normal opacity-70 tabular-nums">{t.count}</span>
                </button>
              );
            })}
          </div>
        </div>

        {/* Live Global Search Content Matches Summary Banner */}
        {trimmedQuery && (
          <section className="rounded-xl border border-[var(--luma-border)] bg-[var(--luma-surface)] p-4 space-y-3">
            <div className="flex items-center justify-between gap-2 text-xs">
              <span className="font-semibold flex items-center gap-2 text-[var(--luma-ink)]">
                <FileSearch className="w-4 h-4 text-[var(--luma-accent)]" />
                Resultados para “{trimmedQuery}”
              </span>
              <span className="text-[var(--luma-ink-muted)] tabular-nums">
                {documentHits.length} {documentHits.length === 1 ? 'documento' : 'documentos'} ·{' '}
                {filteredNotebooks.length} {filteredNotebooks.length === 1 ? 'cuaderno' : 'cuadernos'}
              </span>
            </div>

            {documentHits.some((h) => h.matchedIn === 'content') && (
              <div className="divide-y divide-[var(--luma-border)]">
                {documentHits
                  .filter((h) => h.matchedIn === 'content')
                  .slice(0, 4)
                  .map((hit) => (
                    <button
                      key={`hit_${hit.doc.id}`}
                      type="button"
                      onClick={() => onOpenDocument(hit.doc.id, hit.unitIndex)}
                      className="w-full py-2.5 flex items-start justify-between gap-3 text-left hover:bg-[var(--luma-surface-alt)] px-2 rounded-lg transition-colors"
                    >
                      <div className="min-w-0">
                        <div className="text-xs font-semibold text-[var(--luma-ink)] flex items-center gap-2">
                          <span
                            className="w-2 h-2 rounded-sm shrink-0"
                            style={{ backgroundColor: hit.doc.coverColor }}
                          />
                          <span className="truncate">{hit.doc.title}</span>
                          {hit.unitTitle && (
                            <span className="text-[11px] font-normal text-[var(--luma-ink-muted)] truncate">
                              · {hit.unitTitle}
                            </span>
                          )}
                        </div>
                        {hit.snippet && (
                          <p className="text-xs text-[var(--luma-ink-muted)] mt-1 line-clamp-2">
                            {renderHighlightedSnippet(hit.snippet, trimmedQuery)}
                          </p>
                        )}
                      </div>
                      <span className="text-[11px] font-semibold text-[var(--luma-accent)] whitespace-nowrap shrink-0 mt-0.5">
                        Ir al pasaje
                      </span>
                    </button>
                  ))}
              </div>
            )}
          </section>
        )}

        {/* HOME: Single Focal Anchor — Continue Reading Hero (hidden while actively searching) */}
        {mode === 'home' && !trimmedQuery && heroDoc && (
          <section className="rounded-2xl border border-[var(--luma-border)] bg-[var(--luma-surface)] p-5 md:p-6 flex flex-col md:flex-row items-stretch gap-6">
            <div
              onClick={() => onOpenDocument(heroDoc.id)}
              className="w-full md:w-[190px] aspect-[4/3] md:aspect-[3/4] rounded-xl p-4 flex flex-col justify-between text-white shrink-0 cursor-pointer"
              style={{
                background: `linear-gradient(155deg, ${heroDoc.coverColor}, ${heroDoc.coverAccent})`,
              }}
            >
              <span className="text-[11px] font-mono opacity-90">{heroDoc.badgeTag}</span>
              <div>
                <div
                  className="text-base font-semibold leading-snug"
                  style={{ fontFamily: 'var(--font-serif)' }}
                >
                  {heroDoc.title}
                </div>
                <div className="text-xs opacity-80 mt-1">{heroDoc.author}</div>
              </div>
            </div>

            <div className="flex-1 flex flex-col justify-between gap-4 min-w-0">
              <div>
                <div className="text-xs text-[var(--luma-ink-muted)] flex items-center gap-2">
                  <span>Continuar leyendo</span>
                  <span aria-hidden="true">·</span>
                  <span>{heroDoc.genre}</span>
                  <span aria-hidden="true">·</span>
                  <span className="tabular-nums">
                    {Math.round(heroDoc.progressPercent * 100)}% completado
                  </span>
                </div>
                <h2
                  className="text-xl md:text-2xl font-bold mt-2 tracking-tight"
                  style={{ fontFamily: 'var(--font-serif)' }}
                >
                  {heroDoc.title}
                </h2>
                <p className="text-sm text-[var(--luma-ink-muted)] mt-2 max-w-2xl leading-relaxed">
                  {heroDoc.synopsis}
                </p>
              </div>

              <div className="flex flex-wrap items-center gap-3">
                <button
                  type="button"
                  onClick={() => onOpenDocument(heroDoc.id)}
                  className="h-9 px-4 rounded-lg bg-[var(--luma-accent)] text-[var(--luma-on-accent)] text-xs font-semibold inline-flex items-center gap-2 hover:opacity-95"
                >
                  <span>Abrir lectura</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
                <span className="text-xs text-[var(--luma-ink-muted)] tabular-nums">
                  {heroDoc.chapters.length}{' '}
                  {heroDoc.chapters.length === 1 ? 'sección' : 'secciones'} ·{' '}
                  {heroDoc.totalWords.toLocaleString('es-ES')} palabras
                </span>
              </div>
            </div>
          </section>
        )}

        {/* HOME: Active Google Drive Sources Preview Section (only when signed in) */}
        {mode === 'home' && driveConnected && filteredDriveFiles.length > 0 && (
          <section className="space-y-3">
            <div className="flex items-center justify-between gap-3">
              <div className="flex items-center gap-2">
                <Cloud className="w-4 h-4 text-[var(--luma-accent)]" />
                <h2 className="text-base font-bold tracking-tight">
                  Archivos en Google Drive
                </h2>
                <span className="text-xs text-[var(--luma-ink-muted)] tabular-nums">
                  {filteredDriveFiles.length}
                </span>
              </div>
              {onOpenSourcesTab && (
                <button
                  type="button"
                  onClick={onOpenSourcesTab}
                  className="text-xs font-semibold text-[var(--luma-accent)] hover:underline inline-flex items-center gap-1"
                >
                  <span>Ver todas las fuentes</span>
                  <ArrowRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-3">
              {filteredDriveFiles.map((file) => (
                <div
                  key={file.id}
                  onClick={() => onTapDriveFile?.(file, driveThumbMapRef.current[file.id])}
                  onContextMenu={(e) => {
                    if (!onOpenDriveFileMenu) return;
                    e.preventDefault();
                    onOpenDriveFileMenu(file);
                  }}
                  onTouchStart={() => {
                    if (onOpenDriveFileMenu) startLongPress(() => onOpenDriveFileMenu(file));
                  }}
                  onTouchEnd={cancelLongPress}
                  onTouchMove={cancelLongPress}
                  className="group relative rounded-xl border border-[var(--luma-border)] bg-[var(--luma-surface)] hover:border-[var(--luma-accent)]/70 transition-all cursor-pointer overflow-hidden flex flex-col"
                >
                  <div className="relative aspect-[4/5]">
                    <LazyDriveThumb
                      file={file}
                      className="w-full h-full"
                      onResolved={(url) => {
                        driveThumbMapRef.current[file.id] = url;
                      }}
                    />
                    <span
                      title={file.downloaded ? 'Descargado en este dispositivo' : 'En Google Drive'}
                      className={`absolute top-2 left-2 h-6 px-2 rounded-full text-[10px] font-bold inline-flex items-center gap-1 backdrop-blur-md shadow-xs ${
                        file.downloaded
                          ? 'bg-emerald-600/90 text-white'
                          : 'bg-black/60 text-white'
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
                          <span>Drive</span>
                        </>
                      )}
                    </span>

                    {onOpenDriveFileMenu && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onOpenDriveFileMenu(file);
                        }}
                        title="Opciones del archivo"
                        className="absolute top-2 right-2 w-7 h-7 rounded-lg bg-black/50 hover:bg-black/70 text-white flex items-center justify-center opacity-100 md:opacity-0 md:group-hover:opacity-100 transition-opacity"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    )}
                  </div>
                  <div className="p-2.5 space-y-0.5">
                    <div className="text-xs font-semibold truncate">{file.name}</div>
                    <div className="text-[10px] text-[var(--luma-ink-muted)] flex items-center justify-between gap-1">
                      <span className="truncate">{file.folderPath || 'Raíz'}</span>
                      <span className="tabular-nums shrink-0">{formatBytes(file.size)}</span>
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* HOME: Clean 3-Button Shelf Divider separating Libros, Series/Sagas, and Cuadernos */}
        {mode === 'home' && !trimmedQuery && (
          <div className="grid grid-cols-3 gap-2 p-1.5 rounded-2xl border border-[var(--luma-border)] bg-[var(--luma-surface)]">
            {(
              [
                {
                  id: 'books',
                  label: 'Libros y Documentos',
                  shortLabel: 'Libros',
                  count: documents.length,
                  icon: <BookOpen className="w-4 h-4 shrink-0" />,
                },
                {
                  id: 'series',
                  label: 'Series y Sagas',
                  shortLabel: 'Series',
                  count: playlists.length,
                  icon: <FolderPlus className="w-4 h-4 shrink-0" />,
                },
                {
                  id: 'notebooks',
                  label: 'Cuadernos Visuales',
                  shortLabel: 'Cuadernos',
                  count: notebooks.length,
                  icon: <PenTool className="w-4 h-4 shrink-0" />,
                },
              ] as const
            ).map((btn) => {
              const active = homeShelf === btn.id;
              return (
                <button
                  key={btn.id}
                  type="button"
                  onClick={() => setHomeShelf(btn.id)}
                  className={`h-11 px-3 rounded-xl flex items-center justify-center gap-2 text-xs font-semibold transition-all whitespace-nowrap ${
                    active
                      ? 'bg-[var(--luma-accent)] text-[var(--luma-on-accent)] shadow-xs'
                      : 'text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)] hover:bg-[var(--luma-surface-alt)]'
                  }`}
                >
                  {btn.icon}
                  <span className="hidden sm:inline">{btn.label}</span>
                  <span className="sm:hidden">{btn.shortLabel}</span>
                  <span
                    className={`text-[11px] tabular-nums ${
                      active ? 'opacity-90' : 'opacity-65'
                    }`}
                  >
                    {btn.count}
                  </span>
                </button>
              );
            })}
          </div>
        )}

        {/* HOME: SERIES & SAGAS SHELF (Cleanly separated from Books and Notebooks) */}
        {mode === 'home' && !trimmedQuery && homeShelf === 'series' && (
          <section className="space-y-4 luma-view-enter">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-bold tracking-tight">Series y Sagas</h2>
              <button
                type="button"
                onClick={() => onOpenCreateModal('saga')}
                className="h-8 px-3 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-surface)] hover:bg-[var(--luma-surface-alt)] text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <FolderPlus className="w-3.5 h-3.5 text-[var(--luma-accent)]" />
                <span>Nueva serie</span>
              </button>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
              {playlists.map((pl) => {
                const sagaDocs = documents.filter((d) => pl.documentIds.includes(d.id));
                return (
                  <div
                    key={pl.id}
                    onClick={() => {
                      onSelectSaga(pl.id);
                      onNavigateTab('sagas');
                    }}
                    className="p-4 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-surface)] hover:border-[var(--luma-accent)]/70 transition-colors cursor-pointer space-y-3 luma-card-motion"
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2.5 min-w-0">
                        <span
                          className="w-3 h-3 rounded-full shrink-0"
                          style={{ backgroundColor: pl.accentColor }}
                        />
                        <h3 className="text-sm font-bold truncate">{pl.name}</h3>
                      </div>
                      <span className="text-xs text-[var(--luma-ink-muted)] tabular-nums shrink-0">
                        {sagaDocs.length} {sagaDocs.length === 1 ? 'obra' : 'obras'}
                      </span>
                    </div>
                    <p className="text-xs text-[var(--luma-ink-muted)] line-clamp-2">
                      {pl.description}
                    </p>
                    {sagaDocs.length > 0 && (
                      <div className="pt-2 border-t border-[var(--luma-border)] space-y-1">
                        {sagaDocs.slice(0, 2).map((d) => (
                          <div key={d.id} className="text-xs truncate text-[var(--luma-ink)]">
                            · {d.title}
                          </div>
                        ))}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </section>
        )}

        {/* NOTEBOOKS MODE OR HOME NOTEBOOKS SHELF */}
        {(mode === 'notebooks' || (mode === 'home' && (homeShelf === 'notebooks' || Boolean(trimmedQuery)))) && (
          <section className="space-y-4 luma-view-enter">
            <div className="flex items-center justify-between gap-3">
              <h2 className="text-base font-bold tracking-tight">
                {mode === 'home' ? 'Cuadernos Visuales' : 'Plantillas rápidas'}
              </h2>
              {mode === 'home' && (
                <button
                  type="button"
                  onClick={() => onOpenCreateModal('notebook')}
                  className="h-8 px-3 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-surface)] hover:bg-[var(--luma-surface-alt)] text-xs font-semibold inline-flex items-center gap-1.5"
                >
                  <Plus className="w-3.5 h-3.5 text-[var(--luma-accent)]" />
                  <span>Elegir plantilla</span>
                </button>
              )}
            </div>

            {mode === 'notebooks' && !trimmedQuery && (
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-6 gap-2.5">
                {(
                  [
                    { id: 'blank', name: 'Lienzo blanco', desc: 'Papel limpio A4' },
                    { id: 'ruled', name: 'Papel rayado', desc: 'Apuntes clásicos' },
                    { id: 'grid', name: 'Cuadrícula', desc: 'Esquemas técnicos' },
                    { id: 'cornell', name: 'Método Cornell', desc: 'Preguntas y resumen' },
                    { id: 'concept_map', name: 'Mapa conceptual', desc: 'Nodos y flechas' },
                    { id: 'comparison', name: 'Tabla comparativa', desc: 'Matriz 4×3 editable' },
                  ] as const
                ).map((tpl) => (
                  <button
                    key={tpl.id}
                    type="button"
                    onClick={() => onCreateNotebookFromTemplate(tpl.id)}
                    className="p-3 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-surface)] hover:border-[var(--luma-accent)] text-left transition-colors group"
                  >
                    <div className="flex items-center justify-between mb-1.5">
                      <PenTool className="w-4 h-4 text-[var(--luma-accent)]" />
                      <Plus className="w-3.5 h-3.5 text-[var(--luma-ink-muted)] group-hover:text-[var(--luma-accent)]" />
                    </div>
                    <div className="text-xs font-semibold truncate">{tpl.name}</div>
                    <div className="text-[11px] text-[var(--luma-ink-muted)] truncate mt-0.5">
                      {tpl.desc}
                    </div>
                  </button>
                ))}
              </div>
            )}

            <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4 pt-1">
              {filteredNotebooks.map((nb) => (
                <div
                  key={nb.id}
                  onClick={() => onOpenNotebook(nb.id)}
                  onContextMenu={(e) => {
                    if (!onOpenLocalNotebookMenu) return;
                    e.preventDefault();
                    onOpenLocalNotebookMenu(nb);
                  }}
                  onTouchStart={() => {
                    if (onOpenLocalNotebookMenu) startLongPress(() => onOpenLocalNotebookMenu(nb));
                  }}
                  onTouchEnd={cancelLongPress}
                  onTouchMove={cancelLongPress}
                  className="group p-4 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-surface)] hover:border-[var(--luma-accent)]/70 transition-colors cursor-pointer flex items-center justify-between gap-3 luma-card-motion"
                >
                  <div className="flex items-center gap-3 min-w-0">
                    <div
                      className="w-11 h-14 rounded-lg flex items-center justify-center text-white shrink-0"
                      style={{ backgroundColor: nb.coverColor }}
                    >
                      <PenTool className="w-5 h-5" />
                    </div>
                    <div className="min-w-0">
                      <div className="text-sm font-semibold truncate">{nb.title}</div>
                      <div className="text-xs text-[var(--luma-ink-muted)] truncate mt-0.5">
                        {nb.subtitle}
                      </div>
                      <div className="text-[11px] text-[var(--luma-ink-muted)] mt-1 flex items-center gap-2 tabular-nums">
                        <span>
                          {nb.pageSize} · {nb.pages.length}{' '}
                          {nb.pages.length === 1 ? 'página' : 'páginas'}
                        </span>
                        {renderSyncBadge(nb.syncState, Boolean(nb.driveFileId))}
                      </div>
                    </div>
                  </div>
                  <div
                    className="flex items-center gap-1 shrink-0"
                    onClick={(e) => e.stopPropagation()}
                  >
                    {onOpenLocalNotebookMenu && (
                      <button
                        type="button"
                        onClick={() => onOpenLocalNotebookMenu(nb)}
                        title="Opciones y Drive"
                        className="p-2 rounded-md opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:bg-[var(--luma-surface-alt)] text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)] transition-opacity"
                      >
                        <MoreVertical className="w-3.5 h-3.5" />
                      </button>
                    )}
                    <button
                      type="button"
                      onClick={() => onDeleteNotebook(nb.id)}
                      title="Eliminar cuaderno"
                      className="p-2 rounded-md opacity-100 md:opacity-0 md:group-hover:opacity-100 hover:bg-red-500/10 text-[var(--luma-ink-muted)] hover:text-red-500 transition-opacity"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  </div>
                </div>
              ))}
            </div>
          </section>
        )}

        {/* SAGAS MODE */}
        {mode === 'sagas' && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex flex-wrap items-center gap-1.5">
                <button
                  type="button"
                  onClick={() => onSelectSaga(undefined)}
                  className={`h-8 px-3 rounded-lg text-xs font-medium transition-colors ${
                    !selectedSagaId
                      ? 'bg-[var(--luma-accent)] text-[var(--luma-on-accent)]'
                      : 'bg-[var(--luma-surface)] border border-[var(--luma-border)] text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)]'
                  }`}
                >
                  Todas las sagas
                </button>
                {playlists.map((pl) => (
                  <button
                    key={pl.id}
                    type="button"
                    onClick={() => onSelectSaga(pl.id)}
                    className={`h-8 px-3 rounded-lg text-xs font-medium transition-colors inline-flex items-center gap-2 ${
                      selectedSagaId === pl.id
                        ? 'bg-[var(--luma-accent)] text-[var(--luma-on-accent)]'
                        : 'bg-[var(--luma-surface)] border border-[var(--luma-border)] text-[var(--luma-ink)] hover:bg-[var(--luma-surface-alt)]'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full"
                      style={{
                        backgroundColor: selectedSagaId === pl.id ? '#FFFFFF' : pl.accentColor,
                      }}
                    />
                    <span>{pl.name}</span>
                    <span className="opacity-70 tabular-nums">{pl.documentIds.length}</span>
                  </button>
                ))}
              </div>

              <button
                type="button"
                onClick={() => setShowNewSagaForm((v) => !v)}
                className="h-8 px-3 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-surface)] hover:bg-[var(--luma-surface-alt)] text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <FolderPlus className="w-3.5 h-3.5 text-[var(--luma-accent)]" />
                <span>Nueva saga</span>
              </button>
            </div>

            {showNewSagaForm && (
              <form
                onSubmit={handleCreateSagaSubmit}
                className="p-4 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-surface)] grid grid-cols-1 md:grid-cols-3 gap-3 items-end"
              >
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--luma-ink-muted)] mb-1">
                    Nombre de la saga
                  </label>
                  <input
                    value={newSagaName}
                    onChange={(e) => setNewSagaName(e.target.value)}
                    placeholder="Ej. Arquitectura de Software"
                    className="w-full h-9 px-3 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-bg)] text-xs outline-none"
                    required
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--luma-ink-muted)] mb-1">
                    Descripción breve
                  </label>
                  <input
                    value={newSagaDesc}
                    onChange={(e) => setNewSagaDesc(e.target.value)}
                    placeholder="Libros técnicos y apuntes"
                    className="w-full h-9 px-3 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-bg)] text-xs outline-none"
                  />
                </div>
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1.5">
                    {SAGA_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setNewSagaColor(c)}
                        className={`w-6 h-6 rounded-full ${
                          newSagaColor === c ? 'ring-2 ring-offset-2 ring-[var(--luma-ink)]' : ''
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <button
                    type="submit"
                    className="h-9 px-4 rounded-lg bg-[var(--luma-accent)] text-[var(--luma-on-accent)] text-xs font-semibold"
                  >
                    Crear
                  </button>
                </div>
              </form>
            )}
          </section>
        )}

        {/* LIBRARY GRID / TABLE (Library, Sagas, or Home when Books shelf / searching) */}
        {(mode === 'library' ||
          mode === 'sagas' ||
          (mode === 'home' && (homeShelf === 'books' || Boolean(trimmedQuery)))) && (
          <section className="space-y-4">
            <div className="flex flex-wrap items-center justify-between gap-3">
              <div className="flex items-center gap-1 p-1 rounded-lg bg-[var(--luma-surface-alt)] overflow-x-auto max-w-full">
                {FORMAT_FILTERS.map((f) => {
                  const active = formatFilter === f.id;
                  return (
                    <button
                      key={f.id}
                      type="button"
                      onClick={() => setFormatFilter(f.id)}
                      className={`px-2.5 py-1 rounded-md text-xs font-medium whitespace-nowrap transition-colors ${
                        active
                          ? 'bg-[var(--luma-surface)] text-[var(--luma-ink)] shadow-xs'
                          : 'text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)]'
                      }`}
                    >
                      {f.label}
                    </button>
                  );
                })}
              </div>

              <div className="flex items-center p-0.5 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-surface)]">
                <button
                  type="button"
                  onClick={() => setViewMode('gallery')}
                  title="Vista Galería"
                  className={`h-7 w-7 rounded-md flex items-center justify-center ${
                    viewMode === 'gallery'
                      ? 'bg-[var(--luma-surface-alt)] text-[var(--luma-accent)]'
                      : 'text-[var(--luma-ink-muted)]'
                  }`}
                >
                  <LayoutGrid className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => setViewMode('table')}
                  title="Vista Tabla Notion"
                  className={`h-7 w-7 rounded-md flex items-center justify-center ${
                    viewMode === 'table'
                      ? 'bg-[var(--luma-surface-alt)] text-[var(--luma-accent)]'
                      : 'text-[var(--luma-ink-muted)]'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                </button>
              </div>
            </div>

            {renderBookGrid(documentHits)}
          </section>
        )}

        <footer className="pt-4 border-t border-[var(--luma-border)] flex flex-wrap items-center justify-between gap-2 text-xs text-[var(--luma-ink-muted)]">
          <span className="flex items-center gap-1.5">
            <BookOpen className="w-3.5 h-3.5" />
            Arrastra archivos EPUB, PDF, DOCX, PPTX, FB2 o TXT en cualquier parte de la ventana para añadirlos.
          </span>
          <span className="tabular-nums">Luma Desktop · Modo PC</span>
        </footer>
      </div>
    </div>
  );
};
