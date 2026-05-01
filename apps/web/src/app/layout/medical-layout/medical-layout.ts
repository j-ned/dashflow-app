import { ChangeDetectionStrategy, Component } from '@angular/core';
import { RouterOutlet } from '@angular/router';
import { FeatureSidebar, type FeatureSidebarItem } from '../feature-sidebar/feature-sidebar';

const MEDICAL_NAV: readonly FeatureSidebarItem[] = [
  { route: '/medical/dashboard', icon: 'layout-dashboard', label: 'Vue globale' },
  { route: '/medical/patients', icon: 'users', label: 'Patients' },
  { route: '/medical/practitioners', icon: 'stethoscope', label: 'Praticiens' },
  { route: '/medical/appointments', icon: 'calendar', label: 'Rendez-vous' },
  { route: '/medical/prescriptions', icon: 'file-text', label: 'Ordonnances' },
  { route: '/medical/documents', icon: 'folder', label: 'Documents' },
  { route: '/medical/medications', icon: 'pill', label: 'Médicaments' },
  { route: '/medical/reminders', icon: 'bell', label: 'Alertes' },
];

@Component({
  selector: 'app-medical-layout',
  changeDetection: ChangeDetectionStrategy.OnPush,
  host: { class: 'flex w-full h-full' },
  imports: [RouterOutlet, FeatureSidebar],
  template: `
    <app-feature-sidebar [items]="navItems" navLabel="Navigation médicale" />

    <section
      aria-labelledby="medical-content-heading"
      class="flex-1 flex flex-col overflow-auto bg-canvas p-6"
    >
      <h1 id="medical-content-heading" class="sr-only">Contenu médical</h1>
      <router-outlet />
    </section>
  `,
})
export class MedicalLayout {
  protected readonly navItems = MEDICAL_NAV;
}
