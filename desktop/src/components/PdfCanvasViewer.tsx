import React, { useEffect, useRef, useState } from 'react';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { Loader2 } from 'lucide-react';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

interface PdfCanvasViewerProps {
  pdfDataUrl: string;
  pageNumber: number; // 1-based
  zoomPct: number;
  rotation: number; // 0 | 90 | 180 | 270
  continuousMode: boolean;
  applyNightSoftFilter: boolean;
  onPageCountDetected?: (numPages: number) => void;
  onVisiblePageChange?: (pageNumber: number) => void;
}

interface TextSpanItem {
  str: string;
  leftPct: number;
  topPct: number;
  fontSizePx: number;
  widthPx: number;
}

function dataUrlToUint8Array(dataUrl: string): Uint8Array {
  const commaIdx = dataUrl.indexOf(',');
  const base64 = commaIdx >= 0 ? dataUrl.slice(commaIdx + 1) : dataUrl;
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

interface SinglePdfPageProps {
  pdfDoc: pdfjsLib.PDFDocumentProxy;
  pageNum: number;
  zoomPct: number;
  rotation: number;
  applyNightSoftFilter: boolean;
}

const SinglePdfPage: React.FC<SinglePdfPageProps> = ({
  pdfDoc,
  pageNum,
  zoomPct,
  rotation,
  applyNightSoftFilter,
}) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [dims, setDims] = useState<{ w: number; h: number }>({ w: 680, h: 920 });
  const [textSpans, setTextSpans] = useState<TextSpanItem[]>([]);
  const [rendering, setRendering] = useState(true);

  useEffect(() => {
    let cancelled = false;
    let renderTask: pdfjsLib.RenderTask | null = null;

    async function render() {
      setRendering(true);
      try {
        const page = await pdfDoc.getPage(pageNum);
        if (cancelled) return;

        // Base scale targets crisp desktop reading width (~780px at 100%)
        const baseViewport = page.getViewport({ scale: 1, rotation });
        const targetBaseWidth = 780;
        const fitScale = targetBaseWidth / Math.max(1, baseViewport.width);
        const displayScale = fitScale * (zoomPct / 100);
        const viewport = page.getViewport({ scale: displayScale, rotation });

        const dpr = Math.min(window.devicePixelRatio || 1, 2.5);
        const renderViewport = page.getViewport({ scale: displayScale * dpr, rotation });

        setDims({ w: Math.round(viewport.width), h: Math.round(viewport.height) });

        const canvas = canvasRef.current;
        if (!canvas || cancelled) return;
        const ctx = canvas.getContext('2d');
        if (!ctx) return;

        canvas.width = Math.max(1, Math.round(renderViewport.width));
        canvas.height = Math.max(1, Math.round(renderViewport.height));
        ctx.clearRect(0, 0, canvas.width, canvas.height);

        renderTask = page.render({
          canvas,
          canvasContext: ctx,
          viewport: renderViewport,
        });
        await renderTask.promise;

        // Build transparent selectable text overlay so Luma's dictionary works inside PDFs!
        const textContent = await page.getTextContent();
        if (cancelled) return;
        const spans: TextSpanItem[] = [];
        for (const item of textContent.items) {
          if (!('str' in item) || !item.str.trim()) continue;
          const tx = pdfjsLib.Util.transform(viewport.transform, item.transform);
          const fontHeight = Math.max(8, Math.hypot(tx[2], tx[3]));
          const left = tx[4];
          const top = tx[5] - fontHeight * 0.85;
          spans.push({
            str: item.str,
            leftPct: (left / Math.max(1, viewport.width)) * 100,
            topPct: (top / Math.max(1, viewport.height)) * 100,
            fontSizePx: fontHeight,
            widthPx: Math.max(10, (item.width || 0) * displayScale),
          });
        }
        setTextSpans(spans);
      } catch (err: unknown) {
        if ((err as { name?: string })?.name !== 'RenderingCancelledException') {
          // Non-fatal render error
        }
      } finally {
        if (!cancelled) setRendering(false);
      }
    }

    render();
    return () => {
      cancelled = true;
      try {
        renderTask?.cancel();
      } catch {
        // ignore cancel errors
      }
    };
  }, [pdfDoc, pageNum, zoomPct, rotation]);

  return (
    <div
      style={{
        width: dims.w,
        height: dims.h,
        filter: applyNightSoftFilter
          ? 'invert(0.86) hue-rotate(180deg) brightness(0.92)'
          : undefined,
      }}
      className="relative mx-auto rounded-lg overflow-hidden border border-[var(--luma-border)] bg-white luma-sheet-shadow select-text"
    >
      <canvas
        ref={canvasRef}
        style={{ width: dims.w, height: dims.h }}
        className="block w-full h-full"
      />

      {/* Transparent Selectable Text Layer for Inline Dictionary & Highlights */}
      <div className="absolute inset-0 overflow-hidden pointer-events-auto">
        {textSpans.map((sp, idx) => (
          <span
            key={idx}
            style={{
              position: 'absolute',
              left: `${sp.leftPct}%`,
              top: `${sp.topPct}%`,
              fontSize: `${sp.fontSizePx}px`,
              lineHeight: 1.05,
              whiteSpace: 'pre',
              color: 'transparent',
            }}
          >
            {sp.str}{' '}
          </span>
        ))}
      </div>

      {rendering && (
        <div className="absolute inset-0 bg-white/60 flex items-center justify-center pointer-events-none">
          <Loader2 className="w-5 h-5 animate-spin text-[var(--luma-accent)]" />
        </div>
      )}
    </div>
  );
};

