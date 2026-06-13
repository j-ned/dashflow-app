import { describe, it, expect, vi } from 'vitest';
import { BillingController } from './billing.controller';
import type { BillingService } from './billing.service';

const svc = (over: Partial<BillingService> = {}): BillingService =>
  ({
    createCheckoutSession: vi.fn().mockResolvedValue('https://stripe/checkout'),
    createPortalSession: vi.fn().mockResolvedValue('https://stripe/portal'),
    handleWebhook: vi.fn().mockResolvedValue(undefined),
    ...over,
  }) as unknown as BillingService;

describe('BillingController', () => {
  it('checkout renvoie l’url de session', async () => {
    const billing = svc();
    const c = new BillingController(billing);
    const res = await c.checkout({ id: 'u1', email: 'a@b.com' }, { planKey: 'family' });
    expect(res).toEqual({ url: 'https://stripe/checkout' });
    expect(billing.createCheckoutSession).toHaveBeenCalledWith('u1', 'a@b.com', 'family');
  });

  it('portal renvoie l’url du portail', async () => {
    const billing = svc();
    const c = new BillingController(billing);
    expect(await c.portal({ id: 'u1', email: 'a@b.com' })).toEqual({ url: 'https://stripe/portal' });
  });

  it('webhook passe le body brut + la signature au service', async () => {
    const billing = svc();
    const c = new BillingController(billing);
    const raw = Buffer.from('{}');
    const res = await c.webhook({ rawBody: raw } as never, 'sig_123');
    expect(billing.handleWebhook).toHaveBeenCalledWith(raw, 'sig_123');
    expect(res).toEqual({ received: true });
  });

  it('webhook rejette une requête sans body brut', async () => {
    const c = new BillingController(svc());
    await expect(c.webhook({} as never, 'sig')).rejects.toBeDefined();
  });
});
