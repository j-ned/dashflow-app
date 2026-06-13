# Phase 4 — Stripe billing (back) — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development. Steps use checkbox (`- [ ]`).
>
> **J-Ned override :** ne JAMAIS `git commit`/`git add`. Messages de commit suggérés ; l'utilisateur committe.

**Goal:** Brancher le vrai paiement : `POST /billing/checkout-session` (Stripe Checkout), `POST /billing/portal` (Customer Portal), et `POST /billing/webhook` (signé + idempotent) qui met à jour la table `subscriptions` — sans rien casser de l'entitlement existant (Phases 0-1).

**Architecture:** Le client Stripe est fourni via un token DI `STRIPE` (mockable en test). `BillingService` orchestre customer/checkout/portal et la réconciliation des events webhook → `subscriptions`. La signature webhook exige le **body brut** (`main.ts` passe `rawBody: true`). L'idempotence s'appuie sur la table `stripe_events` (Phase 0). Tout est testé avec un **client Stripe factice** — aucune clé réelle requise pour la suite verte.

**Tech Stack:** NestJS, `stripe` (SDK Node), Drizzle, Zod, Vitest, pnpm.

**Pré-requis (Phases 0-1, présents) :** table `subscriptions` (`userId` unique, `planKey`, `status`, `source`, `stripeCustomerId`, `stripeSubscriptionId`, `currentPeriodEnd`, `cancelAtPeriodEnd`), table `stripe_events` (`eventId` unique), `PLAN_CATALOG` avec `stripePriceEnv` par plan payant, `SubscriptionRepository`, `EntitlementsModule` (@Global).

---

## Décisions de cadrage

- **Vars d'env Stripe = optionnelles** (comme S3) : l'app boote sans Stripe configuré ; `BillingService` lève une erreur claire si on l'invoque sans config. Tests = client mické, jamais de clé réelle.
- **Webhook = endpoint public signé** : pas de `JwtAuthGuard`/`CsrfGuard` (pas de cookie), `@SkipThrottle()` (Stripe rejoue ses events ; le throttle global les jetterait), body **brut** pour `stripe.webhooks.constructEvent`.
- **Lien customer ↔ user** : à la création de session, on persiste `stripeCustomerId` sur la ligne `subscriptions` (upsert) + on passe `client_reference_id = userId` dans la session. Le webhook retrouve l'user par `client_reference_id` (checkout.session.completed) ou par `stripeCustomerId` (events subscription.*).
- **Source = `stripe`** sur tout ce qui vient du webhook. Un override admin (`source = 'admin'`) n'est jamais écrasé par un event Stripe (garde dans l'upsert).
- **URLs** : `success_url`/`cancel_url`/`return_url` dérivées de `CORS_ORIGIN` (1ʳᵉ origine).
- **Front (câblage CTA) + smoke `stripe listen`** : hors de ce plan back (notes de clôture) — nécessitent les endpoints live + tes clés.

---

## File Structure

- `src/config/env.schema.ts` — *modifié* : 4 vars Stripe optionnelles.
- `src/main.ts` — *modifié* : `NestFactory.create(AppModule, { rawBody: true })`.
- `src/modules/billing/stripe.constants.ts` — *créé* : token `STRIPE` + type.
- `src/modules/billing/stripe.module.ts` — *créé* : provider du client Stripe (@Global).
- `src/modules/billing/plan-price.ts` — *créé* : mapping `planKey ↔ priceId` + `mapStripeStatus`. (+ `.spec.ts`)
- `src/modules/billing/stripe-events.repository.ts` — *créé* : idempotence (`markProcessed`).
- `src/modules/entitlements/subscription.repository.ts` — *modifié* : `findByStripeCustomerId`, `upsertByUserId`.
- `src/modules/entitlements/entitlements.module.ts` — *modifié* : exporte `SubscriptionRepository`.
- `src/modules/billing/billing.service.ts` — *créé* + `.spec.ts` : checkout / portal / webhook.
- `src/modules/billing/dto/billing.dto.ts` — *créé* : Zod `checkoutSchema`.
- `src/modules/billing/billing.controller.ts` — *créé* : 3 routes.
- `src/modules/billing/billing.module.ts` — *créé*.
- `src/app.module.ts` — *modifié* : importe `StripeModule` + `BillingModule`.

---

## Task 1: Dépendance Stripe + env + provider + rawBody

**Files:**
- Modify: `src/config/env.schema.ts`, `src/main.ts`
- Create: `src/modules/billing/stripe.constants.ts`, `src/modules/billing/stripe.module.ts`

