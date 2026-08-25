import {
  cburnett,
  celtic,
  chessnut,
  kiwenSuwi,
  rhosgfx,
  spatial,
} from "./internal/pieceSets.gen.js";
import {
  type BoardFile,
  type BoardRole,
  cloneJsonValue,
  files,
  type JsonValue as InternalJsonValue,
  isRole,
  isSquare,
} from "./internal/values.js";

export type Color = "white" | "black";
export type File = BoardFile;
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type Role = BoardRole;
export type Square = `${File}${Rank}`;

export interface Piece {
  readonly color: Color;
  readonly role: Role;
}

export type Position = ReadonlyMap<Square, Piece>;

export type SelectEvent = {
  readonly type: "select";
  readonly square: Square;
  readonly origin: "pointer";
};
export type ClearEvent = {
  readonly type: "clear";
  readonly origin: "pointer";
};
export type MoveEvent = {
  readonly type: "move";
  readonly from: Square;
  readonly to: Square;
  readonly origin: "selection" | "drag";
};
export type CircleEvent = {
  readonly type: "circle";
  readonly square: Square;
  readonly origin: "pointer";
  readonly color?: string;
};
export type ArrowEvent = {
  readonly type: "arrow";
  readonly from: Square;
  readonly to: Square;
  readonly origin: "pointer";
  readonly color?: string;
};
export type InteractionEvent =
  | SelectEvent
  | ClearEvent
  | MoveEvent
  | CircleEvent
  | ArrowEvent;

export type AnnotationModifier = "alt" | "ctrl" | "meta" | "shift";
export interface AnnotationGesture {
  readonly modifiers?: readonly AnnotationModifier[];
  readonly color?: string;
}

export type Destinations = ReadonlyMap<Square, readonly Square[]>;

export interface Interaction {
  readonly destinations: Destinations;
  readonly onEvent: (event: InteractionEvent) => void;
  readonly annotationGestures?: readonly AnnotationGesture[];
}

export interface LastMove {
  readonly from: Square;
  readonly to: Square;
}

export interface Presentation {
  readonly selected?: Square;
  readonly lastMove?: LastMove;
  readonly checked?: Square;
}
export type JsonValue = InternalJsonValue;

export interface ArrowAnnotation {
  readonly id: string;
  readonly kind: "arrow";
  readonly from: Square;
  readonly to: Square;
  readonly layer: string;
  readonly color?: string;
  readonly metadata?: JsonValue;
}

export interface CircleAnnotation {
  readonly id: string;
  readonly kind: "circle";
  readonly square: Square;
  readonly layer: string;
  readonly color?: string;
  readonly metadata?: JsonValue;
}

export type Annotation = ArrowAnnotation | CircleAnnotation;

/** Square colors. Omitted keys fall back to the stylesheet default (brown). */
export interface BoardTheme {
  readonly light?: string;
  readonly dark?: string;
}

/** Raw SVG sources for one piece set, keyed by `{w|b}{P,N,B,R,Q,K}` codes. */
export interface PieceSources {
  readonly wK: string;
  readonly wQ: string;
  readonly wR: string;
  readonly wB: string;
  readonly wN: string;
  readonly wP: string;
  readonly bK: string;
  readonly bQ: string;
  readonly bR: string;
  readonly bB: string;
  readonly bN: string;
  readonly bP: string;
}

/** Import an individual set when bundle size matters. */
export { cburnett, celtic, chessnut, kiwenSuwi, rhosgfx, spatial };

/**
 * Curated piece sets vendored into the package as raw SVG sources; the
 * renderer serves them as `data:image/svg+xml` URIs, so rendering never
 * touches a network. rhosgfx is CC0 1.0; kiwen-suwi is CC BY 4.0
 * (attribution required); chessnut is Apache-2.0 (pinned upstream commit);
 * spatial and celtic are MIT artwork by Maurizio Monge.
 *
 * NOTICE (required when distributing this package or its artifacts):
 *   - default     © Colin M.L. Burnett — see assets/cburnett/LICENSE.md
 *   - `kiwenSuwi` © neverRare   — https://lichess.org/@/neverRare
 * Full licenses and per-file provenance: packages/chessboard/assets/SETS.md.
 */
export const pieceSets = {
  cburnett,
  rhosgfx,
  kiwenSuwi,
  chessnut,
  spatial,
  celtic,
} as const satisfies Record<string, PieceSources>;

/** Names of the curated piece sets in {@link pieceSets}. */
export type PieceSetName = keyof typeof pieceSets;

export const boardThemes = {
  brown: { light: "#f0d9b5", dark: "#b58863" },
  blue: { light: "#dee3e6", dark: "#8ca2ad" },
  green: { light: "#ffffdd", dark: "#86a666" },
  walnut: { light: "#e8d7b5", dark: "#6b4226" },
  slate: { light: "#eaebed", dark: "#707789" },
} as const;

/** Names of the curated board themes in {@link boardThemes}. */
export type BoardThemeName = keyof typeof boardThemes;

export interface ChessboardConfig {
  readonly position: Position;
  readonly orientation?: Color;
  readonly ariaLabel?: string;
  readonly animationMs?: number;
  /** Edge coordinates (files a–h, ranks 1–8), orientation-aware. */
  readonly coordinates?: boolean;
  readonly interaction?: Interaction | null;
  readonly presentation?: Presentation;
  /**
   * Piece artwork: a {@link PieceSources} object with embedded SVG sources
   * (see {@link pieceSets}), or a base URL of a directory containing
   * `{w|b}{P,N,B,R,Q,K}.svg` files. Omitted renders the vendored default
   * artwork (Cburnett, embedded data URIs); `null` renders built-in Unicode
   * glyphs.
   */
  readonly pieceSet?: PieceSources | string | null;
  /** Square colors (see {@link boardThemes}); omit or pass `null` to reset. */
  readonly theme?: BoardTheme | null;
  readonly annotations?: readonly Annotation[];
  /**
   * Caller-controlled set of layer names that should be visible. Omitted
   * means all layers are visible; an explicit empty set hides every layer.
   * Layer names are opaque strings supplied by the caller; the renderer
   * applies no semantic meaning to them.
   */
  readonly visibleLayers?: ReadonlySet<string> | null;
}

export interface ChessboardUpdate {
  readonly position?: Position;
  readonly orientation?: Color;
  readonly ariaLabel?: string;
  readonly animationMs?: number;
  readonly coordinates?: boolean;
  readonly interaction?: Interaction | null;
  readonly presentation?: Presentation;
  /**
   * Same contract as on {@link ChessboardConfig}. Omitting the field leaves
   * the current piece set unchanged; `null` restores Unicode glyphs. The
   * vendored default can only be selected at creation time.
   */
  readonly pieceSet?: PieceSources | string | null;
  /**
   * Same contract as on {@link ChessboardConfig}. Omitting the field leaves
   * the current theme unchanged; `null` restores stylesheet defaults.
   */
  readonly theme?: BoardTheme | null;
  readonly annotations?: readonly Annotation[];
  /**
   * Same visibility contract as on {@link ChessboardConfig}. Omitting the
   * field on an update leaves the current visibility unchanged.
   */
  readonly visibleLayers?: ReadonlySet<string> | null;
}

