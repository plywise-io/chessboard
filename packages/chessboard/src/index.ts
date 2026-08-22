const files = ["a", "b", "c", "d", "e", "f", "g", "h"] as const;
const roles = ["pawn", "knight", "bishop", "rook", "queen", "king"] as const;

export type Color = "white" | "black";
export type File = (typeof files)[number];
export type Rank = 1 | 2 | 3 | 4 | 5 | 6 | 7 | 8;
export type Role = (typeof roles)[number];
export type Square = `${File}${Rank}`;

export interface Piece {
  readonly color: Color;
  readonly role: Role;
}

export type Position = ReadonlyMap<Square, Piece>;

export interface ChessboardConfig {
  readonly position: Position;
  readonly orientation?: Color;
  readonly ariaLabel?: string;
  readonly animationMs?: number;
}

export interface ChessboardUpdate {
  readonly position?: Position;
  readonly orientation?: Color;
  readonly ariaLabel?: string;
  readonly animationMs?: number;
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

export function createChessboard(
  host: HTMLElement,
  config: ChessboardConfig,
): Chessboard {
  let orientation = validateColor(config.orientation ?? "white", "orientation");
  let position = validatePosition(config.position);
  let destroyed = false;

  const board = host.ownerDocument.createElement("div");
  const nodes = new Map<Square, HTMLDivElement>();
  board.className = "pw-board";
  board.setAttribute("role", "img");
  board.setAttribute("aria-label", config.ariaLabel ?? "Chessboard");
  board.style.setProperty(
    "--pw-animation-duration",
    `${validateAnimation(config.animationMs ?? 150)}ms`,
  );
  host.append(board);

  function place(node: HTMLElement, square: Square): void {
    const file = files.indexOf(square[0] as File);
    const rank = Number(square[1]);
    const x = orientation === "white" ? file : 7 - file;
    const y = orientation === "white" ? 8 - rank : rank - 1;
    node.style.setProperty("--pw-file", String(x));
    node.style.setProperty("--pw-rank", String(y));
  }

  function paint(node: HTMLDivElement, square: Square, piece: Piece): void {
    node.dataset.square = square;
    node.dataset.color = piece.color;
    node.dataset.role = piece.role;
    node.textContent = symbols[piece.color][piece.role];
    place(node, square);
  }

  function render(next: Position): void {
    const checked = validatePosition(next);

    for (const [square, node] of nodes) {
      const piece = checked.get(square);
      if (!piece) {
        node.remove();
        nodes.delete(square);
      } else {
        paint(node, square, piece);
      }
    }

    for (const [square, piece] of checked) {
      if (nodes.has(square)) continue;
      const node = host.ownerDocument.createElement("div");
      node.className = "pw-piece";
      node.setAttribute("aria-hidden", "true");
      paint(node, square, piece);
      nodes.set(square, node);
      board.append(node);
    }

    position = checked;
  }

  render(position);

  return {
    set(update): void {
      ensureAlive(destroyed);

      if (update.orientation !== undefined) {
        orientation = validateColor(update.orientation, "orientation");
        for (const [square, node] of nodes) place(node, square);
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
      if (update.position !== undefined) render(update.position);
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

      paint(node, to, piece);
    },

    destroy(): void {
      if (destroyed) return;
      destroyed = true;
      nodes.clear();
      board.remove();
    },
  };
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
    if (!roles.includes(piece.role)) {
      throw new TypeError(`Invalid piece role at ${square}`);
    }
    checked.set(square, { color: piece.color, role: piece.role });
  }
  return checked;
}

function validateSquare(square: string): asserts square is Square {
  if (!/^[a-h][1-8]$/.test(square)) {
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

function ensureAlive(destroyed: boolean): void {
  if (destroyed) throw new Error("Chessboard has been destroyed");
}
