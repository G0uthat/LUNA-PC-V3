import {
  CanvasObject,
  LumaNotebook,
  MarginPreset,
  NotebookPageSize,
  NotebookPageSetup,
} from '../types';

export interface PageGeometry {
  w: number; // virtual px (base width ~1000 for portrait A4)
  h: number;
  mmW: number;
  mmH: number;
  pxPerMm: number;
  label: string;
}

const BASE_MM: Record<
  Exclude<NotebookPageSize, 'CUSTOM'>,
  { mmW: number; mmH: number; label: string }
> = {
  A4: { mmW: 210, mmH: 297, label: 'A4 (210 × 297 mm)' },
  A3: { mmW: 297, mmH: 420, label: 'A3 (297 × 420 mm)' },
  A5: { mmW: 148, mmH: 210, label: 'A5 (148 × 210 mm)' },
  LETTER: { mmW: 215.9, mmH: 279.4, label: 'Carta (216 × 279 mm)' },
  LEGAL: { mmW: 215.9, mmH: 355.6, label: 'Oficio (216 × 356 mm)' },
  WIDE_16_9: { mmW: 297, mmH: 167, label: '16:9 Panorámica' },
  SQUARE: { mmW: 210, mmH: 210, label: 'Cuadrado (210 × 210 mm)' },
};

export const MARGIN_PRESETS_MM: Record<
  Exclude<MarginPreset, 'custom'>,
  { top: number; bottom: number; left: number; right: number; label: string }
> = {
  normal: { top: 25.4, bottom: 25.4, left: 25.4, right: 25.4, label: 'Normal (2.54 cm)' },
  narrow: { top: 12.7, bottom: 12.7, left: 12.7, right: 12.7, label: 'Estrecho (1.27 cm)' },
  moderate: { top: 25.4, bottom: 25.4, left: 19.1, right: 19.1, label: 'Moderado' },
  wide: { top: 25.4, bottom: 25.4, left: 50.8, right: 50.8, label: 'Ancho' },
};

export function createDefaultPageSetup(): NotebookPageSetup {
  return {
    orientation: 'portrait',
    customWidthMm: 210,
    customHeightMm: 297,
    marginPreset: 'normal',
    marginsMm: { top: 25.4, bottom: 25.4, left: 25.4, right: 25.4 },
    rulerUnit: 'cm',
    showRulers: true,
    showMarginGuides: true,
    showGrid: false,
    snapEnabled: true,
    columns: 1,
    indentMm: 0,
    headerText: '',
    footerText: '',
    showPageNumbers: true,
  };
}

export function getEffectivePageSetup(notebook: LumaNotebook): NotebookPageSetup {
  const defaults = createDefaultPageSetup();
  if (!notebook.pageSetup) return defaults;
  return {
    ...defaults,
    ...notebook.pageSetup,
    marginsMm: {
      ...defaults.marginsMm,
      ...(notebook.pageSetup.marginsMm ?? {}),
    },
  };
}

/**
 * Computes exact virtual pixel dimensions and mm/px ratio for any page size & orientation.
 */
export function computePageGeometry(
  pageSize: NotebookPageSize,
  setup: NotebookPageSetup
): PageGeometry {
  let mmW: number;
  let mmH: number;
  let label: string;

  if (pageSize === 'CUSTOM') {
    mmW = Math.max(80, Math.min(600, setup.customWidthMm || 210));
    mmH = Math.max(80, Math.min(600, setup.customHeightMm || 297));
    label = `Personalizado (${Math.round(mmW)} × ${Math.round(mmH)} mm)`;
  } else {
    const base = BASE_MM[pageSize] ?? BASE_MM.A4;
    mmW = base.mmW;
    mmH = base.mmH;
    label = base.label;
  }

  if (setup.orientation === 'landscape' && mmH > mmW) {
    [mmW, mmH] = [mmH, mmW];
  } else if (setup.orientation === 'portrait' && mmW > mmH && pageSize !== 'WIDE_16_9') {
    [mmW, mmH] = [mmH, mmW];
  }

  // Keep width standardized around 1000 virtual px so existing coordinates stay crisp
  const w = 1000;
  const pxPerMm = w / mmW;
  const h = Math.round(mmH * pxPerMm);

  return { w, h, mmW, mmH, pxPerMm, label };
}

export function getMarginsPx(setup: NotebookPageSetup, geom: PageGeometry) {
  return {
    top: Math.round(setup.marginsMm.top * geom.pxPerMm),
    bottom: Math.round(setup.marginsMm.bottom * geom.pxPerMm),
    left: Math.round(setup.marginsMm.left * geom.pxPerMm),
    right: Math.round(setup.marginsMm.right * geom.pxPerMm),
  };
}

export function getObjectKindLabel(obj: CanvasObject): string {
  switch (obj.kind) {
    case 'text':
      return 'Texto';
    case 'image':
      return 'Imagen';
    case 'stroke':
      return 'Trazo';
    case 'shape':
      return 'Forma';
    case 'sticky':
      return 'Nota';
    case 'table':
      return 'Tabla';
    case 'sticker':
      return 'Sticker';
  }
}

export function getLayerDisplayName(obj: CanvasObject, layerNumber: number): string {
  if (obj.name && obj.name.trim()) return obj.name;
  return `Capa ${layerNumber} · ${getObjectKindLabel(obj)}`;
}

export function getObjectBounds(obj: CanvasObject): {
  x: number;
  y: number;
  w: number;
  h: number;
} {
  if (obj.kind === 'stroke' && obj.points.length > 0) {
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const pt of obj.points) {
      if (pt.x < minX) minX = pt.x;
      if (pt.y < minY) minY = pt.y;
      if (pt.x > maxX) maxX = pt.x;
      if (pt.y > maxY) maxY = pt.y;
    }
    const pad = Math.max(8, obj.strokeWidth * 1.5);
    return {
      x: minX - pad,
      y: minY - pad,
      w: Math.max(24, maxX - minX + pad * 2),
      h: Math.max(24, maxY - minY + pad * 2),
    };
  }
  return { x: obj.x, y: obj.y, w: obj.w, h: obj.h };
}