export type ChessboardMoveUpdate = Omit<ChessboardUpdate, "position">;

export interface Chessboard {
  set(update: ChessboardUpdate): void;
  move(from: Square, to: Square, update?: ChessboardMoveUpdate): void;
  destroy(): void;
}

const symbols: Record<Color, Record<Role, string>> = {
  white: {
    pawn: "♙",
    knight: "♘",
    bishop: "♗",
    rook: "♖",
    queen: "♕",
    king: "♔",
  },
  black: {
    pawn: "♟",
    knight: "♞",
    bishop: "♝",
    rook: "♜",
    queen: "♛",
    king: "♚",
  },
};

// Piece-set filenames use English chess notation, so the knight is N.
const pieceLetters: Record<Role, string> = {
  pawn: "P",
  knight: "N",
  bishop: "B",
  rook: "R",
  queen: "Q",
  king: "K",
};
// Data URIs for caller-supplied {@link PieceSources}, cached per object so
// repeated paints never re-encode. Validated inputs are copies, so entries
// garbage-collect with the caller's object.
const sourcesDataUris = new WeakMap<
  PieceSources,
  Record<keyof PieceSources, string>
>();

function sourcesDataUri(
  sources: PieceSources,
  color: Color,
  role: Role,
): string {
  const code = `${color[0]}${pieceLetters[role]}` as keyof PieceSources;
  let perSet = sourcesDataUris.get(sources);
  if (perSet === undefined) {
    perSet = {} as Record<keyof PieceSources, string>;
    sourcesDataUris.set(sources, perSet);
  }
  let url = perSet[code];
  if (url === undefined) {
    url = `data:image/svg+xml,${encodeURIComponent(sources[code].trim())}`;
    perSet[code] = url;
  }
  return url;
}

// A press must travel this far (CSS px) before it becomes a drag, so
// jitter-sized movement inside a click never lifts the piece.
// ponytail: fixed distance; expose a config knob only if a consumer
// measurably needs a different activation feel.
const dragActivationPx = 3;

type MarkKind =
  | "selected"
  | "destination"
  | "last-move-from"
  | "last-move-to"
  | "check";

function markKey(kind: MarkKind, square: Square): string {
  return `${kind}:${square}`;
}

function annotationRenderKey(
  annotation: Annotation,
  orientation: Color,
): string {
  const color = annotation.color ?? "";
  return annotation.kind === "arrow"
    ? `arrow\u001f${annotation.layer}\u001f${color}\u001f${orientation}\u001f${annotation.from}\u001f${annotation.to}`
    : `circle\u001f${annotation.layer}\u001f${color}\u001f${orientation}\u001f${annotation.square}`;
}

function squareToCoord(
  square: Square,
  orientation: Color,
): { x: number; y: number } {
  const file = files.indexOf(square[0] as File);
  const rank = Number(square[1]);
  return {
    x: orientation === "white" ? file : 7 - file,
    y: orientation === "white" ? 8 - rank : rank - 1,
  };
}

function place(node: HTMLElement, square: Square, orientation: Color): void {
  const { x, y } = squareToCoord(square, orientation);
  placeCoord(node, x, y);
}

function placeCoord(node: HTMLElement, x: number, y: number): void {
  node.style.setProperty("--pw-file", String(x));
  node.style.setProperty("--pw-rank", String(y));
}

// Visual cell (x, y) sits on a light square when x + y is even, matching
// the stylesheet's fixed checkerboard.
function coordParity(x: number, y: number): "light" | "dark" {
  return (x + y) % 2 === 0 ? "light" : "dark";
}

