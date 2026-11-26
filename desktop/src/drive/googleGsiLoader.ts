import { useCallback, useEffect, useState } from 'react';

export const GIS_SCRIPT_SRC = 'https://accounts.google.com/gsi/client';

export type GsiLoadStatus = 'loading' | 'ready' | 'error';

export interface GsiStateSnapshot {
  status: GsiLoadStatus;
  errorMessage: string | null;
}

let currentState: GsiStateSnapshot = {
  status:
    typeof window !== 'undefined' && window.google?.accounts?.oauth2 ? 'ready' : 'loading',
  errorMessage: null,
};

let inflightPromise: Promise<void> | null = null;
const listeners = new Set<(snap: GsiStateSnapshot) => void>();

function emitState(next: GsiStateSnapshot): void {
  currentState = next;
  listeners.forEach((fn) => fn(next));
}

function isGisReadyInWindow(): boolean {
  return Boolean(typeof window !== 'undefined' && window.google?.accounts?.oauth2);
}

/**
 * Carga el script oficial de Google Identity Services (https://accounts.google.com/gsi/client)
 * de forma asíncrona y notifica el estado de carga para habilitar el botón de inicio de sesión.
 */
export function loadGoogleGsiScript(forceRetry = false): Promise<void> {
  if (typeof window === 'undefined' || typeof document === 'undefined') {
    return Promise.resolve();
  }

  if (isGisReadyInWindow()) {
    if (currentState.status !== 'ready') {
      emitState({ status: 'ready', errorMessage: null });
    }
    return Promise.resolve();
  }

  if (inflightPromise && !forceRetry) {
    return inflightPromise;
  }

  if (typeof navigator !== 'undefined' && !navigator.onLine) {
    const offlineMsg =
      'Sin conexión a internet. Conéctate para iniciar sesión con Google o continúa sin conexión.';
    emitState({ status: 'error', errorMessage: offlineMsg });
    return Promise.reject(new Error(offlineMsg));
  }

  emitState({ status: 'loading', errorMessage: null });

  inflightPromise = new Promise<void>((resolve, reject) => {
    const existing = document.querySelector<HTMLScriptElement>(
      `script[src="${GIS_SCRIPT_SRC}"]`
    );
    if (existing && forceRetry) {
      existing.remove();
    }

    const script = document.createElement('script');
    script.src = GIS_SCRIPT_SRC;
    script.async = true;
    script.defer = true;

    let settled = false;
    const timeoutId = window.setTimeout(() => {
      if (settled) return;
      settled = true;
      inflightPromise = null;
      if (isGisReadyInWindow()) {
        emitState({ status: 'ready', errorMessage: null });
        resolve();
        return;
      }
      const msg =
        'No se pudo cargar Google Identity Services. Verifica tu conexión o bloqueadores de scripts.';
      emitState({ status: 'error', errorMessage: msg });
      reject(new Error(msg));
    }, 12_000);

    script.onload = () => {
      if (settled) return;
      // Wait a micro-tick in case GIS initializes window.google.accounts.oauth2 right after onload
      window.setTimeout(() => {
        if (settled) return;
        settled = true;
        window.clearTimeout(timeoutId);
        inflightPromise = null;
        if (isGisReadyInWindow()) {
          emitState({ status: 'ready', errorMessage: null });
          resolve();
        } else {
          const msg = 'El servicio de Google no quedó disponible. Inténtalo de nuevo.';
          emitState({ status: 'error', errorMessage: msg });
          reject(new Error(msg));
        }
      }, 40);
    };

    script.onerror = () => {
      if (settled) return;
      settled = true;
      window.clearTimeout(timeoutId);
      inflightPromise = null;
      script.remove();
      const msg =
        typeof navigator !== 'undefined' && !navigator.onLine
          ? 'Sin conexión a internet. Conéctate para iniciar sesión con Google.'
          : 'No se pudo cargar el inicio de sesión de Google. Revisa tu conexión o bloqueadores de scripts.';
      emitState({ status: 'error', errorMessage: msg });
      reject(new Error(msg));
    };

    document.head.appendChild(script);
  });

  return inflightPromise;
}

export function useGoogleGsi() {
  const [snap, setSnap] = useState<GsiStateSnapshot>(() => currentState);

  useEffect(() => {
    listeners.add(setSnap);
    setSnap(currentState);

    if (currentState.status !== 'ready') {
      loadGoogleGsiScript().catch(() => undefined);
    }

    const onOnline = () => {
      if (!isGisReadyInWindow()) {
        loadGoogleGsiScript(true).catch(() => undefined);
      }
    };
    window.addEventListener('online', onOnline);

    return () => {
      listeners.delete(setSnap);
      window.removeEventListener('online', onOnline);
    };
  }, []);

  const retry = useCallback(() => {
    void loadGoogleGsiScript(true).catch(() => undefined);
  }, []);

  return {
    status: snap.status,
    ready: snap.status === 'ready',
    loading: snap.status === 'loading',
    errorMessage: snap.errorMessage,
    retry,
  };
}
