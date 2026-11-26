import React from 'react';
import {
  MarginPreset,
  NotebookPage,
  NotebookPageSetup,
  NotebookPageSize,
  NotebookPaperPattern,
  RulerUnit,
} from '../types';
import { MARGIN_PRESETS_MM } from './pageGeometry';

interface PageSetupPanelProps {
  pageSize: NotebookPageSize;
  setup: NotebookPageSetup;
  page: NotebookPage;
  onChangePageSize: (size: NotebookPageSize) => void;
  onUpdateSetup: (patch: Partial<NotebookPageSetup>) => void;
  onUpdatePage: (patch: Partial<NotebookPage>) => void;
  onInsertPageBreak: () => void;
}

const PAPER_SIZES: Array<{ id: NotebookPageSize; label: string }> = [
  { id: 'A4', label: 'A4' },
  { id: 'A3', label: 'A3' },
  { id: 'A5', label: 'A5' },
  { id: 'LETTER', label: 'Carta' },
  { id: 'LEGAL', label: 'Oficio' },
  { id: 'WIDE_16_9', label: '16:9' },
  { id: 'SQUARE', label: 'Cuadrado' },
  { id: 'CUSTOM', label: 'Personalizado' },
];

const PATTERNS: Array<{ id: NotebookPaperPattern; label: string }> = [
  { id: 'blank', label: 'Blanco' },
  { id: 'ruled', label: 'Rayado' },
  { id: 'grid', label: 'Cuadrícula' },
  { id: 'dotted', label: 'Puntos' },
  { id: 'cornell', label: 'Cornell' },
];

const PAGE_BG_SWATCHES = ['#FFFFFF', '#FAF6EE', '#F4EFE4', '#F0F6FC', '#F1F7F4', '#1E2430'];

