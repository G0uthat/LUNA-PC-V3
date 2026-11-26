export interface WordLookupResult {
  word: string;
  partOfSpeech?: string;
  definitions: string[];
  wikiTitle?: string;
  wikiSummary?: string;
  wikiUrl?: string;
  translation?: string;
  translationDir?: string;
  sourceLabel: string;
}

const lookupCache = new Map<string, WordLookupResult>();

function stripHtml(html: string): string {
  return html
    .replace(/<[^>]+>/g, ' ')
    .replace(/&nbsp;/g, ' ')
    .replace(/&quot;/g, '"')
    .replace(/&#39;/g, "'")
    .replace(/&amp;/g, '&')
    .replace(/\s+/g, ' ')
    .trim();
}

function cleanWordForLookup(raw: string): string {
  return raw
    .trim()
    .replace(/^[«»"“”'‘’¿¡(\[\s]+|[«»"“”'‘’?!.,;:)\]\s]+$/g, '')
    .trim();
}

// Lightweight local fallback glossary for common literary/study terms when offline
const OFFLINE_FALLBACK: Record<string, { pos: string; defs: string[] }> = {
  innecesarias: {
    pos: 'adjetivo (femenino plural)',
    defs: [
      'Que no son necesarias o indispensables para un fin determinado.',
      'Prescindibles, superfluas o que pueden omitirse sin afectar lo esencial.',
    ],
  },
  innecesaria: {
    pos: 'adjetivo',
    defs: [
      'Que no es necesaria o resulta prescindible.',
    ],
  },
  fragmentación: {
    pos: 'sustantivo femenino',
    defs: [
      'Acción y efecto de dividir algo en partes o fragmentos separados.',
      'En atención y lectura: interrupción continua que impide la concentración profunda.',
    ],
  },
  atención: {
    pos: 'sustantivo femenino',
    defs: [
      'Aplicación voluntaria de la actividad mental o de los sentidos a un estímulo u objeto.',
    ],
  },
  arquitectura: {
    pos: 'sustantivo femenino',
    defs: [
      'Arte y técnica de proyectar y diseñar estructuras físicas o digitales.',
      'Estructura lógica y organización interna de un sistema o espacio.',
    ],
  },
  marginalia: {
    pos: 'sustantivo',
    defs: [
      'Anotaciones, glosas o comentarios escritos en los márgenes de un libro o manuscrito.',
    ],
  },
};

export async function lookupWordMeaning(
  rawText: string,
  options?: { enableWiki?: boolean; engine?: 'google' | 'local' }
): Promise<WordLookupResult> {
  const cleaned = cleanWordForLookup(rawText);
  const key = `${cleaned.toLowerCase()}__${options?.enableWiki !== false ? 'w1' : 'w0'}`;
  const cached = lookupCache.get(key);
  if (cached) return cached;

  const isSingleOrShort = cleaned.split(/\s+/).length <= 3;
  const primaryTerm = cleaned.split(/\s+/)[0]?.toLowerCase() ?? '';
  const encoded = encodeURIComponent(cleaned.toLowerCase());
  const encodedTitle = encodeURIComponent(cleaned);

  const definitions: string[] = [];
  let partOfSpeech: string | undefined;
  let wikiTitle: string | undefined;
  let wikiSummary: string | undefined;
  let wikiUrl: string | undefined;
  let translation: string | undefined;
  let translationDir: string | undefined;
  let sourceLabel = 'Diccionario contextual';

  const tasks: Promise<void>[] = [];

  // 1. Wiktionary ES REST definition (instant, CORS-friendly)
  if (isSingleOrShort && cleaned.length >= 2) {
    tasks.push(
      fetch(`https://es.wiktionary.org/api/rest_v1/page/definition/${encoded}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          const langEntries = data?.es ?? data?.en ?? (data ? Object.values(data)[0] : null);
          if (Array.isArray(langEntries) && langEntries.length > 0) {
            for (const entry of langEntries.slice(0, 2)) {
              if (!partOfSpeech && entry?.partOfSpeech) {
                partOfSpeech = String(entry.partOfSpeech);
              }
              const defs = Array.isArray(entry?.definitions) ? entry.definitions : [];
              for (const d of defs.slice(0, 3)) {
                const txt = stripHtml(String(d?.definition ?? ''));
                if (txt && !definitions.includes(txt)) {
                  definitions.push(txt);
                }
              }
            }
            if (definitions.length > 0) sourceLabel = 'Wikcionario';
          }
        })
        .catch(() => undefined)
    );
  }

  // 2. Wikipedia ES REST instant summary
  if (options?.enableWiki !== false && cleaned.length >= 2) {
    tasks.push(
      fetch(`https://es.wikipedia.org/api/rest_v1/page/summary/${encodedTitle}`)
        .then((r) => (r.ok ? r.json() : null))
        .then((data) => {
          if (data?.extract && data.type !== 'https://mediawiki.org/wiki/HyperSwitch/errors/not_found') {
            wikiTitle = String(data.title || cleaned);
            wikiSummary = String(data.extract);
            wikiUrl = data?.content_urls?.desktop?.page;
          }
        })
        .catch(() => undefined)
    );
  }

  // 3. Free instant translation (auto-detect EN<->ES heuristic)
  const looksEnglish = /^[a-zA-Z\s'-]+$/.test(cleaned) && !/[áéíóúñü]/i.test(cleaned);
  const langpair = looksEnglish ? 'en|es' : 'es|en';
  tasks.push(
    fetch(`https://api.mymemory.translated.net/get?q=${encodeURIComponent(cleaned.slice(0, 260))}&langpair=${langpair}`)
      .then((r) => (r.ok ? r.json() : null))
      .then((data) => {
        const translated = String(data?.responseData?.translatedText ?? '').trim();
        if (translated && translated.toLowerCase() !== cleaned.toLowerCase()) {
          translation = translated;
          translationDir = looksEnglish ? 'Inglés → Español' : 'Español → Inglés';
        }
      })
      .catch(() => undefined)
  );

  await Promise.allSettled(tasks);

  // 4. Fallback to English Free Dictionary API if still no definition and looks English
  if (definitions.length === 0 && isSingleOrShort && looksEnglish) {
    try {
      const r = await fetch(`https://api.dictionaryapi.dev/api/v2/entries/en/${encoded}`);
      if (r.ok) {
        const data = await r.json();
        const first = Array.isArray(data) ? data[0] : null;
        const meaning = first?.meanings?.[0];
        if (meaning) {
          partOfSpeech = partOfSpeech || meaning.partOfSpeech;
          for (const d of (meaning.definitions ?? []).slice(0, 3)) {
            if (d?.definition) definitions.push(String(d.definition));
          }
          if (definitions.length > 0) sourceLabel = 'Dictionary API';
        }
      }
    } catch {
      // ignore
    }
  }

  // 5. Offline local glossary fallback for common Spanish words
  if (definitions.length === 0) {
    const offlineHit = OFFLINE_FALLBACK[cleaned.toLowerCase()] ?? OFFLINE_FALLBACK[primaryTerm];
    if (offlineHit) {
      partOfSpeech = partOfSpeech || offlineHit.pos;
      definitions.push(...offlineHit.defs);
      sourceLabel = 'Glosario local Luma';
    }
  }

  const result: WordLookupResult = {
    word: cleaned || rawText.trim(),
    partOfSpeech,
    definitions,
    wikiTitle,
    wikiSummary,
    wikiUrl,
    translation,
    translationDir,
    sourceLabel,
  };

  lookupCache.set(key, result);
  return result;
}
