export type DocumentFormat = 'EPUB' | 'PDF' | 'DOCX' | 'PPTX' | 'TXT' | 'FB2';

export type ReadingThemeId =
  | 'warm_cream'
  | 'sepia'
  | 'sand'
  | 'amber_soft'
  | 'peach'
  | 'sage'
  | 'lemon'
  | 'light'
  | 'lavender'
  | 'sky'
  | 'rose'
  | 'warm_night'
  | 'forest_night'
  | 'navy_mid'
  | 'midnight'
  | 'dark'
  | 'amoled';

export type ReaderFontId = 'literata' | 'plus_jakarta' | 'lexend' | 'jetbrains_mono';

export type InterfaceDensity = 'auto' | 'compact' | 'comfortable' | 'spacious';

export type ViewportTier = 'compact' | 'tablet' | 'laptop' | 'desktop' | 'ultrawide';

export type BlockType =
  | 'h1'
  | 'h2'
  | 'h3'
  | 'p'
  | 'quote'
  | 'list'
  | 'ordered_list'
  | 'table'
  | 'image'
  | 'hr';

export interface TextRun {
  text: string;
  bold?: boolean;
  italic?: boolean;
  underline?: boolean;
  code?: boolean;
}

export interface ParsedTableCell {
  text: string;
  isHeader?: boolean;
}

export interface ParsedTableRow {
  cells: ParsedTableCell[];
}

export interface ParsedBlock {
  id: string;
  type: BlockType;
  text: string;
  runs?: TextRun[];
  listLevel?: number;
  listIndex?: number;
  tableRows?: ParsedTableRow[];
  imageDataUrl?: string;
  imageAlt?: string;
  align?: 'left' | 'center' | 'right' | 'justify';
}

export interface ParsedChapter {
  id: string;
  title: string;
  blocks: ParsedBlock[];
}

export interface ManhwaBubble {
  id: string;
  x: number; // 0..100%
  y: number;
  w: number;
  h: number;
  original: string;
  translated: string;
}

export interface ManhwaPanel {
  id: string;
  episodeLabel: string;
  gradientFrom: string;
  gradientTo: string;
  accentColor: string;
  sceneCaption: string;
  bubbles: ManhwaBubble[];
}

export interface SlidePage {
  id: string;
  title: string;
  subtitle?: string;
  bgColor: string;
  textColor: string;
  accentColor: string;
  bullets: string[];
  notes: string;
  images?: string[];
  tables?: string[][][];
}

export interface HighlightNote {
  id: string;
  documentId: string;
  chapterIndex: number;
  quotedText: string;
  noteText: string;
  color: 'amber' | 'cobalt' | 'mint' | 'coral';
  createdAt: number;
}

export interface BookmarkItem {
  id: string;
  documentId: string;
  unitIndex: number;
  label: string;
  createdAt: number;
}

export interface InkPoint {
  x: number; // normalized 0..1
  y: number;
}

export type ReaderAnnotationTool =
  | 'select'
  | 'pen'
  | 'marker'
  | 'highlighter'
  | 'line'
  | 'arrow'
  | 'rect'
  | 'ellipse'
  | 'sticky'
  | 'eraser';

export interface InkStroke {
  id: string;
  tool: 'pen' | 'marker' | 'highlighter' | 'line' | 'arrow' | 'rect' | 'ellipse';
  color: string;
  width: number;
  opacity: number;
  points: InkPoint[];
}

export interface ReaderStickyNote {
  id: string;
  x: number; // normalized 0..1
  y: number; // normalized 0..1
  text: string;
  color: string;
}

