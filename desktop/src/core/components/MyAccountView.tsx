import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  Cloud,
  ExternalLink,
  Laptop,
  LogOut,
  Monitor,
  Pencil,
  Smartphone,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { AuthSessionState, DeviceRecord } from '../types';
import { LUMA_CORE_CONFIG } from '../config';
import { GoogleSignInAction } from './GoogleSignInAction';

interface MyAccountViewProps {
  session: AuthSessionState;
  onSignInGoogle: () => Promise<void>;
  onSignOut: () => void;
  onWipeLocalAndDisconnect: () => Promise<void>;
  onUpdateDisplayName: (name: string) => void;
  onRenameDevice: (deviceId: string, name: string) => void;
  onRemoveDevice: (deviceId: string) => void;
}

function renderPlatformIcon(platform: DeviceRecord['platform']) {
  if (platform === 'android' || platform === 'ios') {
    return <Smartphone className="w-4 h-4 text-[var(--luma-accent)] shrink-0" />;
  }
  if (platform === 'macos' || platform === 'windows' || platform === 'linux') {
    return <Laptop className="w-4 h-4 text-[var(--luma-accent)] shrink-0" />;
  }
  return <Monitor className="w-4 h-4 text-[var(--luma-accent)] shrink-0" />;
}

/**
 * Vista "Mi cuenta" compartida por Luma PC y Móvil.
 * Soporta los dos estados completos:
 * 1) SIN SESIÓN: tarjeta explicativa + botón directo "Iniciar sesión con Google".
 * 2) CON SESIÓN: foto, nombre editable, correo, insignia Beta, hasta 5 dispositivos, cerrar sesión y borrado total opcional.
 */
