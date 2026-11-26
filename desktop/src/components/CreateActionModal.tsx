import React, { useState } from 'react';
import {
  FileText,
  FolderPlus,
  Grid3X3,
  LayoutGrid,
  Network,
  PenTool,
  Table2,
  Upload,
  X,
} from 'lucide-react';
import { NotebookPageSize } from '../types';

export type NotebookTemplateId =
  | 'blank'
  | 'ruled'
  | 'grid'
  | 'cornell'
  | 'planner'
  | 'concept_map'
  | 'comparison';

interface CreateActionModalProps {
  open: boolean;
  initialSection?: 'notebook' | 'saga';
  onClose: () => void;
  onCreateNotebook: (
    tpl: NotebookTemplateId,
    title?: string,
    pageSize?: NotebookPageSize
  ) => void;
  onImportFiles: () => void;
  onCreateSaga: (name: string, description: string, accentColor: string) => void;
}

const NOTEBOOK_TYPES: Array<{
  id: NotebookTemplateId;
  name: string;
  desc: string;
  icon: React.ReactNode;
}> = [
  {
    id: 'blank',
    name: 'Lienzo blanco',
    desc: 'Hoja limpia para dibujo libre y texto',
    icon: <FileText className="w-4 h-4" />,
  },
  {
    id: 'ruled',
    name: 'Papel rayado',
    desc: 'Líneas clásicas para apuntes de lectura',
    icon: <PenTool className="w-4 h-4" />,
  },
  {
    id: 'grid',
    name: 'Cuadrícula',
    desc: 'Guía milimetrada para diagramas técnicos',
    icon: <Grid3X3 className="w-4 h-4" />,
  },
  {
    id: 'cornell',
    name: 'Método Cornell',
    desc: 'Preguntas clave, notas y bloque resumen',
    icon: <LayoutGrid className="w-4 h-4" />,
  },
  {
    id: 'planner',
    name: 'Planner semanal',
    desc: 'Agenda visual, tareas y notas adhesivas',
    icon: <LayoutGrid className="w-4 h-4" />,
  },
  {
    id: 'concept_map',
    name: 'Lienzo de ideas',
    desc: 'Mapa conceptual y nodos estilo Canva',
    icon: <Network className="w-4 h-4" />,
  },
  {
    id: 'comparison',
    name: 'Tabla comparativa',
    desc: 'Matriz editable para contrastar temas',
    icon: <Table2 className="w-4 h-4" />,
  },
];

const PAGE_SIZES: Array<{ id: NotebookPageSize; label: string }> = [
  { id: 'A4', label: 'A4 (210 × 297 mm)' },
  { id: 'A3', label: 'A3 (297 × 420 mm)' },
  { id: 'A5', label: 'A5 (148 × 210 mm)' },
  { id: 'LETTER', label: 'Carta' },
  { id: 'LEGAL', label: 'Oficio' },
  { id: 'WIDE_16_9', label: '16:9 Panorámica' },
  { id: 'SQUARE', label: 'Cuadrado' },
];

const SAGA_COLORS = ['#2B64F5', '#C2642B', '#C44672', '#257A5E', '#5B4BDB', '#D97706'];

