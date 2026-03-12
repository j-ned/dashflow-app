import { describe, it, expect } from 'vitest';
import { FormControl, FormGroup } from '@angular/forms';
import { passwordMatchValidator, conditionalRequiredValidator } from './form-validators';

describe('passwordMatchValidator', () => {
  function buildGroup(password: string, confirm: string) {
    return new FormGroup(
      {
        password: new FormControl(password),
        confirm: new FormControl(confirm),
      },
      { validators: [passwordMatchValidator('password', 'confirm')] },
    );
  }

  it('should return null when passwords match', () => {
    const group = buildGroup('Secret123!', 'Secret123!');
    expect(group.errors).toBeNull();
  });

  it('should return { mismatch: true } when passwords differ', () => {
    const group = buildGroup('Secret123!', 'Different');
    expect(group.errors).toEqual({ mismatch: true });
  });

  it('should return null when both fields are empty', () => {
    const group = buildGroup('', '');
    expect(group.errors).toBeNull();
  });
});

describe('conditionalRequiredValidator', () => {
  function buildGroup(target: string, required: string) {
    return new FormGroup(
      {
        role: new FormControl(target),
        licenseNumber: new FormControl(required),
      },
      { validators: [conditionalRequiredValidator('role', 'doctor', 'licenseNumber')] },
    );
  }

  it('should return error when target matches and required field is empty', () => {
    const group = buildGroup('doctor', '');
    expect(group.errors).toEqual({ conditionalRequired: { field: 'licenseNumber' } });
  });

  it('should return null when target matches and required field has value', () => {
    const group = buildGroup('doctor', 'LIC-001');
    expect(group.errors).toBeNull();
  });

  it('should return null when target does not match (regardless of required field)', () => {
    const group = buildGroup('patient', '');
    expect(group.errors).toBeNull();
  });
});
