export type KeyMaterial = {
  salt: string;
  wrappedMasterKey: string;
  recoveryWrappedKey: string | null;
};