export function createChessboard(
  host: HTMLElement,
  config: ChessboardConfig,
): Chessboard {
  let orientation = validateColor(config.orientation ?? "white", "orientation");
  let position = validatePosition(config.position);
  let interaction: Interaction | null = config.interaction
    ? validateInteraction(config.interaction)
    : null;
  const initialPresentation = config.presentation
    ? validatePresentation(config.presentation)
    : {};
  let selected: Square | undefined = initialPresentation.selected;
  let lastMove: LastMove | undefined = initialPresentation.lastMove
    ? {
        from: initialPresentation.lastMove.from,
        to: initialPresentation.lastMove.to,
      }
    : undefined;
  let checkedSquare: Square | undefined = initialPresentation.checked;
  let destinations: Destinations = interaction
    ? interaction.destinations
    : new Map();
  let annotations: readonly Annotation[] = validateAnnotations(
    config.annotations,
  );
  let visibleLayers: ReadonlySet<string> | undefined = validateVisibleLayers(
    config.visibleLayers,
  );
  let pieceSet: PieceSources | string | null | undefined = validatePieceSet(
    config.pieceSet,
  );
  let theme: BoardTheme | undefined = validateTheme(config.theme);
  let coordinates =
    config.coordinates === undefined
      ? false
      : validateBoolean(config.coordinates, "coordinates");
  let destroyed = false;
  // A pointerdown starts a candidate; the first move fills in the visual
  // fields and commits it as a drag.
  type DragState = {
    readonly source: Square;
    readonly pointerId: number;
    piece: HTMLDivElement | null;
    // Translucent stand-in left on the origin square during the drag.
    ghost: HTMLDivElement | null;
    // Highlight of the legal destination currently under the pointer.
    destMark: HTMLDivElement | null;
    destSquare: Square | null;
    // Grab offset in cell units, captured at press time, so the piece
    // keeps the grabbed point under the pointer while dragging.
    readonly grabXFrac: number;
    readonly grabYFrac: number;
    clientX: number;
    clientY: number;
    frame: number | null;
  };
  let drag: DragState | null = null;

  // A right-button press starts an annotation gesture: release on the
  // source square requests a circle, dragging to another square requests
  // an arrow. The caller owns annotation state; the renderer shows only a
  // transient snapped preview.
  type DrawState = {
    readonly source: Square;
    readonly pointerId: number;
    readonly color: string | undefined;
    preview: SVGElement | null;
    clientX: number;
    clientY: number;
    frame: number | null;
  };
  let draw: DrawState | null = null;

  const board = host.ownerDocument.createElement("div");
  const view = host.ownerDocument.defaultView;
  const nodes = new Map<Square, HTMLDivElement>();
  const markNodes = new Map<string, HTMLDivElement>();
  type RenderKeyedAnnotation = SVGElement & { __pwRenderKey?: string };
  const annotationNodes = new Map<string, RenderKeyedAnnotation>();
  const annotationLayer = host.ownerDocument.createElementNS(
    "http://www.w3.org/2000/svg",
    "svg",
  );
  annotationLayer.classList.add("pw-annotations");
  annotationLayer.setAttribute("viewBox", "0 0 8 8");
  annotationLayer.setAttribute("preserveAspectRatio", "none");
  annotationLayer.setAttribute("aria-hidden", "true");
  annotationLayer.setAttribute("pointer-events", "none");
  annotationLayer.style.pointerEvents = "none";
  const coordinateLayer = host.ownerDocument.createElement("div");
  coordinateLayer.className = "pw-coordinates";
  coordinateLayer.setAttribute("aria-hidden", "true");
  coordinateLayer.style.pointerEvents = "none";
  board.className = "pw-board";
  board.setAttribute("role", "img");
  board.setAttribute("aria-label", config.ariaLabel ?? "Chessboard");
  board.style.setProperty(
    "--pw-animation-duration",
    `${validateAnimation(config.animationMs ?? 150)}ms`,
  );
  function applyTheme(next: BoardTheme | undefined): void {
    for (const key of ["light", "dark"] as const) {
      const color = next?.[key];
      if (color === undefined) {
        board.style.removeProperty(`--pw-${key}-square`);
      } else {
        board.style.setProperty(`--pw-${key}-square`, color);
      }
    }
  }

  function repaintPieceImage(node: HTMLDivElement, piece: Piece): void {
    if (pieceSet !== null) {
      const url =
        typeof pieceSet === "string"
          ? `${pieceSet}${piece.color[0]}${pieceLetters[piece.role]}.svg`
          : pieceSet !== undefined
            ? sourcesDataUri(pieceSet, piece.color, piece.role)
            : sourcesDataUri(cburnett, piece.color, piece.role);
      if (node.style.backgroundImage !== `url("${url}")`) {
        node.style.backgroundImage = `url("${url}")`;
      }
      if (node.textContent !== "") node.textContent = "";
    } else {
      if (node.style.backgroundImage !== "") node.style.backgroundImage = "";
      const symbol = symbols[piece.color][piece.role];
      if (node.textContent !== symbol) node.textContent = symbol;
    }
  }

  applyTheme(theme);

  board.append(annotationLayer, coordinateLayer);
  host.append(board);

  function paintPiece(
    node: HTMLDivElement,
    square: Square,
    piece: Piece,
  ): void {
    node.dataset.square = square;
    node.dataset.color = piece.color;
    node.dataset.role = piece.role;
    repaintPieceImage(node, piece);
    place(node, square, orientation);
  }

  function paintAnnotation(node: SVGElement, annotation: Annotation): void {
    if (annotation.kind === "arrow") {
      const from = squareToCoord(annotation.from, orientation);
      const to = squareToCoord(annotation.to, orientation);
      const x1 = from.x + 0.5;
      const y1 = from.y + 0.5;
      const x2 = to.x + 0.5;
      const y2 = to.y + 0.5;
      const angle = Math.atan2(y2 - y1, x2 - x1);
      const baseX = x2 - Math.cos(angle) * 0.35;
      const baseY = y2 - Math.sin(angle) * 0.35;
      const leftX = (baseX + Math.sin(angle) * 0.18).toFixed(3);
      const leftY = (baseY - Math.cos(angle) * 0.18).toFixed(3);
      const rightX = (baseX - Math.sin(angle) * 0.18).toFixed(3);
      const rightY = (baseY + Math.cos(angle) * 0.18).toFixed(3);
      node.setAttribute(
        "d",
        `M ${x1} ${y1} L ${x2} ${y2} M ${leftX} ${leftY} L ${x2} ${y2} L ${rightX} ${rightY}`,
      );
    } else {
      const center = squareToCoord(annotation.square, orientation);
      node.setAttribute("cx", String(center.x + 0.5));
      node.setAttribute("cy", String(center.y + 0.5));
      node.setAttribute("r", "0.45");
    }
  }

  function createAnnotationNode(annotation: Annotation): RenderKeyedAnnotation {
    const tag = annotation.kind === "arrow" ? "path" : "circle";
    const node = host.ownerDocument.createElementNS(
      "http://www.w3.org/2000/svg",
      tag,
    ) as RenderKeyedAnnotation;
    applyAnnotationDataAttrs(node, annotation);

    return node;
  }

  function applyAnnotationDataAttrs(
    node: RenderKeyedAnnotation,
    annotation: Annotation,
  ): void {
    if (node.getAttribute("data-annotation-id") !== annotation.id) {
      node.setAttribute("data-annotation-id", annotation.id);
    }
    if (node.getAttribute("data-annotation-kind") !== annotation.kind) {
      node.setAttribute("data-annotation-kind", annotation.kind);
    }
    if (node.getAttribute("data-annotation-layer") !== annotation.layer) {
      node.setAttribute("data-annotation-layer", annotation.layer);
    }
    // Inline style rather than the SVG presentation attribute: the
    // stylesheet's `.pw-annotations path|circle { stroke }` rule would
    // override a presentation attribute anyway.
    const stroke = annotation.color ?? "";
    if (node.style.stroke !== stroke) {
      if (annotation.color !== undefined) {
        node.style.stroke = annotation.color;
      } else {
        node.style.removeProperty("stroke");
      }
    }
  }

  function renderAnnotations(next: readonly Annotation[]): void {
    const seen = new Set<string>();
    for (const annotation of next) {
      seen.add(annotation.id);
      const key = annotationRenderKey(annotation, orientation);
      let node = annotationNodes.get(annotation.id);
      if (node && node.dataset.annotationKind !== annotation.kind) {
        node.remove();
        annotationNodes.delete(annotation.id);
        node = undefined;
      }
      if (!node) {
        node = createAnnotationNode(annotation);
        paintAnnotation(node, annotation);
        annotationLayer.append(node);
        node.__pwRenderKey = key;
        annotationNodes.set(annotation.id, node);
      } else if (node.__pwRenderKey !== key) {
        applyAnnotationDataAttrs(node, annotation);
        paintAnnotation(node, annotation);
        node.__pwRenderKey = key;
      }
    }
    for (const [id, node] of annotationNodes) {
      if (!seen.has(id)) {
        node.remove();
        annotationNodes.delete(id);
      }
    }
  }

  // Slice 05 visibility filter. Opaque layer names: `undefined` means
  // every layer renders; an explicit empty set hides every annotation
  // while leaving annotation state intact for later re-enablement.
  function renderVisibleAnnotations(next: readonly Annotation[]): void {
    if (visibleLayers === undefined) {
      renderAnnotations(next);
      return;
    }
    const filtered: Annotation[] = [];
    for (const annotation of next) {
      if (visibleLayers.has(annotation.layer)) filtered.push(annotation);
    }
    renderAnnotations(filtered);
  }

  // Reconcile by piece identity (color + role) so a piece that changed
  // squares keeps its DOM node and the stylesheet transition animates the
  // move — the same guarantee `move()` gives the caller-approved path.
  // A node whose piece stays on its square is untouched; unmatched nodes
  // relocate to a square needing the same piece type; the rest go away.
  function renderPosition(next: Position, deferMarks = false): void {
    // Validate first so callers see the same atomic throw as the
    // unified update path; mutations only happen on success.
    const checked = validatePosition(next);
    position = checked;
    reconcilePieces();
    // Direct callers (initial render, `move()` with no companion update)
    // rely on the synchronous mark reconciliation. A batched update can
    // defer until every mark source has been applied, so a single
    // `renderMarks()` covers all of them.
    if (!deferMarks) renderMarks();
  }

  function renderMarks(): void {
    const wanted = collectMarks(
      selected,
      destinations,
      position,
      lastMove,
      checkedSquare,
    );
    const wantedKeys = new Set<string>();
    for (const mark of wanted) {
      wantedKeys.add(mark.key);
      const existing = markNodes.get(mark.key);
      if (existing) {
        if (mark.kind === "destination") {
          existing.dataset.destination = mark.occupied ? "occupied" : "empty";
        } else {
          delete existing.dataset.destination;
        }
        place(existing, mark.square, orientation);
        continue;
      }
      const node = host.ownerDocument.createElement("div");
      node.className = `pw-mark pw-mark-${mark.kind}`;
      node.dataset.mark = mark.kind;
      if (mark.kind === "destination") {
        node.dataset.destination = mark.occupied ? "occupied" : "empty";
      }
      node.dataset.square = mark.square;
      place(node, mark.square, orientation);
      markNodes.set(mark.key, node);
      board.append(node);
    }
    for (const [key, node] of markNodes) {
      if (!wantedKeys.has(key)) {
        node.remove();
        markNodes.delete(key);
      }
    }
  }

  // Edge coordinates: one label per file on the bottom edge row and one
  // per rank on the left edge column, placed through the same
  // --pw-file/--pw-rank transform as pieces so they follow the
  // orientation. Each label carries the parity of the square it sits on
  // so the stylesheet can contrast it against the checkerboard.
  function renderCoordinates(): void {
    const doc = host.ownerDocument;
    coordinateLayer.replaceChildren();
    if (!coordinates) return;
    for (const file of files) {
      const label = doc.createElement("span");
      label.className = "pw-coordinate pw-coordinate-file";
      label.dataset.file = file;
      label.textContent = file;
      const x = squareToCoord(`${file}1` as Square, orientation).x;
      label.dataset.parity = coordParity(x, 7);
      placeCoord(label, x, 7);
      coordinateLayer.append(label);
    }
    for (let rank = 1; rank <= 8; rank += 1) {
      const label = doc.createElement("span");
      label.className = "pw-coordinate pw-coordinate-rank";
      label.dataset.rank = String(rank);
      label.textContent = String(rank);
      const y = squareToCoord(`a${rank}` as Square, orientation).y;
      label.dataset.parity = coordParity(0, y);
      placeCoord(label, 0, y);
      coordinateLayer.append(label);
    }
  }

  function squareAt(
    clientX: number,
    clientY: number,
    rect: DOMRect,
  ): Square | null {
    if (rect.width <= 0 || rect.height <= 0) return null;
    const x = clientX - rect.left;
    const y = clientY - rect.top;
    if (x < 0 || y < 0 || x >= rect.width || y >= rect.height) return null;
    const col = Math.floor((x / rect.width) * 8);
    const row = Math.floor((y / rect.height) * 8);
    if (col < 0 || col > 7 || row < 0 || row > 7) return null;
    const fileIndex = orientation === "white" ? col : 7 - col;
    const rankIndex = orientation === "white" ? 7 - row : row;
    const file = files[fileIndex];
    if (!file) return null;
    return `${file}${rankIndex + 1}` as Square;
  }

  function pointerTarget(event: PointerEvent): Square | null {
    return squareAt(
      event.clientX,
      event.clientY,
      board.getBoundingClientRect(),
    );
  }
  function clearDragVisual(): void {
    const active = drag;
    drag = null;
    if (!active) return;
    if (active.frame !== null) {
      if (view) view.cancelAnimationFrame(active.frame);
      else cancelAnimationFrame(active.frame);
    }
    active.ghost?.remove();
    active.destMark?.remove();
    if (active.piece) {
      active.piece.style.removeProperty("transform");
      active.piece.style.removeProperty("transition");
      active.piece.classList.remove("pw-piece-dragging");
      delete active.piece.dataset.dragging;
    }
    if (board.hasPointerCapture(active.pointerId)) {
      board.releasePointerCapture(active.pointerId);
    }
  }

  function contextMenu(event: MouseEvent): void {
    // Right-button gestures own the context menu while the board is
    // interactive; spectator boards keep the browser default.
    if (interaction !== null) event.preventDefault();
  }

  function clearDrawVisual(): void {
    const active = draw;
    draw = null;
    if (!active) return;
    if (active.frame !== null) {
      if (view) view.cancelAnimationFrame(active.frame);
      else cancelAnimationFrame(active.frame);
    }
    active.preview?.remove();
    if (board.hasPointerCapture(active.pointerId)) {
      board.releasePointerCapture(active.pointerId);
    }
  }

  function updateDrawPreview(current: Square): void {
    const active = draw;
    if (!active) return;
    const kind = current === active.source ? "circle" : "arrow";
    const shape: Annotation =
      kind === "circle"
        ? {
            id: "pw-preview",
            kind: "circle",
            square: active.source,
            layer: "preview",
            ...(active.color !== undefined ? { color: active.color } : {}),
          }
        : {
            id: "pw-preview",
            kind: "arrow",
            from: active.source,
            to: current,
            layer: "preview",
            ...(active.color !== undefined ? { color: active.color } : {}),
          };
    let node = active.preview;
    // The rendered node's kind attribute is the source of truth; swap the
    // SVG element only when circle and arrow trade places.
    if (node?.getAttribute("data-annotation-kind") !== kind) {
      node?.remove();
      node = createAnnotationNode(shape);
      node.classList.add("pw-annotation-preview");
      annotationLayer.append(node);
      active.preview = node;
    }
    paintAnnotation(node, shape);
  }

  function flushDrawPreview(): void {
    const active = draw;
    if (!active) return;
    active.frame = null;
    const target = squareAt(
      active.clientX,
      active.clientY,
      board.getBoundingClientRect(),
    );
    if (target) updateDrawPreview(target);
  }

  function applyDragOffset(): void {
    const active = drag;
    if (!active) return;
    active.frame = null;
    const rect = board.getBoundingClientRect();
    updateDragTarget(active, squareAt(active.clientX, active.clientY, rect));
    const { piece } = active;
    if (!piece) return;
    // Live rect per frame so a host resize mid-drag keeps the piece under
    // the pointer, at one cached-layout read per animation frame. The
    // inline transform replaces the stylesheet transform, so it is an
    // absolute board-relative position: pointer minus the press-time grab
    // offset expressed in cell units.
    if (rect.width <= 0 || rect.height <= 0) return;
    const offsetX =
      active.clientX - rect.left - active.grabXFrac * (rect.width / 8);
    const offsetY =
      active.clientY - rect.top - active.grabYFrac * (rect.height / 8);
    piece.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
  }

  // Highlight the legal destination currently under the pointer, using the
  // destination/capture colors; hidden whenever the pointer is not over a
  // destination of the dragged piece. Runs once per animation frame from
  // applyDragOffset, never from raw pointermove.
  function updateDragTarget(active: DragState, square: Square | null): void {
    const allowed = destinations.get(active.source) ?? [];
    const target =
      square !== null && square !== active.source && allowed.includes(square)
        ? square
        : null;
    if (target === null) {
      active.destMark?.remove();
      active.destMark = null;
      active.destSquare = null;
      return;
    }
    if (active.destMark === null) {
      const node = host.ownerDocument.createElement("div");
      node.className = "pw-mark pw-mark-drag-target";
      node.setAttribute("aria-hidden", "true");
      board.append(node);
      active.destMark = node;
    }
    active.destMark.dataset.destination = position.has(target)
      ? "occupied"
      : "empty";
    if (active.destSquare !== target) {
      active.destMark.dataset.square = target;
      place(active.destMark, target, orientation);
      active.destSquare = target;
    }
  }

  function startDrag(active: DragState): void {
    const piece = nodes.get(active.source);
    if (!piece) return;
    active.piece = piece;
    // Translucent stand-in keeps the piece visible on its origin square
    const ghost = piece.cloneNode(true) as HTMLDivElement;
    // data-square stays unique to real piece nodes so callers and tests
    // can key on it.
    delete ghost.dataset.square;
    ghost.classList.add("pw-piece-ghost");
    piece.before(ghost);
    active.ghost = ghost;
    piece.classList.add("pw-piece-dragging");
    piece.dataset.dragging = "true";
    piece.style.transition = "none";
  }

  // Resolve a configured annotation gesture's color for the current
  // pointerdown: exact-set match on the four modifier keys. Returns
  // undefined when no binding matches (including the no-gestures case) so
  // the preview falls back to the stylesheet default.
  function resolveAnnotationGestureColor(
    event: PointerEvent,
  ): string | undefined {
    const gestures = interaction?.annotationGestures;
    if (!gestures) return undefined;
    const pressed: AnnotationModifier[] = [];
    if (event.altKey) pressed.push("alt");
    if (event.ctrlKey) pressed.push("ctrl");
    if (event.metaKey) pressed.push("meta");
    if (event.shiftKey) pressed.push("shift");
    const pressedKey = pressed.sort().join("+");
    for (const gesture of gestures) {
      const mods = gesture.modifiers ?? [];
      if ([...mods].sort().join("+") === pressedKey) return gesture.color;
    }
    return undefined;
  }

  function pointerDown(event: PointerEvent): void {
    if (event.button === 2) {
      // Right-button gesture: circle on release over the source square,
      // arrow when dragged to a different square. Any square qualifies;
      // annotation legality is not the renderer's concern.
      if (!event.isPrimary || !interaction || draw || drag) return;
      const target = pointerTarget(event);
      if (!target) return;
      draw = {
        source: target,
        pointerId: event.pointerId,
        color: resolveAnnotationGestureColor(event),
        preview: null,
        clientX: event.clientX,
        clientY: event.clientY,
        frame: null,
      };
      if (!board.hasPointerCapture(event.pointerId)) {
        board.setPointerCapture(event.pointerId);
      }
      updateDrawPreview(target);
      return;
    }
    if (event.button !== 0 || draw) return;
    if (!event.isPrimary) return;
    if (!interaction) return;
    const target = pointerTarget(event);
    if (!target) return;

    // Track a drag candidate: any pointerdown on a selectable source may
    // become a drag on the first `pointermove`. We defer drag commitment so
    // a stationary click still emits the slice-01 click events from the
    // same handler. The pointer capture is shared by both paths.
    if (destinations.has(target)) {
      const rect = board.getBoundingClientRect();
      const fileIndex = files.indexOf(target[0] as File);
      const rankIndex = Number(target[1]) - 1;
      const col = orientation === "white" ? fileIndex : 7 - fileIndex;
      const row = orientation === "white" ? 7 - rankIndex : rankIndex;
      drag = {
        source: target,
        pointerId: event.pointerId,
        piece: null,
        ghost: null,
        destMark: null,
        destSquare: null,
        grabXFrac: (event.clientX - rect.left) / (rect.width / 8) - col,
        grabYFrac: (event.clientY - rect.top) / (rect.height / 8) - row,
        clientX: event.clientX,
        clientY: event.clientY,
        frame: null,
      };
    } else {
      drag = null;
    }

    const dests = destinations;
    const inSelectedDests = selected
      ? (dests.get(selected)?.includes(target) ?? false)
      : false;

    if (selected && inSelectedDests && selected !== target) {
      // The click resolves this gesture; it must not promote to a drag.
      drag = null;
      interaction.onEvent({
        type: "move",
        from: selected,
        to: target,
        origin: "selection",
      });
      return;
    }
    if (selected === target) {
      drag = null;
      interaction.onEvent({ type: "clear", origin: "pointer" });
      return;
    }
    if (dests.has(target)) {
      interaction.onEvent({
        type: "select",
        square: target,
        origin: "pointer",
      });
      return;
    }
    interaction.onEvent({ type: "clear", origin: "pointer" });
  }

  function pointerMove(event: PointerEvent): void {
    if (!event.isPrimary) return;
    const activeDraw = draw;
    if (activeDraw && activeDraw.pointerId === event.pointerId) {
      if (interaction !== null) {
        activeDraw.clientX = event.clientX;
        activeDraw.clientY = event.clientY;
        if (activeDraw.frame === null) {
          activeDraw.frame = view
            ? view.requestAnimationFrame(flushDrawPreview)
            : requestAnimationFrame(flushDrawPreview);
        }
      }
      return;
    }
    const active = drag;
    if (
      !active ||
      active.pointerId !== event.pointerId ||
      interaction === null
    ) {
      return;
    }
    // Promote the pointerdown candidate to a real drag once the pointer
    // travels past the activation threshold; jitter-sized movement keeps
    // the gesture a click. Click-to-select still runs because pointerdown
    // already emitted.
    if (!active.piece) {
      if (
        Math.hypot(
          event.clientX - active.clientX,
          event.clientY - active.clientY,
        ) < dragActivationPx
      ) {
        return;
      }
      if (!board.hasPointerCapture(event.pointerId)) {
        board.setPointerCapture(event.pointerId);
      }
      startDrag(active);
    }
    if (!active.piece) return;
    active.clientX = event.clientX;
    active.clientY = event.clientY;
    if (active.frame === null) {
      active.frame = view
        ? view.requestAnimationFrame(applyDragOffset)
        : requestAnimationFrame(applyDragOffset);
    }
  }

  function pointerUp(event: PointerEvent): void {
    if (event.button === 2) {
      const activeDraw = draw;
      if (activeDraw && activeDraw.pointerId === event.pointerId) {
        const drop = pointerTarget(event);
        if (drop && interaction !== null) {
          interaction.onEvent(
            drop === activeDraw.source
              ? {
                  type: "circle",
                  square: drop,
                  origin: "pointer",
                  ...(activeDraw.color !== undefined
                    ? { color: activeDraw.color }
                    : {}),
                }
              : {
                  type: "arrow",
                  from: activeDraw.source,
                  to: drop,
                  origin: "pointer",
                  ...(activeDraw.color !== undefined
                    ? { color: activeDraw.color }
                    : {}),
                },
          );
        }
        clearDrawVisual();
      }
      return;
    }
    if (board.hasPointerCapture(event.pointerId)) {
      board.releasePointerCapture(event.pointerId);
    }
    const active = drag;
    if (!active || active.pointerId !== event.pointerId) return;
    if (active.piece !== null && interaction !== null) {
      const drop = pointerTarget(event);
      const allowed = destinations.get(active.source) ?? [];
      if (drop && drop !== active.source && allowed.includes(drop)) {
        interaction.onEvent({
          type: "move",
          from: active.source,
          to: drop,
          origin: "drag",
        });
      }
    }
    clearDragVisual();
  }

  function pointerCancel(event: PointerEvent): void {
    if (drag?.pointerId === event.pointerId) clearDragVisual();
    if (draw?.pointerId === event.pointerId) clearDrawVisual();
  }

  function lostPointerCapture(event: PointerEvent): void {
    if (drag?.pointerId === event.pointerId) clearDragVisual();
    if (draw?.pointerId === event.pointerId) clearDrawVisual();
  }

  board.addEventListener("pointerdown", pointerDown);
  board.addEventListener("pointermove", pointerMove);
  board.addEventListener("pointerup", pointerUp);
  board.addEventListener("pointercancel", pointerCancel);
  board.addEventListener("lostpointercapture", lostPointerCapture);
  board.addEventListener("contextmenu", contextMenu);

  renderPosition(position);
  renderMarks();
  renderVisibleAnnotations(annotations);
  renderCoordinates();

  // Compute the post-update render plan without touching state. Each
  // boolean is a render phase that `set()` and `move()` execute at most
  // once after applying the supplied state, so a multi-field update
  // collapses into a single mark reconciliation and a single annotation
  // pass. `rejectPosition` lets `move()` reject a runtime-injected
  // `position` even though the type omits it.
  type UpdatePlan = {
    orientationChanged: boolean;
    coordinatesChanged: boolean;
    pieceSetChanged: boolean;
    interactionChanged: boolean;
    presentationChanged: boolean;
    positionChanged: boolean;
    annotationsChanged: boolean;
    visibleLayersChanged: boolean;
    marksDirty: boolean;
    annotationsDirty: boolean;
  };

  function planUpdate(
    update: ChessboardUpdate,
    rejectPosition: boolean,
  ): UpdatePlan {
    if (rejectPosition && "position" in update) {
      throw new TypeError("move() companion update cannot include position");
    }
    return {
      orientationChanged: update.orientation !== undefined,
      coordinatesChanged: update.coordinates !== undefined,
      pieceSetChanged:
        update.pieceSet !== undefined && update.pieceSet !== pieceSet,
      interactionChanged: update.interaction !== undefined,
      presentationChanged: update.presentation !== undefined,
      positionChanged: false,
      annotationsChanged: update.annotations !== undefined,
      visibleLayersChanged: update.visibleLayers !== undefined,
      marksDirty:
        update.orientation !== undefined ||
        update.interaction !== undefined ||
        update.presentation !== undefined ||
        update.position !== undefined,
      annotationsDirty:
        update.orientation !== undefined ||
        update.annotations !== undefined ||
        update.visibleLayers !== undefined,
    };
  }

  // Mutate state for a planned update. Performs every render-phase
  // assignment but no DOM work; callers run render phases from the plan.
  function applyUpdate(
    update: ChessboardUpdate | ChessboardMoveUpdate,
    plan: UpdatePlan,
    nextPosition: Position | undefined,
  ): void {
    if (plan.orientationChanged) {
      clearDragVisual();
      clearDrawVisual();
      orientation = validateColor(update.orientation as Color, "orientation");
    }
    if (update.ariaLabel !== undefined) {
      board.setAttribute("aria-label", update.ariaLabel);
    }
    if (update.animationMs !== undefined) {
      board.style.setProperty(
        "--pw-animation-duration",
        `${validateAnimation(update.animationMs)}ms`,
      );
    }
    if (plan.coordinatesChanged) {
      coordinates = validateBoolean(
        update.coordinates as boolean,
        "coordinates",
      );
    }
    if (update.theme !== undefined) {
      theme = validateTheme(update.theme);
      applyTheme(theme);
    }
    if (plan.pieceSetChanged) {
      pieceSet = validatePieceSet(update.pieceSet);
    }
    if (plan.interactionChanged) {
      if (update.interaction === null) {
        clearDragVisual();
        clearDrawVisual();
        interaction = null;
        destinations = new Map();
      } else {
        interaction = validateInteraction(update.interaction as Interaction);
        destinations = interaction.destinations;
        if (drag && !destinations.has(drag.source)) clearDragVisual();
      }
    }
    if (plan.presentationChanged) {
      const next = validatePresentation(update.presentation as Presentation);
      selected = next.selected;
      lastMove = next.lastMove;
      checkedSquare = next.checked;
    }
    if (nextPosition !== undefined) {
      const next = validatePosition(nextPosition);
      // Drop an in-flight drag whose source square is no longer in the
      // new position. Matches the legacy behavior of `set({position})`
      // (unconditional clear) and `move()` (clear only when the moved
      // square equals the drag source) under one rule.
      if (drag !== null && !next.has(drag.source)) clearDragVisual();
      position = next;
    }
    if (plan.annotationsChanged) {
      annotations = validateAnnotations(update.annotations);
    }
    if (plan.visibleLayersChanged) {
      visibleLayers = validateVisibleLayers(update.visibleLayers);
    }
  }

  // Single-pass render from a plan: each phase executes at most once,
  // and a final `renderMarks()` covers every source that affects marks.
  function renderFromPlan(plan: UpdatePlan): void {
    if (plan.orientationChanged) {
      for (const [square, node] of nodes) place(node, square, orientation);
    }
    if (plan.orientationChanged || plan.coordinatesChanged) {
      renderCoordinates();
    }
    if (plan.pieceSetChanged) {
      for (const [square, piece] of position) {
        const node = nodes.get(square);
        if (node) repaintPieceImage(node, piece);
      }
    }
    if (plan.positionChanged) {
      // `applyUpdate` already mutated `position`; reconcile pieces now
      // so the deferred mark pass observes the post-render map.
      reconcilePieces();
    }
    if (plan.marksDirty) renderMarks();
    if (plan.annotationsDirty) renderVisibleAnnotations(annotations);
  }

  // Position-rendering core, reused by `renderPosition` and the unified
  // update path so that piece identity and node reuse behave identically
  // whether triggered by `move()`/`set({position})` or a batched update.
  function reconcilePieces(): void {
    const checked = position;
    const nextNodes = new Map<Square, HTMLDivElement>();
    const pool = new Map<string, HTMLDivElement[]>();
    for (const [square, node] of nodes) {
      const piece = checked.get(square);
      if (
        piece &&
        node.dataset.color === piece.color &&
        node.dataset.role === piece.role
      ) {
        nextNodes.set(square, node);
      } else {
        const pieceKey = `${node.dataset.color}${node.dataset.role}`;
        const bucket = pool.get(pieceKey);
        if (bucket === undefined) pool.set(pieceKey, [node]);
        else bucket.push(node);
      }
    }
    for (const [square, piece] of checked) {
      if (nextNodes.has(square)) continue;
      const pieceKey = `${piece.color}${piece.role}`;
      let node = pool.get(pieceKey)?.pop();
      if (node === undefined) {
        node = host.ownerDocument.createElement("div");
        node.className = "pw-piece";
        node.setAttribute("aria-hidden", "true");
        board.append(node);
      }
      paintPiece(node, square, piece);
      nextNodes.set(square, node);
    }
    for (const bucket of pool.values()) {
      for (const leftover of bucket) leftover.remove();
    }
    nodes.clear();
    for (const [square, node] of nextNodes) nodes.set(square, node);
  }

  return {
    set(update): void {
      ensureAlive(destroyed);
      const plan = planUpdate(update, false);
      applyUpdate(update, plan, update.position);
      plan.positionChanged = update.position !== undefined;
      renderFromPlan(plan);
    },

    move(from, to, update): void {
      ensureAlive(destroyed);
      validateSquare(from);
      validateSquare(to);
      if (from === to) {
        if (update === undefined) return;
        const plan = planUpdate(update, true);
        applyUpdate(update, plan, undefined);
        renderFromPlan(plan);
        return;
      }

      const piece = position.get(from);
      const node = nodes.get(from);
      if (!piece || !node) throw new Error(`No piece at ${from}`);

      const next = new Map(position);
      next.delete(from);
      next.set(to, piece);

      if (update === undefined) {
        // Standalone two-arg behavior: synchronous render with immediate
        // mark reconciliation so callers see a fully-rendered board.
        if (drag?.source === from) clearDragVisual();
        renderPosition(next);
        return;
      }

      const plan = planUpdate(update, true);
      plan.positionChanged = true;
      plan.marksDirty = true;
      applyUpdate(update, plan, next);
      renderFromPlan(plan);
    },

    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      clearDragVisual();
      clearDrawVisual();
      board.removeEventListener("pointerdown", pointerDown);
      board.removeEventListener("pointermove", pointerMove);
      board.removeEventListener("pointerup", pointerUp);
      board.removeEventListener("pointercancel", pointerCancel);
      board.removeEventListener("lostpointercapture", lostPointerCapture);
      board.removeEventListener("contextmenu", contextMenu);
      nodes.clear();
      for (const mark of markNodes.values()) mark.remove();
      markNodes.clear();
      annotationNodes.clear();
      board.remove();
    },
  };
}

