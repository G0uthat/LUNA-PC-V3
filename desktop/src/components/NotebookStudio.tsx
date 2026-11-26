import React, { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { createPortal } from 'react-dom';
import {
  AlignCenter,
  AlignCenterHorizontal,
  AlignCenterVertical,
  AlignEndHorizontal,
  AlignEndVertical,
  AlignJustify,
  AlignLeft,
  AlignRight,
  AlignStartHorizontal,
  AlignStartVertical,
  ArrowUpRight,
  Bold,
  Check,
  ChevronLeft,
  ChevronRight,
  Circle,
  Clock,
  CloudUpload,
  Copy,
  Crop,
  Diamond,
  Download,
  Eraser,
  ExternalLink,
  FilePlus2,
  FileText,
  FlipHorizontal,
  FlipVertical,
  Grid3X3,
  Group,
  Hand,
  Hexagon,
  Highlighter,
  Image as ImageIcon,
  Italic,
  Keyboard,
  Layers,
  LayoutTemplate,
  List,
  ListOrdered,
  Maximize2,
  Minus,
  Moon,
  MousePointer2,
  PaintBucket,
  PenTool,
  Pentagon,
  Plus,
  Printer,
  Redo2,
  RotateCw,
  Ruler,
  Scissors,
  Search,
  Shapes,
  Square,
  SquareDashedMousePointer,
  Star,
  StickyNote,
  Strikethrough,
  Subscript,
  Sun,
  Superscript,
  Table2,
  Trash2,
  Triangle,
  Type,
  Underline,
  Undo2,
  Ungroup,
  ZoomIn,
  ZoomOut,
} from 'lucide-react';
import {
  CanvasObject,
  CanvasTool,
  ImageCanvasObject,
  LumaNotebook,
  NotebookBodyStyle,
  NotebookPage,
  NotebookPageSetup,
  NotebookPageSize,
  ReadingThemeId,
  ShapeCanvasObject,
  ShapeKind,
  StickerCanvasObject,
  StickyCanvasObject,
  StrokeCanvasObject,
  TableCanvasObject,
  TextCanvasObject,
  WorkspacePreferences,
} from '../types';
import { ViewportProfile } from '../hooks/useViewportProfile';
import {
  FontCatalogEntry,
  hydrateCustomFonts,
  resolveFontFamilyCss,
} from '../utils/fontManager';
import {
  buildNotebookTabUrl,
  readSharedClipboard,
  writeSharedClipboard,
} from '../utils/notebookStorage';
import {
  BRUSH_TIPS,
  BrushPresetConfig,
  DrawingToolsState,
  EraserSettings,
  FillSettings,
  floodFillCanvas,
  loadDrawingToolsState,
  renderStrokeToCanvas,
  saveDrawingToolsState,
  smoothIncomingPoint,
} from '../notebook/brushEngine';
import {
  computePageGeometry,
  getEffectivePageSetup,
  getMarginsPx,
  getObjectBounds,
  MARGIN_PRESETS_MM,
} from '../notebook/pageGeometry';
import {
  exportNotebookAsImage,
  exportNotebookAsPdf,
  exportNotebookAsSvg,
  printNotebookPages,
} from '../notebook/exportEngine';
import { FontPicker } from '../notebook/FontPicker';
import { BrushPanel } from '../notebook/BrushPanel';
import { LayersPanel } from '../notebook/LayersPanel';
import { PageSetupPanel } from '../notebook/PageSetupPanel';
import { ShapeSvgRenderer } from '../notebook/ShapeSvgRenderer';
import {
  FindReplaceModal,
  HistoryPanel,
  HistorySnapshot,
  HorizontalRuler,
  ShortcutsHelpModal,
  VerticalRuler,
} from '../notebook/StudioModals';

interface NotebookStudioProps {
  notebook: LumaNotebook;
  viewport: ViewportProfile;
  prefs?: WorkspacePreferences;
  compactSplit?: boolean;
  isStandaloneTab?: boolean;
  onChangeNotebook: (updated: LumaNotebook) => void;
  onToggleDarkLight?: (theme: ReadingThemeId) => void;
  onBackToHome?: () => void;
  onSyncToDrive?: () => void;
  syncButtonSlot?: React.ReactNode;
}

type RibbonTab = 'home' | 'insert' | 'draw' | 'layout' | 'view';
type SideDrawerTab = 'elements' | 'draw' | 'text' | 'layers' | 'layout' | 'history' | null;

const STICKERS = [
  { symbol: '✓', label: 'Clave', color: '#15803D', bg: '#DCFCE7' },
  { symbol: '★', label: 'Examen', color: '#B45309', bg: '#FEF3C7' },
  { symbol: '!', label: 'Alerta', color: '#BE123C', bg: '#FFE4E6' },
  { symbol: '→', label: 'Causa', color: '#1D4ED8', bg: '#DBEAFE' },
  { symbol: '◈', label: 'Idea', color: '#6D28D9', bg: '#EDE9FE' },
  { symbol: '⊕', label: 'Extra', color: '#0F766E', bg: '#CCFBF1' },
];

const SHAPE_CATALOG: Array<{ kind: ShapeKind; label: string; icon: React.ReactNode }> = [
  { kind: 'rect', label: 'Rectángulo', icon: <Square className="w-3.5 h-3.5" /> },
  { kind: 'ellipse', label: 'Círculo', icon: <Circle className="w-3.5 h-3.5" /> },
  { kind: 'triangle', label: 'Triángulo', icon: <Triangle className="w-3.5 h-3.5" /> },
  { kind: 'diamond', label: 'Rombo', icon: <Diamond className="w-3.5 h-3.5" /> },
  { kind: 'pentagon', label: 'Pentágono', icon: <Pentagon className="w-3.5 h-3.5" /> },
  { kind: 'hexagon', label: 'Hexágono', icon: <Hexagon className="w-3.5 h-3.5" /> },
  { kind: 'star', label: 'Estrella', icon: <Star className="w-3.5 h-3.5" /> },
  { kind: 'arrow', label: 'Flecha', icon: <ArrowUpRight className="w-3.5 h-3.5" /> },
  { kind: 'line', label: 'Línea', icon: <Minus className="w-3.5 h-3.5" /> },
];

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
}

function clonePages(pages: NotebookPage[]): NotebookPage[] {
  return JSON.parse(JSON.stringify(pages)) as NotebookPage[];
}

type ResizeHandle = 'nw' | 'n' | 'ne' | 'e' | 'se' | 's' | 'sw' | 'w';

interface SnapGuide {
  axis: 'x' | 'y';
  pos: number;
}

const DEFAULT_BODY_STYLE: NotebookBodyStyle = {
  fontFamily: 'Plus Jakarta Sans',
  fontSize: 16,
  bold: false,
  italic: false,
  underline: false,
  strikethrough: false,
  color: '#1A2233',
  highlightColor: 'transparent',
  align: 'left',
  lineHeight: 1.6,
  letterSpacing: 0,
  listType: 'none',
};

const PLACEHOLDER_TEXTS = new Set([
  'Doble clic para escribir...',
  'Escribe aquí...',
  'Nota rápida\nDoble clic para editar...',
  'Nota rápida\nDoble clic para escribir...',
]);