export const CreateActionModal: React.FC<CreateActionModalProps> = ({
  open,
  initialSection = 'notebook',
  onClose,
  onCreateNotebook,
  onImportFiles,
  onCreateSaga,
}) => {
  const [section, setSection] = useState<'notebook' | 'saga'>(initialSection);
  const [selectedTpl, setSelectedTpl] = useState<NotebookTemplateId>('cornell');
  const [nbTitle, setNbTitle] = useState('');
  const [nbSize, setNbSize] = useState<NotebookPageSize>('A4');

  const [sagaName, setSagaName] = useState('');
  const [sagaDesc, setSagaDesc] = useState('');
  const [sagaColor, setSagaColor] = useState(SAGA_COLORS[0]);

  React.useEffect(() => {
    if (open) {
      setSection(initialSection);
      setNbTitle('');
      setSagaName('');
      setSagaDesc('');
    }
  }, [open, initialSection]);

  if (!open) return null;

  const handleSubmitNotebook = (e: React.FormEvent) => {
    e.preventDefault();
    onCreateNotebook(selectedTpl, nbTitle.trim() || undefined, nbSize);
    onClose();
  };

  const handleSubmitSaga = (e: React.FormEvent) => {
    e.preventDefault();
    const clean = sagaName.trim();
    if (!clean) return;
    onCreateSaga(clean, sagaDesc.trim() || 'Colección personalizada', sagaColor);
    onClose();
  };

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[640px] max-h-[88vh] flex flex-col rounded-2xl border border-[var(--luma-border)] bg-[var(--luma-surface)] text-[var(--luma-ink)] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-6 py-4 border-b border-[var(--luma-border)] flex items-center justify-between gap-3">
          <div>
            <h2 className="text-base font-bold tracking-tight">¿Qué quieres crear en Luma?</h2>
            <p className="text-xs text-[var(--luma-ink-muted)] mt-0.5">
              Elige un tipo de cuaderno, crea una serie o importa archivos desde tu PC.
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)] hover:bg-[var(--luma-surface-alt)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* 3 Clear Top Action Choices */}
        <div className="px-6 pt-4 pb-2 grid grid-cols-3 gap-2">
          <button
            type="button"
            onClick={() => setSection('notebook')}
            className={`p-3 rounded-xl border text-left transition-colors ${
              section === 'notebook'
                ? 'border-[var(--luma-accent)] bg-[var(--luma-accent-soft)]'
                : 'border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)]'
            }`}
          >
            <PenTool className="w-4 h-4 text-[var(--luma-accent)] mb-1.5" />
            <div className="text-xs font-semibold">Nuevo Cuaderno</div>
            <div className="text-[11px] text-[var(--luma-ink-muted)]">6 plantillas visuales</div>
          </button>

          <button
            type="button"
            onClick={() => setSection('saga')}
            className={`p-3 rounded-xl border text-left transition-colors ${
              section === 'saga'
                ? 'border-[var(--luma-accent)] bg-[var(--luma-accent-soft)]'
                : 'border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)]'
            }`}
          >
            <FolderPlus className="w-4 h-4 text-[var(--luma-accent)] mb-1.5" />
            <div className="text-xs font-semibold">Nueva Serie / Saga</div>
            <div className="text-[11px] text-[var(--luma-ink-muted)]">Agrupa libros y manhwa</div>
          </button>

          <button
            type="button"
            onClick={() => {
              onClose();
              onImportFiles();
            }}
            className="p-3 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-bg)] hover:border-[var(--luma-accent)] hover:bg-[var(--luma-surface-alt)] text-left transition-colors"
          >
            <Upload className="w-4 h-4 text-[var(--luma-accent)] mb-1.5" />
            <div className="text-xs font-semibold">Importar Archivo</div>
            <div className="text-[11px] text-[var(--luma-ink-muted)]">EPUB, PDF, DOCX, PPTX</div>
          </button>
        </div>

        {/* Body */}
        <div className="flex-1 overflow-y-auto px-6 py-4">
          {section === 'notebook' ? (
            <form onSubmit={handleSubmitNotebook} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--luma-ink-muted)] mb-2">
                  Selecciona el tipo de cuaderno
                </label>
                <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                  {NOTEBOOK_TYPES.map((tpl) => {
                    const active = selectedTpl === tpl.id;
                    return (
                      <button
                        key={tpl.id}
                        type="button"
                        onClick={() => setSelectedTpl(tpl.id)}
                        className={`p-3 rounded-xl border text-left transition-all ${
                          active
                            ? 'border-[var(--luma-accent)] bg-[var(--luma-accent-soft)] ring-1 ring-[var(--luma-accent)]'
                            : 'border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)]'
                        }`}
                      >
                        <div className="text-[var(--luma-accent)] mb-1.5">{tpl.icon}</div>
                        <div className="text-xs font-semibold">{tpl.name}</div>
                        <div className="text-[11px] text-[var(--luma-ink-muted)] mt-0.5 leading-snug">
                          {tpl.desc}
                        </div>
                      </button>
                    );
                  })}
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1">
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--luma-ink-muted)] mb-1">
                    Título (opcional)
                  </label>
                  <input
                    value={nbTitle}
                    onChange={(e) => setNbTitle(e.target.value)}
                    placeholder="Ej. Apuntes de Historia Moderna"
                    className="w-full h-9 px-3 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-bg)] text-xs outline-none focus:border-[var(--luma-accent)]"
                  />
                </div>
                <div>
                  <label className="block text-[11px] font-semibold text-[var(--luma-ink-muted)] mb-1">
                    Formato de página
                  </label>
                  <select
                    value={nbSize}
                    onChange={(e) => setNbSize(e.target.value as NotebookPageSize)}
                    className="w-full h-9 px-2.5 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-bg)] text-xs outline-none focus:border-[var(--luma-accent)]"
                  >
                    {PAGE_SIZES.map((s) => (
                      <option key={s.id} value={s.id}>
                        {s.label}
                      </option>
                    ))}
                  </select>
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--luma-border)]">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 px-4 rounded-lg border border-[var(--luma-border)] text-xs font-medium hover:bg-[var(--luma-surface-alt)]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-9 px-4 rounded-lg bg-[var(--luma-accent)] text-[var(--luma-on-accent)] text-xs font-semibold hover:opacity-95"
                >
                  Crear cuaderno
                </button>
              </div>
            </form>
          ) : (
            <form onSubmit={handleSubmitSaga} className="space-y-4">
              <div>
                <label className="block text-[11px] font-semibold text-[var(--luma-ink-muted)] mb-1">
                  Nombre de la serie o saga
                </label>
                <input
                  value={sagaName}
                  onChange={(e) => setSagaName(e.target.value)}
                  placeholder="Ej. Shadow Blade · Temporada 1"
                  required
                  className="w-full h-9 px-3 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-bg)] text-xs outline-none focus:border-[var(--luma-accent)]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--luma-ink-muted)] mb-1">
                  Descripción
                </label>
                <input
                  value={sagaDesc}
                  onChange={(e) => setSagaDesc(e.target.value)}
                  placeholder="Volúmenes, episodios o lecturas temáticas"
                  className="w-full h-9 px-3 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-bg)] text-xs outline-none focus:border-[var(--luma-accent)]"
                />
              </div>

              <div>
                <label className="block text-[11px] font-semibold text-[var(--luma-ink-muted)] mb-2">
                  Color distintivo
                </label>
                <div className="flex items-center gap-2">
                  {SAGA_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setSagaColor(c)}
                      className={`w-7 h-7 rounded-full transition-transform ${
                        sagaColor === c ? 'ring-2 ring-offset-2 ring-[var(--luma-ink)] scale-110' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              <div className="flex justify-end gap-2 pt-2 border-t border-[var(--luma-border)]">
                <button
                  type="button"
                  onClick={onClose}
                  className="h-9 px-4 rounded-lg border border-[var(--luma-border)] text-xs font-medium hover:bg-[var(--luma-surface-alt)]"
                >
                  Cancelar
                </button>
                <button
                  type="submit"
                  className="h-9 px-4 rounded-lg bg-[var(--luma-accent)] text-[var(--luma-on-accent)] text-xs font-semibold hover:opacity-95"
                >
                  Crear serie
                </button>
              </div>
            </form>
          )}
        </div>
      </div>
    </div>
  );
};
