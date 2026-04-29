import { useMemo, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { Button, SegmentedButtons, Text } from "react-native-paper";
import { Chess, type Move, type Square } from "chess.js";
import { palette } from "@/constants/theme";
import { AppCard } from "@/components/ui/AppCard";

type ChessDifficulty = "easy" | "medium" | "hard";

const pieceSymbols: Record<string, string> = {
  wp: "♙",
  wn: "♘",
  wb: "♗",
  wr: "♖",
  wq: "♕",
  wk: "♔",
  bp: "♟",
  bn: "♞",
  bb: "♝",
  br: "♜",
  bq: "♛",
  bk: "♚"
};

const pieceValues: Record<string, number> = {
  p: 100,
  n: 320,
  b: 330,
  r: 500,
  q: 900,
  k: 0
};

const difficultyCopy: Record<ChessDifficulty, string> = {
  easy: "Easy bot plays legal moves with very little planning.",
  medium: "Medium bot prefers stronger captures, checks and safer material.",
  hard: "Hard bot looks one reply ahead before choosing."
};

const centerSquares = new Set(["d4", "e4", "d5", "e5"]);

const randomItem = <T,>(items: T[]) => items[Math.floor(Math.random() * items.length)];

const playMove = (game: Chess, move: Move) => {
  game.move({ from: move.from, to: move.to, promotion: move.promotion ?? "q" });
};

const evaluateBoardForBlack = (game: Chess) =>
  game.board().reduce((score, rank) => {
    return (
      score +
      rank.reduce((rankScore, piece) => {
        if (!piece) return rankScore;
        const material = pieceValues[piece.type] ?? 0;
        const position = centerSquares.has(piece.square) ? 12 : 0;
        return rankScore + (piece.color === "b" ? material + position : -material - position);
      }, 0)
    );
  }, 0);

const immediateMoveScore = (game: Chess, move: Move) => {
  const next = new Chess(game.fen());
  playMove(next, move);
  if (next.isCheckmate()) return 100_000;
  if (next.isDraw()) return -35;

  const captureBonus = move.captured ? (pieceValues[move.captured] ?? 0) * 0.25 : 0;
  const checkBonus = next.isCheck() ? 45 : 0;
  const promotionBonus = move.promotion ? 120 : 0;
  return evaluateBoardForBlack(next) + captureBonus + checkBonus + promotionBonus;
};

const replyAwareMoveScore = (game: Chess, move: Move) => {
  const next = new Chess(game.fen());
  playMove(next, move);
  if (next.isCheckmate()) return 100_000;
  if (next.isDraw()) return -35;

  const replies = next.moves({ verbose: true });
  if (!replies.length) return evaluateBoardForBlack(next);

  const worstReplyScore = Math.min(
    ...replies.map((reply) => {
      const replyGame = new Chess(next.fen());
      playMove(replyGame, reply);
      if (replyGame.isCheckmate()) return -100_000;
      if (replyGame.isDraw()) return -35;
      return evaluateBoardForBlack(replyGame);
    })
  );

  const pressureBonus = move.captured ? (pieceValues[move.captured] ?? 0) * 0.15 : 0;
  return worstReplyScore + pressureBonus;
};

const chooseBotMove = (game: Chess, difficulty: ChessDifficulty) => {
  const moves = game.moves({ verbose: true });
  if (!moves.length) return null;
  if (difficulty === "easy") return randomItem(moves);

  const scored = moves
    .map((move) => ({
      move,
      score: difficulty === "hard" ? replyAwareMoveScore(game, move) : immediateMoveScore(game, move)
    }))
    .sort((a, b) => b.score - a.score);

  if (difficulty === "medium" && Math.random() < 0.15) return randomItem(moves);
  if (difficulty === "medium") return randomItem(scored.slice(0, Math.max(1, Math.ceil(scored.length * 0.35)))).move;

  const bestScore = scored[0]?.score ?? 0;
  const closeMoves = scored.filter((item) => item.score >= bestScore - 35).slice(0, 3);
  return randomItem(closeMoves).move;
};

const botMove = (game: Chess, difficulty: ChessDifficulty) => {
  const move = chooseBotMove(game, difficulty);
  if (move) playMove(game, move);
};

export function ChessBreak() {
  const { width, height } = useWindowDimensions();
  const [fen, setFen] = useState(new Chess().fen());
  const [selected, setSelected] = useState<Square | null>(null);
  const [difficulty, setDifficulty] = useState<ChessDifficulty>("medium");
  const game = useMemo(() => new Chess(fen), [fen]);
  const board = game.board();
  const availableWidth = Math.max(220, width - 72);
  const availableHeight = Math.max(300, height - 320);
  const maxBoardSize = width >= 900 ? 620 : width >= 600 ? 540 : 340;
  const boardSize = Math.round(Math.min(availableWidth, availableHeight, maxBoardSize));
  const pieceSize = Math.round(boardSize / 12.5);
  const pieceLineHeight = Math.round(pieceSize * 1.1);

  const legalTargets = useMemo(() => {
    if (!selected || game.turn() !== "w") return new Set<string>();
    return new Set(game.moves({ square: selected, verbose: true }).map((move) => move.to));
  }, [game, selected]);

  const status = useMemo(() => {
    if (game.isCheckmate()) return game.turn() === "w" ? "Checkmate. Bot wins." : "Checkmate. You win.";
    if (game.isDraw()) return "Draw.";
    if (game.isCheck()) return game.turn() === "w" ? "You are in check." : "Bot is in check.";
    return game.turn() === "w" ? "Your move" : "Bot thinking";
  }, [game]);

  const tapSquare = (square: Square) => {
    if (game.isGameOver() || game.turn() !== "w") return;
    const piece = game.get(square);

    if (selected && legalTargets.has(square)) {
      const next = new Chess(fen);
      next.move({ from: selected, to: square, promotion: "q" });
      botMove(next, difficulty);
      setFen(next.fen());
      setSelected(null);
      return;
    }

    if (piece?.color === "w") {
      setSelected(square);
    } else {
      setSelected(null);
    }
  };

  const reset = () => {
    setFen(new Chess().fen());
    setSelected(null);
  };

  return (
    <AppCard style={styles.card}>
      <View style={styles.header}>
        <View>
          <Text variant="titleLarge" style={styles.title}>
            Chess break
          </Text>
          <Text style={styles.muted}>{status}</Text>
        </View>
        <Button mode="outlined" icon="refresh" onPress={reset}>
          Reset
        </Button>
      </View>

      <SegmentedButtons
        value={difficulty}
        onValueChange={(value) => setDifficulty(value as ChessDifficulty)}
        buttons={[
          { value: "easy", label: "Easy" },
          { value: "medium", label: "Medium" },
          { value: "hard", label: "Hard" }
        ]}
      />

      <View style={[styles.board, { width: boardSize, height: boardSize }]}>
        {board.map((rank, rankIndex) =>
          rank.map((piece, fileIndex) => {
            const file = String.fromCharCode(97 + fileIndex);
            const rankNumber = 8 - rankIndex;
            const square = `${file}${rankNumber}` as Square;
            const dark = (rankIndex + fileIndex) % 2 === 1;
            const active = selected === square;
            const legal = legalTargets.has(square);
            const symbol = piece ? pieceSymbols[`${piece.color}${piece.type}`] : "";

            return (
              <Pressable
                key={square}
                onPress={() => tapSquare(square)}
                style={[
                  styles.square,
                  dark ? styles.darkSquare : styles.lightSquare,
                  active && styles.activeSquare,
                  legal && styles.legalSquare
                ]}
              >
                <Text
                  style={[
                    styles.piece,
                    { fontSize: pieceSize, lineHeight: pieceLineHeight },
                    piece?.color === "b" && styles.blackPiece
                  ]}
                >
                  {symbol}
                </Text>
              </Pressable>
            );
          })
        )}
      </View>

      <Text style={styles.caption}>White to move. {difficultyCopy[difficulty]}</Text>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 16
  },
  header: {
    flexDirection: "row",
    justifyContent: "space-between",
    alignItems: "center",
    gap: 12
  },
  title: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  muted: {
    color: palette.muted
  },
  board: {
    alignSelf: "center",
    flexDirection: "row",
    flexWrap: "wrap",
    borderRadius: 8,
    overflow: "hidden",
    borderWidth: 1,
    borderColor: palette.border
  },
  square: {
    width: "12.5%",
    height: "12.5%",
    alignItems: "center",
    justifyContent: "center"
  },
  lightSquare: {
    backgroundColor: "#D8DEE9"
  },
  darkSquare: {
    backgroundColor: "#5E6B7D"
  },
  activeSquare: {
    borderWidth: 3,
    borderColor: palette.primary
  },
  legalSquare: {
    borderWidth: 3,
    borderColor: palette.success
  },
  piece: {
    color: "#FAFAFF",
    textAlign: "center"
  },
  blackPiece: {
    color: "#15151C"
  },
  caption: {
    color: palette.muted,
    fontSize: 12,
    textAlign: "center"
  }
});
