import JSZip from 'jszip';
import mammoth from 'mammoth/mammoth.browser';
import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import {
  DocumentFormat,
  LumaDocument,
  ParsedBlock,
  ParsedChapter,
  ParsedTableRow,
  SlidePage,
  TextRun,
} from '../types';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const COVER_PALETTES: Array<[string, string]> = [
  ['#2B64F5', '#1D4AC0'],
  ['#0D9488', '#115E59'],
  ['#C2642B', '#93481B'],
  ['#5B4BDB', '#4234AD'],
  ['#C44672', '#962E53'],
  ['#D97706', '#92400E'],
  ['#257A5E', '#195944'],
];

function pickPalette(seed: string): [string, string] {
  let hash = 0;
  for (let i = 0; i < seed.length; i++) {
    hash = (hash * 31 + seed.charCodeAt(i)) | 0;
  }
  return COVER_PALETTES[Math.abs(hash) % COVER_PALETTES.length];
}

function uid(prefix: string): string {
  return `${prefix}_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 7)}`;
}

function countWords(chapters: ParsedChapter[], slides?: SlidePage[]): number {
  let total = 0;
  for (const ch of chapters) {
    for (const b of ch.blocks) {
      if (b.text) {
        total += b.text.trim().split(/\s+/).filter(Boolean).length;
      }
      if (b.tableRows) {
        for (const r of b.tableRows) {
          for (const c of r.cells) {
            total += c.text.trim().split(/\s+/).filter(Boolean).length;
          }
        }
      }
    }
  }
  if (slides) {
    for (const s of slides) {
      total += (s.title + ' ' + (s.subtitle ?? '') + ' ' + s.bullets.join(' '))
        .trim()
        .split(/\s+/)
        .filter(Boolean).length;
    }
  }
  return Math.max(1, total);
}

function detectFormat(fileName: string): DocumentFormat {
  const ext = fileName.split('.').pop()?.toLowerCase() ?? '';
  switch (ext) {
    case 'epub':
      return 'EPUB';
    case 'pdf':
      return 'PDF';
    case 'docx':
      return 'DOCX';
    case 'pptx':
      return 'PPTX';
    case 'fb2':
      return 'FB2';
    default:
      return 'TXT';
  }
}

function guessMimeType(path: string): string {
  const lower = path.toLowerCase();
  if (lower.endsWith('.png')) return 'image/png';
  if (lower.endsWith('.jpg') || lower.endsWith('.jpeg')) return 'image/jpeg';
  if (lower.endsWith('.gif')) return 'image/gif';
  if (lower.endsWith('.webp')) return 'image/webp';
  if (lower.endsWith('.svg')) return 'image/svg+xml';
  return 'image/png';
}

function extractInlineRuns(
  node: Node,
  style: { bold?: boolean; italic?: boolean; underline?: boolean; code?: boolean } = {}
): TextRun[] {
  const runs: TextRun[] = [];
  node.childNodes.forEach((child) => {
    if (child.nodeType === Node.TEXT_NODE) {
      const txt = child.textContent ?? '';
      if (txt) {
        runs.push({
          text: txt,
          ...(style.bold ? { bold: true } : {}),
          ...(style.italic ? { italic: true } : {}),
          ...(style.underline ? { underline: true } : {}),
          ...(style.code ? { code: true } : {}),
        });
      }
    } else if (child.nodeType === Node.ELEMENT_NODE) {
      const el = child as HTMLElement;
      const tag = el.tagName.toLowerCase();
      if (tag === 'br') {
        runs.push({ text: '\n' });
        return;
      }
      if (tag === 'img') return; // handled as separate image block
      const nextStyle = {
        bold: style.bold || tag === 'strong' || tag === 'b',
        italic: style.italic || tag === 'em' || tag === 'i',
        underline: style.underline || tag === 'u',
        code: style.code || tag === 'code' || tag === 'pre',
      };
      runs.push(...extractInlineRuns(el, nextStyle));
    }
  });
  return runs;
}

/**
 * Rich, XSS-safe DOM-to-ParsedBlock converter that faithfully preserves:
 * headings (H1/H2/H3), bold/italic/underline/code runs, nested bullet & ordered lists,
 * full HTML tables with headers, embedded images, blockquotes, and horizontal rules.
 */
