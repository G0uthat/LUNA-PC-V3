import React, { useState } from 'react';
import {
  ArrowDown,
  ArrowDownToLine,
  ArrowUp,
  ArrowUpToLine,
  Copy,
  Eye,
  EyeOff,
  Group,
  Image as ImageIcon,
  Lock,
  PenTool,
  Shapes,
  StickyNote,
  Table2,
  Trash2,
  Type,
  Ungroup,
  Unlock,
} from 'lucide-react';
import { CanvasObject, LayerBlendMode } from '../types';
import { getLayerDisplayName, getObjectKindLabel } from './pageGeometry';

interface LayersPanelProps {
  objects: CanvasObject[];
  selectedIds: string[];
  onSelectIds: (ids: string[]) => void;
  onUpdateObject: (id: string, patch: Partial<CanvasObject>, recordUndo?: boolean) => void;
  onReorderObjects: (nextOrder: CanvasObject[], label: string) => void;
  onDuplicateSelected: () => void;
  onDeleteSelected: () => void;
  onGroupSelected: () => void;
  onUngroupSelected: () => void;
}

const BLEND_MODES: Array<{ id: LayerBlendMode; label: string }> = [
  { id: 'normal', label: 'Normal' },
  { id: 'multiply', label: 'Multiplicar' },
  { id: 'screen', label: 'Trama' },
  { id: 'overlay', label: 'Superponer' },
  { id: 'darken', label: 'Oscurecer' },
  { id: 'lighten', label: 'Aclarar' },
];

