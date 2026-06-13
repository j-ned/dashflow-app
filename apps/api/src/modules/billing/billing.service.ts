import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { STRIPE, type StripeClient } from './stripe.constants';
import { SubscriptionRepository } from '../entitlements/subscription.repository';
import { StripeEventsRepository } from './stripe-events.repository';
import { priceIdForPlan, planKeyForPrice, mapStripeStatus } from './plan-price';
import type { PlanKey } from '../entitlements/plan-catalog';
import type { Env } from '../../config/env.schema';

type PriceEnvKey = 'STRIPE_PRICE_FAMILY' | 'STRIPE_PRICE_FAMILY_HEALTH';

// ⚠️ Stripe v22 : le default export (`StripeConstructor`) ne ré-expose PAS le
// namespace mergé des objets (`Subscription`, `Invoice`, `Checkout.Session`) —
// `StripeClient` est un alias de type, pas un namespace. On décrit donc
// structurellement les seuls champs lus côté webhook (cast défensif autorisé).
interface WebhookSubscription {
  readonly id: string;
  readonly customer: string | { readonly id: string } | null;
  readonly status: string;
  readonly cancel_at_period_end?: boolean;
  // ⚠️ Stripe API v2277+ : `current_period_end` vit sur les ITEMS, plus au top-level de la Subscription.
  readonly items: {
    readonly data: ReadonlyArray<{
      readonly price: { readonly id: string };
      readonly current_period_end?: number;
    }>;
  };
}
interface WebhookCheckoutSession {
  readonly client_reference_id: string | null;
  readonly customer: string | { readonly id: string } | null;
  readonly subscription: string | { readonly id: string } | null;
}
interface WebhookInvoice {
  readonly customer: string | { readonly id: string } | null;
}

@Injectable()
export class BillingService {
  constructor(
    @Inject(STRIPE) private readonly stripe: StripeClient,
    private readonly config: ConfigService<Env, true>,
    private readonly subscriptions: SubscriptionRepository,
    private readonly events: StripeEventsRepository,
  ) {}

  private getPrice = (key: PriceEnvKey): string | undefined => this.config.get(key, { infer: true });

  private frontUrl(): string {
    return this.config.get('CORS_ORIGIN', { infer: true }).split(',')[0];
  }

  async createCheckoutSession(userId: string, email: string, planKey: PlanKey): Promise<string> {
    const price = priceIdForPlan(planKey, this.getPrice);

    const existing = await this.subscriptions.findByUserId(userId);
    let customerId = existing?.stripeCustomerId ?? null;
    if (!customerId) {
      const customer = await this.stripe.customers.create({ email, metadata: { userId } });
      customerId = customer.id;
    }
    await this.subscriptions.upsertByUserId(userId, { stripeCustomerId: customerId });

    const front = this.frontUrl();
    const session = await this.stripe.checkout.sessions.create({
      mode: 'subscription',
      customer: customerId,
      client_reference_id: userId,
      line_items: [{ price, quantity: 1 }],
      success_url: `${front}/settings?checkout=success`,
      cancel_url: `${front}/upgrade?checkout=cancel`,
    });
    if (!session.url) throw new BadRequestException('Session Stripe sans URL');
    return session.url;
  }

  async createPortalSession(userId: string): Promise<string> {
    const sub = await this.subscriptions.findByUserId(userId);
    if (!sub?.stripeCustomerId) throw new BadRequestException('Aucun abonnement Stripe');
    const session = await this.stripe.billingPortal.sessions.create({
      customer: sub.stripeCustomerId,
      return_url: `${this.frontUrl()}/settings`,
    });
    return session.url;
  }

  async handleWebhook(rawBody: Buffer, signature: string): Promise<void> {
    const secret = this.config.get('STRIPE_WEBHOOK_SECRET', { infer: true });
    if (!secret) throw new BadRequestException('Webhook Stripe non configuré');
    const event = this.stripe.webhooks.constructEvent(rawBody, signature, secret);

    if (!(await this.events.markProcessed(event.id, event.type))) return;

    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutCompleted(event.data.object as unknown as WebhookCheckoutSession);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.onSubscriptionChange(event.data.object as unknown as WebhookSubscription, false);
        break;
      case 'customer.subscription.deleted':
        await this.onSubscriptionChange(event.data.object as unknown as WebhookSubscription, true);
        break;
      case 'invoice.payment_failed':
        await this.onPaymentFailed(event.data.object as unknown as WebhookInvoice);
        break;
      default:
        break;
    }
  }

  private async onCheckoutCompleted(session: WebhookCheckoutSession): Promise<void> {
    const userId = session.client_reference_id;
    const customerId = typeof session.customer === 'string' ? session.customer : null;
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null;
    if (!userId || !subscriptionId) return;
    const sub = (await this.stripe.subscriptions.retrieve(subscriptionId)) as unknown as WebhookSubscription;
    await this.applySubscription(userId, customerId, sub, false);
  }

  private async onSubscriptionChange(sub: WebhookSubscription, deleted: boolean): Promise<void> {
    const customerId = typeof sub.customer === 'string' ? sub.customer : null;
    if (!customerId) return;
    const row = await this.subscriptions.findByStripeCustomerId(customerId);
    if (!row) return;
    await this.applySubscription(row.userId, customerId, sub, deleted);
  }

  private async onPaymentFailed(invoice: WebhookInvoice): Promise<void> {
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : null;
    if (!customerId) return;
    const row = await this.subscriptions.findByStripeCustomerId(customerId);
    if (!row) return;
    // Un override admin (geste SAV) ne doit jamais être rétrogradé par un échec de prélèvement Stripe.
    if (row.source === 'admin') return;
    await this.subscriptions.upsertByUserId(row.userId, { status: 'past_due', source: 'stripe' });
  }

  private async applySubscription(
    userId: string,
    customerId: string | null,
    sub: WebhookSubscription,
    deleted: boolean,
  ): Promise<void> {
    const existing = await this.subscriptions.findByUserId(userId);
    // Override admin prioritaire : on garde son plan/statut, on n'enregistre que le lien Stripe.
    if (existing?.source === 'admin') {
      await this.subscriptions.upsertByUserId(userId, {
        ...(customerId ? { stripeCustomerId: customerId } : {}),
        stripeSubscriptionId: sub.id,
      });
      return;
    }

    const priceId = sub.items.data[0]?.price.id ?? '';
    const planKey = planKeyForPrice(priceId, this.getPrice);
    const periodEnd = sub.items.data[0]?.current_period_end;
    await this.subscriptions.upsertByUserId(userId, {
      ...(planKey ? { planKey } : {}),
      status: deleted ? 'canceled' : mapStripeStatus(sub.status),
      source: 'stripe',
      ...(customerId ? { stripeCustomerId: customerId } : {}),
      stripeSubscriptionId: sub.id,
      cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
      currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null,
    });
  }
}