interface Mark {
  key: string;
  square: Square;
  kind: MarkKind;
  occupied: boolean;
}

function collectMarks(
  selected: Square | undefined,
  destinations: Destinations,
  position: Position,
  lastMove: LastMove | undefined,
  checkedSquare: Square | undefined,
): Mark[] {
  const marks: Mark[] = [];
  if (selected) {
    marks.push({
      key: markKey("selected", selected),
      square: selected,
      kind: "selected",
      occupied: position.has(selected),
    });
    const list = destinations.get(selected) ?? [];
    for (const square of list) {
      marks.push({
        key: markKey("destination", square),
        square,
        kind: "destination",
        occupied: position.has(square),
      });
    }
  }
  if (lastMove) {
    marks.push({
      key: markKey("last-move-from", lastMove.from),
      square: lastMove.from,
      kind: "last-move-from",
      occupied: false,
    });
    if (lastMove.to !== lastMove.from) {
      marks.push({
        key: markKey("last-move-to", lastMove.to),
        square: lastMove.to,
        kind: "last-move-to",
        occupied: false,
      });
    }
  }
  if (checkedSquare) {
    marks.push({
      key: markKey("check", checkedSquare),
      square: checkedSquare,
      kind: "check",
      occupied: false,
    });
  }
  return marks;
}

