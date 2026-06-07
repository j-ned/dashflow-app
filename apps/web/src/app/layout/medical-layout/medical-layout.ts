import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { TranslocoPipe } from '@jsverse/transloco';
import { FeatureSidebar, type FeatureSidebarItem } from '../feature-sidebar/feature-sidebar';

const MEDICAL_NAV: readonly FeatureSidebarItem[] = [
  { route: '/medical/dashboard', icon: 'layout-dashboard', labelKey: 'layout.medical.dashboard' },
  { route: '/medical/patients', icon: 'users', labelKey: 'layout.medical.patients' },
  {
    route: '/medical/practitioners',
    icon: 'stethoscope',
    labelKey: 'layout.medical.practitioners',
  },
  { route: '/medical/appointments', icon: 'calendar', labelKey: 'layout.medical.appointments' },
  { route: '/medical/prescriptions', icon: 'file-text', labelKey: 'layout.medical.prescriptions' },
  { route: '/medical/documents', icon: 'folder', labelKey: 'layout.medical.documents' },
  { route: '/medical/medications', icon: 'pill', labelKey: 'layout.medical.medications' },
  { route: '/medical/reminders', icon: 'bell', labelKey: 'layout.medical.reminders' },
];

@Component({
  selector: 'app-medical-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex w-full h-full' },
  imports: [RouterOutlet, FeatureSidebar, TranslocoPipe],
  template: `
    <app-feature-sidebar [items]="navItems" navLabelKey="layout.medical.navLabel" />

    <section
      aria-labelledby="medical-content-heading"
      class="flex-1 flex flex-col overflow-auto bg-canvas p-6"
    >
      <h1 id="medical-content-heading" class="sr-only">
        {{ 'layout.medical.contentHeading' | transloco }}
      </h1>
      <router-outlet />
    </section>
  `,
})
export class MedicalLayout {
  protected readonly navItems = MEDICAL_NAV;
}
