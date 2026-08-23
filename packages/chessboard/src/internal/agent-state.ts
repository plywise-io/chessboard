import type {
  Annotation,
  ArrowAnnotation,
  CircleAnnotation,
  Color,
  Destinations,
  LastMove,
  Piece,
  Presentation,
  Square,
} from "../index.js";
import {
  assertColor,
  assertPiece,
  assertSquare,
  cloneJsonValue,
  compareSquares,
  describe,
  type JsonValue,
} from "./values.js";

// BoardSnapshot is the JSON-compatible internal view of every meaningful
// renderer datum. Public collections (Map, Set) and callbacks are flattened
// or stripped so the snapshot survives a JSON round trip without leaking
// the imperative renderer surface.
export interface BoardSnapshot {
  readonly position: readonly (readonly [Square, Piece])[];
  readonly orientation: Color;
  readonly selected: Square | null;
  readonly lastMove: LastMove | null;
  readonly checked: Square | null;
  readonly destinations: readonly (readonly [Square, readonly Square[]])[];
  readonly annotations: readonly Annotation[];
  readonly visibleLayers: readonly string[] | null;
}

// BoardCommand is the constrained internal command union. Each variant
// carries validated domain data only; functions, DOM nodes, and arbitrary
// executable operations are impossible to encode.
export type BoardCommand =
  | {
      readonly kind: "replacePosition";
      readonly position: BoardSnapshot["position"];
    }
  | { readonly kind: "move"; readonly from: Square; readonly to: Square }
  | { readonly kind: "setOrientation"; readonly orientation: Color }
  | {
      readonly kind: "setPresentation";
      readonly presentation: Presentation;
    }
  | {
      readonly kind: "replaceAnnotations";
      readonly annotations: readonly Annotation[];
    }
  | {
      readonly kind: "setVisibleLayers";
      readonly layers: readonly string[] | null;
    };

export interface SnapshotState {
  readonly position: ReadonlyMap<Square, Piece>;
  readonly orientation: Color;
  readonly selected: Square | null;
  readonly lastMove: LastMove | null;
  readonly checked: Square | null;
  readonly destinations: Destinations;
  readonly annotations: readonly Annotation[];
  readonly visibleLayers: ReadonlySet<string> | null;
}

function assertJsonMetadata(value: unknown, label: string): JsonValue {
  return cloneJsonValue(value, label);
}
function compareIds(a: Annotation, b: Annotation): number {
  return a.id < b.id ? -1 : a.id > b.id ? 1 : 0;
}

function assertKeys(
  value: Record<string, unknown>,
  allowed: readonly string[],
): void {
  for (const key of Object.keys(value)) {
    if (!allowed.includes(key)) {
      throw new TypeError(`command contains unknown field ${key}`);
    }
  }
}

// Builder — convert validated renderer state into a deterministic snapshot.
// Caller collections are copied so later external mutation cannot change
// the resulting snapshot.
export function snapshotFromState(state: SnapshotState): BoardSnapshot {
  const positionEntries = [...state.position.entries()]
    .map(([square, piece]) => [square, { ...piece }] as const)
    .sort(([a], [b]) => compareSquares(a, b));
  const destinationEntries = [...state.destinations.entries()]
    .map(
      ([from, dests]) =>
        [from, [...dests].sort((a, b) => compareSquares(a, b))] as const,
    )
    .sort(([a], [b]) => compareSquares(a, b));
  const annotations = parseAnnotationArray(
    state.annotations,
    "state.annotations",
  );
  return {
    position: positionEntries,
    orientation: state.orientation,
    selected: state.selected,
    lastMove: state.lastMove ? { ...state.lastMove } : null,
    checked: state.checked,
    destinations: destinationEntries,
    annotations,
    visibleLayers:
      state.visibleLayers === null ? null : [...state.visibleLayers].sort(),
  };
}

// Serialization — JSON round trips are deterministic because position,
// destinations, and annotations are sorted before encoding.
export function serializeSnapshot(snapshot: BoardSnapshot): string {
  return JSON.stringify(snapshot);
}

export function parseSnapshot(input: string): BoardSnapshot {
  let raw: unknown;
  try {
    raw = JSON.parse(input);
  } catch (error) {
    throw new TypeError(
      `snapshot must be valid JSON: ${(error as Error).message}`,
    );
  }
  return snapshotFromParsed(raw);
}