function validatePosition(position: Position): Map<Square, Piece> {
  if (!(position instanceof Map)) {
    throw new TypeError("position must be a Map");
  }

  const checked = new Map<Square, Piece>();
  for (const [square, piece] of position) {
    validateSquare(square);
    if (!piece || typeof piece !== "object") {
      throw new TypeError(`Invalid piece at ${square}`);
    }
    validateColor(piece.color, `piece color at ${square}`);
    if (!isRole(piece.role)) {
      throw new TypeError(`Invalid piece role at ${square}`);
    }
    checked.set(square, { color: piece.color, role: piece.role });
  }
  return checked;
}

function validateSquare(square: string): asserts square is Square {
  if (!isSquare(square)) {
    throw new TypeError(`Invalid square: ${square}`);
  }
}

function validateColor(value: string, name: string): Color {
  if (value !== "white" && value !== "black") {
    throw new TypeError(`${name} must be white or black`);
  }
  return value;
}

function validateAnimation(value: number): number {
  if (!Number.isFinite(value) || value < 0) {
    throw new TypeError("animationMs must be a non-negative number");
  }
  return value;
}

function validateBoolean(value: boolean, name: string): boolean {
  if (typeof value !== "boolean") {
    throw new TypeError(`${name} must be a boolean`);
  }
  return value;
}

