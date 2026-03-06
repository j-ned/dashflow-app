import { ApplicationConfig } from '@angular/core';
import { provideRouter, withComponentInputBinding, withViewTransitions } from '@angular/router';
import { provideHttpClient, withFetch } from '@angular/common/http';
import { routes } from './app.routes';
import { EnvelopeGateway } from '@features/budget/domain/gateways/envelope.gateway';
import { SupabaseEnvelopeGateway } from '@features/budget/infra/supabase-envelope.gateway';
import { LoanGateway } from '@features/budget/domain/gateways/loan.gateway';
import { SupabaseLoanGateway } from '@features/budget/infra/supabase-loan.gateway';
import { ConsumableGateway } from '@features/budget/domain/gateways/consumable.gateway';
import { SupabaseConsumableGateway } from '@features/budget/infra/supabase-consumable.gateway';
import { ClientGateway } from '@features/freelance/domain/gateways/client.gateway';
import { SupabaseClientGateway } from '@features/freelance/infra/supabase-client.gateway';
import { QuoteGateway } from '@features/freelance/domain/gateways/quote.gateway';
import { SupabaseQuoteGateway } from '@features/freelance/infra/supabase-quote.gateway';
import { InvoiceGateway } from '@features/freelance/domain/gateways/invoice.gateway';
import { SupabaseInvoiceGateway } from '@features/freelance/infra/supabase-invoice.gateway';
import { FiscalGateway } from '@features/freelance/domain/gateways/fiscal.gateway';
import { SupabaseFiscalGateway } from '@features/freelance/infra/supabase-fiscal.gateway';

export const appConfig: ApplicationConfig = {
  providers: [
    provideRouter(routes, withComponentInputBinding(), withViewTransitions()),
    provideHttpClient(withFetch()),

    // Budget gateways
    { provide: EnvelopeGateway, useClass: SupabaseEnvelopeGateway },
    { provide: LoanGateway, useClass: SupabaseLoanGateway },
    { provide: ConsumableGateway, useClass: SupabaseConsumableGateway },

    // Freelance gateways
    { provide: ClientGateway, useClass: SupabaseClientGateway },
    { provide: QuoteGateway, useClass: SupabaseQuoteGateway },
    { provide: InvoiceGateway, useClass: SupabaseInvoiceGateway },
    { provide: FiscalGateway, useClass: SupabaseFiscalGateway },
  ],
};
