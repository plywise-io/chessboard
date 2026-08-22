export const files = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
export const roles = [
  "pawn",
  "knight",
  "bishop",
  "rook",
  "queen",
  "king",
] as const;

export type BoardFile = (typeof files)[number];
export type BoardRole = (typeof roles)[number];
export type JsonValue =
  | null
  | boolean
  | number
  | string
  | readonly JsonValue[]
  | { readonly [key: string]: JsonValue };

export function isSquare(
  value: unknown,
): value is `${BoardFile}${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}` {
  return typeof value === "string" && /^[a-h][1-8]$/.test(value);
}

export function isRole(value: unknown): value is BoardRole {
  return typeof value === "string" && roles.some((role) => role === value);
}

export function cloneJsonValue(
  value: unknown,
  label: string,
  seen = new WeakSet<object>(),
): JsonValue {
  if (
    value === null ||
    typeof value === "string" ||
    typeof value === "boolean"
  ) {
    return value;
  }
  if (typeof value === "number") {
    if (!Number.isFinite(value)) {
      throw new TypeError(`${label} must be a finite number, got ${value}`);
    }
    return value;
  }
  if (typeof value !== "object") {
    throw new TypeError(
      `${label} must be JSON-compatible, got ${typeof value}`,
    );
  }
  if (seen.has(value)) {
    throw new TypeError(`${label} must not contain cyclic values`);
  }
  seen.add(value);
  try {
    if (Array.isArray(value)) {
      return value.map((entry, index) =>
        cloneJsonValue(entry, `${label}[${index}]`, seen),
      );
    }
    const proto = Object.getPrototypeOf(value);
    if (proto !== Object.prototype && proto !== null) {
      throw new TypeError(`${label} must be a plain object or array`);
    }
    const out: Record<string, JsonValue> = {};
    for (const key of Object.keys(value as Record<string, unknown>)) {
      out[key] = cloneJsonValue(
        (value as Record<string, unknown>)[key],
        `${label}.${key}`,
        seen,
      );
    }
    return out;
  } finally {
    seen.delete(value);
  }
}
