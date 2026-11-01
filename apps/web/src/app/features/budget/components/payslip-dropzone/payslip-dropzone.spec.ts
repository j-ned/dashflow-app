import { TestBed } from '@angular/core/testing';
import { describe, expect, it } from 'vitest';
import { PayslipDropzone } from './payslip-dropzone';

type Cmp = {
  pendingFile: () => File | null;
  isDragging: () => boolean;
  onDragOver: (e: DragEvent) => void;
  onDragLeave: () => void;
  onDrop: (e: DragEvent) => void;
  onFileInput: (e: Event) => void;
};

function make() {
  TestBed.configureTestingModule({});
  TestBed.overrideComponent(PayslipDropzone, { set: { template: '', imports: [] } });
  const fixture = TestBed.createComponent(PayslipDropzone);
  fixture.detectChanges();
  return { fixture, cmp: fixture.componentInstance as unknown as Cmp };
}

const FILE = new File(['x'], 'payslip.pdf', { type: 'application/pdf' });

describe('PayslipDropzone', () => {
  it('onFileInput pose le fichier sélectionné dans pendingFile', () => {
    const { cmp } = make();
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [FILE] });
    cmp.onFileInput({ target: input } as unknown as Event);
    expect(cmp.pendingFile()).toBe(FILE);
  });

  it('onFileInput sans fichier ne change rien', () => {
    const { cmp } = make();
    const input = document.createElement('input');
    Object.defineProperty(input, 'files', { value: [] });
    cmp.onFileInput({ target: input } as unknown as Event);
    expect(cmp.pendingFile()).toBeNull();
  });

  it('onDrop pose le fichier déposé et désactive isDragging', () => {
    const { cmp } = make();
    const event = {
      preventDefault: () => undefined,
      stopPropagation: () => undefined,
      dataTransfer: { files: [FILE] },
    } as unknown as DragEvent;
    cmp.onDrop(event);
    expect(cmp.pendingFile()).toBe(FILE);
    expect(cmp.isDragging()).toBe(false);
  });

  it('onDragOver active isDragging, onDragLeave le désactive', () => {
    const { cmp } = make();
    const event = {
      preventDefault: () => undefined,
      stopPropagation: () => undefined,
    } as unknown as DragEvent;
    cmp.onDragOver(event);
    expect(cmp.isDragging()).toBe(true);
    cmp.onDragLeave();
    expect(cmp.isDragging()).toBe(false);
  });
});