export interface LumaDocument {
  id: string;
  title: string;
  author: string;
  format: DocumentFormat;
  badgeTag: string;
  coverColor: string;
  coverAccent: string;
  genre: string;
  year: string;
  synopsis: string;
  totalWords: number;
  currentUnit: number;
  progressPercent: number;
  pinned?: boolean;
  lastOpenedAt: number;
  addedAt: number;
  chapters: ParsedChapter[];
  slides?: SlidePage[];
  manhwaPanels?: ManhwaPanel[];
  pdfDataUrl?: string;
  pdfPageCount?: number;
  annotationsByUnit?: Record<number, InkStroke[]>;
  stickyNotesByUnit?: Record<number, ReaderStickyNote[]>;
  /** Optional Google Drive linkage */
  driveFileId?: string;
  driveSourceId?: string;
  driveModifiedTime?: string;
  driveMimeType?: string;
  fileSizeBytes?: number;
  syncState?: 'synced' | 'pending' | 'uploading' | 'error' | 'conflict';
}

export interface SagaPlaylist {
  id: string;
  name: string;
  description: string;
  accentColor: string;
  documentIds: string[];
  createdAt: number;
}

export type NotebookPaperPattern = 'blank' | 'ruled' | 'grid' | 'dotted' | 'cornell';

export type NotebookPageSize =
  | 'A4'
  | 'A3'
  | 'A5'
  | 'LETTER'
  | 'LEGAL'
  | 'WIDE_16_9'
  | 'SQUARE'
  | 'CUSTOM';

export type PageOrientation = 'portrait' | 'landscape';
export type MarginPreset = 'normal' | 'narrow' | 'moderate' | 'wide' | 'custom';
export type RulerUnit = 'cm' | 'in';

export type BrushTipType =
  | 'round'
  | 'square'
  | 'calligraphy'
  | 'marker'
  | 'highlighter'
  | 'soft'
  | 'watercolor';

export type LineStyleType = 'solid' | 'dashed' | 'dotted';

export type LayerBlendMode =
  | 'normal'
  | 'multiply'
  | 'screen'
  | 'overlay'
  | 'darken'
  | 'lighten';

export type CanvasTool =
  | 'select'
  | 'marquee'
  | 'pen'
  | 'highlighter'
  | 'eraser'
  | 'fill'
  | 'text'
  | 'rect'
  | 'ellipse'
  | 'triangle'
  | 'arrow'
  | 'line'
  | 'star'
  | 'pentagon'
  | 'hexagon'
  | 'sticky'
  | 'image'
  | 'table'
  | 'pan';

export interface NotebookLayer {
  id: string;
  name: string;
  visible: boolean;
  locked: boolean;
}

export interface BaseCanvasObject {
  id: string;
  layerId: string;
  x: number; // virtual page coordinate space
  y: number;
  w: number;
  h: number;
  opacity: number;
  name?: string;
  visible?: boolean;
  locked?: boolean;
  rotation?: number; // degrees
  groupId?: string;
  blendMode?: LayerBlendMode;
}

export interface StrokeCanvasObject extends BaseCanvasObject {
  kind: 'stroke';
  tool: 'pen' | 'highlighter' | 'eraser';
  brushTip?: BrushTipType;
  color: string;
  strokeWidth: number;
  hardness?: number; // 0..100
  smoothing?: number; // 0..100
  lineStyle?: LineStyleType;
  pressureEnabled?: boolean;
  points: Array<{ x: number; y: number; p?: number }>; // page coordinate space
}

export interface TextCanvasObject extends BaseCanvasObject {
  kind: 'text';
  text: string;
  fontFamily: string; // 'sans' | 'serif' | 'mono' | 'hand' | Google Font | Custom Font
  fontSize: number;
  bold: boolean;
  italic?: boolean;
  underline?: boolean;
  strikethrough?: boolean;
  color: string;
  highlightColor?: string;
  fillColor: string;
  borderColor: string;
  align: 'left' | 'center' | 'right' | 'justify';
  lineHeight?: number;
  letterSpacing?: number;
  listType?: 'none' | 'bullet' | 'number';
  script?: 'normal' | 'super' | 'sub';
  indentPx?: number;
  columns?: 1 | 2 | 3;
  isBanner?: boolean;
}

export type ShapeKind =
  | 'rect'
  | 'ellipse'
  | 'triangle'
  | 'arrow'
  | 'line'
  | 'star'
  | 'pentagon'
  | 'hexagon'
  | 'diamond';

