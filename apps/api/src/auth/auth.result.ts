export type Result<T> = { success: true; data: T } | { success: false; error: string; status: number; code?: string };
export const ok = <T>(data: T): Result<T> => ({ success: true, data });
export const fail = (status: number, error: string, code?: string): Result<never> => ({ success: false, error, status, code });
