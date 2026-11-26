import React, { useCallback, useEffect, useLayoutEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import { Check, ChevronDown, Search, Trash2, Upload } from 'lucide-react';
import {
  FontCatalogEntry,
  GOOGLE_LIBRARY_FONTS,
  importCustomFontFile,
  loadAllLibraryFontsForPreview,
  removeCustomFont,
  resolveFontFamilyCss,
} from '../utils/fontManager';

interface FontPickerProps {
  value: string;
  customFonts: FontCatalogEntry[];
  onChange: (family: string) => void;
  onCustomFontsChange: (fonts: FontCatalogEntry[]) => void;
  compact?: boolean;
}

interface PopoverCoords {
  top: number;
  left: number;
  maxHeight: number;
  width: number;
}

export const FontPicker: React.FC<FontPickerProps> = ({
  value,
  customFonts,
  onChange,
  onCustomFontsChange,
  compact = false,
}) => {
  const [open, setOpen] = useState(false);
  const [query, setQuery] = useState('');
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [importing, setImporting] = useState(false);
  const [coords, setCoords] = useState<PopoverCoords | null>(null);

  const triggerRef = useRef<HTMLButtonElement>(null);
  const dropdownRef = useRef<HTMLDivElement>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const updateCoords = useCallback(() => {
    const btn = triggerRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const margin = 10;
    const width = Math.min(296, window.innerWidth - margin * 2);
    const left = Math.max(margin, Math.min(rect.left, window.innerWidth - width - margin));

    const spaceBelow = window.innerHeight - rect.bottom - margin;
    const spaceAbove = rect.top - margin;
    const desiredHeight = 390;

    if (spaceBelow >= 240 || spaceBelow >= spaceAbove) {
      setCoords({
        top: rect.bottom + 6,
        left,
        width,
        maxHeight: Math.max(180, Math.min(desiredHeight, spaceBelow - 8)),
      });
    } else {
      const h = Math.max(180, Math.min(desiredHeight, spaceAbove - 8));
      setCoords({
        top: Math.max(margin, rect.top - h - 6),
        left,
        width,
        maxHeight: h,
      });
    }
  }, []);

  useEffect(() => {
    if (open) {
      loadAllLibraryFontsForPreview();
    }
  }, [open]);

  useLayoutEffect(() => {
    if (!open) return;
    updateCoords();
    const onScrollOrResize = () => updateCoords();
    window.addEventListener('resize', onScrollOrResize);
    window.addEventListener('scroll', onScrollOrResize, true);
    return () => {
      window.removeEventListener('resize', onScrollOrResize);
      window.removeEventListener('scroll', onScrollOrResize, true);
    };
  }, [open, updateCoords]);

  useEffect(() => {
    if (!open) return;
    const onDocPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        triggerRef.current?.contains(target) ||
        dropdownRef.current?.contains(target)
      ) {
        return;
      }
      setOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onDocPointerDown);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      document.removeEventListener('mousedown', onDocPointerDown);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [open]);

  const currentLabel = useMemo(() => {
    if (value === 'sans') return 'Plus Jakarta Sans';
    if (value === 'serif') return 'Literata';
    if (value === 'mono') return 'JetBrains Mono';
    if (value === 'hand') return 'Caveat';
    return value || 'Plus Jakarta Sans';
  }, [value]);

  const filteredCustom = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return customFonts;
    return customFonts.filter((f) => f.family.toLowerCase().includes(q));
  }, [customFonts, query]);

  const filteredLibrary = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return GOOGLE_LIBRARY_FONTS;
    return GOOGLE_LIBRARY_FONTS.filter(
      (f) => f.family.toLowerCase().includes(q) || f.category.toLowerCase().includes(q)
    );
  }, [query]);

  const handleFileImport = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    e.target.value = '';
    if (files.length === 0) return;

    setImporting(true);
    setErrorMsg(null);
    const added: FontCatalogEntry[] = [];
    try {
      for (const f of files) {
        const entry = await importCustomFontFile(f);
        added.push(entry);
      }
      if (added.length > 0) {
        const next = [
          ...added,
          ...customFonts.filter((c) => !added.some((a) => a.family === c.family)),
        ];
        onCustomFontsChange(next);
        onChange(added[0].family);
      }
    } catch (err) {
      setErrorMsg(err instanceof Error ? err.message : 'No se pudo importar la tipografía.');
    } finally {
      setImporting(false);
    }
  };

  const handleRemoveCustom = async (e: React.MouseEvent, font: FontCatalogEntry) => {
    e.stopPropagation();
    await removeCustomFont(font.id);
    onCustomFontsChange(customFonts.filter((c) => c.id !== font.id));
  };

  const dropdownPortal =
    open && coords
      ? createPortal(
          <div
            ref={dropdownRef}
            role="listbox"
            aria-label="Catálogo de tipografías"
            onMouseDown={(e) => e.stopPropagation()}
            onPointerDown={(e) => e.stopPropagation()}
            style={{
              position: 'fixed',
              top: coords.top,
              left: coords.left,
              width: coords.width,
              maxHeight: coords.maxHeight,
              zIndex: 9999,
            }}
            className="rounded-xl border border-[var(--luma-border)] bg-[var(--luma-surface)] text-[var(--luma-ink)] shadow-2xl overflow-hidden flex flex-col"
          >
            {/* Search + Import Own Font */}
            <div className="p-2.5 border-b border-[var(--luma-border)] space-y-2 shrink-0">
              <div className="relative">
                <Search className="w-3.5 h-3.5 absolute left-2.5 top-1/2 -translate-y-1/2 text-[var(--luma-ink-muted)] pointer-events-none" />
                <input
                  type="text"
                  value={query}
                  onChange={(e) => setQuery(e.target.value)}
                  placeholder="Buscar entre 30+ tipografías..."
                  aria-label="Buscar tipografía por nombre"
                  autoFocus
                  className="w-full h-8 pl-8 pr-2.5 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-bg)] text-xs text-[var(--luma-ink)] outline-none focus:border-[var(--luma-accent)]"
                />
              </div>

              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                disabled={importing}
                className="w-full h-8 px-2.5 rounded-lg bg-[var(--luma-accent-soft)] text-[var(--luma-accent)] hover:opacity-90 flex items-center justify-center gap-1.5 text-xs font-semibold transition-opacity"
              >
                <Upload className="w-3.5 h-3.5 shrink-0" />
                <span className="truncate">
                  {importing ? 'Importando fuente...' : 'Importar tipografía propia (.ttf, .otf, .woff2)'}
                </span>
              </button>

              {errorMsg && (
                <p className="text-[11px] text-red-500 leading-snug">{errorMsg}</p>
              )}
            </div>

            {/* Scrollable Font List: Custom First, then Library */}
            <div className="flex-1 min-h-0 overflow-y-auto p-1.5 space-y-2">
              {filteredCustom.length > 0 && (
                <div>
                  <div className="px-2 py-1 text-[10px] font-semibold text-[var(--luma-ink-muted)]">
                    Importadas por ti ({filteredCustom.length})
                  </div>
                  <div className="space-y-0.5">
                    {filteredCustom.map((font) => {
                      const active = currentLabel.toLowerCase() === font.family.toLowerCase();
                      return (
                        <div
                          key={font.id}
                          role="option"
                          aria-selected={active}
                          onClick={() => {
                            onChange(font.family);
                            setOpen(false);
                          }}
                          className={`group flex items-center justify-between gap-2 px-2.5 py-2 rounded-lg cursor-pointer transition-colors ${
                            active
                              ? 'bg-[var(--luma-accent-soft)] text-[var(--luma-accent)]'
                              : 'hover:bg-[var(--luma-surface-alt)]'
                          }`}
                        >
                          <div className="min-w-0 flex-1">
                            <div
                              className="text-sm leading-tight truncate"
                              style={{ fontFamily: resolveFontFamilyCss(font.family) }}
                            >
                              {font.family}
                            </div>
                            <div className="text-[10px] text-[var(--luma-ink-muted)] truncate">
                              Fuente propia · {font.fileName}
                            </div>
                          </div>
                          <div className="flex items-center gap-1 shrink-0">
                            {active && <Check className="w-3.5 h-3.5" />}
                            <button
                              type="button"
                              onClick={(e) => handleRemoveCustom(e, font)}
                              title="Eliminar tipografía importada"
                              className="p-1 rounded opacity-0 group-hover:opacity-100 hover:bg-red-500/15 hover:text-red-500 transition-opacity"
                            >
                              <Trash2 className="w-3 h-3" />
                            </button>
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              )}

              <div>
                <div className="px-2 py-1 text-[10px] font-semibold text-[var(--luma-ink-muted)]">
                  Librería libre OFL ({filteredLibrary.length})
                </div>
                <div className="space-y-0.5">
                  {filteredLibrary.map((font) => {
                    const active = currentLabel.toLowerCase() === font.family.toLowerCase();
                    return (
                      <button
                        key={font.id}
                        type="button"
                        role="option"
                        aria-selected={active}
                        onClick={() => {
                          onChange(font.family);
                          setOpen(false);
                        }}
                        className={`w-full flex items-center justify-between gap-2 px-2.5 py-1.5 rounded-lg text-left transition-colors ${
                          active
                            ? 'bg-[var(--luma-accent-soft)] text-[var(--luma-accent)]'
                            : 'hover:bg-[var(--luma-surface-alt)]'
                        }`}
                      >
                        <span
                          className="text-[15px] leading-snug truncate"
                          style={{ fontFamily: resolveFontFamilyCss(font.family) }}
                        >
                          {font.family}
                        </span>
                        {active && <Check className="w-3.5 h-3.5 shrink-0" />}
                      </button>
                    );
                  })}
                  {filteredLibrary.length === 0 && filteredCustom.length === 0 && (
                    <div className="px-3 py-6 text-center text-xs text-[var(--luma-ink-muted)]">
                      No se encontraron fuentes con «{query}».
                    </div>
                  )}
                </div>
              </div>
            </div>
          </div>,
          document.body
        )
      : null;

  return (
    <div className="relative">
      <input
        ref={fileInputRef}
        type="file"
        multiple
        accept=".ttf,.otf,.woff,.woff2"
        onChange={handleFileImport}
        className="hidden"
      />

      <button
        ref={triggerRef}
        type="button"
        onClick={() => setOpen((v) => !v)}
        aria-label="Seleccionar tipografía"
        aria-expanded={open}
        className={`flex items-center justify-between gap-1.5 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)] text-[var(--luma-ink)] transition-colors ${
          compact ? 'h-8 px-2.5 w-[156px] text-xs' : 'h-9 px-3 w-full text-xs'
        }`}
      >
        <span
          className="truncate font-medium"
          style={{ fontFamily: resolveFontFamilyCss(value) }}
        >
          {currentLabel}
        </span>
        <ChevronDown className="w-3.5 h-3.5 shrink-0 text-[var(--luma-ink-muted)]" />
      </button>

      {dropdownPortal}
    </div>
  );
};
