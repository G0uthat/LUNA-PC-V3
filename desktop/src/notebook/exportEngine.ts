import {
  CanvasObject,
  LumaNotebook,
  NotebookPage,
  ShapeCanvasObject,
  TextCanvasObject,
} from '../types';
import { resolveFontFamilyCss } from '../utils/fontManager';
import { renderStrokeToCanvas } from './brushEngine';
import {
  computePageGeometry,
  getEffectivePageSetup,
  getMarginsPx,
  PageGeometry,
} from './pageGeometry';

function triggerDownload(blob: Blob, filename: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  document.body.appendChild(a);
  a.click();
  a.remove();
  window.setTimeout(() => URL.revokeObjectURL(url), 1500);
}

function loadImage(src: string): Promise<HTMLImageElement | null> {
  return new Promise((resolve) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => resolve(null);
    img.src = src;
  });
}

function drawPolygonPath(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  rx: number,
  ry: number,
  sides: number,
  star = false
) {
  ctx.beginPath();
  const total = star ? sides * 2 : sides;
  for (let i = 0; i < total; i++) {
    const angle = (i * Math.PI * 2) / total - Math.PI / 2;
    const scale = star && i % 2 === 1 ? 0.44 : 1;
    const px = cx + Math.cos(angle) * rx * scale;
    const py = cy + Math.sin(angle) * ry * scale;
    if (i === 0) ctx.moveTo(px, py);
    else ctx.lineTo(px, py);
  }
  ctx.closePath();
}

function drawShapeOnCtx(ctx: CanvasRenderingContext2D, obj: ShapeCanvasObject) {
  const { x, y, w, h, strokeColor, fillColor, strokeWidth, shape } = obj;
  ctx.save();
  ctx.strokeStyle = strokeColor;
  ctx.fillStyle = fillColor;
  ctx.lineWidth = strokeWidth;
  if (obj.lineStyle === 'dashed') ctx.setLineDash([10, 6]);
  else if (obj.lineStyle === 'dotted') ctx.setLineDash([2, 6]);

  if (shape === 'rect') {
    const r = Math.min(obj.borderRadius ?? 10, w / 2, h / 2);
    ctx.beginPath();
    ctx.roundRect(x, y, w, h, r);
    if (fillColor && fillColor !== 'transparent') ctx.fill();
    ctx.stroke();
  } else if (shape === 'ellipse') {
    ctx.beginPath();
    ctx.ellipse(x + w / 2, y + h / 2, w / 2, h / 2, 0, 0, Math.PI * 2);
    if (fillColor && fillColor !== 'transparent') ctx.fill();
    ctx.stroke();
  } else if (shape === 'triangle') {
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w, y + h);
    ctx.lineTo(x, y + h);
    ctx.closePath();
    if (fillColor && fillColor !== 'transparent') ctx.fill();
    ctx.stroke();
  } else if (shape === 'diamond') {
    ctx.beginPath();
    ctx.moveTo(x + w / 2, y);
    ctx.lineTo(x + w, y + h / 2);
    ctx.lineTo(x + w / 2, y + h);
    ctx.lineTo(x, y + h / 2);
    ctx.closePath();
    if (fillColor && fillColor !== 'transparent') ctx.fill();
    ctx.stroke();
  } else if (shape === 'pentagon') {
    drawPolygonPath(ctx, x + w / 2, y + h / 2, w / 2, h / 2, 5, false);
    if (fillColor && fillColor !== 'transparent') ctx.fill();
    ctx.stroke();
  } else if (shape === 'hexagon') {
    drawPolygonPath(ctx, x + w / 2, y + h / 2, w / 2, h / 2, 6, false);
    if (fillColor && fillColor !== 'transparent') ctx.fill();
    ctx.stroke();
  } else if (shape === 'star') {
    drawPolygonPath(ctx, x + w / 2, y + h / 2, w / 2, h / 2, 5, true);
    if (fillColor && fillColor !== 'transparent') ctx.fill();
    ctx.stroke();
  } else if (shape === 'line' || shape === 'arrow') {
    ctx.beginPath();
    ctx.moveTo(x, y + h / 2);
    ctx.lineTo(x + w, y + h / 2);
    ctx.stroke();
    if (shape === 'arrow') {
      const head = Math.max(12, strokeWidth * 4);
      ctx.beginPath();
      ctx.moveTo(x + w - head, y + h / 2 - head * 0.55);
      ctx.lineTo(x + w, y + h / 2);
      ctx.lineTo(x + w - head, y + h / 2 + head * 0.55);
      ctx.stroke();
    }
  }
  ctx.restore();
}

