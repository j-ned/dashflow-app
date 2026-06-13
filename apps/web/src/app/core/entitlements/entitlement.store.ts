import { computed, inject, Injectable, signal } from '@angular/core';
import { firstValueFrom } from 'rxjs';
import { ApiClient } from '@core/services/api/api-client';
import type { Entitlement, Feature, PlanKey, PlanLimits } from './entitlement.types';

type EntitlementDto = {
  readonly planKey: PlanKey;
  readonly features: readonly string[];
  readonly limits: PlanLimits;
};

const KNOWN_FEATURES: ReadonlySet<Feature> = new Set<Feature>([
  'medical.access',
  'budget.import',
  'budget.advanced',
  'family.sharing',
]);

function toEntitlement(dto: EntitlementDto): Entitlement {
  return {
    planKey: dto.planKey,
    features: dto.features.filter((f): f is Feature => KNOWN_FEATURES.has(f as Feature)),
    limits: dto.limits,
  };
}

@Injectable({ providedIn: 'root' })
export class EntitlementStore {
  private readonly api = inject(ApiClient);

  private readonly _entitlement = signal<Entitlement | null>(null);
  private readonly _isLoaded = signal(false);
  private _inFlight: Promise<void> | null = null;

  readonly entitlement = this._entitlement.asReadonly();
  readonly isLoaded = this._isLoaded.asReadonly();
  readonly planKey = computed<PlanKey | null>(() => this._entitlement()?.planKey ?? null);

  async load(): Promise<void> {
    if (this._isLoaded()) return;
    if (this._inFlight) return this._inFlight;
    this._inFlight = this._fetch();
    return this._inFlight;
  }

  async reload(): Promise<void> {
    this._inFlight = this._fetch();
    return this._inFlight;
  }

  reset(): void {
    this._entitlement.set(null);
    this._isLoaded.set(false);
    this._inFlight = null;
  }

  can(feature: Feature): boolean {
    return this._entitlement()?.features.includes(feature) ?? false;
  }

  limitOf(key: keyof PlanLimits): number | null {
    return this._entitlement()?.limits[key] ?? null;
  }

  private async _fetch(): Promise<void> {
    try {
      const dto = await firstValueFrom(this.api.get<EntitlementDto>('/me/entitlements'));
      this._entitlement.set(toEntitlement(dto));
      this._isLoaded.set(true);
    } catch {
      this._entitlement.set(null);
      this._isLoaded.set(false);
    } finally {
      this._inFlight = null;
    }
  }
}
