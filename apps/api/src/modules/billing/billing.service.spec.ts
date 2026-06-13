import { describe, it, expect, vi } from 'vitest';
import { BillingService } from './billing.service';
import type { StripeClient } from './stripe.constants';
import type { SubscriptionRepository, SubscriptionRow } from '../entitlements/subscription.repository';
import type { StripeEventsRepository } from './stripe-events.repository';

const ENV: Record<string, string> = {
  STRIPE_PRICE_FAMILY: 'price_fam',
  STRIPE_PRICE_FAMILY_HEALTH: 'price_fh',
  STRIPE_WEBHOOK_SECRET: 'whsec_test',
  CORS_ORIGIN: 'http://localhost:4200',
};
const config = { get: (k: string) => ENV[k] } as unknown as import('@nestjs/config').ConfigService;

function subRepo(over: Partial<SubscriptionRepository> = {}): SubscriptionRepository {
  return {
    findByUserId: vi.fn().mockResolvedValue(null),
    findByStripeCustomerId: vi.fn().mockResolvedValue(null),
    upsertByUserId: vi.fn().mockResolvedValue({} as SubscriptionRow),
    ...over,
  } as unknown as SubscriptionRepository;
}
const eventsRepo = (fresh: boolean): StripeEventsRepository =>
  ({ markProcessed: vi.fn().mockResolvedValue(fresh) }) as unknown as StripeEventsRepository;

describe('BillingService.createCheckoutSession', () => {
  it('crée un customer puis une session et renvoie son url', async () => {
    const stripe = {
      customers: { create: vi.fn().mockResolvedValue({ id: 'cus_1' }) },
      checkout: { sessions: { create: vi.fn().mockResolvedValue({ url: 'https://stripe/checkout' }) } },
    } as unknown as StripeClient;
    const subs = subRepo();
    const svc = new BillingService(stripe, config, subs, eventsRepo(true));

    const url = await svc.createCheckoutSession('u1', 'a@b.com', 'family');

    expect(url).toBe('https://stripe/checkout');
    expect((stripe.checkout.sessions.create as ReturnType<typeof vi.fn>).mock.calls[0][0]).toMatchObject({
      mode: 'subscription',
      client_reference_id: 'u1',
      line_items: [{ price: 'price_fam', quantity: 1 }],
    });
    expect(subs.upsertByUserId).toHaveBeenCalledWith('u1', expect.objectContaining({ stripeCustomerId: 'cus_1' }));
  });
});

describe('BillingService.handleWebhook', () => {
  it('ignore un event déjà traité (idempotence)', async () => {
    const stripe = {
      webhooks: { constructEvent: vi.fn().mockReturnValue({ id: 'evt_1', type: 'checkout.session.completed', data: { object: {} } }) },
    } as unknown as StripeClient;
    const subs = subRepo();
    const svc = new BillingService(stripe, config, subs, eventsRepo(false));

    await svc.handleWebhook(Buffer.from('{}'), 'sig');

    expect(subs.upsertByUserId).not.toHaveBeenCalled();
  });

  it('customer.subscription.updated → upsert plan/statut/période via le customer', async () => {
    // ⚠️ current_period_end vit sur l'ITEM (Stripe API v2277+), pas au top-level.
    const event = {
      id: 'evt_2',
      type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_1', customer: 'cus_1', status: 'active', cancel_at_period_end: false,
          items: { data: [{ price: { id: 'price_fh' }, current_period_end: 1893456000 }] },
        },
      },
    };
    const stripe = { webhooks: { constructEvent: vi.fn().mockReturnValue(event) } } as unknown as StripeClient;
    const subs = subRepo({ findByStripeCustomerId: vi.fn().mockResolvedValue({ userId: 'u1' } as SubscriptionRow) });
    const svc = new BillingService(stripe, config, subs, eventsRepo(true));

    await svc.handleWebhook(Buffer.from('{}'), 'sig');

    expect(subs.upsertByUserId).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({
        planKey: 'family_health',
        status: 'active',
        source: 'stripe',
        currentPeriodEnd: new Date(1893456000 * 1000),
      }),
    );
  });

  it('préserve un override admin : payment_failed ne rétrograde pas', async () => {
    const event = {
      id: 'evt_pf', type: 'invoice.payment_failed',
      data: { object: { customer: 'cus_1' } },
    };
    const stripe = { webhooks: { constructEvent: vi.fn().mockReturnValue(event) } } as unknown as StripeClient;
    const subs = subRepo({
      findByStripeCustomerId: vi.fn().mockResolvedValue({ userId: 'u1', source: 'admin' } as SubscriptionRow),
    });
    const svc = new BillingService(stripe, config, subs, eventsRepo(true));

    await svc.handleWebhook(Buffer.from('{}'), 'sig');

    expect(subs.upsertByUserId).not.toHaveBeenCalled();
  });

  it('préserve un override admin : subscription.updated n’écrase que le lien Stripe', async () => {
    const event = {
      id: 'evt_adm', type: 'customer.subscription.updated',
      data: {
        object: {
          id: 'sub_9', customer: 'cus_1', status: 'active', cancel_at_period_end: false,
          items: { data: [{ price: { id: 'price_fam' }, current_period_end: 1893456000 }] },
        },
      },
    };
    const stripe = { webhooks: { constructEvent: vi.fn().mockReturnValue(event) } } as unknown as StripeClient;
    const subs = subRepo({
      findByStripeCustomerId: vi.fn().mockResolvedValue({ userId: 'u1' } as SubscriptionRow),
      findByUserId: vi.fn().mockResolvedValue({ userId: 'u1', source: 'admin', planKey: 'family_health' } as SubscriptionRow),
    });
    const svc = new BillingService(stripe, config, subs, eventsRepo(true));

    await svc.handleWebhook(Buffer.from('{}'), 'sig');

    // Lien Stripe enregistré, mais ni planKey/status/source ré-écrits (override admin préservé).
    expect(subs.upsertByUserId).toHaveBeenCalledWith('u1', { stripeCustomerId: 'cus_1', stripeSubscriptionId: 'sub_9' });
  });

  it('customer.subscription.deleted → statut canceled', async () => {
    const event = {
      id: 'evt_3', type: 'customer.subscription.deleted',
      data: { object: { id: 'sub_1', customer: 'cus_1', status: 'canceled', items: { data: [{ price: { id: 'price_fh' } }] } } },
    };
    const stripe = { webhooks: { constructEvent: vi.fn().mockReturnValue(event) } } as unknown as StripeClient;
    const subs = subRepo({ findByStripeCustomerId: vi.fn().mockResolvedValue({ userId: 'u1' } as SubscriptionRow) });
    const svc = new BillingService(stripe, config, subs, eventsRepo(true));

    await svc.handleWebhook(Buffer.from('{}'), 'sig');

    expect(subs.upsertByUserId).toHaveBeenCalledWith('u1', expect.objectContaining({ status: 'canceled' }));
  });
});
