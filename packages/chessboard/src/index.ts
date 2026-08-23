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
};
export type ArrowEvent = {
  readonly type: "arrow";
  readonly from: Square;
  readonly to: Square;
  readonly origin: "pointer";
};
export type InteractionEvent =
  | SelectEvent
  | ClearEvent
  | MoveEvent
  | CircleEvent
  | ArrowEvent;

export type Destinations = ReadonlyMap<Square, readonly Square[]>;

export interface Interaction {
  readonly destinations: Destinations;
  readonly onEvent: (event: InteractionEvent) => void;
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

const PIECE_SET_CDN =
  "https://cdn.jsdelivr.net/gh/lichess-org/lila@master/public/piece/";

/**
 * Curated permissively licensed piece sets, each a base URL of
 * `{w|b}{P,N,B,R,Q,K}.svg` files. rhosgfx is CC0 1.0; chessnut is
 * Apache-2.0 (pinned commit — the repository has no tagged release);
 * fantasy, spatial, and celtic are MIT artwork by Maurizio Monge served
 * from the lichess asset mirror. Licenses verified against lila's
 * COPYING.md and each upstream LICENSE file. Omitting `pieceSet` renders
 * built-in Unicode glyphs and involves no asset license.
 */
export const pieceSets: Readonly<Record<string, string>> = {
  rhosgfx: `${PIECE_SET_CDN}rhosgfx/`,
  chessnut:
    "https://cdn.jsdelivr.net/gh/LexLuengas/chessnut-pieces@2b8eaf14a31edad7e9deb53b1473e1d4857868a9/",
  fantasy: `${PIECE_SET_CDN}fantasy/`,
  spatial: `${PIECE_SET_CDN}spatial/`,
  celtic: `${PIECE_SET_CDN}celtic/`,
};

export const boardThemes: Readonly<Record<string, BoardTheme>> = {
  brown: { light: "#f0d9b5", dark: "#b58863" },
  blue: { light: "#dee3e6", dark: "#8ca2ad" },
  green: { light: "#ffffdd", dark: "#86a666" },
};

export interface ChessboardConfig {
  readonly position: Position;
  readonly orientation?: Color;
  readonly ariaLabel?: string;
  readonly animationMs?: number;
  readonly interaction?: Interaction | null;
  readonly presentation?: Presentation;
  /**
   * Base URL of a piece-set directory containing `{w|b}{P,N,B,R,Q,K}.svg`
   * files (see {@link pieceSets}). Pieces render as images; omit or pass
   * `null` for the built-in Unicode glyphs.
   */
  readonly pieceSet?: string | null;
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
  readonly interaction?: Interaction | null;
  readonly presentation?: Presentation;
  /**
   * Same contract as on {@link ChessboardConfig}. Omitting the field leaves
   * the current piece set unchanged; `null` restores Unicode glyphs.
   */
  readonly pieceSet?: string | null;
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

export interface Chessboard {
  set(update: ChessboardUpdate): void;
  move(from: Square, to: Square): void;
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
  node.style.setProperty("--pw-file", String(x));
  node.style.setProperty("--pw-rank", String(y));
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
  let pieceSet: string | undefined = validatePieceSet(config.pieceSet);
  let theme: BoardTheme | undefined = validateTheme(config.theme);
  let destroyed = false;
  // A pointerdown starts a candidate; the first move fills in the visual
  // fields and commits it as a drag.
  type DragState = {
    readonly source: Square;
    readonly pointerId: number;
    piece: HTMLDivElement | null;
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
  const annotationNodes = new Map<string, SVGElement>();
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
    if (pieceSet) {
      const url = `${pieceSet}${piece.color[0]}${pieceLetters[piece.role]}.svg`;
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

  board.append(annotationLayer);
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

  function createAnnotationNode(annotation: Annotation): SVGElement {
    const tag = annotation.kind === "arrow" ? "path" : "circle";
    const node = host.ownerDocument.createElementNS(
      "http://www.w3.org/2000/svg",
      tag,
    ) as SVGElement;
    applyAnnotationDataAttrs(node, annotation);
    return node;
  }

  function applyAnnotationDataAttrs(
    node: SVGElement,
    annotation: Annotation,
  ): void {
    node.setAttribute("data-annotation-id", annotation.id);
    node.setAttribute("data-annotation-kind", annotation.kind);
    node.setAttribute("data-annotation-layer", annotation.layer);
    // Inline style rather than the SVG presentation attribute: the
    // stylesheet's `.pw-annotations path|circle { stroke }` rule would
    // override a presentation attribute anyway.
    if (annotation.color !== undefined) {
      node.style.stroke = annotation.color;
    } else {
      node.style.removeProperty("stroke");
    }
  }

  function renderAnnotations(next: readonly Annotation[]): void {
    const seen = new Set<string>();
    for (const annotation of next) {
      seen.add(annotation.id);
      let node = annotationNodes.get(annotation.id);
      if (
        node &&
        node.getAttribute("data-annotation-kind") !== annotation.kind
      ) {
        node.remove();
        annotationNodes.delete(annotation.id);
        node = undefined;
      }
      if (!node) {
        node = createAnnotationNode(annotation);
        annotationLayer.append(node);
        annotationNodes.set(annotation.id, node);
      } else {
        applyAnnotationDataAttrs(node, annotation);
      }
      paintAnnotation(node, annotation);
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

  function renderPosition(next: Position): void {
    const checked = validatePosition(next);

    for (const [square, node] of nodes) {
      const piece = checked.get(square);
      if (!piece) {
        node.remove();
        nodes.delete(square);
      } else {
        paintPiece(node, square, piece);
      }
    }

    for (const [square, piece] of checked) {
      if (nodes.has(square)) continue;
      const node = host.ownerDocument.createElement("div");
      node.className = "pw-piece";
      node.setAttribute("aria-hidden", "true");
      paintPiece(node, square, piece);
      nodes.set(square, node);
      board.append(node);
    }

    position = checked;
    renderMarks();
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
          }
        : {
            id: "pw-preview",
            kind: "arrow",
            from: active.source,
            to: current,
            layer: "preview",
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
    const { piece } = active;
    if (!piece) return;
    // Live rect per frame so a host resize mid-drag keeps the piece under
    // the pointer, at one cached-layout read per animation frame. The
    // inline transform replaces the stylesheet transform, so it is an
    // absolute board-relative position: pointer minus the press-time grab
    // offset expressed in cell units.
    const rect = board.getBoundingClientRect();
    if (rect.width <= 0 || rect.height <= 0) return;
    const offsetX =
      active.clientX - rect.left - active.grabXFrac * (rect.width / 8);
    const offsetY =
      active.clientY - rect.top - active.grabYFrac * (rect.height / 8);
    piece.style.transform = `translate3d(${offsetX}px, ${offsetY}px, 0)`;
  }

  function startDrag(active: DragState): void {
    const piece = nodes.get(active.source);
    if (!piece) return;
    active.piece = piece;
    piece.classList.add("pw-piece-dragging");
    piece.dataset.dragging = "true";
    piece.style.transition = "none";
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
              ? { type: "circle", square: drop, origin: "pointer" }
              : {
                  type: "arrow",
                  from: activeDraw.source,
                  to: drop,
                  origin: "pointer",
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
  renderVisibleAnnotations(annotations);

  return {
    set(update): void {
      ensureAlive(destroyed);

      const nextOrientation =
        update.orientation === undefined
          ? undefined
          : validateColor(update.orientation, "orientation");
      const nextAnimation =
        update.animationMs === undefined
          ? undefined
          : validateAnimation(update.animationMs);
      const nextInteraction =
        update.interaction === undefined
          ? undefined
          : update.interaction === null
            ? null
            : validateInteraction(update.interaction);
      const nextPresentation =
        update.presentation === undefined
          ? undefined
          : validatePresentation(update.presentation);
      const nextPosition =
        update.position === undefined
          ? undefined
          : validatePosition(update.position);
      const nextAnnotations =
        update.annotations === undefined
          ? undefined
          : validateAnnotations(update.annotations);
      const hasVisibleLayers = update.visibleLayers !== undefined;
      const nextVisibleLayers = hasVisibleLayers
        ? validateVisibleLayers(update.visibleLayers)
        : undefined;
      const hasPieceSet = update.pieceSet !== undefined;
      const nextPieceSet = hasPieceSet
        ? validatePieceSet(update.pieceSet)
        : undefined;
      const hasTheme = update.theme !== undefined;
      const nextTheme = hasTheme ? validateTheme(update.theme) : undefined;

      if (nextOrientation !== undefined) {
        clearDragVisual();
        clearDrawVisual();
        orientation = nextOrientation;
        for (const [square, node] of nodes) place(node, square, orientation);
        renderMarks();
      }
      if (update.ariaLabel !== undefined) {
        board.setAttribute("aria-label", update.ariaLabel);
      }
      if (nextAnimation !== undefined) {
        board.style.setProperty(
          "--pw-animation-duration",
          `${nextAnimation}ms`,
        );
      }
      if (hasTheme) {
        theme = nextTheme;
        applyTheme(theme);
      }
      if (hasPieceSet && nextPieceSet !== pieceSet) {
        pieceSet = nextPieceSet;
        for (const [square, piece] of position) {
          const node = nodes.get(square);
          if (node) repaintPieceImage(node, piece);
        }
      }
      if (nextInteraction !== undefined) {
        if (nextInteraction === null) {
          clearDragVisual();
          clearDrawVisual();
          interaction = null;
          destinations = new Map();
        } else {
          interaction = nextInteraction;
          destinations = interaction.destinations;
          if (drag && !destinations.has(drag.source)) clearDragVisual();
        }
        renderMarks();
      }
      if (nextPresentation !== undefined) {
        selected = nextPresentation.selected;
        lastMove = nextPresentation.lastMove;
        checkedSquare = nextPresentation.checked;
        renderMarks();
      }
      if (nextPosition !== undefined) {
        clearDragVisual();
        renderPosition(nextPosition);
      }
      if (nextAnnotations !== undefined) annotations = nextAnnotations;
      if (hasVisibleLayers) visibleLayers = nextVisibleLayers;
      if (
        nextOrientation !== undefined ||
        nextAnnotations !== undefined ||
        hasVisibleLayers
      ) {
        renderVisibleAnnotations(annotations);
      }
    },

    move(from, to): void {
      ensureAlive(destroyed);
      validateSquare(from);
      validateSquare(to);
      if (from === to) return;

      const piece = position.get(from);
      const node = nodes.get(from);
      if (!piece || !node) throw new Error(`No piece at ${from}`);

      nodes.get(to)?.remove();
      nodes.delete(to);
      nodes.delete(from);
      nodes.set(to, node);

      const next = new Map(position);
      next.delete(from);
      next.set(to, piece);
      position = next;

      if (drag?.piece === node) clearDragVisual();
      paintPiece(node, to, piece);
      renderMarks();
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
      for (const node of annotationNodes.values()) node.remove();
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

function validatePieceSet(
  value: string | null | undefined,
): string | undefined {
  if (value === null || value === undefined) return undefined;
  if (typeof value !== "string" || value.length === 0) {
    throw new TypeError("pieceSet must be a non-empty URL string or null");
  }
  return value;
}

function validateTheme(
  value: BoardTheme | null | undefined,
): BoardTheme | undefined {
  if (value === null || value === undefined) return undefined;
  if (!value || typeof value !== "object") {
    throw new TypeError("theme must be an object or null");
  }
  for (const key of ["light", "dark"] as const) {
    const color = value[key];
    if (color !== undefined && typeof color !== "string") {
      throw new TypeError(`theme.${key} must be a CSS color string`);
    }
  }
  return value;
}
function validateInteraction(value: Interaction): Interaction {
  if (!value || typeof value !== "object") {
    throw new TypeError("interaction must be an object");
  }
  if (typeof value.onEvent !== "function") {
    throw new TypeError("interaction.onEvent must be a function");
  }
  const destinations = validateDestinations(value.destinations);
  return { destinations, onEvent: value.onEvent };
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
