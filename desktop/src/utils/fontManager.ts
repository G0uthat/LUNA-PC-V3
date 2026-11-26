import {
  deleteCustomFontRecord,
  loadAllCustomFonts,
  saveCustomFontRecord,
  StoredCustomFont,
} from './notebookStorage';

export interface FontCatalogEntry {
  id: string;
  family: string;
  category: 'custom' | 'sans' | 'serif' | 'display' | 'handwriting' | 'mono';
  isCustom?: boolean;
  fileName?: string;
}

/**
 * 29+ Free Open Font License (OFL) Google Fonts curated for Luma Notebooks,
 * plus Luma's built-in editorial faces.
 */
export const GOOGLE_LIBRARY_FONTS: FontCatalogEntry[] = [
  { id: 'roboto', family: 'Roboto', category: 'sans' },
  { id: 'open_sans', family: 'Open Sans', category: 'sans' },
  { id: 'lato', family: 'Lato', category: 'sans' },
  { id: 'montserrat', family: 'Montserrat', category: 'sans' },
  { id: 'poppins', family: 'Poppins', category: 'sans' },
  { id: 'inter', family: 'Inter', category: 'sans' },
  { id: 'nunito', family: 'Nunito', category: 'sans' },
  { id: 'raleway', family: 'Raleway', category: 'sans' },
  { id: 'playfair_display', family: 'Playfair Display', category: 'serif' },
  { id: 'merriweather', family: 'Merriweather', category: 'serif' },
  { id: 'lora', family: 'Lora', category: 'serif' },
  { id: 'oswald', family: 'Oswald', category: 'display' },
  { id: 'bebas_neue', family: 'Bebas Neue', category: 'display' },
  { id: 'anton', family: 'Anton', category: 'display' },
  { id: 'pacifico', family: 'Pacifico', category: 'handwriting' },
  { id: 'dancing_script', family: 'Dancing Script', category: 'handwriting' },
  { id: 'lobster', family: 'Lobster', category: 'display' },
  { id: 'caveat', family: 'Caveat', category: 'handwriting' },
  { id: 'satisfy', family: 'Satisfy', category: 'handwriting' },
  { id: 'great_vibes', family: 'Great Vibes', category: 'handwriting' },
  { id: 'source_serif_4', family: 'Source Serif 4', category: 'serif' },
  { id: 'pt_serif', family: 'PT Serif', category: 'serif' },
  { id: 'fira_sans', family: 'Fira Sans', category: 'sans' },
  { id: 'work_sans', family: 'Work Sans', category: 'sans' },
  { id: 'quicksand', family: 'Quicksand', category: 'sans' },
  { id: 'comfortaa', family: 'Comfortaa', category: 'display' },
  { id: 'permanent_marker', family: 'Permanent Marker', category: 'handwriting' },
  { id: 'abril_fatface', family: 'Abril Fatface', category: 'display' },
  { id: 'josefin_sans', family: 'Josefin Sans', category: 'sans' },
  { id: 'plus_jakarta_sans', family: 'Plus Jakarta Sans', category: 'sans' },
  { id: 'literata', family: 'Literata', category: 'serif' },
  { id: 'jetbrains_mono', family: 'JetBrains Mono', category: 'mono' },
];

const loadedGoogleFamilies = new Set<string>([
  'Plus Jakarta Sans',
  'Literata',
  'Caveat',
  'JetBrains Mono',
]);
let catalogStylesheetInjected = false;

/**
 * Resolves legacy shorthand font IDs ('sans', 'serif', 'mono', 'hand') or
 * full Google/Custom font names into a valid CSS font-family stack.
 */
