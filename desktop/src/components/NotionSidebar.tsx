import React, { useState } from 'react';
import {
  BookOpen,
  ChevronDown,
  ChevronRight,
  Cloud,
  FolderKanban,
  Home,
  Library,
  PenTool,
  Pin,
  Plus,
  Search,
  Settings,
  Upload,
  Users,
  X,
} from 'lucide-react';
import {
  FriendPeer,
  LumaDocument,
  LumaNotebook,
  SagaPlaylist,
  UserProfile,
  WorkspaceTabKind,
} from '../types';
import { ViewportProfile } from '../hooks/useViewportProfile';
import { LumaBrandLogo } from './LumaBrandLogo';
import { PWAInstallButton } from './PWAInstallButton';

interface NotionSidebarProps {
  viewport: ViewportProfile;
  open: boolean;
  width: number;
  activeNav: WorkspaceTabKind;
  activeTargetId?: string;
  documents: LumaDocument[];
  playlists: SagaPlaylist[];
  notebooks: LumaNotebook[];
  profile: UserProfile;
  friends: FriendPeer[];
  sourcesCount?: number;
  pendingSyncCount?: number;
  onCloseDrawer: () => void;
  onResizeWidth: (newWidth: number) => void;
  onNavigate: (kind: 'home' | 'library' | 'sagas' | 'notebooks' | 'sources', sagaId?: string) => void;
  onOpenDocument: (docId: string) => void;
  onOpenNotebook: (nbId: string) => void;
  onImportFiles: () => void;
  onNewNotebook: () => void;
  onOpenCommandPalette: () => void;
  onOpenProfile: () => void;
  onOpenFriends: () => void;
  onOpenSettings: () => void;
  onOpenGuide: () => void;
}