function htmlElementToBlocks(
  root: Element,
  resolveImageSrc?: (rawSrc: string) => string | undefined
): ParsedBlock[] {
  const blocks: ParsedBlock[] = [];

  const pushImagesFrom = (el: Element) => {
    const imgs = Array.from(el.querySelectorAll('img'));
    for (const img of imgs) {
      const rawSrc = img.getAttribute('src') ?? '';
      const resolved = resolveImageSrc ? resolveImageSrc(rawSrc) : rawSrc;
      if (resolved && (resolved.startsWith('data:image/') || resolved.startsWith('http'))) {
        blocks.push({
          id: uid('img'),
          type: 'image',
          text: img.getAttribute('alt')?.trim() || 'Imagen incrustada',
          imageDataUrl: resolved,
          imageAlt: img.getAttribute('alt')?.trim() || '',
        });
      }
    }
  };

  const walkList = (listEl: Element, ordered: boolean, level: number) => {
    let itemCounter = 1;
    Array.from(listEl.children).forEach((child) => {
      if (child.tagName.toLowerCase() !== 'li') return;
      // Extract direct text/runs excluding nested ul/ol
      const clone = child.cloneNode(true) as HTMLElement;
      clone.querySelectorAll('ul, ol').forEach((sub) => sub.remove());
      const runs = extractInlineRuns(clone);
      const text = runs.map((r) => r.text).join('').replace(/\s+/g, ' ').trim();
      if (text) {
        blocks.push({
          id: uid('li'),
          type: ordered ? 'ordered_list' : 'list',
          text,
          runs: runs.length > 0 ? runs : undefined,
          listLevel: level,
          listIndex: ordered ? itemCounter : undefined,
        });
        itemCounter += 1;
      }
      pushImagesFrom(clone);

      // Process nested sublists recursively
      Array.from(child.children).forEach((nested) => {
        const nTag = nested.tagName.toLowerCase();
        if (nTag === 'ul') walkList(nested, false, level + 1);
        else if (nTag === 'ol') walkList(nested, true, level + 1);
      });
    });
  };

  const walkNode = (container: Element) => {
    Array.from(container.children).forEach((el) => {
      const tag = el.tagName.toLowerCase();

      if (tag === 'h1' || tag === 'h2' || tag === 'h3' || tag === 'h4') {
        const runs = extractInlineRuns(el);
        const text = runs.map((r) => r.text).join('').replace(/\s+/g, ' ').trim();
        if (text) {
          blocks.push({
            id: uid('h'),
            type: tag === 'h1' ? 'h1' : tag === 'h2' ? 'h2' : 'h3',
            text,
            runs,
          });
        }
        pushImagesFrom(el);
        return;
      }

      if (tag === 'p') {
        pushImagesFrom(el);
        const runs = extractInlineRuns(el);
        const text = runs.map((r) => r.text).join('').replace(/\s+/g, ' ').trim();
        if (text) {
          blocks.push({
            id: uid('p'),
            type: 'p',
            text,
            runs,
          });
        }
        return;
      }

      if (tag === 'blockquote') {
        const runs = extractInlineRuns(el);
        const text = runs.map((r) => r.text).join('').replace(/\s+/g, ' ').trim();
        if (text) {
          blocks.push({ id: uid('q'), type: 'quote', text, runs });
        }
        return;
      }

      if (tag === 'ul') {
        walkList(el, false, 0);
        return;
      }

      if (tag === 'ol') {
        walkList(el, true, 0);
        return;
      }

      if (tag === 'table') {
        const tableRows: ParsedTableRow[] = [];
        const trs = Array.from(el.querySelectorAll('tr'));
        for (const tr of trs) {
          const cells = Array.from(tr.children)
            .filter((c) => {
              const ct = c.tagName.toLowerCase();
              return ct === 'td' || ct === 'th';
            })
            .map((cell) => ({
              text: cell.textContent?.replace(/\s+/g, ' ').trim() ?? '',
              isHeader:
                cell.tagName.toLowerCase() === 'th' ||
                tr.parentElement?.tagName.toLowerCase() === 'thead',
            }));
          if (cells.length > 0) {
            tableRows.push({ cells });
          }
        }
        if (tableRows.length > 0) {
          // Promote first row to header style if no explicit <th> was present
          if (!tableRows.some((r) => r.cells.some((c) => c.isHeader)) && tableRows.length > 1) {
            tableRows[0] = {
              cells: tableRows[0].cells.map((c) => ({ ...c, isHeader: true })),
            };
          }
          const flatSummary = tableRows
            .map((r) => r.cells.map((c) => c.text).join(' | '))
            .join('\n');
          blocks.push({
            id: uid('tbl'),
            type: 'table',
            text: flatSummary,
            tableRows,
          });
        }
        return;
      }

      if (tag === 'img') {
        const rawSrc = el.getAttribute('src') ?? '';
        const resolved = resolveImageSrc ? resolveImageSrc(rawSrc) : rawSrc;
        if (resolved && (resolved.startsWith('data:image/') || resolved.startsWith('http'))) {
          blocks.push({
            id: uid('img'),
            type: 'image',
            text: el.getAttribute('alt')?.trim() || 'Imagen incrustada',
            imageDataUrl: resolved,
            imageAlt: el.getAttribute('alt')?.trim() || '',
          });
        }
        return;
      }

      if (tag === 'hr') {
        blocks.push({ id: uid('hr'), type: 'hr', text: '' });
        return;
      }

      // Container divs, sections, articles, figures
      if (el.children.length > 0) {
        walkNode(el);
      } else {
        const text = el.textContent?.replace(/\s+/g, ' ').trim() ?? '';
        if (text) {
          blocks.push({ id: uid('p'), type: 'p', text });
        }
      }
    });
  };

  walkNode(root);
  return blocks;
}

