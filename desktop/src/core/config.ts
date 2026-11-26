/**
 * Configuración central compartida por Luma PC y Luma Móvil.
 *
 * REGLAS DE SEGURIDAD:
 * - No incluir secretos ni client_secret aquí (solo identificadores públicos).
 * - Los proveedores secundarios (Microsoft OneDrive y Terabox) permanecen
 *   ocultos en Beta mediante banderas de características (featureFlags).
 */

export interface CloudFeatureFlags {
  /** Proveedor principal activo en fase Beta (Google Drive v3 directo) */
  google: boolean;
  /** Microsoft OneDrive — desactivado por defecto en Beta */
  microsoft: boolean;
  /** Terabox — desactivado por defecto en Beta */
  terabox: boolean;
}

export const featureFlags: CloudFeatureFlags = {
  google: true,
  microsoft: false,
  terabox: false,
};

export const LUMA_CORE_CONFIG = {
  /** Versión pública de la beta multiplataforma */
  appVersion: '1.0.0-beta.1',
  /** Etiqueta visible del plan durante la fase Beta */
  betaPlanLabel: 'Beta – acceso completo',
  /** Límite de dispositivos simultáneos asociados a la misma cuenta */
  maxConnectedDevices: 5,
  /** Nombre por defecto de la carpeta raíz de Luma en Google Drive */
  defaultCloudFolderName: 'Luma',
  /**
   * Client ID público de Google OAuth (tipo Aplicación Web / PKCE).
   * Puede definirse vía variable de entorno Vite (`VITE_GOOGLE_CLIENT_ID`)
   * o configurarse por el usuario en Ajustes → Fuentes.
   */
  publicGoogleClientId:
    (import.meta as unknown as { env?: Record<string, string | undefined> }).env
      ?.VITE_GOOGLE_CLIENT_ID?.trim() ?? '',
  /** Enlace a formulario de comentarios de la Beta (editable en producción) */
  betaFeedbackFormUrl: 'https://forms.gle/luma-beta-feedback',
  /** Textos oficiales de bienvenida y consentimiento en lenguaje simple */
  copy: {
    slogan: 'Tu biblioteca y cuadernos digitales, siempre contigo.',
    welcomeSubtitle: 'Sincroniza tus libros y cuadernos en todos tus dispositivos',
    offlineNote: 'Podrás iniciar sesión más tarde desde Mi cuenta',
    consentTitle: 'Antes de continuar con Google',
    consentBody:
      'Luma va a ver, leer, guardar y modificar archivos en tu Google Drive dentro de la carpeta que elijas. No usamos servidores propios y nadie más ve tus archivos.',
    syncDisabledTooltip: 'Inicia sesión para sincronizar',
  },
} as const;