export const NotionSidebar: React.FC<NotionSidebarProps> = ({
  viewport,
  open,
  width,
  activeNav,
  activeTargetId,
  documents,
  playlists,
  notebooks,
  profile,
  friends,
  sourcesCount = 0,
  pendingSyncCount = 0,
  onCloseDrawer,
  onResizeWidth,
  onNavigate,
  onOpenDocument,
  onOpenNotebook,
  onImportFiles,
  onNewNotebook,
  onOpenCommandPalette,
  onOpenProfile,
  onOpenFriends,
  onOpenSettings,
  onOpenGuide,
}) => {
  const [pinnedExpanded, setPinnedExpanded] = useState(true);

  const pinnedDocs = documents.filter((d) => d.pinned).slice(0, 5);
  const recentDocs =
    pinnedDocs.length > 0
      ? pinnedDocs
      : [...documents].sort((a, b) => b.lastOpenedAt - a.lastOpenedAt).slice(0, 4);

  const onlineFriendsCount = friends.filter((f) => f.isOnline).length;
  const userInitial = (profile.username.trim()[0] || 'L').toUpperCase();

  const navTabs: Array<{
    kind: 'home' | 'library' | 'sagas' | 'notebooks' | 'sources';
    label: string;
    icon: React.ReactNode;
    count?: number;
  }> = [
    { kind: 'home', label: 'Inicio', icon: <Home className="w-4 h-4 shrink-0" /> },
    {
      kind: 'library',
      label: 'Biblioteca',
      icon: <Library className="w-4 h-4 shrink-0" />,
      count: documents.length,
    },
    {
      kind: 'sagas',
      label: 'Sagas',
      icon: <FolderKanban className="w-4 h-4 shrink-0" />,
      count: playlists.length,
    },
    {
      kind: 'notebooks',
      label: 'Cuadernos',
      icon: <PenTool className="w-4 h-4 shrink-0" />,
      count: notebooks.length,
    },
    {
      kind: 'sources',
      label: 'Fuentes (Drive)',
      icon: <Cloud className="w-4 h-4 shrink-0" />,
      count: pendingSyncCount > 0 ? pendingSyncCount : sourcesCount,
    },
  ];

  // Compact icon rail when sidebar is collapsed or on medium split-screen
  const showCompactRail =
    !open && (viewport.sidebarMode === 'rail' || viewport.sidebarMode === 'expanded');

  if (showCompactRail) {
    return (
      <aside className="w-[58px] shrink-0 border-r bg-[var(--luma-sidebar)] flex flex-col items-center py-2.5 gap-1.5 select-none">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          title="Buscar (Ctrl+K)"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)] hover:bg-[var(--luma-surface-alt)] transition-colors"
        >
          <Search className="w-4 h-4" />
        </button>

        <div className="w-6 h-px bg-[var(--luma-border)] my-0.5" />

        {navTabs.map((item) => {
          const isActive = activeNav === item.kind;
          return (
            <button
              key={item.kind}
              type="button"
              onClick={() => onNavigate(item.kind)}
              title={item.label}
              className={`w-9 h-9 rounded-lg flex items-center justify-center transition-colors ${
                isActive
                  ? 'bg-[var(--luma-accent-soft)] text-[var(--luma-accent)]'
                  : 'text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)] hover:bg-[var(--luma-surface-alt)]'
              }`}
            >
              {item.icon}
            </button>
          );
        })}

        <div className="w-6 h-px bg-[var(--luma-border)] my-0.5" />

        <button
          type="button"
          onClick={onImportFiles}
          title="Importar documento"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)] hover:bg-[var(--luma-surface-alt)] transition-colors"
        >
          <Upload className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onNewNotebook}
          title="Crear cuaderno, serie o importar"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)] hover:bg-[var(--luma-surface-alt)] transition-colors"
        >
          <Plus className="w-4 h-4" />
        </button>

        <div className="flex-1" />

        {/* Bottom mobile-Luma icons: Friends, Settings, Guide, User Profile */}
        <button
          type="button"
          onClick={onOpenFriends}
          title={`Amigos (${friends.length})`}
          className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)] hover:bg-[var(--luma-surface-alt)] transition-colors"
        >
          <Users className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          title="Configuración y Apariencia"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)] hover:bg-[var(--luma-surface-alt)] transition-colors"
        >
          <Settings className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onOpenGuide}
          title="Guía · Cómo usar Luma"
          className="w-9 h-9 rounded-lg flex items-center justify-center text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)] hover:bg-[var(--luma-surface-alt)] transition-colors"
        >
          <BookOpen className="w-4 h-4" />
        </button>
        <button
          type="button"
          onClick={onOpenProfile}
          title={`Cuenta · ${profile.username}`}
          className="w-8 h-8 rounded-full overflow-hidden border border-[var(--luma-accent)] bg-[var(--luma-accent-soft)] text-[var(--luma-accent)] text-xs font-bold flex items-center justify-center mt-0.5"
        >
          {profile.avatarDataUrl ? (
            <img src={profile.avatarDataUrl} alt={profile.username} className="w-full h-full object-cover" />
          ) : (
            userInitial
          )}
        </button>
      </aside>
    );
  }

  if (!open) return null;

  const isOverlayDrawer = viewport.sidebarMode === 'drawer' || viewport.sidebarMode === 'rail';

  const startResize = (e: React.MouseEvent) => {
    e.preventDefault();
    const startX = e.clientX;
    const startWidth = width;
    const onMove = (ev: MouseEvent) => {
      const next = Math.min(
        viewport.maxSidebarWidth,
        Math.max(viewport.minSidebarWidth, startWidth + (ev.clientX - startX))
      );
      onResizeWidth(next);
    };
    const onUp = () => {
      window.removeEventListener('mousemove', onMove);
      window.removeEventListener('mouseup', onUp);
    };
    window.addEventListener('mousemove', onMove);
    window.addEventListener('mouseup', onUp);
  };

  const sidebarBody = (
    <aside
      style={{ width: isOverlayDrawer ? viewport.recommendedSidebarWidth : width }}
      className="relative h-full shrink-0 border-r bg-[var(--luma-sidebar)] text-[var(--luma-ink)] flex flex-col select-none"
    >
      {/* Top Luma Mobile-Style Brand Header (Logo + Calligraphic Signature) */}
      <div className="px-3.5 pt-3.5 pb-2.5 flex items-center justify-between gap-2">
        <button
          type="button"
          onClick={() => {
            onNavigate('home');
            if (isOverlayDrawer) onCloseDrawer();
          }}
          className="flex items-center min-w-0 hover:opacity-90 transition-opacity"
        >
          <LumaBrandLogo size="md" />
        </button>

        {isOverlayDrawer && (
          <button
            type="button"
            onClick={onCloseDrawer}
            title="Cerrar menú"
            className="h-7 w-7 rounded-md flex items-center justify-center text-[var(--luma-ink-muted)] hover:bg-[var(--luma-surface-alt)]"
          >
            <X className="w-4 h-4" />
          </button>
        )}
      </div>

      {/* Quick Command Search */}
      <div className="px-2.5 pb-2.5">
        <button
          type="button"
          onClick={onOpenCommandPalette}
          className="w-full h-8 px-2.5 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-surface)] hover:bg-[var(--luma-surface-alt)] flex items-center justify-between text-xs text-[var(--luma-ink-muted)] transition-colors"
        >
          <span className="flex items-center gap-2 truncate">
            <Search className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Ir a...</span>
          </span>
          <span className="font-mono text-[10px] opacity-75 shrink-0">Ctrl+K</span>
        </button>
      </div>

      {/* Main Non-Repetitive Navigation + Quick Actions + Pinned */}
      <div className="flex-1 overflow-y-auto px-2 py-1 space-y-4">
        {/* Single clean Workspace Tabs (No duplicated Cuadernos/Sagas trees below!) */}
        <nav className="space-y-0.5" aria-label="Navegación principal">
          {navTabs.map((item) => {
            const isActive = activeNav === item.kind;
            return (
              <button
                key={item.kind}
                type="button"
                onClick={() => {
                  onNavigate(item.kind);
                  if (isOverlayDrawer) onCloseDrawer();
                }}
                className={`w-full h-8.5 px-2.5 rounded-lg flex items-center justify-between text-[13px] transition-colors ${
                  isActive
                    ? 'bg-[var(--luma-accent-soft)] text-[var(--luma-accent)] font-semibold'
                    : 'text-[var(--luma-ink)] hover:bg-[var(--luma-surface-alt)] font-medium'
                }`}
              >
                <span className="flex items-center gap-2.5 min-w-0">
                  {item.icon}
                  <span className="truncate">{item.label}</span>
                </span>
                {typeof item.count === 'number' && (
                  <span className="text-[11px] tabular-nums text-[var(--luma-ink-muted)]">
                    {item.count}
                  </span>
                )}
              </button>
            );
          })}
        </nav>

        {/* Primary Quick Actions */}
        <div className="grid grid-cols-2 gap-1.5 px-0.5">
          <button
            type="button"
            onClick={() => {
              onImportFiles();
              if (isOverlayDrawer) onCloseDrawer();
            }}
            className="h-8 px-2 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-surface)] hover:bg-[var(--luma-surface-alt)] flex items-center justify-center gap-1.5 text-xs font-medium text-[var(--luma-ink)] transition-colors whitespace-nowrap"
          >
            <Upload className="w-3.5 h-3.5 text-[var(--luma-accent)] shrink-0" />
            <span className="truncate">Importar</span>
          </button>
          <button
            type="button"
            onClick={() => {
              onNewNotebook();
              if (isOverlayDrawer) onCloseDrawer();
            }}
            className="h-8 px-2 rounded-lg bg-[var(--luma-accent)] text-[var(--luma-on-accent)] hover:opacity-95 flex items-center justify-center gap-1.5 text-xs font-semibold transition-opacity whitespace-nowrap"
          >
            <Plus className="w-3.5 h-3.5 shrink-0" />
            <span className="truncate">Crear</span>
          </button>
        </div>

        {/* Pinned / Active Reading Shortcuts (no redundant Sagas/Cuadernos repeat) */}
        <div>
          <button
            type="button"
            onClick={() => setPinnedExpanded((v) => !v)}
            className="w-full px-1.5 py-1 flex items-center gap-1 text-[11px] font-semibold text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)]"
          >
            {pinnedExpanded ? (
              <ChevronDown className="w-3 h-3" />
            ) : (
              <ChevronRight className="w-3 h-3" />
            )}
            <span>{pinnedDocs.length > 0 ? 'Fijados' : 'Lecturas recientes'}</span>
          </button>
          {pinnedExpanded && (
            <div className="mt-0.5 space-y-0.5">
              {recentDocs.map((doc) => {
                const isSelected = activeNav === 'reader' && activeTargetId === doc.id;
                return (
                  <button
                    key={doc.id}
                    type="button"
                    onClick={() => {
                      onOpenDocument(doc.id);
                      if (isOverlayDrawer) onCloseDrawer();
                    }}
                    className={`w-full h-8 px-2 rounded-lg flex items-center gap-2 text-xs transition-colors ${
                      isSelected
                        ? 'bg-[var(--luma-surface)] text-[var(--luma-ink)] font-semibold border border-[var(--luma-border)]'
                        : 'text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)] hover:bg-[var(--luma-surface-alt)]'
                    }`}
                  >
                    <span
                      className="w-2 h-2 rounded-sm shrink-0"
                      style={{ backgroundColor: doc.coverColor }}
                    />
                    <span className="truncate flex-1 text-left">{doc.title}</span>
                    {doc.pinned && <Pin className="w-3 h-3 opacity-50 shrink-0" />}
                  </button>
                );
              })}

              {notebooks.filter((n) => n.pinned).slice(0, 2).map((nb) => {
                const isSelected = activeNav === 'studio' && activeTargetId === nb.id;
                return (
                  <button
                    key={nb.id}
                    type="button"
                    onClick={() => {
                      onOpenNotebook(nb.id);
                      if (isOverlayDrawer) onCloseDrawer();
                    }}
                    className={`w-full h-8 px-2 rounded-lg flex items-center gap-2 text-xs transition-colors ${
                      isSelected
                        ? 'bg-[var(--luma-surface)] text-[var(--luma-ink)] font-semibold border border-[var(--luma-border)]'
                        : 'text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)] hover:bg-[var(--luma-surface-alt)]'
                    }`}
                  >
                    <PenTool className="w-3 h-3 shrink-0" style={{ color: nb.coverColor }} />
                    <span className="truncate flex-1 text-left">{nb.title}</span>
                    <Pin className="w-3 h-3 opacity-50 shrink-0" />
                  </button>
                );
              })}
            </div>
          )}
        </div>
      </div>

      {/* Bottom Mobile-Luma Style Dock: PWA Install + Clean 3-button strip (Amigos, Ajustes, Guía) + Profile Row */}
      <div className="p-2 border-t border-[var(--luma-border)] space-y-2">
        <PWAInstallButton compact className="w-full" />
        <div className="grid grid-cols-3 gap-1">
          <button
            type="button"
            onClick={() => {
              onOpenFriends();
              if (isOverlayDrawer) onCloseDrawer();
            }}
            title={`Amigos (${onlineFriendsCount} en línea)`}
            className="py-1.5 px-1 rounded-lg hover:bg-[var(--luma-surface-alt)] flex flex-col items-center justify-center gap-0.5 text-[11px] text-[var(--luma-ink)] transition-colors"
          >
            <Users className="w-4 h-4 text-[var(--luma-ink-muted)]" />
            <span className="font-medium truncate">Amigos</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onOpenSettings();
              if (isOverlayDrawer) onCloseDrawer();
            }}
            title="Configuración y Apariencia"
            className="py-1.5 px-1 rounded-lg hover:bg-[var(--luma-surface-alt)] flex flex-col items-center justify-center gap-0.5 text-[11px] text-[var(--luma-ink)] transition-colors"
          >
            <Settings className="w-4 h-4 text-[var(--luma-ink-muted)]" />
            <span className="font-medium truncate">Ajustes</span>
          </button>

          <button
            type="button"
            onClick={() => {
              onOpenGuide();
              if (isOverlayDrawer) onCloseDrawer();
            }}
            title="Guía · Cómo usar Luma"
            className="py-1.5 px-1 rounded-lg hover:bg-[var(--luma-surface-alt)] flex flex-col items-center justify-center gap-0.5 text-[11px] text-[var(--luma-ink)] transition-colors"
          >
            <BookOpen className="w-4 h-4 text-[var(--luma-ink-muted)]" />
            <span className="font-medium truncate">Guía</span>
          </button>
        </div>

        {/* User Profile Row */}
        <button
          type="button"
          onClick={() => {
            onOpenProfile();
            if (isOverlayDrawer) onCloseDrawer();
          }}
          className="w-full p-2 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-surface)] hover:bg-[var(--luma-surface-alt)] flex items-center gap-2.5 text-left transition-colors"
        >
          <div className="w-8 h-8 rounded-full overflow-hidden border border-[var(--luma-accent)]/60 bg-[var(--luma-accent-soft)] text-[var(--luma-accent)] text-xs font-bold flex items-center justify-center shrink-0">
            {profile.avatarDataUrl ? (
              <img
                src={profile.avatarDataUrl}
                alt={profile.username}
                className="w-full h-full object-cover"
              />
            ) : (
              userInitial
            )}
          </div>
          <div className="min-w-0 flex-1">
            <div className="text-xs font-semibold truncate text-[var(--luma-ink)]">
              {profile.username || 'Lector Luma'}
            </div>
            <div className="text-[10px] font-mono text-[var(--luma-ink-muted)] truncate">
              {profile.peerCode} · Cuenta
            </div>
          </div>
        </button>
      </div>

      {/* Desktop Resize Handle */}
      {!isOverlayDrawer && (
        <div
          onMouseDown={startResize}
          title="Arrastra para ajustar el ancho del menú"
          className="absolute top-0 right-0 w-1.5 h-full cursor-col-resize hover:bg-[var(--luma-accent)]/35 transition-colors"
        />
      )}
    </aside>
  );

  if (isOverlayDrawer) {
    return (
      <div className="fixed inset-0 z-40 flex">
        <div
          onClick={onCloseDrawer}
          className="fixed inset-0 bg-black/35 backdrop-blur-[1px]"
        />
        <div className="relative z-10 h-full shadow-2xl">{sidebarBody}</div>
      </div>
    );
  }

  return sidebarBody;
};