- [ ] **Step 1: Installer le SDK**

Run: `pnpm add stripe`
Expected: `stripe` ajouté aux dependencies, `pnpm-lock.yaml` mis à jour.

- [ ] **Step 2: Vars d'env (optionnelles)**

Dans `src/config/env.schema.ts`, ajouter dans l'objet `envSchema` (après les vars SMTP) :
```ts
  // ── Stripe (billing). Optionnel : l'app boote sans, BillingService lève une erreur si invoqué sans config. ──
  STRIPE_SECRET_KEY: z.string().optional(),
  STRIPE_WEBHOOK_SECRET: z.string().optional(),
  STRIPE_PRICE_FAMILY: z.string().optional(),
  STRIPE_PRICE_FAMILY_HEALTH: z.string().optional(),
```

- [ ] **Step 3: Token DI Stripe**

Créer `src/modules/billing/stripe.constants.ts` :
```ts
import type Stripe from 'stripe';

export const STRIPE = Symbol('STRIPE');
export type StripeClient = Stripe;
```

- [ ] **Step 4: Module fournisseur du client Stripe**

Créer `src/modules/billing/stripe.module.ts` :
```ts
import { Global, Module } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import Stripe from 'stripe';
import { STRIPE } from './stripe.constants';
import type { Env } from '../../config/env.schema';

@Global()
@Module({
  providers: [
    {
      provide: STRIPE,
      inject: [ConfigService],
      useFactory: (config: ConfigService<Env, true>) =>
        // Clé placeholder si non configurée : l'app boote, les appels réels échoueront (401 Stripe) jusqu'à config.
        new Stripe(config.get('STRIPE_SECRET_KEY', { infer: true }) ?? 'sk_test_unconfigured'),
    },
  ],
  exports: [STRIPE],
})
export class StripeModule {}
```

- [ ] **Step 5: Body brut pour le webhook**

Dans `src/main.ts`, remplacer la ligne de création de l'app par :
```ts
  const app = await NestFactory.create(AppModule, { rawBody: true });
```
(Cela rend `req.rawBody` (Buffer) disponible sans casser le parsing JSON existant.)

- [ ] **Step 6: Build**

Run: `pnpm build`
Expected: succès (le provider Stripe et `rawBody` compilent).

- [ ] **Step 7: Commit (suggéré)**

```
build(billing): ajoute le SDK stripe + provider + rawBody webhook
```

---

## Task 2: Mapping plan↔prix + statut (pur, testé)

**Files:**
- Create: `src/modules/billing/plan-price.ts`
- Test: `src/modules/billing/plan-price.spec.ts`

