/**
 * Servicio intercambiable de planes y permisos (EntitlementService).
 *
 * IMPORTANTE DE ARQUITECTURA:
 * - Durante la fase Beta, todos los usuarios con sesión iniciada reciben
 *   acceso completo ("Beta – acceso completo").
 * - Cualquier validación del lado del cliente es exclusivamente para UX.
 * - Cuando se habiliten suscripciones en producción, bastará con intercambiar
 *   esta implementación por `RemoteEntitlementService` apuntando a un endpoint
 *   ligero que valide el token del usuario y responda:
 *   `{ plan: 'free' | 'premium', expira: '2027-01-01T00:00:00Z', min_version: '1.0.0' }`.
 */

import { LUMA_CORE_CONFIG } from './config';
import { CloudUser, EntitlementInfo, EntitlementService } from './types';

class BetaEntitlementService implements EntitlementService {
  getCachedEntitlement(user: CloudUser | null): EntitlementInfo {
    if (!user) {
      return {
        plan: 'beta_full',
        isPremiumUnlocked: true,
        badgeLabel: 'Modo local (sin conexión)',
        expiresAt: null,
        minVersion: LUMA_CORE_CONFIG.appVersion,
        source: 'beta_stub',
      };
    }

    return {
      plan: 'premium',
      isPremiumUnlocked: true,
      badgeLabel: LUMA_CORE_CONFIG.betaPlanLabel,
      expiresAt: null,
      minVersion: LUMA_CORE_CONFIG.appVersion,
      source: 'beta_stub',
    };
  }

  async resolveEntitlement(user: CloudUser | null): Promise<EntitlementInfo> {
    // En Beta no realizamos llamadas a ningún servidor propio.
    return this.getCachedEntitlement(user);
  }
}

let activeEntitlementService: EntitlementService = new BetaEntitlementService();

export function getEntitlementService(): EntitlementService {
  return activeEntitlementService;
}

/** Permite inyectar una implementación remota en el futuro sin tocar la UI */
export function setEntitlementService(service: EntitlementService): void {
  activeEntitlementService = service;
}
