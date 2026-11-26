// Stub usado solo en el build de Electron (sin PWA / service worker).
export function registerSW(_options?: unknown): () => Promise<void> {
  return async () => {};
}
