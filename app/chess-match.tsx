import { useCallback, useEffect, useMemo, useState } from "react";
import { Pressable, StyleSheet, useWindowDimensions, View } from "react-native";
import { router, useLocalSearchParams } from "expo-router";
import { Button, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { Chess, type Square } from "chess.js";
import { AppCard } from "@/components/ui/AppCard";
import { Screen } from "@/components/ui/Screen";
import { SkeletonStack } from "@/components/ui/Skeleton";
import { palette } from "@/constants/theme";
import { studyApi } from "@/services/studyApi";
import type { CommunityChessMatchState } from "@/types";

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

const squareAt = (rankIndex: number, fileIndex: number, viewerColor: "white" | "black") => {
  const fileNumber = viewerColor === "black" ? 7 - fileIndex : fileIndex;
  const rankNumber = viewerColor === "black" ? rankIndex + 1 : 8 - rankIndex;
  return `${String.fromCharCode(97 + fileNumber)}${rankNumber}` as Square;
};

const formatMoveTime = (value?: string | null) => {
  if (!value) return null;
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return null;
  return new Intl.DateTimeFormat("en-AU", { hour: "numeric", minute: "2-digit" }).format(date);
};

export default function ChessMatchScreen() {
  const params = useLocalSearchParams<{ code?: string | string[] }>();
  const matchCode = Array.isArray(params.code) ? params.code[0] : params.code;
  const { width, height } = useWindowDimensions();
  const [match, setMatch] = useState<CommunityChessMatchState | null>(null);
  const [selected, setSelected] = useState<Square | null>(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const game = useMemo(() => (match ? new Chess(match.fen) : new Chess()), [match]);
  const availableWidth = Math.max(220, width - 40);
  const availableHeight = Math.max(300, height - 320);
  const boardSize = Math.round(Math.min(availableWidth, availableHeight, width >= 900 ? 620 : width >= 600 ? 540 : 340));
  const pieceSize = Math.round(boardSize / 12.5);
  const pieceLineHeight = Math.round(pieceSize * 1.1);

  const loadMatch = useCallback(
    async (quiet = false) => {
      if (!matchCode) {
        setError("Missing chess match code.");
        setLoading(false);
        return;
      }
      if (!quiet) setLoading(true);
      try {
        const data = await studyApi.chessTournamentMatch(matchCode);
        setMatch(data.match);
        setError(null);
      } catch (error) {
        setError(error instanceof Error ? error.message : "Could not load this chess match.");
      } finally {
        if (!quiet) setLoading(false);
      }
    },
    [matchCode]
  );

  useEffect(() => {
    loadMatch();
  }, [loadMatch]);

  useEffect(() => {
    if (!match || match.status !== "active") return;
    const interval = setInterval(() => {
      loadMatch(true);
    }, 3500);
    return () => clearInterval(interval);
  }, [loadMatch, match]);

  const legalTargets = useMemo(() => {
    if (!match?.canMove || !selected) return new Set<string>();
    return new Set(game.moves({ square: selected, verbose: true }).map((move) => move.to));
  }, [game, match?.canMove, selected]);

  const statusText = useMemo(() => {
    if (!match) return "Loading match";
    if (match.signupOpen) return "Pairings lock Tuesday 8pm.";
    if (match.status !== "active") return match.resultCopy ?? "Match finished.";
    if (match.canClaimNoShow) return "The match window has closed. You can claim a no-show win.";
    if (match.canMove) return `Your move as ${match.viewerColor}.`;
    return `Waiting for ${match.turn}.`;
  }, [match]);

  const submitMove = async (from: Square, to: Square) => {
    if (!match || sending) return;
    setSending(true);
    setError(null);
    try {
      const data = await studyApi.playChessTournamentMove(match.matchCode, { from, to, promotion: "q" });
      setMatch(data.match);
      setSelected(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not play that move.");
    } finally {
      setSending(false);
    }
  };

  const startTiebreak = async () => {
    if (!match || sending) return;
    setSending(true);
    setError(null);
    try {
      const data = await studyApi.startChessTournamentTiebreak(match.matchCode);
      setMatch(data.match);
      setSelected(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not start the tiebreak.");
    } finally {
      setSending(false);
    }
  };

  const claimNoShow = async () => {
    if (!match || sending) return;
    setSending(true);
    setError(null);
    try {
      const data = await studyApi.claimChessTournamentNoShow(match.matchCode);
      setMatch(data.match);
      setSelected(null);
    } catch (error) {
      setError(error instanceof Error ? error.message : "Could not claim the no-show win.");
    } finally {
      setSending(false);
    }
  };

  const tapSquare = (square: Square) => {
    if (!match?.canMove || sending) return;
    const piece = game.get(square);
    const viewerPieceColor = match.viewerColor === "white" ? "w" : "b";

    if (selected && legalTargets.has(square)) {
      submitMove(selected, square);
      return;
    }

    if (piece?.color === viewerPieceColor) {
      setSelected(square);
    } else {
      setSelected(null);
    }
  };

  if (loading && !match) {
    return (
      <Screen>
        <SkeletonStack />
      </Screen>
    );
  }

  return (
    <Screen>
      <AppCard style={styles.card}>
        <View style={styles.header}>
          <View style={styles.headerIcon}>
            <MaterialCommunityIcons name="chess-king" color={palette.warning} size={22} />
          </View>
          <View style={styles.flexText}>
            <Text style={styles.eyebrow}>{match?.matchCode ?? "Chess match"}</Text>
            <Text variant="headlineSmall" style={styles.title}>
              {match ? `${match.white.displayName} vs ${match.black.displayName}` : "Chess match"}
            </Text>
            <Text style={styles.muted}>{statusText}</Text>
          </View>
        </View>

        {error ? <Text style={styles.error}>{error}</Text> : null}

        {match ? (
          <>
            <View style={styles.metaGrid}>
              <View style={styles.metaTile}>
                <Text style={styles.metaLabel}>You</Text>
                <Text style={styles.metaValue}>{match.viewerColor}</Text>
              </View>
              <View style={styles.metaTile}>
                <Text style={styles.metaLabel}>Turn</Text>
                <Text style={styles.metaValue}>{match.turn}</Text>
              </View>
              <View style={styles.metaTile}>
                <Text style={styles.metaLabel}>Opponent</Text>
                <Text style={styles.metaValue} numberOfLines={1}>
                  {match.opponent.displayName}
                </Text>
              </View>
            </View>

            <View style={[styles.board, { width: boardSize, height: boardSize }]}>
              {Array.from({ length: 8 }).map((_, rankIndex) =>
                Array.from({ length: 8 }).map((__, fileIndex) => {
                  const square = squareAt(rankIndex, fileIndex, match.viewerColor);
                  const piece = game.get(square);
                  const dark = (rankIndex + fileIndex) % 2 === 1;
                  const active = selected === square;
                  const legal = legalTargets.has(square);
                  const lastMove = square === match.lastMove?.from || square === match.lastMove?.to;
                  const symbol = piece ? pieceSymbols[`${piece.color}${piece.type}`] : "";

                  return (
                    <Pressable
                      key={square}
                      onPress={() => tapSquare(square)}
                      style={[
                        styles.square,
                        dark ? styles.darkSquare : styles.lightSquare,
                        lastMove && styles.lastMoveSquare,
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

            <View style={styles.matchFooter}>
              <Text style={styles.mutedSmall}>
                {match.lastMove
                  ? `Last move: ${match.lastMove.san ?? `${match.lastMove.from}-${match.lastMove.to}`}${
                      formatMoveTime(match.lastMove.at) ? ` at ${formatMoveTime(match.lastMove.at)}` : ""
                    }`
                  : "No moves yet."}
              </Text>
              {match.pgn ? <Text style={styles.moveList} numberOfLines={2}>{match.pgn}</Text> : null}
            </View>
          </>
        ) : null}

        <View style={styles.actions}>
          <Button mode="outlined" icon="arrow-left" onPress={() => router.push("/(tabs)/community")}>
            Community
          </Button>
          {match?.canTiebreak ? (
            <Button mode="contained-tonal" icon="chess-clock" loading={sending} onPress={startTiebreak}>
              Start tiebreak
            </Button>
          ) : null}
          {match?.canClaimNoShow ? (
            <Button mode="contained-tonal" icon="flag-checkered" loading={sending} onPress={claimNoShow}>
              Claim no-show win
            </Button>
          ) : null}
          <Button mode="contained" icon="refresh" loading={loading || sending} onPress={() => loadMatch()}>
            Refresh
          </Button>
        </View>
      </AppCard>
    </Screen>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 16
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  headerIcon: {
    width: 46,
    height: 46,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(245,158,11,0.14)"
  },
  flexText: {
    flex: 1,
    minWidth: 0,
    gap: 4
  },
  eyebrow: {
    color: palette.warning,
    fontFamily: "Outfit_700Bold",
    fontSize: 12,
    letterSpacing: 0.4,
    textTransform: "uppercase"
  },
  title: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  muted: {
    color: palette.muted,
    lineHeight: 20
  },
  mutedSmall: {
    color: palette.muted,
    fontSize: 12
  },
  error: {
    color: palette.secondary
  },
  metaGrid: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  },
  metaTile: {
    flexGrow: 1,
    flexBasis: 120,
    gap: 3,
    padding: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,0.04)"
  },
  metaLabel: {
    color: palette.muted,
    fontSize: 12
  },
  metaValue: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    textTransform: "capitalize"
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
  lastMoveSquare: {
    backgroundColor: "rgba(245,158,11,0.45)"
  },
  piece: {
    color: "#FAFAFF",
    textAlign: "center"
  },
  blackPiece: {
    color: "#15151C"
  },
  matchFooter: {
    gap: 6
  },
  moveList: {
    color: palette.text,
    fontSize: 12
  },
  actions: {
    flexDirection: "row",
    flexWrap: "wrap",
    justifyContent: "space-between",
    gap: 10
  }
});
