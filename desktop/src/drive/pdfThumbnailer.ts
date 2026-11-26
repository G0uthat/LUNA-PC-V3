import * as pdfjsLib from 'pdfjs-dist';
import pdfWorkerUrl from 'pdfjs-dist/build/pdf.worker.min.mjs?url';
import { getCachedDriveFile, getCachedThumbnail, putCachedThumbnail } from './driveCache';

pdfjsLib.GlobalWorkerOptions.workerSrc = pdfWorkerUrl;

const inFlight = new Map<string, Promise<string | null>>();

/**
 * Renders page 1 of a locally cached PDF (or image blob) to a lightweight JPEG thumbnail
 * and persists it in IndexedDB so large Drive folders render instantaneously.
 */
export async function getOrRenderDriveThumbnail(
  fileId: string,
  mimeType: string,
  fallbackRemoteThumb?: string
): Promise<string | null> {
  const cachedThumb = await getCachedThumbnail(fileId);
  if (cachedThumb) return cachedThumb;

  if (inFlight.has(fileId)) {
    return inFlight.get(fileId)!;
  }

  const task = (async (): Promise<string | null> => {
    try {
      const cachedFile = await getCachedDriveFile(fileId);
      if (cachedFile?.completed && cachedFile.blob) {
        if (mimeType === 'application/pdf' || cachedFile.name.toLowerCase().endsWith('.pdf')) {
          const buf = await cachedFile.blob.arrayBuffer();
          const loadingTask = pdfjsLib.getDocument({ data: new Uint8Array(buf) });
          const pdf = await loadingTask.promise;
          const page = await pdf.getPage(1);
          const vp = page.getViewport({ scale: 1 });
          const scale = Math.min(260 / vp.width, 340 / vp.height);
          const scaled = page.getViewport({ scale });
          const canvas = document.createElement('canvas');
          canvas.width = Math.max(1, Math.round(scaled.width));
          canvas.height = Math.max(1, Math.round(scaled.height));
          const ctx = canvas.getContext('2d');
          if (ctx) {
            ctx.fillStyle = '#FFFFFF';
            ctx.fillRect(0, 0, canvas.width, canvas.height);
            await page.render({ canvasContext: ctx, viewport: scaled, canvas }).promise;
            const dataUrl = canvas.toDataURL('image/jpeg', 0.78);
            await putCachedThumbnail(fileId, dataUrl);
            await loadingTask.destroy();
            return dataUrl;
          }
          await loadingTask.destroy();
        } else if (mimeType.startsWith('image/')) {
          const dataUrl = await blobToResizedThumb(cachedFile.blob);
          if (dataUrl) {
            await putCachedThumbnail(fileId, dataUrl);
            return dataUrl;
          }
        } else if (cachedFile.name.toLowerCase().endsWith('.luma.json')) {
          const text = await cachedFile.blob.text();
          const parsed = JSON.parse(text) as { thumbnailDataUrl?: string };
          if (parsed.thumbnailDataUrl) {
            await putCachedThumbnail(fileId, parsed.thumbnailDataUrl);
            return parsed.thumbnailDataUrl;
          }
        }
      }
      return fallbackRemoteThumb ?? null;
    } catch {
      return fallbackRemoteThumb ?? null;
    } finally {
      inFlight.delete(fileId);
    }
  })();

  inFlight.set(fileId, task);
  return task;
}

function blobToResizedThumb(blob: Blob): Promise<string | null> {
  return new Promise((resolve) => {
    const url = URL.createObjectURL(blob);
    const img = new Image();
    img.onload = () => {
      try {
        const maxW = 260;
        const scale = Math.min(1, maxW / Math.max(1, img.naturalWidth));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
        canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
        const ctx = canvas.getContext('2d');
        if (ctx) {
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
          resolve(canvas.toDataURL('image/jpeg', 0.78));
        } else {
          resolve(null);
        }
      } catch {
        resolve(null);
      } finally {
        URL.revokeObjectURL(url);
      }
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      resolve(null);
    };
    img.src = url;
  });
}