function splitBlocksIntoSections(blocks: ParsedBlock[], fallbackTitle: string): ParsedChapter[] {
  const chapters: ParsedChapter[] = [];
  let currentTitle = fallbackTitle;
  let currentBlocks: ParsedBlock[] = [];

  for (const blk of blocks) {
    if (blk.type === 'h1' && currentBlocks.length >= 6) {
      chapters.push({
        id: uid('ch'),
        title: currentTitle,
        blocks: currentBlocks,
      });
      currentTitle = blk.text || fallbackTitle;
      currentBlocks = [blk];
    } else {
      if (blk.type === 'h1' && currentBlocks.length === 0) {
        currentTitle = blk.text || fallbackTitle;
      }
      currentBlocks.push(blk);
    }
  }

  if (currentBlocks.length > 0) {
    chapters.push({
      id: uid('ch'),
      title: currentTitle,
      blocks: currentBlocks,
    });
  }

  return chapters.length > 0
    ? chapters
    : [
        {
          id: uid('ch'),
          title: fallbackTitle,
          blocks: [{ id: uid('b'), type: 'p', text: 'Documento importado correctamente.' }],
        },
      ];
}

function parsePlainTextOrMarkdown(raw: string, fallbackTitle: string): ParsedChapter[] {
  const lines = raw.replace(/\r\n/g, '\n').split('\n');
  const chapters: ParsedChapter[] = [];
  let currentTitle = fallbackTitle;
  let currentBlocks: ParsedBlock[] = [];

  const flush = () => {
    if (currentBlocks.length > 0) {
      chapters.push({
        id: uid('ch'),
        title: currentTitle,
        blocks: currentBlocks,
      });
      currentBlocks = [];
    }
  };

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed) continue;
    if (trimmed.startsWith('# ')) {
      flush();
      currentTitle = trimmed.slice(2).trim();
      currentBlocks.push({ id: uid('b'), type: 'h1', text: currentTitle });
    } else if (trimmed.startsWith('## ')) {
      currentBlocks.push({ id: uid('b'), type: 'h2', text: trimmed.slice(3).trim() });
    } else if (trimmed.startsWith('### ')) {
      currentBlocks.push({ id: uid('b'), type: 'h3', text: trimmed.slice(4).trim() });
    } else if (trimmed.startsWith('> ')) {
      currentBlocks.push({ id: uid('b'), type: 'quote', text: trimmed.slice(2).trim() });
    } else if (/^[-*•]\s+/.test(trimmed)) {
      currentBlocks.push({ id: uid('b'), type: 'list', text: trimmed.replace(/^[-*•]\s+/, '') });
    } else if (/^\d+[.)]\s+/.test(trimmed)) {
      const m = trimmed.match(/^(\d+)[.)]\s+(.*)$/);
      currentBlocks.push({
        id: uid('b'),
        type: 'ordered_list',
        listIndex: m ? parseInt(m[1], 10) : 1,
        text: m ? m[2] : trimmed,
      });
    } else {
      currentBlocks.push({ id: uid('b'), type: 'p', text: trimmed });
    }
  }
  flush();

  if (chapters.length === 0) {
    return [
      {
        id: uid('ch'),
        title: fallbackTitle,
        blocks: [{ id: uid('b'), type: 'p', text: raw.trim() || 'Documento vacío.' }],
      },
    ];
  }
  return chapters;
}

async function parsePdfWithPdfJs(
  bytes: Uint8Array,
  fallbackTitle: string
): Promise<{
  title: string;
  author: string;
  numPages: number;
  chapters: ParsedChapter[];
}> {
  // Pass a copy of bytes because PDF.js may detach the underlying buffer on worker transfer
  const copy = new Uint8Array(bytes);
  const loadingTask = pdfjsLib.getDocument({ data: copy });
  const pdfDoc = await loadingTask.promise;

  let title = fallbackTitle;
  let author = 'Archivo PDF';
  try {
    const meta = await pdfDoc.getMetadata();
    const info = meta?.info as Record<string, unknown> | undefined;
    if (typeof info?.Title === 'string' && info.Title.trim()) {
      title = info.Title.trim();
    }
    if (typeof info?.Author === 'string' && info.Author.trim()) {
      author = info.Author.trim();
    }
  } catch {
    // fallback to filename
  }

  const numPages = pdfDoc.numPages;
  const chapters: ParsedChapter[] = [];
  // Extract text from up to 120 pages for instant global search & table of contents
  const extractLimit = Math.min(numPages, 120);

  for (let p = 1; p <= numPages; p++) {
    let pageText = '';
    if (p <= extractLimit) {
      try {
        const page = await pdfDoc.getPage(p);
        const tc = await page.getTextContent();
        pageText = tc.items
          .map((item) => ('str' in item ? item.str : ''))
          .join(' ')
          .replace(/\s+/g, ' ')
          .trim();
      } catch {
        pageText = '';
      }
    }

    const firstSnippet = pageText.slice(0, 48).trim();
    const pageTitle = firstSnippet
      ? `Página ${p} · ${firstSnippet}${pageText.length > 48 ? '…' : ''}`
      : `Página ${p}`;

    chapters.push({
      id: uid('pdfp'),
      title: pageTitle,
      blocks: [
        {
          id: uid('b'),
          type: 'p',
          text: pageText || `Página ${p} de ${numPages}`,
        },
      ],
    });
  }

  try {
    await pdfDoc.cleanup();
    await loadingTask.destroy();
  } catch {
    // ignore
  }

  return { title, author, numPages, chapters };
}

