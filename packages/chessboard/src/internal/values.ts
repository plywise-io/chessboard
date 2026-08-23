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
export type BoardColor = "white" | "black";

export function assertSquare(
  value: unknown,
  label: string,
): `${BoardFile}${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}` {
  if (!isSquare(value)) {
    throw new TypeError(
      `${label} must be a square like "e4", got ${describe(value)}`,
    );
  }
  return value;
}

export function assertColor(value: unknown, label: string): BoardColor {
  if (value !== "white" && value !== "black") {
    throw new TypeError(
      `${label} must be "white" or "black", got ${describe(value)}`,
    );
  }
  return value;
}

export function assertPiece(
  value: unknown,
  label: string,
): { readonly color: BoardColor; readonly role: BoardRole } {
  if (!value || typeof value !== "object") {
    throw new TypeError(
      `${label} must be a piece object, got ${describe(value)}`,
    );
  }
  const candidate = value as { color?: unknown; role?: unknown };
  if (!isRole(candidate.role)) {
    throw new TypeError(
      `${label}.role must be a valid role, got ${describe(candidate.role)}`,
    );
  }
  return {
    color: assertColor(candidate.color, `${label}.color`),
    role: candidate.role,
  };
}

export function describe(value: unknown): string {
  if (typeof value === "string") return JSON.stringify(value);
  if (value === undefined) return "undefined";
  if (typeof value === "function") return "function";
  try {
    return JSON.stringify(value);
  } catch {
    return String(value);
  }
}

export function compareSquares(
  a: `${BoardFile}${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`,
  b: `${BoardFile}${1 | 2 | 3 | 4 | 5 | 6 | 7 | 8}`,
): number {
  if (a.charAt(0) === b.charAt(0)) return Number(a[1]) - Number(b[1]);
  return a < b ? -1 : 1;
}
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
