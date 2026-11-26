import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  CheckCircle2,
  Cloud,
  CloudOff,
  CloudUpload,
  Copy,
  Download,
  Edit3,
  ExternalLink,
  FileText,
  FolderInput,
  HardDrive,
  Info,
  Pause,
  Play,
  RefreshCw,
  ShieldAlert,
  Trash2,
  X,
} from 'lucide-react';
import {
  DownloadProgressState,
  DriveFileItem,
  DriveSource,
  StorageQuotaInfo,
  SyncConflict,
} from '../drive/driveTypes';
import { formatBytes } from '../drive/driveCache';

/* ============================================================================
 * 1. Download Confirmation & Resumable Progress Modal
 * ==========================================================================*/
interface DownloadConfirmModalProps {
  file: DriveFileItem | null;
  thumbnailUrl?: string | null;
  progress: DownloadProgressState | null;
  storageQuota: StorageQuotaInfo | null;
  onStartDownload: () => void;
  onPause: () => void;
  onResume: () => void;
  onCancel: () => void;
  onFreeSpace: () => void;
  onClose: () => void;
}

export const DownloadConfirmModal: React.FC<DownloadConfirmModalProps> = ({
  file,
  thumbnailUrl,
  progress,
  storageQuota,
  onStartDownload,
  onPause,
  onResume,
  onCancel,
  onFreeSpace,
  onClose,
}) => {
  if (!file || !progress) return null;

  const isConfirm = progress.status === 'confirm';
  const isDownloading = progress.status === 'downloading';
  const isPaused = progress.status === 'paused';
  const isError = progress.status === 'error';

  const speedLabel =
    progress.speedBytesPerSec > 0 ? `${formatBytes(progress.speedBytesPerSec)}/s` : 'Calculando...';

  return (
    <div
      onClick={() => {
        if (!isDownloading) onClose();
      }}
      className="fixed inset-0 z-[90] bg-black/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-3 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[440px] rounded-2xl border border-[var(--luma-border)] bg-[var(--luma-surface)] text-[var(--luma-ink)] shadow-2xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-[var(--luma-border)] flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 text-sm font-bold">
            <Download className="w-4 h-4 text-[var(--luma-accent)]" />
            <span>
              {isConfirm
                ? 'Descargar archivo de Drive'
                : isPaused
                  ? 'Descarga en pausa'
                  : isError
                    ? 'Error en la descarga'
                    : 'Descargando...'}
            </span>
          </div>
          {!isDownloading && (
            <button
              type="button"
              onClick={onClose}
              className="h-9 w-9 rounded-lg flex items-center justify-center text-[var(--luma-ink-muted)] hover:bg-[var(--luma-surface-alt)]"
            >
              <X className="w-4 h-4" />
            </button>
          )}
        </div>

        <div className="p-5 space-y-4">
          <div className="flex items-center gap-3.5">
            <div className="w-16 h-20 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-bg)] overflow-hidden flex items-center justify-center shrink-0">
              {thumbnailUrl ? (
                <img
                  src={thumbnailUrl}
                  alt={file.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <FileText className="w-7 h-7 text-[var(--luma-accent)]" />
              )}
            </div>
            <div className="min-w-0 flex-1 space-y-1">
              <p className="text-sm font-bold leading-snug line-clamp-2">{file.name}</p>
              <p className="text-xs text-[var(--luma-ink-muted)] tabular-nums">
                Tamaño: <strong className="text-[var(--luma-ink)]">{formatBytes(file.size)}</strong>
              </p>
              {file.partialPercent && file.partialPercent > 0 && isConfirm && (
                <p className="text-[11px] text-[var(--luma-accent)] font-medium">
                  Hay una descarga previa al {file.partialPercent}% — se reanudará automáticamente.
                </p>
              )}
            </div>
          </div>

          {isConfirm && (
            <p className="text-xs text-[var(--luma-ink-muted)] leading-relaxed">
              ¿Desea descargar <strong className="text-[var(--luma-ink)]">{file.name}</strong>? Se guardará una copia local en este dispositivo para abrirlo al instante incluso sin internet.
            </p>
          )}

          {storageQuota?.lowSpaceWarning && (
            <div className="p-3 rounded-xl border border-amber-500/40 bg-amber-500/10 text-xs space-y-2">
              <div className="flex items-center gap-2 font-semibold text-amber-600 dark:text-amber-400">
                <AlertTriangle className="w-4 h-4 shrink-0" />
                <span>Espacio local bajo ({formatBytes(storageQuota.cachedBytes)} en caché)</span>
              </div>
              <button
                type="button"
                onClick={onFreeSpace}
                className="h-8 px-3 rounded-lg bg-amber-600 text-white text-xs font-semibold hover:opacity-95"
              >
                Liberar espacio (sin borrar de Drive)
              </button>
            </div>
          )}

          {(isDownloading || isPaused) && (
            <div className="space-y-2">
              <div className="flex items-center justify-between text-xs tabular-nums">
                <span className="font-semibold text-[var(--luma-accent)]">{progress.percent}%</span>
                <span className="text-[var(--luma-ink-muted)]">
                  {formatBytes(progress.loadedBytes)} / {formatBytes(progress.totalBytes)} ·{' '}
                  {isPaused ? 'Pausado' : speedLabel}
                </span>
              </div>
              <div className="w-full h-2.5 rounded-full bg-[var(--luma-surface-alt)] overflow-hidden">
                <div
                  className="h-full bg-[var(--luma-accent)] rounded-full transition-all duration-150"
                  style={{ width: `${progress.percent}%` }}
                />
              </div>
            </div>
          )}

          {isError && (
            <div className="p-3 rounded-xl border border-red-500/35 bg-red-500/10 text-xs text-red-600 dark:text-red-400 leading-relaxed">
              {progress.errorMessage || 'No se pudo completar la descarga.'}
            </div>
          )}
        </div>

        <div className="px-5 py-3.5 border-t border-[var(--luma-border)] bg-[var(--luma-bg)] flex items-center justify-end gap-2">
          {isConfirm && (
            <>
              <button
                type="button"
                onClick={onClose}
                className="h-11 sm:h-9 px-4 rounded-xl border border-[var(--luma-border)] text-xs font-semibold hover:bg-[var(--luma-surface-alt)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onStartDownload}
                className="h-11 sm:h-9 px-4 rounded-xl bg-[var(--luma-accent)] text-[var(--luma-on-accent)] text-xs font-semibold inline-flex items-center gap-1.5 hover:opacity-95"
              >
                <Download className="w-3.5 h-3.5" />
                <span>{file.partialPercent ? 'Reanudar' : 'Descargar'}</span>
              </button>
            </>
          )}

          {isDownloading && (
            <>
              <button
                type="button"
                onClick={onCancel}
                className="h-11 sm:h-9 px-3.5 rounded-xl border border-[var(--luma-border)] text-xs font-semibold hover:bg-[var(--luma-surface-alt)]"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={onPause}
                className="h-11 sm:h-9 px-4 rounded-xl bg-[var(--luma-surface)] border border-[var(--luma-border)] text-xs font-semibold inline-flex items-center gap-1.5 hover:bg-[var(--luma-surface-alt)]"
              >
                <Pause className="w-3.5 h-3.5" />
                <span>Pausar</span>
              </button>
            </>
          )}

          {(isPaused || isError) && (
            <>
              <button
                type="button"
                onClick={onCancel}
                className="h-11 sm:h-9 px-3.5 rounded-xl border border-[var(--luma-border)] text-xs font-semibold text-red-500 hover:bg-red-500/10"
              >
                Cancelar y borrar
              </button>
              <button
                type="button"
                onClick={onResume}
                className="h-11 sm:h-9 px-4 rounded-xl bg-[var(--luma-accent)] text-[var(--luma-on-accent)] text-xs font-semibold inline-flex items-center gap-1.5"
              >
                <Play className="w-3.5 h-3.5" />
                <span>{isError ? 'Reintentar' : 'Reanudar'}</span>
              </button>
            </>
          )}
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 2. Context Menu (Long-Press / Right-Click) with Double-Confirmation Delete
 * ==========================================================================*/
export interface ContextMenuTarget {
  kind: 'drive_file' | 'local_doc' | 'local_notebook';
  id: string;
  title: string;
  sizeBytes?: number;
  modifiedLabel?: string;
  syncState?: string;
  downloaded?: boolean;
  driveFileId?: string;
  sourceId?: string;
  folderPath?: string;
  driveFile?: DriveFileItem;
}

interface DriveContextMenuProps {
  target: ContextMenuTarget | null;
  sources: DriveSource[];
  onClose: () => void;
  onOpen: () => void;
  onSync: () => void;
  onDownload?: () => void;
  onRename: (newName: string) => void;
  onMoveToSource?: (targetSourceId: string) => void;
  onDeleteLocal?: () => void;
  onDeleteFromDrive?: () => void;
}

export const DriveContextMenu: React.FC<DriveContextMenuProps> = ({
  target,
  sources,
  onClose,
  onOpen,
  onSync,
  onDownload,
  onRename,
  onMoveToSource,
  onDeleteLocal,
  onDeleteFromDrive,
}) => {
  const [subView, setSubView] = useState<'menu' | 'rename' | 'move' | 'info' | 'delete_drive_1' | 'delete_drive_2'>('menu');
  const [renameValue, setRenameValue] = useState('');
  const [deleteConfirmChecked, setDeleteConfirmChecked] = useState(false);

  if (!target) return null;

  const resetAndClose = () => {
    setSubView('menu');
    setDeleteConfirmChecked(false);
    onClose();
  };

  return (
    <div
      onClick={resetAndClose}
      className="fixed inset-0 z-[95] bg-black/45 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-2 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[400px] rounded-2xl border border-[var(--luma-border)] bg-[var(--luma-surface)] text-[var(--luma-ink)] shadow-2xl overflow-hidden"
      >
        {/* Header */}
        <div className="px-4 py-3.5 border-b border-[var(--luma-border)] flex items-center justify-between gap-2">
          <div className="min-w-0">
            <div className="text-sm font-bold truncate">{target.title}</div>
            <div className="text-[11px] text-[var(--luma-ink-muted)] flex items-center gap-1.5 mt-0.5">
              {target.downloaded ? (
                <span className="inline-flex items-center gap-1 text-emerald-600 dark:text-emerald-400">
                  <CheckCircle2 className="w-3 h-3" /> Copia local lista
                </span>
              ) : target.driveFileId ? (
                <span className="inline-flex items-center gap-1">
                  <Cloud className="w-3 h-3" /> En Google Drive
                </span>
              ) : (
                <span>Solo en este dispositivo</span>
              )}
              {typeof target.sizeBytes === 'number' && target.sizeBytes > 0 && (
                <span>· {formatBytes(target.sizeBytes)}</span>
              )}
            </div>
          </div>
          <button
            type="button"
            onClick={resetAndClose}
            className="h-9 w-9 rounded-lg flex items-center justify-center text-[var(--luma-ink-muted)] hover:bg-[var(--luma-surface-alt)] shrink-0"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Main Actions Menu */}
        {subView === 'menu' && (
          <div className="p-2 space-y-0.5 text-xs">
            <button
              type="button"
              onClick={() => {
                onOpen();
                resetAndClose();
              }}
              className="w-full h-11 px-3 rounded-xl hover:bg-[var(--luma-surface-alt)] flex items-center gap-3 font-medium"
            >
              <ExternalLink className="w-4 h-4 text-[var(--luma-accent)]" />
              <span>Abrir</span>
            </button>

            <button
              type="button"
              onClick={() => {
                onSync();
                resetAndClose();
              }}
              className="w-full h-11 px-3 rounded-xl hover:bg-[var(--luma-surface-alt)] flex items-center gap-3 font-medium"
            >
              <RefreshCw className="w-4 h-4 text-[var(--luma-accent)]" />
              <span>Sincronizar con Drive</span>
            </button>

            {onDownload && !target.downloaded && (
              <button
                type="button"
                onClick={() => {
                  onDownload();
                  resetAndClose();
                }}
                className="w-full h-11 px-3 rounded-xl hover:bg-[var(--luma-surface-alt)] flex items-center gap-3 font-medium"
              >
                <Download className="w-4 h-4 text-[var(--luma-accent)]" />
                <span>Descargar copia local</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => {
                setRenameValue(target.title);
                setSubView('rename');
              }}
              className="w-full h-11 px-3 rounded-xl hover:bg-[var(--luma-surface-alt)] flex items-center gap-3 font-medium"
            >
              <Edit3 className="w-4 h-4 text-[var(--luma-ink-muted)]" />
              <span>Renombrar</span>
            </button>

            {onMoveToSource && sources.length > 1 && target.driveFileId && (
              <button
                type="button"
                onClick={() => setSubView('move')}
                className="w-full h-11 px-3 rounded-xl hover:bg-[var(--luma-surface-alt)] flex items-center gap-3 font-medium"
              >
                <FolderInput className="w-4 h-4 text-[var(--luma-ink-muted)]" />
                <span>Mover a otra fuente</span>
              </button>
            )}

            <button
              type="button"
              onClick={() => setSubView('info')}
              className="w-full h-11 px-3 rounded-xl hover:bg-[var(--luma-surface-alt)] flex items-center gap-3 font-medium"
            >
              <Info className="w-4 h-4 text-[var(--luma-ink-muted)]" />
              <span>Información</span>
            </button>

            <div className="my-1 border-t border-[var(--luma-border)]" />

            {onDeleteLocal && (
              <button
                type="button"
                onClick={() => {
                  onDeleteLocal();
                  resetAndClose();
                }}
                className="w-full h-11 px-3 rounded-xl hover:bg-amber-500/10 text-amber-600 dark:text-amber-400 flex items-center gap-3 font-medium"
              >
                <HardDrive className="w-4 h-4" />
                <span>Eliminar copia local (liberar espacio)</span>
              </button>
            )}

            {onDeleteFromDrive && target.driveFileId && (
              <button
                type="button"
                onClick={() => setSubView('delete_drive_1')}
                className="w-full h-11 px-3 rounded-xl hover:bg-red-500/10 text-red-600 dark:text-red-400 flex items-center gap-3 font-semibold"
              >
                <Trash2 className="w-4 h-4" />
                <span>Eliminar de Google Drive...</span>
              </button>
            )}
          </div>
        )}

        {/* Rename Subview */}
        {subView === 'rename' && (
          <form
            onSubmit={(e) => {
              e.preventDefault();
              if (!renameValue.trim()) return;
              onRename(renameValue.trim());
              resetAndClose();
            }}
            className="p-4 space-y-3"
          >
            <label className="block text-xs font-semibold">Nuevo nombre</label>
            <input
              type="text"
              value={renameValue}
              onChange={(e) => setRenameValue(e.target.value)}
              autoFocus
              className="w-full h-11 px-3 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-bg)] text-sm outline-none focus:border-[var(--luma-accent)]"
            />
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSubView('menu')}
                className="h-10 px-3.5 rounded-xl border border-[var(--luma-border)] text-xs font-medium"
              >
                Atrás
              </button>
              <button
                type="submit"
                className="h-10 px-4 rounded-xl bg-[var(--luma-accent)] text-[var(--luma-on-accent)] text-xs font-semibold"
              >
                Guardar nombre
              </button>
            </div>
          </form>
        )}

        {/* Move Subview */}
        {subView === 'move' && onMoveToSource && (
          <div className="p-4 space-y-2.5">
            <div className="text-xs font-semibold">Mover archivo a otra fuente de Drive</div>
            <div className="space-y-1.5 max-h-[240px] overflow-y-auto">
              {sources
                .filter((s) => s.id !== target.sourceId)
                .map((src) => (
                  <button
                    key={src.id}
                    type="button"
                    onClick={() => {
                      onMoveToSource(src.id);
                      resetAndClose();
                    }}
                    className="w-full h-11 px-3 rounded-xl border border-[var(--luma-border)] hover:border-[var(--luma-accent)] flex items-center gap-2.5 text-xs font-semibold"
                  >
                    <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: src.color }} />
                    <span className="truncate">{src.name}</span>
                  </button>
                ))}
            </div>
            <button
              type="button"
              onClick={() => setSubView('menu')}
              className="h-9 px-3 rounded-lg border border-[var(--luma-border)] text-xs font-medium"
            >
              Volver
            </button>
          </div>
        )}

        {/* Info Subview */}
        {subView === 'info' && (
          <div className="p-4 space-y-3 text-xs">
            <div className="rounded-xl border border-[var(--luma-border)] bg-[var(--luma-bg)] divide-y divide-[var(--luma-border)]">
              <div className="px-3.5 py-2.5 flex justify-between gap-2">
                <span className="text-[var(--luma-ink-muted)]">Nombre</span>
                <span className="font-semibold truncate text-right">{target.title}</span>
              </div>
              <div className="px-3.5 py-2.5 flex justify-between gap-2">
                <span className="text-[var(--luma-ink-muted)]">Tamaño</span>
                <span className="font-mono tabular-nums">{formatBytes(target.sizeBytes ?? 0)}</span>
              </div>
              <div className="px-3.5 py-2.5 flex justify-between gap-2">
                <span className="text-[var(--luma-ink-muted)]">Modificado</span>
                <span>{target.modifiedLabel || 'Hoy'}</span>
              </div>
              <div className="px-3.5 py-2.5 flex justify-between gap-2">
                <span className="text-[var(--luma-ink-muted)]">Estado</span>
                <span className="font-semibold capitalize">{target.syncState || 'local'}</span>
              </div>
              {target.folderPath && (
                <div className="px-3.5 py-2.5 flex justify-between gap-2">
                  <span className="text-[var(--luma-ink-muted)]">Subcarpeta</span>
                  <span className="truncate text-right">{target.folderPath}</span>
                </div>
              )}
            </div>
            <button
              type="button"
              onClick={() => setSubView('menu')}
              className="w-full h-10 rounded-xl border border-[var(--luma-border)] font-semibold"
            >
              Cerrar información
            </button>
          </div>
        )}

        {/* Double Confirmation Step 1 */}
        {subView === 'delete_drive_1' && (
          <div className="p-4 space-y-4 text-xs">
            <div className="flex items-start gap-3 p-3 rounded-xl bg-red-500/10 border border-red-500/30 text-red-600 dark:text-red-400">
              <ShieldAlert className="w-5 h-5 shrink-0 mt-0.5" />
              <div>
                <div className="font-bold text-sm">Paso 1 de 2 · Eliminar de Google Drive</div>
                <p className="mt-1 leading-relaxed">
                  Esto borrará <strong>«{target.title}»</strong> directamente de tu cuenta de Google Drive. Si solo quieres ahorrar espacio aquí, usa «Eliminar copia local».
                </p>
              </div>
            </div>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSubView('menu')}
                className="h-10 px-4 rounded-xl border border-[var(--luma-border)] font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                onClick={() => {
                  setDeleteConfirmChecked(false);
                  setSubView('delete_drive_2');
                }}
                className="h-10 px-4 rounded-xl bg-red-600 text-white font-semibold"
              >
                Continuar (paso 2)
              </button>
            </div>
          </div>
        )}

        {/* Double Confirmation Step 2 */}
        {subView === 'delete_drive_2' && onDeleteFromDrive && (
          <div className="p-4 space-y-4 text-xs">
            <div className="font-bold text-sm text-red-600 dark:text-red-400">
              Paso 2 de 2 · Confirmación definitiva
            </div>
            <label className="flex items-start gap-2.5 p-3 rounded-xl border border-red-500/35 bg-red-500/5 cursor-pointer">
              <input
                type="checkbox"
                checked={deleteConfirmChecked}
                onChange={(e) => setDeleteConfirmChecked(e.target.checked)}
                className="w-4 h-4 mt-0.5 accent-red-600 shrink-0"
              />
              <span className="leading-relaxed">
                Confirmo que deseo eliminar permanentemente <strong>«{target.title}»</strong> de mi Google Drive.
              </span>
            </label>
            <div className="flex justify-end gap-2">
              <button
                type="button"
                onClick={() => setSubView('menu')}
                className="h-10 px-4 rounded-xl border border-[var(--luma-border)] font-medium"
              >
                Cancelar
              </button>
              <button
                type="button"
                disabled={!deleteConfirmChecked}
                onClick={() => {
                  onDeleteFromDrive();
                  resetAndClose();
                }}
                className="h-10 px-4 rounded-xl bg-red-600 text-white font-semibold disabled:opacity-40"
              >
                Sí, eliminar de Drive
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
};

/* ============================================================================
 * 3. Sync Conflict Resolution Modal
 * ==========================================================================*/
interface SyncConflictModalProps {
  conflict: SyncConflict | null;
  onResolve: (choice: 'keep_local' | 'keep_drive' | 'keep_both') => void;
  onClose: () => void;
}

export const SyncConflictModal: React.FC<SyncConflictModalProps> = ({
  conflict,
  onResolve,
  onClose,
}) => {
  if (!conflict) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[95] bg-black/50 backdrop-blur-[2px] flex items-center justify-center p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[460px] rounded-2xl border border-[var(--luma-border)] bg-[var(--luma-surface)] text-[var(--luma-ink)] shadow-2xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-[var(--luma-border)] flex items-center justify-between">
          <div className="flex items-center gap-2 text-sm font-bold text-amber-600 dark:text-amber-400">
            <AlertTriangle className="w-4 h-4" />
            <span>Conflicto de sincronización</span>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-[var(--luma-surface-alt)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-5 space-y-4 text-xs">
          <p className="leading-relaxed text-[var(--luma-ink-muted)]">
            <strong className="text-[var(--luma-ink)]">«{conflict.title}»</strong> fue modificado tanto en este dispositivo como en Google Drive desde la última sincronización. Elige qué versión conservar:
          </p>

          <div className="grid grid-cols-2 gap-2.5">
            <div className="p-3 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-bg)]">
              <div className="font-semibold">Versión local</div>
              <div className="text-[11px] text-[var(--luma-ink-muted)] mt-0.5">
                {new Date(conflict.localUpdatedAt).toLocaleString('es-ES')}
              </div>
            </div>
            <div className="p-3 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-bg)]">
              <div className="font-semibold">Versión en Drive</div>
              <div className="text-[11px] text-[var(--luma-ink-muted)] mt-0.5">
                {new Date(conflict.driveModifiedTime).toLocaleString('es-ES')}
              </div>
            </div>
          </div>

          <div className="space-y-2">
            <button
              type="button"
              onClick={() => onResolve('keep_local')}
              className="w-full h-11 px-4 rounded-xl bg-[var(--luma-accent)] text-[var(--luma-on-accent)] font-semibold flex items-center justify-center gap-2"
            >
              <CloudUpload className="w-4 h-4" />
              <span>Conservar versión local (subir a Drive)</span>
            </button>
            <button
              type="button"
              onClick={() => onResolve('keep_drive')}
              className="w-full h-11 px-4 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)] font-semibold flex items-center justify-center gap-2"
            >
              <Download className="w-4 h-4 text-[var(--luma-accent)]" />
              <span>Conservar versión de Drive (descargar aquí)</span>
            </button>
            <button
              type="button"
              onClick={() => onResolve('keep_both')}
              className="w-full h-11 px-4 rounded-xl border border-[var(--luma-border)] hover:bg-[var(--luma-surface-alt)] font-semibold flex items-center justify-center gap-2"
            >
              <Copy className="w-4 h-4" />
              <span>Conservar ambas (crear copia renombrada)</span>
            </button>
          </div>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 4. Save Destination Picker Modal (on Create Notebook or Import File)
 * ==========================================================================*/
interface SaveDestinationModalProps {
  open: boolean;
  itemLabel: string;
  sources: DriveSource[];
  onConfirm: (sourceId: string | null) => void;
  onClose: () => void;
}

export const SaveDestinationModal: React.FC<SaveDestinationModalProps> = ({
  open,
  itemLabel,
  sources,
  onConfirm,
  onClose,
}) => {
  const activeSources = sources.filter((s) => s.active);
  const defaultSrc = activeSources.find((s) => s.isDefault) ?? activeSources[0];
  const [selectedSourceId, setSelectedSourceId] = useState<string | null>(defaultSrc?.id ?? null);

  React.useEffect(() => {
    if (open) {
      const def = sources.find((s) => s.active && s.isDefault) ?? sources.find((s) => s.active);
      setSelectedSourceId(def?.id ?? null);
    }
  }, [open, sources]);

  if (!open) return null;

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[95] bg-black/50 backdrop-blur-[2px] flex items-end sm:items-center justify-center p-3"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[420px] rounded-2xl border border-[var(--luma-border)] bg-[var(--luma-surface)] text-[var(--luma-ink)] shadow-2xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-[var(--luma-border)] flex items-center justify-between">
          <div>
            <h3 className="text-sm font-bold">¿Dónde deseas guardar?</h3>
            <p className="text-[11px] text-[var(--luma-ink-muted)] mt-0.5 truncate">{itemLabel}</p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-8 w-8 rounded-lg flex items-center justify-center hover:bg-[var(--luma-surface-alt)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="p-4 space-y-2 max-h-[300px] overflow-y-auto">
          {activeSources.map((src) => {
            const active = selectedSourceId === src.id;
            return (
              <button
                key={src.id}
                type="button"
                onClick={() => setSelectedSourceId(src.id)}
                className={`w-full p-3 rounded-xl border text-left flex items-center justify-between gap-3 transition-colors ${
                  active
                    ? 'border-[var(--luma-accent)] bg-[var(--luma-accent-soft)]'
                    : 'border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)]'
                }`}
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  <span className="w-3 h-3 rounded-full shrink-0" style={{ backgroundColor: src.color }} />
                  <div className="min-w-0">
                    <div className="text-xs font-bold truncate">{src.name}</div>
                    <div className="text-[11px] text-[var(--luma-ink-muted)]">
                      Google Drive {src.isDefault ? '· Por defecto' : ''}
                    </div>
                  </div>
                </div>
                {active && <Check className="w-4 h-4 text-[var(--luma-accent)] shrink-0" />}
              </button>
            );
          })}

          <button
            type="button"
            onClick={() => setSelectedSourceId(null)}
            className={`w-full p-3 rounded-xl border text-left flex items-center justify-between gap-3 transition-colors ${
              selectedSourceId === null
                ? 'border-[var(--luma-accent)] bg-[var(--luma-accent-soft)]'
                : 'border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)]'
            }`}
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <CloudOff className="w-4 h-4 text-[var(--luma-ink-muted)] shrink-0" />
              <div>
                <div className="text-xs font-bold">Solo en este dispositivo</div>
                <div className="text-[11px] text-[var(--luma-ink-muted)]">
                  Sin subir a Drive por ahora
                </div>
              </div>
            </div>
            {selectedSourceId === null && <Check className="w-4 h-4 text-[var(--luma-accent)] shrink-0" />}
          </button>
        </div>

        <div className="px-5 py-3.5 border-t border-[var(--luma-border)] bg-[var(--luma-bg)] flex justify-end gap-2">
          <button
            type="button"
            onClick={onClose}
            className="h-10 px-4 rounded-xl border border-[var(--luma-border)] text-xs font-medium"
          >
            Cancelar
          </button>
          <button
            type="button"
            onClick={() => onConfirm(selectedSourceId)}
            className="h-10 px-4 rounded-xl bg-[var(--luma-accent)] text-[var(--luma-on-accent)] text-xs font-semibold"
          >
            Guardar aquí
          </button>
        </div>
      </div>
    </div>
  );
};

/* ============================================================================
 * 5. Step-by-Step Client ID Visual Guide Modal ("¿Cómo obtengo mi Client ID?")
 * ==========================================================================*/
export const ClientIdGuideModal: React.FC<{ open: boolean; onClose: () => void }> = ({
  open,
  onClose,
}) => {
  const [copiedOrigin, setCopiedOrigin] = useState(false);
  if (!open) return null;

  const currentOrigin = typeof window !== 'undefined' ? window.location.origin : 'https://tu-dominio.app';

  const steps = [
    {
      num: 1,
      title: 'Crea un proyecto gratis en Google Cloud Console',
      desc: 'Entra en console.cloud.google.com, pulsa «Seleccionar proyecto → Proyecto nuevo», ponle nombre «Luma Personal» y pulsa Crear.',
      visual: 'Google Cloud Console  ▸  Nuevo proyecto  ▸  «Luma Personal»',
    },
    {
      num: 2,
      title: 'Activa Google Drive API (y opcionalmente Google Picker API)',
      desc: 'En el menú izquierdo abre «APIs y servicios → Biblioteca», busca «Google Drive API» y pulsa Activar. Si usarás el selector visual de carpetas, activa también «Google Picker API».',
      visual: 'APIs y servicios  ▸  Biblioteca  ▸  Google Drive API [Activar]',
    },
    {
      num: 3,
      title: 'Configura la pantalla de consentimiento OAuth',
      desc: 'Ve a «Google Auth Platform / Pantalla de consentimiento OAuth», elige «Externo», escribe «Luma» como nombre y tu correo. En «Usuarios de prueba», agrega TU propio correo de Gmail.',
      visual: 'Tipo: Externo  ▸  Usuarios de prueba  ▸  + tu-correo@gmail.com',
    },
    {
      num: 4,
      title: 'Crea tu ID de cliente OAuth (Aplicación web)',
      desc: 'Abre «Credenciales → Crear credenciales → ID de cliente de OAuth → Aplicación web». En «Orígenes de JavaScript autorizados» pega exactamente tu origen actual:',
      visual: currentOrigin,
      copyable: true,
    },
    {
      num: 5,
      title: 'Copia el Client ID y pégalo en Luma',
      desc: 'Google te dará un código terminado en «.apps.googleusercontent.com». Pégalo en Ajustes → Fuentes en Luma. Se cifra localmente con Web Crypto (AES-GCM) y nunca sale a servidores de terceros.',
      visual: 'xxxxxxxxxxxx-yyyyyyyyyyyy.apps.googleusercontent.com',
    },
  ];

  return (
    <div
      onClick={onClose}
      className="fixed inset-0 z-[100] bg-black/55 backdrop-blur-[2px] flex items-center justify-center p-3 sm:p-4"
    >
      <div
        onClick={(e) => e.stopPropagation()}
        className="w-full max-w-[600px] max-h-[88vh] flex flex-col rounded-2xl border border-[var(--luma-border)] bg-[var(--luma-surface)] text-[var(--luma-ink)] shadow-2xl overflow-hidden"
      >
        <div className="px-5 py-4 border-b border-[var(--luma-border)] flex items-center justify-between gap-2 shrink-0">
          <div>
            <h3 className="text-sm font-bold">¿Cómo obtengo mi Client ID de Google?</h3>
            <p className="text-[11px] text-[var(--luma-ink-muted)] mt-0.5">
              Gratis, sin tarjeta y 100% bajo tu control (cero servidores externos)
            </p>
          </div>
          <button
            type="button"
            onClick={onClose}
            className="h-9 w-9 rounded-lg flex items-center justify-center hover:bg-[var(--luma-surface-alt)]"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-3.5">
          {steps.map((st) => (
            <div
              key={st.num}
              className="p-3.5 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-bg)] space-y-2"
            >
              <div className="flex items-center gap-2.5">
                <span className="w-6 h-6 rounded-full bg-[var(--luma-accent)] text-[var(--luma-on-accent)] text-xs font-bold flex items-center justify-center shrink-0">
                  {st.num}
                </span>
                <span className="text-xs font-bold">{st.title}</span>
              </div>
              <p className="text-xs text-[var(--luma-ink-muted)] leading-relaxed pl-8">{st.desc}</p>
              <div className="ml-8 px-3 py-2 rounded-lg border border-dashed border-[var(--luma-border)] bg-[var(--luma-surface)] font-mono text-[11px] flex items-center justify-between gap-2">
                <span className="truncate">{st.visual}</span>
                {st.copyable && (
                  <button
                    type="button"
                    onClick={() => {
                      navigator.clipboard?.writeText(currentOrigin).catch(() => undefined);
                      setCopiedOrigin(true);
                      window.setTimeout(() => setCopiedOrigin(false), 1800);
                    }}
                    className="h-7 px-2.5 rounded-md bg-[var(--luma-accent-soft)] text-[var(--luma-accent)] text-[11px] font-sans font-semibold inline-flex items-center gap-1 shrink-0"
                  >
                    {copiedOrigin ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
                    <span>{copiedOrigin ? 'Copiado' : 'Copiar origen'}</span>
                  </button>
                )}
              </div>
            </div>
          ))}
        </div>

        <div className="px-5 py-3.5 border-t border-[var(--luma-border)] bg-[var(--luma-bg)] flex items-center justify-between gap-2 shrink-0">
          <a
            href="https://console.cloud.google.com/apis/credentials"
            target="_blank"
            rel="noopener noreferrer"
            className="text-xs font-semibold text-[var(--luma-accent)] inline-flex items-center gap-1 hover:underline"
          >
            <span>Abrir Google Cloud Console</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
          <button
            type="button"
            onClick={onClose}
            className="h-9 px-4 rounded-xl bg-[var(--luma-accent)] text-[var(--luma-on-accent)] text-xs font-semibold"
          >
            Entendido
          </button>
        </div>
      </div>
    </div>
  );
};
