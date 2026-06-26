import { describe, expect, it, beforeEach, vi } from 'vitest';
import { TestBed } from '@angular/core/testing';
import { TranslocoService } from '@jsverse/transloco';
import { DocumentForm, DocumentSubmitData } from './document-form';
import { MedicalDocument } from '../../domain/models/document.model';

type Cmp = {
  submitForm: (event: Event) => Promise<void>;
  submitted: { subscribe: (fn: (v: DocumentSubmitData) => void) => void };
};

const DOCUMENT: MedicalDocument = {
  id: 'd1',
  patientId: 'p1',
  practitionerId: 'pr1',
  type: 'facture',
  title: 'Consultation',
  date: '2026-01-15',
  fileUrl: null,
  notes: 'RAS',
};

function make(initial: MedicalDocument | null) {
  TestBed.configureTestingModule({
    providers: [{ provide: TranslocoService, useValue: { translate: (k: string) => k } }],
  });
  TestBed.overrideComponent(DocumentForm, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(DocumentForm);
  fixture.componentRef.setInput('initial', initial);
  fixture.detectChanges();
  return { fixture, cmp: fixture.componentInstance as unknown as Cmp };
}

describe('DocumentForm (Signal Forms)', () => {
  beforeEach(() => TestBed.resetTestingModule());

  it('given un form vide (création), when submit, then n’émet pas (gate de validité)', async () => {
    const { fixture, cmp } = make(null);
    const onSubmit = vi.fn();
    cmp.submitted.subscribe(onSubmit);

    await cmp.submitForm(new Event('submit'));
    await fixture.whenStable();

    expect(onSubmit).not.toHaveBeenCalled();
  });

  it('given un document initial valide, when submit, then émet le payload (data sans id/fileUrl + fichier null)', async () => {
    const { fixture, cmp } = make(DOCUMENT);
    let emitted: DocumentSubmitData | undefined;
    cmp.submitted.subscribe((v) => (emitted = v));

    await cmp.submitForm(new Event('submit'));
    await fixture.whenStable();

    expect(emitted).toEqual({
      data: {
        patientId: 'p1',
        practitionerId: 'pr1',
        type: 'facture',
        title: 'Consultation',
        date: '2026-01-15',
        notes: 'RAS',
      },
      file: null,
    });
  });

  it('given des champs optionnels vides, when submit, then émet practitionerId et notes = null', async () => {
    const { fixture, cmp } = make({ ...DOCUMENT, practitionerId: null, notes: null });
    let emitted: DocumentSubmitData | undefined;
    cmp.submitted.subscribe((v) => (emitted = v));

    await cmp.submitForm(new Event('submit'));
    await fixture.whenStable();

    expect(emitted?.data.practitionerId).toBeNull();
    expect(emitted?.data.notes).toBeNull();
  });
});
