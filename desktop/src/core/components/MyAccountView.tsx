import React, { useState } from 'react';
import {
  AlertTriangle,
  Check,
  Cloud,
  ExternalLink,
  HelpCircle,
  Laptop,
  Loader2,
  LogOut,
  Monitor,
  Pencil,
  ShieldCheck,
  Smartphone,
  Sparkles,
  Trash2,
} from 'lucide-react';
import { AuthSessionState, DeviceRecord } from '../types';
import { LUMA_CORE_CONFIG } from '../config';

interface MyAccountViewProps {
  session: AuthSessionState;
  initialClientId?: string;
  onSignInGoogle: (clientId: string) => Promise<void>;
  onSignOut: () => void;
  onWipeLocalAndDisconnect: () => Promise<void>;
  onUpdateDisplayName: (name: string) => void;
  onRenameDevice: (deviceId: string, name: string) => void;
  onRemoveDevice: (deviceId: string) => void;
  onOpenClientIdGuide?: () => void;
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
 * 1) SIN SESIÓN: tarjeta explicativa + botón "Iniciar sesión con Google" (reutiliza pantalla de consentimiento).
 * 2) CON SESIÓN: foto, nombre editable, correo, insignia Beta, hasta 5 dispositivos, cerrar sesión y borrado total opcional.
 */
export const MyAccountView: React.FC<MyAccountViewProps> = ({
  session,
  initialClientId = '',
  onSignInGoogle,
  onSignOut,
  onWipeLocalAndDisconnect,
  onUpdateDisplayName,
  onRenameDevice,
  onRemoveDevice,
  onOpenClientIdGuide,
}) => {
  const [consentOpen, setConsentOpen] = useState(false);
  const [clientId, setClientId] = useState(
    initialClientId.trim() || LUMA_CORE_CONFIG.publicGoogleClientId
  );
  const [authBusy, setAuthBusy] = useState(false);
  const [authError, setAuthError] = useState<string | null>(null);

  const [nameDraft, setNameDraft] = useState(session.user?.displayName ?? '');
  const [nameSaved, setNameSaved] = useState(false);

  const [editingDeviceId, setEditingDeviceId] = useState<string | null>(null);
  const [deviceDraft, setDeviceDraft] = useState('');
  const [confirmWipeOpen, setConfirmWipeOpen] = useState(false);
  const [wipeBusy, setWipeBusy] = useState(false);

  React.useEffect(() => {
    setNameDraft(session.user?.displayName ?? '');
  }, [session.user?.displayName]);

  const handleStartGoogleLogin = async () => {
    const cleanId = clientId.trim();
    if (!cleanId) {
      setAuthError('Introduce tu Client ID de Google OAuth para continuar.');
      return;
    }
    setAuthBusy(true);
    setAuthError(null);
    try {
      await onSignInGoogle(cleanId);
      setConsentOpen(false);
    } catch (err) {
      setAuthError(
        err instanceof Error ? err.message : 'No se pudo iniciar sesión con Google.'
      );
    } finally {
      setAuthBusy(false);
    }
  };

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

          {!consentOpen ? (
            <button
              type="button"
              onClick={() => {
                setAuthError(null);
                setConsentOpen(true);
              }}
              className="w-full sm:w-auto h-11 px-5 rounded-xl bg-[var(--luma-accent)] text-[var(--luma-on-accent)] text-xs font-semibold inline-flex items-center justify-center gap-2.5 hover:opacity-95 transition-opacity luma-press"
            >
              <span className="w-5 h-5 rounded-full bg-white flex items-center justify-center shrink-0">
                <svg className="w-3.5 h-3.5" viewBox="0 0 24 24" aria-hidden="true">
                  <path
                    fill="#4285F4"
                    d="M23.745 12.27c0-.79-.07-1.54-.19-2.27h-11.3v4.51h6.47c-.29 1.48-1.14 2.73-2.4 3.58v3h3.86c2.26-2.09 3.56-5.17 3.56-8.82z"
                  />
                  <path
                    fill="#34A853"
                    d="M12.255 24c3.24 0 5.95-1.08 7.93-2.91l-3.86-3c-1.08.72-2.45 1.16-4.07 1.16-3.13 0-5.78-2.11-6.73-4.96h-3.98v3.09C3.515 21.3 7.565 24 12.255 24z"
                  />
                  <path
                    fill="#FBBC05"
                    d="M5.525 14.29c-.25-.72-.38-1.49-.38-2.29s.14-1.57.38-2.29V6.62h-3.98a11.86 11.86 0 000 10.76l3.98-3.09z"
                  />
                  <path
                    fill="#EA4335"
                    d="M12.255 4.75c1.77 0 3.35.61 4.6 1.8l3.42-3.42C18.205 1.19 15.495 0 12.255 0c-4.69 0-8.74 2.7-10.71 6.62l3.98 3.09c.95-2.85 3.6-4.96 6.73-4.96z"
                  />
                </svg>
              </span>
              <span>Iniciar sesión con Google</span>
            </button>
          ) : (
            /* Misma pantalla explicativa previa antes de abrir OAuth de Google */
            <div className="p-4 rounded-xl border border-[var(--luma-accent)]/35 bg-[var(--luma-accent-soft)]/45 space-y-3 luma-view-enter">
              <div className="flex items-center gap-2 text-xs font-bold text-[var(--luma-accent)]">
                <ShieldCheck className="w-4 h-4 shrink-0" />
                <span>{LUMA_CORE_CONFIG.copy.consentTitle}</span>
              </div>
              <p className="text-xs leading-relaxed text-[var(--luma-ink)]">
                {LUMA_CORE_CONFIG.copy.consentBody}
              </p>

              <div className="space-y-1">
                <div className="flex items-center justify-between gap-2">
                  <label className="text-[11px] font-semibold text-[var(--luma-ink-muted)]">
                    Client ID de Google OAuth
                  </label>
                  {onOpenClientIdGuide && (
                    <button
                      type="button"
                      onClick={onOpenClientIdGuide}
                      className="text-[11px] font-semibold text-[var(--luma-accent)] hover:underline inline-flex items-center gap-1"
                    >
                      <HelpCircle className="w-3 h-3" />
                      <span>Guía Client ID</span>
                    </button>
                  )}
                </div>
                <input
                  type="text"
                  value={clientId}
                  onChange={(e) => setClientId(e.target.value)}
                  placeholder="xxxxxxxxxxxx-yyyyyyyyyyyy.apps.googleusercontent.com"
                  className="w-full h-9 px-3 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-surface)] font-mono text-xs outline-none focus:border-[var(--luma-accent)]"
                />
              </div>

              {authError && (
                <div className="p-2.5 rounded-lg bg-red-500/10 border border-red-500/30 text-[11px] text-red-600 dark:text-red-400">
                  {authError}
                </div>
              )}

              <div className="flex flex-wrap items-center gap-2">
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={() => void handleStartGoogleLogin()}
                  className="h-9 px-4 rounded-lg bg-[var(--luma-accent)] text-[var(--luma-on-accent)] text-xs font-semibold inline-flex items-center gap-2 disabled:opacity-60"
                >
                  {authBusy && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                  <span>{authBusy ? 'Conectando...' : 'Entendido, continuar'}</span>
                </button>
                <button
                  type="button"
                  disabled={authBusy}
                  onClick={() => setConsentOpen(false)}
                  className="h-9 px-3 rounded-lg border border-[var(--luma-border)] bg-[var(--luma-surface)] text-xs font-semibold"
                >
                  Cancelar
                </button>
              </div>
            </div>
          )}
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