export function snapshotFromParsed(value: unknown): BoardSnapshot {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("snapshot must be a plain object");
  }
  const v = value as Record<string, unknown>;

  const position = parsePositionArray(v.position, "snapshot.position");
  const orientation = assertColor(v.orientation, "snapshot.orientation");
  const selected = parseOptionalSquare(v.selected, "snapshot.selected");
  const lastMove = parseOptionalLastMove(v.lastMove, "snapshot.lastMove");
  const checked = parseOptionalSquare(v.checked, "snapshot.checked");
  const destinations = parseDestinationsArray(
    v.destinations,
    "snapshot.destinations",
  );
  const annotations = parseAnnotationArray(
    v.annotations,
    "snapshot.annotations",
  );
  const visibleLayers = parseLayerArray(
    v.visibleLayers,
    "snapshot.visibleLayers",
  );

  return {
    position,
    orientation,
    selected,
    lastMove,
    checked,
    destinations,
    annotations,
    visibleLayers,
  };
}

function parsePositionArray(
  value: unknown,
  label: string,
): readonly (readonly [Square, Piece])[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an array`);
  }
  const seen = new Set<string>();
  const entries: Array<readonly [Square, Piece]> = value.map((entry, i) => {
    if (!Array.isArray(entry) || entry.length !== 2) {
      throw new TypeError(`${label}[${i}] must be a [square, piece] pair`);
    }
    const square = assertSquare(entry[0], `${label}[${i}][0]`);
    if (seen.has(square)) {
      throw new TypeError(`${label} contains duplicate square ${square}`);
    }
    seen.add(square);
    const piece = assertPiece(entry[1], `${label}[${i}][1]`);
    return [square, piece] as const;
  });
  entries.sort(([a], [b]) => compareSquares(a, b));
  return entries;
}

function parseDestinationsArray(
  value: unknown,
  label: string,
): readonly (readonly [Square, readonly Square[]])[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an array`);
  }
  const seen = new Set<string>();
  const entries: Array<readonly [Square, readonly Square[]]> = value.map(
    (entry, i) => {
      if (!Array.isArray(entry) || entry.length !== 2) {
        throw new TypeError(`${label}[${i}] must be a [square, squares] pair`);
      }
      const from = assertSquare(entry[0], `${label}[${i}][0]`);
      if (seen.has(from)) {
        throw new TypeError(`${label} contains duplicate source ${from}`);
      }
      seen.add(from);
      const destsRaw = entry[1];
      if (!Array.isArray(destsRaw)) {
        throw new TypeError(`${label}[${i}][1] must be a square array`);
      }
      const dests = destsRaw.map((d, j) =>
        assertSquare(d, `${label}[${i}][1][${j}]`),
      );
      dests.sort((a, b) => compareSquares(a, b));
      return [from, dests] as const;
    },
  );
  entries.sort(([a], [b]) => compareSquares(a, b));
  return entries;
}

