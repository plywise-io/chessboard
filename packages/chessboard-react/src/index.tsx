import type {
  Chessboard as ChessboardInstance,
  Color,
  Position,
} from "@plywise/chessboard";
import { createChessboard } from "@plywise/chessboard";
import type { ComponentPropsWithoutRef } from "react";
import { useEffect, useRef } from "react";

export type { Color, Piece, Position, Role, Square } from "@plywise/chessboard";

export interface ChessboardProps
  extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  readonly position: Position;
  readonly orientation?: Color;
  readonly boardLabel?: string;
  readonly animationMs?: number;
}

const emptyPosition: Position = new Map();

export function Chessboard({
  position,
  orientation = "white",
  boardLabel = "Chessboard",
  animationMs = 150,
  ...hostProps
}: ChessboardProps) {
  const host = useRef<HTMLDivElement>(null);
  const instance = useRef<ChessboardInstance>(null);

  useEffect(() => {
    if (!host.current) return;

    const board = createChessboard(host.current, {
      position: emptyPosition,
    });
    instance.current = board;

    return () => {
      instance.current = null;
      board.destroy();
    };
  }, []);

  useEffect(() => {
    instance.current?.set({
      position,
      orientation,
      ariaLabel: boardLabel,
      animationMs,
    });
  }, [animationMs, boardLabel, orientation, position]);

  return <div {...hostProps} ref={host} />;
}