export const MyAccountView: React.FC<MyAccountViewProps> = ({
  session,
  onSignInGoogle,
  onSignOut,
  onWipeLocalAndDisconnect,
  onUpdateDisplayName,
  onRenameDevice,
  onRemoveDevice,
}) => {
  const [nameDraft, setNameDraft] = useState(session.user?.displayName ?? '');
  const [nameSaved, setNameSaved] = useState(false);

  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [deviceDraft, setDeviceDraft] = useState('');
  const [confirmWipeOpen, setConfirmWipeOpen] = useState(false);
  const [wipeBusy, setWipeBusy] = useState(false);

  React.useEffect(() => {
    setNameDraft(session.user?.displayName ?? '');
  }, [session.user?.displayName]);

  // ESTADO 1: SIN SESIÓN
  if (!session.connected || !session.user) {
    return (
      <div className="space-y-5 luma-view-enter">
        <div className="p-5 rounded-2xl border border-[var(--luma-border)] bg-[var(--luma-bg)] space-y-4">
          <div className="flex items-start gap-3.5">
            <div className="w-12 h-12 rounded-2xl bg-[var(--luma-surface-alt)] border border-[var(--luma-border)] flex items-center justify-center text-[var(--luma-ink-muted)] shrink-0">
              <Cloud className="w-5 h-5" />
            </div>
            <div className="space-y-1">
              <h3 className="text-sm font-bold text-[var(--luma-ink)]">No has iniciado sesión</h3>
              <p className="text-xs text-[var(--luma-ink-muted)] leading-relaxed">
                Estás usando Luma en modo local sin conexión. Todos tus libros, cuadernos y notas se guardan en este dispositivo.
              </p>
            </div>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 text-xs">
            {[
              'Sincroniza libros, avances y cuadernos en hasta 5 dispositivos.',
              'Usa tu propio Google Drive: cero servidores externos ni costos.',
              'Tus archivos actuales se conservan intactos y podrás subirlos al conectar.',
              'Puedes cerrar sesión cuando quieras y seguir trabajando sin internet.',
            ].map((benefit) => (
              <div
                key={benefit}
                className="p-2.5 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-surface)] flex items-start gap-2"
              >
                <Check className="w-3.5 h-3.5 text-emerald-500 shrink-0 mt-0.5" />
                <span className="text-[11px] leading-snug text-[var(--luma-ink)]">{benefit}</span>
              </div>
            ))}
          </div>

          <GoogleSignInAction
            label="Iniciar sesión con Google"
            onSignInGoogle={onSignInGoogle}
            showDriveNote
            compact
          />
        </div>

        {/* Enlace de comentarios de Beta */}
        <div className="p-3.5 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-bg)] flex items-center justify-between gap-3 text-xs">
          <div>
            <div className="font-semibold">¿Encontraste un detalle en esta Beta?</div>
            <div className="text-[11px] text-[var(--luma-ink-muted)]">
              Ayúdanos a mejorar Luma multiplataforma enviando tus comentarios.
            </div>
          </div>
          <a
            href={LUMA_CORE_CONFIG.betaFeedbackFormUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-8 px-3 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-surface)] hover:bg-[var(--luma-surface-alt)] font-semibold inline-flex items-center gap-1.5 shrink-0"
          >
            <span>Enviar opinión</span>
            <ExternalLink className="w-3 h-3" />
          </a>
        </div>
      </div>
    );
  }

  // ESTADO 2: CON SESIÓN
  const initial = (session.user.displayName.trim()[0] || session.user.email[0] || 'L').toUpperCase();

  return (
    <div className="space-y-5 luma-view-enter">
      {/* Cabecera de cuenta conectada */}
      <section className="p-4 rounded-2xl border border-[var(--luma-border)] bg-[var(--luma-bg)] flex flex-col sm:flex-row sm:items-center gap-4">
        <div className="w-16 h-16 rounded-full overflow-hidden border-2 border-[var(--luma-accent)] bg-[var(--luma-accent-soft)] flex items-center justify-center shrink-0">
          {session.user.avatarUrl ? (
            <img
              src={session.user.avatarUrl}
              alt={session.user.displayName}
              className="w-full h-full object-cover"
              referrerPolicy="no-referrer"
            />
          ) : (
            <span className="text-xl font-bold text-[var(--luma-accent)]">{initial}</span>
          )}
        </div>

        <div className="flex-1 min-w-0 space-y-2">
          <div className="flex flex-wrap items-center gap-2">
            <span className="inline-flex items-center gap-1 px-2.5 py-0.5 rounded-full bg-[var(--luma-accent-soft)] text-[var(--luma-accent)] text-[11px] font-bold">
              <Sparkles className="w-3 h-3" />
              {session.entitlement.badgeLabel}
            </span>
            <span className="text-[11px] text-emerald-600 dark:text-emerald-400 font-semibold">
              Google Drive conectado
            </span>
          </div>

          <div className="text-xs text-[var(--luma-ink-muted)] truncate">{session.user.email}</div>

          <div className="flex flex-wrap items-center gap-2">
            <input
              type="text"
              value={nameDraft}
              onChange={(e) => setNameDraft(e.target.value)}
              placeholder="Nombre visible"
              aria-label="Nombre visible"
              className="h-8 px-2.5 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-surface)] text-xs font-medium outline-none focus:border-[var(--luma-accent)]"
            />
            <button
              type="button"
              onClick={() => {
                onUpdateDisplayName(nameDraft);
                setNameSaved(true);
                window.setTimeout(() => setNameSaved(false), 1800);
              }}
              className="h-8 px-3 rounded-lg bg-[var(--luma-accent)] text-[var(--luma-on-accent)] text-xs font-semibold inline-flex items-center gap-1"
            >
              {nameSaved ? (
                <>
                  <Check className="w-3.5 h-3.5" />
                  <span>Guardado</span>
                </>
              ) : (
                <span>Guardar nombre</span>
              )}
            </button>
          </div>
        </div>
      </section>

      {/* Dispositivos conectados (hasta 5) */}
      <section className="space-y-2.5">
        <div className="flex items-center justify-between text-xs">
          <span className="font-bold text-[var(--luma-ink)]">
            Dispositivos conectados ({session.devices.length}/{LUMA_CORE_CONFIG.maxConnectedDevices})
          </span>
          <span className="text-[11px] text-[var(--luma-ink-muted)]">
            Sincronización por luma-profile.json
          </span>
        </div>

        <div className="rounded-xl border border-[var(--luma-border)] bg-[var(--luma-bg)] divide-y divide-[var(--luma-border)]">
          {session.devices.map((dev) => {
            const isEditing = editingDeviceId === dev.id;
            return (
              <div
                key={dev.id}
                className="px-3.5 py-2.5 flex items-center justify-between gap-3 text-xs"
              >
                <div className="flex items-center gap-2.5 min-w-0">
                  {renderPlatformIcon(dev.platform)}
                  <div className="min-w-0">
                    {isEditing ? (
                      <div className="flex items-center gap-1.5">
                        <input
                          type="text"
                          value={deviceDraft}
                          onChange={(e) => setDeviceDraft(e.target.value)}
                          onKeyDown={(e) => {
                            if (e.key === 'Enter') {
                              onRenameDevice(dev.id, deviceDraft);
                              setEditingDeviceId(null);
                            }
                          }}
                          className="h-7 px-2 rounded border border-[var(--luma-accent)] bg-[var(--luma-surface)] text-xs outline-none"
                          autoFocus
                        />
                        <button
                          type="button"
                          onClick={() => {
                            onRenameDevice(dev.id, deviceDraft);
                            setEditingDeviceId(null);
                          }}
                          className="h-7 px-2 rounded bg-[var(--luma-accent)] text-[var(--luma-on-accent)] text-[11px] font-semibold"
                        >
                          OK
                        </button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1.5">
                        <span className="font-semibold truncate">{dev.name}</span>
                        {dev.isCurrent && (
                          <span className="px-1.5 py-0.5 rounded bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 text-[10px] font-semibold">
                            Este dispositivo
                          </span>
                        )}
                      </div>
                    )}
                    <div className="text-[10px] text-[var(--luma-ink-muted)] tabular-nums">
                      v{dev.appVersion} · Última actividad:{' '}
                      {new Date(dev.lastActiveAt).toLocaleString('es-ES')}
                    </div>
                  </div>
                </div>

                <div className="flex items-center gap-1 shrink-0">
                  <button
                    type="button"
                    onClick={() => {
                      setEditingDeviceId(dev.id);
                      setDeviceDraft(dev.name);
                    }}
                    title="Renombrar dispositivo"
                    className="h-7 w-7 rounded-md flex items-center justify-center text-[var(--luma-ink-muted)] hover:text-[var(--luma-ink)] hover:bg-[var(--luma-surface-alt)]"
                  >
                    <Pencil className="w-3.5 h-3.5" />
                  </button>
                  {!dev.isCurrent && (
                    <button
                      type="button"
                      onClick={() => onRemoveDevice(dev.id)}
                      title="Quitar dispositivo"
                      className="h-7 w-7 rounded-md flex items-center justify-center text-[var(--luma-ink-muted)] hover:text-red-500 hover:bg-red-500/10"
                    >
                      <Trash2 className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      </section>

      {/* Acciones de sesión y comentarios */}
      <section className="space-y-3 pt-1">
        <div className="flex flex-wrap items-center justify-between gap-2.5">
          <button
            type="button"
            onClick={onSignOut}
            className="h-9 px-3.5 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)] text-xs font-semibold inline-flex items-center gap-2"
          >
            <LogOut className="w-3.5 h-3.5" />
            <span>Cerrar sesión (conservar archivos locales)</span>
          </button>

          <a
            href={LUMA_CORE_CONFIG.betaFeedbackFormUrl}
            target="_blank"
            rel="noopener noreferrer"
            className="h-9 px-3.5 rounded-xl border border-[var(--luma-border)] bg-[var(--luma-bg)] hover:bg-[var(--luma-surface-alt)] text-xs font-semibold inline-flex items-center gap-1.5"
          >
            <span>Comentarios Beta</span>
            <ExternalLink className="w-3.5 h-3.5" />
          </a>
        </div>

        {/* Opción destructiva protegida por confirmación explícita */}
        {!confirmWipeOpen ? (
          <button
            type="button"
            onClick={() => setConfirmWipeOpen(true)}
            className="text-[11px] font-semibold text-red-600 dark:text-red-400 hover:underline inline-flex items-center gap-1"
          >
            <Trash2 className="w-3 h-3" />
            <span>Desconectar y borrar datos locales</span>
          </button>
        ) : (
          <div className="p-3.5 rounded-xl border border-red-500/40 bg-red-500/10 space-y-2.5">
            <div className="flex items-start gap-2 text-xs text-red-700 dark:text-red-300">
              <AlertTriangle className="w-4 h-4 shrink-0 mt-0.5" />
              <span>
                Esta acción cerrará tu sesión y eliminará los cachés descargados de Google Drive en este dispositivo (tus archivos en Google Drive NO se borrarán).
              </span>
            </div>
            <div className="flex items-center gap-2">
              <button
                type="button"
                disabled={wipeBusy}
                onClick={async () => {
                  setWipeBusy(true);
                  try {
                    await onWipeLocalAndDisconnect();
                    setConfirmWipeOpen(false);
                  } finally {
                    setWipeBusy(false);
                  }
                }}
                className="h-8 px-3 rounded-lg bg-red-600 text-white text-xs font-semibold disabled:opacity-60"
              >
                {wipeBusy ? 'Borrando...' : 'Sí, desconectar y borrar caché local'}
              </button>
              <button
                type="button"
                onClick={() => setConfirmWipeOpen(false)}
                className="h-8 px-3 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-surface)] text-xs font-semibold"
              >
                Cancelar
              </button>
            </div>
          </div>
        )}
      </section>
    </div>
  );
};
