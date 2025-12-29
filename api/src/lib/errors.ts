export type ErrorDetails = Record<string, unknown> | string[] | string | null;

export class ApiError extends Error {
  status: number;
  code: string;
  details?: ErrorDetails;

  constructor(status: number, message: string, code = "error", details?: ErrorDetails) {
    super(message);
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

export function isApiError(err: unknown): err is ApiError {
  return err instanceof ApiError;
}