export const NotebookStudio: React.FC<NotebookStudioProps> = ({
  notebook,
  viewport,
  prefs,
  compactSplit = false,
  isStandaloneTab = false,
  onChangeNotebook,
  onToggleDarkLight,
  onBackToHome,
  onSyncToDrive,
  syncButtonSlot,
}) => {
  // Navigation & panels
  const [ribbonTab, setRibbonTab] = useState<RibbonTab>('home');
  const [drawerTab, setDrawerTab] = useState<SideDrawerTab>(
    compactSplit || viewport.tier === 'compact' ? null : 'elements'
  );
  const [tool, setTool] = useState<CanvasTool>('select');
  const [toolsState, setToolsState] = useState<DrawingToolsState>(() => loadDrawingToolsState());
  const [lastPressure, setLastPressure] = useState(0.5);
  const [eraserCursorPos, setEraserCursorPos] = useState<{ x: number; y: number } | null>(null);
  const [isErasingNow, setIsErasingNow] = useState(false);

  // Persist independent brush / eraser / fill configurations whenever modified
  useEffect(() => {
    saveDrawingToolsState(toolsState);
  }, [toolsState]);

  const activeBrushTip = toolsState.activeTip;
  const activeBrush = toolsState.brushes[activeBrushTip];
  const eraserSettings = toolsState.eraser;
  const fillSettings = toolsState.fill;

  const handleSelectBrushTip = useCallback((tip: typeof activeBrushTip) => {
    setToolsState((prev) => ({ ...prev, activeTip: tip }));
    setTool(tip === 'highlighter' ? 'highlighter' : 'pen');
  }, []);

  const handleUpdateActiveBrush = useCallback((patch: Partial<BrushPresetConfig>) => {
    setToolsState((prev) => ({
      ...prev,
      brushes: {
        ...prev.brushes,
        [prev.activeTip]: { ...prev.brushes[prev.activeTip], ...patch },
      },
    }));
  }, []);

  const handleUpdateEraser = useCallback((patch: Partial<EraserSettings>) => {
    setToolsState((prev) => ({
      ...prev,
      eraser: { ...prev.eraser, ...patch },
    }));
  }, []);

  const handleUpdateFill = useCallback((patch: Partial<FillSettings>) => {
    setToolsState((prev) => ({
      ...prev,
      fill: { ...prev.fill, ...patch },
    }));
  }, []);

  // Selection & editing
  const [selectedIds, setSelectedIds] = useState<string[]>([]);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [selectedTableCell, setSelectedTableCell] = useState<number | null>(null);
  const [cropEditorOpen, setCropEditorOpen] = useState(false);
  // Word-style direct sheet typing enabled by default so user can click page & type immediately
  const [documentBodyOpen, setDocumentBodyOpen] = useState(true);
  const bodyTextareaRef = useRef<HTMLTextAreaElement>(null);

  // Fonts & Modals
  const [customFonts, setCustomFonts] = useState<FontCatalogEntry[]>([]);
  const [findOpen, setFindOpen] = useState(false);
  const [shortcutsOpen, setShortcutsOpen] = useState(false);
  const [exportMenuOpen, setExportMenuOpen] = useState(false);
  const [exportMenuPos, setExportMenuPos] = useState<{ top: number; left: number }>({ top: 0, left: 0 });
  const exportBtnRef = useRef<HTMLButtonElement>(null);
  const exportMenuRef = useRef<HTMLDivElement>(null);
  const [exportScope, setExportScope] = useState<'current' | 'all'>('current');
  const [statusToast, setStatusToast] = useState<string | null>(null);
  const [saveIndicator, setSaveIndicator] = useState<'saved' | 'saving'>('saved');

  // Position Exportar dropdown safely in a fixed portal (never clipped by header overflow)
  const updateExportMenuPos = useCallback(() => {
    const btn = exportBtnRef.current;
    if (!btn) return;
    const rect = btn.getBoundingClientRect();
    const menuW = 244;
    const menuH = 276;
    const vw = window.innerWidth;
    const vh = window.innerHeight;
    let left = rect.right - menuW;
    if (left < 8) left = 8;
    if (left + menuW > vw - 8) left = Math.max(8, vw - menuW - 8);
    let top = rect.bottom + 6;
    if (top + menuH > vh - 8) {
      top = Math.max(8, rect.top - menuH - 6);
    }
    setExportMenuPos({ top, left });
  }, []);

  useEffect(() => {
    if (!exportMenuOpen) return;
    updateExportMenuPos();
    const onPointerDown = (e: MouseEvent) => {
      const target = e.target as Node;
      if (
        exportBtnRef.current?.contains(target) ||
        exportMenuRef.current?.contains(target)
      ) {
        return;
      }
      setExportMenuOpen(false);
    };
    const onKeyDown = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setExportMenuOpen(false);
    };
    window.addEventListener('mousedown', onPointerDown);
    window.addEventListener('resize', updateExportMenuPos);
    window.addEventListener('scroll', updateExportMenuPos, true);
    window.addEventListener('keydown', onKeyDown);
    return () => {
      window.removeEventListener('mousedown', onPointerDown);
      window.removeEventListener('resize', updateExportMenuPos);
      window.removeEventListener('scroll', updateExportMenuPos, true);
      window.removeEventListener('keydown', onKeyDown);
    };
  }, [exportMenuOpen, updateExportMenuPos]);

  // Zoom & Pan & Smart Guides
  const [zoom, setZoom] = useState(compactSplit ? 0.56 : 0.72);
  const [spacePressed, setSpacePressed] = useState(false);
  const [marqueeRect, setMarqueeRect] = useState<{
    x: number;
    y: number;
    w: number;
    h: number;
  } | null>(null);
  const [snapGuides, setSnapGuides] = useState<SnapGuide[]>([]);

  // Unlimited Undo/Redo visual history
  const [past, setPast] = useState<HistorySnapshot[]>([]);
  const [future, setFuture] = useState<HistorySnapshot[]>([]);

  // Refs for smooth 60fps drawing & transforms
  const viewportScrollRef = useRef<HTMLDivElement>(null);
  const pageContainerRef = useRef<HTMLDivElement>(null);
  const inkCanvasRef = useRef<HTMLCanvasElement>(null);
  const rasterCanvasRef = useRef<HTMLCanvasElement>(null);
  const imageInputRef = useRef<HTMLInputElement>(null);
  const activeStrokeRef = useRef<StrokeCanvasObject | null>(null);
  const rafRedrawRef = useRef<number>(0);
  const isDrawingRef = useRef(false);
  const pinchDistRef = useRef<number | null>(null);
  const panDragRef = useRef<{
    startX: number;
    startY: number;
    scrollLeft: number;
    scrollTop: number;
  } | null>(null);

  const transformRef = useRef<{
    mode: 'move' | 'resize' | 'rotate';
    handle?: ResizeHandle;
    pointerId: number;
    captured: boolean;
    clickToEditId?: string;
    startClientX: number;
    startClientY: number;
    origBounds: { x: number; y: number; w: number; h: number };
    centerPageX: number;
    centerPageY: number;
    startAngle: number;
    items: Array<{
      id: string;
      x: number;
      y: number;
      w: number;
      h: number;
      rotation: number;
      points?: Array<{ x: number; y: number; p?: number }>;
    }>;
    hasMoved: boolean;
  } | null>(null);

  const marqueeStartRef = useRef<{ x: number; y: number } | null>(null);

  // Page setup & geometry
  const pageSetup = useMemo(() => getEffectivePageSetup(notebook), [notebook]);
  const geom = useMemo(
    () => computePageGeometry(notebook.pageSize, pageSetup),
    [notebook.pageSize, pageSetup]
  );
  const marginsPx = useMemo(() => getMarginsPx(pageSetup, geom), [pageSetup, geom]);
  const activePage = notebook.pages[notebook.activePageIndex] ?? notebook.pages[0];

  const isDarkTheme = useMemo(() => {
    const t = prefs?.theme ?? 'warm_cream';
    return ['warm_night', 'forest_night', 'navy_mid', 'midnight', 'dark', 'amoled'].includes(t);
  }, [prefs?.theme]);

  // Hydrate persisted custom fonts once
  useEffect(() => {
    hydrateCustomFonts()
      .then(setCustomFonts)
      .catch(() => undefined);
  }, []);

  // Reset transient selection when switching notebook
  useEffect(() => {
    setSelectedIds([]);
    setEditingId(null);
    setCropEditorOpen(false);
    setPast([]);
    setFuture([]);
  }, [notebook.id]);

  // Brief autosave indicator feedback whenever notebook updates
  useEffect(() => {
    setSaveIndicator('saving');
    const t = window.setTimeout(() => setSaveIndicator('saved'), 420);
    return () => window.clearTimeout(t);
  }, [notebook.updatedAt]);

  const showToast = useCallback((msg: string) => {
    setStatusToast(msg);
    window.setTimeout(() => {
      setStatusToast((curr) => (curr === msg ? null : curr));
    }, 2600);
  }, []);

  // Selected objects helpers
  const selectedObjects = useMemo(
    () => activePage.objects.filter((o) => selectedIds.includes(o.id)),
    [activePage.objects, selectedIds]
  );
  const primarySelected = selectedObjects.length === 1 ? selectedObjects[0] : null;
  const selectedTextObj = primarySelected?.kind === 'text' ? primarySelected : null;
  const selectedImageObj = primarySelected?.kind === 'image' ? primarySelected : null;
  const selectedShapeObj = primarySelected?.kind === 'shape' ? primarySelected : null;
  const selectedTableObj = primarySelected?.kind === 'table' ? primarySelected : null;

  const activeBodyStyle: NotebookBodyStyle = useMemo(
    () => ({ ...DEFAULT_BODY_STYLE, ...(activePage.bodyStyle ?? {}) }),
    [activePage.bodyStyle]
  );

  // Unified typography values: apply to selected floating text box OR directly to the Word page sheet
  const currentFontFamily = selectedTextObj?.fontFamily ?? activeBodyStyle.fontFamily;
  const currentFontSize = selectedTextObj?.fontSize ?? activeBodyStyle.fontSize;
  const currentBold = selectedTextObj ? selectedTextObj.bold : activeBodyStyle.bold;
  const currentItalic = selectedTextObj ? Boolean(selectedTextObj.italic) : activeBodyStyle.italic;
  const currentUnderline = selectedTextObj
    ? Boolean(selectedTextObj.underline)
    : activeBodyStyle.underline;
  const currentStrike = selectedTextObj
    ? Boolean(selectedTextObj.strikethrough)
    : activeBodyStyle.strikethrough;
  const currentTextColor = selectedTextObj?.color ?? activeBodyStyle.color;
  const currentHighlightColor =
    selectedTextObj?.highlightColor ?? activeBodyStyle.highlightColor;
  const currentAlign = selectedTextObj?.align ?? activeBodyStyle.align;
  const currentListType = selectedTextObj?.listType ?? activeBodyStyle.listType;
  const currentLineHeight = selectedTextObj?.lineHeight ?? activeBodyStyle.lineHeight;
  const currentLetterSpacing = selectedTextObj?.letterSpacing ?? activeBodyStyle.letterSpacing;

  // Group bounding box for single or multi-object selection
  const selectionBox = useMemo(() => {
    if (selectedObjects.length === 0) return null;
    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const o of selectedObjects) {
      const b = getObjectBounds(o);
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w);
      maxY = Math.max(maxY, b.y + b.h);
    }
    return {
      x: minX,
      y: minY,
      w: Math.max(20, maxX - minX),
      h: Math.max(20, maxY - minY),
    };
  }, [selectedObjects]);

  /* --------------------------------------------------------------------------
   * State Mutation & Unlimited Visual History
   * ------------------------------------------------------------------------*/
  const pushHistorySnapshot = useCallback(
    (label: string) => {
      const snap: HistorySnapshot = {
        id: uid('hist'),
        label,
        timestamp: Date.now(),
        pages: clonePages(notebook.pages),
        activePageIndex: notebook.activePageIndex,
      };
      setPast((prev) => [...prev, snap]);
      setFuture([]);
    },
    [notebook.pages, notebook.activePageIndex]
  );

  const commitNotebookPages = useCallback(
    (
      nextPages: NotebookPage[],
      options?: { recordLabel?: string; nextActivePageIndex?: number }
    ) => {
      if (options?.recordLabel) {
        pushHistorySnapshot(options.recordLabel);
      }
      onChangeNotebook({
        ...notebook,
        pages: nextPages,
        activePageIndex:
          typeof options?.nextActivePageIndex === 'number'
            ? options.nextActivePageIndex
            : notebook.activePageIndex,
        updatedAt: Date.now(),
      });
    },
    [notebook, onChangeNotebook, pushHistorySnapshot]
  );

  const commitActivePageObjects = useCallback(
    (nextObjects: CanvasObject[], recordLabel?: string) => {
      const nextPages = notebook.pages.map((p, idx) =>
        idx === notebook.activePageIndex ? { ...p, objects: nextObjects } : p
      );
      commitNotebookPages(nextPages, { recordLabel });
    },
    [notebook.pages, notebook.activePageIndex, commitNotebookPages]
  );

  const updateActivePage = useCallback(
    (patch: Partial<NotebookPage>, recordLabel?: string) => {
      const nextPages = notebook.pages.map((p, idx) =>
        idx === notebook.activePageIndex ? { ...p, ...patch } : p
      );
      commitNotebookPages(nextPages, { recordLabel });
    },
    [notebook.pages, notebook.activePageIndex, commitNotebookPages]
  );

  const updatePageSetup = useCallback(
    (patch: Partial<NotebookPageSetup>) => {
      onChangeNotebook({
        ...notebook,
        pageSetup: {
          ...pageSetup,
          ...patch,
          marginsMm: patch.marginsMm ? { ...pageSetup.marginsMm, ...patch.marginsMm } : pageSetup.marginsMm,
        },
        updatedAt: Date.now(),
      });
    },
    [notebook, pageSetup, onChangeNotebook]
  );

  const handleUndo = useCallback(() => {
    if (past.length === 0) return;
    const prevSnap = past[past.length - 1];
    const currentSnap: HistorySnapshot = {
      id: uid('hist'),
      label: prevSnap.label,
      timestamp: Date.now(),
      pages: clonePages(notebook.pages),
      activePageIndex: notebook.activePageIndex,
    };
    setPast((p) => p.slice(0, -1));
    setFuture((f) => [currentSnap, ...f]);
    onChangeNotebook({
      ...notebook,
      pages: prevSnap.pages,
      activePageIndex: Math.min(prevSnap.activePageIndex, prevSnap.pages.length - 1),
      updatedAt: Date.now(),
    });
  }, [past, notebook, onChangeNotebook]);

  const handleRedo = useCallback(() => {
    if (future.length === 0) return;
    const nextSnap = future[0];
    const currentSnap: HistorySnapshot = {
      id: uid('hist'),
      label: nextSnap.label,
      timestamp: Date.now(),
      pages: clonePages(notebook.pages),
      activePageIndex: notebook.activePageIndex,
    };
    setFuture((f) => f.slice(1));
    setPast((p) => [...p, currentSnap]);
    onChangeNotebook({
      ...notebook,
      pages: nextSnap.pages,
      activePageIndex: Math.min(nextSnap.activePageIndex, nextSnap.pages.length - 1),
      updatedAt: Date.now(),
    });
  }, [future, notebook, onChangeNotebook]);

  const jumpToPast = (index: number) => {
    const target = past[index];
    if (!target) return;
    const currentSnap: HistorySnapshot = {
      id: uid('hist'),
      label: 'Antes de saltar en historial',
      timestamp: Date.now(),
      pages: clonePages(notebook.pages),
      activePageIndex: notebook.activePageIndex,
    };
    const movedToFuture = [...past.slice(index + 1), currentSnap];
    setPast(past.slice(0, index));
    setFuture([...movedToFuture.reverse(), ...future]);
    onChangeNotebook({
      ...notebook,
      pages: target.pages,
      activePageIndex: Math.min(target.activePageIndex, target.pages.length - 1),
      updatedAt: Date.now(),
    });
  };

  const jumpToFuture = (index: number) => {
    const target = future[index];
    if (!target) return;
    const currentSnap: HistorySnapshot = {
      id: uid('hist'),
      label: target.label,
      timestamp: Date.now(),
      pages: clonePages(notebook.pages),
      activePageIndex: notebook.activePageIndex,
    };
    setPast([...past, currentSnap, ...future.slice(0, index)]);
    setFuture(future.slice(index + 1));
    onChangeNotebook({
      ...notebook,
      pages: target.pages,
      activePageIndex: Math.min(target.activePageIndex, target.pages.length - 1),
      updatedAt: Date.now(),
    });
  };

  /* --------------------------------------------------------------------------
   * High-DPI Ink & Raster Layer Rendering (requestAnimationFrame)
   * ------------------------------------------------------------------------*/
  const redrawInkCanvas = useCallback(() => {
    const canvas = inkCanvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const targetW = Math.round(geom.w * dpr);
    const targetH = Math.round(geom.h * dpr);
    if (canvas.width !== targetW || canvas.height !== targetH) {
      canvas.width = targetW;
      canvas.height = targetH;
    }

    ctx.setTransform(dpr, 0, 0, dpr, 0, 0);
    ctx.clearRect(0, 0, geom.w, geom.h);

    const layerMap = new Map(notebook.layers.map((l) => [l.id, l]));
    for (const obj of activePage.objects) {
      if (obj.kind !== 'stroke') continue;
      const grp = layerMap.get(obj.layerId);
      if (obj.visible === false || (grp && !grp.visible)) continue;
      renderStrokeToCanvas(ctx, obj);
    }

    if (activeStrokeRef.current) {
      renderStrokeToCanvas(ctx, activeStrokeRef.current);
    }
  }, [activePage.objects, geom.w, geom.h, notebook.layers]);

  const scheduleInkRedraw = useCallback(() => {
    cancelAnimationFrame(rafRedrawRef.current);
    rafRedrawRef.current = requestAnimationFrame(() => {
      redrawInkCanvas();
    });
  }, [redrawInkCanvas]);

  useEffect(() => {
    scheduleInkRedraw();
    return () => cancelAnimationFrame(rafRedrawRef.current);
  }, [scheduleInkRedraw]);

  // Sync raster overlay canvas (flood fill & pixel eraser)
  useEffect(() => {
    const canvas = rasterCanvasRef.current;
    if (!canvas) return;
    canvas.width = geom.w;
    canvas.height = geom.h;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;
    ctx.clearRect(0, 0, geom.w, geom.h);
    if (activePage.rasterDataUrl) {
      const img = new Image();
      img.onload = () => {
        ctx.clearRect(0, 0, geom.w, geom.h);
        ctx.drawImage(img, 0, 0, geom.w, geom.h);
      };
      img.src = activePage.rasterDataUrl;
    }
  }, [activePage.id, activePage.rasterDataUrl, geom.w, geom.h]);

  /* --------------------------------------------------------------------------
   * Object Creation Helpers (Text, Shapes, Images, Tables, Stickies, Stickers)
   * ------------------------------------------------------------------------*/
  const addObject = useCallback(
    (obj: CanvasObject, label: string) => {
      commitActivePageObjects([...activePage.objects, obj], label);
      setSelectedIds([obj.id]);
      setTool('select');
    },
    [activePage.objects, commitActivePageObjects]
  );

  const updateObject = useCallback(
    (id: string, patch: Partial<CanvasObject>, recordUndo = false) => {
      commitActivePageObjects(
        activePage.objects.map((o) => (o.id === id ? ({ ...o, ...patch } as CanvasObject) : o)),
        recordUndo ? 'Editar propiedades' : undefined
      );
    },
    [activePage.objects, commitActivePageObjects]
  );

  const applyTypographyPatch = useCallback(
    (patch: Partial<NotebookBodyStyle>) => {
      if (selectedTextObj) {
        updateObject(selectedTextObj.id, patch as Partial<TextCanvasObject>, true);
      } else {
        setDocumentBodyOpen(true);
        const nextStyle: NotebookBodyStyle = { ...activeBodyStyle, ...patch };
        // If toggling list type on existing body text, format current lines nicely
        let nextBodyText = activePage.bodyText ?? '';
        if (patch.listType && patch.listType !== activeBodyStyle.listType) {
          const lines = (nextBodyText || '').split('\n');
          const stripped = lines.map((l) => l.replace(/^(?:•\s+|\d+\.\s+)/, ''));
          if (patch.listType === 'bullet') {
            nextBodyText = stripped.map((l) => (l.trim() ? `• ${l}` : '• ')).join('\n');
          } else if (patch.listType === 'number') {
            nextBodyText = stripped.map((l, i) => `${i + 1}. ${l}`).join('\n');
          } else {
            nextBodyText = stripped.join('\n');
          }
          updateActivePage({ bodyStyle: nextStyle, bodyText: nextBodyText }, 'Formato de texto');
        } else {
          updateActivePage({ bodyStyle: nextStyle }, 'Formato de texto');
        }
        window.requestAnimationFrame(() => bodyTextareaRef.current?.focus());
      }
    },
    [selectedTextObj, updateObject, activeBodyStyle, activePage.bodyText, updateActivePage]
  );

  const addTextBox = (preset?: Partial<TextCanvasObject>) => {
    const obj: TextCanvasObject = {
      id: uid('txt'),
      kind: 'text',
      layerId: 'content',
      name: preset?.isBanner ? 'Título' : 'Cuadro de texto',
      x: marginsPx.left + 20,
      y: marginsPx.top + 20 + (activePage.objects.length % 5) * 24,
      w: Math.min(540, geom.w - marginsPx.left - marginsPx.right - 20),
      h: preset?.isBanner ? 74 : 110,
      opacity: 1,
      visible: true,
      locked: false,
      rotation: 0,
      text: preset?.text ?? 'Doble clic para escribir...',
      fontFamily: preset?.fontFamily ?? 'Plus Jakarta Sans',
      fontSize: preset?.fontSize ?? 16,
      bold: preset?.bold ?? false,
      italic: preset?.italic ?? false,
      underline: false,
      strikethrough: false,
      color: preset?.color ?? '#1A2233',
      highlightColor: 'transparent',
      fillColor: preset?.fillColor ?? 'transparent',
      borderColor: preset?.borderColor ?? 'transparent',
      align: preset?.align ?? 'left',
      lineHeight: 1.5,
      letterSpacing: 0,
      listType: 'none',
      script: 'normal',
      indentPx: 0,
      columns: 1,
      isBanner: preset?.isBanner,
    };
    addObject(obj, 'Añadir cuadro de texto');
    setEditingId(obj.id);
  };

  const addShape = (shape: ShapeKind) => {
    const isLine = shape === 'line' || shape === 'arrow';
    const obj: ShapeCanvasObject = {
      id: uid('shp'),
      kind: 'shape',
      layerId: 'content',
      name: SHAPE_CATALOG.find((s) => s.kind === shape)?.label ?? 'Forma',
      shape,
      x: Math.round(geom.w / 2 - 110 + (activePage.objects.length % 4) * 18),
      y: Math.round(geom.h * 0.25 + (activePage.objects.length % 4) * 18),
      w: isLine ? 240 : 180,
      h: isLine ? 44 : 140,
      opacity: 1,
      visible: true,
      locked: false,
      rotation: 0,
      strokeColor: activeBrush.color,
      fillColor: isLine ? 'transparent' : `${activeBrush.color}22`,
      strokeWidth: 2.5,
      borderRadius: shape === 'rect' ? 12 : 0,
      lineStyle: 'solid',
    };
    addObject(obj, `Añadir ${obj.name}`);
  };

  const addSticky = (bgColor: string, textColor: string) => {
    const obj: StickyCanvasObject = {
      id: uid('stk'),
      kind: 'sticky',
      layerId: 'content',
      name: 'Nota adhesiva',
      x: marginsPx.left + 40 + (activePage.objects.length % 4) * 22,
      y: marginsPx.top + 60 + (activePage.objects.length % 4) * 22,
      w: 220,
      h: 165,
      opacity: 1,
      visible: true,
      locked: false,
      rotation: 0,
      text: 'Nota rápida\nDoble clic para editar...',
      bgColor,
      textColor,
    };
    addObject(obj, 'Añadir nota adhesiva');
  };

  const addTable = (rows = 3, cols = 3) => {
    const cells: string[] = [];
    for (let r = 0; r < rows; r++) {
      for (let c = 0; c < cols; c++) {
        cells.push(r === 0 ? `Columna ${c + 1}` : '');
      }
    }
    const obj: TableCanvasObject = {
      id: uid('tbl'),
      kind: 'table',
      layerId: 'content',
      name: `Tabla ${rows}×${cols}`,
      x: marginsPx.left + 10,
      y: marginsPx.top + 80,
      w: Math.min(720, geom.w - marginsPx.left - marginsPx.right - 20),
      h: rows * 48,
      opacity: 1,
      visible: true,
      locked: false,
      rotation: 0,
      rows,
      cols,
      cells,
      headerBg: '#EFF6FF',
      borderColor: '#94A3B8',
      cellStyles: {},
    };
    addObject(obj, 'Insertar tabla');
  };

  const addSticker = (s: (typeof STICKERS)[number]) => {
    const obj: StickerCanvasObject = {
      id: uid('tag'),
      kind: 'sticker',
      layerId: 'content',
      name: `Sticker ${s.label}`,
      x: marginsPx.left + 40,
      y: marginsPx.top + 40,
      w: 132,
      h: 42,
      opacity: 1,
      visible: true,
      locked: false,
      rotation: 0,
      symbol: s.symbol,
      label: s.label,
      color: s.color,
      bgColor: s.bg,
    };
    addObject(obj, `Añadir sticker ${s.label}`);
  };

  const insertImageFile = useCallback(
    (file: File, dropCoords?: { x: number; y: number }) => {
      if (!file.type.startsWith('image/')) return;
      const reader = new FileReader();
      reader.onload = () => {
        const src = String(reader.result || '');
        const img = new Image();
        img.onload = () => {
          const maxW = Math.min(460, geom.w - marginsPx.left - marginsPx.right);
          const ratio = img.naturalHeight / Math.max(1, img.naturalWidth);
          const w = Math.min(maxW, Math.max(140, img.naturalWidth));
          const h = Math.round(w * ratio);
          const obj: ImageCanvasObject = {
            id: uid('img'),
            kind: 'image',
            layerId: 'content',
            name: file.name.replace(/\.[^.]+$/, '') || 'Imagen',
            x: dropCoords ? Math.max(0, dropCoords.x - w / 2) : Math.round((geom.w - w) / 2),
            y: dropCoords ? Math.max(0, dropCoords.y - h / 2) : marginsPx.top + 40,
            w,
            h,
            opacity: 1,
            visible: true,
            locked: false,
            rotation: 0,
            src,
            alt: file.name,
            naturalWidth: img.naturalWidth,
            naturalHeight: img.naturalHeight,
            crop: { top: 0, right: 0, bottom: 0, left: 0 },
            flipX: false,
            flipY: false,
            borderRadius: 6,
          };
          addObject(obj, 'Insertar imagen');
          showToast(`Imagen «${obj.name}» insertada`);
        };
        img.src = src;
      };
      reader.readAsDataURL(file);
    },
    [addObject, geom.w, marginsPx.left, marginsPx.right, marginsPx.top, showToast]
  );

  /* --------------------------------------------------------------------------
   * Multi-Object Actions: Copy, Cut, Paste, Duplicate, Delete, Group, Align, Distribute
   * ------------------------------------------------------------------------*/
  const duplicateSelected = useCallback(() => {
    if (selectedObjects.length === 0) return;
    const groupMap = new Map<string, string>();
    const clones: CanvasObject[] = selectedObjects.map((o) => {
      let nextGroup = o.groupId;
      if (nextGroup) {
        if (!groupMap.has(nextGroup)) groupMap.set(nextGroup, uid('grp'));
        nextGroup = groupMap.get(nextGroup);
      }
      if (o.kind === 'stroke') {
        return {
          ...o,
          id: uid('str'),
          groupId: nextGroup,
          x: o.x + 24,
          y: o.y + 24,
          points: o.points.map((pt) => ({ ...pt, x: pt.x + 24, y: pt.y + 24 })),
        };
      }
      return {
        ...o,
        id: uid(o.kind),
        groupId: nextGroup,
        x: o.x + 24,
        y: o.y + 24,
      };
    });
    commitActivePageObjects([...activePage.objects, ...clones], 'Duplicar selección');
    setSelectedIds(clones.map((c) => c.id));
  }, [selectedObjects, activePage.objects, commitActivePageObjects]);

  const deleteSelected = useCallback(() => {
    if (selectedIds.length === 0) return;
    const set = new Set(selectedIds);
    const remaining = activePage.objects.filter((o) => !set.has(o.id) || o.locked);
    commitActivePageObjects(remaining, 'Eliminar objetos');
    setSelectedIds([]);
    setEditingId(null);
  }, [selectedIds, activePage.objects, commitActivePageObjects]);

  const copySelected = useCallback(() => {
    if (selectedObjects.length === 0) return;
    writeSharedClipboard(selectedObjects);
    showToast(`${selectedObjects.length} elemento${selectedObjects.length === 1 ? '' : 's'} copiado(s)`);
  }, [selectedObjects, showToast]);

  const cutSelected = useCallback(() => {
    if (selectedObjects.length === 0) return;
    writeSharedClipboard(selectedObjects);
    deleteSelected();
    showToast('Selección cortada al portapapeles');
  }, [selectedObjects, deleteSelected, showToast]);

  const pasteFromSharedClipboard = useCallback(() => {
    const items = readSharedClipboard();
    if (items.length === 0) return;
    const clones: CanvasObject[] = items.map((o) => {
      if (o.kind === 'stroke') {
        return {
          ...o,
          id: uid('str'),
          points: o.points.map((pt) => ({ ...pt, x: pt.x + 22, y: pt.y + 22 })),
        };
      }
      return { ...o, id: uid(o.kind), x: o.x + 22, y: o.y + 22 };
    });
    commitActivePageObjects([...activePage.objects, ...clones], 'Pegar desde portapapeles');
    setSelectedIds(clones.map((c) => c.id));
    showToast(`Pegado (${clones.length})`);
  }, [activePage.objects, commitActivePageObjects, showToast]);

  const groupSelected = useCallback(() => {
    if (selectedIds.length < 2) return;
    const newGroupId = uid('grp');
    const selSet = new Set(selectedIds);
    commitActivePageObjects(
      activePage.objects.map((o) => (selSet.has(o.id) ? { ...o, groupId: newGroupId } : o)),
      'Agrupar objetos'
    );
    showToast('Objetos agrupados');
  }, [selectedIds, activePage.objects, commitActivePageObjects, showToast]);

  const ungroupSelected = useCallback(() => {
    const selSet = new Set(selectedIds);
    commitActivePageObjects(
      activePage.objects.map((o) => (selSet.has(o.id) ? { ...o, groupId: undefined } : o)),
      'Desagrupar objetos'
    );
    showToast('Grupo separado');
  }, [selectedIds, activePage.objects, commitActivePageObjects, showToast]);

  const alignSelected = (
    alignment: 'left' | 'centerH' | 'right' | 'top' | 'middleV' | 'bottom'
  ) => {
    if (selectedObjects.length === 0) return;
    const refBox =
      selectedObjects.length === 1
        ? {
            x: marginsPx.left,
            y: marginsPx.top,
            w: geom.w - marginsPx.left - marginsPx.right,
            h: geom.h - marginsPx.top - marginsPx.bottom,
          }
        : selectionBox!;

    const selSet = new Set(selectedIds);
    const next = activePage.objects.map((o) => {
      if (!selSet.has(o.id) || o.locked) return o;
      const b = getObjectBounds(o);
      let dx = 0;
      let dy = 0;
      if (alignment === 'left') dx = refBox.x - b.x;
      else if (alignment === 'centerH') dx = refBox.x + refBox.w / 2 - (b.x + b.w / 2);
      else if (alignment === 'right') dx = refBox.x + refBox.w - (b.x + b.w);
      else if (alignment === 'top') dy = refBox.y - b.y;
      else if (alignment === 'middleV') dy = refBox.y + refBox.h / 2 - (b.y + b.h / 2);
      else if (alignment === 'bottom') dy = refBox.y + refBox.h - (b.y + b.h);

      if (o.kind === 'stroke') {
        return {
          ...o,
          x: o.x + dx,
          y: o.y + dy,
          points: o.points.map((pt) => ({ ...pt, x: pt.x + dx, y: pt.y + dy })),
        };
      }
      return { ...o, x: Math.round(o.x + dx), y: Math.round(o.y + dy) };
    });
    commitActivePageObjects(next, 'Alinear objetos');
  };

  const distributeSelected = (axis: 'h' | 'v') => {
    if (selectedObjects.length < 3) return;
    const withBounds = selectedObjects
      .filter((o) => !o.locked)
      .map((o) => ({ obj: o, b: getObjectBounds(o) }));
    if (withBounds.length < 3) return;

    withBounds.sort((a, b) => (axis === 'h' ? a.b.x - b.b.x : a.b.y - b.b.y));
    const first = withBounds[0].b;
    const last = withBounds[withBounds.length - 1].b;

    const totalSize = withBounds.reduce(
      (sum, item) => sum + (axis === 'h' ? item.b.w : item.b.h),
      0
    );
    const span =
      axis === 'h' ? last.x + last.w - first.x : last.y + last.h - first.y;
    const gap = (span - totalSize) / (withBounds.length - 1);

    let cursor = axis === 'h' ? first.x : first.y;
    const deltas = new Map<string, { dx: number; dy: number }>();
    for (const item of withBounds) {
      if (axis === 'h') {
        deltas.set(item.obj.id, { dx: cursor - item.b.x, dy: 0 });
        cursor += item.b.w + gap;
      } else {
        deltas.set(item.obj.id, { dx: 0, dy: cursor - item.b.y });
        cursor += item.b.h + gap;
      }
    }

    const next = activePage.objects.map((o) => {
      const d = deltas.get(o.id);
      if (!d) return o;
      if (o.kind === 'stroke') {
        return {
          ...o,
          points: o.points.map((pt) => ({ ...pt, x: pt.x + d.dx, y: pt.y + d.dy })),
        };
      }
      return { ...o, x: Math.round(o.x + d.dx), y: Math.round(o.y + d.dy) };
    });
    commitActivePageObjects(next, 'Distribuir uniformemente');
  };

  /* --------------------------------------------------------------------------
   * Table Editing Actions (Insert/Remove Row/Col, Merge Cells)
   * ------------------------------------------------------------------------*/
  const mutateSelectedTable = (
    action: 'addRow' | 'delRow' | 'addCol' | 'delCol' | 'mergeRight'
  ) => {
    if (!selectedTableObj) return;
    const tbl = selectedTableObj;
    if (action === 'addRow') {
      updateObject(
        tbl.id,
        {
          rows: tbl.rows + 1,
          h: tbl.h + 44,
          cells: [...tbl.cells, ...Array(tbl.cols).fill('')],
        },
        true
      );
    } else if (action === 'delRow' && tbl.rows > 1) {
      updateObject(
        tbl.id,
        {
          rows: tbl.rows - 1,
          h: Math.max(60, tbl.h - 44),
          cells: tbl.cells.slice(0, (tbl.rows - 1) * tbl.cols),
        },
        true
      );
    } else if (action === 'addCol') {
      const nextCells: string[] = [];
      for (let r = 0; r < tbl.rows; r++) {
        for (let c = 0; c < tbl.cols; c++) {
          nextCells.push(tbl.cells[r * tbl.cols + c] ?? '');
        }
        nextCells.push(r === 0 ? `Col. ${tbl.cols + 1}` : '');
      }
      updateObject(tbl.id, { cols: tbl.cols + 1, cells: nextCells, cellStyles: {} }, true);
    } else if (action === 'delCol' && tbl.cols > 1) {
      const nextCells: string[] = [];
      for (let r = 0; r < tbl.rows; r++) {
        for (let c = 0; c < tbl.cols - 1; c++) {
          nextCells.push(tbl.cells[r * tbl.cols + c] ?? '');
        }
      }
      updateObject(tbl.id, { cols: tbl.cols - 1, cells: nextCells, cellStyles: {} }, true);
    } else if (action === 'mergeRight') {
      const idx = selectedTableCell ?? 0;
      const col = idx % tbl.cols;
      if (col >= tbl.cols - 1) {
        showToast('Selecciona una celda que no sea la última columna para combinar');
        return;
      }
      const nextStyles = { ...(tbl.cellStyles ?? {}) };
      const currSpan = nextStyles[idx]?.colSpan ?? 1;
      const neighborIdx = idx + currSpan;
      if (col + currSpan >= tbl.cols) return;
      nextStyles[idx] = { ...(nextStyles[idx] ?? {}), colSpan: currSpan + 1 };
      nextStyles[neighborIdx] = { ...(nextStyles[neighborIdx] ?? {}), hidden: true };
      const mergedText = [tbl.cells[idx], tbl.cells[neighborIdx]].filter(Boolean).join(' ');
      const nextCells = [...tbl.cells];
      nextCells[idx] = mergedText;
      nextCells[neighborIdx] = '';
      updateObject(tbl.id, { cells: nextCells, cellStyles: nextStyles }, true);
    }
  };

  /* --------------------------------------------------------------------------
   * Page Management (Add, Page Break, Duplicate, Delete, Reorder)
   * ------------------------------------------------------------------------*/
  const addNewPage = (insertAfterCurrent = false) => {
    const newPage: NotebookPage = {
      id: uid('pg'),
      title: `Página ${notebook.pages.length + 1}`,
      pattern: activePage.pattern,
      backgroundColor: activePage.backgroundColor,
      objects: [],
      bodyText: '',
    };
    const nextPages = [...notebook.pages];
    const insertIdx = insertAfterCurrent
      ? notebook.activePageIndex + 1
      : notebook.pages.length;
    nextPages.splice(insertIdx, 0, newPage);
    commitNotebookPages(nextPages, {
      recordLabel: insertAfterCurrent ? 'Salto de página' : 'Nueva página',
      nextActivePageIndex: insertIdx,
    });
    setSelectedIds([]);
  };

  const duplicateCurrentPage = () => {
    const cloned: NotebookPage = {
      ...(JSON.parse(JSON.stringify(activePage)) as NotebookPage),
      id: uid('pg'),
      title: `${activePage.title} (copia)`,
    };
    const nextPages = [...notebook.pages];
    nextPages.splice(notebook.activePageIndex + 1, 0, cloned);
    commitNotebookPages(nextPages, {
      recordLabel: 'Duplicar página',
      nextActivePageIndex: notebook.activePageIndex + 1,
    });
  };

  const deletePage = (idx: number) => {
    if (notebook.pages.length <= 1) return;
    const nextPages = notebook.pages.filter((_, i) => i !== idx);
    commitNotebookPages(nextPages, {
      recordLabel: 'Eliminar página',
      nextActivePageIndex: Math.max(0, Math.min(notebook.activePageIndex, nextPages.length - 1)),
    });
    setSelectedIds([]);
  };

  const movePageOrder = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= notebook.pages.length) return;
    const nextPages = [...notebook.pages];
    [nextPages[idx], nextPages[target]] = [nextPages[target], nextPages[idx]];
    commitNotebookPages(nextPages, {
      recordLabel: 'Reordenar páginas',
      nextActivePageIndex: target,
    });
  };

  /* --------------------------------------------------------------------------
   * Find & Replace across Notebook
   * ------------------------------------------------------------------------*/
  const handleReplaceAll = (findText: string, replaceText: string, allPages: boolean): number => {
    const escaped = findText.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
    const regex = new RegExp(escaped, 'gi');
    let totalReplaced = 0;

    const replaceStr = (s: string) => {
      const matches = s.match(regex);
      if (!matches) return s;
      totalReplaced += matches.length;
      return s.replace(regex, replaceText);
    };

    const nextPages = notebook.pages.map((p, idx) => {
      if (!allPages && idx !== notebook.activePageIndex) return p;
      return {
        ...p,
        bodyText: p.bodyText ? replaceStr(p.bodyText) : p.bodyText,
        objects: p.objects.map((o) => {
          if (o.kind === 'text' || o.kind === 'sticky') {
            return { ...o, text: replaceStr(o.text) };
          }
          if (o.kind === 'table') {
            return { ...o, cells: o.cells.map(replaceStr) };
          }
          return o;
        }),
      };
    });

    if (totalReplaced > 0) {
      commitNotebookPages(nextPages, { recordLabel: `Reemplazar «${findText}»` });
    }
    return totalReplaced;
  };

  /* --------------------------------------------------------------------------
   * Zoom Fit-to-Screen, Ctrl+Wheel, Pinch, and Global Keyboard & Paste Listeners
   * ------------------------------------------------------------------------*/
  const fitPageToScreen = useCallback(() => {
    const el = viewportScrollRef.current;
    if (!el) return;
    const padX = pageSetup.showRulers ? 96 : 64;
    const padY = pageSetup.showRulers ? 96 : 64;
    const availW = Math.max(240, el.clientWidth - padX);
    const availH = Math.max(240, el.clientHeight - padY);
    const fit = Math.min(availW / geom.w, availH / geom.h, 1.5);
    setZoom(Math.max(0.25, Number(fit.toFixed(2))));
  }, [geom.w, geom.h, pageSetup.showRulers]);

  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      const target = e.target as HTMLElement | null;
      const isInput =
        target &&
        (target.tagName === 'INPUT' ||
          target.tagName === 'TEXTAREA' ||
          target.tagName === 'SELECT' ||
          target.isContentEditable);

      if (e.code === 'Space' && !isInput) {
        setSpacePressed(true);
      }

      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'f') {
        e.preventDefault();
        setFindOpen(true);
        return;
      }
      if ((e.ctrlKey || e.metaKey) && e.key.toLowerCase() === 'h') {
        e.preventDefault();
        setFindOpen(true);
        return;
      }

      if (editingId || isInput) return;

      const mod = e.ctrlKey || e.metaKey;
      const k = e.key.toLowerCase();

      if (mod && k === 'z') {
        e.preventDefault();
        if (e.shiftKey) handleRedo();
        else handleUndo();
      } else if (mod && k === 'y') {
        e.preventDefault();
        handleRedo();
      } else if (mod && k === 'a') {
        e.preventDefault();
        setSelectedIds(
          activePage.objects.filter((o) => o.visible !== false && !o.locked).map((o) => o.id)
        );
      } else if (mod && k === 'c') {
        if (selectedIds.length > 0) {
          e.preventDefault();
          copySelected();
        }
      } else if (mod && k === 'x') {
        if (selectedIds.length > 0) {
          e.preventDefault();
          cutSelected();
        }
      } else if (mod && k === 'v') {
        // Also handled by native paste event for images; fallback to shared objects clipboard
        if (readSharedClipboard().length > 0) {
          e.preventDefault();
          pasteFromSharedClipboard();
        }
      } else if (mod && k === 'd') {
        e.preventDefault();
        duplicateSelected();
      } else if (mod && k === 'g') {
        e.preventDefault();
        const hasGrp = selectedObjects.some((o) => Boolean(o.groupId));
        if (hasGrp) ungroupSelected();
        else groupSelected();
      } else if (mod && k === '0') {
        e.preventDefault();
        fitPageToScreen();
      } else if ((e.key === 'Delete' || e.key === 'Backspace') && selectedIds.length > 0) {
        e.preventDefault();
        deleteSelected();
      } else if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key) && selectedIds.length > 0) {
        e.preventDefault();
        const step = e.shiftKey ? 10 : 1;
        const dx = e.key === 'ArrowLeft' ? -step : e.key === 'ArrowRight' ? step : 0;
        const dy = e.key === 'ArrowUp' ? -step : e.key === 'ArrowDown' ? step : 0;
        const selSet = new Set(selectedIds);
        commitActivePageObjects(
          activePage.objects.map((o) => {
            if (!selSet.has(o.id) || o.locked) return o;
            if (o.kind === 'stroke') {
              return {
                ...o,
                points: o.points.map((pt) => ({ ...pt, x: pt.x + dx, y: pt.y + dy })),
              };
            }
            return { ...o, x: o.x + dx, y: o.y + dy };
          }),
          'Mover con teclado'
        );
      } else if (!mod && k === 'v') {
        setTool('select');
      } else if (!mod && k === 'p') {
        setTool('pen');
        setDrawerTab('draw');
      } else if (!mod && k === 'e') {
        setTool('eraser');
        setDrawerTab('draw');
      } else if (!mod && k === 't') {
        setTool('text');
      } else if (e.key === 'Escape') {
        setSelectedIds([]);
        setEditingId(null);
        setCropEditorOpen(false);
      }
    };

    const onKeyUp = (e: KeyboardEvent) => {
      if (e.code === 'Space') setSpacePressed(false);
    };

    const onPaste = (e: ClipboardEvent) => {
      const items = Array.from(e.clipboardData?.items ?? []);
      const imgItem = items.find((i) => i.type.startsWith('image/'));
      if (imgItem) {
        const file = imgItem.getAsFile();
        if (file) {
          e.preventDefault();
          insertImageFile(file);
        }
      }
    };

    window.addEventListener('keydown', onKeyDown);
    window.addEventListener('keyup', onKeyUp);
    window.addEventListener('paste', onPaste);
    return () => {
      window.removeEventListener('keydown', onKeyDown);
      window.removeEventListener('keyup', onKeyUp);
      window.removeEventListener('paste', onPaste);
    };
  }, [
    editingId,
    selectedIds,
    selectedObjects,
    activePage.objects,
    handleUndo,
    handleRedo,
    copySelected,
    cutSelected,
    pasteFromSharedClipboard,
    duplicateSelected,
    deleteSelected,
    groupSelected,
    ungroupSelected,
    fitPageToScreen,
    commitActivePageObjects,
    insertImageFile,
  ]);

  /* --------------------------------------------------------------------------
   * Pointer Coordinate Helpers, Smart Snap, Drawing, Marquee, Move/Resize/Rotate
   * ------------------------------------------------------------------------*/
  const clientToPage = (clientX: number, clientY: number) => {
    const rect = pageContainerRef.current?.getBoundingClientRect();
    if (!rect) return { x: 0, y: 0 };
    return {
      x: (clientX - rect.left) / zoom,
      y: (clientY - rect.top) / zoom,
    };
  };

  const expandSelectionWithGroups = (baseIds: string[]): string[] => {
    const groupIds = new Set<string>();
    for (const id of baseIds) {
      const o = activePage.objects.find((item) => item.id === id);
      if (o?.groupId) groupIds.add(o.groupId);
    }
    if (groupIds.size === 0) return baseIds;
    const out = new Set(baseIds);
    for (const o of activePage.objects) {
      if (o.groupId && groupIds.has(o.groupId)) out.add(o.id);
    }
    return Array.from(out);
  };

  const handleViewportWheel = (e: React.WheelEvent) => {
    if (e.ctrlKey || e.metaKey) {
      e.preventDefault();
      const delta = e.deltaY < 0 ? 0.08 : -0.08;
      setZoom((z) => Math.max(0.25, Math.min(2.5, Number((z + delta).toFixed(2)))));
    }
  };

  const handleTouchMovePinch = (e: React.TouchEvent) => {
    if (e.touches.length === 2) {
      const dx = e.touches[0].clientX - e.touches[1].clientX;
      const dy = e.touches[0].clientY - e.touches[1].clientY;
      const dist = Math.hypot(dx, dy);
      if (pinchDistRef.current !== null) {
        const diff = (dist - pinchDistRef.current) * 0.003;
        setZoom((z) => Math.max(0.25, Math.min(2.5, Number((z + diff).toFixed(2)))));
      }
      pinchDistRef.current = dist;
    }
  };

  const handlePagePointerDown = (e: React.PointerEvent<HTMLDivElement>) => {
    // Spacebar or Pan tool pans the viewport
    if (tool === 'pan' || spacePressed) {
      const scroller = viewportScrollRef.current;
      if (!scroller) return;
      panDragRef.current = {
        startX: e.clientX,
        startY: e.clientY,
        scrollLeft: scroller.scrollLeft,
        scrollTop: scroller.scrollTop,
      };
      e.currentTarget.setPointerCapture(e.pointerId);
      return;
    }

    const pt = clientToPage(e.clientX, e.clientY);

    // Quick text placement
    if (tool === 'text') {
      const obj: TextCanvasObject = {
        id: uid('txt'),
        kind: 'text',
        layerId: 'content',
        name: 'Cuadro de texto',
        x: Math.round(pt.x),
        y: Math.round(pt.y),
        w: 300,
        h: 96,
        opacity: 1,
        visible: true,
        locked: false,
        rotation: 0,
        text: 'Escribe aquí...',
        fontFamily: 'Plus Jakarta Sans',
        fontSize: 16,
        bold: false,
        color: '#1A2233',
        fillColor: 'transparent',
        borderColor: 'transparent',
        align: 'left',
        lineHeight: 1.5,
      };
      addObject(obj, 'Insertar texto');
      setEditingId(obj.id);
      return;
    }

    // Flood Fill (Paint Bucket — uses its own independent fillSettings)
    if (tool === 'fill') {
      const rCanvas = rasterCanvasRef.current;
      if (rCanvas) {
        const ok = floodFillCanvas(
          rCanvas,
          pt.x,
          pt.y,
          fillSettings.color,
          fillSettings.opacity,
          fillSettings.tolerance
        );
        if (ok) {
          updateActivePage({ rasterDataUrl: rCanvas.toDataURL('image/png') }, 'Relleno (Bote de pintura)');
        }
      }
      return;
    }

    // Drawing (Brush / Highlighter — uses ONLY the active brush tip's isolated config)
    if (tool === 'pen' || tool === 'highlighter') {
      isDrawingRef.current = true;
      e.currentTarget.setPointerCapture(e.pointerId);
      const pressure = e.pressure > 0 ? e.pressure : 0.5;
      setLastPressure(pressure);

      activeStrokeRef.current = {
        id: uid('str'),
        kind: 'stroke',
        layerId: activeBrushTip === 'highlighter' ? 'underlay' : 'ink',
        name: `Trazo (${BRUSH_TIPS.find((b) => b.id === activeBrushTip)?.label ?? 'Pincel'})`,
        tool: activeBrushTip === 'highlighter' ? 'highlighter' : 'pen',
        brushTip: activeBrushTip,
        color: activeBrush.color,
        strokeWidth: activeBrush.size,
        opacity: activeBrush.opacity,
        hardness: activeBrush.hardness,
        smoothing: activeBrush.smoothing,
        lineStyle: activeBrush.lineStyle,
        pressureEnabled: activeBrush.pressureEnabled,
        visible: true,
        locked: false,
        x: pt.x,
        y: pt.y,
        w: 10,
        h: 10,
        points: [{ x: pt.x, y: pt.y, p: pressure }],
      };
      scheduleInkRedraw();
      return;
    }

    // Eraser (Mode 1: Transparent-paint precise area erase; Mode 2: Full touched stroke delete)
    if (tool === 'eraser') {
      isDrawingRef.current = true;
      setIsErasingNow(true);
      setEraserCursorPos(pt);
      e.currentTarget.setPointerCapture(e.pointerId);

      if (eraserSettings.mode === 'pixel') {
        // Transparent-paint eraser stroke over ink canvas (leaves paper/grid untouched!)
        activeStrokeRef.current = {
          id: uid('ers'),
          kind: 'stroke',
          layerId: 'ink',
          name: 'Borrado preciso',
          tool: 'eraser',
          color: 'transparent',
          strokeWidth: eraserSettings.size,
          opacity: eraserSettings.opacity,
          hardness: eraserSettings.hardness,
          smoothing: 15,
          lineStyle: 'solid',
          pressureEnabled: false,
          visible: true,
          locked: false,
          x: pt.x,
          y: pt.y,
          w: eraserSettings.size,
          h: eraserSettings.size,
          points: [{ x: pt.x, y: pt.y, p: 0.5 }],
        };
        scheduleInkRedraw();

        // Also erase raster fill layer in exact same circular radius
        const rCanvas = rasterCanvasRef.current;
        const rCtx = rCanvas?.getContext('2d');
        if (rCtx) {
          rCtx.save();
          rCtx.globalCompositeOperation = 'destination-out';
          rCtx.globalAlpha = eraserSettings.opacity;
          rCtx.beginPath();
          rCtx.arc(pt.x, pt.y, eraserSettings.size / 2, 0, Math.PI * 2);
          rCtx.fill();
          rCtx.restore();
        }
      } else {
        // Full-stroke eraser: deletes any stroke touched by the visible circular area
        const hitRadius = Math.max(4, eraserSettings.size / 2);
        const remaining = activePage.objects.filter((o) => {
          if (o.kind !== 'stroke' || o.tool === 'eraser' || o.locked) return true;
          return !o.points.some((p) => Math.hypot(p.x - pt.x, p.y - pt.y) <= hitRadius + o.strokeWidth * 0.45);
        });
        if (remaining.length !== activePage.objects.length) {
          commitActivePageObjects(remaining, 'Borrar trazo completo');
        }
      }
      return;
    }

    // Marquee selection on empty page background
    if (tool === 'select' || tool === 'marquee') {
      if (!e.shiftKey) {
        setSelectedIds([]);
      }
      setEditingId(null);
      setCropEditorOpen(false);
      marqueeStartRef.current = pt;
      setMarqueeRect({ x: pt.x, y: pt.y, w: 0, h: 0 });
      e.currentTarget.setPointerCapture(e.pointerId);
    }
  };

  const handlePagePointerMove = (e: React.PointerEvent<HTMLDivElement>) => {
    if (panDragRef.current && viewportScrollRef.current) {
      const dx = e.clientX - panDragRef.current.startX;
      const dy = e.clientY - panDragRef.current.startY;
      viewportScrollRef.current.scrollLeft = panDragRef.current.scrollLeft - dx;
      viewportScrollRef.current.scrollTop = panDragRef.current.scrollTop - dy;
      return;
    }

    const pt = clientToPage(e.clientX, e.clientY);

    // Always track live circular cursor position when Eraser is selected (even before pressing!)
    if (tool === 'eraser') {
      setEraserCursorPos(pt);
    }

    // Active stroke drawing OR transparent-paint pixel eraser dragging
    if (isDrawingRef.current && activeStrokeRef.current) {
      const isEraserStroke = activeStrokeRef.current.tool === 'eraser';
      const pressure = e.pressure > 0 ? e.pressure : 0.5;
      if (!isEraserStroke) setLastPressure(pressure);

      const pts = activeStrokeRef.current.points;
      const smoothed = smoothIncomingPoint(
        pts[pts.length - 1],
        { x: pt.x, y: pt.y, p: pressure },
        isEraserStroke ? 15 : activeBrush.smoothing
      );
      pts.push(smoothed);
      scheduleInkRedraw();

      if (isEraserStroke) {
        const rCtx = rasterCanvasRef.current?.getContext('2d');
        if (rCtx) {
          rCtx.save();
          rCtx.globalCompositeOperation = 'destination-out';
          rCtx.globalAlpha = eraserSettings.opacity;
          rCtx.beginPath();
          rCtx.arc(pt.x, pt.y, eraserSettings.size / 2, 0, Math.PI * 2);
          rCtx.fill();
          rCtx.restore();
        }
      }
      return;
    }

    // Active full-stroke eraser dragging
    if (isDrawingRef.current && tool === 'eraser' && eraserSettings.mode === 'stroke') {
      const hitRadius = Math.max(4, eraserSettings.size / 2);
      const remaining = activePage.objects.filter((o) => {
        if (o.kind !== 'stroke' || o.tool === 'eraser' || o.locked) return true;
        return !o.points.some((p) => Math.hypot(p.x - pt.x, p.y - pt.y) <= hitRadius + o.strokeWidth * 0.45);
      });
      if (remaining.length !== activePage.objects.length) {
        commitActivePageObjects(remaining);
      }
      return;
    }

    // Active marquee box
    if (marqueeStartRef.current) {
      const sx = marqueeStartRef.current.x;
      const sy = marqueeStartRef.current.y;
      setMarqueeRect({
        x: Math.min(sx, pt.x),
        y: Math.min(sy, pt.y),
        w: Math.abs(pt.x - sx),
        h: Math.abs(pt.y - sy),
      });
      return;
    }

    // Active Move / Resize / Rotate transform
    const tf = transformRef.current;
    if (!tf) return;

    const screenDist = Math.hypot(e.clientX - tf.startClientX, e.clientY - tf.startClientY);
    // Require a 5px drag threshold before moving/capturing so clicks & double-clicks on text boxes always work!
    if (tf.mode === 'move' && !tf.hasMoved && screenDist < 5) {
      return;
    }

    if (!tf.captured) {
      tf.captured = true;
      try {
        pageContainerRef.current?.setPointerCapture(tf.pointerId);
      } catch {
        // ignore if pointer already released
      }
    }

    const dxRaw = (e.clientX - tf.startClientX) / zoom;
    const dyRaw = (e.clientY - tf.startClientY) / zoom;
    if (Math.abs(dxRaw) > 1.5 || Math.abs(dyRaw) > 1.5) tf.hasMoved = true;

    const selSet = new Set(tf.items.map((it) => it.id));

    if (tf.mode === 'move') {
      let dx = dxRaw;
      let dy = dyRaw;
      const guides: SnapGuide[] = [];

      // Smart Alignment Guides & Margin Snap
      if (pageSetup.snapEnabled) {
        const snapThresh = 7;
        const movingLeft = tf.origBounds.x + dx;
        const movingCenterX = movingLeft + tf.origBounds.w / 2;
        const movingRight = movingLeft + tf.origBounds.w;

        const movingTop = tf.origBounds.y + dy;
        const movingCenterY = movingTop + tf.origBounds.h / 2;
        const movingBottom = movingTop + tf.origBounds.h;

        const targetsX = [
          marginsPx.left,
          geom.w / 2,
          geom.w - marginsPx.right,
        ];
        const targetsY = [
          marginsPx.top,
          geom.h / 2,
          geom.h - marginsPx.bottom,
        ];

        for (const other of activePage.objects) {
          if (selSet.has(other.id) || other.visible === false) continue;
          const ob = getObjectBounds(other);
          targetsX.push(ob.x, ob.x + ob.w / 2, ob.x + ob.w);
          targetsY.push(ob.y, ob.y + ob.h / 2, ob.y + ob.h);
        }

        // Snap X
        for (const tx of targetsX) {
          if (Math.abs(movingLeft - tx) < snapThresh) {
            dx = tx - tf.origBounds.x;
            guides.push({ axis: 'x', pos: tx });
            break;
          }
          if (Math.abs(movingCenterX - tx) < snapThresh) {
            dx = tx - (tf.origBounds.x + tf.origBounds.w / 2);
            guides.push({ axis: 'x', pos: tx });
            break;
          }
          if (Math.abs(movingRight - tx) < snapThresh) {
            dx = tx - (tf.origBounds.x + tf.origBounds.w);
            guides.push({ axis: 'x', pos: tx });
            break;
          }
        }

        // Snap Y
        for (const ty of targetsY) {
          if (Math.abs(movingTop - ty) < snapThresh) {
            dy = ty - tf.origBounds.y;
            guides.push({ axis: 'y', pos: ty });
            break;
          }
          if (Math.abs(movingCenterY - ty) < snapThresh) {
            dy = ty - (tf.origBounds.y + tf.origBounds.h / 2);
            guides.push({ axis: 'y', pos: ty });
            break;
          }
          if (Math.abs(movingBottom - ty) < snapThresh) {
            dy = ty - (tf.origBounds.y + tf.origBounds.h);
            guides.push({ axis: 'y', pos: ty });
            break;
          }
        }

        // Grid snap if enabled and no object guide hit
        if (pageSetup.showGrid && guides.length === 0) {
          const gStep = 14;
          dx = Math.round((tf.origBounds.x + dx) / gStep) * gStep - tf.origBounds.x;
          dy = Math.round((tf.origBounds.y + dy) / gStep) * gStep - tf.origBounds.y;
        }
      }

      setSnapGuides(guides);

      const itemMap = new Map(tf.items.map((it) => [it.id, it]));
      commitActivePageObjects(
        activePage.objects.map((o) => {
          const orig = itemMap.get(o.id);
          if (!orig) return o;
          if (o.kind === 'stroke' && orig.points) {
            return {
              ...o,
              x: Math.round(orig.x + dx),
              y: Math.round(orig.y + dy),
              points: orig.points.map((p) => ({ ...p, x: p.x + dx, y: p.y + dy })),
            };
          }
          return {
            ...o,
            x: Math.round(orig.x + dx),
            y: Math.round(orig.y + dy),
          };
        })
      );
      return;
    }

    if (tf.mode === 'resize' && tf.handle) {
      const h = tf.handle;
      const ob = tf.origBounds;
      let newX = ob.x;
      let newY = ob.y;
      let newW = ob.w;
      let newH = ob.h;

      if (h.includes('e')) newW = Math.max(24, ob.w + dxRaw);
      if (h.includes('s')) newH = Math.max(24, ob.h + dyRaw);
      if (h.includes('w')) {
        const w = Math.max(24, ob.w - dxRaw);
        newX = ob.x + (ob.w - w);
        newW = w;
      }
      if (h.includes('n')) {
        const ht = Math.max(24, ob.h - dyRaw);
        newY = ob.y + (ob.h - ht);
        newH = ht;
      }

      const scaleX = newW / Math.max(1, ob.w);
      const scaleY = newH / Math.max(1, ob.h);
      const itemMap = new Map(tf.items.map((it) => [it.id, it]));

      commitActivePageObjects(
        activePage.objects.map((o) => {
          const orig = itemMap.get(o.id);
          if (!orig) return o;
          if (o.kind === 'stroke' && orig.points) {
            return {
              ...o,
              points: orig.points.map((p) => ({
                ...p,
                x: newX + (p.x - ob.x) * scaleX,
                y: newY + (p.y - ob.y) * scaleY,
              })),
            };
          }
          return {
            ...o,
            x: Math.round(newX + (orig.x - ob.x) * scaleX),
            y: Math.round(newY + (orig.y - ob.y) * scaleY),
            w: Math.max(20, Math.round(orig.w * scaleX)),
            h: Math.max(20, Math.round(orig.h * scaleY)),
          };
        })
      );
      return;
    }

    if (tf.mode === 'rotate') {
      const currAngle = Math.atan2(
        pt.y - tf.centerPageY,
        pt.x - tf.centerPageX
      );
      let degDelta = ((currAngle - tf.startAngle) * 180) / Math.PI;
      if (e.shiftKey) {
        degDelta = Math.round(degDelta / 15) * 15;
      }
      const itemMap = new Map(tf.items.map((it) => [it.id, it]));
      commitActivePageObjects(
        activePage.objects.map((o) => {
          const orig = itemMap.get(o.id);
          if (!orig || o.kind === 'stroke') return o;
          return {
            ...o,
            rotation: Math.round((orig.rotation + degDelta + 360) % 360),
          };
        })
      );
    }
  };

  const handlePagePointerUp = () => {
    panDragRef.current = null;

    // Commit finished brush OR transparent-paint eraser stroke
    if (isDrawingRef.current && activeStrokeRef.current) {
      const finished = activeStrokeRef.current;
      activeStrokeRef.current = null;
      isDrawingRef.current = false;
      setIsErasingNow(false);
      const bounds = getObjectBounds(finished);
      const finalized: StrokeCanvasObject = {
        ...finished,
        x: Math.round(bounds.x),
        y: Math.round(bounds.y),
        w: Math.round(bounds.w),
        h: Math.round(bounds.h),
      };
      const isEraser = finished.tool === 'eraser';
      if (isEraser && rasterCanvasRef.current && activePage.rasterDataUrl) {
        updateActivePage(
          {
            objects: [...activePage.objects, finalized],
            rasterDataUrl: rasterCanvasRef.current.toDataURL('image/png'),
          },
          'Borrador preciso'
        );
      } else {
        commitActivePageObjects(
          [...activePage.objects, finalized],
          isEraser ? 'Borrador preciso' : 'Dibujar trazo'
        );
      }
      return;
    }

    // Finish full-stroke eraser gesture
    if (isDrawingRef.current && tool === 'eraser') {
      isDrawingRef.current = false;
      setIsErasingNow(false);
      return;
    }

    // Commit marquee selection
    if (marqueeStartRef.current && marqueeRect) {
      marqueeStartRef.current = null;
      if (marqueeRect.w > 4 || marqueeRect.h > 4) {
        const hitIds = activePage.objects
          .filter((o) => {
            if (o.visible === false || o.locked) return false;
            const b = getObjectBounds(o);
            return (
              b.x < marqueeRect.x + marqueeRect.w &&
              b.x + b.w > marqueeRect.x &&
              b.y < marqueeRect.y + marqueeRect.h &&
              b.y + b.h > marqueeRect.y
            );
          })
          .map((o) => o.id);
        setSelectedIds(expandSelectionWithGroups(hitIds));
      }
      setMarqueeRect(null);
      return;
    }

    // Finish transform
    if (transformRef.current) {
      const { hasMoved: moved, mode, clickToEditId, captured, pointerId } = transformRef.current;
      transformRef.current = null;
      setSnapGuides([]);
      if (captured) {
        try {
          pageContainerRef.current?.releasePointerCapture(pointerId);
        } catch {
          // ignore
        }
      }
      if (moved) {
        pushHistorySnapshot(
          mode === 'move'
            ? 'Mover objeto(s)'
            : mode === 'resize'
              ? 'Redimensionar objeto(s)'
              : 'Rotar objeto(s)'
        );
      } else if (clickToEditId) {
        setEditingId(clickToEditId);
      }
    }
  };

  const beginTransform = (
    e: React.PointerEvent,
    mode: 'move' | 'resize' | 'rotate',
    idsToTransform: string[],
    handle?: ResizeHandle,
    clickToEditId?: string
  ) => {
    e.stopPropagation();
    const targetObjs = activePage.objects.filter(
      (o) => idsToTransform.includes(o.id) && !o.locked
    );
    if (targetObjs.length === 0) return;

    let minX = Infinity;
    let minY = Infinity;
    let maxX = -Infinity;
    let maxY = -Infinity;
    for (const o of targetObjs) {
      const b = getObjectBounds(o);
      minX = Math.min(minX, b.x);
      minY = Math.min(minY, b.y);
      maxX = Math.max(maxX, b.x + b.w);
      maxY = Math.max(maxY, b.h + b.y);
    }
    const origBounds = {
      x: minX,
      y: minY,
      w: Math.max(20, maxX - minX),
      h: Math.max(20, maxY - minY),
    };
    const centerPageX = origBounds.x + origBounds.w / 2;
    const centerPageY = origBounds.y + origBounds.h / 2;
    const pt = clientToPage(e.clientX, e.clientY);

    const immediateCapture = mode !== 'move';
    transformRef.current = {
      mode,
      handle,
      pointerId: e.pointerId,
      captured: immediateCapture,
      clickToEditId,
      startClientX: e.clientX,
      startClientY: e.clientY,
      origBounds,
      centerPageX,
      centerPageY,
      startAngle: Math.atan2(pt.y - centerPageY, pt.x - centerPageX),
      items: targetObjs.map((o) => ({
        id: o.id,
        x: o.x,
        y: o.y,
        w: o.w,
        h: o.h,
        rotation: o.rotation ?? 0,
        points: o.kind === 'stroke' ? o.points.map((p) => ({ ...p })) : undefined,
      })),
      hasMoved: false,
    };

    if (immediateCapture) {
      pageContainerRef.current?.setPointerCapture(e.pointerId);
    }
  };

  /* --------------------------------------------------------------------------
   * Drag & Drop Image Files directly onto the Canvas
   * ------------------------------------------------------------------------*/
  const handleCanvasDrop = (e: React.DragEvent) => {
    const files = Array.from(e.dataTransfer.files ?? []).filter((f) =>
      f.type.startsWith('image/')
    );
    if (files.length === 0) return;
    e.preventDefault();
    e.stopPropagation();
    const pt = clientToPage(e.clientX, e.clientY);
    files.forEach((f, idx) =>
      insertImageFile(f, { x: pt.x + idx * 24, y: pt.y + idx * 24 })
    );
  };

  /* --------------------------------------------------------------------------
   * Paper Pattern CSS Style
   * ------------------------------------------------------------------------*/
  const paperPatternStyle = useMemo<React.CSSProperties>(() => {
    const bg = activePage.backgroundColor || '#FFFFFF';
    if (activePage.pattern === 'ruled') {
      return {
        backgroundColor: bg,
        backgroundImage:
          'repeating-linear-gradient(to bottom, transparent 0px, transparent 33px, rgba(43,100,245,0.14) 34px)',
      };
    }
    if (activePage.pattern === 'grid') {
      return {
        backgroundColor: bg,
        backgroundImage:
          'linear-gradient(to right, rgba(43,100,245,0.11) 1px, transparent 1px), linear-gradient(to bottom, rgba(43,100,245,0.11) 1px, transparent 1px)',
        backgroundSize: '28px 28px',
      };
    }
    if (activePage.pattern === 'dotted') {
      return {
        backgroundColor: bg,
        backgroundImage: 'radial-gradient(rgba(100,116,139,0.3) 1.25px, transparent 1.25px)',
        backgroundSize: '24px 24px',
      };
    }
    return { backgroundColor: bg };
  }, [activePage.backgroundColor, activePage.pattern]);

  /* --------------------------------------------------------------------------
   * Render
   * ------------------------------------------------------------------------*/
  const isDrawingToolActive =
    tool === 'pen' || tool === 'highlighter' || tool === 'eraser' || tool === 'fill';

  return (
    <div
      className="h-full w-full flex flex-col bg-[var(--luma-bg)] text-[var(--luma-ink)] overflow-hidden"
      onDragOver={(e) => {
        if (Array.from(e.dataTransfer.types).includes('Files')) {
          e.preventDefault();
        }
      }}
      onDrop={handleCanvasDrop}
    >
      {/* Hidden image uploader */}
      <input
        ref={imageInputRef}
        type="file"
        multiple
        accept="image/*"
        onChange={(e) => {
          const files = Array.from(e.target.files ?? []);
          e.target.value = '';
          files.forEach((f) => insertImageFile(f));
        }}
        className="hidden"
      />

      {/* =====================================================================
       * TOP WORD-STYLE TABBED RIBBON (Inicio, Insertar, Dibujo, Diseño, Vista)
       * ===================================================================*/}
      <div className="border-b border-[var(--luma-border)] bg-[var(--luma-surface)] shrink-0 z-20">
        {/* Row 1: Title + Word Tabs + Autosave + Export + Dark/Light + Shortcuts */}
        <div className="h-10 px-3 flex items-center justify-between gap-2 border-b border-[var(--luma-border)]/70 overflow-x-auto no-scrollbar">
          <div className="flex items-center gap-2 min-w-0 shrink-0">
            {isStandaloneTab && onBackToHome && (
              <button
                type="button"
                onClick={onBackToHome}
                className="h-7 px-2 rounded-md border border-[var(--luma-border)] text-xs font-medium hover:bg-[var(--luma-surface-alt)] whitespace-nowrap shrink-0"
              >
                ← Luma
              </button>
            )}
            <input
              value={notebook.title}
              onChange={(e) =>
                onChangeNotebook({ ...notebook, title: e.target.value, updatedAt: Date.now() })
              }
              aria-label="Título del cuaderno"
              className="h-7 px-2 rounded-md bg-transparent hover:bg-[var(--luma-bg)] focus:bg-[var(--luma-bg)] border border-transparent focus:border-[var(--luma-accent)] text-xs font-bold outline-none w-[160px] sm:w-[210px] truncate"
            />
            <span
              aria-live="polite"
              className="hidden sm:inline-flex items-center gap-1 text-[11px] text-[var(--luma-ink-muted)] whitespace-nowrap shrink-0"
            >
              <Check className="w-3 h-3 text-emerald-500" />
              {saveIndicator === 'saving' ? 'Guardando...' : 'Guardado'}
            </span>
          </div>

          {/* 5 Word-Style Ribbon Tabs */}
          <nav
            role="tablist"
            aria-label="Pestañas de herramientas del cuaderno"
            className="flex items-center gap-0.5 shrink-0"
          >
            {(
              [
                { id: 'home', label: 'Inicio' },
                { id: 'insert', label: 'Insertar' },
                { id: 'draw', label: 'Dibujo' },
                { id: 'layout', label: 'Diseño de página' },
                { id: 'view', label: 'Vista' },
              ] as Array<{ id: RibbonTab; label: string }>
            ).map((t) => {
              const active = ribbonTab === t.id;
              return (
                <button
                  key={t.id}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => {
                    setRibbonTab(t.id);
                    if (t.id === 'draw') setDrawerTab('draw');
                    else if (t.id === 'layout') setDrawerTab('layout');
                    else if (t.id === 'insert') setDrawerTab('elements');
                  }}
                  className={`h-8 px-2.5 rounded-md text-xs transition-colors whitespace-nowrap shrink-0 ${
                    active
                      ? 'bg-[var(--luma-accent-soft)] text-[var(--luma-accent)] font-semibold'
                      : 'text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)] hover:bg-[var(--luma-surface-alt)]'
                  }`}
                >
                  {t.label}
                </button>
              );
            })}
          </nav>

          {/* Right Quick Actions: Undo/Redo, Dark/Light, New Tab, Export, Help */}
          <div className="flex items-center gap-1 shrink-0">
            <button
              type="button"
              onClick={handleUndo}
              disabled={past.length === 0}
              title="Deshacer (Ctrl+Z)"
              aria-label="Deshacer"
              className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-[var(--luma-surface-alt)] disabled:opacity-35"
            >
              <Undo2 className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={handleRedo}
              disabled={future.length === 0}
              title="Rehacer (Ctrl+Y)"
              aria-label="Rehacer"
              className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-[var(--luma-surface-alt)] disabled:opacity-35"
            >
              <Redo2 className="w-3.5 h-3.5" />
            </button>

            {onToggleDarkLight && (
              <button
                type="button"
                onClick={() => onToggleDarkLight(isDarkTheme ? 'warm_cream' : 'navy_mid')}
                title={isDarkTheme ? 'Cambiar a modo claro' : 'Cambiar a modo oscuro'}
                aria-label="Cambiar modo oscuro o claro"
                className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-[var(--luma-surface-alt)]"
              >
                {isDarkTheme ? <Sun className="w-3.5 h-3.5" /> : <Moon className="w-3.5 h-3.5" />}
              </button>
            )}

            <button
              type="button"
              onClick={() => setShortcutsOpen(true)}
              title="Atajos de teclado"
              aria-label="Mostrar atajos de teclado"
              className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-[var(--luma-surface-alt)]"
            >
              <Keyboard className="w-3.5 h-3.5" />
            </button>

            {!isStandaloneTab && (
              <a
                href={buildNotebookTabUrl(notebook.id)}
                target="_blank"
                rel="noopener noreferrer"
                title="Abrir este cuaderno en una pestaña nueva del navegador"
                aria-label="Abrir cuaderno en pestaña nueva"
                className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-[var(--luma-surface-alt)] text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)]"
              >
                <ExternalLink className="w-3.5 h-3.5" />
              </a>
            )}

            {syncButtonSlot ? (
              syncButtonSlot
            ) : (
              onSyncToDrive && (
                <button
                  type="button"
                  onClick={onSyncToDrive}
                  title="Sincronizar este cuaderno con Google Drive"
                  className="h-7 px-2.5 rounded-md border border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)] text-xs font-semibold flex items-center gap-1.5 whitespace-nowrap shrink-0"
                >
                  <CloudUpload className="w-3.5 h-3.5 text-[var(--luma-accent)]" />
                  <span className="hidden md:inline">Sincronizar</span>
                </button>
              )
            )}

            {/* Export Menu (Portal-rendered so it is NEVER clipped by header overflow!) */}
            <div className="relative">
              <button
                ref={exportBtnRef}
                type="button"
                onClick={() => setExportMenuOpen((v) => !v)}
                aria-expanded={exportMenuOpen}
                className="h-7 px-2.5 rounded-md bg-[var(--luma-accent)] text-[var(--luma-on-accent)] text-xs font-semibold flex items-center gap-1.5 hover:opacity-95 whitespace-nowrap shrink-0"
              >
                <Download className="w-3.5 h-3.5" />
                <span>Exportar</span>
              </button>

              {exportMenuOpen &&
                typeof document !== 'undefined' &&
                createPortal(
                  <div
                    ref={exportMenuRef}
                    style={{
                      position: 'fixed',
                      top: exportMenuPos.top,
                      left: exportMenuPos.left,
                      zIndex: 9999,
                    }}
                    className="luma-dropdown-reveal w-[244px] rounded-xl border border-[var(--luma-border)] bg-[var(--luma-surface)] text-[var(--luma-ink)] shadow-2xl p-2.5 space-y-2 text-xs"
                  >
                    <div className="flex items-center justify-between gap-1 p-1 rounded-lg bg-[var(--luma-bg)]">
                      <button
                        type="button"
                        onClick={() => setExportScope('current')}
                        className={`flex-1 py-1 rounded-md text-[11px] font-medium ${
                          exportScope === 'current'
                            ? 'bg-[var(--luma-surface)] text-[var(--luma-ink)] shadow-sm'
                            : 'text-[var(--luma-ink-muted)]'
                        }`}
                      >
                        Página actual
                      </button>
                      <button
                        type="button"
                        onClick={() => setExportScope('all')}
                        className={`flex-1 py-1 rounded-md text-[11px] font-medium ${
                          exportScope === 'all'
                            ? 'bg-[var(--luma-surface)] text-[var(--luma-ink)] shadow-sm'
                            : 'text-[var(--luma-ink-muted)]'
                        }`}
                      >
                        Todo ({notebook.pages.length})
                      </button>
                    </div>

                    <div className="space-y-1">
                      <button
                        type="button"
                        onClick={async () => {
                          setExportMenuOpen(false);
                          await exportNotebookAsPdf(notebook, exportScope);
                          showToast('PDF exportado correctamente');
                        }}
                        className="w-full h-8 px-2.5 rounded-lg hover:bg-[var(--luma-surface-alt)] flex items-center justify-between"
                      >
                        <span className="font-medium">Documento PDF</span>
                        <span className="font-mono text-[10px] text-[var(--luma-ink-muted)]">.pdf</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          setExportMenuOpen(false);
                          await exportNotebookAsImage(notebook, 'png', exportScope);
                          showToast('Imagen PNG descargada');
                        }}
                        className="w-full h-8 px-2.5 rounded-lg hover:bg-[var(--luma-surface-alt)] flex items-center justify-between"
                      >
                        <span className="font-medium">Imagen PNG HD</span>
                        <span className="font-mono text-[10px] text-[var(--luma-ink-muted)]">.png</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          setExportMenuOpen(false);
                          await exportNotebookAsImage(notebook, 'jpg', exportScope);
                          showToast('Imagen JPG descargada');
                        }}
                        className="w-full h-8 px-2.5 rounded-lg hover:bg-[var(--luma-surface-alt)] flex items-center justify-between"
                      >
                        <span className="font-medium">Imagen JPG</span>
                        <span className="font-mono text-[10px] text-[var(--luma-ink-muted)]">.jpg</span>
                      </button>
                      <button
                        type="button"
                        onClick={async () => {
                          setExportMenuOpen(false);
                          await exportNotebookAsSvg(notebook, exportScope);
                          showToast('Vector SVG descargado');
                        }}
                        className="w-full h-8 px-2.5 rounded-lg hover:bg-[var(--luma-surface-alt)] flex items-center justify-between"
                      >
                        <span className="font-medium">Vector SVG</span>
                        <span className="font-mono text-[10px] text-[var(--luma-ink-muted)]">.svg</span>
                      </button>
                      <div className="border-t border-[var(--luma-border)] my-1" />
                      <button
                        type="button"
                        onClick={async () => {
                          setExportMenuOpen(false);
                          await printNotebookPages(notebook, exportScope);
                        }}
                        className="w-full h-8 px-2.5 rounded-lg hover:bg-[var(--luma-surface-alt)] flex items-center gap-2 font-medium"
                      >
                        <Printer className="w-3.5 h-3.5 text-[var(--luma-accent)]" />
                        <span>Imprimir cuaderno</span>
                      </button>
                    </div>
                  </div>,
                  document.body
                )}
            </div>
          </div>
        </div>

        {/* Row 2: Contextual Ribbon Strip for Active Tab */}
        <div className="h-11 px-3 flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs">
          {ribbonTab === 'home' && (
            <>
              {/* Clipboard */}
              <div className="flex items-center gap-0.5 pr-2 border-r border-[var(--luma-border)] shrink-0">
                <button
                  type="button"
                  onClick={copySelected}
                  disabled={selectedIds.length === 0}
                  title="Copiar (Ctrl+C)"
                  className="h-8 px-2 rounded-md hover:bg-[var(--luma-surface-alt)] disabled:opacity-40 flex items-center gap-1 whitespace-nowrap"
                >
                  <Copy className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={cutSelected}
                  disabled={selectedIds.length === 0}
                  title="Cortar (Ctrl+X)"
                  className="h-8 px-2 rounded-md hover:bg-[var(--luma-surface-alt)] disabled:opacity-40 flex items-center gap-1 whitespace-nowrap"
                >
                  <Scissors className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={pasteFromSharedClipboard}
                  title="Pegar entre cuadernos (Ctrl+V)"
                  className="h-8 px-2 rounded-md hover:bg-[var(--luma-surface-alt)] text-[11px] font-medium whitespace-nowrap"
                >
                  Pegar
                </button>
              </div>

              {/* Font Picker & Word Typography Controls (works on BOTH direct sheet & selected text box!) */}
              <div className="flex items-center gap-1 pr-2 border-r border-[var(--luma-border)] shrink-0">
                <FontPicker
                  compact
                  value={currentFontFamily}
                  customFonts={customFonts}
                  onCustomFontsChange={setCustomFonts}
                  onChange={(family) => applyTypographyPatch({ fontFamily: family })}
                />
                <input
                  type="number"
                  min={8}
                  max={140}
                  value={currentFontSize}
                  onChange={(e) => {
                    const sz = Math.max(8, Math.min(140, Number(e.target.value) || 16));
                    applyTypographyPatch({ fontSize: sz });
                  }}
                  aria-label="Tamaño de fuente"
                  className="w-12 h-8 px-1.5 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-bg)] text-center font-mono text-xs tabular-nums"
                />
              </div>

              {/* B / I / U / S / Sup / Sub / Color / Highlight */}
              <div className="flex items-center gap-0.5 pr-2 border-r border-[var(--luma-border)] shrink-0">
                <button
                  type="button"
                  onClick={() => applyTypographyPatch({ bold: !currentBold })}
                  title="Negrita"
                  className={`h-8 w-8 rounded-md flex items-center justify-center ${
                    currentBold ? 'bg-[var(--luma-accent-soft)] text-[var(--luma-accent)]' : 'hover:bg-[var(--luma-surface-alt)]'
                  }`}
                >
                  <Bold className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => applyTypographyPatch({ italic: !currentItalic })}
                  title="Cursiva"
                  className={`h-8 w-8 rounded-md flex items-center justify-center ${
                    currentItalic ? 'bg-[var(--luma-accent-soft)] text-[var(--luma-accent)]' : 'hover:bg-[var(--luma-surface-alt)]'
                  }`}
                >
                  <Italic className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => applyTypographyPatch({ underline: !currentUnderline })}
                  title="Subrayado"
                  className={`h-8 w-8 rounded-md flex items-center justify-center ${
                    currentUnderline ? 'bg-[var(--luma-accent-soft)] text-[var(--luma-accent)]' : 'hover:bg-[var(--luma-surface-alt)]'
                  }`}
                >
                  <Underline className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() => applyTypographyPatch({ strikethrough: !currentStrike })}
                  title="Tachado"
                  className={`h-8 w-8 rounded-md flex items-center justify-center ${
                    currentStrike ? 'bg-[var(--luma-accent-soft)] text-[var(--luma-accent)]' : 'hover:bg-[var(--luma-surface-alt)]'
                  }`}
                >
                  <Strikethrough className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={!selectedTextObj}
                  onClick={() =>
                    selectedTextObj &&
                    updateObject(
                      selectedTextObj.id,
                      { script: selectedTextObj.script === 'super' ? 'normal' : 'super' },
                      true
                    )
                  }
                  title="Superíndice (en cuadro de texto)"
                  className={`h-8 w-7 rounded-md flex items-center justify-center disabled:opacity-40 ${
                    selectedTextObj?.script === 'super' ? 'bg-[var(--luma-accent-soft)] text-[var(--luma-accent)]' : 'hover:bg-[var(--luma-surface-alt)]'
                  }`}
                >
                  <Superscript className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  disabled={!selectedTextObj}
                  onClick={() =>
                    selectedTextObj &&
                    updateObject(
                      selectedTextObj.id,
                      { script: selectedTextObj.script === 'sub' ? 'normal' : 'sub' },
                      true
                    )
                  }
                  title="Subíndice (en cuadro de texto)"
                  className={`h-8 w-7 rounded-md flex items-center justify-center disabled:opacity-40 ${
                    selectedTextObj?.script === 'sub' ? 'bg-[var(--luma-accent-soft)] text-[var(--luma-accent)]' : 'hover:bg-[var(--luma-surface-alt)]'
                  }`}
                >
                  <Subscript className="w-3.5 h-3.5" />
                </button>

                {/* Text Color & Highlight */}
                <label
                  title="Color de texto"
                  className="h-8 px-1.5 rounded-md hover:bg-[var(--luma-surface-alt)] flex items-center gap-1 cursor-pointer"
                >
                  <span className="font-bold text-xs">A</span>
                  <input
                    type="color"
                    value={currentTextColor}
                    onChange={(e) => applyTypographyPatch({ color: e.target.value })}
                    className="w-4 h-4 border-0 bg-transparent cursor-pointer"
                  />
                </label>
                <label
                  title="Resaltado de texto"
                  className="h-8 px-1.5 rounded-md hover:bg-[var(--luma-surface-alt)] flex items-center gap-1 cursor-pointer"
                >
                  <Highlighter className="w-3.5 h-3.5" />
                  <input
                    type="color"
                    value={
                      currentHighlightColor && currentHighlightColor !== 'transparent'
                        ? currentHighlightColor
                        : '#FEF08A'
                    }
                    onChange={(e) => applyTypographyPatch({ highlightColor: e.target.value })}
                    className="w-4 h-4 border-0 bg-transparent cursor-pointer"
                  />
                </label>
              </div>

              {/* Alignment & Lists */}
              <div className="flex items-center gap-0.5 pr-2 border-r border-[var(--luma-border)] shrink-0">
                {(
                  [
                    { id: 'left', icon: <AlignLeft className="w-3.5 h-3.5" />, label: 'Izquierda' },
                    { id: 'center', icon: <AlignCenter className="w-3.5 h-3.5" />, label: 'Centrar' },
                    { id: 'right', icon: <AlignRight className="w-3.5 h-3.5" />, label: 'Derecha' },
                    { id: 'justify', icon: <AlignJustify className="w-3.5 h-3.5" />, label: 'Justificar' },
                  ] as const
                ).map((a) => (
                  <button
                    key={a.id}
                    type="button"
                    onClick={() => applyTypographyPatch({ align: a.id })}
                    title={a.label}
                    className={`h-8 w-7 rounded-md flex items-center justify-center ${
                      currentAlign === a.id
                        ? 'bg-[var(--luma-accent-soft)] text-[var(--luma-accent)]'
                        : 'hover:bg-[var(--luma-surface-alt)]'
                    }`}
                  >
                    {a.icon}
                  </button>
                ))}
                <button
                  type="button"
                  onClick={() =>
                    applyTypographyPatch({
                      listType: currentListType === 'bullet' ? 'none' : 'bullet',
                    })
                  }
                  title="Lista con viñetas"
                  className={`h-8 w-7 rounded-md flex items-center justify-center ${
                    currentListType === 'bullet'
                      ? 'bg-[var(--luma-accent-soft)] text-[var(--luma-accent)]'
                      : 'hover:bg-[var(--luma-surface-alt)]'
                  }`}
                >
                  <List className="w-3.5 h-3.5" />
                </button>
                <button
                  type="button"
                  onClick={() =>
                    applyTypographyPatch({
                      listType: currentListType === 'number' ? 'none' : 'number',
                    })
                  }
                  title="Lista numerada"
                  className={`h-8 w-7 rounded-md flex items-center justify-center ${
                    currentListType === 'number'
                      ? 'bg-[var(--luma-accent-soft)] text-[var(--luma-accent)]'
                      : 'hover:bg-[var(--luma-surface-alt)]'
                  }`}
                >
                  <ListOrdered className="w-3.5 h-3.5" />
                </button>
              </div>

              {/* Line height, letter spacing & Find/Replace */}
              <div className="flex items-center gap-1.5 shrink-0">
                <label className="flex items-center gap-1 text-[11px] text-[var(--luma-ink-muted)]">
                  <span>Interlin.</span>
                  <select
                    value={currentLineHeight}
                    onChange={(e) => applyTypographyPatch({ lineHeight: Number(e.target.value) })}
                    className="h-7 px-1 rounded border border-[var(--luma-border)] bg-[var(--luma-bg)] text-[11px]"
                  >
                    <option value={1.15}>1.15</option>
                    <option value={1.35}>1.35</option>
                    <option value={1.5}>1.5</option>
                    <option value={1.6}>1.6</option>
                    <option value={1.75}>1.75</option>
                    <option value={2}>2.0</option>
                  </select>
                </label>
                <label className="flex items-center gap-1 text-[11px] text-[var(--luma-ink-muted)]">
                  <span>Espac.</span>
                  <input
                    type="number"
                    step={0.5}
                    min={-2}
                    max={12}
                    value={currentLetterSpacing}
                    onChange={(e) =>
                      applyTypographyPatch({ letterSpacing: Number(e.target.value) || 0 })
                    }
                    className="w-12 h-7 px-1 rounded border border-[var(--luma-border)] bg-[var(--luma-bg)] font-mono text-[11px] text-center"
                  />
                </label>

                <button
                  type="button"
                  onClick={() => setFindOpen(true)}
                  className="h-8 px-2.5 rounded-md border border-[var(--luma-border)] hover:bg-[var(--luma-surface-alt)] flex items-center gap-1.5 whitespace-nowrap"
                >
                  <Search className="w-3.5 h-3.5" />
                  <span>Buscar y reemplazar</span>
                </button>
              </div>
            </>
          )}

          {ribbonTab === 'insert' && (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => addTextBox()}
                className="h-8 px-2.5 rounded-md border border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)] flex items-center gap-1.5 font-medium whitespace-nowrap"
              >
                <Type className="w-3.5 h-3.5 text-[var(--luma-accent)]" />
                <span>Cuadro de texto</span>
              </button>
              <button
                type="button"
                onClick={() => imageInputRef.current?.click()}
                className="h-8 px-2.5 rounded-md border border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)] flex items-center gap-1.5 font-medium whitespace-nowrap"
              >
                <ImageIcon className="w-3.5 h-3.5 text-[var(--luma-accent)]" />
                <span>Subir imagen</span>
              </button>
              <button
                type="button"
                onClick={() => addTable(3, 3)}
                className="h-8 px-2.5 rounded-md border border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)] flex items-center gap-1.5 font-medium whitespace-nowrap"
              >
                <Table2 className="w-3.5 h-3.5 text-[var(--luma-accent)]" />
                <span>Tabla 3×3</span>
              </button>
              <div className="h-5 w-px bg-[var(--luma-border)] mx-1" />
              {SHAPE_CATALOG.map((sh) => (
                <button
                  key={sh.kind}
                  type="button"
                  onClick={() => addShape(sh.kind)}
                  title={sh.label}
                  className="h-8 px-2 rounded-md hover:bg-[var(--luma-surface-alt)] flex items-center gap-1 whitespace-nowrap"
                >
                  {sh.icon}
                  <span className="hidden xl:inline text-[11px]">{sh.label}</span>
                </button>
              ))}
              <div className="h-5 w-px bg-[var(--luma-border)] mx-1" />
              <button
                type="button"
                onClick={() => addSticky('#FEF3C7', '#451A03')}
                className="h-8 px-2.5 rounded-md hover:bg-[var(--luma-surface-alt)] flex items-center gap-1 whitespace-nowrap"
              >
                <StickyNote className="w-3.5 h-3.5 text-amber-500" />
                <span>Nota</span>
              </button>
              <button
                type="button"
                onClick={() => addNewPage(true)}
                className="h-8 px-2.5 rounded-md hover:bg-[var(--luma-surface-alt)] flex items-center gap-1 whitespace-nowrap"
              >
                <FilePlus2 className="w-3.5 h-3.5" />
                <span>Salto de página</span>
              </button>
            </div>
          )}

          {ribbonTab === 'draw' && (
            <div className="flex items-center gap-1.5 shrink-0">
              {BRUSH_TIPS.map((tip) => {
                const cfg = toolsState.brushes[tip.id];
                const isSelected = (tool === 'pen' || tool === 'highlighter') && activeBrushTip === tip.id;
                return (
                  <button
                    key={tip.id}
                    type="button"
                    onClick={() => {
                      handleSelectBrushTip(tip.id);
                      setDrawerTab('draw');
                    }}
                    className={`h-8 px-2.5 rounded-md border text-[11px] whitespace-nowrap inline-flex items-center gap-1.5 ${
                      isSelected
                        ? 'border-[var(--luma-accent)] bg-[var(--luma-accent-soft)] text-[var(--luma-accent)] font-semibold'
                        : 'border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)]'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-full border border-black/20 shrink-0"
                      style={{ backgroundColor: cfg.color }}
                    />
                    <span>{tip.label}</span>
                  </button>
                );
              })}
              <div className="h-5 w-px bg-[var(--luma-border)] mx-1" />
              <button
                type="button"
                onClick={() => {
                  setTool('eraser');
                  setDrawerTab('draw');
                }}
                className={`h-8 px-2.5 rounded-md border flex items-center gap-1 whitespace-nowrap ${
                  tool === 'eraser'
                    ? 'border-[var(--luma-accent)] bg-[var(--luma-accent-soft)] text-[var(--luma-accent)] font-semibold'
                    : 'border-[var(--luma-border)] bg-[var(--luma-bg)]'
                }`}
              >
                <Eraser className="w-3.5 h-3.5" />
                <span>
                  Borrador ({eraserSettings.mode === 'pixel' ? 'preciso' : 'trazo'} · {eraserSettings.size}px)
                </span>
              </button>
              <button
                type="button"
                onClick={() => {
                  setTool('fill');
                  setDrawerTab('draw');
                }}
                className={`h-8 px-2.5 rounded-md border flex items-center gap-1 whitespace-nowrap ${
                  tool === 'fill'
                    ? 'border-[var(--luma-accent)] bg-[var(--luma-accent-soft)] text-[var(--luma-accent)] font-semibold'
                    : 'border-[var(--luma-border)] bg-[var(--luma-bg)]'
                }`}
              >
                <PaintBucket className="w-3.5 h-3.5" />
                <span>Relleno</span>
              </button>
            </div>
          )}

          {ribbonTab === 'layout' && (
            <div className="flex items-center gap-2 shrink-0">
              <label className="flex items-center gap-1.5">
                <span className="text-[11px] text-[var(--luma-ink-muted)]">Márgenes:</span>
                <select
                  value={pageSetup.marginPreset}
                  onChange={(e) => {
                    const preset = e.target.value as NotebookPageSetup['marginPreset'];
                    if (preset === 'custom') {
                      updatePageSetup({ marginPreset: 'custom' });
                    } else {
                      const m = MARGIN_PRESETS_MM[preset];
                      updatePageSetup({
                        marginPreset: preset,
                        marginsMm: { top: m.top, bottom: m.bottom, left: m.left, right: m.right },
                      });
                    }
                  }}
                  className="h-8 px-2 rounded-md border border-[var(--luma-border)] bg-[var(--luma-bg)] text-xs"
                >
                  <option value="normal">Normal</option>
                  <option value="narrow">Estrecho</option>
                  <option value="moderate">Moderado</option>
                  <option value="wide">Ancho</option>
                  <option value="custom">Personalizado</option>
                </select>
              </label>

              <button
                type="button"
                onClick={() =>
                  updatePageSetup({
                    orientation: pageSetup.orientation === 'portrait' ? 'landscape' : 'portrait',
                  })
                }
                className="h-8 px-2.5 rounded-md border border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)] whitespace-nowrap"
              >
                Orientación: {pageSetup.orientation === 'portrait' ? 'Vertical' : 'Horizontal'}
              </button>

              <select
                value={notebook.pageSize}
                onChange={(e) =>
                  onChangeNotebook({
                    ...notebook,
                    pageSize: e.target.value as NotebookPageSize,
                    updatedAt: Date.now(),
                  })
                }
                aria-label="Tamaño de página"
                className="h-8 px-2 rounded-md border border-[var(--luma-border)] bg-[var(--luma-bg)] text-xs"
              >
                <option value="A4">A4</option>
                <option value="A3">A3</option>
                <option value="A5">A5</option>
                <option value="LETTER">Carta</option>
                <option value="LEGAL">Oficio</option>
                <option value="WIDE_16_9">16:9</option>
                <option value="SQUARE">Cuadrado</option>
                <option value="CUSTOM">Personalizado</option>
              </select>

              <button
                type="button"
                onClick={() => setDocumentBodyOpen((v) => !v)}
                className={`h-8 px-2.5 rounded-md border whitespace-nowrap flex items-center gap-1.5 ${
                  documentBodyOpen
                    ? 'border-[var(--luma-accent)] bg-[var(--luma-accent-soft)] text-[var(--luma-accent)] font-semibold'
                    : 'border-[var(--luma-border)] bg-[var(--luma-bg)]'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span>Cuerpo de documento Word ({pageSetup.columns} col.)</span>
              </button>
            </div>
          )}

          {ribbonTab === 'view' && (
            <div className="flex items-center gap-1.5 shrink-0">
              <button
                type="button"
                onClick={() => updatePageSetup({ showRulers: !pageSetup.showRulers })}
                className={`h-8 px-2.5 rounded-md border flex items-center gap-1.5 whitespace-nowrap ${
                  pageSetup.showRulers
                    ? 'border-[var(--luma-accent)] bg-[var(--luma-accent-soft)] text-[var(--luma-accent)] font-semibold'
                    : 'border-[var(--luma-border)] bg-[var(--luma-bg)]'
                }`}
              >
                <Ruler className="w-3.5 h-3.5" />
                <span>Reglas ({pageSetup.rulerUnit})</span>
              </button>
              <button
                type="button"
                onClick={() => updatePageSetup({ showMarginGuides: !pageSetup.showMarginGuides })}
                className={`h-8 px-2.5 rounded-md border whitespace-nowrap ${
                  pageSetup.showMarginGuides
                    ? 'border-[var(--luma-accent)] bg-[var(--luma-accent-soft)] text-[var(--luma-accent)] font-semibold'
                    : 'border-[var(--luma-border)] bg-[var(--luma-bg)]'
                }`}
              >
                Guías de márgenes
              </button>
              <button
                type="button"
                onClick={() => updatePageSetup({ showGrid: !pageSetup.showGrid })}
                className={`h-8 px-2.5 rounded-md border flex items-center gap-1 whitespace-nowrap ${
                  pageSetup.showGrid
                    ? 'border-[var(--luma-accent)] bg-[var(--luma-accent-soft)] text-[var(--luma-accent)] font-semibold'
                    : 'border-[var(--luma-border)] bg-[var(--luma-bg)]'
                }`}
              >
                <Grid3X3 className="w-3.5 h-3.5" />
                <span>Cuadrícula</span>
              </button>
              <button
                type="button"
                onClick={() => updatePageSetup({ snapEnabled: !pageSetup.snapEnabled })}
                className={`h-8 px-2.5 rounded-md border whitespace-nowrap ${
                  pageSetup.snapEnabled
                    ? 'border-[var(--luma-accent)] bg-[var(--luma-accent-soft)] text-[var(--luma-accent)] font-semibold'
                    : 'border-[var(--luma-border)] bg-[var(--luma-bg)]'
                }`}
              >
                Imán (Snap)
              </button>
              <button
                type="button"
                onClick={fitPageToScreen}
                className="h-8 px-2.5 rounded-md border border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)] flex items-center gap-1 whitespace-nowrap"
              >
                <Maximize2 className="w-3.5 h-3.5" />
                <span>Ajustar a pantalla</span>
              </button>
              <button
                type="button"
                onClick={() => setDrawerTab(drawerTab === 'history' ? null : 'history')}
                className="h-8 px-2.5 rounded-md border border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)] flex items-center gap-1 whitespace-nowrap"
              >
                <Clock className="w-3.5 h-3.5" />
                <span>Historial ({past.length})</span>
              </button>
            </div>
          )}
        </div>
      </div>

      {/* =====================================================================
       * MAIN BODY: CANVA LEFT RAIL + CONTEXT DRAWER + WORKSPACE VIEWPORT
       * ===================================================================*/}
      <div className="flex-1 min-h-0 flex overflow-hidden relative">
        {/* Left Canva Vertical Tool Rail */}
        <aside
          aria-label="Barra lateral de herramientas de dibujo y diseño"
          className="w-[58px] shrink-0 border-r border-[var(--luma-border)] bg-[var(--luma-sidebar)] flex flex-col items-center py-2 gap-1 overflow-y-auto no-scrollbar z-10"
        >
          {(
            [
              { id: 'select', label: 'Sel.', icon: <MousePointer2 className="w-4 h-4" />, action: () => setTool('select') },
              { id: 'marquee', label: 'Marco', icon: <SquareDashedMousePointer className="w-4 h-4" />, action: () => setTool('marquee') },
              {
                id: 'pen',
                label: 'Pincel',
                icon: <PenTool className="w-4 h-4" />,
                action: () => {
                  setTool('pen');
                  setDrawerTab('draw');
                },
              },
              {
                id: 'eraser',
                label: 'Borrar',
                icon: <Eraser className="w-4 h-4" />,
                action: () => {
                  setTool('eraser');
                  setDrawerTab('draw');
                },
              },
              {
                id: 'fill',
                label: 'Relleno',
                icon: <PaintBucket className="w-4 h-4" />,
                action: () => {
                  setTool('fill');
                  setDrawerTab('draw');
                },
              },
              {
                id: 'text',
                label: 'Texto',
                icon: <Type className="w-4 h-4" />,
                action: () => {
                  setTool('text');
                  setDrawerTab('text');
                },
              },
              {
                id: 'pan',
                label: 'Mano',
                icon: <Hand className="w-4 h-4" />,
                action: () => setTool('pan'),
              },
            ] as const
          ).map((btn) => {
            const active = tool === btn.id;
            return (
              <button
                key={btn.id}
                type="button"
                onClick={btn.action}
                title={btn.label}
                aria-label={btn.label}
                className={`w-11 py-1.5 rounded-lg flex flex-col items-center justify-center gap-0.5 text-[10px] transition-colors ${
                  active
                    ? 'bg-[var(--luma-accent-soft)] text-[var(--luma-accent)] font-semibold'
                    : 'text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)] hover:bg-[var(--luma-surface-alt)]'
                }`}
              >
                {btn.icon}
                <span>{btn.label}</span>
              </button>
            );
          })}

          <div className="w-7 h-px bg-[var(--luma-border)] my-1" />

          {/* Drawer Toggles: Elementos, Capas, Diseño, Historial */}
          {(
            [
              { id: 'elements', label: 'Elem.', icon: <Shapes className="w-4 h-4" /> },
              { id: 'layers', label: 'Capas', icon: <Layers className="w-4 h-4" /> },
              { id: 'layout', label: 'Página', icon: <LayoutTemplate className="w-4 h-4" /> },
              { id: 'history', label: 'Hist.', icon: <Clock className="w-4 h-4" /> },
            ] as Array<{ id: SideDrawerTab; label: string; icon: React.ReactNode }>
          ).map((d) => {
            const active = drawerTab === d.id;
            return (
              <button
                key={d.id}
                type="button"
                onClick={() => setDrawerTab(active ? null : d.id)}
                title={d.label}
                aria-label={d.label}
                className={`w-11 py-1.5 rounded-lg flex flex-col items-center justify-center gap-0.5 text-[10px] transition-colors ${
                  active
                    ? 'bg-[var(--luma-surface)] text-[var(--luma-accent)] font-semibold border border-[var(--luma-border)]'
                    : 'text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)] hover:bg-[var(--luma-surface-alt)]'
                }`}
              >
                {d.icon}
                <span>{d.label}</span>
              </button>
            );
          })}
        </aside>

        {/* Collapsible Context Drawer (Brush / Elements / Text / Layers / Page Setup / History) */}
        {drawerTab && (
          <aside className="w-[258px] shrink-0 border-r border-[var(--luma-border)] bg-[var(--luma-surface)] p-3 overflow-y-auto z-10">
            {drawerTab === 'draw' && (
              <BrushPanel
                tool={tool}
                toolsState={toolsState}
                lastPressure={lastPressure}
                onSelectBrushTip={handleSelectBrushTip}
                onUpdateActiveBrush={handleUpdateActiveBrush}
                onUpdateEraser={handleUpdateEraser}
                onUpdateFill={handleUpdateFill}
              />
            )}

            {drawerTab === 'layers' && (
              <LayersPanel
                objects={activePage.objects}
                selectedIds={selectedIds}
                onSelectIds={(ids) => setSelectedIds(expandSelectionWithGroups(ids))}
                onUpdateObject={updateObject}
                onReorderObjects={(next, label) => commitActivePageObjects(next, label)}
                onDuplicateSelected={duplicateSelected}
                onDeleteSelected={deleteSelected}
                onGroupSelected={groupSelected}
                onUngroupSelected={ungroupSelected}
              />
            )}

            {drawerTab === 'layout' && (
              <PageSetupPanel
                pageSize={notebook.pageSize}
                setup={pageSetup}
                page={activePage}
                onChangePageSize={(sz) =>
                  onChangeNotebook({ ...notebook, pageSize: sz, updatedAt: Date.now() })
                }
                onUpdateSetup={updatePageSetup}
                onUpdatePage={(patch) => updateActivePage(patch, 'Cambiar estilo de hoja')}
                onInsertPageBreak={() => addNewPage(true)}
              />
            )}

            {drawerTab === 'history' && (
              <HistoryPanel
                past={past}
                future={future}
                onJumpToPast={jumpToPast}
                onJumpToFuture={jumpToFuture}
              />
            )}

            {drawerTab === 'text' && (
              <div className="space-y-3 text-xs">
                <div className="font-semibold text-[var(--luma-ink)]">Texto y tipografías</div>
                <FontPicker
                  value={currentFontFamily}
                  customFonts={customFonts}
                  onCustomFontsChange={setCustomFonts}
                  onChange={(family) => applyTypographyPatch({ fontFamily: family })}
                />

                <div className="space-y-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() =>
                      addTextBox({
                        text: 'Título Principal',
                        fontFamily: 'Playfair Display',
                        fontSize: 30,
                        bold: true,
                        color: '#1D4ED8',
                        fillColor: '#FFFFFF',
                        borderColor: '#2B64F5',
                        isBanner: true,
                      })
                    }
                    className="w-full p-2.5 rounded-xl border border-[var(--luma-accent)] bg-white text-blue-700 font-bold text-left text-sm"
                  >
                    + Añadir Título Banner
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      addTextBox({
                        text: 'Subtítulo de sección',
                        fontFamily: 'Montserrat',
                        fontSize: 20,
                        bold: true,
                      })
                    }
                    className="w-full p-2.5 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)] font-semibold text-left"
                  >
                    + Añadir Subtítulo
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      addTextBox({
                        text: 'Párrafo editorial con tipografía serif clásica para redactar ensayos y apuntes.',
                        fontFamily: 'Merriweather',
                        fontSize: 15,
                      })
                    }
                    className="w-full p-2.5 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)] text-left"
                  >
                    + Párrafo editorial
                  </button>
                  <button
                    type="button"
                    onClick={() =>
                      addTextBox({
                        text: 'Nota manuscrita personal',
                        fontFamily: 'Caveat',
                        fontSize: 24,
                        color: '#5B21B6',
                        fillColor: '#F5F3FF',
                        borderColor: '#C4B5FD',
                      })
                    }
                    className="w-full p-2.5 rounded-xl border border-violet-300 bg-violet-50 text-violet-800 text-left text-base"
                    style={{ fontFamily: '"Caveat", cursive' }}
                  >
                    + Nota manuscrita
                  </button>
                </div>

                <div className="pt-2 border-t border-[var(--luma-border)]">
                  <button
                    type="button"
                    onClick={() => setDocumentBodyOpen((v) => !v)}
                    className={`w-full h-9 px-3 rounded-lg border font-medium flex items-center justify-center gap-1.5 ${
                      documentBodyOpen
                        ? 'border-[var(--luma-accent)] bg-[var(--luma-accent-soft)] text-[var(--luma-accent)]'
                        : 'border-[var(--luma-border)] bg-[var(--luma-bg)]'
                    }`}
                  >
                    <FileText className="w-3.5 h-3.5" />
                    <span>
                      {documentBodyOpen ? 'Ocultar cuerpo Word' : 'Escribir en cuerpo de documento'}
                    </span>
                  </button>
                </div>
              </div>
            )}

            {drawerTab === 'elements' && (
              <div className="space-y-4 text-xs">
                <div>
                  <div className="font-semibold mb-2">Imágenes</div>
                  <button
                    type="button"
                    onClick={() => imageInputRef.current?.click()}
                    className="w-full h-9 px-3 rounded-xl border border-dashed border-[var(--luma-accent)] bg-[var(--luma-accent-soft)]/50 text-[var(--luma-accent)] font-semibold flex items-center justify-center gap-1.5 hover:bg-[var(--luma-accent-soft)]"
                  >
                    <ImageIcon className="w-4 h-4" />
                    <span>Subir imagen (o Ctrl+V / soltar)</span>
                  </button>
                </div>

                <div>
                  <div className="font-semibold mb-2">Formas y líneas</div>
                  <div className="grid grid-cols-3 gap-1.5">
                    {SHAPE_CATALOG.map((sh) => (
                      <button
                        key={sh.kind}
                        type="button"
                        onClick={() => addShape(sh.kind)}
                        className="py-2 px-1 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)] flex flex-col items-center gap-1 text-[10px]"
                      >
                        {sh.icon}
                        <span className="truncate max-w-full">{sh.label}</span>
                      </button>
                    ))}
                  </div>
                </div>

                <div>
                  <div className="font-semibold mb-2">Notas adhesivas y tablas</div>
                  <div className="grid grid-cols-2 gap-1.5 mb-1.5">
                    <button
                      type="button"
                      onClick={() => addSticky('#FEF3C7', '#451A03')}
                      className="h-8 rounded-lg bg-amber-100 text-amber-950 font-medium border border-amber-300"
                    >
                      Nota Ámbar
                    </button>
                    <button
                      type="button"
                      onClick={() => addSticky('#DCFCE7', '#14532D')}
                      className="h-8 rounded-lg bg-emerald-100 text-emerald-950 font-medium border border-emerald-300"
                    >
                      Nota Menta
                    </button>
                  </div>
                  <button
                    type="button"
                    onClick={() => addTable(3, 3)}
                    className="w-full h-8 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)] flex items-center justify-center gap-1.5 font-medium"
                  >
                    <Table2 className="w-3.5 h-3.5 text-[var(--luma-accent)]" />
                    <span>Insertar tabla editable 3×3</span>
                  </button>
                </div>

                <div>
                  <div className="font-semibold mb-2">Stickers de estudio</div>
                  <div className="grid grid-cols-2 gap-1.5">
                    {STICKERS.map((st) => (
                      <button
                        key={st.label}
                        type="button"
                        onClick={() => addSticker(st)}
                        className="h-8 px-2 rounded-lg font-semibold flex items-center gap-1.5 border border-black/10"
                        style={{ backgroundColor: st.bg, color: st.color }}
                      >
                        <span>{st.symbol}</span>
                        <span>{st.label}</span>
                      </button>
                    ))}
                  </div>
                </div>
              </div>
            )}
          </aside>
        )}

        {/* ===================================================================
         * CENTER CANVAS VIEWPORT + CONTEXTUAL OBJECT FLOATING TOOLBAR
         * =================================================================*/}
        <div className="flex-1 min-w-0 flex flex-col overflow-hidden relative bg-[var(--luma-bg)]">
          {/* Contextual Selection / Multi-Object Alignment / Image / Shape / Table Bar */}
          {selectedObjects.length > 0 && (
            <div className="px-3 py-1.5 border-b border-[var(--luma-border)] bg-[var(--luma-surface)] flex items-center gap-1.5 overflow-x-auto no-scrollbar text-xs shrink-0 z-10">
              <span className="font-semibold text-[var(--luma-accent)] whitespace-nowrap pr-1">
                {selectedObjects.length === 1
                  ? primarySelected?.name || '1 objeto'
                  : `${selectedObjects.length} seleccionados`}
              </span>

              {/* Alignment Controls (Canva style) */}
              <div className="flex items-center gap-0.5 px-1.5 border-l border-[var(--luma-border)] shrink-0">
                <button type="button" onClick={() => alignSelected('left')} title="Alinear a la izquierda" className="h-7 w-7 rounded hover:bg-[var(--luma-surface-alt)] flex items-center justify-center"><AlignStartVertical className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => alignSelected('centerH')} title="Centrar horizontalmente" className="h-7 w-7 rounded hover:bg-[var(--luma-surface-alt)] flex items-center justify-center"><AlignCenterVertical className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => alignSelected('right')} title="Alinear a la derecha" className="h-7 w-7 rounded hover:bg-[var(--luma-surface-alt)] flex items-center justify-center"><AlignEndVertical className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => alignSelected('top')} title="Alinear arriba" className="h-7 w-7 rounded hover:bg-[var(--luma-surface-alt)] flex items-center justify-center"><AlignStartHorizontal className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => alignSelected('middleV')} title="Centrar verticalmente" className="h-7 w-7 rounded hover:bg-[var(--luma-surface-alt)] flex items-center justify-center"><AlignCenterHorizontal className="w-3.5 h-3.5" /></button>
                <button type="button" onClick={() => alignSelected('bottom')} title="Alinear abajo" className="h-7 w-7 rounded hover:bg-[var(--luma-surface-alt)] flex items-center justify-center"><AlignEndHorizontal className="w-3.5 h-3.5" /></button>
                {selectedObjects.length >= 3 && (
                  <>
                    <button type="button" onClick={() => distributeSelected('h')} className="h-7 px-2 rounded hover:bg-[var(--luma-surface-alt)] text-[11px] whitespace-nowrap">Distribuir H</button>
                    <button type="button" onClick={() => distributeSelected('v')} className="h-7 px-2 rounded hover:bg-[var(--luma-surface-alt)] text-[11px] whitespace-nowrap">Distribuir V</button>
                  </>
                )}
              </div>

              {/* Group / Ungroup */}
              {(selectedObjects.length >= 2 || selectedObjects.some((o) => Boolean(o.groupId))) && (
                <div className="flex items-center gap-1 px-1.5 border-l border-[var(--luma-border)] shrink-0">
                  {selectedObjects.some((o) => Boolean(o.groupId)) ? (
                    <button type="button" onClick={ungroupSelected} className="h-7 px-2 rounded hover:bg-[var(--luma-surface-alt)] flex items-center gap-1 whitespace-nowrap">
                      <Ungroup className="w-3.5 h-3.5" />
                      <span>Desagrupar</span>
                    </button>
                  ) : (
                    <button type="button" onClick={groupSelected} className="h-7 px-2 rounded hover:bg-[var(--luma-surface-alt)] flex items-center gap-1 whitespace-nowrap">
                      <Group className="w-3.5 h-3.5" />
                      <span>Agrupar</span>
                    </button>
                  )}
                </div>
              )}

              {/* Image-Specific Controls: Crop, Flip H/V, Radius, Opacity */}
              {selectedImageObj && (
                <div className="flex items-center gap-1 px-1.5 border-l border-[var(--luma-border)] shrink-0">
                  <button
                    type="button"
                    onClick={() => setCropEditorOpen((v) => !v)}
                    className={`h-7 px-2 rounded flex items-center gap-1 whitespace-nowrap ${
                      cropEditorOpen ? 'bg-[var(--luma-accent-soft)] text-[var(--luma-accent)] font-semibold' : 'hover:bg-[var(--luma-surface-alt)]'
                    }`}
                  >
                    <Crop className="w-3.5 h-3.5" />
                    <span>Recortar</span>
                  </button>
                  <button
                    type="button"
                    onClick={() => updateObject(selectedImageObj.id, { flipX: !selectedImageObj.flipX }, true)}
                    title="Voltear horizontalmente"
                    className="h-7 w-7 rounded hover:bg-[var(--luma-surface-alt)] flex items-center justify-center"
                  >
                    <FlipHorizontal className="w-3.5 h-3.5" />
                  </button>
                  <button
                    type="button"
                    onClick={() => updateObject(selectedImageObj.id, { flipY: !selectedImageObj.flipY }, true)}
                    title="Voltear verticalmente"
                    className="h-7 w-7 rounded hover:bg-[var(--luma-surface-alt)] flex items-center justify-center"
                  >
                    <FlipVertical className="w-3.5 h-3.5" />
                  </button>
                  <label className="flex items-center gap-1 text-[11px]">
                    <span>Opac.</span>
                    <input
                      type="range"
                      min={10}
                      max={100}
                      value={Math.round((selectedImageObj.opacity ?? 1) * 100)}
                      onChange={(e) =>
                        updateObject(selectedImageObj.id, { opacity: Number(e.target.value) / 100 })
                      }
                      className="w-16 accent-[var(--luma-accent)]"
                    />
                  </label>
                </div>
              )}

              {/* Shape-Specific Controls: Fill, Stroke, Border Radius, Line Style */}
              {selectedShapeObj && (
                <div className="flex items-center gap-1.5 px-1.5 border-l border-[var(--luma-border)] shrink-0">
                  <label className="flex items-center gap-1 text-[11px]">
                    <span>Relleno</span>
                    <input
                      type="color"
                      value={selectedShapeObj.fillColor.startsWith('#') ? selectedShapeObj.fillColor.slice(0, 7) : '#DBEAFE'}
                      onChange={(e) => updateObject(selectedShapeObj.id, { fillColor: e.target.value }, true)}
                      className="w-5 h-5 border-0 bg-transparent cursor-pointer"
                    />
                  </label>
                  <label className="flex items-center gap-1 text-[11px]">
                    <span>Borde</span>
                    <input
                      type="color"
                      value={selectedShapeObj.strokeColor}
                      onChange={(e) => updateObject(selectedShapeObj.id, { strokeColor: e.target.value }, true)}
                      className="w-5 h-5 border-0 bg-transparent cursor-pointer"
                    />
                  </label>
                  <input
                    type="number"
                    min={1}
                    max={20}
                    value={selectedShapeObj.strokeWidth}
                    onChange={(e) =>
                      updateObject(selectedShapeObj.id, { strokeWidth: Math.max(1, Number(e.target.value) || 1) }, true)
                    }
                    title="Grosor del borde"
                    className="w-11 h-7 px-1 rounded border border-[var(--luma-border)] bg-[var(--luma-bg)] font-mono text-[11px] text-center"
                  />
                  {selectedShapeObj.shape === 'rect' && (
                    <label className="flex items-center gap-1 text-[11px]">
                      <span>Radio</span>
                      <input
                        type="range"
                        min={0}
                        max={48}
                        value={selectedShapeObj.borderRadius ?? 10}
                        onChange={(e) =>
                          updateObject(selectedShapeObj.id, { borderRadius: Number(e.target.value) })
                        }
                        className="w-14 accent-[var(--luma-accent)]"
                      />
                    </label>
                  )}
                </div>
              )}

              {/* Table-Specific Controls */}
              {selectedTableObj && (
                <div className="flex items-center gap-1 px-1.5 border-l border-[var(--luma-border)] shrink-0">
                  <button type="button" onClick={() => mutateSelectedTable('addRow')} className="h-7 px-2 rounded border border-[var(--luma-border)] hover:bg-[var(--luma-surface-alt)] whitespace-nowrap">+ Fila</button>
                  <button type="button" onClick={() => mutateSelectedTable('delRow')} className="h-7 px-2 rounded border border-[var(--luma-border)] hover:bg-[var(--luma-surface-alt)] whitespace-nowrap">- Fila</button>
                  <button type="button" onClick={() => mutateSelectedTable('addCol')} className="h-7 px-2 rounded border border-[var(--luma-border)] hover:bg-[var(--luma-surface-alt)] whitespace-nowrap">+ Col.</button>
                  <button type="button" onClick={() => mutateSelectedTable('delCol')} className="h-7 px-2 rounded border border-[var(--luma-border)] hover:bg-[var(--luma-surface-alt)] whitespace-nowrap">- Col.</button>
                  <button type="button" onClick={() => mutateSelectedTable('mergeRight')} className="h-7 px-2 rounded border border-[var(--luma-border)] hover:bg-[var(--luma-surface-alt)] whitespace-nowrap">Combinar celda</button>
                  <label className="flex items-center gap-1 text-[11px]">
                    <span>Cab.</span>
                    <input
                      type="color"
                      value={selectedTableObj.headerBg}
                      onChange={(e) => updateObject(selectedTableObj.id, { headerBg: e.target.value }, true)}
                      className="w-5 h-5 border-0 bg-transparent cursor-pointer"
                    />
                  </label>
                </div>
              )}

              <div className="flex-1" />
              <button
                type="button"
                onClick={duplicateSelected}
                title="Duplicar (Ctrl+D)"
                className="h-7 px-2 rounded hover:bg-[var(--luma-surface-alt)] flex items-center gap-1 whitespace-nowrap"
              >
                <Copy className="w-3.5 h-3.5" />
                <span>Duplicar</span>
              </button>
              <button
                type="button"
                onClick={deleteSelected}
                title="Eliminar (Supr)"
                className="h-7 px-2 rounded hover:bg-red-500/15 hover:text-red-500 flex items-center gap-1 whitespace-nowrap"
              >
                <Trash2 className="w-3.5 h-3.5" />
                <span>Eliminar</span>
              </button>
            </div>
          )}

          {/* Image Crop Inline Bar */}
          {cropEditorOpen && selectedImageObj && (
            <div className="px-3 py-2 border-b border-[var(--luma-border)] bg-[var(--luma-surface-alt)] flex flex-wrap items-center gap-3 text-xs shrink-0">
              <span className="font-semibold">Recorte de imagen (%)</span>
              {(['top', 'bottom', 'left', 'right'] as const).map((side) => (
                <label key={side} className="flex items-center gap-1.5">
                  <span className="capitalize text-[11px]">
                    {side === 'top' ? 'Arriba' : side === 'bottom' ? 'Abajo' : side === 'left' ? 'Izq.' : 'Der.'}
                  </span>
                  <input
                    type="range"
                    min={0}
                    max={45}
                    value={selectedImageObj.crop?.[side] ?? 0}
                    onChange={(e) =>
                      updateObject(selectedImageObj.id, {
                        crop: {
                          top: selectedImageObj.crop?.top ?? 0,
                          right: selectedImageObj.crop?.right ?? 0,
                          bottom: selectedImageObj.crop?.bottom ?? 0,
                          left: selectedImageObj.crop?.left ?? 0,
                          [side]: Number(e.target.value),
                        },
                      })
                    }
                    className="w-20 accent-[var(--luma-accent)]"
                  />
                </label>
              ))}
              <button
                type="button"
                onClick={() =>
                  updateObject(
                    selectedImageObj.id,
                    { crop: { top: 0, right: 0, bottom: 0, left: 0 } },
                    true
                  )
                }
                className="h-7 px-2.5 rounded border border-[var(--luma-border)] bg-[var(--luma-surface)] text-[11px]"
              >
                Restablecer
              </button>
            </div>
          )}

          {/* Scrollable Artboard Workspace */}
          <div
            ref={viewportScrollRef}
            onWheel={handleViewportWheel}
            onTouchMove={handleTouchMovePinch}
            onTouchEnd={() => {
              pinchDistRef.current = null;
            }}
            className="flex-1 overflow-auto p-6 sm:p-10 flex items-start justify-center"
          >
            <div className="inline-flex flex-col items-start">
              {/* Top Horizontal Ruler */}
              {pageSetup.showRulers && (
                <div className="flex items-end mb-1">
                  <div className="w-[22px] h-[22px] mr-1 rounded-tl-md border border-[var(--luma-border)] bg-[var(--luma-surface)] text-[9px] font-mono text-[var(--luma-ink-muted)] flex items-center justify-center shrink-0">
                    {pageSetup.rulerUnit}
                  </div>
                  <HorizontalRuler
                    geom={geom}
                    zoom={zoom}
                    unit={pageSetup.rulerUnit}
                    marginsPx={marginsPx}
                  />
                </div>
              )}

              <div className="flex items-start">
                {/* Left Vertical Ruler */}
                {pageSetup.showRulers && (
                  <div className="mr-1">
                    <VerticalRuler
                      geom={geom}
                      zoom={zoom}
                      unit={pageSetup.rulerUnit}
                      marginsPx={marginsPx}
                    />
                  </div>
                )}

                {/* Scaled Page Container */}
                <div
                  style={{ width: geom.w * zoom, height: geom.h * zoom }}
                  className="relative shrink-0 shadow-2xl rounded-[3px] ring-1 ring-black/10"
                >
                  <div
                    ref={pageContainerRef}
                    onPointerDown={handlePagePointerDown}
                    onPointerMove={handlePagePointerMove}
                    onPointerUp={handlePagePointerUp}
                    onPointerCancel={handlePagePointerUp}
                    onPointerLeave={() => {
                      setEraserCursorPos(null);
                      setIsErasingNow(false);
                    }}
                    style={{
                      width: geom.w,
                      height: geom.h,
                      transform: `scale(${zoom})`,
                      transformOrigin: 'top left',
                      touchAction: isDrawingToolActive ? 'none' : 'manipulation',
                      ...paperPatternStyle,
                    }}
                    className={`luma-editing-canvas-zone relative overflow-hidden ${
                      tool === 'pan' || spacePressed
                        ? 'cursor-grab'
                        : tool === 'eraser'
                          ? 'cursor-none'
                          : isDrawingToolActive
                            ? 'cursor-crosshair'
                            : 'cursor-default'
                    }`}
                  >
                    {/* Cornell Guide Lines */}
                    {activePage.pattern === 'cornell' && (
                      <svg
                        className="absolute inset-0 w-full h-full pointer-events-none"
                        viewBox={`0 0 ${geom.w} ${geom.h}`}
                      >
                        <line x1={0} y1={118} x2={geom.w} y2={118} stroke="rgba(194,100,43,0.28)" strokeWidth={1.5} />
                        <line x1={310} y1={118} x2={310} y2={geom.h - 170} stroke="rgba(194,100,43,0.28)" strokeWidth={1.5} />
                        <line x1={0} y1={geom.h - 170} x2={geom.w} y2={geom.h - 170} stroke="rgba(194,100,43,0.28)" strokeWidth={1.5} />
                      </svg>
                    )}

                    {/* Optional Magnetic Grid Overlay */}
                    {pageSetup.showGrid && (
                      <div
                        className="absolute inset-0 pointer-events-none"
                        style={{
                          backgroundImage:
                            'linear-gradient(to right, rgba(43,100,245,0.12) 1px, transparent 1px), linear-gradient(to bottom, rgba(43,100,245,0.12) 1px, transparent 1px)',
                          backgroundSize: '28px 28px',
                        }}
                      />
                    )}

                    {/* Word-Style Visible Margin Guides */}
                    {pageSetup.showMarginGuides && (
                      <div
                        className="absolute pointer-events-none border border-dashed border-blue-500/35"
                        style={{
                          top: marginsPx.top,
                          left: marginsPx.left,
                          right: marginsPx.right,
                          bottom: marginsPx.bottom,
                        }}
                      />
                    )}

                    {/* Header / Footer / Page Numbers */}
                    {pageSetup.headerText && (
                      <div
                        className="absolute pointer-events-none text-xs text-slate-500 truncate"
                        style={{
                          top: Math.max(14, marginsPx.top * 0.4),
                          left: marginsPx.left,
                          right: marginsPx.right,
                        }}
                      >
                        {pageSetup.headerText}
                      </div>
                    )}
                    {(pageSetup.footerText || pageSetup.showPageNumbers) && (
                      <div
                        className="absolute pointer-events-none flex items-center justify-between text-xs text-slate-500"
                        style={{
                          bottom: Math.max(14, marginsPx.bottom * 0.38),
                          left: marginsPx.left,
                          right: marginsPx.right,
                        }}
                      >
                        <span className="truncate">{pageSetup.footerText}</span>
                        {pageSetup.showPageNumbers && (
                          <span className="font-mono tabular-nums shrink-0 ml-2">
                            Página {notebook.activePageIndex + 1} de {notebook.pages.length}
                          </span>
                        )}
                      </div>
                    )}

                    {/* Direct Word-Style Flowing Document Body (enabled by default so you type right on the sheet!) */}
                    {(documentBodyOpen || Boolean(activePage.bodyText?.trim())) && (
                      <div
                        style={{
                          position: 'absolute',
                          top: marginsPx.top,
                          left: marginsPx.left,
                          right: marginsPx.right,
                          bottom: marginsPx.bottom,
                          paddingLeft: Math.round(pageSetup.indentMm * geom.pxPerMm),
                          columnCount: pageSetup.columns,
                          columnGap: 28,
                          pointerEvents:
                            documentBodyOpen &&
                            !isDrawingToolActive &&
                            tool !== 'marquee' &&
                            tool !== 'pan' &&
                            !spacePressed
                              ? 'auto'
                              : 'none',
                        }}
                        onPointerDown={(e) => {
                          if (
                            documentBodyOpen &&
                            !isDrawingToolActive &&
                            tool !== 'marquee' &&
                            tool !== 'pan' &&
                            !spacePressed
                          ) {
                            e.stopPropagation();
                            setSelectedIds([]);
                            setEditingId(null);
                          }
                        }}
                      >
                        {documentBodyOpen &&
                        !isDrawingToolActive &&
                        tool !== 'marquee' &&
                        tool !== 'pan' &&
                        !spacePressed ? (
                          <textarea
                            ref={bodyTextareaRef}
                            value={activePage.bodyText ?? ''}
                            onChange={(e) => updateActivePage({ bodyText: e.target.value })}
                            onKeyDown={(e) => {
                              if (e.key === 'Enter' && activeBodyStyle.listType !== 'none') {
                                e.preventDefault();
                                const ta = e.currentTarget;
                                const pos = ta.selectionStart ?? (activePage.bodyText ?? '').length;
                                const val = activePage.bodyText ?? '';
                                const before = val.slice(0, pos);
                                const after = val.slice(ta.selectionEnd ?? pos);
                                const lineCount = before.split('\n').length;
                                const prefix =
                                  activeBodyStyle.listType === 'bullet'
                                    ? '\n• '
                                    : `\n${lineCount + 1}. `;
                                updateActivePage({ bodyText: `${before}${prefix}${after}` });
                                const nextCaret = pos + prefix.length;
                                window.requestAnimationFrame(() => {
                                  ta.setSelectionRange(nextCaret, nextCaret);
                                });
                              }
                            }}
                            onPointerDown={(e) => e.stopPropagation()}
                            onMouseDown={(e) => e.stopPropagation()}
                            onClick={(e) => e.stopPropagation()}
                            placeholder="Empieza a escribir directamente en la hoja (como en Word)..."
                            className="w-full h-full bg-transparent resize-none outline-none select-text"
                            style={{
                              fontFamily: resolveFontFamilyCss(activeBodyStyle.fontFamily),
                              fontSize: activeBodyStyle.fontSize,
                              fontWeight: activeBodyStyle.bold ? 700 : 400,
                              fontStyle: activeBodyStyle.italic ? 'italic' : 'normal',
                              textDecoration:
                                [
                                  activeBodyStyle.underline ? 'underline' : '',
                                  activeBodyStyle.strikethrough ? 'line-through' : '',
                                ]
                                  .filter(Boolean)
                                  .join(' ') || 'none',
                              color: activeBodyStyle.color,
                              backgroundColor:
                                activeBodyStyle.highlightColor &&
                                activeBodyStyle.highlightColor !== 'transparent'
                                  ? `${activeBodyStyle.highlightColor}40`
                                  : 'transparent',
                              textAlign: activeBodyStyle.align,
                              lineHeight: activeBodyStyle.lineHeight,
                              letterSpacing: activeBodyStyle.letterSpacing
                                ? `${activeBodyStyle.letterSpacing}px`
                                : undefined,
                            }}
                          />
                        ) : (
                          <div
                            className="w-full h-full whitespace-pre-wrap"
                            style={{
                              fontFamily: resolveFontFamilyCss(activeBodyStyle.fontFamily),
                              fontSize: activeBodyStyle.fontSize,
                              fontWeight: activeBodyStyle.bold ? 700 : 400,
                              fontStyle: activeBodyStyle.italic ? 'italic' : 'normal',
                              textDecoration:
                                [
                                  activeBodyStyle.underline ? 'underline' : '',
                                  activeBodyStyle.strikethrough ? 'line-through' : '',
                                ]
                                  .filter(Boolean)
                                  .join(' ') || 'none',
                              color: activeBodyStyle.color,
                              textAlign: activeBodyStyle.align,
                              lineHeight: activeBodyStyle.lineHeight,
                              letterSpacing: activeBodyStyle.letterSpacing
                                ? `${activeBodyStyle.letterSpacing}px`
                                : undefined,
                            }}
                          >
                            {activePage.bodyText}
                          </div>
                        )}
                      </div>
                    )}

                    {/* Raster Layer (Flood Fill & Pixel Eraser) */}
                    <canvas
                      ref={rasterCanvasRef}
                      className="absolute inset-0 w-full h-full pointer-events-none"
                    />

                    {/* Interactive Canva Objects Layer */}
                    {activePage.objects.map((obj) => {
                      if (obj.kind === 'stroke' || obj.visible === false) return null;
                      const isSel = selectedIds.includes(obj.id);
                      const isEditing = editingId === obj.id;
                      const isTextEditable = obj.kind === 'text' || obj.kind === 'sticky';
                      const blendStyle =
                        obj.blendMode && obj.blendMode !== 'normal'
                          ? (obj.blendMode as React.CSSProperties['mixBlendMode'])
                          : undefined;

                      return (
                        <div
                          key={obj.id}
                          onPointerDown={(e) => {
                            if (isDrawingToolActive || tool === 'pan' || spacePressed) return;
                            if (isEditing) {
                              e.stopPropagation();
                              return;
                            }
                            e.stopPropagation();

                            const wasAlreadyOnlySelected =
                              isSel && selectedIds.length === 1 && !e.shiftKey;

                            let nextSel: string[];
                            if (e.shiftKey) {
                              nextSel = isSel
                                ? selectedIds.filter((id) => id !== obj.id)
                                : expandSelectionWithGroups([...selectedIds, obj.id]);
                            } else if (isSel && selectedIds.length > 1) {
                              nextSel = selectedIds;
                            } else {
                              nextSel = expandSelectionWithGroups([obj.id]);
                            }
                            setSelectedIds(nextSel);
                            setEditingId(null);

                            if (!obj.locked) {
                              beginTransform(
                                e,
                                'move',
                                nextSel,
                                undefined,
                                wasAlreadyOnlySelected && isTextEditable ? obj.id : undefined
                              );
                            }
                          }}
                          onDoubleClick={(e) => {
                            e.stopPropagation();
                            if (obj.locked) return;
                            if (isTextEditable) {
                              setSelectedIds([obj.id]);
                              setEditingId(obj.id);
                            }
                          }}
                          style={{
                            position: 'absolute',
                            left: obj.x,
                            top: obj.y,
                            width: obj.w,
                            height: obj.h,
                            opacity: obj.opacity ?? 1,
                            mixBlendMode: blendStyle,
                            transform: obj.rotation ? `rotate(${obj.rotation}deg)` : undefined,
                            pointerEvents: isDrawingToolActive ? 'none' : 'auto',
                          }}
                          className={`${isSel ? 'ring-1 ring-blue-500/80' : 'hover:ring-1 hover:ring-blue-400/50'} ${
                            obj.locked ? 'cursor-not-allowed' : 'cursor-move'
                          }`}
                        >
                          {/* 1. Image Object */}
                          {obj.kind === 'image' && (
                            <div
                              className="w-full h-full overflow-hidden"
                              style={{ borderRadius: obj.borderRadius ?? 0 }}
                            >
                              <img
                                src={obj.src}
                                alt={obj.alt || 'Imagen en cuaderno'}
                                draggable={false}
                                className="w-full h-full object-cover select-none pointer-events-none"
                                style={{
                                  clipPath: obj.crop
                                    ? `inset(${obj.crop.top}% ${obj.crop.right}% ${obj.crop.bottom}% ${obj.crop.left}%)`
                                    : undefined,
                                  transform: `scale(${obj.flipX ? -1 : 1}, ${obj.flipY ? -1 : 1})`,
                                }}
                              />
                            </div>
                          )}

                          {/* 2. Shape Object */}
                          {obj.kind === 'shape' && <ShapeSvgRenderer obj={obj} />}

                          {/* 3. Rich Text Box */}
                          {obj.kind === 'text' && (
                            <div
                              className="w-full h-full rounded-[10px] p-2.5 overflow-hidden"
                              style={{
                                backgroundColor: obj.fillColor !== 'transparent' ? obj.fillColor : 'transparent',
                                border:
                                  obj.borderColor && obj.borderColor !== 'transparent'
                                    ? `${obj.isBanner ? 2 : 1}px solid ${obj.borderColor}`
                                    : undefined,
                                fontFamily: resolveFontFamilyCss(obj.fontFamily),
                                fontSize: obj.script === 'super' || obj.script === 'sub' ? Math.round(obj.fontSize * 0.72) : obj.fontSize,
                                fontWeight: obj.bold ? 700 : 400,
                                fontStyle: obj.italic ? 'italic' : 'normal',
                                textDecoration:
                                  [obj.underline ? 'underline' : '', obj.strikethrough ? 'line-through' : '']
                                    .filter(Boolean)
                                    .join(' ') || 'none',
                                color: obj.color,
                                textAlign: obj.align,
                                lineHeight: obj.lineHeight ?? 1.5,
                                letterSpacing: obj.letterSpacing ? `${obj.letterSpacing}px` : undefined,
                                paddingLeft: 10 + (obj.indentPx ?? 0),
                              }}
                            >
                              {isEditing ? (
                                <textarea
                                  value={obj.text}
                                  onChange={(e) => updateObject(obj.id, { text: e.target.value })}
                                  onFocus={(e) => {
                                    if (PLACEHOLDER_TEXTS.has(e.currentTarget.value.trim())) {
                                      e.currentTarget.select();
                                    }
                                  }}
                                  onPointerDown={(e) => e.stopPropagation()}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Escape') {
                                      e.stopPropagation();
                                      setEditingId(null);
                                    }
                                  }}
                                  onBlur={() => setEditingId(null)}
                                  autoFocus
                                  className="w-full h-full bg-transparent resize-none outline-none select-text cursor-text"
                                  style={{
                                    fontFamily: 'inherit',
                                    fontSize: 'inherit',
                                    fontWeight: 'inherit',
                                    fontStyle: 'inherit',
                                    textDecoration: 'inherit',
                                    color: 'inherit',
                                    textAlign: obj.align,
                                    lineHeight: 'inherit',
                                    letterSpacing: 'inherit',
                                  }}
                                />
                              ) : (
                                <div
                                  className="w-full h-full whitespace-pre-wrap break-words"
                                  style={{
                                    verticalAlign:
                                      obj.script === 'super'
                                        ? 'super'
                                        : obj.script === 'sub'
                                          ? 'sub'
                                          : 'baseline',
                                  }}
                                >
                                  {obj.text.split('\n').map((line, lineIdx) => (
                                    <div key={lineIdx}>
                                      <span
                                        style={{
                                          backgroundColor:
                                            obj.highlightColor && obj.highlightColor !== 'transparent'
                                              ? obj.highlightColor
                                              : undefined,
                                        }}
                                      >
                                        {obj.listType === 'bullet'
                                          ? `• ${line}`
                                          : obj.listType === 'number'
                                            ? `${lineIdx + 1}. ${line}`
                                            : line || '\u00A0'}
                                      </span>
                                    </div>
                                  ))}
                                </div>
                              )}
                            </div>
                          )}

                          {/* 4. Sticky Note */}
                          {obj.kind === 'sticky' && (
                            <div
                              className="w-full h-full rounded-xl p-3 shadow-md"
                              style={{ backgroundColor: obj.bgColor, color: obj.textColor }}
                            >
                              {isEditing ? (
                                <textarea
                                  value={obj.text}
                                  onChange={(e) => updateObject(obj.id, { text: e.target.value })}
                                  onFocus={(e) => {
                                    if (PLACEHOLDER_TEXTS.has(e.currentTarget.value.trim())) {
                                      e.currentTarget.select();
                                    }
                                  }}
                                  onPointerDown={(e) => e.stopPropagation()}
                                  onMouseDown={(e) => e.stopPropagation()}
                                  onClick={(e) => e.stopPropagation()}
                                  onKeyDown={(e) => {
                                    if (e.key === 'Escape') {
                                      e.stopPropagation();
                                      setEditingId(null);
                                    }
                                  }}
                                  onBlur={() => setEditingId(null)}
                                  autoFocus
                                  className="w-full h-full bg-transparent resize-none outline-none text-sm leading-snug select-text cursor-text"
                                />
                              ) : (
                                <div className="w-full h-full whitespace-pre-wrap text-sm leading-snug overflow-hidden">
                                  {obj.text}
                                </div>
                              )}
                            </div>
                          )}

                          {/* 5. Editable Table with Merge Support */}
                          {obj.kind === 'table' && (
                            <table
                              className="w-full h-full border-collapse table-fixed bg-white rounded-md overflow-hidden"
                              style={{ borderColor: obj.borderColor }}
                            >
                              <tbody>
                                {Array.from({ length: obj.rows }).map((_, r) => (
                                  <tr key={r}>
                                    {Array.from({ length: obj.cols }).map((__, c) => {
                                      const idx = r * obj.cols + c;
                                      const cellStyle = obj.cellStyles?.[idx];
                                      if (cellStyle?.hidden) return null;
                                      return (
                                        <td
                                          key={c}
                                          colSpan={cellStyle?.colSpan ?? 1}
                                          rowSpan={cellStyle?.rowSpan ?? 1}
                                          onClick={(e) => {
                                            e.stopPropagation();
                                            setSelectedIds([obj.id]);
                                            setSelectedTableCell(idx);
                                          }}
                                          style={{
                                            backgroundColor:
                                              cellStyle?.bg || (r === 0 ? obj.headerBg : '#FFFFFF'),
                                            border: `1px solid ${obj.borderColor}`,
                                            color: cellStyle?.textColor || '#1A2233',
                                          }}
                                          className={`p-1 align-top ${
                                            selectedTableCell === idx && isSel ? 'ring-2 ring-inset ring-blue-500' : ''
                                          }`}
                                        >
                                          <input
                                            value={obj.cells[idx] ?? ''}
                                            onChange={(e) => {
                                              const nextCells = [...obj.cells];
                                              nextCells[idx] = e.target.value;
                                              updateObject(obj.id, { cells: nextCells });
                                            }}
                                            onPointerDown={(e) => e.stopPropagation()}
                                            className={`w-full bg-transparent outline-none text-xs ${
                                              r === 0 || cellStyle?.bold ? 'font-semibold' : ''
                                            }`}
                                          />
                                        </td>
                                      );
                                    })}
                                  </tr>
                                ))}
                              </tbody>
                            </table>
                          )}

                          {/* 6. Study Sticker */}
                          {obj.kind === 'sticker' && (
                            <div
                              className="w-full h-full rounded-xl flex items-center justify-center gap-1.5 font-semibold text-sm shadow-sm"
                              style={{ backgroundColor: obj.bgColor, color: obj.color }}
                            >
                              <span>{obj.symbol}</span>
                              <span>{obj.label}</span>
                            </div>
                          )}
                        </div>
                      );
                    })}

                    {/* High-DPI Ink Strokes Canvas Layer */}
                    <canvas
                      ref={inkCanvasRef}
                      className="absolute inset-0 w-full h-full pointer-events-none"
                    />

                    {/* Live Circular Eraser Area Cursor (exact size of eraserSettings.size!) */}
                    {tool === 'eraser' && eraserCursorPos && (
                      <div
                        aria-hidden="true"
                        style={{
                          left: eraserCursorPos.x - eraserSettings.size / 2,
                          top: eraserCursorPos.y - eraserSettings.size / 2,
                          width: eraserSettings.size,
                          height: eraserSettings.size,
                          boxShadow:
                            eraserSettings.mode === 'stroke'
                              ? '0 0 0 1.5px rgba(255,255,255,0.9), inset 0 0 0 1px rgba(225,29,72,0.45)'
                              : '0 0 0 1.5px rgba(255,255,255,0.95), 0 0 8px rgba(0,0,0,0.22)',
                        }}
                        className={`absolute rounded-full pointer-events-none z-40 flex items-center justify-center ${
                          eraserSettings.mode === 'stroke'
                            ? 'border-2 border-dashed border-rose-600 bg-rose-500/12'
                            : isErasingNow
                              ? 'border-2 border-slate-900 bg-white/35'
                              : 'border-2 border-slate-800 bg-white/20'
                        }`}
                      >
                        <span
                          className={`w-1.5 h-1.5 rounded-full ${
                            eraserSettings.mode === 'stroke' ? 'bg-rose-600' : 'bg-slate-900/75'
                          }`}
                        />
                      </div>
                    )}

                    {/* Smart Alignment Snap Guides */}
                    {snapGuides.map((g, idx) =>
                      g.axis === 'x' ? (
                        <div
                          key={`gx_${idx}`}
                          style={{ left: g.pos }}
                          className="absolute top-0 bottom-0 w-px bg-fuchsia-500 pointer-events-none z-30"
                        />
                      ) : (
                        <div
                          key={`gy_${idx}`}
                          style={{ top: g.pos }}
                          className="absolute left-0 right-0 h-px bg-fuchsia-500 pointer-events-none z-30"
                        />
                      )
                    )}

                    {/* Multi-Select Marquee Rectangle */}
                    {marqueeRect && (
                      <div
                        style={{
                          left: marqueeRect.x,
                          top: marqueeRect.y,
                          width: marqueeRect.w,
                          height: marqueeRect.h,
                        }}
                        className="absolute border border-blue-500 bg-blue-500/15 pointer-events-none z-30"
                      />
                    )}

                    {/* Canva Transform Bounding Box with 8 Resize Handles + Top Rotation Handle */}
                    {selectionBox && !isDrawingToolActive && !editingId && (
                      <div
                        style={{
                          left: selectionBox.x,
                          top: selectionBox.y,
                          width: selectionBox.w,
                          height: selectionBox.h,
                          transform:
                            primarySelected?.rotation && primarySelected.kind !== 'stroke'
                              ? `rotate(${primarySelected.rotation}deg)`
                              : undefined,
                        }}
                        className="absolute border-2 border-blue-500 pointer-events-none z-20"
                      >
                        {/* Rotation Handle */}
                        <button
                          type="button"
                          onPointerDown={(e) => beginTransform(e, 'rotate', selectedIds)}
                          title="Rotar (mantén Shift para ángulos de 15°)"
                          aria-label="Asa de rotación"
                          className="pointer-events-auto absolute -top-9 left-1/2 -translate-x-1/2 w-6 h-6 rounded-full bg-white border-2 border-blue-500 text-blue-600 shadow flex items-center justify-center cursor-grab hover:scale-110 transition-transform"
                        >
                          <RotateCw className="w-3 h-3" />
                        </button>
                        <div className="absolute -top-3 left-1/2 -translate-x-1/2 w-px h-3 bg-blue-500" />

                        {/* 8 Corner & Side Resize Handles */}
                        {(
                          [
                            { id: 'nw', cls: '-top-1.5 -left-1.5 cursor-nwse-resize' },
                            { id: 'n', cls: '-top-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize' },
                            { id: 'ne', cls: '-top-1.5 -right-1.5 cursor-nesw-resize' },
                            { id: 'e', cls: 'top-1/2 -right-1.5 -translate-y-1/2 cursor-ew-resize' },
                            { id: 'se', cls: '-bottom-1.5 -right-1.5 cursor-nwse-resize' },
                            { id: 's', cls: '-bottom-1.5 left-1/2 -translate-x-1/2 cursor-ns-resize' },
                            { id: 'sw', cls: '-bottom-1.5 -left-1.5 cursor-nesw-resize' },
                            { id: 'w', cls: 'top-1/2 -left-1.5 -translate-y-1/2 cursor-ew-resize' },
                          ] as Array<{ id: ResizeHandle; cls: string }>
                        ).map((h) => (
                          <div
                            key={h.id}
                            onPointerDown={(e) => beginTransform(e, 'resize', selectedIds, h.id)}
                            className={`pointer-events-auto absolute w-3 h-3 rounded-sm bg-white border-2 border-blue-600 shadow ${h.cls}`}
                          />
                        ))}
                      </div>
                    )}
                  </div>
                </div>
              </div>
            </div>
          </div>

          {/* =================================================================
           * BOTTOM PAGE MANAGER & ZOOM BAR
           * ===============================================================*/}
          <footer className="h-10 px-3 border-t border-[var(--luma-border)] bg-[var(--luma-surface)] flex items-center justify-between gap-2 text-xs shrink-0">
            {/* Page Tabs + Add / Reorder / Duplicate / Delete */}
            <div className="flex items-center gap-1 overflow-x-auto no-scrollbar min-w-0">
              {notebook.pages.map((p, idx) => {
                const active = idx === notebook.activePageIndex;
                return (
                  <div
                    key={p.id}
                    className={`flex items-center gap-0.5 h-7 px-2 rounded-md border text-[11px] shrink-0 ${
                      active
                        ? 'border-[var(--luma-accent)] bg-[var(--luma-accent-soft)] text-[var(--luma-accent)] font-semibold'
                        : 'border-[var(--luma-border)] bg-[var(--luma-bg)] text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)]'
                    }`}
                  >
                    <button
                      type="button"
                      onClick={() => {
                        onChangeNotebook({ ...notebook, activePageIndex: idx });
                        setSelectedIds([]);
                      }}
                      className="whitespace-nowrap"
                    >
                      Pág. {idx + 1}
                    </button>
                    {active && notebook.pages.length > 1 && (
                      <div className="flex items-center ml-1">
                        <button
                          type="button"
                          onClick={() => movePageOrder(idx, -1)}
                          disabled={idx === 0}
                          title="Mover página a la izquierda"
                          className="p-0.5 disabled:opacity-30"
                        >
                          <ChevronLeft className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => movePageOrder(idx, 1)}
                          disabled={idx === notebook.pages.length - 1}
                          title="Mover página a la derecha"
                          className="p-0.5 disabled:opacity-30"
                        >
                          <ChevronRight className="w-3 h-3" />
                        </button>
                        <button
                          type="button"
                          onClick={() => deletePage(idx)}
                          title="Eliminar página"
                          className="p-0.5 hover:text-red-500"
                        >
                          <Trash2 className="w-3 h-3" />
                        </button>
                      </div>
                    )}
                  </div>
                );
              })}

              <button
                type="button"
                onClick={() => addNewPage(false)}
                className="h-7 px-2 rounded-md border border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)] flex items-center gap-1 text-[11px] whitespace-nowrap shrink-0"
              >
                <Plus className="w-3 h-3" />
                <span>Página</span>
              </button>
              <button
                type="button"
                onClick={duplicateCurrentPage}
                title="Duplicar página actual"
                className="h-7 px-2 rounded-md hover:bg-[var(--luma-surface-alt)] text-[11px] text-[var(--luma-ink-muted)] whitespace-nowrap shrink-0"
              >
                Duplicar pág.
              </button>
            </div>

            {/* Right Zoom Controls */}
            <div className="flex items-center gap-1 shrink-0">
              <span className="hidden md:inline text-[11px] text-[var(--luma-ink-muted)] mr-1">
                {geom.label}
              </span>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.max(0.25, Number((z - 0.1).toFixed(2))))}
                aria-label="Alejar zoom"
                className="h-7 w-7 rounded-md hover:bg-[var(--luma-surface-alt)] flex items-center justify-center"
              >
                <ZoomOut className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setZoom(1)}
                title="Restablecer zoom a 100%"
                className="h-7 px-2 rounded-md hover:bg-[var(--luma-surface-alt)] font-mono text-[11px] tabular-nums"
              >
                {Math.round(zoom * 100)}%
              </button>
              <button
                type="button"
                onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.1).toFixed(2))))}
                aria-label="Acercar zoom"
                className="h-7 w-7 rounded-md hover:bg-[var(--luma-surface-alt)] flex items-center justify-center"
              >
                <ZoomIn className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={fitPageToScreen}
                title="Ajustar página a la pantalla (Ctrl+0)"
                className="h-7 px-2 rounded-md border border-[var(--luma-border)] hover:bg-[var(--luma-surface-alt)] text-[11px] whitespace-nowrap"
              >
                Ajustar
              </button>
            </div>
          </footer>

          {/* Toast Feedback */}
          {statusToast && (
            <div
              role="status"
              aria-live="polite"
              className="fixed bottom-14 right-4 z-50 px-3.5 py-2 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-surface)] text-xs font-medium shadow-xl"
            >
              {statusToast}
            </div>
          )}
        </div>
      </div>

      {/* Find & Replace Modal */}
      <FindReplaceModal
        open={findOpen}
        notebook={notebook}
        onClose={() => setFindOpen(false)}
        onReplaceAll={handleReplaceAll}
      />

      {/* Keyboard Shortcuts Help Modal */}
      <ShortcutsHelpModal
        open={shortcutsOpen}
        onClose={() => setShortcutsOpen(false)}
      />
    </div>
  );
};