export const PdfCanvasViewer: React.FC<PdfCanvasViewerProps> = ({
  pdfDataUrl,
  pageNumber,
  zoomPct,
  rotation,
  continuousMode,
  applyNightSoftFilter,
  onPageCountDetected,
  onVisiblePageChange,
}) => {
  const [pdfDoc, setPdfDoc] = useState<pdfjsLib.PDFDocumentProxy | null>(null);
  const [numPages, setNumPages] = useState(0);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);
  const pageRefs = useRef<Record<number, HTMLDivElement | null>>({});

  useEffect(() => {
    let cancelled = false;
    let activeTask: pdfjsLib.PDFDocumentLoadingTask | null = null;
    let loadedDoc: pdfjsLib.PDFDocumentProxy | null = null;

    async function loadPdf() {
      setLoading(true);
      setErrorMsg(null);
      try {
        const bytes = dataUrlToUint8Array(pdfDataUrl);
        activeTask = pdfjsLib.getDocument({ data: bytes });
        const doc = await activeTask.promise;
        if (cancelled) {
          activeTask.destroy();
          return;
        }
        loadedDoc = doc;
        setPdfDoc(doc);
        setNumPages(doc.numPages);
        onPageCountDetected?.(doc.numPages);
      } catch (e) {
        if (!cancelled) {
          setErrorMsg(
            e instanceof Error
              ? `No se pudo abrir este PDF (${e.message}).`
              : 'No se pudo renderizar este documento PDF.'
          );
        }
      } finally {
        if (!cancelled) setLoading(false);
      }
    }

    loadPdf();
    return () => {
      cancelled = true;
      try {
        loadedDoc?.cleanup();
        activeTask?.destroy();
      } catch {
        // ignore cleanup
      }
    };
  }, [pdfDataUrl]);

  // In continuous mode, scroll to the requested page when navigated from TOC/search
  useEffect(() => {
    if (!continuousMode) return;
    const el = pageRefs.current[pageNumber];
    if (el) {
      el.scrollIntoView({ behavior: 'smooth', block: 'start' });
    }
  }, [pageNumber, continuousMode]);

  if (loading) {
    return (
      <div className="py-24 flex flex-col items-center justify-center gap-3 text-xs text-[var(--luma-ink-muted)]">
        <Loader2 className="w-6 h-6 animate-spin text-[var(--luma-accent)]" />
        <span>Renderizando páginas en formato PDF nativo...</span>
      </div>
    );
  }

  if (errorMsg || !pdfDoc) {
    return (
      <div className="max-w-lg mx-auto my-12 p-6 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-surface)] text-center space-y-2">
        <div className="text-sm font-semibold">Error al mostrar el PDF</div>
        <p className="text-xs text-[var(--luma-ink-muted)]">{errorMsg}</p>
      </div>
    );
  }

  const safePage = Math.min(Math.max(1, pageNumber), Math.max(1, numPages));

  if (continuousMode) {
    const pagesToShow = Array.from({ length: Math.min(numPages, 60) }, (_, i) => i + 1);
    return (
      <div className="space-y-6 pb-8">
        {pagesToShow.map((pNum) => (
          <div
            key={pNum}
            ref={(el) => {
              pageRefs.current[pNum] = el;
            }}
            onClick={() => onVisiblePageChange?.(pNum)}
            className="space-y-1.5"
          >
            <div className="text-center text-[11px] font-mono text-[var(--luma-ink-muted)] tabular-nums">
              Página {pNum} de {numPages}
            </div>
            <SinglePdfPage
              pdfDoc={pdfDoc}
              pageNum={pNum}
              zoomPct={zoomPct}
              rotation={rotation}
              applyNightSoftFilter={applyNightSoftFilter}
            />
          </div>
        ))}
        {numPages > 60 && (
          <div className="text-center text-xs text-[var(--luma-ink-muted)] py-3">
            Usa el modo Página única o el Índice para navegar más allá de la página 60 (total: {numPages} páginas).
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="py-2">
      <SinglePdfPage
        pdfDoc={pdfDoc}
        pageNum={safePage}
        zoomPct={zoomPct}
        rotation={rotation}
        applyNightSoftFilter={applyNightSoftFilter}
      />
    </div>
  );
};