function parseAnnotationArray(
  value: unknown,
  label: string,
): readonly Annotation[] {
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an array`);
  }
  const seen = new Set<string>();
  const annotations: Annotation[] = value.map((entry, i) => {
    const annotation = parseAnnotation(entry, `${label}[${i}]`);
    if (seen.has(annotation.id)) {
      throw new TypeError(`${label} contains duplicate id ${annotation.id}`);
    }
    seen.add(annotation.id);
    return annotation;
  });
  annotations.sort(compareIds);
  return annotations;
}

function parseLayerArray(
  value: unknown,
  label: string,
): readonly string[] | null {
  if (value === null) return null;
  if (!Array.isArray(value)) {
    throw new TypeError(`${label} must be an array or null`);
  }
  const layers = new Set<string>();
  for (const layer of value) {
    if (typeof layer !== "string" || layer.length === 0) {
      throw new TypeError(`${label} entries must be non-empty strings`);
    }
    layers.add(layer);
  }
  return [...layers].sort();
}

function parseOptionalSquare(value: unknown, label: string): Square | null {
  if (value === null || value === undefined) return null;
  return assertSquare(value, label);
}

function parseOptionalLastMove(value: unknown, label: string): LastMove | null {
  if (value === null || value === undefined) return null;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  const v = value as Record<string, unknown>;
  return {
    from: assertSquare(v.from, `${label}.from`),
    to: assertSquare(v.to, `${label}.to`),
  };
}

function parseAnnotation(value: unknown, label: string): Annotation {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  const v = value as Record<string, unknown>;
  if (typeof v.id !== "string" || v.id.length === 0) {
    throw new TypeError(`${label}.id must be a non-empty string`);
  }
  if (typeof v.layer !== "string" || v.layer.length === 0) {
    throw new TypeError(`${label}.layer must be a non-empty string`);
  }
  if (v.color !== undefined && typeof v.color !== "string") {
    throw new TypeError(`${label}.color must be a string when present`);
  }
  const metadata =
    v.metadata === undefined
      ? undefined
      : assertJsonMetadata(v.metadata, `${label}.metadata`);

  const base = {
    id: v.id,
    layer: v.layer,
    ...(v.color !== undefined ? { color: v.color as string } : {}),
    ...(metadata !== undefined ? { metadata } : {}),
  };

  if (v.kind === "arrow") {
    const from = assertSquare(v.from, `${label}.from`);
    const to = assertSquare(v.to, `${label}.to`);
    const arrow: ArrowAnnotation = { ...base, kind: "arrow", from, to };
    return arrow;
  }
  if (v.kind === "circle") {
    const square = assertSquare(v.square, `${label}.square`);
    const circle: CircleAnnotation = { ...base, kind: "circle", square };
    return circle;
  }
  throw new TypeError(
    `${label}.kind must be "arrow" or "circle", got ${describe(v.kind)}`,
  );
}

// Commands — validated and JSON-compatible. Parsing rejects unknown
// fields, unknown kinds, and any value that isn't plain domain data.
export function validateCommand(value: unknown): BoardCommand {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError("command must be an object");
  }
  const v = value as Record<string, unknown>;
  switch (v.kind) {
    case "replacePosition":
      assertKeys(v, ["kind", "position"]);
      return {
        kind: "replacePosition",
        position: parsePositionArray(v.position, "command.position"),
      };
    case "move":
      assertKeys(v, ["kind", "from", "to"]);
      return {
        kind: "move",
        from: assertSquare(v.from, "command.from"),
        to: assertSquare(v.to, "command.to"),
      };
    case "setOrientation":
      assertKeys(v, ["kind", "orientation"]);
      return {
        kind: "setOrientation",
        orientation: assertColor(v.orientation, "command.orientation"),
      };
    case "setPresentation":
      assertKeys(v, ["kind", "presentation"]);
      return {
        kind: "setPresentation",
        presentation: parsePresentation(v.presentation, "command.presentation"),
      };
    case "replaceAnnotations":
      assertKeys(v, ["kind", "annotations"]);
      return {
        kind: "replaceAnnotations",
        annotations: parseAnnotationArray(v.annotations, "command.annotations"),
      };
    case "setVisibleLayers":
      assertKeys(v, ["kind", "layers"]);
      return {
        kind: "setVisibleLayers",
        layers: parseLayerArray(v.layers, "command.layers"),
      };
    default:
      throw new TypeError(`unknown command kind ${describe(v.kind)}`);
  }
}

function parsePresentation(value: unknown, label: string): Presentation {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  const v = value as Record<string, unknown>;
  const selected =
    v.selected === undefined || v.selected === null
      ? undefined
      : assertSquare(v.selected, `${label}.selected`);
  const checked =
    v.checked === undefined || v.checked === null
      ? undefined
      : assertSquare(v.checked, `${label}.checked`);
  const lastMove = parseOptionalLastMoveField(v.lastMove, `${label}.lastMove`);
  const builder: { -readonly [K in keyof Presentation]: Presentation[K] } = {};
  if (selected !== undefined) builder.selected = selected;
  if (lastMove !== undefined) builder.lastMove = lastMove;
  if (checked !== undefined) builder.checked = checked;
  return builder;
}

function parseOptionalLastMoveField(
  value: unknown,
  label: string,
): Presentation["lastMove"] | undefined {
  if (value === undefined || value === null) return undefined;
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(`${label} must be an object`);
  }
  const v = value as Record<string, unknown>;
  return {
    from: assertSquare(v.from, `${label}.from`),
    to: assertSquare(v.to, `${label}.to`),
  };
}

// Execution seam — apply a validated command to a snapshot state object
// and return the next state. Pure data in, pure data out. Rendering,
// interaction, and DOM updates stay in the renderer.
export function applyCommand(
  state: SnapshotState,
  command: BoardCommand,
): SnapshotState {
  switch (command.kind) {
    case "replacePosition":
      return { ...state, position: new Map(command.position) };
    case "move": {
      const piece = state.position.get(command.from);
      if (!piece) throw new TypeError(`no piece at ${command.from}`);
      const next = new Map(state.position);
      next.delete(command.from);
      next.set(command.to, piece);
      return { ...state, position: next };
    }
    case "setOrientation":
      return { ...state, orientation: command.orientation };
    case "setPresentation":
      return {
        ...state,
        selected: command.presentation.selected ?? null,
        lastMove: command.presentation.lastMove ?? null,
        checked: command.presentation.checked ?? null,
      };
    case "replaceAnnotations":
      return { ...state, annotations: [...command.annotations] };
    case "setVisibleLayers":
      return {
        ...state,
        visibleLayers: command.layers === null ? null : new Set(command.layers),
      };
  }
}

export function roundTripSnapshot(snapshot: BoardSnapshot): BoardSnapshot {
  return parseSnapshot(serializeSnapshot(snapshot));
}