async function parseEpub(
  bytes: Uint8Array,
  fallbackTitle: string
): Promise<{
  title: string;
  author: string;
  chapters: ParsedChapter[];
}> {
  const zip = await JSZip.loadAsync(bytes);
  let opfPath = '';
  const containerFile = zip.file('META-INF/container.xml');
  if (containerFile) {
    const containerXml = await containerFile.async('text');
    const match = containerXml.match(/full-path="([^"]+)"/i);
    if (match) opfPath = match[1];
  }

  // Preload embedded EPUB images so chapter <img> tags render faithfully
  const imageDataMap = new Map<string, string>();
  const imagePaths = Object.keys(zip.files).filter((k) =>
    /\.(png|jpe?g|gif|webp|svg)$/i.test(k)
  );
  for (const imgPath of imagePaths.slice(0, 60)) {
    try {
      const b64 = await zip.files[imgPath].async('base64');
      const dataUrl = `data:${guessMimeType(imgPath)};base64,${b64}`;
      imageDataMap.set(imgPath, dataUrl);
      const basename = imgPath.split('/').pop();
      if (basename && !imageDataMap.has(basename)) {
        imageDataMap.set(basename, dataUrl);
      }
    } catch {
      // skip unreadable image
    }
  }

  const resolveEpubImage = (chapterPath: string) => (rawSrc: string) => {
    if (!rawSrc) return undefined;
    if (rawSrc.startsWith('data:image/')) return rawSrc;
    const clean = decodeURIComponent(rawSrc.replace(/^\.\//, '').replace(/^\.\.\//, ''));
    const chapterDir = chapterPath.includes('/')
      ? chapterPath.slice(0, chapterPath.lastIndexOf('/') + 1)
      : '';
    return (
      imageDataMap.get(chapterDir + clean) ||
      imageDataMap.get(clean) ||
      imageDataMap.get(clean.split('/').pop() ?? '')
    );
  };

  let title = fallbackTitle;
  let author = 'Autor importado';
  const chapters: ParsedChapter[] = [];

  if (opfPath && zip.file(opfPath)) {
    const opfXml = await zip.file(opfPath)!.async('text');
    const parser = new DOMParser();
    const opfDoc = parser.parseFromString(opfXml, 'application/xml');
    const dcTitle = opfDoc.getElementsByTagNameNS('*', 'title')[0]?.textContent?.trim();
    const dcCreator = opfDoc.getElementsByTagNameNS('*', 'creator')[0]?.textContent?.trim();
    if (dcTitle) title = dcTitle;
    if (dcCreator) author = dcCreator;

    const baseDir = opfPath.includes('/') ? opfPath.slice(0, opfPath.lastIndexOf('/') + 1) : '';
    const manifestMap = new Map<string, string>();
    const items = Array.from(opfDoc.getElementsByTagName('item'));
    for (const item of items) {
      const id = item.getAttribute('id');
      const href = item.getAttribute('href');
      if (id && href) manifestMap.set(id, href);
    }

    const spineRefs = Array.from(opfDoc.getElementsByTagName('itemref'));
    for (const ref of spineRefs) {
      const idref = ref.getAttribute('idref');
      if (!idref) continue;
      const href = manifestMap.get(idref);
      if (!href) continue;
      const fullPath = decodeURIComponent(baseDir + href);
      const entry = zip.file(fullPath) || zip.file(href);
      if (!entry) continue;
      const xhtml = await entry.async('text');
      const htmlDoc = new DOMParser().parseFromString(xhtml, 'text/html');
      const chTitle =
        htmlDoc.querySelector('h1, h2, title')?.textContent?.trim() ||
        `Capítulo ${chapters.length + 1}`;
      const blocks = htmlDoc.body
        ? htmlElementToBlocks(htmlDoc.body, resolveEpubImage(fullPath))
        : [];
      if (blocks.length > 0) {
        chapters.push({ id: uid('ch'), title: chTitle, blocks });
      }
    }
  }

  if (chapters.length === 0) {
    const htmlEntries = Object.keys(zip.files)
      .filter((k) => /\.(x?html?|htm)$/i.test(k))
      .sort();
    for (const key of htmlEntries.slice(0, 50)) {
      const content = await zip.files[key].async('text');
      const htmlDoc = new DOMParser().parseFromString(content, 'text/html');
      const chTitle =
        htmlDoc.querySelector('h1, h2, title')?.textContent?.trim() ||
        `Capítulo ${chapters.length + 1}`;
      const blocks = htmlDoc.body
        ? htmlElementToBlocks(htmlDoc.body, resolveEpubImage(key))
        : [];
      if (blocks.length > 0) {
        chapters.push({ id: uid('ch'), title: chTitle, blocks });
      }
    }
  }

  return {
    title,
    author,
    chapters:
      chapters.length > 0
        ? chapters
        : [
            {
              id: uid('ch'),
              title,
              blocks: [{ id: uid('b'), type: 'p', text: 'EPUB importado correctamente.' }],
            },
          ],
  };
}

/**
 * Full-fidelity DOCX parser using Mammoth (preserving tables, embedded images, bold/italic/underline,
 * headings H1-H4, nested bulleted & numbered lists, footnotes) + OOXML metadata & fallback.
 */
async function parseDocx(
  bytes: Uint8Array,
  fallbackTitle: string
): Promise<{
  title: string;
  author: string;
  chapters: ParsedChapter[];
}> {
  const zip = await JSZip.loadAsync(bytes);
  let title = fallbackTitle;
  let author = 'Documento Word';

  const core = zip.file('docProps/core.xml');
  if (core) {
    const xml = await core.async('text');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const t = doc.getElementsByTagNameNS('*', 'title')[0]?.textContent?.trim();
    const a = doc.getElementsByTagNameNS('*', 'creator')[0]?.textContent?.trim();
    if (t) title = t;
    if (a) author = a;
  }

  // Primary: Mammoth high-fidelity HTML conversion -> safe structured ParsedBlock AST
  try {
    const arrayBuffer = new Uint8Array(bytes).buffer;
    const result = await mammoth.convertToHtml(
      { arrayBuffer },
      {
        convertImage: mammoth.images.imgElement(async (image) => {
          const base64 = await image.read('base64');
          return { src: `data:${image.contentType || 'image/png'};base64,${base64}` };
        }),
      }
    );

    const htmlDoc = new DOMParser().parseFromString(result.value, 'text/html');
    if (htmlDoc.body) {
      const blocks = htmlElementToBlocks(htmlDoc.body);
      if (blocks.length > 0) {
        return {
          title,
          author,
          chapters: splitBlocksIntoSections(blocks, title),
        };
      }
    }
  } catch {
    // Fall through to structured OOXML parser below
  }

  // Fallback: Rich OOXML direct parser (handles paragraphs, lists, tables, and embedded media)
  const relsMap = new Map<string, string>();
  const relsFile = zip.file('word/_rels/document.xml.rels');
  if (relsFile) {
    const relsXml = await relsFile.async('text');
    const relsDoc = new DOMParser().parseFromString(relsXml, 'application/xml');
    Array.from(relsDoc.getElementsByTagName('Relationship')).forEach((rel) => {
      const id = rel.getAttribute('Id');
      const target = rel.getAttribute('Target');
      if (id && target) relsMap.set(id, target);
    });
  }

  const bodyFile = zip.file('word/document.xml');
  const blocks: ParsedBlock[] = [];
  if (bodyFile) {
    const xml = await bodyFile.async('text');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');
    const bodyEl = doc.getElementsByTagNameNS('*', 'body')[0];

    if (bodyEl) {
      for (const child of Array.from(bodyEl.children)) {
        const local = child.localName;
        if (local === 'tbl') {
          const tableRows: ParsedTableRow[] = [];
          const trs = Array.from(child.getElementsByTagNameNS('*', 'tr'));
          trs.forEach((tr, rIdx) => {
            const cells = Array.from(tr.getElementsByTagNameNS('*', 'tc')).map((tc) => ({
              text: Array.from(tc.getElementsByTagNameNS('*', 't'))
                .map((t) => t.textContent ?? '')
                .join('')
                .trim(),
              isHeader: rIdx === 0,
            }));
            if (cells.length > 0) tableRows.push({ cells });
          });
          if (tableRows.length > 0) {
            blocks.push({
              id: uid('tbl'),
              type: 'table',
              text: tableRows.map((r) => r.cells.map((c) => c.text).join(' | ')).join('\n'),
              tableRows,
            });
          }
        } else if (local === 'p') {
          // Check embedded images inside paragraph
          const blips = Array.from(child.getElementsByTagNameNS('*', 'blip'));
          for (const blip of blips) {
            const embedId = blip.getAttribute('r:embed') || blip.getAttribute('embed');
            const target = embedId ? relsMap.get(embedId) : undefined;
            if (target) {
              const mediaEntry = zip.file(`word/${target.replace(/^\/+/, '')}`);
              if (mediaEntry) {
                const b64 = await mediaEntry.async('base64');
                blocks.push({
                  id: uid('img'),
                  type: 'image',
                  text: 'Imagen de documento',
                  imageDataUrl: `data:${guessMimeType(target)};base64,${b64}`,
                });
              }
            }
          }

          const runs: TextRun[] = [];
          Array.from(child.getElementsByTagNameNS('*', 'r')).forEach((rEl) => {
            const txt = Array.from(rEl.getElementsByTagNameNS('*', 't'))
              .map((t) => t.textContent ?? '')
              .join('');
            if (!txt) return;
            const rPr = rEl.getElementsByTagNameNS('*', 'rPr')[0];
            const bold = Boolean(rPr?.getElementsByTagNameNS('*', 'b')[0]);
            const italic = Boolean(rPr?.getElementsByTagNameNS('*', 'i')[0]);
            const underline = Boolean(rPr?.getElementsByTagNameNS('*', 'u')[0]);
            runs.push({ text: txt, bold, italic, underline });
          });

          const text = runs.map((r) => r.text).join('').trim();
          if (!text) continue;
          const pStyle = child.getElementsByTagNameNS('*', 'pStyle')[0]?.getAttribute('w:val') ?? '';
          const hasNumPr = Boolean(child.getElementsByTagNameNS('*', 'numPr')[0]);
          const type: ParsedBlock['type'] = /heading1|title/i.test(pStyle)
            ? 'h1'
            : /heading2|subtitle/i.test(pStyle)
              ? 'h2'
              : /heading3/i.test(pStyle)
                ? 'h3'
                : hasNumPr
                  ? 'list'
                  : 'p';
          blocks.push({ id: uid('b'), type, text, runs });
        }
      }
    }
  }

  return {
    title,
    author,
    chapters: splitBlocksIntoSections(blocks, title),
  };
}

async function parsePptx(
  bytes: Uint8Array,
  fallbackTitle: string
): Promise<{
  title: string;
  author: string;
  slides: SlidePage[];
  chapters: ParsedChapter[];
}> {
  const zip = await JSZip.loadAsync(bytes);
  const slideKeys = Object.keys(zip.files)
    .filter((k) => /^ppt\/slides\/slide\d+\.xml$/i.test(k))
    .sort((a, b) => {
      const na = parseInt(a.match(/\d+/)?.[0] ?? '0', 10);
      const nb = parseInt(b.match(/\d+/)?.[0] ?? '0', 10);
      return na - nb;
    });

  const slides: SlidePage[] = [];
  const chapters: ParsedChapter[] = [];

  for (let i = 0; i < slideKeys.length; i++) {
    const slideKey = slideKeys[i];
    const slideNum = slideKey.match(/\d+/)?.[0] ?? String(i + 1);
    const xml = await zip.files[slideKey].async('text');
    const doc = new DOMParser().parseFromString(xml, 'application/xml');

    // Extract tables inside slide
    const tables: string[][][] = [];
    const tblEls = Array.from(doc.getElementsByTagNameNS('*', 'tbl'));
    for (const tbl of tblEls) {
      const rows: string[][] = [];
      Array.from(tbl.getElementsByTagNameNS('*', 'tr')).forEach((tr) => {
        const rowCells = Array.from(tr.getElementsByTagNameNS('*', 'tc')).map((tc) =>
          Array.from(tc.getElementsByTagNameNS('*', 't'))
            .map((t) => t.textContent ?? '')
            .join('')
            .trim()
        );
        if (rowCells.some(Boolean)) rows.push(rowCells);
      });
      if (rows.length > 0) tables.push(rows);
    }

    // Extract slide images via slide rels
    const images: string[] = [];
    const relsFile = zip.file(`ppt/slides/_rels/slide${slideNum}.xml.rels`);
    if (relsFile) {
      const relsXml = await relsFile.async('text');
      const relsDoc = new DOMParser().parseFromString(relsXml, 'application/xml');
      const rels = Array.from(relsDoc.getElementsByTagName('Relationship'));
      for (const rel of rels) {
        const target = rel.getAttribute('Target') ?? '';
        if (/\.(png|jpe?g|gif|webp)$/i.test(target)) {
          const normalized = target.replace(/^\.\.\//, 'ppt/');
          const entry = zip.file(normalized) || zip.file(`ppt/media/${target.split('/').pop()}`);
          if (entry) {
            try {
              const b64 = await entry.async('base64');
              images.push(`data:${guessMimeType(target)};base64,${b64}`);
            } catch {
              // skip
            }
          }
        }
      }
    }

    // Extract speaker notes if present
    let notes = '';
    const notesFile = zip.file(`ppt/notesSlides/notesSlide${slideNum}.xml`);
    if (notesFile) {
      const notesXml = await notesFile.async('text');
      const notesDoc = new DOMParser().parseFromString(notesXml, 'application/xml');
      notes = Array.from(notesDoc.getElementsByTagNameNS('*', 't'))
        .map((t) => t.textContent ?? '')
        .join(' ')
        .replace(/\s+/g, ' ')
        .trim();
    }

    const paragraphs = Array.from(doc.getElementsByTagNameNS('*', 'p'))
      .map((p) =>
        Array.from(p.getElementsByTagNameNS('*', 't'))
          .map((t) => t.textContent ?? '')
          .join('')
          .trim()
      )
      .filter(Boolean);

    const slideTitle = paragraphs[0] || `Diapositiva ${i + 1}`;
    const bullets = paragraphs.slice(1);

    slides.push({
      id: uid('slide'),
      title: slideTitle,
      bgColor: i === 0 ? '#16243D' : '#FFFCF6',
      textColor: i === 0 ? '#FFFFFF' : '#1A2233',
      accentColor: i === 0 ? '#D97706' : '#2B64F5',
      bullets,
      notes,
      images: images.length > 0 ? images : undefined,
      tables: tables.length > 0 ? tables : undefined,
    });

    const chBlocks: ParsedBlock[] = [
      { id: uid('b'), type: 'h1', text: slideTitle },
      ...bullets.map((line) => ({ id: uid('b'), type: 'list' as const, text: line })),
    ];
    tables.forEach((tbl) => {
      chBlocks.push({
        id: uid('tbl'),
        type: 'table',
        text: tbl.map((r) => r.join(' | ')).join('\n'),
        tableRows: tbl.map((row, rIdx) => ({
          cells: row.map((text) => ({ text, isHeader: rIdx === 0 })),
        })),
      });
    });
    images.forEach((src) => {
      chBlocks.push({ id: uid('img'), type: 'image', text: slideTitle, imageDataUrl: src });
    });

    chapters.push({
      id: uid('ch'),
      title: slideTitle,
      blocks: chBlocks,
    });
  }

  return {
    title: slides[0]?.title || fallbackTitle,
    author: 'Presentación PPTX',
    slides,
    chapters:
      chapters.length > 0
        ? chapters
        : [
            {
              id: uid('ch'),
              title: fallbackTitle,
              blocks: [{ id: uid('b'), type: 'p', text: 'Presentación importada.' }],
            },
          ],
  };
}

function parseFb2(
  raw: string,
  fallbackTitle: string
): {
  title: string;
  author: string;
  chapters: ParsedChapter[];
} {
  const doc = new DOMParser().parseFromString(raw, 'application/xml');
  const title = doc.querySelector('book-title')?.textContent?.trim() || fallbackTitle;
  const first = doc.querySelector('author first-name')?.textContent?.trim() ?? '';
  const last = doc.querySelector('author last-name')?.textContent?.trim() ?? '';
  const author = [first, last].filter(Boolean).join(' ') || 'Autor FB2';

  const sections = Array.from(doc.querySelectorAll('body > section'));
  const chapters: ParsedChapter[] = sections.map((sec, idx) => {
    const chTitle =
      sec.querySelector('title')?.textContent?.replace(/\s+/g, ' ').trim() ||
      `Capítulo ${idx + 1}`;
    const blocks: ParsedBlock[] = [];
    blocks.push({ id: uid('b'), type: 'h1', text: chTitle });
    sec.querySelectorAll('p, cite, subtitle').forEach((el) => {
      const txt = el.textContent?.trim();
      if (!txt || txt === chTitle) return;
      const tag = el.tagName.toLowerCase();
      blocks.push({
        id: uid('b'),
        type: tag === 'cite' ? 'quote' : tag === 'subtitle' ? 'h2' : 'p',
        text: txt,
      });
    });
    return { id: uid('ch'), title: chTitle, blocks };
  });

  return {
    title,
    author,
    chapters:
      chapters.length > 0
        ? chapters
        : parsePlainTextOrMarkdown(doc.body?.textContent ?? raw, title),
  };
}

function base64ToUint8Array(base64: string): Uint8Array {
  const binary = atob(base64);
  const bytes = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) {
    bytes[i] = binary.charCodeAt(i);
  }
  return bytes;
}

export async function importDocumentFromBytes(
  fileName: string,
  bytes: Uint8Array,
  base64Override?: string
): Promise<LumaDocument> {
  const format = detectFormat(fileName);
  const cleanTitle =
    fileName.replace(/\.[^.]+$/, '').replace(/[_-]+/g, ' ').trim() || 'Documento importado';
  const [coverColor, coverAccent] = pickPalette(fileName);
  const now = Date.now();

  if (format === 'PDF') {
    let b64 = base64Override;
    if (!b64) {
      let bin = '';
      const chunk = 0x8000;
      for (let i = 0; i < bytes.length; i += chunk) {
        bin += String.fromCharCode(...bytes.subarray(i, i + chunk));
      }
      b64 = btoa(bin);
    }

    let parsedPdf: {
      title: string;
      author: string;
      numPages: number;
      chapters: ParsedChapter[];
    };
    try {
      parsedPdf = await parsePdfWithPdfJs(bytes, cleanTitle);
    } catch {
      parsedPdf = {
        title: cleanTitle,
        author: 'Archivo PDF local',
        numPages: 1,
        chapters: [
          {
            id: uid('pdfp'),
            title: 'Página 1',
            blocks: [{ id: uid('b'), type: 'p', text: 'Documento PDF importado.' }],
          },
        ],
      };
    }

    return {
      id: uid('doc'),
      title: parsedPdf.title,
      author: parsedPdf.author,
      format: 'PDF',
      badgeTag: `PDF · ${parsedPdf.numPages} págs`,
      coverColor,
      coverAccent,
      genre: 'Documento PDF',
      year: String(new Date().getFullYear()),
      synopsis: `Documento PDF original de ${parsedPdf.numPages} ${
        parsedPdf.numPages === 1 ? 'página' : 'páginas'
      } con renderizado fiel, texto seleccionable y anotación directa.`,
      totalWords: countWords(parsedPdf.chapters),
      currentUnit: 0,
      progressPercent: 0,
      lastOpenedAt: now,
      addedAt: now,
      pdfDataUrl: `data:application/pdf;base64,${b64}`,
      pdfPageCount: parsedPdf.numPages,
      chapters: parsedPdf.chapters,
    };
  }

  if (format === 'EPUB') {
    const parsed = await parseEpub(bytes, cleanTitle);
    return {
      id: uid('doc'),
      title: parsed.title,
      author: parsed.author,
      format: 'EPUB',
      badgeTag: 'EPUB',
      coverColor,
      coverAccent,
      genre: 'Libro EPUB',
      year: String(new Date().getFullYear()),
      synopsis: 'Libro EPUB importado con capítulos, imágenes, tablas y formato original.',
      totalWords: countWords(parsed.chapters),
      currentUnit: 0,
      progressPercent: 0,
      lastOpenedAt: now,
      addedAt: now,
      chapters: parsed.chapters,
    };
  }

  if (format === 'DOCX') {
    const parsed = await parseDocx(bytes, cleanTitle);
    return {
      id: uid('doc'),
      title: parsed.title,
      author: parsed.author,
      format: 'DOCX',
      badgeTag: 'DOCX · A4',
      coverColor,
      coverAccent,
      genre: 'Documento Word',
      year: String(new Date().getFullYear()),
      synopsis: 'Documento DOCX con títulos, negritas, listas, tablas e imágenes incrustadas.',
      totalWords: countWords(parsed.chapters),
      currentUnit: 0,
      progressPercent: 0,
      lastOpenedAt: now,
      addedAt: now,
      chapters: parsed.chapters,
    };
  }

  if (format === 'PPTX') {
    const parsed = await parsePptx(bytes, cleanTitle);
    return {
      id: uid('doc'),
      title: parsed.title,
      author: parsed.author,
      format: 'PPTX',
      badgeTag: `PPTX · ${parsed.slides.length} láminas`,
      coverColor,
      coverAccent,
      genre: 'Presentación',
      year: String(new Date().getFullYear()),
      synopsis: 'Presentación PowerPoint con láminas, tablas, imágenes y notas del presentador.',
      totalWords: countWords(parsed.chapters, parsed.slides),
      currentUnit: 0,
      progressPercent: 0,
      lastOpenedAt: now,
      addedAt: now,
      slides: parsed.slides,
      chapters: parsed.chapters,
    };
  }

  const text = new TextDecoder('utf-8').decode(bytes);
  if (format === 'FB2') {
    const parsed = parseFb2(text, cleanTitle);
    return {
      id: uid('doc'),
      title: parsed.title,
      author: parsed.author,
      format: 'FB2',
      badgeTag: 'FB2',
      coverColor,
      coverAccent,
      genre: 'Ficción FB2',
      year: String(new Date().getFullYear()),
      synopsis: 'Libro FictionBook 2 importado desde tu PC.',
      totalWords: countWords(parsed.chapters),
      currentUnit: 0,
      progressPercent: 0,
      lastOpenedAt: now,
      addedAt: now,
      chapters: parsed.chapters,
    };
  }

  const chapters = parsePlainTextOrMarkdown(text, cleanTitle);
  return {
    id: uid('doc'),
    title: cleanTitle,
    author: 'Texto local',
    format: 'TXT',
    badgeTag: 'TXT',
    coverColor,
    coverAccent,
    genre: 'Apuntes',
    year: String(new Date().getFullYear()),
    synopsis: 'Archivo de texto plano o Markdown importado a tu biblioteca Luma.',
    totalWords: countWords(chapters),
    currentUnit: 0,
    progressPercent: 0,
    lastOpenedAt: now,
    addedAt: now,
    chapters,
  };
}

export async function importFromBase64File(file: {
  name: string;
  base64: string;
}): Promise<LumaDocument> {
  const bytes = base64ToUint8Array(file.base64);
  return importDocumentFromBytes(file.name, bytes, file.base64);
}

export async function importFromBrowserFile(file: File): Promise<LumaDocument> {
  const buffer = await file.arrayBuffer();
  return importDocumentFromBytes(file.name, new Uint8Array(buffer));
}