const PIECE_CODES = Object.keys(cburnett);
function validatePieceSet(
  value: PieceSources | string | null | undefined,
): PieceSources | string | null | undefined {
  if (value === null || value === undefined) return value;
  if (typeof value === "string") {
    if (value.length === 0) {
      throw new TypeError(
        "pieceSet must be a non-empty URL string, a PieceSources object, or null",
      );
    }
    return value;
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new TypeError(
      "pieceSet must be a non-empty URL string, a PieceSources object, or null",
    );
  }
  const raw = value as unknown as Record<string, unknown>;
  for (const key of Object.keys(raw)) {
    if (!PIECE_CODES.includes(key)) {
      throw new TypeError(`pieceSet has unknown piece code: ${key}`);
    }
  }
  const sources = {} as Record<keyof PieceSources, string>;
  for (const code of PIECE_CODES) {
    const svg = raw[code];
    if (typeof svg !== "string" || svg.length === 0) {
      throw new TypeError(
        `pieceSet.${code} must be a non-empty SVG source string`,
      );
    }
    sources[code as keyof PieceSources] = svg;
  }
  return sources;
}

function validateTheme(
  value: BoardTheme | null | undefined,
): BoardTheme | undefined {
  if (value === null || value === undefined) return undefined;
  if (!value || typeof value !== "object") {
    throw new TypeError("theme must be an object or null");
  }
  for (const key of ["light", "dark"] as const) {
    if (value[key] !== undefined && typeof value[key] !== "string") {
      throw new TypeError(`theme.${key} must be a CSS color string`);
    }
  }
  return value;
}
const ANNOTATION_MODIFIERS: Record<AnnotationModifier, true> = {
  alt: true,
  ctrl: true,
  meta: true,
  shift: true,
};