export const LayersPanel: React.FC<LayersPanelProps> = ({
  objects,
  selectedIds,
  onSelectIds,
  onUpdateObject,
  onReorderObjects,
  onDuplicateSelected,
  onDeleteSelected,
  onGroupSelected,
  onUngroupSelected,
}) => {
  const [editingLayerId, setEditingLayerId] = useState<string | null>(null);
  const [draftName, setDraftName] = useState('');
  const [draggedId, setDraggedId] = useState<string | null>(null);
  const [dragOverId, setDragOverId] = useState<string | null>(null);

  // Display top-most layer first (standard Canva / Photoshop / Procreate order)
  const reversed = [...objects].reverse();
  const primarySelected =
    selectedIds.length === 1
      ? objects.find((o) => o.id === selectedIds[0]) ?? null
      : null;

  const hasGroupInSelection = selectedIds.some((id) =>
    Boolean(objects.find((o) => o.id === id)?.groupId)
  );

  const moveSelectedOrder = (action: 'front' | 'back' | 'up' | 'down') => {
    if (selectedIds.length === 0) return;
    const selSet = new Set(selectedIds);
    const next = [...objects];

    if (action === 'front') {
      const rest = next.filter((o) => !selSet.has(o.id));
      const chosen = next.filter((o) => selSet.has(o.id));
      onReorderObjects([...rest, ...chosen], 'Traer al frente');
    } else if (action === 'back') {
      const rest = next.filter((o) => !selSet.has(o.id));
      const chosen = next.filter((o) => selSet.has(o.id));
      onReorderObjects([...chosen, ...rest], 'Enviar al fondo');
    } else if (action === 'up') {
      for (let i = next.length - 2; i >= 0; i--) {
        if (selSet.has(next[i].id) && !selSet.has(next[i + 1].id)) {
          [next[i], next[i + 1]] = [next[i + 1], next[i]];
        }
      }
      onReorderObjects(next, 'Subir capa');
    } else if (action === 'down') {
      for (let i = 1; i < next.length; i++) {
        if (selSet.has(next[i].id) && !selSet.has(next[i - 1].id)) {
          [next[i], next[i - 1]] = [next[i - 1], next[i]];
        }
      }
      onReorderObjects(next, 'Bajar capa');
    }
  };

  const handleDropOnLayer = (targetId: string) => {
    if (!draggedId || draggedId === targetId) {
      setDraggedId(null);
      setDragOverId(null);
      return;
    }
    const visualList = [...objects].reverse();
    const fromIdx = visualList.findIndex((o) => o.id === draggedId);
    const toIdx = visualList.findIndex((o) => o.id === targetId);
    if (fromIdx < 0 || toIdx < 0) return;

    const [moved] = visualList.splice(fromIdx, 1);
    visualList.splice(toIdx, 0, moved);
    onReorderObjects(visualList.reverse(), 'Reordenar capas');
    setDraggedId(null);
    setDragOverId(null);
  };

  const renderThumb = (obj: CanvasObject) => {
    if (obj.kind === 'image') {
      return (
        <img
          src={obj.src}
          alt={obj.alt || 'Imagen'}
          className="w-8 h-8 rounded object-cover border border-[var(--luma-border)] shrink-0 bg-white"
        />
      );
    }
    if (obj.kind === 'stroke') {
      return (
        <div className="w-8 h-8 rounded border border-[var(--luma-border)] bg-white flex items-center justify-center shrink-0">
          <PenTool className="w-3.5 h-3.5" style={{ color: obj.color }} />
        </div>
      );
    }
    if (obj.kind === 'text') {
      return (
        <div
          className="w-8 h-8 rounded border border-[var(--luma-border)] flex items-center justify-center shrink-0 text-[11px] font-bold"
          style={{
            backgroundColor: obj.fillColor !== 'transparent' ? obj.fillColor : '#FFFFFF',
            color: obj.color,
          }}
        >
          <Type className="w-3.5 h-3.5" />
        </div>
      );
    }
    if (obj.kind === 'shape') {
      return (
        <div className="w-8 h-8 rounded border border-[var(--luma-border)] bg-white flex items-center justify-center shrink-0">
          <Shapes className="w-3.5 h-3.5" style={{ color: obj.strokeColor }} />
        </div>
      );
    }
    if (obj.kind === 'sticky') {
      return (
        <div
          className="w-8 h-8 rounded border border-black/10 flex items-center justify-center shrink-0"
          style={{ backgroundColor: obj.bgColor, color: obj.textColor }}
        >
          <StickyNote className="w-3.5 h-3.5" />
        </div>
      );
    }
    if (obj.kind === 'table') {
      return (
        <div className="w-8 h-8 rounded border border-[var(--luma-border)] bg-white flex items-center justify-center shrink-0 text-[var(--luma-accent)]">
          <Table2 className="w-3.5 h-3.5" />
        </div>
      );
    }
    return (
      <div
        className="w-8 h-8 rounded border border-[var(--luma-border)] flex items-center justify-center shrink-0 text-xs font-bold"
        style={{ backgroundColor: obj.bgColor, color: obj.color }}
      >
        {obj.symbol}
      </div>
    );
  };

  return (
    <div className="flex flex-col h-full space-y-3 text-xs">
      {/* Layer Actions Strip */}
      <div className="space-y-1.5 pb-2 border-b border-[var(--luma-border)]">
        <div className="flex items-center justify-between">
          <span className="font-semibold text-[var(--luma-ink)]">
            Capas ({objects.length})
          </span>
          <span className="text-[10px] text-[var(--luma-ink-muted)]">
            Arrastra para reordenar
          </span>
        </div>

        {/* Bring Front / Up / Down / Back */}
        <div className="grid grid-cols-4 gap-1">
          <button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={() => moveSelectedOrder('front')}
            title="Traer al frente"
            aria-label="Traer al frente"
            className="h-7 rounded-md border border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)] disabled:opacity-40 flex items-center justify-center"
          >
            <ArrowUpToLine className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={() => moveSelectedOrder('up')}
            title="Subir capa"
            aria-label="Subir capa"
            className="h-7 rounded-md border border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)] disabled:opacity-40 flex items-center justify-center"
          >
            <ArrowUp className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={() => moveSelectedOrder('down')}
            title="Bajar capa"
            aria-label="Bajar capa"
            className="h-7 rounded-md border border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)] disabled:opacity-40 flex items-center justify-center"
          >
            <ArrowDown className="w-3.5 h-3.5" />
          </button>
          <button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={() => moveSelectedOrder('back')}
            title="Enviar al fondo"
            aria-label="Enviar al fondo"
            className="h-7 rounded-md border border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)] disabled:opacity-40 flex items-center justify-center"
          >
            <ArrowDownToLine className="w-3.5 h-3.5" />
          </button>
        </div>

        {/* Duplicate / Group / Delete */}
        <div className="grid grid-cols-3 gap-1">
          <button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={onDuplicateSelected}
            title="Duplicar selección"
            className="h-7 rounded-md border border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)] disabled:opacity-40 flex items-center justify-center gap-1 text-[11px]"
          >
            <Copy className="w-3 h-3" />
            <span>Duplicar</span>
          </button>
          <button
            type="button"
            disabled={selectedIds.length < 2 && !hasGroupInSelection}
            onClick={hasGroupInSelection ? onUngroupSelected : onGroupSelected}
            title={hasGroupInSelection ? 'Desagrupar' : 'Agrupar selección'}
            className="h-7 rounded-md border border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)] disabled:opacity-40 flex items-center justify-center gap-1 text-[11px]"
          >
            {hasGroupInSelection ? (
              <>
                <Ungroup className="w-3 h-3" />
                <span>Desagrup.</span>
              </>
            ) : (
              <>
                <Group className="w-3 h-3" />
                <span>Agrupar</span>
              </>
            )}
          </button>
          <button
            type="button"
            disabled={selectedIds.length === 0}
            onClick={onDeleteSelected}
            title="Eliminar capa seleccionada"
            className="h-7 rounded-md border border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-red-500/15 hover:text-red-500 disabled:opacity-40 flex items-center justify-center gap-1 text-[11px]"
          >
            <Trash2 className="w-3 h-3" />
            <span>Borrar</span>
          </button>
        </div>
      </div>

      {/* Selected Layer Opacity & Blend Mode */}
      {primarySelected && (
        <div className="p-2.5 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-bg)] space-y-2">
          <div>
            <div className="flex items-center justify-between text-[11px] mb-1">
              <span className="font-medium">Opacidad de capa</span>
              <span className="font-mono tabular-nums text-[var(--luma-ink-muted)]">
                {Math.round((primarySelected.opacity ?? 1) * 100)}%
              </span>
            </div>
            <input
              type="range"
              min={5}
              max={100}
              value={Math.round((primarySelected.opacity ?? 1) * 100)}
              onChange={(e) =>
                onUpdateObject(primarySelected.id, { opacity: Number(e.target.value) / 100 }, false)
              }
              className="w-full accent-[var(--luma-accent)]"
            />
          </div>
          <div className="flex items-center justify-between gap-2">
            <span className="text-[11px] font-medium shrink-0">Fusión</span>
            <select
              value={primarySelected.blendMode ?? 'normal'}
              onChange={(e) =>
                onUpdateObject(
                  primarySelected.id,
                  { blendMode: e.target.value as LayerBlendMode },
                  true
                )
              }
              aria-label="Modo de fusión de capa"
              className="h-7 px-2 rounded-md border border-[var(--luma-border)] bg-[var(--luma-surface)] text-[11px] outline-none"
            >
              {BLEND_MODES.map((m) => (
                <option key={m.id} value={m.id}>
                  {m.label}
                </option>
              ))}
            </select>
          </div>
        </div>
      )}

      {/* Numbered Layer List */}
      <div className="flex-1 overflow-y-auto space-y-1 pr-0.5">
        {reversed.length === 0 ? (
          <div className="py-8 px-3 text-center text-[11px] text-[var(--luma-ink-muted)] border border-dashed border-[var(--luma-border)] rounded-xl">
            <ImageIcon className="w-5 h-5 mx-auto mb-1.5 opacity-50" />
            Añade texto, formas, imágenes o trazos para ver cada capa numerada aquí.
          </div>
        ) : (
          reversed.map((obj) => {
            const actualIndex = objects.findIndex((o) => o.id === obj.id);
            const layerNumber = actualIndex + 1;
            const isSelected = selectedIds.includes(obj.id);
            const isVisible = obj.visible !== false;
            const isLocked = Boolean(obj.locked);
            const displayName = getLayerDisplayName(obj, layerNumber);

            return (
              <div
                key={obj.id}
                draggable={!isLocked}
                onDragStart={() => setDraggedId(obj.id)}
                onDragOver={(e) => {
                  e.preventDefault();
                  setDragOverId(obj.id);
                }}
                onDragLeave={() => {
                  if (dragOverId === obj.id) setDragOverId(null);
                }}
                onDrop={() => handleDropOnLayer(obj.id)}
                onClick={(e) => {
                  if (e.shiftKey) {
                    onSelectIds(
                      isSelected
                        ? selectedIds.filter((id) => id !== obj.id)
                        : [...selectedIds, obj.id]
                    );
                  } else {
                    onSelectIds([obj.id]);
                  }
                }}
                onDoubleClick={() => {
                  setEditingLayerId(obj.id);
                  setDraftName(displayName);
                }}
                className={`flex items-center gap-2 p-1.5 rounded-lg border cursor-pointer transition-colors ${
                  dragOverId === obj.id
                    ? 'border-[var(--luma-accent)] bg-[var(--luma-accent-soft)]/60'
                    : isSelected
                      ? 'border-[var(--luma-accent)] bg-[var(--luma-accent-soft)]'
                      : 'border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)]'
                } ${!isVisible ? 'opacity-55' : ''}`}
              >
                {renderThumb(obj)}

                <div className="min-w-0 flex-1">
                  {editingLayerId === obj.id ? (
                    <input
                      value={draftName}
                      onChange={(e) => setDraftName(e.target.value)}
                      onBlur={() => {
                        onUpdateObject(obj.id, { name: draftName.trim() || undefined }, true);
                        setEditingLayerId(null);
                      }}
                      onKeyDown={(e) => {
                        if (e.key === 'Enter') {
                          onUpdateObject(obj.id, { name: draftName.trim() || undefined }, true);
                          setEditingLayerId(null);
                        } else if (e.key === 'Escape') {
                          setEditingLayerId(null);
                        }
                      }}
                      autoFocus
                      onClick={(e) => e.stopPropagation()}
                      className="w-full h-6 px-1.5 rounded border border-[var(--luma-accent)] bg-[var(--luma-surface)] text-[11px] outline-none"
                    />
                  ) : (
                    <>
                      <div className="text-[11px] font-semibold truncate text-[var(--luma-ink)]">
                        {displayName}
                      </div>
                      <div className="text-[10px] text-[var(--luma-ink-muted)] truncate">
                        Capa {layerNumber} · {getObjectKindLabel(obj)}
                        {obj.groupId ? ' · Grupo' : ''}
                      </div>
                    </>
                  )}
                </div>

                {/* Eye & Lock */}
                <div className="flex items-center gap-0.5 shrink-0">
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateObject(obj.id, { visible: !isVisible }, true);
                    }}
                    title={isVisible ? 'Ocultar capa' : 'Mostrar capa'}
                    aria-label={isVisible ? 'Ocultar capa' : 'Mostrar capa'}
                    className="w-6 h-6 rounded flex items-center justify-center text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)] hover:bg-[var(--luma-surface)]"
                  >
                    {isVisible ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                  </button>
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      onUpdateObject(obj.id, { locked: !isLocked }, true);
                    }}
                    title={isLocked ? 'Desbloquear capa' : 'Bloquear capa'}
                    aria-label={isLocked ? 'Desbloquear capa' : 'Bloquear capa'}
                    className={`w-6 h-6 rounded flex items-center justify-center hover:bg-[var(--luma-surface)] ${
                      isLocked ? 'text-[var(--luma-accent)]' : 'text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)]'
                    }`}
                  >
                    {isLocked ? <Lock className="w-3.5 h-3.5" /> : <Unlock className="w-3.5 h-3.5" />}
                  </button>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
};
