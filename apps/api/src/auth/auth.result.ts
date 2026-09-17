export type Result<T> =
  | { success: true; data: T }
  | {
      success: false;
      error: string;
      status: number;
      code?: string;
      details?: unknown;
    };
export const ok = <T>(data: T): Result<T> => ({ success: true, data });
export const fail = (
  status: number,
  error: string,
  code?: string,
  details?: unknown,
): Result<never> => ({ success: false, error, status, code, details });
