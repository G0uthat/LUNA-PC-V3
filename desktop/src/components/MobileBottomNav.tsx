import React from 'react';
import { Cloud, Home, Library, Settings } from 'lucide-react';
import { WorkspaceTabKind } from '../types';

interface MobileBottomNavProps {
  activeNav: WorkspaceTabKind;
  pendingSyncCount: number;
  onNavigate: (kind: 'home' | 'library' | 'sources') => void;
  onOpenSettings: () => void;
}

export const MobileBottomNav: React.FC<MobileBottomNavProps> = ({
  activeNav,
  pendingSyncCount,
  onNavigate,
  onOpenSettings,
}) => {
  const items: Array<{
    id: 'home' | 'library' | 'sources' | 'settings';
    label: string;
    icon: React.ReactNode;
    active: boolean;
    badge?: number;
    onClick: () => void;
  }> = [
    {
      id: 'home',
      label: 'Inicio',
      icon: <Home className="w-5 h-5" />,
      active: activeNav === 'home',
      onClick: () => onNavigate('home'),
    },
    {
      id: 'library',
      label: 'Biblioteca',
      icon: <Library className="w-5 h-5" />,
      active: activeNav === 'library' || activeNav === 'sagas' || activeNav === 'notebooks',
      onClick: () => onNavigate('library'),
    },
    {
      id: 'sources',
      label: 'Fuentes',
      icon: <Cloud className="w-5 h-5" />,
      active: activeNav === 'sources',
      badge: pendingSyncCount > 0 ? pendingSyncCount : undefined,
      onClick: () => onNavigate('sources'),
    },
    {
      id: 'settings',
      label: 'Ajustes',
      icon: <Settings className="w-5 h-5" />,
      active: false,
      onClick: onOpenSettings,
    },
  ];

  return (
    <nav
      aria-label="Navegación móvil"
      style={{ paddingBottom: 'env(safe-area-inset-bottom, 0px)' }}
      className="md:hidden shrink-0 border-t border-[var(--luma-border)] bg-[var(--luma-surface)]/95 backdrop-blur-md grid grid-cols-4 z-30"
    >
      {items.map((item) => (
        <button
          key={item.id}
          type="button"
          onClick={item.onClick}
          className={`relative min-h-[56px] py-1.5 flex flex-col items-center justify-center gap-0.5 text-[11px] font-semibold transition-colors ${
            item.active
              ? 'text-[var(--luma-accent)]'
              : 'text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)]'
          }`}
        >
          <span className="relative">
            {item.icon}
            {item.badge && (
              <span className="absolute -top-1 -right-2 min-w-[16px] h-4 px-1 rounded-full bg-amber-500 text-white text-[9px] font-bold flex items-center justify-center tabular-nums">
                {item.badge}
              </span>
            )}
          </span>
          <span>{item.label}</span>
        </button>
      ))}
    </nav>
  );
};
