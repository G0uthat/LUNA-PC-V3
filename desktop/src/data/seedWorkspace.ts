import {
  CanvasObject,
  LumaDocument,
  LumaNotebook,
  LumaWorkspaceState,
  NotebookPageSize,
  NotebookPaperPattern,
  SagaPlaylist,
} from '../types';

export function createNotebookFromTemplate(
  template: 'blank' | 'ruled' | 'grid' | 'cornell' | 'concept_map' | 'comparison' | 'planner',
  title?: string,
  pageSize: NotebookPageSize = 'A4'
): LumaNotebook {
  const id = `nb_${Date.now().toString(36)}_${Math.random().toString(36).slice(2, 6)}`;
  const now = Date.now();
  const layers = [
    { id: 'underlay', name: 'Resaltador', visible: true, locked: false },
    { id: 'content', name: 'Texto y Formas', visible: true, locked: false },
    { id: 'ink', name: 'Tinta y Dibujo', visible: true, locked: false },
  ];

  let pattern: NotebookPaperPattern = 'blank';
  let objects: CanvasObject[] = [];
  let defaultTitle = 'Cuaderno sin título';
  let subtitle = 'Lienzo libre';
  let coverColor = '#2B64F5';

  if (template === 'ruled') {
    pattern = 'ruled';
    defaultTitle = 'Apuntes rayados';
    subtitle = 'Papel rayado editorial';
    coverColor = '#257A5E';
  } else if (template === 'grid') {
    pattern = 'grid';
    defaultTitle = 'Cuaderno técnico';
    subtitle = 'Cuadrícula milimetrada';
    coverColor = '#5B4BDB';
  } else if (template === 'cornell') {
    pattern = 'cornell';
    defaultTitle = 'Método Cornell · Estudio';
    subtitle = 'Preguntas clave, apuntes y resumen';
    coverColor = '#C2642B';
    objects = [
      {
        id: `${id}_title`,
        kind: 'text',
        layerId: 'content',
        x: 56,
        y: 38,
        w: 888,
        h: 72,
        opacity: 1,
        text: title || 'Tema de estudio — Método Cornell',
        fontFamily: 'sans',
        fontSize: 22,
        bold: true,
        color: '#1D5BFF',
        fillColor: '#FFFFFF',
        borderColor: '#1D5BFF',
        align: 'left',
        isBanner: true,
      },
      {
        id: `${id}_cues`,
        kind: 'text',
        layerId: 'content',
        x: 56,
        y: 138,
        w: 245,
        h: 220,
        opacity: 1,
        text: 'PREGUNTAS CLAVE\n\n• ¿Cuál es la tesis central?\n• ¿Qué conceptos se conectan?\n• ¿Qué ejemplos respaldan la idea?',
        fontFamily: 'sans',
        fontSize: 13,
        bold: false,
        color: '#332920',
        fillColor: '#FFFBF2',
        borderColor: '#E7DBC6',
        align: 'left',
      },
      {
        id: `${id}_notes`,
        kind: 'text',
        layerId: 'content',
        x: 325,
        y: 138,
        w: 618,
        h: 340,
        opacity: 1,
        text: 'APUNTES PRINCIPALES\n\n1. Divide cada capítulo en bloques conceptuales claros.\n2. Relaciona tus lecturas del Lector con esquemas visuales en este lienzo.\n3. Resalta términos clave con color ámbar o azul cobalto para repaso rápido.',
        fontFamily: 'serif',
        fontSize: 14,
        bold: false,
        color: '#1A2233',
        fillColor: '#FFFFFF',
        borderColor: '#E3E8F2',
        align: 'left',
      },
      {
        id: `${id}_summary`,
        kind: 'sticky',
        layerId: 'content',
        x: 56,
        y: 520,
        w: 888,
        h: 130,
        opacity: 1,
        text: 'RESUMEN EN 3 LÍNEAS\nSintetiza con tus propias palabras la conclusión más importante de esta sesión de estudio.',
        bgColor: '#FEF3C7',
        textColor: '#451A03',
      },
    ];
  } else if (template === 'concept_map') {
    pattern = 'dotted';
    defaultTitle = 'Mapa Conceptual Visual';
    subtitle = 'Idea central y nodos conectados';
    coverColor = '#5B4BDB';
    objects = [
      {
        id: `${id}_center`,
        kind: 'text',
        layerId: 'content',
        x: 340,
        y: 255,
        w: 320,
        h: 92,
        opacity: 1,
        text: 'IDEA CENTRAL\nArquitectura de Conocimiento',
        fontFamily: 'sans',
        fontSize: 17,
        bold: true,
        color: '#FFFFFF',
        fillColor: '#2B64F5',
        borderColor: '#1D4AC0',
        align: 'center',
        isBanner: true,
      },
      {
        id: `${id}_n1`,
        kind: 'text',
        layerId: 'content',
        x: 68,
        y: 92,
        w: 250,
        h: 94,
        opacity: 1,
        text: '01. Lectura Activa\nSubrayados y marginalia directa',
        fontFamily: 'sans',
        fontSize: 13,
        bold: true,
        color: '#1D2D24',
        fillColor: '#ECFDF5',
        borderColor: '#34D399',
        align: 'left',
      },
      {
        id: `${id}_n2`,
        kind: 'text',
        layerId: 'content',
        x: 682,
        y: 92,
        w: 250,
        h: 94,
        opacity: 1,
        text: '02. Síntesis Visual\nDiagramas, flechas y capas',
        fontFamily: 'sans',
        fontSize: 13,
        bold: true,
        color: '#241D30',
        fillColor: '#F5F3FF',
        borderColor: '#A78BFA',
        align: 'left',
      },
      {
        id: `${id}_n3`,
        kind: 'text',
        layerId: 'content',
        x: 68,
        y: 448,
        w: 250,
        h: 94,
        opacity: 1,
        text: '03. Repaso Espaciado\nResúmenes por capítulo',
        fontFamily: 'sans',
        fontSize: 13,
        bold: true,
        color: '#3B2B1C',
        fillColor: '#FFFBEB',
        borderColor: '#F59E0B',
        align: 'left',
      },
      {
        id: `${id}_n4`,
        kind: 'text',
        layerId: 'content',
        x: 682,
        y: 448,
        w: 250,
        h: 94,
        opacity: 1,
        text: '04. Exportación HD\nPNG y PDF listos para compartir',
        fontFamily: 'sans',
        fontSize: 13,
        bold: true,
        color: '#341D25',
        fillColor: '#FFF1F2',
        borderColor: '#FB7185',
        align: 'left',
      },
      {
        id: `${id}_a1`,
        kind: 'shape',
        layerId: 'content',
        shape: 'arrow',
        x: 280,
        y: 184,
        w: 100,
        h: 72,
        opacity: 0.85,
        strokeColor: '#257A5E',
        fillColor: 'transparent',
        strokeWidth: 2.5,
      },
      {
        id: `${id}_a2`,
        kind: 'shape',
        layerId: 'content',
        shape: 'arrow',
        x: 620,
        y: 184,
        w: 100,
        h: 72,
        opacity: 0.85,
        strokeColor: '#5B4BDB',
        fillColor: 'transparent',
        strokeWidth: 2.5,
      },
    ];
  } else if (template === 'comparison') {
    pattern = 'grid';
    defaultTitle = 'Tabla Comparativa';
    subtitle = 'Matriz editable de análisis';
    coverColor = '#0D9488';
    objects = [
      {
        id: `${id}_banner`,
        kind: 'text',
        layerId: 'content',
        x: 60,
        y: 44,
        w: 880,
        h: 68,
        opacity: 1,
        text: title || 'Cuadro Comparativo de Estudio',
        fontFamily: 'sans',
        fontSize: 22,
        bold: true,
        color: '#0F766E',
        fillColor: '#F0FDFA',
        borderColor: '#0D9488',
        align: 'left',
        isBanner: true,
      },
      {
        id: `${id}_tbl`,
        kind: 'table',
        layerId: 'content',
        x: 60,
        y: 145,
        w: 880,
        h: 280,
        opacity: 1,
        rows: 4,
        cols: 3,
        headerBg: '#CCFBF1',
        borderColor: '#0D9488',
        cells: [
          'Criterio',
          'Enfoque A',
          'Enfoque B',
          'Ventaja clave',
          'Lectura fluida adaptable',
          'Fidelidad de hoja A4 / 16:9',
          'Caso de uso',
          'Novelas y ensayos EPUB',
          'Contratos, diapositivas y PDF',
          'Anotación',
          'Subrayado y notas marginales',
          'Dibujo libre y firma directa',
        ],
      },
    ];
  } else if (template === 'planner') {
    pattern = 'dotted';
    defaultTitle = 'Planner Semanal · Luma';
    subtitle = 'Prioridades, horarios y notas';
    coverColor = '#7C3AED';
    objects = [
      {
        id: `${id}_pl_title`,
        kind: 'text',
        layerId: 'content',
        x: 56,
        y: 38,
        w: 888,
        h: 68,
        opacity: 1,
        text: title || 'PLANNER SEMANAL · OBJETIVOS',
        fontFamily: 'Montserrat',
        fontSize: 22,
        bold: true,
        color: '#5B21B6',
        fillColor: '#F5F3FF',
        borderColor: '#7C3AED',
        align: 'left',
        isBanner: true,
      },
      {
        id: `${id}_pl_tbl`,
        kind: 'table',
        layerId: 'content',
        x: 56,
        y: 130,
        w: 888,
        h: 340,
        opacity: 1,
        rows: 5,
        cols: 3,
        headerBg: '#EDE9FE',
        borderColor: '#8B5CF6',
        cells: [
          'Día',
          'Tareas prioritarias',
          'Estado / Nota',
          'Lunes',
          'Lectura de capítulo 1 y resumen',
          'En progreso',
          'Martes',
          'Mapa conceptual y revisión',
          'Pendiente',
          'Miércoles',
          'Práctica y ejercicios clave',
          'Pendiente',
          'Jueves / Viernes',
          'Repaso general y entrega final',
          'Meta semanal',
        ],
      },
      {
        id: `${id}_pl_note`,
        kind: 'sticky',
        layerId: 'content',
        x: 56,
        y: 500,
        w: 420,
        h: 140,
        opacity: 1,
        text: 'PRIORIDAD #1\nEnfócate en completar el bloque más importante antes del mediodía.',
        bgColor: '#FEF3C7',
        textColor: '#451A03',
      },
      {
        id: `${id}_pl_note2`,
        kind: 'sticky',
        layerId: 'content',
        x: 524,
        y: 500,
        w: 420,
        h: 140,
        opacity: 1,
        text: 'HÁBITOS & RECORDATORIOS\n• 30 min de lectura\n• Hidratación y descansos visuales',
        bgColor: '#DCFCE7',
        textColor: '#14532D',
      },
    ];
  }

  return {
    id,
    title: title || defaultTitle,
    subtitle,
    coverColor,
    pageSize,
    updatedAt: now,
    layers,
    activePageIndex: 0,
    pages: [
      {
        id: `${id}_p1`,
        title: 'Página 1',
        pattern,
        backgroundColor: '#FFFFFF',
        objects,
      },
    ],
  };
}

