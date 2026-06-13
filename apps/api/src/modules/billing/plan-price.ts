import { PLAN_CATALOG, type PlanKey } from '../entitlements/plan-catalog';
import type { SubscriptionStatus } from '../entitlements/entitlement.resolver';

type PriceEnvKey = 'STRIPE_PRICE_FAMILY' | 'STRIPE_PRICE_FAMILY_HEALTH';
type GetEnv = (key: PriceEnvKey) => string | undefined;

/** Price Stripe d'un plan payant. Lève si le plan n'est pas vendable ou si le price n'est pas configuré. */
export function priceIdForPlan(planKey: PlanKey, getEnv: GetEnv): string {
  const envKey = PLAN_CATALOG[planKey].stripePriceEnv;
  if (!envKey) throw new Error(`Plan non payant : ${planKey}`);
  const priceId = getEnv(envKey);
  if (!priceId) throw new Error(`Price Stripe non configuré pour ${planKey} (${envKey})`);
  return priceId;
}

/** Plan correspondant à un price id Stripe (ou null si inconnu). */
export function planKeyForPrice(priceId: string, getEnv: GetEnv): PlanKey | null {
  for (const key of Object.keys(PLAN_CATALOG) as PlanKey[]) {
    const envKey = PLAN_CATALOG[key].stripePriceEnv;
    if (envKey && getEnv(envKey) === priceId) return key;
  }
  return null;
}

/** Statut d'abonnement Stripe → notre union `SubscriptionStatus`. */
export function mapStripeStatus(stripeStatus: string): SubscriptionStatus {
  switch (stripeStatus) {
    case 'active':
      return 'active';
    case 'trialing':
      return 'trialing';
    case 'past_due':
    case 'unpaid':
      return 'past_due';
    case 'canceled':
    case 'incomplete_expired':
      return 'canceled';
    default:
      return 'incomplete';
  }
}