export function resolveFontFamilyCss(fontKey: string): string {
  switch (fontKey) {
    case 'sans':
      return '"Plus Jakarta Sans", system-ui, sans-serif';
    case 'serif':
      return '"Literata", Georgia, serif';
    case 'mono':
      return '"JetBrains Mono", monospace';
    case 'hand':
      return '"Caveat", cursive';
    default: {
      const clean = fontKey.replace(/["']/g, '').trim();
      if (!clean) return '"Plus Jakarta Sans", system-ui, sans-serif';
      ensureGoogleFontLoaded(clean);
      const entry = GOOGLE_LIBRARY_FONTS.find(
        (f) => f.family.toLowerCase() === clean.toLowerCase()
      );
      const fallback =
        entry?.category === 'serif'
          ? 'Georgia, serif'
          : entry?.category === 'handwriting'
            ? 'cursive'
            : entry?.category === 'mono'
              ? 'monospace'
              : 'sans-serif';
      return `"${clean}", ${fallback}`;
    }
  }
}

/**
 * Injects a single batched Google Fonts stylesheet for all 29 OFL library fonts
 * with display=swap so previews render accurately in the font selector.
 */
export function loadAllLibraryFontsForPreview(): void {
  if (typeof document === 'undefined' || catalogStylesheetInjected) return;
  catalogStylesheetInjected = true;

  const familiesToLoad = GOOGLE_LIBRARY_FONTS.filter(
    (f) => !loadedGoogleFamilies.has(f.family)
  );
  if (familiesToLoad.length === 0) return;

  // Split into 2 clean Google Fonts v2 requests to keep URL lengths well below browser limits
  const midpoint = Math.ceil(familiesToLoad.length / 2);
  const batches = [familiesToLoad.slice(0, midpoint), familiesToLoad.slice(midpoint)];

  batches.forEach((batch, idx) => {
    const id = `luma-google-fonts-batch-${idx}`;
    if (document.getElementById(id)) return;
    const query = batch
      .map((f) => `family=${encodeURIComponent(f.family).replace(/%20/g, '+')}`)
      .join('&');
    const link = document.createElement('link');
    link.id = id;
    link.rel = 'stylesheet';
    link.href = `https://fonts.googleapis.com/css2?${query}&display=swap`;
    document.head.appendChild(link);
    batch.forEach((f) => loadedGoogleFamilies.add(f.family));
  });
}

export function ensureGoogleFontLoaded(family: string): void {
  if (typeof document === 'undefined') return;
  if (loadedGoogleFamilies.has(family)) return;
  const entry = GOOGLE_LIBRARY_FONTS.find(
    (f) => f.family.toLowerCase() === family.toLowerCase()
  );
  if (!entry) return;
  loadedGoogleFamilies.add(entry.family);
  const link = document.createElement('link');
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?family=${encodeURIComponent(entry.family).replace(/%20/g, '+')}:ital,wght@0,400;0,700;1,400;1,700&display=swap`;
  document.head.appendChild(link);
}

const registeredCustomFonts = new Set<string>();

/**
 * Registers a StoredCustomFont via the native FontFace API so it immediately
 * works on both DOM text boxes and HTML5 Canvas exports.
 */
export async function registerCustomFontFace(font: StoredCustomFont): Promise<boolean> {
  if (typeof FontFace === 'undefined' || typeof document === 'undefined') return false;
  if (registeredCustomFonts.has(font.name)) return true;
  try {
    const face = new FontFace(font.name, `url(${font.dataUrl})`);
    const loaded = await face.load();
    document.fonts.add(loaded);
    registeredCustomFonts.add(font.name);
    return true;
  } catch {
    return false;
  }
}

/**
 * Rehydrates all previously imported user fonts from IndexedDB at app boot.
 */
export async function hydrateCustomFonts(): Promise<FontCatalogEntry[]> {
  const stored = await loadAllCustomFonts();
  const entries: FontCatalogEntry[] = [];
  for (const font of stored) {
    await registerCustomFontFace(font);
    entries.push({
      id: font.id,
      family: font.name,
      category: 'custom',
      isCustom: true,
      fileName: font.fileName,
    });
  }
  return entries;
}

/**
 * Imports a user-provided .ttf, .otf, .woff, or .woff2 file, registers it with
 * FontFace, persists it in IndexedDB, and returns the catalog entry.
 */
export async function importCustomFontFile(file: File): Promise<FontCatalogEntry> {
  const ext = file.name.split('.').pop()?.toLowerCase() || '';
  if (!['ttf', 'otf', 'woff', 'woff2'].includes(ext)) {
    throw new Error('Formato no soportado. Usa .ttf, .otf, .woff o .woff2.');
  }

  const baseName = file.name
    .replace(/\.[^.]+$/, '')
    .replace(/[_-]+/g, ' ')
    .replace(/\s+/g, ' ')
    .trim();
  const fontName = baseName || `Tipografía ${Date.now().toString(36)}`;

  const dataUrl = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result || ''));
    reader.onerror = () => reject(new Error('No se pudo leer el archivo de tipografía.'));
    reader.readAsDataURL(file);
  });

  const record: StoredCustomFont = {
    id: `cfont_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 5)}`,
    name: fontName,
    fileName: file.name,
    mimeType: file.type || `font/${ext}`,
    dataUrl,
    addedAt: Date.now(),
  };

  const ok = await registerCustomFontFace(record);
  if (!ok) {
    throw new Error('El navegador no pudo cargar esta fuente. Verifica que el archivo no esté dañado.');
  }

  await saveCustomFontRecord(record);
  return {
    id: record.id,
    family: record.name,
    category: 'custom',
    isCustom: true,
    fileName: record.fileName,
  };
}

export async function removeCustomFont(id: string): Promise<void> {
  await deleteCustomFontRecord(id);
}
