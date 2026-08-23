import type {
  Annotation,
  Chessboard as ChessboardInstance,
  ChessboardUpdate,
  Color,
  Interaction,
  Position,
  Presentation,
  Square,
} from "@plywise/chessboard";
import { createChessboard } from "@plywise/chessboard";
import type { ComponentPropsWithoutRef } from "react";
import { useEffect, useRef } from "react";

export type {
  Annotation,
  ArrowAnnotation,
  ChessboardConfig,
  ChessboardUpdate,
  CircleAnnotation,
  ClearEvent,
  Color,
  Destinations,
  File,
  Interaction,
  InteractionEvent,
  JsonValue,
  LastMove,
  MoveEvent,
  Piece,
  Position,
  Presentation,
  Rank,
  Role,
  SelectEvent,
  Square,
} from "@plywise/chessboard";

export interface ChessboardProps
  extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  readonly position: Position;
  readonly orientation?: Color;
  readonly boardLabel?: string;
  readonly animationMs?: number;
  readonly interaction?: Interaction | null;
  readonly presentation?: Presentation;
  readonly annotations?: readonly Annotation[];
  readonly visibleLayers?: ReadonlySet<string>;
}

// Detect a single-piece move between two positions (a capture keeps the
// destination square occupied) so the adapter can forward it to the
// renderer's `move` instead of a full position replacement.
function detectMove(
  previous: Position,
  next: Position,
): { from: Square; to: Square } | undefined {
  const removed: Square[] = [];
  const arrived: Square[] = [];
  for (const [square, piece] of previous) {
    const after = next.get(square);
    if (after === undefined) removed.push(square);
    else if (after.color !== piece.color || after.role !== piece.role)
      arrived.push(square);
  }
  for (const square of next.keys()) {
    if (!previous.has(square)) arrived.push(square);
  }
  if (removed.length !== 1 || arrived.length !== 1) return undefined;
  const from = removed[0];
  const to = arrived[0];
  if (!from || !to) return undefined;
  const mover = previous.get(from);
  const landed = next.get(to);
  if (
    !mover ||
    !landed ||
    mover.color !== landed.color ||
    mover.role !== landed.role
  ) {
    return undefined;
  }
  return { from, to };
}

export function Chessboard({
  position,
  orientation = "white",
  boardLabel = "Chessboard",
  animationMs = 150,
  interaction,
  presentation,
  annotations,
  visibleLayers,
  ...hostProps
}: ChessboardProps) {
  const host = useRef<HTMLDivElement>(null);
  const instance = useRef<ChessboardInstance>(null);
  const previous = useRef({
    position,
    orientation,
    boardLabel,
    animationMs,
    interaction,
    presentation,
    annotations,
    visibleLayers,
  });

  useEffect(() => {
    if (!host.current) return;
    const initial = previous.current;
    const board = createChessboard(host.current, {
      position: initial.position,
      orientation: initial.orientation,
      ariaLabel: initial.boardLabel,
      animationMs: initial.animationMs,
      interaction: initial.interaction ?? null,
      ...(initial.presentation === undefined
        ? {}
        : { presentation: initial.presentation }),
      ...(initial.annotations === undefined
        ? {}
        : { annotations: initial.annotations }),
      ...(initial.visibleLayers === undefined
        ? {}
        : { visibleLayers: initial.visibleLayers }),
    });
    instance.current = board;

    return () => {
      instance.current = null;
      board.destroy();
    };
  }, []);

  useEffect(() => {
    const prior = previous.current;
    const changed =
      prior.position !== position ||
      prior.orientation !== orientation ||
      prior.boardLabel !== boardLabel ||
      prior.animationMs !== animationMs ||
      prior.interaction !== interaction ||
      prior.presentation !== presentation ||
      prior.annotations !== annotations ||
      prior.visibleLayers !== visibleLayers;
    previous.current = {
      position,
      orientation,
      boardLabel,
      animationMs,
      interaction,
      presentation,
      annotations,
      visibleLayers,
    };
    if (!changed) return;

    // A single-piece position change routes through the renderer's `move`
    // so the moving piece keeps its DOM node and transform transition.
    const approved =
      prior.position === position
        ? undefined
        : detectMove(prior.position, position);
    if (approved) instance.current?.move(approved.from, approved.to);

    const update: ChessboardUpdate = {
      ...(approved || prior.position === position ? {} : { position }),
      ...(prior.orientation === orientation ? {} : { orientation }),
      ...(prior.boardLabel === boardLabel ? {} : { ariaLabel: boardLabel }),
      ...(prior.animationMs === animationMs ? {} : { animationMs }),
      ...(prior.interaction === interaction
        ? {}
        : { interaction: interaction ?? null }),
      ...(prior.presentation === presentation
        ? {}
        : { presentation: presentation ?? {} }),
      ...(prior.annotations === annotations
        ? {}
        : { annotations: annotations ?? [] }),
      ...(prior.visibleLayers === visibleLayers
        ? {}
        : { visibleLayers: visibleLayers ?? null }),
    };
    instance.current?.set(update);
  }, [
    animationMs,
    annotations,
    boardLabel,
    interaction,
    orientation,
    position,
    presentation,
    visibleLayers,
  ]);

  return <div {...hostProps} ref={host} />;
}