export interface ShapeCanvasObject extends BaseCanvasObject {
  kind: 'shape';
  shape: ShapeKind;
  strokeColor: string;
  fillColor: string;
  strokeWidth: number;
  borderRadius?: number;
  lineStyle?: LineStyleType;
  label?: string;
}

export interface ImageCropInsets {
  top: number; // 0..45 (%)
  right: number;
  bottom: number;
  left: number;
}

export interface ImageCanvasObject extends BaseCanvasObject {
  kind: 'image';
  src: string; // data URL or object URL
  alt?: string;
  naturalWidth?: number;
  naturalHeight?: number;
  crop?: ImageCropInsets;
  flipX?: boolean;
  flipY?: boolean;
  borderRadius?: number;
}

export interface StickyCanvasObject extends BaseCanvasObject {
  kind: 'sticky';
  text: string;
  bgColor: string;
  textColor: string;
}

export interface TableCellStyle {
  bg?: string;
  textColor?: string;
  bold?: boolean;
  colSpan?: number;
  rowSpan?: number;
  hidden?: boolean;
}

export interface TableCanvasObject extends BaseCanvasObject {
  kind: 'table';
  rows: number;
  cols: number;
  cells: string[];
  headerBg: string;
  borderColor: string;
  cellStyles?: Record<number, TableCellStyle>;
}

export interface StickerCanvasObject extends BaseCanvasObject {
  kind: 'sticker';
  symbol: string;
  label: string;
  color: string;
  bgColor: string;
}

export type CanvasObject =
  | StrokeCanvasObject
  | TextCanvasObject
  | ShapeCanvasObject
  | ImageCanvasObject
  | StickyCanvasObject
  | TableCanvasObject
  | StickerCanvasObject;

export interface NotebookPageSetup {
  orientation: PageOrientation;
  customWidthMm: number;
  customHeightMm: number;
  marginPreset: MarginPreset;
  marginsMm: {
    top: number;
    bottom: number;
    left: number;
    right: number;
  };
  rulerUnit: RulerUnit;
  showRulers: boolean;
  showMarginGuides: boolean;
  showGrid: boolean;
  snapEnabled: boolean;
  columns: 1 | 2 | 3;
  indentMm: number;
  headerText: string;
  footerText: string;
  showPageNumbers: boolean;
}

export interface NotebookBodyStyle {
  fontFamily: string;
  fontSize: number;
  bold: boolean;
  italic: boolean;
  underline: boolean;
  strikethrough: boolean;
  color: string;
  highlightColor: string;
  align: 'left' | 'center' | 'right' | 'justify';
  lineHeight: number;
  letterSpacing: number;
  listType: 'none' | 'bullet' | 'number';
}

export interface NotebookPage {
  id: string;
  title: string;
  pattern: NotebookPaperPattern;
  backgroundColor: string;
  objects: CanvasObject[];
  /** Word-like flowing body text directly on the sheet inside margins */
  bodyText?: string;
  /** Formatting style for direct Word-like page body text */
  bodyStyle?: NotebookBodyStyle;
  /** Optional raster paint/pixel-eraser overlay (PNG data URL) */
  rasterDataUrl?: string;
}

export interface LumaNotebook {
  id: string;
  title: string;
  subtitle: string;
  coverColor: string;
  pageSize: NotebookPageSize;
  pageSetup?: NotebookPageSetup;
  pinned?: boolean;
  updatedAt: number;
  layers: NotebookLayer[];
  pages: NotebookPage[];
  activePageIndex: number;
  /** Optional Google Drive linkage */
  driveFileId?: string;
  driveSourceId?: string;
  driveModifiedTime?: string;
  syncState?: 'synced' | 'pending' | 'uploading' | 'error' | 'conflict';
}

export type WorkspaceTabKind =
  | 'home'
  | 'library'
  | 'sagas'
  | 'notebooks'
  | 'sources'
  | 'reader'
  | 'studio';

export interface WorkspaceTab {
  id: string;
  kind: WorkspaceTabKind;
  title: string;
  targetId?: string;
}