function drawWrappedText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  maxWidth: number,
  lineHeightPx: number,
  align: TextCanvasObject['align'] = 'left',
  listType: TextCanvasObject['listType'] = 'none'
) {
  const paragraphs = text.split('\n');
  let cursorY = y;
  paragraphs.forEach((rawLine, pIdx) => {
    const prefix =
      listType === 'bullet'
        ? '• '
        : listType === 'number'
          ? `${pIdx + 1}. `
          : '';
    const words = `${prefix}${rawLine}`.split(' ');
    let currentLine = '';
    for (const word of words) {
      const test = currentLine ? `${currentLine} ${word}` : word;
      if (ctx.measureText(test).width > maxWidth && currentLine) {
        const drawX =
          align === 'center' ? x + maxWidth / 2 : align === 'right' ? x + maxWidth : x;
        ctx.textAlign = align === 'justify' ? 'left' : align;
        ctx.fillText(currentLine, drawX, cursorY);
        currentLine = word;
        cursorY += lineHeightPx;
      } else {
        currentLine = test;
      }
    }
    const drawX =
      align === 'center' ? x + maxWidth / 2 : align === 'right' ? x + maxWidth : x;
    ctx.textAlign = align === 'justify' ? 'left' : align;
    ctx.fillText(currentLine, drawX, cursorY);
    cursorY += lineHeightPx;
  });
}

/**
 * Renders a complete NotebookPage (paper background, pattern, header/footer,
 * flowing Word body text, raster layer, and all visible CanvasObjects) onto an offscreen canvas.
 */
