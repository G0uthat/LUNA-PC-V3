import React from 'react';
import {
  BookOpen,
  Columns2,
  Languages,
  Maximize2,
  PenTool,
  Search,
  SlidersHorizontal,
  X,
} from 'lucide-react';
import { LumaBrandLogo } from './LumaBrandLogo';

interface GuideModalProps {
  open: boolean;
  onClose: () => void;
}

const GUIDE_SECTIONS = [
  {
    icon: <BookOpen className="w-4 h-4 text-[var(--luma-accent)]" />,
    title: 'Lectura universal e inmersiva',
    desc: 'Abre EPUB, PDF, DOCX, PPTX, FB2 y TXT. Activa Pantalla Completa (F11) y elige entre Marcapáginas lateral arrastrable, Isla dinámica superior o barra clásica desde Configuración.',
  },
  {
    icon: <Languages className="w-4 h-4 text-[var(--luma-accent)]" />,
    title: 'Diccionario instantáneo al seleccionar',
    desc: 'Selecciona cualquier palabra o frase en el lector para ver su significado, resumen de Wikipedia y traducción en una ventana compacta sin salir de tu página.',
  },
  {
    icon: <PenTool className="w-4 h-4 text-[var(--luma-accent)]" />,
    title: 'Cuadernos visuales estilo Canva',
    desc: 'Pulsa + para crear cuadernos en blanco, rayados, cuadrícula, Método Cornell, mapas conceptuales o tablas comparativas. Exporta tus páginas en PNG HD o PDF.',
  },
  {
    icon: <Columns2 className="w-4 h-4 text-[var(--luma-accent)]" />,
    title: 'Vista dividida Lector + Cuaderno',
    desc: 'En pantallas amplias, pulsa Dividir en la barra superior para leer tu libro a la izquierda y tomar apuntes visuales a la derecha al mismo tiempo.',
  },
  {
    icon: <Search className="w-4 h-4 text-[var(--luma-accent)]" />,
    title: 'Búsqueda global por título o contenido',
    desc: 'Busca desde la biblioteca dentro del texto de todos tus capítulos, diapositivas y manhwas, o usa Ctrl+K para saltar al instante a cualquier recurso.',
  },
  {
    icon: <Maximize2 className="w-4 h-4 text-[var(--luma-accent)]" />,
    title: 'Toque lateral y ocultado automático',
    desc: 'Activa el ocultado inmersivo para que las barras desaparezcan solas al leer o dibujar, y haz clic en los bordes izquierdo o derecho para cambiar de página.',
  },
];

export const GuideModal: React.FC<GuideModalProps> = ({ open, onClose }) => {
  if (!open) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-50 bg-black/45 backdrop-blur-[2px] flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[680px] max-h-[86vh] flex flex-col rounded-2xl border border-[var(--luma-border)] bg-[var(--luma-surface)] text-[var(--luma-ink)] shadow-2xl overflow-hidden"
      >
        <div className="px-6 py-4 border-b border-[var(--luma-border)] flex items-center justify-between gap-4">
          <div className="flex items-center gap-3">
            <LumaBrandLogo size="sm" />
            <div>
              <h2 className="text-base font-bold tracking-tight">Guía rápida · Cómo usar Luma</h2>
              <p className="text-xs text-[var(--luma-ink-muted)]">
                Todo lo que puedes hacer en Luma para PC
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

        <div className="flex-1 overflow-y-auto p-6 space-y-4">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            {GUIDE_SECTIONS.map((item) => (
              <div
                key={item.title}
                className="p-4 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-bg)] space-y-2"
              >
                <div className="flex items-center gap-2">
                  {item.icon}
                  <h3 className="text-xs font-bold">{item.title}</h3>
                </div>
                <p className="text-xs text-[var(--luma-ink-muted)] leading-relaxed">
                  {item.desc}
                </p>
              </div>
            ))}
          </div>

          <div className="p-4 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-bg)] flex items-start gap-3 text-xs">
            <SlidersHorizontal className="w-4 h-4 text-[var(--luma-accent)] shrink-0 mt-0.5" />
            <div className="text-[var(--luma-ink-muted)] leading-relaxed">
              <strong className="text-[var(--luma-ink)]">Atajos útiles:</strong>{' '}
              <span className="font-mono">Ctrl+K</span> buscar ·{' '}
              <span className="font-mono">Ctrl+\</span> menú lateral ·{' '}
              <span className="font-mono">F11</span> pantalla completa inmersiva ·{' '}
              <span className="font-mono">ESC</span> salir del modo inmersivo.
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};
