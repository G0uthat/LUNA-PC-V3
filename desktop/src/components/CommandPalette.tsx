import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  BookOpen,
  Columns2,
  FolderKanban,
  Palette,
  PenTool,
  Plus,
  Search,
  Upload,
} from 'lucide-react';
import { LumaDocument, LumaNotebook, ReadingThemeId, SagaPlaylist } from '../types';
import { LUMA_THEMES } from '../themes';

interface CommandPaletteProps {
  open: boolean;
  documents: LumaDocument[];
  notebooks: LumaNotebook[];
  playlists: SagaPlaylist[];
  canSplitView: boolean;
  onClose: () => void;
  onOpenDocument: (id: string) => void;
  onOpenNotebook: (id: string) => void;
  onSelectTheme: (id: ReadingThemeId) => void;
  onImportFiles: () => void;
  onNewNotebook: () => void;
  onToggleSplit: () => void;
  onOpenSagas: (sagaId?: string) => void;
}

interface PaletteItem {
  id: string;
  section: string;
  label: string;
  meta: string;
  icon: React.ReactNode;
  run: () => void;
}

export const CommandPalette: React.FC<CommandPaletteProps> = ({
  open,
  documents,
  notebooks,
  playlists,
  canSplitView,
  onClose,
  onOpenDocument,
  onOpenNotebook,
  onSelectTheme,
  onImportFiles,
  onNewNotebook,
  onToggleSplit,
  onOpenSagas,
}) => {
  const [query, setQuery] = useState('');
  const [selectedIdx, setSelectedIdx] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (open) {
      setQuery('');
      setSelectedIdx(0);
      setTimeout(() => inputRef.current?.focus(), 20);
    }
  }, [open]);

  const items = useMemo<PaletteItem[]>(() => {
    const actions: PaletteItem[] = [
      {
        id: 'act_import',
        section: 'Acciones',
        label: 'Importar archivo desde PC (EPUB, PDF, DOCX, PPTX, TXT, FB2)',
        meta: 'Archivo local',
        icon: <Upload className="w-4 h-4 text-[var(--luma-accent)]" />,
        run: onImportFiles,
      },
      {
        id: 'act_new_nb',
        section: 'Acciones',
        label: 'Crear nuevo Cuaderno de estudio',
        meta: 'Estudio Canva',
        icon: <Plus className="w-4 h-4 text-[var(--luma-accent)]" />,
        run: onNewNotebook,
      },
    ];

    if (canSplitView) {
      actions.push({
        id: 'act_split',
        section: 'Acciones',
        label: 'Alternar Vista Dividida (Lector + Cuaderno)',
        meta: 'Espacio de trabajo',
        icon: <Columns2 className="w-4 h-4 text-[var(--luma-accent)]" />,
        run: onToggleSplit,
      });
    }

    const docItems: PaletteItem[] = documents.map((d) => ({
      id: `doc_${d.id}`,
      section: 'Biblioteca',
      label: d.title,
      meta: `${d.author} · ${d.format}`,
      icon: <BookOpen className="w-4 h-4" style={{ color: d.coverColor }} />,
      run: () => onOpenDocument(d.id),
    }));

    const nbItems: PaletteItem[] = notebooks.map((nb) => ({
      id: `nb_${nb.id}`,
      section: 'Cuadernos',
      label: nb.title,
      meta: `${nb.pageSize} · ${nb.pages.length} pág.`,
      icon: <PenTool className="w-4 h-4" style={{ color: nb.coverColor }} />,
      run: () => onOpenNotebook(nb.id),
    }));

    const plItems: PaletteItem[] = playlists.map((pl) => ({
      id: `pl_${pl.id}`,
      section: 'Sagas',
      label: pl.name,
      meta: `${pl.documentIds.length} obras`,
      icon: <FolderKanban className="w-4 h-4" style={{ color: pl.accentColor }} />,
      run: () => onOpenSagas(pl.id),
    }));

    const themeItems: PaletteItem[] = LUMA_THEMES.map((t) => ({
      id: `theme_${t.id}`,
      section: 'Temas suaves',
      label: `Tema: ${t.name}`,
      meta: t.comfortTag,
      icon: <Palette className="w-4 h-4" style={{ color: t.accent }} />,
      run: () => onSelectTheme(t.id),
    }));

    const all = [...actions, ...docItems, ...nbItems, ...plItems, ...themeItems];
    const q = query.trim().toLowerCase();
    if (!q) return all.slice(0, 14);
    return all.filter(
      (item) =>
        item.label.toLowerCase().includes(q) ||
        item.meta.toLowerCase().includes(q) ||
        item.section.toLowerCase().includes(q)
    );
  }, [
    query,
    documents,
    notebooks,
    playlists,
    canSplitView,
    onImportFiles,
    onNewNotebook,
    onToggleSplit,
    onOpenDocument,
    onOpenNotebook,
    onOpenSagas,
    onSelectTheme,
  ]);

  useEffect(() => {
    setSelectedIdx(0);
  }, [query]);

  if (!open) return null;

  const handleKeyDown = (e: React.KeyboardEvent) => {
    if (e.key === 'Escape') {
      e.preventDefault();
      onClose();
    } else if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIdx((i) => Math.min(items.length - 1, i + 1));
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIdx((i) => Math.max(0, i - 1));
    } else if (e.key === 'Enter' && items[selectedIdx]) {
      e.preventDefault();
      items[selectedIdx].run();
      onClose();
    }
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-start justify-center pt-[12vh] px-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        onKeyDown={handleKeyDown}
        className="w-full max-w-[580px] rounded-xl border border-[var(--luma-border)] bg-[var(--luma-surface)] text-[var(--luma-ink)] shadow-2xl overflow-hidden"
      >
        <div className="flex items-center gap-2.5 px-4 h-12 border-b border-[var(--luma-border)]">
          <Search className="w-4 h-4 text-[var(--luma-ink-muted)] shrink-0" />
          <input
            ref={inputRef}
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Busca libros, cuadernos, sagas, temas o acciones..."
            className="flex-1 bg-transparent text-sm outline-none placeholder:text-[var(--luma-ink-muted)]"
          />
          <span className="text-[11px] font-mono text-[var(--luma-ink-muted)]">ESC</span>
        </div>

        <div className="max-h-[380px] overflow-y-auto p-1.5">
          {items.length === 0 ? (
            <div className="py-10 text-center text-sm text-[var(--luma-ink-muted)]">
              No se encontraron coincidencias para "{query}".
            </div>
          ) : (
            items.map((item, idx) => {
              const active = idx === selectedIdx;
              return (
                <button
                  key={item.id}
                  type="button"
                  onMouseEnter={() => setSelectedIdx(idx)}
                  onClick={() => {
                    item.run();
                    onClose();
                  }}
                  className={`w-full px-3 py-2 rounded-lg flex items-center justify-between gap-3 text-left transition-colors ${
                    active ? 'bg-[var(--luma-accent-soft)]' : 'hover:bg-[var(--luma-surface-alt)]'
                  }`}
                >
                  <span className="flex items-center gap-2.5 min-w-0">
                    {item.icon}
                    <span className="text-sm font-medium truncate text-[var(--luma-ink)]">
                      {item.label}
                    </span>
                  </span>
                  <span className="text-xs text-[var(--luma-ink-muted)] whitespace-nowrap shrink-0">
                    {item.meta}
                  </span>
                </button>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
};
