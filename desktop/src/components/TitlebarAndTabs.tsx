import React from 'react';
import {
  BookOpen,
  Cloud,
  Columns2,
  FolderKanban,
  Home,
  Library,
  Maximize2,
  Minimize2,
  Minus,
  PanelLeft,
  PenTool,
  Plus,
  Search,
  Square,
  X,
} from 'lucide-react';
import { WorkspaceTab } from '../types';
import { ViewportProfile } from '../hooks/useViewportProfile';
import { LumaBrandLogo } from './LumaBrandLogo';
import { PWAInstallButton } from './PWAInstallButton';

interface TitlebarAndTabsProps {
  tabs: WorkspaceTab[];
  activeTabId: string;
  viewport: ViewportProfile;
  platform: string;
  isMaximized: boolean;
  isZenMode: boolean;
  splitEnabled: boolean;
  sidebarOpen: boolean;
  onSelectTab: (id: string) => void;
  onCloseTab: (id: string) => void;
  onNewNotebook: () => void;
  onToggleSidebar: () => void;
  onToggleSplit: () => void;
  onToggleZen: () => void;
  onOpenCommandPalette: () => void;
}

export const TitlebarAndTabs: React.FC<TitlebarAndTabsProps> = ({
  tabs,
  activeTabId,
  viewport,
  platform,
  isMaximized,
  isZenMode,
  splitEnabled,
  sidebarOpen,
  onSelectTab,
  onCloseTab,
  onNewNotebook,
  onToggleSidebar,
  onToggleSplit,
  onToggleZen,
  onOpenCommandPalette,
}) => {
  const isElectron = Boolean(window.lumaDesktop?.isElectron);
  const isMac = platform === 'darwin';

  const iconForTab = (kind: WorkspaceTab['kind']) => {
    switch (kind) {
      case 'home':
        return <Home className="w-3.5 h-3.5 shrink-0" />;
      case 'library':
        return <Library className="w-3.5 h-3.5 shrink-0" />;
      case 'sagas':
        return <FolderKanban className="w-3.5 h-3.5 shrink-0" />;
      case 'notebooks':
      case 'studio':
        return <PenTool className="w-3.5 h-3.5 shrink-0" />;
      case 'sources':
        return <Cloud className="w-3.5 h-3.5 shrink-0" />;
      case 'reader':
        return <BookOpen className="w-3.5 h-3.5 shrink-0" />;
    }
  };

  return (
    <header
      style={{ height: viewport.titlebarHeight }}
      className="electron-drag flex items-center justify-between border-b bg-[var(--luma-sidebar)] text-[var(--luma-ink)] select-none shrink-0 px-2 gap-2"
    >
      {/* Left: macOS inset + sidebar toggle + brand wordmark */}
      <div
        className={`electron-no-drag flex items-center gap-1.5 shrink-0 ${
          isElectron && isMac ? 'pl-[68px]' : ''
        }`}
      >
        <button
          type="button"
          onClick={onToggleSidebar}
          title={sidebarOpen ? 'Ocultar menú lateral (Ctrl+\\)' : 'Mostrar menú lateral (Ctrl+\\)'}
          className="h-7 w-7 flex items-center justify-center rounded-md text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)] hover:bg-[var(--luma-surface-alt)] transition-colors"
        >
          <PanelLeft className="w-4 h-4" />
        </button>

        {!sidebarOpen && viewport.tier !== 'compact' && (
          <div className="px-1 shrink-0">
            <LumaBrandLogo size="sm" />
          </div>
        )}
      </div>

      {/* Center: Proportional Notion/Arc Tab Strip */}
      <div className="electron-no-drag flex-1 min-w-0 flex items-center gap-1 overflow-x-auto no-scrollbar px-1">
        {tabs.map((tab) => {
          const active = tab.id === activeTabId;
          const canClose = tabs.length > 1 && tab.kind !== 'home';
          return (
            <div
              key={tab.id}
              onClick={() => onSelectTab(tab.id)}
              role="tab"
              aria-selected={active}
              className={`group flex items-center gap-1.5 h-7 px-2.5 rounded-md text-xs transition-colors shrink-0 cursor-pointer ${
                viewport.tier === 'compact' ? 'max-w-[130px]' : 'max-w-[196px]'
              } ${
                active
                  ? 'bg-[var(--luma-surface)] text-[var(--luma-ink)] font-semibold border border-[var(--luma-border)]'
                  : 'text-[var(--luma-ink-muted)] hover:bg-[var(--luma-surface-alt)] hover:text-[var(--luma-ink)] border border-transparent'
              }`}
            >
              <span className={active ? 'text-[var(--luma-accent)]' : 'opacity-75'}>
                {iconForTab(tab.kind)}
              </span>
              <span className="truncate whitespace-nowrap">{tab.title}</span>
              {canClose && (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onCloseTab(tab.id);
                  }}
                  title="Cerrar pestaña"
                  className="ml-0.5 p-0.5 rounded hover:bg-[var(--luma-surface-alt)] text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)] opacity-70 group-hover:opacity-100 transition-opacity"
                >
                  <X className="w-3 h-3" />
                </button>
              )}
            </div>
          );
        })}

        <button
          type="button"
          onClick={onNewNotebook}
          title="Crear cuaderno, serie o importar"
          className="h-7 w-7 flex items-center justify-center rounded-md text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)] hover:bg-[var(--luma-surface-alt)] transition-colors shrink-0"
        >
          <Plus className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Right: PWA Install, Quick search, Split View, Focus mode, and OS window controls */}
      <div className="electron-no-drag flex items-center gap-1 shrink-0">
        {viewport.tier !== 'compact' && <PWAInstallButton compact />}
        <button
          type="button"
          onClick={onOpenCommandPalette}
          title="Buscar o ejecutar comando (Ctrl+K)"
          className="h-7 px-2 flex items-center gap-1.5 rounded-md text-xs text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)] hover:bg-[var(--luma-surface-alt)] transition-colors whitespace-nowrap shrink-0"
        >
          <Search className="w-3.5 h-3.5" />
          {viewport.tier !== 'compact' && viewport.tier !== 'tablet' && (
            <span className="font-mono text-[11px] opacity-80">Ctrl+K</span>
          )}
        </button>

        {viewport.canSplitView && (
          <button
            type="button"
            onClick={onToggleSplit}
            title="Vista dividida: Lector + Cuaderno"
            className={`h-7 px-2 flex items-center gap-1.5 rounded-md text-xs transition-colors whitespace-nowrap shrink-0 ${
              splitEnabled
                ? 'bg-[var(--luma-accent-soft)] text-[var(--luma-accent)] font-medium'
                : 'text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)] hover:bg-[var(--luma-surface-alt)]'
            }`}
          >
            <Columns2 className="w-3.5 h-3.5" />
            {viewport.tier !== 'laptop' && <span>Dividir</span>}
          </button>
        )}

        <button
          type="button"
          onClick={onToggleZen}
          title={isZenMode ? 'Salir de pantalla completa (ESC)' : 'Pantalla completa inmersiva (F11)'}
          className={`h-7 w-7 flex items-center justify-center rounded-md transition-colors ${
            isZenMode
              ? 'bg-[var(--luma-accent-soft)] text-[var(--luma-accent)]'
              : 'text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)] hover:bg-[var(--luma-surface-alt)]'
          }`}
        >
          {isZenMode ? <Minimize2 className="w-3.5 h-3.5" /> : <Maximize2 className="w-3.5 h-3.5" />}
        </button>

        {isElectron && !isMac && (
          <div className="flex items-center ml-1 pl-1 border-l border-[var(--luma-border)]">
            <button
              type="button"
              onClick={() => window.lumaDesktop?.minimize()}
              title="Minimizar"
              className="h-7 w-8 flex items-center justify-center rounded hover:bg-[var(--luma-surface-alt)] text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)]"
            >
              <Minus className="w-3.5 h-3.5" />
            </button>
            <button
              type="button"
              onClick={() => window.lumaDesktop?.toggleMaximize()}
              title={isMaximized ? 'Restaurar' : 'Maximizar'}
              className="h-7 w-8 flex items-center justify-center rounded hover:bg-[var(--luma-surface-alt)] text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)]"
            >
              <Square className="w-3 h-3" />
            </button>
            <button
              type="button"
              onClick={() => window.lumaDesktop?.close()}
              title="Cerrar Luma"
              className="h-7 w-8 flex items-center justify-center rounded hover:bg-red-600 hover:text-white text-[var(--luma-ink-muted)] transition-colors"
            >
              <X className="w-3.5 h-3.5" />
            </button>
          </div>
        )}
      </div>
    </header>
  );
};