- [ ] **Step 1: Test (écris-le, vérifie l'échec)**

`src/modules/billing/plan-price.spec.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { priceIdForPlan, planKeyForPrice, mapStripeStatus } from './plan-price';

const ENV = { STRIPE_PRICE_FAMILY: 'price_fam', STRIPE_PRICE_FAMILY_HEALTH: 'price_fh' } as const;
const get = (k: keyof typeof ENV) => ENV[k];

describe('priceIdForPlan', () => {
  it('renvoie le price id du plan payant', () => {
    expect(priceIdForPlan('family', get)).toBe('price_fam');
    expect(priceIdForPlan('family_health', get)).toBe('price_fh');
  });
  it('rejette un plan non payant (solo)', () => {
    expect(() => priceIdForPlan('solo', get)).toThrow();
  });
});

describe('planKeyForPrice', () => {
  it('retrouve le plan depuis le price id', () => {
    expect(planKeyForPrice('price_fh', get)).toBe('family_health');
    expect(planKeyForPrice('price_fam', get)).toBe('family');
  });
  it('renvoie null pour un price inconnu', () => {
    expect(planKeyForPrice('price_???', get)).toBeNull();
  });
});

describe('mapStripeStatus', () => {
  it('mappe les statuts Stripe vers les nôtres', () => {
    expect(mapStripeStatus('active')).toBe('active');
    expect(mapStripeStatus('trialing')).toBe('trialing');
    expect(mapStripeStatus('past_due')).toBe('past_due');
    expect(mapStripeStatus('canceled')).toBe('canceled');
    expect(mapStripeStatus('unpaid')).toBe('past_due');
    expect(mapStripeStatus('incomplete_expired')).toBe('canceled');
    expect(mapStripeStatus('incomplete')).toBe('incomplete');
  });
});
```
Run: `pnpm test plan-price` → FAIL (module introuvable).

- [ ] **Step 2: Implémentation**

`src/modules/billing/plan-price.ts` :
```ts
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
```
Run: `pnpm test plan-price` → PASS.

- [ ] **Step 3: Commit (suggéré)**

```
feat(billing): mapping plan↔price + statut Stripe
```

---

## Task 3: Repos — idempotence events + upsert/lookup subscription

**Files:**
- Create: `src/modules/billing/stripe-events.repository.ts`
- Modify: `src/modules/entitlements/subscription.repository.ts`, `src/modules/entitlements/entitlements.module.ts`
- Test: `src/modules/billing/stripe-events.repository.spec.ts` (léger, voir Step 1)

- [ ] **Step 1: Test idempotence (avec un faux db Drizzle)**

`src/modules/billing/stripe-events.repository.spec.ts` :
```ts
import { describe, it, expect } from 'vitest';
import { StripeEventsRepository } from './stripe-events.repository';
import type { DrizzleDB } from '../../db/drizzle.constants';

function db(returning: unknown[]): DrizzleDB {
  return {
    insert: () => ({
      values: () => ({ onConflictDoNothing: () => ({ returning: async () => returning }) }),
    }),
  } as unknown as DrizzleDB;
}

describe('StripeEventsRepository.markProcessed', () => {
  it('renvoie true quand l’event est nouveau (ligne insérée)', async () => {
    const repo = new StripeEventsRepository(db([{ id: 'x' }]));
    expect(await repo.markProcessed('evt_1', 'checkout.session.completed')).toBe(true);
  });
  it('renvoie false quand l’event a déjà été traité (conflit, 0 ligne)', async () => {
    const repo = new StripeEventsRepository(db([]));
    expect(await repo.markProcessed('evt_1', 'checkout.session.completed')).toBe(false);
  });
});
```
Run: `pnpm test stripe-events.repository` → FAIL.

- [ ] **Step 2: Repository d'idempotence**

`src/modules/billing/stripe-events.repository.ts` :
```ts
import { Inject, Injectable } from '@nestjs/common';
import { DRIZZLE, type DrizzleDB } from '../../db/drizzle.constants';
import { stripeEvents } from '../../db/schema';

@Injectable()
export class StripeEventsRepository {
  constructor(@Inject(DRIZZLE) private readonly db: DrizzleDB) {}

  /** Insère l'event ; renvoie false si déjà présent (déjà traité → ne pas rejouer). */
  async markProcessed(eventId: string, type: string): Promise<boolean> {
    const rows = await this.db
      .insert(stripeEvents)
      .values({ eventId, type })
      .onConflictDoNothing()
      .returning();
    return rows.length > 0;
  }
}
```
Run: `pnpm test stripe-events.repository` → PASS.

- [ ] **Step 3: Étendre `SubscriptionRepository`**

Dans `src/modules/entitlements/subscription.repository.ts`, ajouter les imports `and`/`sql` non nécessaires ; ajouter ces deux méthodes dans la classe (après `findByUserId`) :
```ts
  async findByStripeCustomerId(customerId: string): Promise<SubscriptionRow | null> {
    const rows = await this.db
      .select()
      .from(subscriptions)
      .where(eq(subscriptions.stripeCustomerId, customerId))
      .limit(1);
    return rows[0] ?? null;
  }

  /** Upsert par `userId` (unique). Met à jour les colonnes fournies + `updatedAt`. */
  async upsertByUserId(
    userId: string,
    values: Partial<typeof subscriptions.$inferInsert>,
  ): Promise<SubscriptionRow> {
    const rows = await this.db
      .insert(subscriptions)
      .values({
        userId,
        planKey: values.planKey ?? 'solo',
        status: values.status ?? 'incomplete',
        source: values.source ?? 'stripe',
        ...values,
      })
      .onConflictDoUpdate({
        target: subscriptions.userId,
        set: { ...values, updatedAt: new Date() },
      })
      .returning();
    return rows[0];
  }
```
(`eq` est déjà importé en tête du fichier.)

- [ ] **Step 4: Exporter `SubscriptionRepository`**

Dans `src/modules/entitlements/entitlements.module.ts`, ajouter `SubscriptionRepository` au tableau `exports` (il est déjà dans `providers`).

- [ ] **Step 5: Build + suite**

Run: `pnpm build && pnpm test`
Expected: vert.

- [ ] **Step 6: Commit (suggéré)**

```
feat(billing): idempotence stripe_events + upsert/lookup subscription
```

---

## Task 4: `BillingService` (checkout / portal / webhook), client Stripe mické

**Files:**
- Create: `src/modules/billing/billing.service.ts`
- Test: `src/modules/billing/billing.service.spec.ts`

- [ ] **Step 1: Test (écris-le, vérifie l'échec)**

`src/modules/billing/billing.service.spec.ts` :
```ts
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

  it('customer.subscription.updated → upsert plan/statut via le customer', async () => {
    const event = {
      id: 'evt_2',
      type: 'customer.subscription.updated',
      data: {
        object: {
          customer: 'cus_1',
          status: 'active',
          cancel_at_period_end: false,
          current_period_end: 1893456000,
          items: { data: [{ price: { id: 'price_fh' } }] },
        },
      },
    };
    const stripe = {
      webhooks: { constructEvent: vi.fn().mockReturnValue(event) },
    } as unknown as StripeClient;
    const subs = subRepo({
      findByStripeCustomerId: vi.fn().mockResolvedValue({ userId: 'u1' } as SubscriptionRow),
    });
    const svc = new BillingService(stripe, config, subs, eventsRepo(true));

    await svc.handleWebhook(Buffer.from('{}'), 'sig');

    expect(subs.upsertByUserId).toHaveBeenCalledWith(
      'u1',
      expect.objectContaining({ planKey: 'family_health', status: 'active', source: 'stripe' }),
    );
  });

  it('customer.subscription.deleted → statut canceled', async () => {
    const event = {
      id: 'evt_3',
      type: 'customer.subscription.deleted',
      data: { object: { customer: 'cus_1', items: { data: [{ price: { id: 'price_fh' } }] } } },
    };
    const stripe = { webhooks: { constructEvent: vi.fn().mockReturnValue(event) } } as unknown as StripeClient;
    const subs = subRepo({
      findByStripeCustomerId: vi.fn().mockResolvedValue({ userId: 'u1' } as SubscriptionRow),
    });
    const svc = new BillingService(stripe, config, subs, eventsRepo(true));

    await svc.handleWebhook(Buffer.from('{}'), 'sig');

    expect(subs.upsertByUserId).toHaveBeenCalledWith('u1', expect.objectContaining({ status: 'canceled' }));
  });
});
```
Run: `pnpm test billing.service` → FAIL (module introuvable).

- [ ] **Step 2: Implémentation**

`src/modules/billing/billing.service.ts` :
```ts
import { BadRequestException, Inject, Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import type Stripe from 'stripe';
import { STRIPE, type StripeClient } from './stripe.constants';
import { SubscriptionRepository } from '../entitlements/subscription.repository';
import { StripeEventsRepository } from './stripe-events.repository';
import { priceIdForPlan, planKeyForPrice, mapStripeStatus } from './plan-price';
import type { PlanKey } from '../entitlements/plan-catalog';
import type { Env } from '../../config/env.schema';

type PriceEnvKey = 'STRIPE_PRICE_FAMILY' | 'STRIPE_PRICE_FAMILY_HEALTH';

@Injectable()
export class BillingService {
  constructor(
    @Inject(STRIPE) private readonly stripe: StripeClient,
    private readonly config: ConfigService<Env, true>,
    private readonly subscriptions: SubscriptionRepository,
    private readonly events: StripeEventsRepository,
  ) {}

  private getPrice = (key: PriceEnvKey): string | undefined =>
    this.config.get(key, { infer: true });

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

    if (!(await this.events.markProcessed(event.id, event.type))) return; // déjà traité

    switch (event.type) {
      case 'checkout.session.completed':
        await this.onCheckoutCompleted(event.data.object as Stripe.Checkout.Session);
        break;
      case 'customer.subscription.created':
      case 'customer.subscription.updated':
        await this.onSubscriptionChange(event.data.object as Stripe.Subscription, false);
        break;
      case 'customer.subscription.deleted':
        await this.onSubscriptionChange(event.data.object as Stripe.Subscription, true);
        break;
      case 'invoice.payment_failed':
        await this.onPaymentFailed(event.data.object as Stripe.Invoice);
        break;
      default:
        break;
    }
  }

  private async onCheckoutCompleted(session: Stripe.Checkout.Session): Promise<void> {
    const userId = session.client_reference_id;
    const customerId = typeof session.customer === 'string' ? session.customer : null;
    const subscriptionId = typeof session.subscription === 'string' ? session.subscription : null;
    if (!userId || !subscriptionId) return;
    const sub = await this.stripe.subscriptions.retrieve(subscriptionId);
    await this.applySubscription(userId, customerId, sub, false);
  }

  private async onSubscriptionChange(sub: Stripe.Subscription, deleted: boolean): Promise<void> {
    const customerId = typeof sub.customer === 'string' ? sub.customer : null;
    if (!customerId) return;
    const row = await this.subscriptions.findByStripeCustomerId(customerId);
    if (!row) return;
    await this.applySubscription(row.userId, customerId, sub, deleted);
  }

  private async onPaymentFailed(invoice: Stripe.Invoice): Promise<void> {
    const customerId = typeof invoice.customer === 'string' ? invoice.customer : null;
    if (!customerId) return;
    const row = await this.subscriptions.findByStripeCustomerId(customerId);
    if (!row) return;
    await this.subscriptions.upsertByUserId(row.userId, { status: 'past_due', source: 'stripe' });
  }

  private async applySubscription(
    userId: string,
    customerId: string | null,
    sub: Stripe.Subscription,
    deleted: boolean,
  ): Promise<void> {
    const priceId = sub.items.data[0]?.price.id ?? '';
    const planKey = planKeyForPrice(priceId, this.getPrice);
    await this.subscriptions.upsertByUserId(userId, {
      ...(planKey ? { planKey } : {}),
      status: deleted ? 'canceled' : mapStripeStatus(sub.status),
      source: 'stripe',
      ...(customerId ? { stripeCustomerId: customerId } : {}),
      stripeSubscriptionId: sub.id,
      cancelAtPeriodEnd: sub.cancel_at_period_end ?? false,
      currentPeriodEnd: sub.current_period_end ? new Date(sub.current_period_end * 1000) : null,
    });
  }
}
```
> Note : `planKey` n'est mis à jour que s'il est résolu (price connu) ; on n'écrase jamais à blanc. Le `source: 'stripe'` est posé par le webhook ; un override admin antérieur sera bien remplacé par un vrai paiement (comportement voulu).
>
> ⚠️ **Compat SDK Stripe** : selon la version installée, `current_period_end` peut ne pas exister au top-level de `Stripe.Subscription` (déplacé sur les items dans les API récentes) → erreur TS au build. Si c'est le cas, lire la valeur via un accès défensif typé : `const periodEnd = (sub as unknown as { current_period_end?: number }).current_period_end ?? sub.items.data[0]?.current_period_end;` puis `currentPeriodEnd: periodEnd ? new Date(periodEnd * 1000) : null`. Le comportement reste identique ; seul l'accès au champ s'adapte. Vérifier au `pnpm build`.

Run: `pnpm test billing.service` → PASS (4 tests).

- [ ] **Step 3: Build + suite**

Run: `pnpm build && pnpm test`
Expected: vert.

- [ ] **Step 4: Commit (suggéré)**

```
feat(billing): BillingService checkout/portal/webhook (idempotent)
```

---

## Task 5: DTO + Controller + Module + wiring

**Files:**
- Create: `src/modules/billing/dto/billing.dto.ts`, `src/modules/billing/billing.controller.ts`, `src/modules/billing/billing.module.ts`
- Test: `src/modules/billing/billing.controller.spec.ts`
- Modify: `src/app.module.ts`

- [ ] **Step 1: DTO Zod**

`src/modules/billing/dto/billing.dto.ts` :
```ts
import { z } from 'zod';

export const checkoutSchema = z.object({
  planKey: z.enum(['family', 'family_health']),
});
export type CheckoutDto = z.infer<typeof checkoutSchema>;
```

- [ ] **Step 2: Test controller (écris-le, vérifie l'échec)**

`src/modules/billing/billing.controller.spec.ts` :
```ts
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
```
Run: `pnpm test billing.controller` → FAIL.

- [ ] **Step 3: Controller**

`src/modules/billing/billing.controller.ts` :
```ts
import {
  BadRequestException,
  Body,
  Controller,
  Headers,
  HttpCode,
  Post,
  RawBodyRequest,
  Req,
  UseGuards,
} from '@nestjs/common';
import { SkipThrottle } from '@nestjs/throttler';
import type { Request } from 'express';
import { JwtAuthGuard } from '../../common/guards/jwt-auth.guard';
import { CsrfGuard } from '../../common/guards/csrf.guard';
import { CurrentUser, type AuthUser } from '../../common/decorators/current-user.decorator';
import { parseBody } from '../../common/parse-body';
import { BillingService } from './billing.service';
import { checkoutSchema } from './dto/billing.dto';

@Controller('billing')
export class BillingController {
  constructor(private readonly billing: BillingService) {}

  @UseGuards(JwtAuthGuard, CsrfGuard)
  @Post('checkout-session')
  async checkout(@CurrentUser() user: AuthUser, @Body() body: Record<string, unknown>) {
    const { planKey } = parseBody(checkoutSchema, body);
    const url = await this.billing.createCheckoutSession(user.id, user.email, planKey);
    return { url };
  }

  @UseGuards(JwtAuthGuard, CsrfGuard)
  @Post('portal')
  async portal(@CurrentUser() user: AuthUser) {
    const url = await this.billing.createPortalSession(user.id);
    return { url };
  }

  // Public, signé, body brut. Exclu du throttle (Stripe rejoue ses events).
  @SkipThrottle()
  @Post('webhook')
  @HttpCode(200)
  async webhook(@Req() req: RawBodyRequest<Request>, @Headers('stripe-signature') signature: string) {
    if (!req.rawBody) throw new BadRequestException('Body brut requis');
    await this.billing.handleWebhook(req.rawBody, signature);
    return { received: true };
  }
}
```
Run: `pnpm test billing.controller` → PASS (4 tests).

- [ ] **Step 4: Module**

`src/modules/billing/billing.module.ts` :
```ts
import { Module } from '@nestjs/common';
import { BillingController } from './billing.controller';
import { BillingService } from './billing.service';
import { StripeEventsRepository } from './stripe-events.repository';

@Module({
  controllers: [BillingController],
  providers: [BillingService, StripeEventsRepository],
})
export class BillingModule {}
```
(`STRIPE` vient de `StripeModule` @Global ; `SubscriptionRepository` est exporté par `EntitlementsModule` @Global.)

- [ ] **Step 5: Enregistrer dans `app.module.ts`**

Dans `src/app.module.ts` :
- Imports en tête : `import { StripeModule } from './modules/billing/stripe.module';` et `import { BillingModule } from './modules/billing/billing.module';`
- Dans `imports` du `@Module`, après `EntitlementsModule` : `StripeModule,` puis `BillingModule,`.

- [ ] **Step 6: Build + suite complète**

Run: `pnpm build && pnpm test`
Expected: build OK, **toute** la suite verte.

- [ ] **Step 7: Commit (suggéré)**

```
feat(billing): endpoints /billing checkout-session, portal, webhook + module
```

---

## Definition of Done (Phase 4 back)

- [ ] `pnpm build` + `pnpm test` verts (anciens + ~13 nouveaux).
- [ ] `stripe` installé ; 4 vars env optionnelles ; `main.ts` en `rawBody: true`.
- [ ] `POST /billing/checkout-session` (JWT+CSRF) → `{ url }`, mappe planKey→price, réutilise le customer.
- [ ] `POST /billing/portal` (JWT+CSRF) → `{ url }`.
- [ ] `POST /billing/webhook` public, `@SkipThrottle`, signature vérifiée, idempotent, met à jour `subscriptions`.
- [ ] Override admin non écrasé par erreur ; dégradation entitlement inchangée.

## Notes de clôture (HORS plan back — à faire ensuite)

1. **Config Stripe (toi)** : créer 2 produits/prix mensuels dans le dashboard Stripe, renseigner `.env` back : `STRIPE_SECRET_KEY`, `STRIPE_WEBHOOK_SECRET`, `STRIPE_PRICE_FAMILY`, `STRIPE_PRICE_FAMILY_HEALTH`.
2. **Smoke local** : `stripe listen --forward-to localhost:3001/billing/webhook` puis un checkout de test → vérifier la ligne `subscriptions` mise à jour. (Bloqué tant que les clés ne sont pas là.)
3. **Câblage front (mini-cycle Angular AAK ensuite)** : sur `/upgrade` (contexte `app`), le CTA payant appelle `POST /billing/checkout-session` puis `window.location = url` (au lieu du `routerLink="/settings"` actuel) ; ajouter un `BillingGateway` (front) + bouton « Gérer mon abonnement » → `POST /billing/portal`. Gérer les retours `?checkout=success|cancel`.
4. **Prod** : enregistrer l'endpoint webhook dans Stripe (URL publique `api.*/billing/webhook`) + le `STRIPE_WEBHOOK_SECRET` correspondant (Dokploy env).
