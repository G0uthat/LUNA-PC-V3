import React, { useMemo, useState } from 'react';
import {
  Clock,
  Keyboard,
  Replace,
  RotateCcw,
  Search,
  X,
} from 'lucide-react';
import { LumaNotebook, NotebookPage, RulerUnit } from '../types';
import { PageGeometry } from './pageGeometry';

export interface HistorySnapshot {
  id: string;
  label: string;
  timestamp: number;
  pages: NotebookPage[];
  activePageIndex: number;
}

/* ============================================================================
 * 1. Find & Replace Modal (Ctrl+F / Ctrl+H)
 * ==========================================================================*/
interface FindReplaceModalProps {
  open: boolean;
  notebook: LumaNotebook;
  onClose: () => void;
  onReplaceAll: (findText: string, replaceText: string, allPages: boolean) => number;
}

export const FindReplaceModal: React.FC<FindReplaceModalProps> = ({
  open,
  notebook,
  onClose,
  onReplaceAll,
}) => {
  const [findText, setFindText] = useState('');
  const [replaceText, setReplaceText] = useState('');
  const [allPages, setAllPages] = useState(true);
  const [statusMsg, setStatusMsg] = useState<string | null>(null);

  const matchCount = useMemo(() => {
    const q = findText.trim().toLowerCase();
    if (!q) return 0;
    const pages = allPages
      ? notebook.pages
      : [notebook.pages[notebook.activePageIndex]].filter(Boolean);
    let count = 0;
    const countIn = (str: string) => {
      const lower = str.toLowerCase();
      let idx = 0;
      while ((idx = lower.indexOf(q, idx)) !== -1) {
        count++;
        idx += q.length;
      }
    };
    for (const p of pages) {
      if (p.bodyText) countIn(p.bodyText);
      for (const o of p.objects) {
        if (o.kind === 'text' || o.kind === 'sticky') countIn(o.text);
        else if (o.kind === 'table') o.cells.forEach(countIn);
      }
    }
    return count;
  }, [findText, allPages, notebook]);

  if (!open) return null;

  const handleReplace = (e: React.FormEvent) => {
    e.preventDefault();
    if (!findText.trim()) return;
    const replaced = onReplaceAll(findText, replaceText, allPages);
    setStatusMsg(
      replaced > 0
        ? `Se reemplazaron ${replaced} coincidencia${replaced === 1 ? '' : 's'}.`
        : 'No se encontraron coincidencias para reemplazar.'
    );
  };

  return (
    <div
      className="fixed inset-0 z-50 bg-black/35 flex items-start justify-center pt-16 p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Buscar y reemplazar texto"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] rounded-2xl border border-[var(--luma-border)] bg-[var(--luma-surface)] text-[var(--luma-ink)] shadow-2xl overflow-hidden"
      >
        <div className="px-4 py-3 border-b border-[var(--luma-border)] flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-semibold">
            <Search className="w-4 h-4 text-[var(--luma-accent)]" />
            <span>Buscar y reemplazar</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar buscar y reemplazar"
            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[var(--luma-surface-alt)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <form onSubmit={handleReplace} className="p-4 space-y-3 text-xs">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label className="font-medium">Buscar</label>
              {findText.trim() && (
                <span className="font-mono text-[11px] text-[var(--luma-accent)] tabular-nums">
                  {matchCount} coincidencia{matchCount === 1 ? '' : 's'}
                </span>
              )}
            </div>
            <input
              value={findText}
              onChange={(e) => {
                setFindText(e.target.value);
                setStatusMsg(null);
              }}
              placeholder="Palabra o frase en el cuaderno..."
              autoFocus
              className="w-full h-9 px-3 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-bg)] outline-none focus:border-[var(--luma-accent)]"
            />
          </div>

          <div>
            <label className="block font-medium mb-1">Reemplazar con</label>
            <input
              value={replaceText}
              onChange={(e) => setReplaceText(e.target.value)}
              placeholder="Nuevo texto..."
              className="w-full h-9 px-3 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-bg)] outline-none focus:border-[var(--luma-accent)]"
            />
          </div>

          <label className="flex items-center gap-2 cursor-pointer">
            <input
              type="checkbox"
              checked={allPages}
              onChange={(e) => setAllPages(e.target.checked)}
              className="w-4 h-4 accent-[var(--luma-accent)]"
            />
            <span>Buscar en todas las páginas del cuaderno ({notebook.pages.length})</span>
          </label>

          {statusMsg && (
            <div className="text-[11px] font-medium text-[var(--luma-accent)]">{statusMsg}</div>
          )}

          <div className="flex justify-end gap-2 pt-2 border-t border-[var(--luma-border)]">
            <button
              type="button"
              onClick={onClose}
              className="h-8 px-3 rounded-lg border border-[var(--luma-border)] hover:bg-[var(--luma-surface-alt)]"
            >
              Cerrar
            </button>
            <button
              type="submit"
              disabled={!findText.trim() || matchCount === 0}
              className="h-8 px-3.5 rounded-lg bg-[var(--luma-accent)] text-[var(--luma-on-accent)] font-semibold disabled:opacity-45 inline-flex items-center gap-1.5"
            >
              <Replace className="w-3.5 h-3.5" />
              <span>Reemplazar todo</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};

/* ============================================================================
 * 2. Keyboard Shortcuts Help Modal
 * ==========================================================================*/
interface ShortcutsHelpModalProps {
  open: boolean;
  onClose: () => void;
}

const SHORTCUT_GROUPS = [
  {
    title: 'Selección y transformación',
    items: [
      ['Arrastrar en lienzo', 'Selección múltiple (marquesina)'],
      ['Shift + Clic', 'Sumar o quitar objeto de la selección'],
      ['Ctrl / Cmd + A', 'Seleccionar todos los objetos visibles'],
      ['Ctrl / Cmd + G', 'Agrupar / desagrupar selección'],
      ['Flechas (Shift + Flecha)', 'Mover 1px (o 10px)'],
      ['Supr / Backspace', 'Eliminar objetos seleccionados'],
    ],
  },
  {
    title: 'Portapapeles e historial',
    items: [
      ['Ctrl / Cmd + C / X / V', 'Copiar, cortar y pegar (incluso entre cuadernos)'],
      ['Ctrl / Cmd + V (imagen)', 'Pegar imagen desde el portapapeles'],
      ['Ctrl / Cmd + D', 'Duplicar selección'],
      ['Ctrl / Cmd + Z', 'Deshacer (ilimitado)'],
      ['Ctrl / Cmd + Y / Shift+Z', 'Rehacer'],
      ['Ctrl / Cmd + F / H', 'Buscar y reemplazar texto'],
    ],
  },
  {
    title: 'Herramientas y vista',
    items: [
      ['V / P / E / T', 'Seleccionar / Pincel / Borrador / Texto'],
      ['Ctrl + Rueda / Pellizco', 'Zoom suave del lienzo'],
      ['Espacio + Arrastrar', 'Desplazar (Pan) por el lienzo'],
      ['Ctrl + 0', 'Ajustar página a la pantalla'],
    ],
  },
];

export const ShortcutsHelpModal: React.FC<ShortcutsHelpModalProps> = ({ open, onClose }) => {
  if (!open) return null;
  return (
    <div
      className="fixed inset-0 z-50 bg-black/40 backdrop-blur-[1px] flex items-center justify-center p-4"
      onClick={onClose}
    >
      <div
        role="dialog"
        aria-label="Atajos de teclado de Luma"
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[600px] max-h-[84vh] flex flex-col rounded-2xl border border-[var(--luma-border)] bg-[var(--luma-surface)] text-[var(--luma-ink)] shadow-2xl overflow-hidden"
      >
        <div className="px-5 py-3.5 border-b border-[var(--luma-border)] flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Keyboard className="w-4 h-4 text-[var(--luma-accent)]" />
            <span>Atajos de teclado · Estudio Luma</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            aria-label="Cerrar atajos"
            className="w-7 h-7 rounded-md flex items-center justify-center hover:bg-[var(--luma-surface-alt)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>
        <div className="p-5 overflow-y-auto space-y-5 text-xs">
          {SHORTCUT_GROUPS.map((group) => (
            <div key={group.title} className="space-y-2">
              <h3 className="font-semibold text-[var(--luma-ink)]">{group.title}</h3>
              <div className="divide-y divide-[var(--luma-border)] border border-[var(--luma-border)] rounded-xl overflow-hidden">
                {group.items.map(([keys, desc]) => (
                  <div
                    key={keys}
                    className="flex items-center justify-between gap-4 px-3 py-2 bg-[var(--luma-bg)]"
                  >
                    <span className="text-[var(--luma-ink-muted)]">{desc}</span>
                    <kbd className="font-mono text-[11px] font-semibold px-2 py-0.5 rounded border border-[var(--luma-border)] bg-[var(--luma-surface)] shrink-0">
                      {keys}
                    </kbd>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 3. Visual History Panel (Unlimited Undo / Redo Timeline)
 * ==========================================================================*/
interface HistoryPanelProps {
  past: HistorySnapshot[];
  future: HistorySnapshot[];
  onJumpToPast: (index: number) => void;
  onJumpToFuture: (index: number) => void;
}

export const HistoryPanel: React.FC<HistoryPanelProps> = ({
  past,
  future,
  onJumpToPast,
  onJumpToFuture,
}) => {
  const formatTime = (ts: number) =>
    new Date(ts).toLocaleTimeString('es-ES', {
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
    });

  return (
    <div className="space-y-3 text-xs">
      <div className="flex items-center justify-between">
        <span className="font-semibold text-[var(--luma-ink)]">Historial visual</span>
        <span className="font-mono text-[10px] tabular-nums text-[var(--luma-ink-muted)]">
          {past.length} pasos
        </span>
      </div>

      {past.length === 0 && future.length === 0 ? (
        <div className="py-8 px-3 text-center text-[11px] text-[var(--luma-ink-muted)] border border-dashed border-[var(--luma-border)] rounded-xl">
          <Clock className="w-5 h-5 mx-auto mb-1.5 opacity-50" />
          Tus ediciones aparecerán aquí con deshacer y rehacer ilimitados.
        </div>
      ) : (
        <div className="space-y-1">
          {future.length > 0 && (
            <div className="space-y-1 pb-2 border-b border-[var(--luma-border)]">
              <div className="text-[10px] text-[var(--luma-ink-muted)]">Deshecho (Rehacer)</div>
              {future.map((entry, idx) => (
                <button
                  key={entry.id}
                  type="button"
                  onClick={() => onJumpToFuture(idx)}
                  className="w-full px-2.5 py-1.5 rounded-lg border border-dashed border-[var(--luma-border)] bg-[var(--luma-bg)]/60 hover:bg-[var(--luma-surface-alt)] flex items-center justify-between text-left opacity-70 hover:opacity-100"
                >
                  <span className="truncate">{entry.label}</span>
                  <span className="font-mono text-[10px] tabular-nums shrink-0 ml-2">
                    {formatTime(entry.timestamp)}
                  </span>
                </button>
              ))}
            </div>
          )}

          <div className="px-2.5 py-1.5 rounded-lg border border-[var(--luma-accent)] bg-[var(--luma-accent-soft)] text-[var(--luma-accent)] font-semibold flex items-center justify-between">
            <span>Estado actual</span>
            <RotateCcw className="w-3 h-3" />
          </div>

          {[...past].reverse().map((entry, revIdx) => {
            const origIdx = past.length - 1 - revIdx;
            return (
              <button
                key={entry.id}
                type="button"
                onClick={() => onJumpToPast(origIdx)}
                className="w-full px-2.5 py-1.5 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)] flex items-center justify-between text-left"
              >
                <span className="truncate">{entry.label}</span>
                <span className="font-mono text-[10px] text-[var(--luma-ink-muted)] tabular-nums shrink-0 ml-2">
                  {formatTime(entry.timestamp)}
                </span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
};

/* ============================================================================
 * 4. Horizontal & Vertical Rulers (cm / inches)
 * ==========================================================================*/
interface PageRulersProps {
  geom: PageGeometry;
  zoom: number;
  unit: RulerUnit;
  marginsPx: { top: number; bottom: number; left: number; right: number };
}

export const HorizontalRuler: React.FC<PageRulersProps> = ({
  geom,
  zoom,
  unit,
  marginsPx,
}) => {
  const mmPerUnit = unit === 'in' ? 25.4 : 10;
  const totalUnits = Math.ceil(geom.mmW / mmPerUnit);
  const pxPerUnit = geom.pxPerMm * mmPerUnit * zoom;

  return (
    <div
      style={{ width: geom.w * zoom, height: 22 }}
      className="relative bg-[var(--luma-surface)] border border-[var(--luma-border)] rounded-t-md overflow-hidden select-none text-[9px] font-mono text-[var(--luma-ink-muted)]"
      aria-hidden="true"
    >
      {/* Margin shaded zones */}
      <div
        className="absolute top-0 bottom-0 left-0 bg-[var(--luma-accent)]/12"
        style={{ width: marginsPx.left * zoom }}
      />
      <div
        className="absolute top-0 bottom-0 right-0 bg-[var(--luma-accent)]/12"
        style={{ width: marginsPx.right * zoom }}
      />

      {Array.from({ length: totalUnits + 1 }).map((_, u) => {
        const left = u * pxPerUnit;
        if (left > geom.w * zoom) return null;
        return (
          <div key={u} style={{ left }} className="absolute top-0 bottom-0 flex flex-col">
            <div className="w-px h-2.5 bg-[var(--luma-ink-muted)]/60" />
            <span className="ml-0.5 leading-none">{u}</span>
          </div>
        );
      })}
    </div>
  );
};

export const VerticalRuler: React.FC<PageRulersProps> = ({
  geom,
  zoom,
  unit,
  marginsPx,
}) => {
  const mmPerUnit = unit === 'in' ? 25.4 : 10;
  const totalUnits = Math.ceil(geom.mmH / mmPerUnit);
  const pxPerUnit = geom.pxPerMm * mmPerUnit * zoom;

  return (
    <div
      style={{ width: 22, height: geom.h * zoom }}
      className="relative bg-[var(--luma-surface)] border border-[var(--luma-border)] rounded-l-md overflow-hidden select-none text-[9px] font-mono text-[var(--luma-ink-muted)] shrink-0"
      aria-hidden="true"
    >
      <div
        className="absolute left-0 right-0 top-0 bg-[var(--luma-accent)]/12"
        style={{ height: marginsPx.top * zoom }}
      />
      <div
        className="absolute left-0 right-0 bottom-0 bg-[var(--luma-accent)]/12"
        style={{ height: marginsPx.bottom * zoom }}
      />

      {Array.from({ length: totalUnits + 1 }).map((_, u) => {
        const top = u * pxPerUnit;
        if (top > geom.h * zoom) return null;
        return (
          <div key={u} style={{ top }} className="absolute left-0 right-0 flex items-start">
            <div className="h-px w-2 bg-[var(--luma-ink-muted)]/60" />
            <span className="leading-none pl-0.5">{u}</span>
          </div>
        );
      })}
    </div>
  );
};
