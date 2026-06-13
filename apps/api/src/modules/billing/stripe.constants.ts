import type Stripe from 'stripe';

export const STRIPE = Symbol('STRIPE');
export type StripeClient = Stripe.Stripe;