export const PageSetupPanel: React.FC<PageSetupPanelProps> = ({
  pageSize,
  setup,
  page,
  onChangePageSize,
  onUpdateSetup,
  onUpdatePage,
  onInsertPageBreak,
}) => {
  const unitFactor = setup.rulerUnit === 'in' ? 25.4 : 10; // mm per unit
  const unitLabel = setup.rulerUnit === 'in' ? 'in' : 'cm';

  const toDisplayUnit = (mm: number) => Number((mm / unitFactor).toFixed(2));
  const fromDisplayUnit = (val: number) => Math.max(0, Math.min(120, val * unitFactor));

  const applyMarginPreset = (preset: MarginPreset) => {
    if (preset === 'custom') {
      onUpdateSetup({ marginPreset: 'custom' });
      return;
    }
    const m = MARGIN_PRESETS_MM[preset];
    onUpdateSetup({
      marginPreset: preset,
      marginsMm: { top: m.top, bottom: m.bottom, left: m.left, right: m.right },
    });
  };

  return (
    <div className="space-y-4 text-xs">
      {/* Page Size & Orientation */}
      <div className="space-y-2">
        <div className="font-semibold text-[var(--luma-ink)]">Tamaño y orientación</div>
        <div className="grid grid-cols-2 gap-1.5">
          <button
            type="button"
            onClick={() => onUpdateSetup({ orientation: 'portrait' })}
            className={`h-8 rounded-lg border font-medium ${
              setup.orientation === 'portrait'
                ? 'border-[var(--luma-accent)] bg-[var(--luma-accent-soft)] text-[var(--luma-accent)]'
                : 'border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)]'
            }`}
          >
            Vertical
          </button>
          <button
            type="button"
            onClick={() => onUpdateSetup({ orientation: 'landscape' })}
            className={`h-8 rounded-lg border font-medium ${
              setup.orientation === 'landscape'
                ? 'border-[var(--luma-accent)] bg-[var(--luma-accent-soft)] text-[var(--luma-accent)]'
                : 'border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)]'
            }`}
          >
            Horizontal
          </button>
        </div>

        <div className="grid grid-cols-2 gap-1.5">
          {PAPER_SIZES.map((s) => (
            <button
              key={s.id}
              type="button"
              onClick={() => onChangePageSize(s.id)}
              className={`h-7 px-2 rounded-lg border text-[11px] truncate ${
                pageSize === s.id
                  ? 'border-[var(--luma-accent)] bg-[var(--luma-accent-soft)] text-[var(--luma-accent)] font-semibold'
                  : 'border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)]'
              }`}
            >
              {s.label}
            </button>
          ))}
        </div>

        {pageSize === 'CUSTOM' && (
          <div className="grid grid-cols-2 gap-2 pt-1">
            <label className="space-y-1">
              <span className="text-[10px] text-[var(--luma-ink-muted)]">Ancho (mm)</span>
              <input
                type="number"
                min={80}
                max={600}
                value={Math.round(setup.customWidthMm)}
                onChange={(e) =>
                  onUpdateSetup({ customWidthMm: Number(e.target.value) || 210 })
                }
                className="w-full h-7 px-2 rounded border border-[var(--luma-border)] bg-[var(--luma-bg)] font-mono tabular-nums"
              />
            </label>
            <label className="space-y-1">
              <span className="text-[10px] text-[var(--luma-ink-muted)]">Alto (mm)</span>
              <input
                type="number"
                min={80}
                max={600}
                value={Math.round(setup.customHeightMm)}
                onChange={(e) =>
                  onUpdateSetup({ customHeightMm: Number(e.target.value) || 297 })
                }
                className="w-full h-7 px-2 rounded border border-[var(--luma-border)] bg-[var(--luma-bg)] font-mono tabular-nums"
              />
            </label>
          </div>
        )}
      </div>

      {/* Margins (Word presets + Custom numeric) */}
      <div className="space-y-2 pt-2 border-t border-[var(--luma-border)]">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-[var(--luma-ink)]">Márgenes ({unitLabel})</span>
          <div className="flex items-center gap-1">
            {(['cm', 'in'] as RulerUnit[]).map((u) => (
              <button
                key={u}
                type="button"
                onClick={() => onUpdateSetup({ rulerUnit: u })}
                className={`px-1.5 py-0.5 rounded text-[10px] font-semibold ${
                  setup.rulerUnit === u
                    ? 'bg-[var(--luma-accent)] text-[var(--luma-on-accent)]'
                    : 'bg-[var(--luma-bg)] text-[var(--luma-ink-muted)]'
                }`}
              >
                {u === 'in' ? 'pulg.' : 'cm'}
              </button>
            ))}
          </div>
        </div>

        <select
          value={setup.marginPreset}
          onChange={(e) => applyMarginPreset(e.target.value as MarginPreset)}
          aria-label="Preajuste de márgenes"
          className="w-full h-8 px-2 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-bg)] text-xs outline-none"
        >
          <option value="normal">Normal (2.54 cm)</option>
          <option value="narrow">Estrecho (1.27 cm)</option>
          <option value="moderate">Moderado (2.54 / 1.91 cm)</option>
          <option value="wide">Ancho (2.54 / 5.08 cm)</option>
          <option value="custom">Personalizado</option>
        </select>

        <div className="grid grid-cols-2 gap-1.5">
          {(
            [
              { key: 'top', label: 'Superior' },
              { key: 'bottom', label: 'Inferior' },
              { key: 'left', label: 'Izquierdo' },
              { key: 'right', label: 'Derecho' },
            ] as const
          ).map((m) => (
            <label key={m.key} className="space-y-0.5">
              <span className="text-[10px] text-[var(--luma-ink-muted)]">{m.label}</span>
              <input
                type="number"
                step={0.1}
                min={0}
                max={10}
                value={toDisplayUnit(setup.marginsMm[m.key])}
                onChange={(e) =>
                  onUpdateSetup({
                    marginPreset: 'custom',
                    marginsMm: {
                      ...setup.marginsMm,
                      [m.key]: fromDisplayUnit(Number(e.target.value) || 0),
                    },
                  })
                }
                className="w-full h-7 px-2 rounded border border-[var(--luma-border)] bg-[var(--luma-bg)] font-mono text-[11px] tabular-nums"
              />
            </label>
          ))}
        </div>
      </div>

      {/* Columns, Indent, Header, Footer, Page Numbers */}
      <div className="space-y-2.5 pt-2 border-t border-[var(--luma-border)]">
        <div className="font-semibold text-[var(--luma-ink)]">Texto, columnas y sangría</div>
        <div className="grid grid-cols-3 gap-1">
          {([1, 2, 3] as const).map((cols) => (
            <button
              key={cols}
              type="button"
              onClick={() => onUpdateSetup({ columns: cols })}
              className={`h-7 rounded-md border text-[11px] ${
                setup.columns === cols
                  ? 'border-[var(--luma-accent)] bg-[var(--luma-accent-soft)] text-[var(--luma-accent)] font-semibold'
                  : 'border-[var(--luma-border)] bg-[var(--luma-bg)]'
              }`}
            >
              {cols} {cols === 1 ? 'col.' : 'cols.'}
            </button>
          ))}
        </div>

        <div>
          <div className="flex items-center justify-between text-[11px] mb-1">
            <span>Sangría</span>
            <span className="font-mono tabular-nums text-[var(--luma-ink-muted)]">
              {toDisplayUnit(setup.indentMm)} {unitLabel}
            </span>
          </div>
          <input
            type="range"
            min={0}
            max={40}
            value={setup.indentMm}
            onChange={(e) => onUpdateSetup({ indentMm: Number(e.target.value) })}
            className="w-full accent-[var(--luma-accent)]"
          />
        </div>

        <input
          value={setup.headerText}
          onChange={(e) => onUpdateSetup({ headerText: e.target.value })}
          placeholder="Encabezado de página..."
          aria-label="Encabezado de página"
          className="w-full h-8 px-2.5 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-bg)] text-xs outline-none focus:border-[var(--luma-accent)]"
        />
        <input
          value={setup.footerText}
          onChange={(e) => onUpdateSetup({ footerText: e.target.value })}
          placeholder="Pie de página..."
          aria-label="Pie de página"
          className="w-full h-8 px-2.5 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-bg)] text-xs outline-none focus:border-[var(--luma-accent)]"
        />

        <label className="flex items-center justify-between cursor-pointer">
          <span className="text-[11px]">Numeración de páginas</span>
          <input
            type="checkbox"
            checked={setup.showPageNumbers}
            onChange={(e) => onUpdateSetup({ showPageNumbers: e.target.checked })}
            className="w-4 h-4 accent-[var(--luma-accent)]"
          />
        </label>

        <button
          type="button"
          onClick={onInsertPageBreak}
          className="w-full h-8 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)] font-medium text-[11px]"
        >
          + Insertar salto de página
        </button>
      </div>

      {/* Guides & Background */}
      <div className="space-y-2 pt-2 border-t border-[var(--luma-border)]">
        <div className="font-semibold text-[var(--luma-ink)]">Fondo de hoja y guías</div>
        <div className="grid grid-cols-3 gap-1">
          {PATTERNS.map((pat) => (
            <button
              key={pat.id}
              type="button"
              onClick={() => onUpdatePage({ pattern: pat.id })}
              className={`h-7 rounded-md border text-[11px] ${
                page.pattern === pat.id
                  ? 'border-[var(--luma-accent)] bg-[var(--luma-accent-soft)] text-[var(--luma-accent)] font-semibold'
                  : 'border-[var(--luma-border)] bg-[var(--luma-bg)]'
              }`}
            >
              {pat.label}
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1.5 pt-1">
          {PAGE_BG_SWATCHES.map((hex) => (
            <button
              key={hex}
              type="button"
              onClick={() => onUpdatePage({ backgroundColor: hex })}
              title={`Color de papel ${hex}`}
              className={`w-6 h-6 rounded-md border ${
                page.backgroundColor.toUpperCase() === hex
                  ? 'ring-2 ring-[var(--luma-accent)]'
                  : 'border-black/20'
              }`}
              style={{ backgroundColor: hex }}
            />
          ))}
          <input
            type="color"
            value={page.backgroundColor || '#FFFFFF'}
            onChange={(e) => onUpdatePage({ backgroundColor: e.target.value })}
            aria-label="Color de fondo personalizado"
            className="w-6 h-6 rounded cursor-pointer border border-[var(--luma-border)] bg-transparent p-0"
          />
        </div>

        <div className="space-y-1.5 pt-1">
          {(
            [
              { key: 'showRulers', label: 'Reglas (horizontal y vertical)' },
              { key: 'showMarginGuides', label: 'Guías visibles de márgenes' },
              { key: 'showGrid', label: 'Cuadrícula magnética' },
              { key: 'snapEnabled', label: 'Guías inteligentes (Snap)' },
            ] as const
          ).map((toggle) => (
            <label key={toggle.key} className="flex items-center justify-between cursor-pointer">
              <span className="text-[11px]">{toggle.label}</span>
              <input
                type="checkbox"
                checked={setup[toggle.key]}
                onChange={(e) => onUpdateSetup({ [toggle.key]: e.target.checked })}
                className="w-4 h-4 accent-[var(--luma-accent)]"
              />
            </label>
          ))}
        </div>
      </div>
    </div>
  );
};
