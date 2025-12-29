import { ApiError } from "./errors";

type ValidationIssue = {
  field: string;
  message: string;
};

function fail(field: string, message: string): never {
  throw new ApiError(400, "Request validation failed", "validation_error", {
    issues: [{ field, message }] satisfies ValidationIssue[]
  });
}

export function asRecord(value: unknown, field = "body"): Record<string, unknown> {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(field, "must be an object");
  }
  return value as Record<string, unknown>;
}

export function readString(
  value: unknown,
  field: string,
  options?: {
    required?: boolean;
    allowNull?: boolean;
    minLength?: number;
  }
): string | null | undefined {
  if (value === undefined) {
    if (options?.required) {
      fail(field, "is required");
    }
    return undefined;
  }
  if (value === null) {
    if (options?.allowNull) {
      return null;
    }
    fail(field, "must be a string");
  }
  if (typeof value !== "string") {
    fail(field, "must be a string");
  }
  if (options?.minLength && value.length < options.minLength) {
    fail(field, `must be at least ${options.minLength} characters`);
  }
  return value;
}

export function readStringArray(
  value: unknown,
  field: string,
  options?: {
    allowNull?: boolean;
    minLength?: number;
  }
): string[] | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    if (options?.allowNull) {
      return null;
    }
    fail(field, "must be an array");
  }
  if (!Array.isArray(value)) {
    fail(field, "must be an array");
  }
  const items: string[] = [];
  for (let i = 0; i < value.length; i += 1) {
    const item = value[i];
    if (typeof item !== "string") {
      fail(`${field}[${i}]`, "must be a string");
    }
    if (options?.minLength && item.length < options.minLength) {
      fail(`${field}[${i}]`, `must be at least ${options.minLength} characters`);
    }
    items.push(item);
  }
  return items;
}

export function readUuid(
  value: unknown,
  field: string,
  options?: {
    allowNull?: boolean;
  }
): string | null | undefined {
  const raw = readString(value, field, { allowNull: options?.allowNull });
  if (raw === undefined || raw === null) {
    return raw;
  }
  const uuidRegex = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-5][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
  if (!uuidRegex.test(raw)) {
    fail(field, "must be a valid UUID");
  }
  return raw;
}

export function readEmail(
  value: unknown,
  field: string,
  options?: {
    allowNull?: boolean;
  }
): string | null | undefined {
  const raw = readString(value, field, { allowNull: options?.allowNull });
  if (raw === undefined || raw === null) {
    return raw;
  }
  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(raw)) {
    fail(field, "must be a valid email address");
  }
  return raw;
}

export type IngredientInput = {
  name: string;
  quantity?: string | null;
};

export function readIngredients(
  value: unknown,
  field: string
): IngredientInput[] | null | undefined {
  if (value === undefined) {
    return undefined;
  }
  if (value === null) {
    return null;
  }
  if (!Array.isArray(value)) {
    fail(field, "must be an array");
  }

  return value.map((item, index) => {
    if (!item || typeof item !== "object" || Array.isArray(item)) {
      fail(`${field}[${index}]`, "must be an object");
    }
    const record = item as Record<string, unknown>;
    const name = readString(record.name, `${field}[${index}].name`, {
      required: true,
      minLength: 1
    }) as string;
    const quantity = readString(record.quantity, `${field}[${index}].quantity`, {
      allowNull: true,
      minLength: 1
    });

    return {
      name,
      quantity: quantity ?? null
    };
  });
}

export function readPositiveInt(
  value: string | null,
  field: string,
  options: { defaultValue: number; min?: number; max?: number }
): number {
  if (value === null || value === undefined || value === "") {
    return options.defaultValue;
  }
  const parsed = Number(value);
  if (!Number.isFinite(parsed) || Number.isNaN(parsed) || !Number.isInteger(parsed)) {
    fail(field, "must be a number");
  }
  if (options.min !== undefined && parsed < options.min) {
    fail(field, `must be at least ${options.min}`);
  }
  if (options.max !== undefined && parsed > options.max) {
    fail(field, `must be at most ${options.max}`);
  }
  return parsed;
}

export function readBoolean(
  value: string | null,
  field: string
): boolean | undefined {
  if (value === null || value === undefined || value === "") {
    return undefined;
  }
  const lowered = value.toLowerCase();
  if (lowered === "true") {
    return true;
  }
  if (lowered === "false") {
    return false;
  }
  return undefined;
}