function validateAnnotationGestures(
  value: readonly AnnotationGesture[] | undefined,
): readonly AnnotationGesture[] | undefined {
  if (value === undefined) return undefined;
  if (!Array.isArray(value)) {
    throw new TypeError("interaction.annotationGestures must be an array");
  }
  const seen = new Set<string>();
  const checked: AnnotationGesture[] = [];
  for (const [index, gesture] of value.entries()) {
    if (!gesture || typeof gesture !== "object") {
      throw new TypeError(
        `interaction.annotationGestures[${index}] must be an object`,
      );
    }
    let modifiers: AnnotationModifier[] | undefined;
    if (gesture.modifiers !== undefined) {
      if (!Array.isArray(gesture.modifiers)) {
        throw new TypeError(
          `interaction.annotationGestures[${index}].modifiers must be an array`,
        );
      }
      modifiers = [];
      for (const [modifierIndex, raw] of gesture.modifiers.entries()) {
        if (
          typeof raw !== "string" ||
          !Object.hasOwn(ANNOTATION_MODIFIERS, raw)
        ) {
          throw new TypeError(
            `interaction.annotationGestures[${index}].modifiers[${modifierIndex}] must be one of alt, ctrl, meta, shift`,
          );
        }
        const name = raw as AnnotationModifier;
        if (modifiers.includes(name)) {
          throw new TypeError(
            `interaction.annotationGestures[${index}].modifiers must not repeat: ${name}`,
          );
        }
        modifiers.push(name);
      }
    }
    if (gesture.color !== undefined && typeof gesture.color !== "string") {
      throw new TypeError(
        `interaction.annotationGestures[${index}].color must be a string when provided`,
      );
    }
    const key = modifiers === undefined ? "" : [...modifiers].sort().join("+");
    if (seen.has(key)) {
      throw new TypeError(
        `interaction.annotationGestures has duplicate modifier binding: ${key || "(none)"}`,
      );
    }
    seen.add(key);
    const copy: {
      -readonly [K in keyof AnnotationGesture]: AnnotationGesture[K];
    } = {};
    if (modifiers !== undefined) copy.modifiers = Object.freeze(modifiers);
    if (gesture.color !== undefined) copy.color = gesture.color;
    checked.push(copy);
  }
  return Object.freeze(checked);
}