export async function renderPageToOffscreenCanvas(
  notebook: LumaNotebook,
  page: NotebookPage,
  pageIndex: number,
  scale = 2
): Promise<{ canvas: HTMLCanvasElement; geom: PageGeometry }> {
  const setup = getEffectivePageSetup(notebook);
  const geom = computePageGeometry(notebook.pageSize, setup);
  const margins = getMarginsPx(setup, geom);

  const canvas = document.createElement('canvas');
  canvas.width = Math.round(geom.w * scale);
  canvas.height = Math.round(geom.h * scale);
  const ctx = canvas.getContext('2d')!;
  ctx.scale(scale, scale);

  // 1. Paper background
  ctx.fillStyle = page.backgroundColor || '#FFFFFF';
  ctx.fillRect(0, 0, geom.w, geom.h);

  // 2. Paper pattern
  ctx.save();
  if (page.pattern === 'ruled') {
    ctx.strokeStyle = 'rgba(43, 100, 245, 0.14)';
    ctx.lineWidth = 1;
    for (let y = 72; y < geom.h - 32; y += 34) {
      ctx.beginPath();
      ctx.moveTo(32, y);
      ctx.lineTo(geom.w - 32, y);
      ctx.stroke();
    }
  } else if (page.pattern === 'grid') {
    ctx.strokeStyle = 'rgba(43, 100, 245, 0.12)';
    ctx.lineWidth = 1;
    for (let x = 28; x < geom.w; x += 28) {
      ctx.beginPath();
      ctx.moveTo(x, 0);
      ctx.lineTo(x, geom.h);
      ctx.stroke();
    }
    for (let y = 28; y < geom.h; y += 28) {
      ctx.beginPath();
      ctx.moveTo(0, y);
      ctx.lineTo(geom.w, y);
      ctx.stroke();
    }
  } else if (page.pattern === 'dotted') {
    ctx.fillStyle = 'rgba(100, 116, 139, 0.28)';
    for (let x = 28; x < geom.w; x += 28) {
      for (let y = 28; y < geom.h; y += 28) {
        ctx.beginPath();
        ctx.arc(x, y, 1.3, 0, Math.PI * 2);
        ctx.fill();
      }
    }
  } else if (page.pattern === 'cornell') {
    ctx.strokeStyle = 'rgba(194, 100, 43, 0.26)';
    ctx.lineWidth = 1.5;
    ctx.beginPath();
    ctx.moveTo(0, 118);
    ctx.lineTo(geom.w, 118);
    ctx.moveTo(310, 118);
    ctx.lineTo(310, geom.h - 170);
    ctx.moveTo(0, geom.h - 170);
    ctx.lineTo(geom.w, geom.h - 170);
    ctx.stroke();
  }
  ctx.restore();

  // 3. Header / Footer / Page Number
  ctx.save();
  ctx.font = '12px "Plus Jakarta Sans", sans-serif';
  ctx.fillStyle = '#64748B';
  if (setup.headerText) {
    ctx.textAlign = 'left';
    ctx.fillText(setup.headerText, margins.left, Math.max(24, margins.top * 0.55));
  }
  if (setup.footerText) {
    ctx.textAlign = 'left';
    ctx.fillText(setup.footerText, margins.left, geom.h - Math.max(18, margins.bottom * 0.45));
  }
  if (setup.showPageNumbers) {
    ctx.textAlign = 'right';
    ctx.fillText(
      `Página ${pageIndex + 1} de ${notebook.pages.length}`,
      geom.w - margins.right,
      geom.h - Math.max(18, margins.bottom * 0.45)
    );
  }
  ctx.restore();

  // 4. Optional Word-style flowing body text inside margins
  if (page.bodyText && page.bodyText.trim()) {
    ctx.save();
    ctx.font = '15px "Literata", Georgia, serif';
    ctx.fillStyle = '#1E293B';
    const bodyWidth = Math.max(180, geom.w - margins.left - margins.right);
    const indentPx = Math.round(setup.indentMm * geom.pxPerMm);
    drawWrappedText(
      ctx,
      page.bodyText,
      margins.left + indentPx,
      margins.top + 20,
      bodyWidth - indentPx,
      25,
      'left'
    );
    ctx.restore();
  }

  // 5. Optional raster paint/fill layer
  if (page.rasterDataUrl) {
    const rasterImg = await loadImage(page.rasterDataUrl);
    if (rasterImg) {
      ctx.drawImage(rasterImg, 0, 0, geom.w, geom.h);
    }
  }

  // 6. All visible objects in layer order
  const layerMap = new Map(notebook.layers.map((l) => [l.id, l]));
  for (const obj of page.objects) {
    const grpLayer = layerMap.get(obj.layerId);
    if (obj.visible === false || (grpLayer && !grpLayer.visible)) continue;

    ctx.save();
    ctx.globalAlpha = Math.max(0, Math.min(1, obj.opacity ?? 1));
    if (obj.blendMode && obj.blendMode !== 'normal') {
      ctx.globalCompositeOperation = obj.blendMode as GlobalCompositeOperation;
    }

    if (obj.rotation && obj.kind !== 'stroke') {
      const cx = obj.x + obj.w / 2;
      const cy = obj.y + obj.h / 2;
      ctx.translate(cx, cy);
      ctx.rotate((obj.rotation * Math.PI) / 180);
      ctx.translate(-cx, -cy);
    }

    if (obj.kind === 'stroke') {
      renderStrokeToCanvas(ctx, obj);
    } else if (obj.kind === 'shape') {
      drawShapeOnCtx(ctx, obj);
    } else if (obj.kind === 'image') {
      const img = await loadImage(obj.src);
      if (img) {
        const crop = obj.crop ?? { top: 0, right: 0, bottom: 0, left: 0 };
        const sx = (crop.left / 100) * img.naturalWidth;
        const sy = (crop.top / 100) * img.naturalHeight;
        const sw = Math.max(1, ((100 - crop.left - crop.right) / 100) * img.naturalWidth);
        const sh = Math.max(1, ((100 - crop.top - crop.bottom) / 100) * img.naturalHeight);
        ctx.save();
        const r = obj.borderRadius ?? 0;
        if (r > 0) {
          ctx.beginPath();
          ctx.roundRect(obj.x, obj.y, obj.w, obj.h, r);
          ctx.clip();
        }
        ctx.translate(obj.x + obj.w / 2, obj.y + obj.h / 2);
        ctx.scale(obj.flipX ? -1 : 1, obj.flipY ? -1 : 1);
        ctx.drawImage(img, sx, sy, sw, sh, -obj.w / 2, -obj.h / 2, obj.w, obj.h);
        ctx.restore();
      }
    } else if (obj.kind === 'text') {
      if (obj.fillColor && obj.fillColor !== 'transparent') {
        ctx.fillStyle = obj.fillColor;
        ctx.beginPath();
        ctx.roundRect(obj.x, obj.y, obj.w, obj.h, 10);
        ctx.fill();
      }
      if (obj.borderColor && obj.borderColor !== 'transparent') {
        ctx.strokeStyle = obj.borderColor;
        ctx.lineWidth = obj.isBanner ? 2 : 1;
        ctx.beginPath();
        ctx.roundRect(obj.x, obj.y, obj.w, obj.h, 10);
        ctx.stroke();
      }
      const weight = obj.bold ? '700' : '400';
      const style = obj.italic ? 'italic' : 'normal';
      const fontCss = resolveFontFamilyCss(obj.fontFamily);
      ctx.font = `${style} ${weight} ${obj.fontSize}px ${fontCss}`;
      ctx.fillStyle = obj.color;
      const lh = Math.round(obj.fontSize * (obj.lineHeight ?? 1.45));
      drawWrappedText(
        ctx,
        obj.text,
        obj.x + 12 + (obj.indentPx ?? 0),
        obj.y + 12 + obj.fontSize,
        Math.max(24, obj.w - 24 - (obj.indentPx ?? 0)),
        lh,
        obj.align,
        obj.listType
      );
    } else if (obj.kind === 'sticky') {
      ctx.fillStyle = obj.bgColor;
      ctx.beginPath();
      ctx.roundRect(obj.x, obj.y, obj.w, obj.h, 10);
      ctx.fill();
      ctx.font = '14px "Plus Jakarta Sans", sans-serif';
      ctx.fillStyle = obj.textColor;
      drawWrappedText(ctx, obj.text, obj.x + 14, obj.y + 28, obj.w - 28, 21, 'left');
    } else if (obj.kind === 'table') {
      const cellW = obj.w / Math.max(1, obj.cols);
      const cellH = obj.h / Math.max(1, obj.rows);
      for (let r = 0; r < obj.rows; r++) {
        for (let c = 0; c < obj.cols; c++) {
          const idx = r * obj.cols + c;
          const st = obj.cellStyles?.[idx];
          if (st?.hidden) continue;
          const spanW = (st?.colSpan ?? 1) * cellW;
          const spanH = (st?.rowSpan ?? 1) * cellH;
          const cx = obj.x + c * cellW;
          const cy = obj.y + r * cellH;
          ctx.fillStyle = st?.bg || (r === 0 ? obj.headerBg : '#FFFFFF');
          ctx.fillRect(cx, cy, spanW, spanH);
          ctx.strokeStyle = obj.borderColor;
          ctx.lineWidth = 1;
          ctx.strokeRect(cx, cy, spanW, spanH);
          ctx.fillStyle = st?.textColor || '#1A2233';
          ctx.font = `${r === 0 || st?.bold ? '600' : '400'} 13px "Plus Jakarta Sans", sans-serif`;
          ctx.textAlign = 'left';
          ctx.fillText(obj.cells[idx] ?? '', cx + 8, cy + 20, spanW - 16);
        }
      }
    } else if (obj.kind === 'sticker') {
      ctx.fillStyle = obj.bgColor;
      ctx.beginPath();
      ctx.roundRect(obj.x, obj.y, obj.w, obj.h, 10);
      ctx.fill();
      ctx.fillStyle = obj.color;
      ctx.font = '600 13px "Plus Jakarta Sans", sans-serif';
      ctx.textAlign = 'center';
      ctx.fillText(`${obj.symbol} ${obj.label}`, obj.x + obj.w / 2, obj.y + obj.h / 2 + 5);
    }

    ctx.restore();
  }

  return { canvas, geom };
}

