export type Patient = {
  readonly id: string;
  readonly firstName: string;
  readonly lastName: string;
  readonly birthDate: string;
  readonly notes: string | null;
};
