import { createChessboard } from "@plywise/chessboard";
import type {
  Chessboard as ChessboardInstance,
  Color,
  Position,
} from "@plywise/chessboard";
import { useEffect, useRef } from "react";
import type { ComponentPropsWithoutRef } from "react";

export type { Color, Piece, Position, Role, Square } from "@plywise/chessboard";

export interface ChessboardProps
  extends Omit<ComponentPropsWithoutRef<"div">, "children"> {
  readonly position: Position;
  readonly orientation?: Color;
  readonly boardLabel?: string;
  readonly animationMs?: number;
}

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
      position,
      orientation,
      ariaLabel: boardLabel,
      animationMs,
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
