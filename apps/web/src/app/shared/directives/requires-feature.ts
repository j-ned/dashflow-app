import { Directive, effect, inject, input, TemplateRef, ViewContainerRef } from '@angular/core';
import { EntitlementStore } from '@core/entitlements/entitlement.store';
import type { Feature } from '@core/entitlements/entitlement.types';
import { LockedShell } from './locked-shell';

@Directive({
  selector: '[appRequiresFeature]',
})
export class RequiresFeature {
  private readonly template = inject<TemplateRef<unknown>>(TemplateRef);
  private readonly viewContainer = inject(ViewContainerRef);
  private readonly store = inject(EntitlementStore);

  readonly feature = input.required<Feature>({ alias: 'appRequiresFeature' });

  constructor() {
    effect(() => {
      const feature = this.feature();
      const granted = this.store.can(feature);

      this.viewContainer.clear();
      if (granted) {
        this.viewContainer.createEmbeddedView(this.template);
      } else {
        const shell = this.viewContainer.createComponent(LockedShell);
        shell.setInput('content', this.template);
        shell.setInput('feature', feature);
      }
    });
  }
}