export async function exportNotebookAsImage(
  notebook: LumaNotebook,
  format: 'png' | 'jpg',
  scope: 'current' | 'all'
): Promise<void> {
  const safeName = notebook.title.replace(/[^a-z0-9-_]+/gi, '_').toLowerCase() || 'cuaderno_luma';
  const indices =
    scope === 'all'
      ? notebook.pages.map((_, idx) => idx)
      : [notebook.activePageIndex];

  const mime = format === 'jpg' ? 'image/jpeg' : 'image/png';
  for (const idx of indices) {
    const page = notebook.pages[idx];
    if (!page) continue;
    const { canvas } = await renderPageToOffscreenCanvas(notebook, page, idx, 2);
    const blob = await new Promise<Blob | null>((resolve) =>
      canvas.toBlob((b) => resolve(b), mime, 0.94)
    );
    if (blob) {
      const suffix = indices.length > 1 ? `_p${idx + 1}` : '';
      triggerDownload(blob, `${safeName}${suffix}.${format}`);
    }
  }
}

function escapeXml(str: string): string {
  return str
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}

/**
 * Generates a crisp standalone SVG vector export of the current page (or all pages stacked vertically).
 */
export async function exportNotebookAsSvg(
  notebook: LumaNotebook,
  scope: 'current' | 'all'
): Promise<void> {
  const setup = getEffectivePageSetup(notebook);
  const geom = computePageGeometry(notebook.pageSize, setup);
  const indices =
    scope === 'all'
      ? notebook.pages.map((_, idx) => idx)
      : [notebook.activePageIndex];

  const gap = 36;
  const totalHeight = indices.length * geom.h + (indices.length - 1) * gap;
  const parts: string[] = [
    `<svg xmlns="http://www.w3.org/2000/svg" width="${geom.w}" height="${totalHeight}" viewBox="0 0 ${geom.w} ${totalHeight}">`,
  ];

  const layerMap = new Map(notebook.layers.map((l) => [l.id, l]));

  indices.forEach((pIdx, order) => {
    const page = notebook.pages[pIdx];
    if (!page) return;
    const offsetY = order * (geom.h + gap);
    parts.push(`<g transform="translate(0, ${offsetY})">`);
    parts.push(
      `<rect x="0" y="0" width="${geom.w}" height="${geom.h}" fill="${escapeXml(page.backgroundColor || '#FFFFFF')}" stroke="#E2E8F0"/>`
    );

    if (page.rasterDataUrl) {
      parts.push(
        `<image href="${page.rasterDataUrl}" x="0" y="0" width="${geom.w}" height="${geom.h}"/>`
      );
    }

    for (const obj of page.objects) {
      const grp = layerMap.get(obj.layerId);
      if (obj.visible === false || (grp && !grp.visible)) continue;
      const rot =
        obj.rotation && obj.kind !== 'stroke'
          ? ` transform="rotate(${obj.rotation} ${obj.x + obj.w / 2} ${obj.y + obj.h / 2})"`
          : '';
      const opacity = ` opacity="${obj.opacity ?? 1}"`;

      if (obj.kind === 'stroke' && obj.points.length > 0) {
        const d = obj.points
          .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`)
          .join(' ');
        parts.push(
          `<path d="${d}" fill="none" stroke="${escapeXml(obj.color)}" stroke-width="${obj.strokeWidth}" stroke-linecap="round" stroke-linejoin="round"${opacity}/>`
        );
      } else if (obj.kind === 'shape') {
        if (obj.shape === 'ellipse') {
          parts.push(
            `<ellipse cx="${obj.x + obj.w / 2}" cy="${obj.y + obj.h / 2}" rx="${obj.w / 2}" ry="${obj.h / 2}" fill="${escapeXml(obj.fillColor || 'none')}" stroke="${escapeXml(obj.strokeColor)}" stroke-width="${obj.strokeWidth}"${opacity}${rot}/>`
          );
        } else if (obj.shape === 'line' || obj.shape === 'arrow') {
          parts.push(
            `<line x1="${obj.x}" y1="${obj.y + obj.h / 2}" x2="${obj.x + obj.w}" y2="${obj.y + obj.h / 2}" stroke="${escapeXml(obj.strokeColor)}" stroke-width="${obj.strokeWidth}"${opacity}${rot}/>`
          );
        } else {
          parts.push(
            `<rect x="${obj.x}" y="${obj.y}" width="${obj.w}" height="${obj.h}" rx="${obj.borderRadius ?? 8}" fill="${escapeXml(obj.fillColor || 'none')}" stroke="${escapeXml(obj.strokeColor)}" stroke-width="${obj.strokeWidth}"${opacity}${rot}/>`
          );
        }
      } else if (obj.kind === 'image') {
        parts.push(
          `<image href="${obj.src}" x="${obj.x}" y="${obj.y}" width="${obj.w}" height="${obj.h}" preserveAspectRatio="none"${opacity}${rot}/>`
        );
      } else if (obj.kind === 'text' || obj.kind === 'sticky') {
        const bg = obj.kind === 'sticky' ? obj.bgColor : obj.fillColor;
        const fg = obj.kind === 'sticky' ? obj.textColor : obj.color;
        const fs = obj.kind === 'sticky' ? 14 : obj.fontSize;
        if (bg && bg !== 'transparent') {
          parts.push(
            `<rect x="${obj.x}" y="${obj.y}" width="${obj.w}" height="${obj.h}" rx="10" fill="${escapeXml(bg)}"${opacity}${rot}/>`
          );
        }
        const lines = obj.text.split('\n');
        parts.push(
          `<text x="${obj.x + 12}" y="${obj.y + 12 + fs}" fill="${escapeXml(fg)}" font-size="${fs}" font-family="sans-serif"${opacity}${rot}>${lines
            .map(
              (line, li) =>
                `<tspan x="${obj.x + 12}" dy="${li === 0 ? 0 : Math.round(fs * 1.4)}">${escapeXml(line)}</tspan>`
            )
            .join('')}</text>`
        );
      }
    }
    parts.push('</g>');
  });

  parts.push('</svg>');
  const safeName = notebook.title.replace(/[^a-z0-9-_]+/gi, '_').toLowerCase() || 'cuaderno_luma';
  triggerDownload(
    new Blob([parts.join('\n')], { type: 'image/svg+xml;charset=utf-8' }),
    `${safeName}.svg`
  );
}

/**
 * Generates a real, self-contained multi-page PDF 1.4 binary (embedding crisp JPEG page streams)
 * with zero external dependencies. Opens cleanly in Chrome, Adobe Reader, and Luma's PDF.js reader!
 */
export async function exportNotebookAsPdf(
  notebook: LumaNotebook,
  scope: 'current' | 'all'
): Promise<void> {
  const indices =
    scope === 'all'
      ? notebook.pages.map((_, idx) => idx)
      : [notebook.activePageIndex];

  const pageEntries: Array<{
    jpegBytes: Uint8Array;
    imgW: number;
    imgH: number;
    ptW: number;
    ptH: number;
  }> = [];

  for (const idx of indices) {
    const page = notebook.pages[idx];
    if (!page) continue;
    const { canvas, geom } = await renderPageToOffscreenCanvas(notebook, page, idx, 1.8);
    const dataUrl = canvas.toDataURL('image/jpeg', 0.92);
    const b64 = dataUrl.split(',')[1] || '';
    const bin = atob(b64);
    const bytes = new Uint8Array(bin.length);
    for (let i = 0; i < bin.length; i++) bytes[i] = bin.charCodeAt(i);

    // 1 mm = 2.83465 PDF points
    pageEntries.push({
      jpegBytes: bytes,
      imgW: canvas.width,
      imgH: canvas.height,
      ptW: Number((geom.mmW * 2.83465).toFixed(2)),
      ptH: Number((geom.mmH * 2.83465).toFixed(2)),
    });
  }

  if (pageEntries.length === 0) return;

  const encoder = new TextEncoder();
  const chunks: Uint8Array[] = [];
  const offsets: number[] = [];
  let cursor = 0;

  const pushStr = (s: string) => {
    const b = encoder.encode(s);
    chunks.push(b);
    cursor += b.length;
  };
  const pushBytes = (b: Uint8Array) => {
    chunks.push(b);
    cursor += b.length;
  };

  pushStr('%PDF-1.4\n%\xFF\xFF\xFF\xFF\n');

  // Object 1: Catalog, Object 2: Pages
  // For each page i:
  //   imgObj = 3 + i*3
  //   contentObj = 4 + i*3
  //   pageObj = 5 + i*3
  const pageObjIds = pageEntries.map((_, i) => 5 + i * 3);

  offsets[1] = cursor;
  pushStr('1 0 obj\n<< /Type /Catalog /Pages 2 0 R >>\nendobj\n');

  offsets[2] = cursor;
  pushStr(
    `2 0 obj\n<< /Type /Pages /Kids [${pageObjIds.map((id) => `${id} 0 R`).join(' ')}] /Count ${pageEntries.length} >>\nendobj\n`
  );

  pageEntries.forEach((entry, i) => {
    const imgId = 3 + i * 3;
    const contentId = 4 + i * 3;
    const pageId = 5 + i * 3;

    offsets[imgId] = cursor;
    pushStr(
      `${imgId} 0 obj\n<< /Type /XObject /Subtype /Image /Width ${entry.imgW} /Height ${entry.imgH} /ColorSpace /DeviceRGB /BitsPerComponent 8 /Filter /DCTDecode /Length ${entry.jpegBytes.length} >>\nstream\n`
    );
    pushBytes(entry.jpegBytes);
    pushStr('\nendstream\nendobj\n');

    const drawCmd = `q\n${entry.ptW} 0 0 ${entry.ptH} 0 0 cm\n/Im0 Do\nQ\n`;
    offsets[contentId] = cursor;
    pushStr(
      `${contentId} 0 obj\n<< /Length ${drawCmd.length} >>\nstream\n${drawCmd}endstream\nendobj\n`
    );

    offsets[pageId] = cursor;
    pushStr(
      `${pageId} 0 obj\n<< /Type /Page /Parent 2 0 R /MediaBox [0 0 ${entry.ptW} ${entry.ptH}] /Resources << /XObject << /Im0 ${imgId} 0 R >> >> /Contents ${contentId} 0 R >>\nendobj\n`
    );
  });

  const xrefOffset = cursor;
  const totalObjs = 2 + pageEntries.length * 3;
  pushStr(`xref\n0 ${totalObjs + 1}\n0000000000 65535 f \n`);
  for (let id = 1; id <= totalObjs; id++) {
    pushStr(`${String(offsets[id] || 0).padStart(10, '0')} 00000 n \n`);
  }
  pushStr(
    `trailer\n<< /Size ${totalObjs + 1} /Root 1 0 R >>\nstartxref\n${xrefOffset}\n%%EOF`
  );

  const safeName = notebook.title.replace(/[^a-z0-9-_]+/gi, '_').toLowerCase() || 'cuaderno_luma';
  triggerDownload(
    new Blob(chunks as BlobPart[], { type: 'application/pdf' }),
    `${safeName}.pdf`
  );
}

/**
 * Opens a clean print dialog containing rendered high-res snapshots of the notebook pages.
 */
export async function printNotebookPages(
  notebook: LumaNotebook,
  scope: 'current' | 'all'
): Promise<void> {
  const indices =
    scope === 'all'
      ? notebook.pages.map((_, idx) => idx)
      : [notebook.activePageIndex];

  const dataUrls: string[] = [];
  for (const idx of indices) {
    const page = notebook.pages[idx];
    if (!page) continue;
    const { canvas } = await renderPageToOffscreenCanvas(notebook, page, idx, 1.8);
    dataUrls.push(canvas.toDataURL('image/png'));
  }

  const iframe = document.createElement('iframe');
  iframe.style.position = 'fixed';
  iframe.style.width = '0';
  iframe.style.height = '0';
  iframe.style.border = '0';
  document.body.appendChild(iframe);

  const doc = iframe.contentDocument;
  if (!doc) {
    iframe.remove();
    window.print();
    return;
  }

  doc.open();
  doc.write(`<!doctype html><html><head><title>${escapeXml(notebook.title)}</title><style>
    @page { margin: 0; }
    body { margin: 0; padding: 0; background: #fff; }
    img { display: block; width: 100%; height: auto; page-break-after: always; }
    img:last-child { page-break-after: auto; }
  </style></head><body>${dataUrls.map((u) => `<img src="${u}" />`).join('')}</body></html>`);
  doc.close();

  window.setTimeout(() => {
    iframe.contentWindow?.focus();
    iframe.contentWindow?.print();
    window.setTimeout(() => iframe.remove(), 1500);
  }, 250);
}
