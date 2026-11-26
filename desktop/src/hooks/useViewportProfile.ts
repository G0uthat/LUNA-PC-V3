import { useEffect, useMemo, useState } from 'react';
import { InterfaceDensity, ViewportTier } from '../types';

export interface ViewportProfile {
  width: number;
  height: number;
  tier: ViewportTier;
  tierLabel: string;
  sidebarMode: 'drawer' | 'rail' | 'expanded';
  recommendedSidebarWidth: number;
  minSidebarWidth: number;
  maxSidebarWidth: number;
  canvaRailWidth: number;
  canvaDrawerWidth: number;
  inspectorWidth: number;
  titlebarHeight: number;
  canSplitView: boolean;
  canTwoPageSpread: boolean;
  cardMinWidth: number;
  densityScale: number;
}

function classifyTier(width: number): ViewportTier {
  if (width < 820) return 'compact';
  if (width < 1120) return 'tablet';
  if (width < 1440) return 'laptop';
  if (width < 1920) return 'desktop';
  return 'ultrawide';
}

export function useViewportProfile(density: InterfaceDensity = 'auto'): ViewportProfile {
  const [size, setSize] = useState(() => ({
    width: typeof window !== 'undefined' ? window.innerWidth : 1440,
    height: typeof window !== 'undefined' ? window.innerHeight : 900,
  }));

  useEffect(() => {
    let raf = 0;
    const onResize = () => {
      cancelAnimationFrame(raf);
      raf = requestAnimationFrame(() => {
        setSize({ width: window.innerWidth, height: window.innerHeight });
      });
    };
    window.addEventListener('resize', onResize, { passive: true });
    return () => {
      cancelAnimationFrame(raf);
      window.removeEventListener('resize', onResize);
    };
  }, []);

  return useMemo(() => {
    const tier = classifyTier(size.width);

    const densityMultiplier =
      density === 'compact'
        ? 0.9
        : density === 'spacious'
          ? 1.08
          : density === 'comfortable'
            ? 1.0
            : tier === 'compact'
              ? 0.92
              : tier === 'laptop'
                ? 0.96
                : tier === 'ultrawide'
                  ? 1.06
                  : 1.0;

    switch (tier) {
      case 'compact':
        return {
          width: size.width,
          height: size.height,
          tier,
          tierLabel: 'Ventana compacta',
          sidebarMode: 'drawer',
          recommendedSidebarWidth: 250,
          minSidebarWidth: 220,
          maxSidebarWidth: 280,
          canvaRailWidth: 52,
          canvaDrawerWidth: 220,
          inspectorWidth: 260,
          titlebarHeight: 46,
          canSplitView: false,
          canTwoPageSpread: false,
          cardMinWidth: 152,
          densityScale: densityMultiplier,
        };
      case 'tablet':
        return {
          width: size.width,
          height: size.height,
          tier,
          tierLabel: 'Pantalla dividida / 1024p',
          sidebarMode: 'rail',
          recommendedSidebarWidth: 228,
          minSidebarWidth: 200,
          maxSidebarWidth: 264,
          canvaRailWidth: 56,
          canvaDrawerWidth: 236,
          inspectorWidth: 264,
          titlebarHeight: 46,
          canSplitView: false,
          canTwoPageSpread: false,
          cardMinWidth: 168,
          densityScale: densityMultiplier,
        };
      case 'laptop':
        return {
          width: size.width,
          height: size.height,
          tier,
          tierLabel: 'Portátil HD / 1366p',
          sidebarMode: 'expanded',
          recommendedSidebarWidth: Math.round(232 * densityMultiplier),
          minSidebarWidth: 204,
          maxSidebarWidth: 280,
          canvaRailWidth: 60,
          canvaDrawerWidth: 248,
          inspectorWidth: 272,
          titlebarHeight: 46,
          canSplitView: true,
          canTwoPageSpread: false,
          cardMinWidth: 184,
          densityScale: densityMultiplier,
        };
      case 'desktop':
        return {
          width: size.width,
          height: size.height,
          tier,
          tierLabel: 'Escritorio FHD / 1440p',
          sidebarMode: 'expanded',
          recommendedSidebarWidth: Math.round(252 * densityMultiplier),
          minSidebarWidth: 210,
          maxSidebarWidth: 312,
          canvaRailWidth: 64,
          canvaDrawerWidth: 264,
          inspectorWidth: 288,
          titlebarHeight: 48,
          canSplitView: true,
          canTwoPageSpread: true,
          cardMinWidth: 196,
          densityScale: densityMultiplier,
        };
      case 'ultrawide':
      default:
        return {
          width: size.width,
          height: size.height,
          tier,
          tierLabel: 'Monitor 4K / UltraWide',
          sidebarMode: 'expanded',
          recommendedSidebarWidth: Math.round(274 * densityMultiplier),
          minSidebarWidth: 224,
          maxSidebarWidth: 340,
          canvaRailWidth: 70,
          canvaDrawerWidth: 288,
          inspectorWidth: 312,
          titlebarHeight: 50,
          canSplitView: true,
          canTwoPageSpread: true,
          cardMinWidth: 212,
          densityScale: densityMultiplier,
        };
    }
  }, [size.width, size.height, density]);
}