export type ReaderMenuStyle = 'bookmark' | 'island' | 'classic';
export type ImmersiveFadeSpeed = 'very_fast' | 'fast' | 'smooth';
export type TargetFpsOption = 'max' | 60 | 90 | 120 | 144 | 240;

export interface DictionarySource {
  id: string;
  name: string;
  urlTemplate: string; // e.g. https://dle.rae.es/{palabra}
  subtitle?: string;
  enabled: boolean;
  builtIn?: boolean;
}

export interface WorkspacePreferences {
  theme: ReadingThemeId;
  readerFont: ReaderFontId;
  fontSizePx: number;
  lineHeight: number;
  pageWidthCh: number;
  textAlign: 'left' | 'justify';
  twoPageSpread: boolean;
  warmFilterStrength: number; // 0..0.45
  nightDimming: number; // 0..0.35
  density: InterfaceDensity;
  sidebarWidth: number;
  sidebarCollapsed: boolean;
  showInspector: boolean;
  // Mobile Luma parity settings
  targetFps: TargetFpsOption;
  showFpsCounter: boolean;
  useDeviceFont: boolean;
  readerMenuStyle: ReaderMenuStyle;
  readerMenuScale: number; // 0.75..1.30
  immersiveReaderHide: boolean;
  immersiveReaderDelaySec: 4 | 8 | 15 | 30;
  immersiveReaderFadeSpeed: ImmersiveFadeSpeed;
  immersiveNotebookHide: boolean;
  immersiveNotebookMode: 'landscape_only' | 'always';
  immersiveNotebookDelaySec: 3 | 6 | 10 | 15;
  immersiveNotebookFadeSpeed: ImmersiveFadeSpeed;
  sideTapPageTurn: boolean;
  pdfNightSoftFilter: boolean;
  dynamicIslandShowProgress: boolean;
  dynamicIslandShowTimeLeft: boolean;
  translationEngine: 'google' | 'local';
  dictionarySources: DictionarySource[];
  driveSyncPolicy?: 'manual' | 'wifi_only' | 'always';
}

export interface PrivacySettings {
  showOnlineStatus: boolean;
  shareReadingBook: boolean;
  allowFriendChat: boolean;
}

export interface UserProfile {
  username: string;
  avatarDataUrl?: string;
  peerCode: string;
  privacy: PrivacySettings;
}

export interface FriendChatMessage {
  id: string;
  senderName: string;
  text: string;
  timestampMs: number;
  isFromMe: boolean;
}

export interface FriendPeer {
  peerCode: string;
  displayName: string;
  accentColor: string;
  readingBookTitle: string;
  readingProgressPct: number;
  isOnline: boolean;
  messages: FriendChatMessage[];
}

export interface LumaWorkspaceState {
  documents: LumaDocument[];
  playlists: SagaPlaylist[];
  notebooks: LumaNotebook[];
  highlights: HighlightNote[];
  bookmarks: BookmarkItem[];
  prefs: WorkspacePreferences;
  profile: UserProfile;
  friends: FriendPeer[];
}

export interface PickedDesktopFile {
  name: string;
  path?: string;
  size: number;
  base64: string;
}

export interface LumaDesktopBridge {
  isElectron: boolean;
  getPlatform: () => Promise<string>;
  minimize: () => Promise<void>;
  toggleMaximize: () => Promise<boolean>;
  close: () => Promise<void>;
  isMaximized: () => Promise<boolean>;
  onWindowState: (cb: (state: { maximized: boolean }) => void) => () => void;
  loadWorkspace: () => Promise<string | null>;
  saveWorkspace: (jsonString: string) => Promise<boolean>;
  pickFiles: (mode?: 'document' | 'image') => Promise<PickedDesktopFile[]>;
  saveExport: (payload: {
    defaultName: string;
    data: string;
    encoding: 'base64' | 'utf8';
  }) => Promise<{ saved: boolean; filePath?: string }>;
  openExternal: (url: string) => Promise<boolean>;
}

declare global {
  interface Window {
    lumaDesktop?: LumaDesktopBridge;
  }
}
