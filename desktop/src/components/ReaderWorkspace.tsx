import React, { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowUpRight,
  Bookmark,
  BookOpen,
  Brush,
  ChevronLeft,
  ChevronRight,
  Circle,
  Columns2,
  Download,
  Eraser,
  ExternalLink,
  Eye,
  EyeOff,
  FileText,
  Highlighter,
  Languages,
  List,
  Loader2,
  Maximize2,
  MessageSquarePlus,
  Minimize2,
  Minus,
  MousePointer2,
  PanelLeft,
  PanelRight,
  PenTool,
  Plus,
  Redo2,
  RotateCw,
  ScrollText,
  Search,
  Settings,
  SlidersHorizontal,
  Square,
  StickyNote,
  Sun,
  Trash2,
  Type,
  Undo2,
  X,
} from 'lucide-react';
import {
  BookmarkItem,
  HighlightNote,
  InkStroke,
  LumaDocument,
  ParsedBlock,
  ReaderAnnotationTool,
  ReaderFontId,
  ReaderStickyNote,
  TextRun,
  WorkspacePreferences,
} from '../types';
import { getThemeSpec, LUMA_THEMES } from '../themes';
import { ViewportProfile } from '../hooks/useViewportProfile';
import { lookupWordMeaning, WordLookupResult } from '../utils/dictionaryLookup';
import { PdfCanvasViewer } from './PdfCanvasViewer';

interface ReaderWorkspaceProps {
  document: LumaDocument;
  prefs: WorkspacePreferences;
  viewport: ViewportProfile;
  highlights: HighlightNote[];
  bookmarks: BookmarkItem[];
  compactSplit?: boolean;
  isImmersiveFullscreen: boolean;
  onUpdateDocument: (updater: (doc: LumaDocument) => LumaDocument) => void;
  onUpdatePrefs: (patch: Partial<WorkspacePreferences>) => void;
  onAddHighlight: (item: Omit<HighlightNote, 'id' | 'createdAt'>) => void;
  onDeleteHighlight: (id: string) => void;
  onToggleBookmark: (docId: string, unitIndex: number, label: string) => void;
  onToggleImmersiveFullscreen: () => void;
  onOpenAppearance: () => void;
  onOpenSettings: () => void;
  onBackToLibrary: () => void;
  syncButtonSlot?: React.ReactNode;
}

const HIGHLIGHT_STYLES: Record<HighlightNote['color'], { label: string; bg: string; dot: string }> = {
  amber: { label: 'Ámbar', bg: 'rgba(246, 201, 87, 0.38)', dot: '#F6C957' },
  cobalt: { label: 'Cobalto', bg: 'rgba(107, 166, 255, 0.32)', dot: '#2B64F5' },
  mint: { label: 'Menta', bg: 'rgba(57, 198, 137, 0.30)', dot: '#257A5E' },
  coral: { label: 'Coral', bg: 'rgba(255, 122, 133, 0.30)', dot: '#E11D48' },
};

const FONT_MAP: Record<ReaderFontId, { label: string; css: string }> = {
  literata: { label: 'Literata', css: 'var(--font-serif)' },
  plus_jakarta: { label: 'Plus Jakarta', css: 'var(--font-sans)' },
  lexend: { label: 'Lexend', css: 'var(--font-dyslexic)' },
  jetbrains_mono: { label: 'JetBrains Mono', css: 'var(--font-mono)' },
};

const TOOL_COLORS = [
  '#2B64F5',
  '#1A2233',
  '#C2642B',
  '#E11D48',
  '#257A5E',
  '#F59E0B',
  '#7C3AED',
  '#0EA5E9',
  '#EC4899',
  '#64748B',
];

const STICKY_COLORS = ['#FEF3C7', '#DBEAFE', '#DCFCE7', '#FCE7F3'];

function renderInlineRuns(runs?: TextRun[], fallbackText?: string) {
  if (!runs || runs.length === 0) return fallbackText ?? '';
  return runs.map((r, i) => {
    let content: React.ReactNode = r.text;
    if (r.code) {
      content = (
        <code className="px-1 py-0.5 rounded bg-[var(--luma-surface-alt)] font-mono text-[0.9em]">
          {content}
        </code>
      );
    }
    if (r.bold) content = <strong>{content}</strong>;
    if (r.italic) content = <em>{content}</em>;
    if (r.underline) content = <span className="underline underline-offset-2">{content}</span>;
    return <React.Fragment key={i}>{content}</React.Fragment>;
  });
}

