import React, { useEffect, useRef, useState } from 'react';
import {
  Eraser,
  PaintBucket,
  PenTool,
  Pipette,
  Plus,
  RotateCcw,
  Trash2,
} from 'lucide-react';
import { BrushTipType, CanvasTool, LineStyleType } from '../types';
import {
  BRUSH_TIPS,
  BrushPresetConfig,
  DEFAULT_BRUSH_PRESETS,
  DEFAULT_ERASER_SETTINGS,
  DEFAULT_FILL_SETTINGS,
  DrawingToolsState,
  EraserSettings,
  FillSettings,
  renderBrushPreview,
  renderEraserPreview,
} from './brushEngine';
import {
  loadRecentColors,
  loadSavedPalette,
  pushRecentColor,
  savePaletteColors,
} from '../utils/notebookStorage';

interface BrushPanelProps {
  tool: CanvasTool;
  toolsState: DrawingToolsState;
  lastPressure: number;
  onSelectBrushTip: (tip: BrushTipType) => void;
  onUpdateActiveBrush: (patch: Partial<BrushPresetConfig>) => void;
  onUpdateEraser: (patch: Partial<EraserSettings>) => void;
  onUpdateFill: (patch: Partial<FillSettings>) => void;
}

export const BrushPanel: React.FC<BrushPanelProps> = ({
  tool,
  toolsState,
  lastPressure,
  onSelectBrushTip,
  onUpdateActiveBrush,
  onUpdateEraser,
  onUpdateFill,
}) => {
  const brushPreviewRef = useRef<HTMLCanvasElement>(null);
  const eraserPreviewRef = useRef<HTMLCanvasElement>(null);
  const [recentColors, setRecentColors] = useState<string[]>(() => loadRecentColors());
  const [savedPalette, setSavedPalette] = useState<string[]>(() => loadSavedPalette());
  const [eyedropperNotice, setEyedropperNotice] = useState<string | null>(null);

  const activeTip = toolsState.activeTip;
  const activeBrush = toolsState.brushes[activeTip];
  const eraser = toolsState.eraser;
  const fill = toolsState.fill;

  useEffect(() => {
    if ((tool === 'pen' || tool === 'highlighter') && brushPreviewRef.current) {
      renderBrushPreview(brushPreviewRef.current, activeTip, activeBrush);
    }
  }, [tool, activeTip, activeBrush]);

  useEffect(() => {
    if (tool === 'eraser' && eraserPreviewRef.current) {
      renderEraserPreview(eraserPreviewRef.current, eraser);
    }
  }, [tool, eraser]);

  const applyColor = (color: string, target: 'brush' | 'fill') => {
    if (target === 'brush') {
      onUpdateActiveBrush({ color });
    } else {
      onUpdateFill({ color });
    }
    setRecentColors(pushRecentColor(color));
  };

  const handleEyedropper = async (target: 'brush' | 'fill') => {
    setEyedropperNotice(null);
    const EyeDropperCtor = (window as unknown as {
      EyeDropper?: new () => { open: () => Promise<{ sRGBHex: string }> };
    }).EyeDropper;

    if (EyeDropperCtor) {
      try {
        const dropper = new EyeDropperCtor();
        const res = await dropper.open();
        if (res?.sRGBHex) {
          applyColor(res.sRGBHex, target);
        }
        return;
      } catch {
        return;
      }
    }
    setEyedropperNotice('Tu navegador no soporta EyeDropper nativo; usa el selector de color.');
  };

  const addCurrentToPalette = (hex: string) => {
    const upper = hex.toUpperCase();
    if (savedPalette.some((c) => c.toUpperCase() === upper)) return;
    const next = [...savedPalette, upper];
    setSavedPalette(next);
    savePaletteColors(next);
  };

  const removeFromPalette = (hex: string) => {
    if (savedPalette.length <= 4) return;
    const next = savedPalette.filter((c) => c.toUpperCase() !== hex.toUpperCase());
    setSavedPalette(next);
    savePaletteColors(next);
  };

  const renderColorSection = (currentColor: string, target: 'brush' | 'fill') => (
    <div className="space-y-2.5 pt-2 border-t border-[var(--luma-border)]">
      <div className="flex items-center justify-between gap-2">
        <span className="text-[11px] font-semibold text-[var(--luma-ink-muted)]">Color</span>
        <div className="flex items-center gap-1.5">
          <label className="flex items-center gap-1.5 h-7 px-2 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-bg)] cursor-pointer">
            <input
              type="color"
              value={currentColor}
              onChange={(e) => applyColor(e.target.value, target)}
              aria-label="Elegir color personalizado"
              className="w-4 h-4 rounded cursor-pointer border-0 bg-transparent p-0"
            />
            <span className="font-mono text-[10px] uppercase">{currentColor}</span>
          </label>
          <button
            type="button"
            onClick={() => void handleEyedropper(target)}
            title="Cuentagotas (capturar color de pantalla)"
            aria-label="Cuentagotas"
            className="h-7 w-7 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)] flex items-center justify-center"
          >
            <Pipette className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
      {eyedropperNotice && (
        <p className="text-[10px] text-[var(--luma-ink-muted)]">{eyedropperNotice}</p>
      )}

      {recentColors.length > 0 && (
        <div>
          <div className="text-[10px] text-[var(--luma-ink-muted)] mb-1">Recientes</div>
          <div className="flex flex-wrap gap-1.5">
            {recentColors.slice(0, 8).map((hex) => (
              <button
                key={hex}
                type="button"
                onClick={() => applyColor(hex, target)}
                title={hex}
                aria-label={`Color reciente ${hex}`}
                className={`w-5 h-5 rounded-md border transition-transform ${
                  currentColor.toUpperCase() === hex.toUpperCase()
                    ? 'ring-2 ring-[var(--luma-accent)] scale-110'
                    : 'border-black/20'
                }`}
                style={{ backgroundColor: hex }}
              />
            ))}
          </div>
        </div>
      )}

      <div>
        <div className="flex items-center justify-between mb-1">
          <span className="text-[10px] text-[var(--luma-ink-muted)]">Paleta guardada</span>
          <button
            type="button"
            onClick={() => addCurrentToPalette(currentColor)}
            className="text-[10px] font-semibold text-[var(--luma-accent)] hover:underline inline-flex items-center gap-0.5"
          >
            <Plus className="w-3 h-3" />
            Guardar color
          </button>
        </div>
        <div className="grid grid-cols-6 gap-1.5">
          {savedPalette.map((hex) => (
            <div key={hex} className="group relative">
              <button
                type="button"
                onClick={() => applyColor(hex, target)}
                title={hex}
                aria-label={`Color guardado ${hex}`}
                className={`w-full h-6 rounded-md border transition-transform ${
                  currentColor.toUpperCase() === hex.toUpperCase()
                    ? 'ring-2 ring-[var(--luma-accent)] scale-105'
                    : 'border-black/15'
                }`}
                style={{ backgroundColor: hex }}
              />
              {savedPalette.length > 4 && (
                <button
                  type="button"
                  onClick={() => removeFromPalette(hex)}
                  title="Quitar de paleta"
                  className="absolute -top-1 -right-1 w-3.5 h-3.5 rounded-full bg-neutral-900 text-white hidden group-hover:flex items-center justify-center"
                >
                  <Trash2 className="w-2 h-2" />
                </button>
              )}
            </div>
          ))}
        </div>
      </div>
    </div>
  );

  /* ==========================================================================
   * 1. DEDICATED ERASER PANEL (ONLY Eraser controls — never mixed with brushes)
   * ========================================================================*/
  if (tool === 'eraser') {
    return (
      <div className="space-y-4 text-xs">
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--luma-border)]">
          <div className="flex items-center gap-2 font-bold text-[var(--luma-ink)]">
            <Eraser className="w-4 h-4 text-[var(--luma-accent)]" />
            <span>Configuración de Borrador</span>
          </div>
          <button
            type="button"
            onClick={() => onUpdateEraser(DEFAULT_ERASER_SETTINGS)}
            title="Restablecer borrador"
            className="h-6 px-1.5 rounded-md text-[10px] text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)] hover:bg-[var(--luma-surface-alt)] inline-flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>

        {/* Live Circular Eraser Preview */}
        <div>
          <div className="flex items-center justify-between mb-1.5">
            <span className="text-[11px] font-semibold text-[var(--luma-ink-muted)]">
              Área de borrado
            </span>
            <span className="font-mono text-[11px] tabular-nums text-[var(--luma-ink-muted)]">
              Ø {eraser.size}px · {Math.round(eraser.opacity * 100)}%
            </span>
          </div>
          <div className="rounded-xl border border-[var(--luma-border)] bg-white overflow-hidden">
            <canvas
              ref={eraserPreviewRef}
              className="w-full h-[74px] block"
              aria-label="Vista previa del área circular del borrador"
            />
          </div>
        </div>

        {/* 2 Dedicated Eraser Modes */}
        <div className="space-y-2">
          <div className="text-[11px] font-semibold text-[var(--luma-ink-muted)]">
            Tipo de borrado
          </div>
          <button
            type="button"
            onClick={() => onUpdateEraser({ mode: 'pixel' })}
            className={`w-full p-2.5 rounded-xl border text-left transition-colors ${
              eraser.mode === 'pixel'
                ? 'border-[var(--luma-accent)] bg-[var(--luma-accent-soft)]'
                : 'border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)]'
            }`}
          >
            <div
              className={`text-xs font-bold ${
                eraser.mode === 'pixel' ? 'text-[var(--luma-accent)]' : 'text-[var(--luma-ink)]'
              }`}
            >
              Pintura transparente (Preciso)
            </div>
            <p className="text-[10px] text-[var(--luma-ink-muted)] mt-0.5 leading-snug">
              Borra únicamente lo que cubre el círculo del puntero sobre los dibujos sin tocar el papel.
            </p>
          </button>

          <button
            type="button"
            onClick={() => onUpdateEraser({ mode: 'stroke' })}
            className={`w-full p-2.5 rounded-xl border text-left transition-colors ${
              eraser.mode === 'stroke'
                ? 'border-[var(--luma-accent)] bg-[var(--luma-accent-soft)]'
                : 'border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)]'
            }`}
          >
            <div
              className={`text-xs font-bold ${
                eraser.mode === 'stroke' ? 'text-[var(--luma-accent)]' : 'text-[var(--luma-ink)]'
              }`}
            >
              Borrar trazo completo
            </div>
            <p className="text-[10px] text-[var(--luma-ink-muted)] mt-0.5 leading-snug">
              Cualquier dibujo que toque el círculo se elimina por completo al instante.
            </p>
          </button>
        </div>

        {/* Independent Eraser Sliders (Size, Opacity/Strength, Edge Hardness) */}
        <div className="space-y-3 pt-2 border-t border-[var(--luma-border)]">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="luma-eraser-size" className="text-[11px] font-medium">
                Tamaño del círculo
              </label>
              <div className="flex items-center gap-1">
                <input
                  type="number"
                  min={6}
                  max={120}
                  value={eraser.size}
                  onChange={(e) =>
                    onUpdateEraser({
                      size: Math.max(6, Math.min(120, Number(e.target.value) || 6)),
                    })
                  }
                  aria-label="Tamaño numérico del borrador"
                  className="w-12 h-6 px-1.5 rounded border border-[var(--luma-border)] bg-[var(--luma-bg)] text-right font-mono text-[11px] tabular-nums"
                />
                <span className="text-[10px] text-[var(--luma-ink-muted)]">px</span>
              </div>
            </div>
            <input
              id="luma-eraser-size"
              type="range"
              min={6}
              max={120}
              step={1}
              value={eraser.size}
              onChange={(e) => onUpdateEraser({ size: Number(e.target.value) })}
              className="w-full accent-[var(--luma-accent)]"
            />
          </div>

          {eraser.mode === 'pixel' && (
            <>
              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="luma-eraser-opacity" className="text-[11px] font-medium">
                    Opacidad / Fuerza
                  </label>
                  <span className="font-mono text-[11px] tabular-nums text-[var(--luma-ink-muted)]">
                    {Math.round(eraser.opacity * 100)}%
                  </span>
                </div>
                <input
                  id="luma-eraser-opacity"
                  type="range"
                  min={10}
                  max={100}
                  value={Math.round(eraser.opacity * 100)}
                  onChange={(e) => onUpdateEraser({ opacity: Number(e.target.value) / 100 })}
                  className="w-full accent-[var(--luma-accent)]"
                />
              </div>

              <div>
                <div className="flex items-center justify-between mb-1">
                  <label htmlFor="luma-eraser-hardness" className="text-[11px] font-medium">
                    Dureza del borde
                  </label>
                  <span className="font-mono text-[11px] tabular-nums text-[var(--luma-ink-muted)]">
                    {eraser.hardness}%
                  </span>
                </div>
                <input
                  id="luma-eraser-hardness"
                  type="range"
                  min={0}
                  max={100}
                  value={eraser.hardness}
                  onChange={(e) => onUpdateEraser({ hardness: Number(e.target.value) })}
                  className="w-full accent-[var(--luma-accent)]"
                />
              </div>
            </>
          )}
        </div>
      </div>
    );
  }

  /* ==========================================================================
   * 2. DEDICATED FILL BUCKET PANEL (ONLY Fill controls — independent from brush)
   * ========================================================================*/
  if (tool === 'fill') {
    return (
      <div className="space-y-4 text-xs">
        <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--luma-border)]">
          <div className="flex items-center gap-2 font-bold text-[var(--luma-ink)]">
            <PaintBucket className="w-4 h-4 text-[var(--luma-accent)]" />
            <span>Configuración de Relleno</span>
          </div>
          <button
            type="button"
            onClick={() => onUpdateFill(DEFAULT_FILL_SETTINGS)}
            title="Restablecer relleno"
            className="h-6 px-1.5 rounded-md text-[10px] text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)] hover:bg-[var(--luma-surface-alt)] inline-flex items-center gap-1"
          >
            <RotateCcw className="w-3 h-3" />
          </button>
        </div>

        {/* Live Fill Color Preview */}
        <div className="rounded-xl border border-[var(--luma-border)] p-3 bg-[var(--luma-bg)] flex items-center gap-3">
          <div
            className="w-12 h-12 rounded-lg border border-black/15 shrink-0 shadow-inner"
            style={{ backgroundColor: fill.color, opacity: fill.opacity }}
          />
          <div className="min-w-0">
            <div className="font-semibold text-[var(--luma-ink)]">Bote de pintura</div>
            <div className="text-[11px] text-[var(--luma-ink-muted)] mt-0.5">
              Toca cualquier área cerrada en la hoja para rellenarla.
            </div>
          </div>
        </div>

        {renderColorSection(fill.color, 'fill')}

        <div className="space-y-3 pt-2 border-t border-[var(--luma-border)]">
          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="luma-fill-opacity" className="text-[11px] font-medium">
                Opacidad del relleno
              </label>
              <span className="font-mono text-[11px] tabular-nums text-[var(--luma-ink-muted)]">
                {Math.round(fill.opacity * 100)}%
              </span>
            </div>
            <input
              id="luma-fill-opacity"
              type="range"
              min={5}
              max={100}
              value={Math.round(fill.opacity * 100)}
              onChange={(e) => onUpdateFill({ opacity: Number(e.target.value) / 100 })}
              className="w-full accent-[var(--luma-accent)]"
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1">
              <label htmlFor="luma-fill-tol" className="text-[11px] font-medium">
                Tolerancia de bordes
              </label>
              <span className="font-mono text-[11px] tabular-nums text-[var(--luma-ink-muted)]">
                {fill.tolerance}
              </span>
            </div>
            <input
              id="luma-fill-tol"
              type="range"
              min={0}
              max={120}
              value={fill.tolerance}
              onChange={(e) => onUpdateFill({ tolerance: Number(e.target.value) })}
              className="w-full accent-[var(--luma-accent)]"
            />
          </div>
        </div>
      </div>
    );
  }

  /* ==========================================================================
   * 3. DEDICATED BRUSHES PANEL (Each of the 7 tips keeps its OWN saved profile!)
   * ========================================================================*/
  const activeTipMeta = BRUSH_TIPS.find((b) => b.id === activeTip) ?? BRUSH_TIPS[0];

  return (
    <div className="space-y-4 text-xs">
      <div className="flex items-center justify-between gap-2 pb-2 border-b border-[var(--luma-border)]">
        <div className="flex items-center gap-2 font-bold text-[var(--luma-ink)] min-w-0">
          <PenTool className="w-4 h-4 text-[var(--luma-accent)] shrink-0" />
          <span className="truncate">Pincel · {activeTipMeta.label}</span>
        </div>
        <button
          type="button"
          onClick={() => onUpdateActiveBrush(DEFAULT_BRUSH_PRESETS[activeTip])}
          title={`Restablecer ${activeTipMeta.label}`}
          className="h-6 px-1.5 rounded-md text-[10px] text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)] hover:bg-[var(--luma-surface-alt)] inline-flex items-center gap-1 shrink-0"
        >
          <RotateCcw className="w-3 h-3" />
        </button>
      </div>

      {/* Live Stroke Preview for THIS specific brush */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-semibold text-[var(--luma-ink-muted)]">
            Vista previa · {activeTipMeta.label}
          </span>
          <span className="font-mono text-[11px] tabular-nums text-[var(--luma-ink-muted)]">
            {activeBrush.size}px · {Math.round(activeBrush.opacity * 100)}%
          </span>
        </div>
        <div className="rounded-xl border border-[var(--luma-border)] bg-white overflow-hidden">
          <canvas
            ref={brushPreviewRef}
            className="w-full h-[68px] block"
            aria-label={`Vista previa de ${activeTipMeta.label}`}
          />
        </div>
      </div>

      {/* 7 Independent Brush Profiles (each shows its own saved color dot & size!) */}
      <div>
        <div className="flex items-center justify-between mb-1.5">
          <span className="text-[11px] font-semibold text-[var(--luma-ink-muted)]">
            Pinceles (configuración individual)
          </span>
        </div>
        <div className="grid grid-cols-2 gap-1.5">
          {BRUSH_TIPS.map((item) => {
            const active = activeTip === item.id;
            const cfg = toolsState.brushes[item.id];
            return (
              <button
                key={item.id}
                type="button"
                onClick={() => onSelectBrushTip(item.id)}
                title={item.desc}
                className={`px-2 py-1.5 rounded-lg border text-left transition-colors ${
                  active
                    ? 'border-[var(--luma-accent)] bg-[var(--luma-accent-soft)] text-[var(--luma-accent)] font-semibold'
                    : 'border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)]'
                }`}
              >
                <div className="flex items-center justify-between gap-1">
                  <span className="text-[11px] truncate">{item.label}</span>
                  <span
                    className="w-2.5 h-2.5 rounded-full border border-black/20 shrink-0"
                    style={{ backgroundColor: cfg.color, opacity: Math.max(0.35, cfg.opacity) }}
                  />
                </div>
                <div className="text-[9px] text-[var(--luma-ink-muted)] font-mono tabular-nums mt-0.5">
                  {cfg.size}px · {Math.round(cfg.opacity * 100)}%
                </div>
              </button>
            );
          })}
        </div>
      </div>

      {/* Color Picker (isolated to active brush!) */}
      {renderColorSection(activeBrush.color, 'brush')}

      {/* Independent Sliders for THIS brush */}
      <div className="space-y-3 pt-2 border-t border-[var(--luma-border)]">
        {/* Size */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="luma-brush-size" className="text-[11px] font-medium">
              Grosor ({activeTipMeta.label})
            </label>
            <div className="flex items-center gap-1">
              <input
                type="number"
                min={1}
                max={80}
                value={activeBrush.size}
                onChange={(e) =>
                  onUpdateActiveBrush({
                    size: Math.max(1, Math.min(80, Number(e.target.value) || 1)),
                  })
                }
                aria-label="Valor numérico de grosor"
                className="w-12 h-6 px-1.5 rounded border border-[var(--luma-border)] bg-[var(--luma-bg)] text-right font-mono text-[11px] tabular-nums"
              />
              <span className="text-[10px] text-[var(--luma-ink-muted)]">px</span>
            </div>
          </div>
          <input
            id="luma-brush-size"
            type="range"
            min={1}
            max={80}
            step={0.5}
            value={activeBrush.size}
            onChange={(e) => onUpdateActiveBrush({ size: Number(e.target.value) })}
            className="w-full accent-[var(--luma-accent)]"
          />
        </div>

        {/* Opacity */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="luma-brush-opacity" className="text-[11px] font-medium">
              Opacidad
            </label>
            <span className="font-mono text-[11px] tabular-nums text-[var(--luma-ink-muted)]">
              {Math.round(activeBrush.opacity * 100)}%
            </span>
          </div>
          <input
            id="luma-brush-opacity"
            type="range"
            min={5}
            max={100}
            value={Math.round(activeBrush.opacity * 100)}
            onChange={(e) => onUpdateActiveBrush({ opacity: Number(e.target.value) / 100 })}
            className="w-full accent-[var(--luma-accent)]"
          />
        </div>

        {/* Hardness */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="luma-brush-hardness" className="text-[11px] font-medium">
              Dureza
            </label>
            <span className="font-mono text-[11px] tabular-nums text-[var(--luma-ink-muted)]">
              {activeBrush.hardness}%
            </span>
          </div>
          <input
            id="luma-brush-hardness"
            type="range"
            min={0}
            max={100}
            value={activeBrush.hardness}
            onChange={(e) => onUpdateActiveBrush({ hardness: Number(e.target.value) })}
            className="w-full accent-[var(--luma-accent)]"
          />
        </div>

        {/* Stabilizer / Smoothing */}
        <div>
          <div className="flex items-center justify-between mb-1">
            <label htmlFor="luma-brush-smooth" className="text-[11px] font-medium">
              Estabilizador / Suavizado
            </label>
            <span className="font-mono text-[11px] tabular-nums text-[var(--luma-ink-muted)]">
              {activeBrush.smoothing}%
            </span>
          </div>
          <input
            id="luma-brush-smooth"
            type="range"
            min={0}
            max={100}
            value={activeBrush.smoothing}
            onChange={(e) => onUpdateActiveBrush({ smoothing: Number(e.target.value) })}
            className="w-full accent-[var(--luma-accent)]"
          />
        </div>

        {/* Line Style */}
        <div>
          <div className="text-[11px] font-medium mb-1">Estilo de línea</div>
          <div className="grid grid-cols-3 gap-1">
            {(
              [
                { id: 'solid', label: 'Continua' },
                { id: 'dashed', label: 'Discontinua' },
                { id: 'dotted', label: 'Punteada' },
              ] as Array<{ id: LineStyleType; label: string }>
            ).map((ls) => (
              <button
                key={ls.id}
                type="button"
                onClick={() => onUpdateActiveBrush({ lineStyle: ls.id })}
                className={`h-7 rounded-md border text-[11px] transition-colors ${
                  activeBrush.lineStyle === ls.id
                    ? 'border-[var(--luma-accent)] bg-[var(--luma-accent-soft)] text-[var(--luma-accent)] font-semibold'
                    : 'border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)]'
                }`}
              >
                {ls.label}
              </button>
            ))}
          </div>
        </div>

        {/* Pressure Sensitivity */}
        <label className="flex items-center justify-between gap-2 pt-1 cursor-pointer">
          <div>
            <div className="text-[11px] font-medium">Sensibilidad a la presión</div>
            <div className="text-[10px] text-[var(--luma-ink-muted)] tabular-nums">
              Lápiz óptico · Presión: {Math.round(lastPressure * 100)}%
            </div>
          </div>
          <input
            type="checkbox"
            checked={activeBrush.pressureEnabled}
            onChange={(e) => onUpdateActiveBrush({ pressureEnabled: e.target.checked })}
            className="w-4 h-4 accent-[var(--luma-accent)]"
          />
        </label>
      </div>
    </div>
  );
};