export function createSeedWorkspace(): LumaWorkspaceState {
  const now = Date.now();

  const docs: LumaDocument[] = [
    {
      id: 'doc_atlas_epub',
      title: 'El Atlas de la Lectura Profunda',
      author: 'Clara Valdés',
      format: 'EPUB',
      badgeTag: 'EPUB',
      coverColor: '#2B64F5',
      coverAccent: '#1D4AC0',
      genre: 'Ensayo y Diseño',
      year: '2026',
      synopsis:
        'Un recorrido sereno por la tipografía editorial, la marginalia y el diseño de espacios silenciosos para leer y estudiar en pantalla.',
      totalWords: 486,
      currentUnit: 0,
      progressPercent: 0.34,
      pinned: true,
      lastOpenedAt: now,
      addedAt: now - 86_400_000 * 3,
      chapters: [
        {
          id: 'atlas_ch1',
          title: 'I. La arquitectura del silencio lector',
          blocks: [
            { id: 'a1_1', type: 'h1', text: 'I. La arquitectura del silencio lector' },
            {
              id: 'a1_2',
              type: 'p',
              text: 'Leer profundamente en una pantalla exige diseñar un refugio contra la fragmentación. Cuando desaparecen las barras innecesarias, la mente recupera su ritmo natural de atención sostenida y cada párrafo respira como en una página impresa.',
            },
            {
              id: 'a1_3',
              type: 'p',
              text: 'En escritorio, la amplitud del monitor permite algo extraordinario: sostener el texto a la izquierda mientras un cuaderno visual recibe esquemas, conexiones y resúmenes al costado, sin cambiar de ventana ni romper el hilo de pensamiento.',
            },
            {
              id: 'a1_4',
              type: 'quote',
              text: '«Un buen espacio de lectura no compite por tu mirada; sostiene el texto con la misma discreción con la que una mesa sostiene un cuaderno abierto.»',
            },
            {
              id: 'a1_5',
              type: 'p',
              text: 'Selecciona cualquier palabra o frase de esta página —como bibliografía, mnemotecnia, serendipia o cartografía— para resaltarla en color editorial, guardar una nota marginal o consultarla en Wikipedia y la RAE al instante.',
            },
          ],
        },
        {
          id: 'atlas_ch2',
          title: 'II. Tipografía, ritmo y memoria visual',
          blocks: [
            { id: 'a2_1', type: 'h1', text: 'II. Tipografía, ritmo y memoria visual' },
            {
              id: 'a2_2',
              type: 'p',
              text: 'La elección tipográfica modifica silenciosamente la velocidad de comprensión y la fatiga ocular. Las fuentes serif contemporáneas como Literata guían el movimiento horizontal de los ojos a lo largo de líneas extensas, mientras que familias humanistas como Lexend amplían la claridad entre caracteres.',
            },
            { id: 'a2_3', type: 'h2', text: 'Ajustes que transforman la página' },
            {
              id: 'a2_4',
              type: 'p',
              text: 'El interlineado generoso evita que la mirada salte por error a la línea equivocada. Los márgenes bien proporcionados crean un marco de reposo periférico y los 17 temas suaves de Luma —desde Crema cálida hasta Noche cálida y AMOLED— protegen la vista en sesiones largas.',
            },
            {
              id: 'a2_5',
              type: 'list',
              text: 'Activa la vista en doble página cuando trabajes en monitores amplios (1440p o 4K).',
            },
            {
              id: 'a2_6',
              type: 'list',
              text: 'Pulsa Ctrl+K en cualquier momento para saltar entre libros, cuadernos, sagas y temas.',
            },
          ],
        },
        {
          id: 'atlas_ch3',
          title: 'III. El arte de anotar en los márgenes',
          blocks: [
            { id: 'a3_1', type: 'h1', text: 'III. El arte de anotar en los márgenes' },
            {
              id: 'a3_2',
              type: 'p',
              text: 'Durante siglos, los eruditos convirtieron sus volúmenes en conversaciones vivas mediante la marginalia: flechas, llaves, definiciones rápidas y esquemas trazados directamente sobre las páginas. Anotar no ensucia un libro; lo transforma en memoria externa.',
            },
            {
              id: 'a3_3',
              type: 'quote',
              text: '«Leer sin dialogar con el texto es pasear por una biblioteca sin abrir las ventanas.»',
            },
            {
              id: 'a3_4',
              type: 'p',
              text: 'Activa el modo Dibujo en la barra del lector para trazar subrayados a mano alzada o firmar sobre cualquier hoja, y abre Vista Dividida para tomar apuntes estilo Canva en un Cuaderno en paralelo.',
            },
          ],
        },
      ],
    },
    {
      id: 'doc_manhwa_shadow',
      title: 'Shadow Blade · Ep. 1',
      author: 'Studio Han',
      format: 'PDF',
      badgeTag: 'Manhwa OCR',
      coverColor: '#C44672',
      coverAccent: '#881337',
      genre: 'Manhwa Acción',
      year: '2026',
      synopsis:
        'Episodio piloto de lectura vertical continua con detección OCR y traducción instantánea inglés → español sobre cada globo de diálogo.',
      totalWords: 184,
      currentUnit: 0,
      progressPercent: 0.5,
      pinned: true,
      lastOpenedAt: now - 3_600_000,
      addedAt: now - 86_400_000 * 2,
      chapters: [
        {
          id: 'mh_ch1',
          title: 'Episodio 01 · The Northern Gate',
          blocks: [
            { id: 'mh_b1', type: 'h1', text: 'Episodio 01 · The Northern Gate' },
            {
              id: 'mh_b2',
              type: 'p',
              text: 'Usa el interruptor Traducir EN→ES en la barra superior para ver la traducción superpuesta en los globos de diálogo.',
            },
          ],
        },
      ],
      manhwaPanels: [
        {
          id: 'panel_1',
          episodeLabel: 'EPISODE 01 · THE NORTHERN GATE',
          gradientFrom: '#0F172A',
          gradientTo: '#1E3A8A',
          accentColor: '#60A5FA',
          sceneCaption: 'Puerta antigua bajo tormenta nocturna',
          bubbles: [
            {
              id: 'b1',
              x: 7,
              y: 14,
              w: 44,
              h: 24,
              original: 'WAIT! DO NOT OPEN THAT ANCIENT GATE!',
              translated: '¡ESPERA! ¡NO ABRAS ESA PUERTA ANTIGUA!',
            },
            {
              id: 'b2',
              x: 47,
              y: 56,
              w: 46,
              h: 26,
              original: 'THE SHADOW BLADE IS AWAKENING INSIDE THE TOWER!',
              translated: '¡LA HOJA SOMBRÍA ESTÁ DESPERTANDO EN LA TORRE!',
            },
          ],
        },
        {
          id: 'panel_2',
          episodeLabel: 'EPISODE 01 · AWAKENING',
          gradientFrom: '#1E1B4B',
          gradientTo: '#7F1D1D',
          accentColor: '#F87171',
          sceneCaption: 'Relámpagos azules sobre la muralla del norte',
          bubbles: [
            {
              id: 'b3',
              x: 8,
              y: 16,
              w: 46,
              h: 25,
              original: 'ONLY A TRUE GUARDIAN CAN HOLD THIS POWER.',
              translated: 'SOLO UN VERDADERO GUARDIÁN PUEDE CONTENER ESTE PODER.',
            },
            {
              id: 'b4',
              x: 46,
              y: 58,
              w: 46,
              h: 24,
              original: 'I WILL NOT RUN AWAY ANYMORE. THIS IS MY FIGHT!',
              translated: 'YA NO HUIRÉ MÁS. ¡ESTA ES MI BATALLA!',
            },
          ],
        },
      ],
    },
    {
      id: 'doc_pptx_luma',
      title: 'Presentación Luma · Trabajo y Estudio',
      author: 'Equipo Luma',
      format: 'PPTX',
      badgeTag: 'PPTX 16:9',
      coverColor: '#D97706',
      coverAccent: '#92400E',
      genre: 'Presentación',
      year: '2026',
      synopsis:
        'Láminas panorámicas 16:9 con notas del presentador, vista de texto fluido y anotación directa sobre cada diapositiva.',
      totalWords: 220,
      currentUnit: 0,
      progressPercent: 0.25,
      lastOpenedAt: now - 7_200_000,
      addedAt: now - 86_400_000 * 4,
      slides: [
        {
          id: 'sl1',
          title: 'Luma Desktop · Trabajo y Estudio',
          subtitle: 'Biblioteca visual, lector multiformato y cuadernos en un solo lugar.',
          bgColor: '#16243D',
          textColor: '#F8FAFC',
          accentColor: '#F59E0B',
          bullets: [
            'Navegación lateral estilo Notion adaptable a cualquier resolución de PC.',
            'Estudio de Cuadernos estilo Canva con capas, formas, tablas y trazos.',
            '17 temas suaves calibrados para descanso visual diurno y nocturno.',
          ],
          notes: 'Nota del presentador: explica cómo alternar entre vista de lámina 16:9 y lectura fluida.',
        },
        {
          id: 'sl2',
          title: 'Flujo en Pantalla Dividida',
          subtitle: 'Lee a la izquierda, construye esquemas visuales a la derecha.',
          bgColor: '#FFFCF6',
          textColor: '#1A2233',
          accentColor: '#2B64F5',
          bullets: [
            'Abre un EPUB, PDF o DOCX junto a un Cuaderno Cornell o Mapa Conceptual.',
            'Usa Ctrl+K para buscar cualquier libro, saga, cuaderno o acción.',
            'Exporta tus láminas y apuntes directamente a PNG o PDF.',
          ],
          notes: 'En pantallas mayores a 1120px el botón Vista Dividida aparece automáticamente.',
        },
        {
          id: 'sl3',
          title: 'Anotación y Firma Directa',
          subtitle: 'Sin imprimir papel ni salir de tu escritorio.',
          bgColor: '#EEF4F0',
          textColor: '#1D2D24',
          accentColor: '#257A5E',
          bullets: [
            'Activa el lápiz o resaltador sobre documentos DOCX, PDF o diapositivas.',
            'Tus trazos se guardan automáticamente vinculados a cada unidad.',
            'Cambia entre temas sin perder legibilidad en gráficos ni textos.',
          ],
          notes: 'Ideal para revisión de entregables y estudio de presentaciones académicas.',
        },
      ],
      chapters: [
        {
          id: 'ppt_c1',
          title: 'Diapositiva 1 · Luma Desktop',
          blocks: [
            { id: 'pc1', type: 'h1', text: 'Luma Desktop · Trabajo y Estudio' },
            { id: 'pc2', type: 'list', text: 'Navegación lateral estilo Notion adaptable a cualquier resolución.' },
            { id: 'pc3', type: 'list', text: 'Estudio de Cuadernos estilo Canva con capas, formas y trazos.' },
          ],
        },
        {
          id: 'ppt_c2',
          title: 'Diapositiva 2 · Flujo en Pantalla Dividida',
          blocks: [
            { id: 'pc4', type: 'h1', text: 'Flujo en Pantalla Dividida' },
            { id: 'pc5', type: 'p', text: 'Abre cualquier libro o documento junto a tu cuaderno visual de estudio.' },
          ],
        },
      ],
    },
    {
      id: 'doc_docx_arch',
      title: 'Cuaderno de Arquitectura Minimalista',
      author: 'Martín Soler',
      format: 'DOCX',
      badgeTag: 'DOCX · A4',
      coverColor: '#0D9488',
      coverAccent: '#115E59',
      genre: 'Técnico / A4',
      year: '2026',
      synopsis:
        'Documento técnico con proporción de hoja A4 y bloque de conformidad listo para revisión profesional y firma a mano alzada.',
      totalWords: 265,
      currentUnit: 0,
      progressPercent: 0.15,
      lastOpenedAt: now - 14_400_000,
      addedAt: now - 86_400_000 * 5,
      chapters: [
        {
          id: 'docx_ch1',
          title: '1. Principios de Diseño Táctil Minimalista',
          blocks: [
            { id: 'd1', type: 'h1', text: '1. Principios de Diseño Táctil Minimalista' },
            {
              id: 'd2',
              type: 'p',
              text: 'El minimalismo táctil une dos mundos complementarios: la calma silenciosa de las superficies limpias y la claridad física de controles bien proporcionados. Cada herramienta transmite su intención sin ruido visual.',
            },
            {
              id: 'd3',
              type: 'p',
              text: 'En Luma Desktop puedes alternar entre formato Hoja A4 y Lectura Fluida en un clic, además de firmar directamente sobre el documento activando la herramienta Dibujo.',
            },
            { id: 'd4', type: 'h2', text: '2. Bloque de Conformidad y Firma (A4)' },
            {
              id: 'd5',
              type: 'p',
              text: 'Confirmo haber revisado este documento técnico y apruebo su archivo final con anotaciones integradas.',
            },
            { id: 'd6', type: 'quote', text: 'Firma del responsable: ________________________________________' },
          ],
        },
      ],
    },
    {
      id: 'doc_study_pdf',
      title: 'Guía de Estudio Visual',
      author: 'Taller Luma',
      format: 'PDF',
      badgeTag: 'PDF',
      coverColor: '#5B4BDB',
      coverAccent: '#3730A3',
      genre: 'Productividad',
      year: '2026',
      synopsis:
        'Manual de memoria activa, repaso espaciado y esquematización visual diseñado para trabajar en paralelo con los Cuadernos.',
      totalWords: 312,
      currentUnit: 0,
      progressPercent: 0.65,
      lastOpenedAt: now - 21_600_000,
      addedAt: now - 86_400_000 * 6,
      chapters: [
        {
          id: 'pdf_p1',
          title: 'Página 1 · Fundamentos del enfoque en pantalla',
          blocks: [
            { id: 'p1_1', type: 'h1', text: 'Fundamentos del enfoque en pantalla' },
            {
              id: 'p1_2',
              type: 'p',
              text: 'Reduce la carga cognitiva ocultando distracciones durante la lectura con el Modo Enfoque (Zen) y utiliza el índice lateral únicamente cuando necesites navegar entre secciones.',
            },
            { id: 'p1_3', type: 'list', text: '1. Subraya solo ideas núcleo, nunca párrafos enteros.' },
            { id: 'p1_4', type: 'list', text: '2. Convierte cada capítulo en un mapa conceptual de 4 nodos.' },
            { id: 'p1_5', type: 'list', text: '3. Exporta tus cuadernos antes de cada examen o entrega.' },
          ],
        },
        {
          id: 'pdf_p2',
          title: 'Página 2 · Memoria activa y repaso espaciado',
          blocks: [
            { id: 'p2_1', type: 'h1', text: 'Memoria activa y repaso espaciado' },
            {
              id: 'p2_2',
              type: 'p',
              text: 'El trazo manual y la organización espacial en tarjetas activan la memoria visual y consolidan conceptos complejos en ingeniería, medicina, derecho e idiomas.',
            },
          ],
        },
      ],
    },
    {
      id: 'doc_fb2_obs',
      title: 'Crónicas del Observatorio',
      author: 'Elena Mireles',
      format: 'FB2',
      badgeTag: 'FB2',
      coverColor: '#257A5E',
      coverAccent: '#14532D',
      genre: 'Ficción Corta',
      year: '2025',
      synopsis:
        'Relatos breves desde un observatorio de montaña, ideales para probar los modos nocturnos Noche cálida y Bosque noche.',
      totalWords: 240,
      currentUnit: 0,
      progressPercent: 0.1,
      lastOpenedAt: now - 43_200_000,
      addedAt: now - 86_400_000 * 7,
      chapters: [
        {
          id: 'fb2_c1',
          title: 'Capítulo I · La cúpula de cobre',
          blocks: [
            { id: 'f1', type: 'h1', text: 'La cúpula de cobre' },
            {
              id: 'f2',
              type: 'p',
              text: 'Al caer la tarde sobre la cordillera, el viento barría los cristales del observatorio con un murmullo seco. Sobre el escritorio de cedro descansaban tres cuadernos de mapas celestes y una lámpara ámbar de luz tenue.',
            },
            {
              id: 'f3',
              type: 'p',
              text: 'Cada noche registrada en papel parecía prolongar el silencio de las constelaciones. Bastaba cambiar la luz a un tono cálido para que el cansancio cediera paso a la curiosidad.',
            },
          ],
        },
      ],
    },
  ];

  const playlists: SagaPlaylist[] = [
    {
      id: 'pl_sagas',
      name: 'Sagas y Manhwa',
      description: 'Cómics, novelas cortas y capítulos en curso',
      accentColor: '#C44672',
      documentIds: ['doc_manhwa_shadow', 'doc_fb2_obs'],
      createdAt: now - 86_400_000 * 5,
    },
    {
      id: 'pl_estudio',
      name: 'Lectura y Estudio',
      description: 'Libros EPUB, guías visuales y apuntes clave',
      accentColor: '#2B64F5',
      documentIds: ['doc_atlas_epub', 'doc_study_pdf'],
      createdAt: now - 86_400_000 * 4,
    },
    {
      id: 'pl_trabajo',
      name: 'Trabajo y Documentos',
      description: 'Presentaciones PPTX y hojas A4 listas para firmar',
      accentColor: '#D97706',
      documentIds: ['doc_pptx_luma', 'doc_docx_arch'],
      createdAt: now - 86_400_000 * 3,
    },
  ];

  const nbCornell = createNotebookFromTemplate('cornell', 'Apuntes · Lectura Profunda', 'A4');
  nbCornell.id = 'nb_seed_cornell';
  nbCornell.pinned = true;

  const nbMap = createNotebookFromTemplate('concept_map', 'Mapa Conceptual · Arquitectura', 'WIDE_16_9');
  nbMap.id = 'nb_seed_map';
  nbMap.updatedAt = now - 5_400_000;

  return {
    documents: docs,
    playlists,
    notebooks: [nbCornell, nbMap],
    highlights: [
      {
        id: 'hl_seed_1',
        documentId: 'doc_atlas_epub',
        chapterIndex: 0,
        quotedText: 'Cuando desaparecen las barras innecesarias, la mente recupera su ritmo natural de atención sostenida',
        noteText: 'Base para diseñar sesiones de estudio de 45 minutos en modo enfoque.',
        color: 'amber',
        createdAt: now - 7_200_000,
      },
    ],
    bookmarks: [
      {
        id: 'bm_seed_1',
        documentId: 'doc_atlas_epub',
        unitIndex: 1,
        label: 'II. Tipografía, ritmo y memoria visual',
        createdAt: now - 3_600_000,
      },
    ],
    prefs: {
      theme: 'warm_cream',
      readerFont: 'literata',
      fontSizePx: 18,
      lineHeight: 1.72,
      pageWidthCh: 68,
      textAlign: 'left',
      twoPageSpread: false,
      warmFilterStrength: 0,
      nightDimming: 0,
      density: 'auto',
      sidebarWidth: 248,
      sidebarCollapsed: false,
      showInspector: true,
      targetFps: 'max',
      showFpsCounter: false,
      useDeviceFont: false,
      readerMenuStyle: 'bookmark',
      readerMenuScale: 1.0,
      immersiveReaderHide: false,
      immersiveReaderDelaySec: 8,
      immersiveReaderFadeSpeed: 'fast',
      immersiveNotebookHide: false,
      immersiveNotebookMode: 'landscape_only',
      immersiveNotebookDelaySec: 6,
      immersiveNotebookFadeSpeed: 'fast',
      sideTapPageTurn: true,
      pdfNightSoftFilter: false,
      dynamicIslandShowProgress: true,
      dynamicIslandShowTimeLeft: true,
      translationEngine: 'google',
      dictionarySources: [
        {
          id: 'wiki',
          name: 'Wikipedia',
          subtitle: 'API REST instantánea (es.wikipedia.org)',
          urlTemplate: 'https://es.wikipedia.org/wiki/Special:Search?search={palabra}',
          enabled: true,
          builtIn: true,
        },
        {
          id: 'rae',
          name: 'RAE',
          subtitle: 'https://dle.rae.es/{palabra}',
          urlTemplate: 'https://dle.rae.es/{palabra}',
          enabled: true,
        },
        {
          id: 'wordreference',
          name: 'WordReference',
          subtitle: 'https://www.wordreference.com/definicion/{palabra}',
          urlTemplate: 'https://www.wordreference.com/definicion/{palabra}',
          enabled: true,
        },
      ],
    },
    profile: {
      username: 'Lector Luma',
      peerCode: 'LUMA-7429',
      privacy: {
        showOnlineStatus: true,
        shareReadingBook: true,
        allowFriendChat: true,
      },
    },
    friends: [
      {
        peerCode: 'LUMA-3814',
        displayName: 'Sofía Morales',
        accentColor: '#2B64F5',
        readingBookTitle: 'El Atlas de la Lectura Profunda',
        readingProgressPct: 68,
        isOnline: true,
        messages: [
          {
            id: 'msg_seed_1',
            senderName: 'Sofía Morales',
            text: '¡Te recomiendo el capítulo II sobre tipografía y ritmo visual!',
            timestampMs: now - 1_800_000,
            isFromMe: false,
          },
        ],
      },
      {
        peerCode: 'LUMA-9052',
        displayName: 'Mateo Ríos',
        accentColor: '#257A5E',
        readingBookTitle: 'Shadow Blade · Ep. 1',
        readingProgressPct: 45,
        isOnline: false,
        messages: [
          {
            id: 'msg_seed_2',
            senderName: 'Mateo Ríos',
            text: '¿Probaste ya la vista dividida para hacer apuntes Cornell?',
            timestampMs: now - 86_400_000,
            isFromMe: false,
          },
        ],
      },
    ],
  };
}