export const ReaderWorkspace: React.FC<ReaderWorkspaceProps> = ({
  document: doc,
  prefs,
  viewport,
  highlights,
  bookmarks,
  compactSplit = false,
  isImmersiveFullscreen,
  onUpdateDocument,
  onUpdatePrefs,
  onAddHighlight,
  onDeleteHighlight,
  onToggleBookmark,
  onToggleImmersiveFullscreen,
  onOpenAppearance,
  onOpenSettings,
  onBackToLibrary,
  syncButtonSlot,
}) => {
  const [unitIndex, setUnitIndex] = useState(doc.currentUnit || 0);
  const [inspectorTab, setInspectorTab] = useState<'toc' | 'notes' | 'bookmarks' | 'typo'>('toc');
  const [translateManhwa, setTranslateManhwa] = useState(false);
  const [sheetView, setSheetView] = useState(doc.format === 'DOCX' || doc.format === 'PPTX');

  // Rich Vertical Left Tool Sidebar state
  const [toolSidebarOpen, setToolSidebarOpen] = useState(false);
  const [activeTool, setActiveTool] = useState<ReaderAnnotationTool>('select');
  const [drawColor, setDrawColor] = useState('#2B64F5');
  const [strokeWidth, setStrokeWidth] = useState(3);
  const [strokeOpacity, setStrokeOpacity] = useState(0.95);
  const [showAnnotations, setShowAnnotations] = useState(true);
  const [activeStroke, setActiveStroke] = useState<InkStroke | null>(null);
  const [redoByUnit, setRedoByUnit] = useState<Record<number, InkStroke[]>>({});
  const [stickyColor, setStickyColor] = useState(STICKY_COLORS[0]);

  // PDF Native Viewer Controls
  const [pdfContinuous, setPdfContinuous] = useState(false);
  const [pdfRotation, setPdfRotation] = useState(0);
  const [detectedPdfPages, setDetectedPdfPages] = useState(doc.pdfPageCount ?? 0);

  // Selection & Inline Meaning Popup State
  const [selectionText, setSelectionText] = useState('');
  const [lookupLoading, setLookupLoading] = useState(false);
  const [lookupResult, setLookupResult] = useState<WordLookupResult | null>(null);
  const [lookupTab, setLookupTab] = useState<'meaning' | 'wiki' | 'translate'>('meaning');
  const [noteDraft, setNoteDraft] = useState('');
  const [showNoteInput, setShowNoteInput] = useState(false);

  // Mobile-Parity Floating Reader Menu, Zoom, Bookmark Handle & In-Doc Search
  const [readerMenuOpen, setReaderMenuOpen] = useState(false);
  const [bookmarkSide, setBookmarkSide] = useState<'right' | 'left'>('right');
  const [bookmarkTopPct, setBookmarkTopPct] = useState(32);
  const [readerZoomPct, setReaderZoomPct] = useState(100);
  const [chromeFaded, setChromeFaded] = useState(false);
  const [inDocSearchOpen, setInDocSearchOpen] = useState(false);
  const [inDocQuery, setInDocQuery] = useState('');
  const [exportToast, setExportToast] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement>(null);
  const scrollContainerRef = useRef<HTMLDivElement>(null);
  const fadeTimerRef = useRef<number | null>(null);

  const isDrawingMode = activeTool !== 'select' && activeTool !== 'sticky';

  useEffect(() => {
    setUnitIndex(doc.currentUnit || 0);
    setSheetView(doc.format === 'DOCX' || doc.format === 'PPTX');
    setDetectedPdfPages(doc.pdfPageCount ?? 0);
    setPdfRotation(0);
    setSelectionText('');
    setLookupResult(null);
    setShowNoteInput(false);
    setInDocSearchOpen(false);
    setInDocQuery('');
    setRedoByUnit({});
  }, [doc.id]);

  useEffect(() => {
    const target = doc.currentUnit || 0;
    setUnitIndex((prev) => (prev === target ? prev : target));
  }, [doc.currentUnit]);

  // Inline word lookup whenever text is selected
  useEffect(() => {
    if (!selectionText) {
      setLookupResult(null);
      setLookupLoading(false);
      return;
    }
    let cancelled = false;
    setLookupLoading(true);
    setLookupTab('meaning');
    const wikiEnabled = prefs.dictionarySources.some((s) => s.id === 'wiki' && s.enabled);

    lookupWordMeaning(selectionText, {
      enableWiki: wikiEnabled,
      engine: prefs.translationEngine,
    })
      .then((res) => {
        if (!cancelled) {
          setLookupResult(res);
          if (res.definitions.length === 0 && res.wikiSummary) {
            setLookupTab('wiki');
          } else if (res.definitions.length === 0 && !res.wikiSummary && res.translation) {
            setLookupTab('translate');
          }
        }
      })
      .finally(() => {
        if (!cancelled) setLookupLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [selectionText, prefs.dictionarySources, prefs.translationEngine]);

  // Immersive auto-hide timer while reading
  const resetChromeIdleTimer = () => {
    setChromeFaded(false);
    if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);
    if (!prefs.immersiveReaderHide || readerMenuOpen || Boolean(selectionText) || inDocSearchOpen) {
      return;
    }
    fadeTimerRef.current = window.setTimeout(() => {
      setChromeFaded(true);
    }, prefs.immersiveReaderDelaySec * 1000);
  };

  useEffect(() => {
    resetChromeIdleTimer();
    return () => {
      if (fadeTimerRef.current) window.clearTimeout(fadeTimerRef.current);
    };
  }, [
    prefs.immersiveReaderHide,
    prefs.immersiveReaderDelaySec,
    readerMenuOpen,
    selectionText,
    inDocSearchOpen,
    isImmersiveFullscreen,
  ]);

  const fadeDurationClass =
    prefs.immersiveReaderFadeSpeed === 'very_fast'
      ? 'duration-150'
      : prefs.immersiveReaderFadeSpeed === 'smooth'
        ? 'duration-700'
        : 'duration-300';

  const totalUnits = doc.pdfDataUrl
    ? Math.max(1, detectedPdfPages || doc.pdfPageCount || doc.chapters.length)
    : doc.slides?.length
      ? doc.slides.length
      : Math.max(1, doc.chapters.length);

  const safeUnit = Math.min(Math.max(0, unitIndex), totalUnits - 1);
  const currentChapter = doc.chapters[safeUnit] ?? doc.chapters[0];
  const currentSlide = doc.slides?.[safeUnit];

  const progressPct = Math.round(((safeUnit + 1) / totalUnits) * 100);
  const remainingWords = Math.max(
    0,
    Math.round(doc.totalWords * (1 - (safeUnit + 1) / Math.max(1, totalUnits)))
  );
  const estMinsLeft = Math.max(1, Math.round(remainingWords / 220));

  const docHighlights = useMemo(
    () => highlights.filter((h) => h.documentId === doc.id),
    [highlights, doc.id]
  );
  const docBookmarks = useMemo(
    () => bookmarks.filter((b) => b.documentId === doc.id),
    [bookmarks, doc.id]
  );
  const isCurrentBookmarked = docBookmarks.some((b) => b.unitIndex === safeUnit);

  const strokesForUnit = doc.annotationsByUnit?.[safeUnit] ?? [];
  const stickyNotesForUnit = doc.stickyNotesByUnit?.[safeUnit] ?? [];
  const redoStackForUnit = redoByUnit[safeUnit] ?? [];

  // In-document live search matches (works for EPUB, DOCX, PPTX, FB2, TXT, AND PDF!)
  const inDocMatches = useMemo(() => {
    const q = inDocQuery.trim().toLowerCase();
    if (!q) return [];
    const results: Array<{ unitIdx: number; label: string; excerpt: string }> = [];
    if (doc.slides) {
      doc.slides.forEach((s, idx) => {
        const joined = [s.title, s.subtitle ?? '', ...s.bullets, s.notes].join(' ');
        if (joined.toLowerCase().includes(q)) {
          results.push({
            unitIdx: idx,
            label: `Lámina ${idx + 1}: ${s.title}`,
            excerpt: joined.slice(0, 120),
          });
        }
      });
    } else {
      doc.chapters.forEach((ch, idx) => {
        for (const blk of ch.blocks) {
          if (blk.text.toLowerCase().includes(q)) {
            const pos = blk.text.toLowerCase().indexOf(q);
            const start = Math.max(0, pos - 30);
            const end = Math.min(blk.text.length, pos + q.length + 60);
            results.push({
              unitIdx: idx,
              label: ch.title,
              excerpt: `${start > 0 ? '…' : ''}${blk.text.slice(start, end)}${
                end < blk.text.length ? '…' : ''
              }`,
            });
            break;
          }
        }
      });
    }
    return results;
  }, [doc, inDocQuery]);

  const goToUnit = (nextIdx: number) => {
    const clamped = Math.min(Math.max(0, nextIdx), totalUnits - 1);
    setUnitIndex(clamped);
    scrollContainerRef.current?.scrollTo({ top: 0, behavior: 'smooth' });
    const progress = totalUnits <= 1 ? 1 : (clamped + 1) / totalUnits;
    onUpdateDocument((prev) => ({
      ...prev,
      currentUnit: clamped,
      progressPercent: Math.max(prev.progressPercent, progress),
      lastOpenedAt: Date.now(),
    }));
  };

  // Render drawing & shape overlay canvas
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const dpr = window.devicePixelRatio || 1;
    const rect = canvas.getBoundingClientRect();
    canvas.width = Math.max(1, Math.round(rect.width * dpr));
    canvas.height = Math.max(1, Math.round(rect.height * dpr));
    ctx.scale(dpr, dpr);
    ctx.clearRect(0, 0, rect.width, rect.height);

    if (!showAnnotations) return;

    const drawItem = (s: InkStroke) => {
      if (s.points.length < 2) return;
      ctx.save();
      ctx.lineCap = 'round';
      ctx.lineJoin = 'round';
      ctx.strokeStyle = s.color;
      ctx.globalAlpha = s.opacity;
      ctx.lineWidth = s.width;

      const p0 = s.points[0];
      const pLast = s.points[s.points.length - 1];
      const x0 = p0.x * rect.width;
      const y0 = p0.y * rect.height;
      const x1 = pLast.x * rect.width;
      const y1 = pLast.y * rect.height;

      if (s.tool === 'line') {
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
      } else if (s.tool === 'arrow') {
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        ctx.lineTo(x1, y1);
        ctx.stroke();
        const angle = Math.atan2(y1 - y0, x1 - x0);
        const head = Math.max(10, s.width * 3.2);
        ctx.beginPath();
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 - head * Math.cos(angle - Math.PI / 6), y1 - head * Math.sin(angle - Math.PI / 6));
        ctx.moveTo(x1, y1);
        ctx.lineTo(x1 - head * Math.cos(angle + Math.PI / 6), y1 - head * Math.sin(angle + Math.PI / 6));
        ctx.stroke();
      } else if (s.tool === 'rect') {
        ctx.strokeRect(Math.min(x0, x1), Math.min(y0, y1), Math.abs(x1 - x0), Math.abs(y1 - y0));
      } else if (s.tool === 'ellipse') {
        const cx = (x0 + x1) / 2;
        const cy = (y0 + y1) / 2;
        const rx = Math.abs(x1 - x0) / 2;
        const ry = Math.abs(y1 - y0) / 2;
        ctx.beginPath();
        ctx.ellipse(cx, cy, Math.max(1, rx), Math.max(1, ry), 0, 0, Math.PI * 2);
        ctx.stroke();
      } else {
        ctx.beginPath();
        ctx.moveTo(x0, y0);
        for (let i = 1; i < s.points.length; i++) {
          ctx.lineTo(s.points[i].x * rect.width, s.points[i].y * rect.height);
        }
        ctx.stroke();
      }
      ctx.restore();
    };

    strokesForUnit.forEach(drawItem);
    if (activeStroke) drawItem(activeStroke);
  }, [
    strokesForUnit,
    activeStroke,
    showAnnotations,
    safeUnit,
    viewport.width,
    viewport.height,
    readerZoomPct,
    toolSidebarOpen,
    pdfRotation,
    pdfContinuous,
  ]);

  const eraseStrokeNear = (normX: number, normY: number) => {
    const threshold = 0.025;
    onUpdateDocument((prev) => {
      const current = prev.annotationsByUnit?.[safeUnit] ?? [];
      const filtered = current.filter(
        (st) =>
          !st.points.some(
            (pt) => Math.hypot(pt.x - normX, pt.y - normY) <= threshold
          )
      );
      if (filtered.length === current.length) return prev;
      return {
        ...prev,
        annotationsByUnit: {
          ...(prev.annotationsByUnit ?? {}),
          [safeUnit]: filtered,
        },
      };
    });
  };

  const handleCanvasPointerDown = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pt = {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };

    if (activeTool === 'sticky') {
      const note: ReaderStickyNote = {
        id: `sn_${Date.now().toString(36)}`,
        x: Math.min(0.82, Math.max(0.04, pt.x)),
        y: Math.min(0.85, Math.max(0.04, pt.y)),
        text: '',
        color: stickyColor,
      };
      onUpdateDocument((prev) => ({
        ...prev,
        stickyNotesByUnit: {
          ...(prev.stickyNotesByUnit ?? {}),
          [safeUnit]: [...(prev.stickyNotesByUnit?.[safeUnit] ?? []), note],
        },
      }));
      setActiveTool('select');
      return;
    }

    if (activeTool === 'eraser') {
      e.currentTarget.setPointerCapture(e.pointerId);
      eraseStrokeNear(pt.x, pt.y);
      return;
    }

    if (!isDrawingMode) return;
    e.currentTarget.setPointerCapture(e.pointerId);

    const effWidth =
      activeTool === 'highlighter'
        ? Math.max(14, strokeWidth * 3)
        : activeTool === 'marker'
          ? Math.max(6, strokeWidth * 1.8)
          : strokeWidth;
    const effOpacity = activeTool === 'highlighter' ? Math.min(0.42, strokeOpacity) : strokeOpacity;

    setActiveStroke({
      id: `st_${Date.now().toString(36)}`,
      tool: activeTool as InkStroke['tool'],
      color: drawColor,
      width: effWidth,
      opacity: effOpacity,
      points: [pt, pt],
    });
  };

  const handleCanvasPointerMove = (e: React.PointerEvent<HTMLCanvasElement>) => {
    const rect = e.currentTarget.getBoundingClientRect();
    const pt = {
      x: Math.min(1, Math.max(0, (e.clientX - rect.left) / rect.width)),
      y: Math.min(1, Math.max(0, (e.clientY - rect.top) / rect.height)),
    };

    if (activeTool === 'eraser' && e.buttons === 1) {
      eraseStrokeNear(pt.x, pt.y);
      return;
    }

    if (!isDrawingMode || !activeStroke) return;
    const isShape =
      activeStroke.tool === 'line' ||
      activeStroke.tool === 'arrow' ||
      activeStroke.tool === 'rect' ||
      activeStroke.tool === 'ellipse';

    setActiveStroke((prev) => {
      if (!prev) return null;
      return isShape
        ? { ...prev, points: [prev.points[0], pt] }
        : { ...prev, points: [...prev.points, pt] };
    });
  };

  const handleCanvasPointerUp = () => {
    if (!activeStroke) return;
    if (activeStroke.points.length >= 2) {
      const finished = activeStroke;
      onUpdateDocument((prev) => ({
        ...prev,
        annotationsByUnit: {
          ...(prev.annotationsByUnit ?? {}),
          [safeUnit]: [...(prev.annotationsByUnit?.[safeUnit] ?? []), finished],
        },
      }));
      setRedoByUnit((prev) => ({ ...prev, [safeUnit]: [] }));
    }
    setActiveStroke(null);
  };

  const undoLastStroke = () => {
    if (strokesForUnit.length === 0) return;
    const popped = strokesForUnit[strokesForUnit.length - 1];
    onUpdateDocument((prev) => ({
      ...prev,
      annotationsByUnit: {
        ...(prev.annotationsByUnit ?? {}),
        [safeUnit]: (prev.annotationsByUnit?.[safeUnit] ?? []).slice(0, -1),
      },
    }));
    setRedoByUnit((prev) => ({
      ...prev,
      [safeUnit]: [...(prev[safeUnit] ?? []), popped],
    }));
  };

  const redoStroke = () => {
    if (redoStackForUnit.length === 0) return;
    const restored = redoStackForUnit[redoStackForUnit.length - 1];
    onUpdateDocument((prev) => ({
      ...prev,
      annotationsByUnit: {
        ...(prev.annotationsByUnit ?? {}),
        [safeUnit]: [...(prev.annotationsByUnit?.[safeUnit] ?? []), restored],
      },
    }));
    setRedoByUnit((prev) => ({
      ...prev,
      [safeUnit]: (prev[safeUnit] ?? []).slice(0, -1),
    }));
  };

  const clearUnitStrokes = () => {
    onUpdateDocument((prev) => ({
      ...prev,
      annotationsByUnit: {
        ...(prev.annotationsByUnit ?? {}),
        [safeUnit]: [],
      },
      stickyNotesByUnit: {
        ...(prev.stickyNotesByUnit ?? {}),
        [safeUnit]: [],
      },
    }));
    setRedoByUnit((prev) => ({ ...prev, [safeUnit]: [] }));
  };

  const updateStickyNote = (noteId: string, text: string) => {
    onUpdateDocument((prev) => ({
      ...prev,
      stickyNotesByUnit: {
        ...(prev.stickyNotesByUnit ?? {}),
        [safeUnit]: (prev.stickyNotesByUnit?.[safeUnit] ?? []).map((n) =>
          n.id === noteId ? { ...n, text } : n
        ),
      },
    }));
  };

  const deleteStickyNote = (noteId: string) => {
    onUpdateDocument((prev) => ({
      ...prev,
      stickyNotesByUnit: {
        ...(prev.stickyNotesByUnit ?? {}),
        [safeUnit]: (prev.stickyNotesByUnit?.[safeUnit] ?? []).filter((n) => n.id !== noteId),
      },
    }));
  };

  const handleMouseUpSelection = () => {
    if (activeTool !== 'select') return;
    const sel = window.getSelection()?.toString().trim() ?? '';
    if (sel.length >= 2 && sel.length <= 280) {
      setSelectionText(sel);
    } else {
      setSelectionText('');
      setShowNoteInput(false);
    }
  };

  const openDictionarySourceUrl = (templateUrl: string) => {
    const term = encodeURIComponent(selectionText.split(/\s+/).slice(0, 3).join(' '));
    const url = templateUrl.replace('{palabra}', term);
    if (window.lumaDesktop?.openExternal) {
      window.lumaDesktop.openExternal(url);
    } else {
      window.open(url, '_blank', 'noopener,noreferrer');
    }
  };

  const saveHighlight = (color: HighlightNote['color']) => {
    if (!selectionText) return;
    onAddHighlight({
      documentId: doc.id,
      chapterIndex: safeUnit,
      quotedText: selectionText,
      noteText: noteDraft.trim(),
      color,
    });
    setSelectionText('');
    setNoteDraft('');
    setShowNoteInput(false);
    window.getSelection()?.removeAllRanges();
  };

  const handleExportDocumentNotes = () => {
    const lines: string[] = [
      `# ${doc.title}`,
      `Autor: ${doc.author} · Formato: ${doc.badgeTag} · Avance: ${progressPct}%`,
      '',
    ];
    if (docHighlights.length > 0) {
      lines.push('## Subrayados y Notas');
      docHighlights.forEach((h, i) => {
        lines.push(`${i + 1}. "${h.quotedText}"${h.noteText ? `\n   Nota: ${h.noteText}` : ''}`);
      });
      lines.push('');
    }
    if (stickyNotesForUnit.length > 0) {
      lines.push('## Notas adhesivas en esta página');
      stickyNotesForUnit.forEach((sn, i) => {
        if (sn.text.trim()) lines.push(`${i + 1}. ${sn.text.trim()}`);
      });
      lines.push('');
    }
    if (currentChapter) {
      lines.push(`## Sección actual: ${currentChapter.title}`);
      currentChapter.blocks.forEach((b) => {
        if (b.text) lines.push(b.text);
      });
    }
    const blob = new Blob([lines.join('\n')], { type: 'text/markdown;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = window.document.createElement('a');
    a.href = url;
    a.download = `${doc.title.replace(/[^\w\s-]/g, '').slice(0, 40) || 'luma-lectura'}.md`;
    a.click();
    window.setTimeout(() => URL.revokeObjectURL(url), 1000);
    setExportToast('Exportado en Markdown (.md)');
    window.setTimeout(() => setExportToast(null), 2400);
  };

  const startBookmarkDrag = (e: React.MouseEvent) => {
    e.preventDefault();
    const startY = e.clientY;
    const startX = e.clientX;
    let dragged = false;

    const onMove = (ev: MouseEvent) => {
      if (Math.abs(ev.clientY - startY) > 4 || Math.abs(ev.clientX - startX) > 4) {
        dragged = true;
      }
      const pct = Math.min(82, Math.max(12, (ev.clientY / Math.max(1, window.innerHeight)) * 100));
      setBookmarkTopPct(pct);
      if (ev.clientX < window.innerWidth * 0.28) setBookmarkSide('left');
      else if (ev.clientX > window.innerWidth * 0.72) setBookmarkSide('right');
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
      if (!dragged) {
        setReaderMenuOpen((v) => !v);
      }
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const selectAnnotationTool = (tool: ReaderAnnotationTool) => {
    setActiveTool(tool);
    if (tool !== 'select') setToolSidebarOpen(true);
  };

  const activeTheme = getThemeSpec(prefs.theme);
  const applyPdfNightSoft = Boolean(prefs.pdfNightSoftFilter && activeTheme.isDark);
  const showInspector =
    prefs.showInspector && !compactSplit && viewport.tier !== 'compact' && !isImmersiveFullscreen;
  const useTwoPage =
    prefs.twoPageSpread &&
    viewport.canTwoPageSpread &&
    !compactSplit &&
    !sheetView &&
    !doc.manhwaPanels &&
    !doc.pdfDataUrl;

  const readerFontCss = FONT_MAP[prefs.readerFont].css;
  const effectiveFontSize = Math.round((prefs.fontSizePx * readerZoomPct) / 100);
  const currentUnitTitle = doc.pdfDataUrl
    ? `Página ${safeUnit + 1} de ${totalUnits}`
    : currentSlide?.title ?? currentChapter?.title ?? doc.title;

  const enabledExternalSources = prefs.dictionarySources.filter((s) => s.enabled);

  const openInspectorSection = (target: 'toc' | 'notes' | 'bookmarks' | 'typo') => {
    setInspectorTab(target);
    if (!prefs.showInspector) onUpdatePrefs({ showInspector: true });
    if (isImmersiveFullscreen) onToggleImmersiveFullscreen();
    setReaderMenuOpen(false);
  };

  const showTopClassicBar = !isImmersiveFullscreen || prefs.readerMenuStyle === 'classic';

  const renderParsedBlock = (block: ParsedBlock) => {
    if (block.type === 'h1') {
      return (
        <h1
          key={block.id}
          className="text-[1.65em] font-bold tracking-tight leading-snug mb-5 mt-2 text-[var(--luma-ink)]"
        >
          {renderInlineRuns(block.runs, block.text)}
        </h1>
      );
    }
    if (block.type === 'h2') {
      return (
        <h2
          key={block.id}
          className="text-[1.28em] font-semibold tracking-tight mt-7 mb-3 text-[var(--luma-ink)]"
        >
          {renderInlineRuns(block.runs, block.text)}
        </h2>
      );
    }
    if (block.type === 'h3') {
      return (
        <h3
          key={block.id}
          className="text-[1.1em] font-semibold tracking-tight mt-5 mb-2 text-[var(--luma-ink)]"
        >
          {renderInlineRuns(block.runs, block.text)}
        </h3>
      );
    }
    if (block.type === 'quote') {
      return (
        <blockquote
          key={block.id}
          className="my-5 px-5 py-3.5 rounded-xl bg-[var(--luma-surface)] border-l-4 border-[var(--luma-accent)] border-y border-r border-y-[var(--luma-border)] border-r-[var(--luma-border)] italic text-[var(--luma-ink-muted)]"
        >
          {renderInlineRuns(block.runs, block.text)}
        </blockquote>
      );
    }
    if (block.type === 'list') {
      const indentPx = 20 + (block.listLevel ?? 0) * 18;
      return (
        <p key={block.id} style={{ paddingLeft: `${indentPx}px` }} className="mb-2.5 relative">
          <span
            style={{ left: `${indentPx - 16}px` }}
            className="absolute text-[var(--luma-accent)] font-bold"
          >
            {(block.listLevel ?? 0) % 2 === 0 ? '•' : '◦'}
          </span>
          {renderInlineRuns(block.runs, block.text)}
        </p>
      );
    }
    if (block.type === 'ordered_list') {
      const indentPx = 26 + (block.listLevel ?? 0) * 18;
      return (
        <p key={block.id} style={{ paddingLeft: `${indentPx}px` }} className="mb-2.5 relative">
          <span
            style={{ left: `${indentPx - 24}px` }}
            className="absolute text-[var(--luma-accent)] font-semibold tabular-nums text-[0.92em]"
          >
            {block.listIndex ?? 1}.
          </span>
          {renderInlineRuns(block.runs, block.text)}
        </p>
      );
    }
    if (block.type === 'table' && block.tableRows && block.tableRows.length > 0) {
      return (
        <div
          key={block.id}
          className="my-6 overflow-x-auto rounded-xl border border-[var(--luma-border)] bg-[var(--luma-surface)]"
        >
          <table className="w-full text-left border-collapse text-[0.84em]">
            <tbody>
              {block.tableRows.map((row, rIdx) => (
                <tr
                  key={rIdx}
                  className="border-b last:border-b-0 border-[var(--luma-border)]"
                >
                  {row.cells.map((cell, cIdx) =>
                    cell.isHeader ? (
                      <th
                        key={cIdx}
                        className="px-3.5 py-2.5 font-semibold bg-[var(--luma-surface-alt)] text-[var(--luma-ink)] border-r last:border-r-0 border-[var(--luma-border)] align-top"
                      >
                        {cell.text}
                      </th>
                    ) : (
                      <td
                        key={cIdx}
                        className="px-3.5 py-2.5 text-[var(--luma-ink)] border-r last:border-r-0 border-[var(--luma-border)] align-top"
                      >
                        {cell.text}
                      </td>
                    )
                  )}
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      );
    }
    if (block.type === 'image' && block.imageDataUrl) {
      return (
        <figure key={block.id} className="my-6 flex flex-col items-center">
          <img
            src={block.imageDataUrl}
            alt={block.imageAlt || block.text}
            className="max-w-full max-h-[540px] rounded-xl border border-[var(--luma-border)] object-contain bg-white"
          />
          {block.imageAlt && (
            <figcaption className="mt-2 text-xs text-[var(--luma-ink-muted)] text-center">
              {block.imageAlt}
            </figcaption>
          )}
        </figure>
      );
    }
    if (block.type === 'hr') {
      return <hr key={block.id} className="my-6 border-[var(--luma-border)]" />;
    }
    return (
      <p key={block.id} className="mb-4">
        {renderInlineRuns(block.runs, block.text)}
      </p>
    );
  };

  const sidebarTools: Array<{
    id: ReaderAnnotationTool;
    label: string;
    icon: React.ReactNode;
  }> = [
    { id: 'select', label: 'Leer / Seleccionar', icon: <MousePointer2 className="w-4 h-4" /> },
    { id: 'pen', label: 'Pluma / Firma', icon: <PenTool className="w-4 h-4" /> },
    { id: 'marker', label: 'Marcador', icon: <Brush className="w-4 h-4" /> },
    { id: 'highlighter', label: 'Resaltador', icon: <Highlighter className="w-4 h-4" /> },
    { id: 'line', label: 'Línea recta', icon: <Minus className="w-4 h-4" /> },
    { id: 'arrow', label: 'Flecha', icon: <ArrowUpRight className="w-4 h-4" /> },
    { id: 'rect', label: 'Rectángulo', icon: <Square className="w-4 h-4" /> },
    { id: 'ellipse', label: 'Óvalo / Círculo', icon: <Circle className="w-4 h-4" /> },
    { id: 'sticky', label: 'Nota adhesiva', icon: <StickyNote className="w-4 h-4" /> },
    { id: 'eraser', label: 'Borrador', icon: <Eraser className="w-4 h-4" /> },
  ];

  return (
    <div
      onMouseMove={resetChromeIdleTimer}
      onClick={resetChromeIdleTimer}
      className="h-full flex flex-col bg-[var(--luma-bg)] text-[var(--luma-ink)] overflow-hidden relative"
    >
      {/* Top Reader Bar (clean; Fullscreen lives next to the Zoom pill at the bottom!) */}
      {showTopClassicBar && (
        <div
          className={`h-11 px-3 md:px-4 border-b border-[var(--luma-border)] bg-[var(--luma-surface)] flex items-center justify-between gap-2 shrink-0 transition-opacity ${fadeDurationClass} ${
            chromeFaded ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          {/* Left: Tools Sidebar Toggle + Document Breadcrumb */}
          <div className="flex items-center gap-2 min-w-0 text-xs">
            <button
              type="button"
              onClick={() => setToolSidebarOpen((v) => !v)}
              title={toolSidebarOpen ? 'Ocultar barra lateral de herramientas' : 'Abrir barra lateral de herramientas'}
              className={`h-7 px-2 rounded-md inline-flex items-center gap-1.5 font-medium transition-colors shrink-0 ${
                toolSidebarOpen || activeTool !== 'select'
                  ? 'bg-[var(--luma-accent)] text-[var(--luma-on-accent)]'
                  : 'border border-[var(--luma-border)] text-[var(--luma-ink)] hover:bg-[var(--luma-surface-alt)]'
              }`}
            >
              <PanelLeft className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Herramientas</span>
            </button>

            <span
              className="w-2.5 h-2.5 rounded-sm shrink-0"
              style={{ backgroundColor: doc.coverColor }}
            />
            <span className="font-semibold truncate max-w-[150px] sm:max-w-[230px]">
              {doc.title}
            </span>
            <span className="text-[var(--luma-ink-muted)] hidden md:inline">/</span>
            <span className="text-[var(--luma-ink-muted)] truncate hidden md:inline max-w-[190px]">
              {currentUnitTitle}
            </span>
          </div>

          {/* Right: Contextual Format Actions (no duplicate Fullscreen button here) */}
          <div className="flex items-center gap-1 shrink-0">
            {doc.manhwaPanels && (
              <button
                type="button"
                onClick={() => setTranslateManhwa((v) => !v)}
                className={`h-7 px-2.5 rounded-md text-xs font-medium inline-flex items-center gap-1.5 transition-colors whitespace-nowrap ${
                  translateManhwa
                    ? 'bg-[var(--luma-accent)] text-[var(--luma-on-accent)]'
                    : 'border border-[var(--luma-border)] text-[var(--luma-ink)] hover:bg-[var(--luma-surface-alt)]'
                }`}
              >
                <Languages className="w-3.5 h-3.5" />
                <span>{translateManhwa ? 'Traducido ES' : 'Traducir'}</span>
              </button>
            )}

            {doc.pdfDataUrl && (
              <>
                <button
                  type="button"
                  onClick={() => setPdfContinuous((v) => !v)}
                  title={pdfContinuous ? 'Cambiar a página única' : 'Cambiar a flujo continuo PDF'}
                  className={`h-7 px-2 rounded-md text-xs font-medium inline-flex items-center gap-1 transition-colors whitespace-nowrap ${
                    pdfContinuous
                      ? 'bg-[var(--luma-accent-soft)] text-[var(--luma-accent)]'
                      : 'text-[var(--luma-ink-muted)] hover:bg-[var(--luma-surface-alt)]'
                  }`}
                >
                  <ScrollText className="w-3.5 h-3.5" />
                  <span className="hidden md:inline">{pdfContinuous ? 'Continuo' : 'Por página'}</span>
                </button>
                <button
                  type="button"
                  onClick={() => setPdfRotation((r) => (r + 90) % 360)}
                  title="Rotar PDF 90°"
                  className="h-7 w-7 rounded-md flex items-center justify-center text-[var(--luma-ink-muted)] hover:bg-[var(--luma-surface-alt)]"
                >
                  <RotateCw className="w-3.5 h-3.5" />
                </button>
              </>
            )}

            {(doc.format === 'DOCX' || doc.format === 'PPTX') && !doc.pdfDataUrl && (
              <button
                type="button"
                onClick={() => setSheetView((v) => !v)}
                className={`h-7 px-2 rounded-md text-xs font-medium inline-flex items-center gap-1 transition-colors whitespace-nowrap ${
                  sheetView
                    ? 'bg-[var(--luma-accent-soft)] text-[var(--luma-accent)]'
                    : 'text-[var(--luma-ink-muted)] hover:bg-[var(--luma-surface-alt)]'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                <span className="hidden md:inline">
                  {sheetView ? (doc.format === 'PPTX' ? 'Lámina 16:9' : 'Hoja A4') : 'Modo fluido'}
                </span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setInDocSearchOpen((v) => !v)}
              title="Buscar dentro de este documento"
              className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors ${
                inDocSearchOpen
                  ? 'bg-[var(--luma-accent-soft)] text-[var(--luma-accent)]'
                  : 'text-[var(--luma-ink-muted)] hover:bg-[var(--luma-surface-alt)]'
              }`}
            >
              <Search className="w-3.5 h-3.5" />
            </button>

            <button
              type="button"
              onClick={() => onToggleBookmark(doc.id, safeUnit, currentUnitTitle)}
              title={isCurrentBookmarked ? 'Quitar marcador' : 'Guardar marcador'}
              className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors ${
                isCurrentBookmarked
                  ? 'text-[var(--luma-accent)] bg-[var(--luma-accent-soft)]'
                  : 'text-[var(--luma-ink-muted)] hover:bg-[var(--luma-surface-alt)]'
              }`}
            >
              <Bookmark className="w-3.5 h-3.5" fill={isCurrentBookmarked ? 'currentColor' : 'none'} />
            </button>

            <button
              type="button"
              onClick={() => setReaderMenuOpen((v) => !v)}
              title="Menú de lectura Luma"
              className={`h-7 px-2 rounded-md text-xs font-medium inline-flex items-center gap-1 transition-colors whitespace-nowrap ${
                readerMenuOpen
                  ? 'bg-[var(--luma-accent-soft)] text-[var(--luma-accent)]'
                  : 'text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)] hover:bg-[var(--luma-surface-alt)]'
              }`}
            >
              <SlidersHorizontal className="w-3.5 h-3.5" />
              <span className="hidden sm:inline">Menú</span>
            </button>

            {syncButtonSlot}

            {!compactSplit && !isImmersiveFullscreen && (
              <button
                type="button"
                onClick={() => onUpdatePrefs({ showInspector: !prefs.showInspector })}
                title="Panel lateral de índice, notas y texto"
                className={`h-7 w-7 rounded-md flex items-center justify-center transition-colors ${
                  prefs.showInspector
                    ? 'text-[var(--luma-accent)] bg-[var(--luma-accent-soft)]'
                    : 'text-[var(--luma-ink-muted)] hover:bg-[var(--luma-surface-alt)]'
                }`}
              >
                <PanelRight className="w-3.5 h-3.5" />
              </button>
            )}
          </div>
        </div>
      )}

      {/* Dynamic Island Capsule (when readerMenuStyle === 'island' OR when in Immersive Fullscreen) */}
      {(prefs.readerMenuStyle === 'island' || isImmersiveFullscreen) && (
        <div
          style={{ transform: `translateX(-50%) scale(${prefs.readerMenuScale})` }}
          className={`fixed top-3 left-1/2 z-30 origin-top transition-opacity ${fadeDurationClass} ${
            chromeFaded && !readerMenuOpen ? 'opacity-0 pointer-events-none' : 'opacity-100'
          }`}
        >
          <div className="h-9 px-3 rounded-full bg-neutral-900/92 text-white shadow-xl border border-white/10 backdrop-blur-md flex items-center gap-2.5 text-xs">
            <button
              type="button"
              onClick={() => setReaderMenuOpen((v) => !v)}
              className="flex items-center gap-2 max-w-[200px] hover:opacity-90"
              title="Abrir menú desplegable de lectura"
            >
              <SlidersHorizontal className="w-3.5 h-3.5 text-blue-400 shrink-0" />
              <span className="font-semibold truncate">{doc.title}</span>
            </button>

            {prefs.dynamicIslandShowProgress && (
              <span className="text-[11px] text-white/75 tabular-nums whitespace-nowrap">
                {progressPct}% · ~{estMinsLeft}m
              </span>
            )}

            <div className="w-px h-3.5 bg-white/20" />

            <button
              type="button"
              onClick={() => setToolSidebarOpen((v) => !v)}
              title="Barra de herramientas de anotación"
              className="p-1 rounded-full hover:bg-white/15 transition-colors"
            >
              <PenTool className="w-3.5 h-3.5" />
            </button>
          </div>
        </div>
      )}

      {/* Draggable Edge Bookmark Handle (when readerMenuStyle === 'bookmark') */}
      {prefs.readerMenuStyle === 'bookmark' && !compactSplit && (
        <button
          type="button"
          onMouseDown={startBookmarkDrag}
          style={{
            top: `${bookmarkTopPct}%`,
            transform: `scale(${prefs.readerMenuScale})`,
          }}
          title="Arrastra para mover o haz clic para abrir el menú de lectura Luma"
          className={`fixed z-30 ${
            bookmarkSide === 'right'
              ? 'right-0 rounded-l-xl border-r-0 origin-right'
              : 'left-0 rounded-r-xl border-l-0 origin-left'
          } h-12 w-8 border border-[var(--luma-border)] bg-[var(--luma-surface)]/95 text-[var(--luma-accent)] shadow-lg flex items-center justify-center cursor-grab active:cursor-grabbing hover:w-9 transition-all ${fadeDurationClass} ${
            chromeFaded && !readerMenuOpen ? 'opacity-20' : 'opacity-100'
          }`}
        >
          <SlidersHorizontal className="w-4 h-4" />
        </button>
      )}

      {/* Full Luma Mobile-Style Floating Reader Menu */}
      {readerMenuOpen && (
        <div
          style={{ transform: `scale(${prefs.readerMenuScale})` }}
          className="fixed top-14 right-4 z-40 w-[290px] max-h-[82vh] overflow-y-auto origin-top-right rounded-2xl border border-[var(--luma-border)] bg-[var(--luma-surface)] text-[var(--luma-ink)] shadow-2xl p-4 space-y-3"
        >
          <div className="flex items-start justify-between gap-2">
            <div className="min-w-0">
              <div className="text-xs font-bold truncate">{doc.title}</div>
              <div className="text-[11px] text-[var(--luma-ink-muted)] tabular-nums mt-0.5">
                {progressPct}% · ~{estMinsLeft} min restantes
              </div>
            </div>
            <div className="flex items-center gap-1 shrink-0">
              <button
                type="button"
                onClick={() => {
                  setReaderMenuOpen(false);
                  onOpenSettings();
                }}
                title="Configuración de Luma"
                className="h-7 w-7 rounded-lg flex items-center justify-center text-[var(--luma-ink-muted)] hover:bg-[var(--luma-surface-alt)]"
              >
                <Settings className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setReaderMenuOpen(false)}
                title="Cerrar menú"
                className="h-7 w-7 rounded-lg flex items-center justify-center text-[var(--luma-ink-muted)] hover:bg-[var(--luma-surface-alt)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          </div>

          {/* Quick Dimming Slider + Sync */}
          <div className="flex items-center gap-2 py-1">
            <Sun className="w-3.5 h-3.5 text-[var(--luma-ink-muted)] shrink-0" />
            <input
              type="range"
              min={0}
              max={0.35}
              step={0.05}
              value={prefs.nightDimming}
              onChange={(e) => onUpdatePrefs({ nightDimming: parseFloat(e.target.value) })}
              title="Atenuación rápida de pantalla"
              className="flex-1 accent-[var(--luma-accent)]"
            />
            <button
              type="button"
              onClick={() => onUpdatePrefs({ nightDimming: 0, warmFilterStrength: 0 })}
              className="h-6 px-2 rounded-md bg-[var(--luma-accent-soft)] text-[var(--luma-accent)] text-[10px] font-semibold"
            >
              Sync
            </button>
          </div>

          {/* Mode Toggle */}
          {doc.pdfDataUrl ? (
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[var(--luma-surface-alt)]">
              <button
                type="button"
                onClick={() => setPdfContinuous(false)}
                className={`h-8 rounded-lg text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                  !pdfContinuous
                    ? 'bg-[var(--luma-accent)] text-[var(--luma-on-accent)]'
                    : 'text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)]'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Por página
              </button>
              <button
                type="button"
                onClick={() => setPdfContinuous(true)}
                className={`h-8 rounded-lg text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                  pdfContinuous
                    ? 'bg-[var(--luma-accent)] text-[var(--luma-on-accent)]'
                    : 'text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)]'
                }`}
              >
                <ScrollText className="w-3.5 h-3.5" />
                Flujo PDF
              </button>
            </div>
          ) : (
            <div className="grid grid-cols-2 gap-1 p-1 rounded-xl bg-[var(--luma-surface-alt)]">
              <button
                type="button"
                onClick={() => setSheetView(false)}
                className={`h-8 rounded-lg text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                  !sheetView
                    ? 'bg-[var(--luma-accent)] text-[var(--luma-on-accent)]'
                    : 'text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)]'
                }`}
              >
                <BookOpen className="w-3.5 h-3.5" />
                Modo EPUB
              </button>
              <button
                type="button"
                onClick={() => setSheetView(true)}
                className={`h-8 rounded-lg text-[11px] font-semibold inline-flex items-center justify-center gap-1.5 transition-colors ${
                  sheetView
                    ? 'bg-[var(--luma-accent)] text-[var(--luma-on-accent)]'
                    : 'text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)]'
                }`}
              >
                <FileText className="w-3.5 h-3.5" />
                Hoja A4
              </button>
            </div>
          )}

          {/* Action Rows */}
          <div className="space-y-0.5 pt-1 border-t border-[var(--luma-border)]">
            {[
              {
                label: isCurrentBookmarked ? 'QUITAR MARCADOR' : 'MARCAR PÁGINA',
                icon: <Bookmark className="w-4 h-4" fill={isCurrentBookmarked ? 'currentColor' : 'none'} />,
                active: isCurrentBookmarked,
                onClick: () => onToggleBookmark(doc.id, safeUnit, currentUnitTitle),
              },
              {
                label: 'TEXTO Y TEMA',
                icon: <Type className="w-4 h-4" />,
                onClick: () => openInspectorSection('typo'),
              },
              {
                label: 'ÍNDICE',
                icon: <List className="w-4 h-4" />,
                onClick: () => openInspectorSection('toc'),
              },
              {
                label: toolSidebarOpen ? 'OCULTAR HERRAMIENTAS' : 'DIBUJAR / FIRMAR',
                icon: <PenTool className="w-4 h-4" />,
                active: toolSidebarOpen,
                onClick: () => {
                  setToolSidebarOpen(true);
                  if (activeTool === 'select') setActiveTool('pen');
                  setReaderMenuOpen(false);
                },
              },
              {
                label: translateManhwa ? 'IDIOMA ORIGINAL' : 'TRADUCIR',
                icon: <Languages className="w-4 h-4" />,
                active: translateManhwa,
                onClick: () => {
                  setTranslateManhwa((v) => !v);
                  setReaderMenuOpen(false);
                },
              },
              {
                label: 'NOTAS',
                icon: <Highlighter className="w-4 h-4" />,
                onClick: () => openInspectorSection('notes'),
              },
              {
                label: 'BUSCAR',
                icon: <Search className="w-4 h-4" />,
                onClick: () => {
                  setInDocSearchOpen(true);
                  setReaderMenuOpen(false);
                },
              },
            ].map((row) => (
              <button
                key={row.label}
                type="button"
                onClick={row.onClick}
                className={`w-full h-9 px-2.5 rounded-xl flex items-center justify-between text-[11px] font-semibold tracking-wide transition-colors ${
                  row.active
                    ? 'bg-[var(--luma-accent-soft)] text-[var(--luma-accent)]'
                    : 'hover:bg-[var(--luma-surface-alt)] text-[var(--luma-ink)]'
                }`}
              >
                <span>{row.label}</span>
                <span className="w-7 h-7 rounded-full bg-[var(--luma-surface-alt)] flex items-center justify-center">
                  {row.icon}
                </span>
              </button>
            ))}

            <button
              type="button"
              onClick={() => {
                handleExportDocumentNotes();
                setReaderMenuOpen(false);
              }}
              className="w-full h-9 px-2.5 rounded-xl flex items-center justify-between text-[11px] font-bold tracking-wide text-[var(--luma-accent)] hover:bg-[var(--luma-accent-soft)] transition-colors"
            >
              <span>EXPORTAR</span>
              <span className="w-7 h-7 rounded-full bg-[var(--luma-accent)] text-[var(--luma-on-accent)] flex items-center justify-center">
                <Download className="w-3.5 h-3.5" />
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setReaderMenuOpen(false);
                if (isImmersiveFullscreen) onToggleImmersiveFullscreen();
                onBackToLibrary();
              }}
              className="w-full h-9 px-2.5 rounded-xl flex items-center justify-between text-[11px] font-semibold tracking-wide hover:bg-[var(--luma-surface-alt)] transition-colors"
            >
              <span>BIBLIOTECA</span>
              <span className="w-7 h-7 rounded-full bg-[var(--luma-surface-alt)] flex items-center justify-center">
                <ArrowLeft className="w-3.5 h-3.5" />
              </span>
            </button>
          </div>
        </div>
      )}

      {/* In-Document Search Bar */}
      {inDocSearchOpen && (
        <div className="px-4 py-2 border-b border-[var(--luma-border)] bg-[var(--luma-surface-alt)] space-y-2 shrink-0">
          <div className="flex items-center gap-2 max-w-2xl mx-auto">
            <Search className="w-3.5 h-3.5 text-[var(--luma-ink-muted)] shrink-0" />
            <input
              autoFocus
              value={inDocQuery}
              onChange={(e) => setInDocQuery(e.target.value)}
              placeholder="Buscar palabra o frase en este documento..."
              className="flex-1 h-8 px-2.5 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-surface)] text-xs outline-none"
            />
            <span className="text-[11px] text-[var(--luma-ink-muted)] tabular-nums shrink-0">
              {inDocMatches.length} {inDocMatches.length === 1 ? 'resultado' : 'resultados'}
            </span>
            <button
              type="button"
              onClick={() => {
                setInDocSearchOpen(false);
                setInDocQuery('');
              }}
              className="h-7 w-7 rounded-md flex items-center justify-center hover:bg-[var(--luma-surface)]"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
          {inDocMatches.length > 0 && (
            <div className="max-w-2xl mx-auto max-h-36 overflow-y-auto space-y-1">
              {inDocMatches.map((m, idx) => (
                <button
                  key={`${m.unitIdx}_${idx}`}
                  type="button"
                  onClick={() => goToUnit(m.unitIdx)}
                  className="w-full px-2.5 py-1.5 rounded-lg bg-[var(--luma-surface)] hover:border-[var(--luma-accent)] border border-[var(--luma-border)] text-left text-xs"
                >
                  <div className="font-semibold truncate">{m.label}</div>
                  <div className="text-[11px] text-[var(--luma-ink-muted)] truncate">{m.excerpt}</div>
                </button>
              ))}
            </div>
          )}
        </div>
      )}

      {/* Main Body: Rich Vertical Left Tool Sidebar + Reading Viewport + Right Inspector */}
      <div className="flex-1 min-h-0 flex overflow-hidden">
        {/* DEDICATED VERTICAL LEFT ANNOTATION & READING TOOLS SIDEBAR */}
        {toolSidebarOpen && (
          <aside className="w-[216px] shrink-0 border-r border-[var(--luma-border)] bg-[var(--luma-surface)] flex flex-col overflow-hidden select-none z-20">
            <div className="px-3 py-2.5 border-b border-[var(--luma-border)] flex items-center justify-between">
              <span className="text-xs font-bold tracking-tight">Herramientas</span>
              <button
                type="button"
                onClick={() => setToolSidebarOpen(false)}
                title="Cerrar barra lateral"
                className="h-6 w-6 rounded-md flex items-center justify-center text-[var(--luma-ink-muted)] hover:bg-[var(--luma-surface-alt)]"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>

            <div className="flex-1 overflow-y-auto p-3 space-y-4 text-xs">
              {/* Tool Grid */}
              <div>
                <div className="text-[11px] font-semibold text-[var(--luma-ink-muted)] mb-2">
                  Dibujo y anotación
                </div>
                <div className="grid grid-cols-2 gap-1.5">
                  {sidebarTools.map((t) => {
                    const active = activeTool === t.id;
                    return (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => selectAnnotationTool(t.id)}
                        className={`px-2 py-2 rounded-lg border text-[11px] font-medium flex flex-col items-center gap-1 transition-colors text-center ${
                          active
                            ? 'border-[var(--luma-accent)] bg-[var(--luma-accent-soft)] text-[var(--luma-accent)] font-semibold'
                            : 'border-[var(--luma-border)] bg-[var(--luma-bg)] text-[var(--luma-ink)] hover:bg-[var(--luma-surface-alt)]'
                        }`}
                      >
                        {t.icon}
                        <span className="truncate w-full">{t.label.split(' / ')[0]}</span>
                      </button>
                    );
                  })}
                </div>
              </div>

              {/* Sticky Note Color Selector when Sticky tool active */}
              {activeTool === 'sticky' && (
                <div className="p-2.5 rounded-xl border border-[var(--luma-accent)]/40 bg-[var(--luma-accent-soft)]/35 space-y-2">
                  <div className="text-[11px] font-semibold">Color de nota adhesiva</div>
                  <div className="flex items-center gap-1.5">
                    {STICKY_COLORS.map((c) => (
                      <button
                        key={c}
                        type="button"
                        onClick={() => setStickyColor(c)}
                        className={`w-6 h-6 rounded-md border border-black/15 ${
                          stickyColor === c ? 'ring-2 ring-[var(--luma-accent)]' : ''
                        }`}
                        style={{ backgroundColor: c }}
                      />
                    ))}
                  </div>
                  <p className="text-[10px] text-[var(--luma-ink-muted)] leading-snug">
                    Haz clic en cualquier punto de la página para pegar la nota.
                  </p>
                </div>
              )}

              {/* Color Swatches + Custom Color Picker */}
              <div>
                <div className="flex items-center justify-between mb-2">
                  <span className="text-[11px] font-semibold text-[var(--luma-ink-muted)]">
                    Color de tinta
                  </span>
                  <label className="text-[10px] text-[var(--luma-accent)] font-semibold cursor-pointer">
                    Personalizar
                    <input
                      type="color"
                      value={drawColor}
                      onChange={(e) => setDrawColor(e.target.value)}
                      className="sr-only"
                    />
                  </label>
                </div>
                <div className="grid grid-cols-5 gap-1.5">
                  {TOOL_COLORS.map((c) => (
                    <button
                      key={c}
                      type="button"
                      onClick={() => setDrawColor(c)}
                      className={`h-6 w-full rounded-md border border-black/15 transition-transform ${
                        drawColor === c ? 'ring-2 ring-offset-1 ring-[var(--luma-ink)] scale-105' : ''
                      }`}
                      style={{ backgroundColor: c }}
                    />
                  ))}
                </div>
              </div>

              {/* Thickness & Opacity */}
              <div className="space-y-3 pt-2 border-t border-[var(--luma-border)]">
                <div className="space-y-1.5">
                  <div className="flex justify-between text-[11px]">
                    <span className="font-semibold text-[var(--luma-ink-muted)]">Grosor</span>
                    <span className="font-mono tabular-nums">{strokeWidth}px</span>
                  </div>
                  <div className="grid grid-cols-4 gap-1">
                    {[2, 4, 8, 14].map((w) => (
                      <button
                        key={w}
                        type="button"
                        onClick={() => setStrokeWidth(w)}
                        className={`h-6 rounded-md text-[10px] font-mono font-semibold border ${
                          strokeWidth === w
                            ? 'border-[var(--luma-accent)] bg-[var(--luma-accent-soft)] text-[var(--luma-accent)]'
                            : 'border-[var(--luma-border)] bg-[var(--luma-bg)]'
                        }`}
                      >
                        {w}
                      </button>
                    ))}
                  </div>
                  <input
                    type="range"
                    min={1}
                    max={20}
                    value={strokeWidth}
                    onChange={(e) => setStrokeWidth(parseInt(e.target.value, 10))}
                    className="w-full accent-[var(--luma-accent)]"
                  />
                </div>

                <div className="space-y-1">
                  <div className="flex justify-between text-[11px]">
                    <span className="font-semibold text-[var(--luma-ink-muted)]">Opacidad</span>
                    <span className="font-mono tabular-nums">{Math.round(strokeOpacity * 100)}%</span>
                  </div>
                  <input
                    type="range"
                    min={0.25}
                    max={1}
                    step={0.05}
                    value={strokeOpacity}
                    onChange={(e) => setStrokeOpacity(parseFloat(e.target.value))}
                    className="w-full accent-[var(--luma-accent)]"
                  />
                </div>
              </div>

              {/* Undo / Redo / Visibility / Clear / Export */}
              <div className="space-y-2 pt-2 border-t border-[var(--luma-border)]">
                <div className="grid grid-cols-2 gap-1.5">
                  <button
                    type="button"
                    disabled={strokesForUnit.length === 0}
                    onClick={undoLastStroke}
                    className="h-8 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)] disabled:opacity-40 text-[11px] font-medium inline-flex items-center justify-center gap-1"
                  >
                    <Undo2 className="w-3.5 h-3.5" />
                    Deshacer
                  </button>
                  <button
                    type="button"
                    disabled={redoStackForUnit.length === 0}
                    onClick={redoStroke}
                    className="h-8 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)] disabled:opacity-40 text-[11px] font-medium inline-flex items-center justify-center gap-1"
                  >
                    <Redo2 className="w-3.5 h-3.5" />
                    Rehacer
                  </button>
                </div>

                <button
                  type="button"
                  onClick={() => setShowAnnotations((v) => !v)}
                  className="w-full h-8 px-2.5 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)] text-[11px] font-medium flex items-center justify-between"
                >
                  <span className="inline-flex items-center gap-1.5">
                    {showAnnotations ? <Eye className="w-3.5 h-3.5" /> : <EyeOff className="w-3.5 h-3.5" />}
                    {showAnnotations ? 'Ocultar trazos' : 'Mostrar trazos'}
                  </span>
                  <span className="font-mono text-[10px] text-[var(--luma-ink-muted)] tabular-nums">
                    {strokesForUnit.length + stickyNotesForUnit.length}
                  </span>
                </button>

                <button
                  type="button"
                  onClick={handleExportDocumentNotes}
                  className="w-full h-8 px-2.5 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)] text-[11px] font-medium inline-flex items-center justify-center gap-1.5"
                >
                  <Download className="w-3.5 h-3.5 text-[var(--luma-accent)]" />
                  Exportar apuntes
                </button>

                <button
                  type="button"
                  disabled={strokesForUnit.length === 0 && stickyNotesForUnit.length === 0}
                  onClick={clearUnitStrokes}
                  className="w-full h-8 px-2.5 rounded-lg border border-red-500/25 text-red-500 hover:bg-red-500/10 disabled:opacity-35 text-[11px] font-medium inline-flex items-center justify-center gap-1.5"
                >
                  <Trash2 className="w-3.5 h-3.5" />
                  Limpiar página
                </button>
              </div>
            </div>
          </aside>
        )}

        {/* Center Reading Stage */}
        <div className="flex-1 min-w-0 relative flex flex-col overflow-hidden">
          {/* Inline Contextual Word Meaning Mini-Screen + Highlight Controls */}
          {selectionText && (
            <div className="absolute top-3 left-1/2 -translate-x-1/2 z-30 w-[min(94%,490px)] rounded-2xl border border-[var(--luma-border)] bg-[var(--luma-surface)] shadow-2xl p-3.5 space-y-3">
              <div className="flex items-center justify-between gap-2">
                <div className="min-w-0 flex items-center gap-2">
                  <span className="text-sm font-bold truncate text-[var(--luma-ink)]">
                    “{selectionText}”
                  </span>
                  {lookupResult?.partOfSpeech && (
                    <span className="text-[11px] italic text-[var(--luma-ink-muted)] shrink-0">
                      {lookupResult.partOfSpeech}
                    </span>
                  )}
                </div>
                <button
                  type="button"
                  onClick={() => {
                    setSelectionText('');
                    setShowNoteInput(false);
                  }}
                  className="p-1 rounded-md hover:bg-[var(--luma-surface-alt)] shrink-0"
                >
                  <X className="w-3.5 h-3.5" />
                </button>
              </div>

              <div className="rounded-xl border border-[var(--luma-border)] bg-[var(--luma-bg)] p-3 space-y-2">
                <div className="flex items-center justify-between gap-2">
                  <div className="flex items-center gap-1 p-0.5 rounded-lg bg-[var(--luma-surface-alt)] text-[11px] font-semibold">
                    {(
                      [
                        { id: 'meaning', label: 'Significado' },
                        { id: 'wiki', label: 'Wikipedia' },
                        { id: 'translate', label: 'Traducción' },
                      ] as const
                    ).map((t) => (
                      <button
                        key={t.id}
                        type="button"
                        onClick={() => setLookupTab(t.id)}
                        className={`px-2 py-1 rounded-md transition-colors ${
                          lookupTab === t.id
                            ? 'bg-[var(--luma-surface)] text-[var(--luma-ink)] shadow-xs'
                            : 'text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)]'
                        }`}
                      >
                        {t.label}
                      </button>
                    ))}
                  </div>
                  {lookupResult && (
                    <span className="text-[10px] text-[var(--luma-ink-muted)]">
                      {lookupResult.sourceLabel}
                    </span>
                  )}
                </div>

                {lookupLoading ? (
                  <div className="py-3 flex items-center gap-2 text-xs text-[var(--luma-ink-muted)]">
                    <Loader2 className="w-3.5 h-3.5 animate-spin text-[var(--luma-accent)]" />
                    <span>Consultando significado...</span>
                  </div>
                ) : lookupTab === 'meaning' ? (
                  lookupResult && lookupResult.definitions.length > 0 ? (
                    <ol className="space-y-1.5 text-xs leading-relaxed list-decimal pl-4 max-h-32 overflow-y-auto">
                      {lookupResult.definitions.map((def, i) => (
                        <li key={i} className="text-[var(--luma-ink)]">
                          {def}
                        </li>
                      ))}
                    </ol>
                  ) : (
                    <p className="text-xs text-[var(--luma-ink-muted)] leading-relaxed">
                      No encontramos una definición directa para esta selección. Prueba la pestaña Wikipedia, Traducción o abre RAE / WordReference abajo.
                    </p>
                  )
                ) : lookupTab === 'wiki' ? (
                  lookupResult?.wikiSummary ? (
                    <div className="space-y-1 max-h-32 overflow-y-auto">
                      <div className="text-xs font-semibold">{lookupResult.wikiTitle}</div>
                      <p className="text-xs text-[var(--luma-ink-muted)] leading-relaxed">
                        {lookupResult.wikiSummary}
                      </p>
                    </div>
                  ) : (
                    <p className="text-xs text-[var(--luma-ink-muted)]">
                      Sin artículo directo en Wikipedia para “{selectionText}”.
                    </p>
                  )
                ) : lookupResult?.translation ? (
                  <div className="space-y-1">
                    <div className="text-[10px] font-semibold text-[var(--luma-ink-muted)]">
                      {lookupResult.translationDir}
                    </div>
                    <p className="text-sm font-semibold text-[var(--luma-ink)]">
                      {lookupResult.translation}
                    </p>
                  </div>
                ) : (
                  <p className="text-xs text-[var(--luma-ink-muted)]">
                    No se pudo obtener una traducción instantánea en este momento.
                  </p>
                )}
              </div>

              <div className="flex flex-wrap items-center justify-between gap-2">
                <div className="flex items-center gap-1.5">
                  {(['amber', 'cobalt', 'mint', 'coral'] as const).map((color) => (
                    <button
                      key={color}
                      type="button"
                      onClick={() => saveHighlight(color)}
                      title={`Subrayar en ${HIGHLIGHT_STYLES[color].label}`}
                      className="w-5 h-5 rounded-full border border-black/15 hover:scale-110 transition-transform"
                      style={{ backgroundColor: HIGHLIGHT_STYLES[color].dot }}
                    />
                  ))}
                  <button
                    type="button"
                    onClick={() => setShowNoteInput((v) => !v)}
                    className="h-7 px-2 rounded-md text-xs font-medium hover:bg-[var(--luma-surface-alt)] inline-flex items-center gap-1"
                  >
                    <MessageSquarePlus className="w-3.5 h-3.5 text-[var(--luma-accent)]" />
                    Nota
                  </button>
                </div>

                <div className="flex flex-wrap items-center gap-1 text-[11px]">
                  {enabledExternalSources.map((src) => (
                    <button
                      key={src.id}
                      type="button"
                      onClick={() => openDictionarySourceUrl(src.urlTemplate)}
                      className="h-6 px-2 rounded-md bg-[var(--luma-surface-alt)] hover:bg-[var(--luma-accent-soft)] inline-flex items-center gap-1"
                    >
                      {src.name} <ExternalLink className="w-2.5 h-2.5" />
                    </button>
                  ))}
                </div>
              </div>

              {showNoteInput && (
                <div className="flex items-center gap-2 pt-1">
                  <input
                    value={noteDraft}
                    onChange={(e) => setNoteDraft(e.target.value)}
                    placeholder="Escribe una nota marginal para esta cita..."
                    className="flex-1 h-8 px-2.5 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-bg)] text-xs outline-none"
                  />
                  <button
                    type="button"
                    onClick={() => saveHighlight('amber')}
                    className="h-8 px-3 rounded-lg bg-[var(--luma-accent)] text-[var(--luma-on-accent)] text-xs font-semibold"
                  >
                    Guardar
                  </button>
                </div>
              )}
            </div>
          )}

          {/* Optional Side-Tap Page Turning Zones */}
          {prefs.sideTapPageTurn && activeTool === 'select' && totalUnits > 1 && !pdfContinuous && (
            <>
              {safeUnit > 0 && (
                <button
                  type="button"
                  onClick={() => goToUnit(safeUnit - 1)}
                  title="Página anterior (toque lateral)"
                  aria-label="Página anterior"
                  className="absolute left-0 top-12 bottom-12 w-7 z-10 opacity-0 hover:opacity-100 hover:bg-[var(--luma-accent)]/10 flex items-center justify-center transition-opacity"
                >
                  <ChevronLeft className="w-4 h-4 text-[var(--luma-accent)]" />
                </button>
              )}
              {safeUnit < totalUnits - 1 && (
                <button
                  type="button"
                  onClick={() => goToUnit(safeUnit + 1)}
                  title="Página siguiente (toque lateral)"
                  aria-label="Página siguiente"
                  className="absolute right-0 top-12 bottom-12 w-7 z-10 opacity-0 hover:opacity-100 hover:bg-[var(--luma-accent)]/10 flex items-center justify-center transition-opacity"
                >
                  <ChevronRight className="w-4 h-4 text-[var(--luma-accent)]" />
                </button>
              )}
            </>
          )}

          {/* Scrollable Reading Area */}
          <div
            ref={scrollContainerRef}
            onMouseUp={handleMouseUpSelection}
            className={`flex-1 overflow-y-auto px-5 sm:px-10 ${
              isImmersiveFullscreen ? 'pt-16 pb-24' : 'pt-6 pb-20 md:pt-8'
            } relative`}
          >
            {/* Relative Wrapper for Document Content + Drawing Layer + Sticky Notes */}
            <div className="relative mx-auto w-full max-w-[1080px]">
              {/* 1. TRUE NATIVE PDF.JS CANVAS VIEWER (faithfully renders PDF pages, never skipped!) */}
              {doc.pdfDataUrl ? (
                <PdfCanvasViewer
                  pdfDataUrl={doc.pdfDataUrl}
                  pageNumber={safeUnit + 1}
                  zoomPct={readerZoomPct}
                  rotation={pdfRotation}
                  continuousMode={pdfContinuous}
                  applyNightSoftFilter={applyPdfNightSoft}
                  onPageCountDetected={(n) => {
                    setDetectedPdfPages(n);
                    if (n !== doc.pdfPageCount) {
                      onUpdateDocument((prev) => ({
                        ...prev,
                        pdfPageCount: n,
                        badgeTag: `PDF · ${n} págs`,
                      }));
                    }
                  }}
                  onVisiblePageChange={(pNum) => {
                    if (pNum - 1 !== safeUnit) setUnitIndex(pNum - 1);
                  }}
                />
              ) : doc.manhwaPanels ? (
                /* 2. Manhwa Vertical Comic Panels (CLEAN speech bubbles — NO "OCR traducido" label!) */
                <div
                  style={{ maxWidth: `${Math.round((660 * readerZoomPct) / 100)}px` }}
                  className="mx-auto space-y-5 transition-all"
                >
                  {doc.manhwaPanels.map((panel) => (
                    <div
                      key={panel.id}
                      className="relative aspect-[3/4] rounded-xl overflow-hidden border border-[var(--luma-border)] luma-sheet-shadow"
                      style={{
                        background: `linear-gradient(155deg, ${panel.gradientFrom}, ${panel.gradientTo})`,
                      }}
                    >
                      <div className="absolute top-3 left-4 text-[11px] font-mono tracking-wider text-white/80">
                        {panel.episodeLabel}
                      </div>

                      <svg
                        viewBox="0 0 600 800"
                        className="absolute inset-0 w-full h-full opacity-25 pointer-events-none"
                      >
                        {Array.from({ length: 18 }).map((_, idx) => {
                          const angle = (idx * 20 * Math.PI) / 180;
                          return (
                            <line
                              key={idx}
                              x1={300 + Math.cos(angle) * 90}
                              y1={400 + Math.sin(angle) * 90}
                              x2={300 + Math.cos(angle) * 520}
                              y2={400 + Math.sin(angle) * 520}
                              stroke={panel.accentColor}
                              strokeWidth="2"
                            />
                          );
                        })}
                      </svg>

                      {panel.bubbles.map((b) => (
                        <div
                          key={b.id}
                          style={{
                            left: `${b.x}%`,
                            top: `${b.y}%`,
                            width: `${b.w}%`,
                            minHeight: `${b.h}%`,
                          }}
                          className="absolute rounded-3xl bg-white text-slate-900 border-[3px] border-slate-900 px-4 py-3 flex flex-col items-center justify-center text-center shadow-lg transition-all"
                        >
                          <p className="text-xs sm:text-sm font-bold leading-snug tracking-tight">
                            {translateManhwa ? b.translated : b.original}
                          </p>
                        </div>
                      ))}

                      <div className="absolute bottom-3 right-4 text-[11px] text-white/70">
                        {panel.sceneCaption}
                      </div>
                    </div>
                  ))}
                </div>
              ) : doc.slides && sheetView && currentSlide ? (
                /* 3. PPTX 16:9 Slide Deck with bullets, embedded tables & embedded images */
                <div
                  style={{ maxWidth: `${Math.round((960 * readerZoomPct) / 100)}px` }}
                  className="mx-auto space-y-5"
                >
                  <div
                    className="min-h-[420px] aspect-[16/9] rounded-2xl p-8 md:p-10 flex flex-col justify-between border border-[var(--luma-border)] luma-sheet-shadow overflow-y-auto"
                    style={{
                      backgroundColor: currentSlide.bgColor,
                      color: currentSlide.textColor,
                    }}
                  >
                    <div>
                      <div
                        className="w-12 h-1.5 rounded-full mb-4"
                        style={{ backgroundColor: currentSlide.accentColor }}
                      />
                      <h1 className="text-2xl md:text-4xl font-bold tracking-tight leading-tight">
                        {currentSlide.title}
                      </h1>
                      {currentSlide.subtitle && (
                        <p className="text-sm md:text-lg opacity-80 mt-2 max-w-2xl">
                          {currentSlide.subtitle}
                        </p>
                      )}
                    </div>

                    <div className="my-4 space-y-4">
                      {currentSlide.bullets.length > 0 && (
                        <ul className="space-y-2 text-sm md:text-base">
                          {currentSlide.bullets.map((line, i) => (
                            <li key={i} className="flex items-start gap-2.5">
                              <span
                                className="w-2 h-2 rounded-full mt-2 shrink-0"
                                style={{ backgroundColor: currentSlide.accentColor }}
                              />
                              <span>{line}</span>
                            </li>
                          ))}
                        </ul>
                      )}

                      {currentSlide.tables?.map((tbl, tIdx) => (
                        <div key={tIdx} className="overflow-x-auto rounded-lg border border-current/20">
                          <table className="w-full text-xs border-collapse">
                            <tbody>
                              {tbl.map((row, rIdx) => (
                                <tr key={rIdx} className="border-b last:border-b-0 border-current/15">
                                  {row.map((cell, cIdx) => (
                                    <td
                                      key={cIdx}
                                      className={`px-3 py-1.5 border-r last:border-r-0 border-current/15 ${
                                        rIdx === 0 ? 'font-bold bg-current/10' : ''
                                      }`}
                                    >
                                      {cell}
                                    </td>
                                  ))}
                                </tr>
                              ))}
                            </tbody>
                          </table>
                        </div>
                      ))}

                      {currentSlide.images && currentSlide.images.length > 0 && (
                        <div className="flex flex-wrap gap-3">
                          {currentSlide.images.map((src, iIdx) => (
                            <img
                              key={iIdx}
                              src={src}
                              alt={`Lámina ${safeUnit + 1}`}
                              className="max-h-52 rounded-lg object-contain bg-white/90 p-1"
                            />
                          ))}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center justify-between text-xs opacity-65 pt-2 border-t border-current/15 tabular-nums">
                      <span>{doc.title}</span>
                      <span>
                        Lámina {safeUnit + 1} de {doc.slides.length}
                      </span>
                    </div>
                  </div>

                  {currentSlide.notes && (
                    <div className="p-4 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-surface)] text-xs text-[var(--luma-ink-muted)]">
                      <span className="font-semibold text-[var(--luma-ink)]">Notas del presentador: </span>
                      {currentSlide.notes}
                    </div>
                  )}
                </div>
              ) : (
                /* 4. Full-Fidelity DOCX / EPUB / FB2 / TXT Renderer (Tables, Images, Rich Runs, Lists, Headings) */
                <article
                  style={{
                    fontFamily: readerFontCss,
                    fontSize: `${effectiveFontSize}px`,
                    lineHeight: prefs.lineHeight,
                    textAlign: prefs.textAlign,
                    maxWidth: useTwoPage
                      ? '1020px'
                      : sheetView
                        ? `${Math.round((816 * readerZoomPct) / 100)}px`
                        : `${prefs.pageWidthCh}ch`,
                  }}
                  className={`mx-auto transition-all ${
                    sheetView
                      ? 'bg-[var(--luma-surface)] border border-[var(--luma-border)] rounded-xl px-8 sm:px-14 py-12 min-h-[920px] luma-sheet-shadow'
                      : ''
                  } ${useTwoPage ? 'columns-2 gap-14' : ''}`}
                >
                  {currentChapter?.blocks.map(renderParsedBlock)}
                </article>
              )}

              {/* Pinned Page Sticky Notes */}
              {showAnnotations &&
                stickyNotesForUnit.map((note) => (
                  <div
                    key={note.id}
                    style={{
                      left: `${note.x * 100}%`,
                      top: `${note.y * 100}%`,
                      backgroundColor: note.color,
                    }}
                    className="absolute z-30 w-48 rounded-xl border border-black/15 shadow-lg p-2.5 text-slate-900"
                  >
                    <div className="flex items-center justify-between mb-1">
                      <span className="text-[10px] font-bold opacity-65">Nota adhesiva</span>
                      <button
                        type="button"
                        onClick={() => deleteStickyNote(note.id)}
                        title="Eliminar nota"
                        className="p-0.5 rounded hover:bg-black/10"
                      >
                        <X className="w-3 h-3" />
                      </button>
                    </div>
                    <textarea
                      value={note.text}
                      onChange={(e) => updateStickyNote(note.id, e.target.value)}
                      placeholder="Escribe tu nota..."
                      rows={3}
                      className="w-full bg-transparent text-xs leading-snug outline-none resize-none placeholder:text-slate-600/70"
                    />
                  </div>
                ))}

              {/* Freehand Drawing, Shapes, Eraser & Sticky Placement Overlay Canvas */}
              <canvas
                ref={canvasRef}
                onPointerDown={handleCanvasPointerDown}
                onPointerMove={handleCanvasPointerMove}
                onPointerUp={handleCanvasPointerUp}
                onPointerCancel={handleCanvasPointerUp}
                className={`absolute inset-0 w-full h-full z-20 ${
                  activeTool !== 'select'
                    ? 'pointer-events-auto cursor-crosshair touch-none'
                    : 'pointer-events-none'
                }`}
              />
            </div>
          </div>

          {/* Floating Bottom Zoom Pill + FULLSCREEN BUTTON RIGHT BESIDE IT (- 100% + | ⛶) */}
          <div
            className={`absolute bottom-12 left-1/2 -translate-x-1/2 z-20 transition-opacity ${fadeDurationClass} ${
              chromeFaded ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
          >
            <div className="h-9 px-2 rounded-full border border-[var(--luma-border)] bg-[var(--luma-surface)]/95 shadow-lg backdrop-blur-sm flex items-center gap-1 text-xs">
              <button
                type="button"
                onClick={() => setReaderZoomPct((z) => Math.max(70, z - 10))}
                title="Alejar"
                className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[var(--luma-surface-alt)]"
              >
                <Minus className="w-3.5 h-3.5" />
              </button>
              <button
                type="button"
                onClick={() => setReaderZoomPct(100)}
                title="Restablecer al 100%"
                className="px-1.5 font-mono font-semibold tabular-nums text-[11px]"
              >
                {readerZoomPct}%
              </button>
              <button
                type="button"
                onClick={() => setReaderZoomPct((z) => Math.min(200, z + 10))}
                title="Acercar"
                className="w-7 h-7 rounded-full flex items-center justify-center hover:bg-[var(--luma-surface-alt)]"
              >
                <Plus className="w-3.5 h-3.5" />
              </button>

              <div className="w-px h-4 bg-[var(--luma-border)] mx-0.5" />

              <button
                type="button"
                onClick={onToggleImmersiveFullscreen}
                title={
                  isImmersiveFullscreen
                    ? 'Salir de pantalla completa (ESC)'
                    : 'Pantalla completa (F11)'
                }
                className={`h-7 px-2.5 rounded-full inline-flex items-center gap-1.5 text-[11px] font-semibold transition-colors whitespace-nowrap ${
                  isImmersiveFullscreen
                    ? 'bg-[var(--luma-accent)] text-[var(--luma-on-accent)]'
                    : 'hover:bg-[var(--luma-surface-alt)] text-[var(--luma-ink)]'
                }`}
              >
                {isImmersiveFullscreen ? (
                  <Minimize2 className="w-3.5 h-3.5" />
                ) : (
                  <Maximize2 className="w-3.5 h-3.5" />
                )}
                <span className="hidden sm:inline">
                  {isImmersiveFullscreen ? 'Salir' : 'Pantalla completa'}
                </span>
              </button>
            </div>
          </div>

          {/* Quiet Bottom Pagination & Reading Progress Footer */}
          <div
            className={`h-10 px-4 border-t border-[var(--luma-border)] bg-[var(--luma-surface)] flex items-center justify-between text-xs shrink-0 transition-opacity ${fadeDurationClass} ${
              chromeFaded ? 'opacity-0 pointer-events-none' : 'opacity-100'
            }`}
          >
            <div className="flex items-center gap-2">
              {totalUnits > 1 && (
                <button
                  type="button"
                  disabled={safeUnit === 0}
                  onClick={() => goToUnit(safeUnit - 1)}
                  className="h-7 px-2 rounded-md inline-flex items-center gap-1 hover:bg-[var(--luma-surface-alt)] disabled:opacity-40"
                >
                  <ChevronLeft className="w-3.5 h-3.5" />
                  <span className="hidden sm:inline">Anterior</span>
                </button>
              )}
              <span className="text-[11px] text-[var(--luma-ink-muted)] tabular-nums">
                Pág. {safeUnit + 1} / {totalUnits} · {doc.badgeTag}
              </span>
            </div>

            <div className="flex items-center gap-2">
              <span className="text-[11px] text-[var(--luma-ink-muted)] tabular-nums">
                {progressPct}% · ~{estMinsLeft} min restantes
              </span>
              {totalUnits > 1 && (
                <button
                  type="button"
                  disabled={safeUnit >= totalUnits - 1}
                  onClick={() => goToUnit(safeUnit + 1)}
                  className="h-7 px-2 rounded-md inline-flex items-center gap-1 hover:bg-[var(--luma-surface-alt)] disabled:opacity-40"
                >
                  <span className="hidden sm:inline">Siguiente</span>
                  <ChevronRight className="w-3.5 h-3.5" />
                </button>
              )}
            </div>
          </div>
        </div>

        {/* Right Notion-Style Collapsible Reading Inspector */}
        {showInspector && (
          <aside
            style={{ width: viewport.inspectorWidth }}
            className="h-full shrink-0 border-l border-[var(--luma-border)] bg-[var(--luma-surface)] flex flex-col"
          >
            <div className="p-2 border-b border-[var(--luma-border)] grid grid-cols-4 gap-1 text-[11px] font-medium">
              {(
                [
                  { id: 'toc', label: 'Índice', icon: <List className="w-3.5 h-3.5" /> },
                  { id: 'notes', label: 'Notas', icon: <Highlighter className="w-3.5 h-3.5" /> },
                  { id: 'bookmarks', label: 'Marc.', icon: <Bookmark className="w-3.5 h-3.5" /> },
                  { id: 'typo', label: 'Texto', icon: <Type className="w-3.5 h-3.5" /> },
                ] as const
              ).map((t) => (
                <button
                  key={t.id}
                  type="button"
                  onClick={() => setInspectorTab(t.id)}
                  className={`py-1.5 rounded-md flex flex-col items-center gap-0.5 transition-colors ${
                    inspectorTab === t.id
                      ? 'bg-[var(--luma-accent-soft)] text-[var(--luma-accent)] font-semibold'
                      : 'text-[var(--luma-ink-muted)] hover:bg-[var(--luma-surface-alt)]'
                  }`}
                >
                  {t.icon}
                  <span>{t.label}</span>
                </button>
              ))}
            </div>

            <div className="flex-1 overflow-y-auto p-3.5 space-y-3 text-xs">
              {inspectorTab === 'toc' && (
                <div className="space-y-1">
                  <div className="text-[11px] font-semibold text-[var(--luma-ink-muted)] mb-2">
                    {doc.pdfDataUrl ? `Páginas PDF (${totalUnits})` : `Contenido (${totalUnits})`}
                  </div>
                  {(doc.pdfDataUrl
                    ? Array.from({ length: totalUnits }, (_, idx) => ({
                        id: `pdf_toc_${idx}`,
                        title: doc.chapters[idx]?.title || `Página ${idx + 1}`,
                        idx,
                      }))
                    : doc.slides
                      ? doc.slides.map((s, idx) => ({
                          id: s.id,
                          title: `${idx + 1}. ${s.title}`,
                          idx,
                        }))
                      : doc.chapters.map((c, idx) => ({ id: c.id, title: c.title, idx }))
                  ).map((entry) => (
                    <button
                      key={entry.id}
                      type="button"
                      onClick={() => goToUnit(entry.idx)}
                      className={`w-full px-2.5 py-2 rounded-lg text-left transition-colors ${
                        entry.idx === safeUnit
                          ? 'bg-[var(--luma-accent-soft)] text-[var(--luma-accent)] font-semibold'
                          : 'hover:bg-[var(--luma-surface-alt)] text-[var(--luma-ink)]'
                      }`}
                    >
                      <div className="line-clamp-2">{entry.title}</div>
                    </button>
                  ))}
                </div>
              )}

              {inspectorTab === 'notes' && (
                <div className="space-y-2.5">
                  <div className="text-[11px] font-semibold text-[var(--luma-ink-muted)]">
                    Subrayados y marginalia ({docHighlights.length})
                  </div>
                  {docHighlights.length === 0 ? (
                    <p className="text-[var(--luma-ink-muted)] leading-relaxed">
                      Selecciona cualquier palabra o frase para ver su significado, resaltarla o añadir una nota.
                    </p>
                  ) : (
                    docHighlights.map((hl) => (
                      <div
                        key={hl.id}
                        className="p-2.5 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-bg)] space-y-1.5"
                      >
                        <div className="flex items-start justify-between gap-2">
                          <span
                            className="px-1.5 py-0.5 rounded text-[11px] leading-snug"
                            style={{ backgroundColor: HIGHLIGHT_STYLES[hl.color].bg }}
                          >
                            “{hl.quotedText}”
                          </span>
                          <button
                            type="button"
                            onClick={() => onDeleteHighlight(hl.id)}
                            className="p-1 text-[var(--luma-ink-muted)] hover:text-red-500 shrink-0"
                          >
                            <Trash2 className="w-3 h-3" />
                          </button>
                        </div>
                        {hl.noteText && (
                          <p className="text-[11px] text-[var(--luma-ink-muted)]">{hl.noteText}</p>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {inspectorTab === 'bookmarks' && (
                <div className="space-y-2">
                  <div className="text-[11px] font-semibold text-[var(--luma-ink-muted)]">
                    Marcadores ({docBookmarks.length})
                  </div>
                  {docBookmarks.length === 0 ? (
                    <p className="text-[var(--luma-ink-muted)]">
                      Pulsa el icono de marcador en la barra superior para guardar tu posición.
                    </p>
                  ) : (
                    docBookmarks.map((bm) => (
                      <button
                        key={bm.id}
                        type="button"
                        onClick={() => goToUnit(bm.unitIndex)}
                        className="w-full p-2.5 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-bg)] hover:border-[var(--luma-accent)] text-left flex items-center gap-2"
                      >
                        <BookOpen className="w-3.5 h-3.5 text-[var(--luma-accent)] shrink-0" />
                        <span className="truncate">{bm.label}</span>
                      </button>
                    ))
                  )}
                </div>
              )}

              {inspectorTab === 'typo' && (
                <div className="space-y-4">
                  {viewport.canTwoPageSpread && !compactSplit && !doc.slides && !doc.manhwaPanels && !doc.pdfDataUrl && (
                    <button
                      type="button"
                      onClick={() => onUpdatePrefs({ twoPageSpread: !prefs.twoPageSpread })}
                      className={`w-full h-8 px-3 rounded-lg border text-xs font-semibold flex items-center justify-between ${
                        prefs.twoPageSpread
                          ? 'border-[var(--luma-accent)] bg-[var(--luma-accent-soft)] text-[var(--luma-accent)]'
                          : 'border-[var(--luma-border)] hover:bg-[var(--luma-surface-alt)]'
                      }`}
                    >
                      <span className="inline-flex items-center gap-1.5">
                        <Columns2 className="w-3.5 h-3.5" />
                        Lectura en 2 páginas
                      </span>
                      <span>{prefs.twoPageSpread ? 'Activo' : 'Inactivo'}</span>
                    </button>
                  )}

                  <div>
                    <div className="text-[11px] font-semibold text-[var(--luma-ink-muted)] mb-2">
                      Tipografía
                    </div>
                    <div className="grid grid-cols-2 gap-1.5">
                      {(Object.keys(FONT_MAP) as ReaderFontId[]).map((fid) => (
                        <button
                          key={fid}
                          type="button"
                          onClick={() => onUpdatePrefs({ readerFont: fid })}
                          style={{ fontFamily: FONT_MAP[fid].css }}
                          className={`p-2 rounded-lg border text-left text-xs ${
                            prefs.readerFont === fid
                              ? 'border-[var(--luma-accent)] bg-[var(--luma-accent-soft)] font-semibold'
                              : 'border-[var(--luma-border)] hover:bg-[var(--luma-surface-alt)]'
                          }`}
                        >
                          {FONT_MAP[fid].label}
                        </button>
                      ))}
                    </div>
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="font-medium">Tamaño</span>
                      <span className="font-mono tabular-nums text-[var(--luma-ink-muted)]">
                        {prefs.fontSizePx}px
                      </span>
                    </div>
                    <input
                      type="range"
                      min={14}
                      max={26}
                      value={prefs.fontSizePx}
                      onChange={(e) => onUpdatePrefs({ fontSizePx: parseInt(e.target.value, 10) })}
                      className="w-full accent-[var(--luma-accent)]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="font-medium">Interlineado</span>
                      <span className="font-mono tabular-nums text-[var(--luma-ink-muted)]">
                        {prefs.lineHeight.toFixed(2)}
                      </span>
                    </div>
                    <input
                      type="range"
                      min={1.35}
                      max={2.1}
                      step={0.05}
                      value={prefs.lineHeight}
                      onChange={(e) => onUpdatePrefs({ lineHeight: parseFloat(e.target.value) })}
                      className="w-full accent-[var(--luma-accent)]"
                    />
                  </div>

                  <div className="space-y-1.5">
                    <div className="flex justify-between">
                      <span className="font-medium">Ancho de columna</span>
                      <span className="font-mono tabular-nums text-[var(--luma-ink-muted)]">
                        {prefs.pageWidthCh}ch
                      </span>
                    </div>
                    <input
                      type="range"
                      min={52}
                      max={88}
                      value={prefs.pageWidthCh}
                      onChange={(e) => onUpdatePrefs({ pageWidthCh: parseInt(e.target.value, 10) })}
                      className="w-full accent-[var(--luma-accent)]"
                    />
                  </div>

                  <div className="pt-2 border-t border-[var(--luma-border)]">
                    <div className="flex items-center justify-between mb-2">
                      <span className="text-[11px] font-semibold text-[var(--luma-ink-muted)]">
                        Temas rápidos
                      </span>
                      <button
                        type="button"
                        onClick={onOpenAppearance}
                        className="text-[11px] text-[var(--luma-accent)] font-semibold hover:underline"
                      >
                        Ver los 17
                      </button>
                    </div>
                    <div className="grid grid-cols-6 gap-1.5">
                      {LUMA_THEMES.slice(0, 12).map((t) => (
                        <button
                          key={t.id}
                          type="button"
                          onClick={() => onUpdatePrefs({ theme: t.id })}
                          title={t.name}
                          className={`h-7 rounded-md border ${
                            prefs.theme === t.id
                              ? 'ring-2 ring-[var(--luma-accent)] border-[var(--luma-accent)]'
                              : 'border-black/15'
                          }`}
                          style={{ backgroundColor: t.bg }}
                        />
                      ))}
                    </div>
                  </div>
                </div>
              )}
            </div>
          </aside>
        )}
      </div>

      {/* Export confirmation toast */}
      {exportToast && (
        <div className="fixed bottom-14 right-5 z-50 px-3.5 py-2 rounded-xl bg-[var(--luma-ink)] text-[var(--luma-bg)] text-xs font-semibold shadow-lg">
          {exportToast}
        </div>
      )}
    </div>
  );
};