function validateInteraction(value: Interaction): Interaction {
  if (!value || typeof value !== "object") {
    throw new TypeError("interaction must be an object");
  }
  if (typeof value.onEvent !== "function") {
    throw new TypeError("interaction.onEvent must be a function");
  }
  const destinations = validateDestinations(value.destinations);
  const annotationGestures = validateAnnotationGestures(
    value.annotationGestures,
  );
  return {
    destinations,
    onEvent: value.onEvent,
    ...(annotationGestures !== undefined ? { annotationGestures } : {}),
  };
}

function validateDestinations(value: Destinations): Destinations {
  if (!(value instanceof Map)) {
    throw new TypeError("interaction.destinations must be a Map");
  }
  const checked = new Map<Square, readonly Square[]>();
  for (const [square, list] of value) {
    validateSquare(square);
    if (!Array.isArray(list)) {
      throw new TypeError(
        `interaction.destinations[${square}] must be an array`,
      );
    }
    const copy: Square[] = [];
    for (const target of list) {
      validateSquare(target);
      if (!copy.includes(target)) copy.push(target);
    }
    checked.set(square, Object.freeze(copy));
  }
  return checked;
}

function validatePresentation(value: Presentation): Presentation {
  if (!value || typeof value !== "object") {
    throw new TypeError("presentation must be an object");
  }
  let selected: Square | undefined;
  let lastMove: LastMove | undefined;
  let checkedSquare: Square | undefined;
  if (value.selected !== undefined) {
    validateSquare(value.selected);
    selected = value.selected;
  }
  if (value.lastMove !== undefined) {
    if (!value.lastMove || typeof value.lastMove !== "object") {
      throw new TypeError("presentation.lastMove must be an object");
    }
    validateSquare(value.lastMove.from);
    validateSquare(value.lastMove.to);
    lastMove = { from: value.lastMove.from, to: value.lastMove.to };
  }
  if (value.checked !== undefined) {
    validateSquare(value.checked);
    checkedSquare = value.checked;
  }
  const builder: { -readonly [K in keyof Presentation]: Presentation[K] } = {};
  if (selected !== undefined) builder.selected = selected;
  if (lastMove !== undefined) builder.lastMove = lastMove;
  if (checkedSquare !== undefined) builder.checked = checkedSquare;
  return builder;
}

function validateAnnotations(
  value: readonly Annotation[] | undefined,
): readonly Annotation[] {
  if (value === undefined) return [];
  if (!Array.isArray(value)) {
    throw new TypeError("annotations must be an array");
  }
  const seen = new Set<string>();
  const checked: Annotation[] = [];
  for (const [index, annotation] of value.entries()) {
    if (!annotation || typeof annotation !== "object") {
      throw new TypeError(`annotations[${index}] must be an object`);
    }
    if (typeof annotation.id !== "string" || annotation.id.length === 0) {
      throw new TypeError(
        `annotations[${index}].id must be a non-empty string`,
      );
    }
    if (seen.has(annotation.id)) {
      throw new TypeError(`Duplicate annotation id: ${annotation.id}`);
    }
    seen.add(annotation.id);
    if (typeof annotation.layer !== "string" || annotation.layer.length === 0) {
      throw new TypeError(
        `annotations[${index}].layer must be a non-empty string`,
      );
    }
    if (
      annotation.color !== undefined &&
      typeof annotation.color !== "string"
    ) {
      throw new TypeError(
        `annotations[${index}].color must be a string when provided`,
      );
    }
    const metadata =
      annotation.metadata === undefined
        ? undefined
        : cloneJsonValue(annotation.metadata, `annotations[${index}].metadata`);
    let copied: Annotation;
    if (annotation.kind === "arrow") {
      validateSquare(annotation.from);
      validateSquare(annotation.to);
      if (annotation.from === annotation.to) {
        throw new TypeError(
          `annotations[${index}] arrow endpoints must differ`,
        );
      }
      copied = {
        id: annotation.id,
        kind: "arrow",
        from: annotation.from,
        to: annotation.to,
        layer: annotation.layer,
        ...(annotation.color !== undefined ? { color: annotation.color } : {}),
        ...(metadata !== undefined ? { metadata } : {}),
      };
    } else if (annotation.kind === "circle") {
      validateSquare(annotation.square);
      copied = {
        id: annotation.id,
        kind: "circle",
        square: annotation.square,
        layer: annotation.layer,
        ...(annotation.color !== undefined ? { color: annotation.color } : {}),
        ...(metadata !== undefined ? { metadata } : {}),
      };
    } else {
      throw new TypeError(
        `annotations[${index}].kind must be "arrow" or "circle"`,
      );
    }
    checked.push(copied);
  }
  return Object.freeze(checked);
}

function validateVisibleLayers(
  value: ReadonlySet<string> | null | undefined,
): ReadonlySet<string> | undefined {
  if (value == null) return undefined;
  if (!(value instanceof Set)) {
    throw new TypeError("visibleLayers must be a Set");
  }
  const copy = new Set<string>();
  for (const layer of value) {
    if (typeof layer !== "string" || layer.length === 0) {
      throw new TypeError("visibleLayers entries must be non-empty strings");
    }
    copy.add(layer);
  }
  return copy;
}

function ensureAlive(destroyed: boolean): void {
  if (destroyed) throw new Error("Chessboard has been destroyed");
}
