import { useEffect, useMemo, useRef, useState } from "react";
import { Linking, Pressable, StyleSheet, View } from "react-native";
import { Audio, type AVPlaybackStatus } from "expo-av";
import { Button, IconButton, Switch, Text } from "react-native-paper";
import { MaterialCommunityIcons } from "@expo/vector-icons";
import { AppCard } from "@/components/ui/AppCard";
import { palette } from "@/constants/theme";
import { STUDY_MUSIC_TRACKS, type StudyMusicTrack } from "@/constants/studyMusic";

const formatMillis = (millis: number) => {
  const totalSeconds = Math.max(0, Math.floor(millis / 1000));
  const minutes = Math.floor(totalSeconds / 60)
    .toString()
    .padStart(1, "0");
  const seconds = (totalSeconds % 60).toString().padStart(2, "0");
  return `${minutes}:${seconds}`;
};

export function StudyMusicPanel() {
  const [selectedTrackId, setSelectedTrackId] = useState(STUDY_MUSIC_TRACKS[0]?.id ?? "");
  const [loadedTrackId, setLoadedTrackId] = useState<string | null>(null);
  const [playing, setPlaying] = useState(false);
  const [loadingTrackId, setLoadingTrackId] = useState<string | null>(null);
  const [looping, setLooping] = useState(true);
  const [positionMillis, setPositionMillis] = useState(0);
  const [durationMillis, setDurationMillis] = useState(STUDY_MUSIC_TRACKS[0]?.durationMillis ?? 0);
  const [error, setError] = useState<string | null>(null);
  const soundRef = useRef<Audio.Sound | null>(null);

  const selectedTrack = useMemo(
    () => STUDY_MUSIC_TRACKS.find((track) => track.id === selectedTrackId) ?? STUDY_MUSIC_TRACKS[0],
    [selectedTrackId]
  );

  useEffect(() => {
    Audio.setAudioModeAsync({
      allowsRecordingIOS: false,
      playsInSilentModeIOS: true,
      staysActiveInBackground: false,
      shouldDuckAndroid: true
    }).catch(() => undefined);

    return () => {
      const sound = soundRef.current;
      soundRef.current = null;
      if (sound) void sound.unloadAsync();
    };
  }, []);

  const updateStatus = (track: StudyMusicTrack) => (status: AVPlaybackStatus) => {
    if (!status.isLoaded) {
      return;
    }

    setPlaying(status.isPlaying);
    setPositionMillis(status.positionMillis);
    setDurationMillis(status.durationMillis ?? track.durationMillis);
  };

  const unloadCurrent = async () => {
    const sound = soundRef.current;
    soundRef.current = null;
    setLoadedTrackId(null);
    setPlaying(false);
    setPositionMillis(0);
    if (sound) {
      await sound.unloadAsync();
    }
  };

  const loadAndPlay = async (track: StudyMusicTrack) => {
    setLoadingTrackId(track.id);
    setError(null);
    try {
      await unloadCurrent();
      const { sound, status } = await Audio.Sound.createAsync(
        { uri: track.audioUrl },
        {
          shouldPlay: true,
          isLooping: looping,
          volume: 0.72,
          progressUpdateIntervalMillis: 600
        },
        updateStatus(track)
      );
      soundRef.current = sound;
      setSelectedTrackId(track.id);
      setLoadedTrackId(track.id);
      if (status.isLoaded) {
        setPlaying(status.isPlaying);
        setPositionMillis(status.positionMillis);
        setDurationMillis(status.durationMillis ?? track.durationMillis);
      }
    } catch (loadError) {
      setError(loadError instanceof Error ? loadError.message : "Could not play this study track.");
      setPlaying(false);
    } finally {
      setLoadingTrackId(null);
    }
  };

  const playOrPauseTrack = async (track: StudyMusicTrack) => {
    if (loadedTrackId !== track.id || !soundRef.current) {
      await loadAndPlay(track);
      return;
    }

    const status = await soundRef.current.getStatusAsync();
    if (!status.isLoaded) {
      await loadAndPlay(track);
      return;
    }

    if (status.isPlaying) {
      await soundRef.current.pauseAsync();
      setPlaying(false);
      return;
    }

    await soundRef.current.playAsync();
    setPlaying(true);
  };

  const stop = async () => {
    if (!soundRef.current) return;
    await soundRef.current.stopAsync();
    await soundRef.current.setPositionAsync(0);
    setPlaying(false);
    setPositionMillis(0);
  };

  const changeLooping = async (value: boolean) => {
    setLooping(value);
    if (soundRef.current) {
      await soundRef.current.setIsLoopingAsync(value);
    }
  };

  const progress = durationMillis ? Math.min(100, Math.round((positionMillis / durationMillis) * 100)) : 0;

  return (
    <AppCard style={styles.card}>
      <View style={styles.header}>
        <View style={styles.headerIcon}>
          <MaterialCommunityIcons name="music-note-eighth" color={palette.info} size={22} />
        </View>
        <View style={styles.headerText}>
          <Text style={styles.cardTitle}>Study music</Text>
          <Text style={styles.muted}>Copyright-safe tracks with credits kept in the app.</Text>
        </View>
        <View style={styles.loopControl}>
          <Text style={styles.loopLabel}>Loop</Text>
          <Switch value={looping} onValueChange={(value) => void changeLooping(value)} color={palette.info} />
        </View>
      </View>

      <View style={styles.nowPlaying}>
        <View style={styles.nowText}>
          <Text style={styles.trackTitle} numberOfLines={1}>
            {selectedTrack.title}
          </Text>
          <Text style={styles.muted} numberOfLines={1}>
            {selectedTrack.artist} - {selectedTrack.mood}
          </Text>
        </View>
        <View style={styles.playerButtons}>
          <IconButton
            mode="contained"
            icon={playing ? "pause" : "play"}
            loading={loadingTrackId === selectedTrack.id}
            disabled={Boolean(loadingTrackId)}
            accessibilityLabel={playing ? "Pause study music" : "Play study music"}
            onPress={() => void playOrPauseTrack(selectedTrack)}
          />
          <IconButton
            mode="outlined"
            icon="stop"
            disabled={!loadedTrackId || Boolean(loadingTrackId)}
            accessibilityLabel="Stop study music"
            onPress={() => void stop()}
          />
        </View>
      </View>

      <View style={styles.progressTrack}>
        <View style={[styles.progressFill, { width: `${progress}%` }]} />
      </View>
      <View style={styles.progressMeta}>
        <Text style={styles.timeText}>{formatMillis(positionMillis)}</Text>
        <Text style={styles.timeText}>{formatMillis(durationMillis)}</Text>
      </View>

      <View style={styles.trackList}>
        {STUDY_MUSIC_TRACKS.map((track) => {
          const selected = selectedTrackId === track.id;
          const active = loadedTrackId === track.id && playing;
          return (
            <Pressable
              key={track.id}
              onPress={() => void playOrPauseTrack(track)}
              style={[styles.trackRow, selected && styles.trackRowSelected]}
            >
              <View style={styles.trackIcon}>
                <MaterialCommunityIcons name={active ? "volume-high" : "music-note"} color={selected ? palette.info : palette.muted} size={18} />
              </View>
              <View style={styles.trackText}>
                <Text style={styles.trackName} numberOfLines={1}>
                  {track.title}
                </Text>
                <Text style={styles.trackMood} numberOfLines={1}>
                  {track.mood} - {track.durationLabel}
                </Text>
              </View>
              {loadingTrackId === track.id ? <Text style={styles.loadingText}>Loading</Text> : null}
            </Pressable>
          );
        })}
      </View>

      {error ? <Text style={styles.error}>{error}</Text> : null}

      <View style={styles.licenseBox}>
        <Text style={styles.licenseTitle}>Attribution</Text>
        <Text style={styles.licenseText}>{selectedTrack.attribution}</Text>
        <View style={styles.licenseActions}>
          <Button compact mode="outlined" icon="link-variant" onPress={() => void Linking.openURL(selectedTrack.sourceUrl)}>
            Source
          </Button>
          <Button compact mode="outlined" icon="certificate-outline" onPress={() => void Linking.openURL(selectedTrack.licenseUrl)}>
            CC BY 4.0
          </Button>
        </View>
      </View>
    </AppCard>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: 14,
    borderColor: `${palette.info}44`,
    backgroundColor: `${palette.info}10`
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    gap: 12
  },
  headerIcon: {
    width: 44,
    height: 44,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: `${palette.info}18`
  },
  headerText: {
    flex: 1,
    minWidth: 0
  },
  cardTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 18
  },
  muted: {
    color: palette.muted,
    lineHeight: 20
  },
  loopControl: {
    alignItems: "center",
    gap: 2
  },
  loopLabel: {
    color: palette.muted,
    fontSize: 11,
    fontFamily: "Outfit_700Bold"
  },
  nowPlaying: {
    minHeight: 64,
    flexDirection: "row",
    alignItems: "center",
    gap: 12,
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.04)",
    paddingHorizontal: 12,
    paddingVertical: 10
  },
  nowText: {
    flex: 1,
    minWidth: 0
  },
  trackTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold",
    fontSize: 16
  },
  playerButtons: {
    flexDirection: "row",
    alignItems: "center",
    gap: 2
  },
  progressTrack: {
    height: 8,
    overflow: "hidden",
    borderRadius: 8,
    backgroundColor: "rgba(255,255,255,0.08)"
  },
  progressFill: {
    height: "100%",
    borderRadius: 8,
    backgroundColor: palette.info
  },
  progressMeta: {
    flexDirection: "row",
    justifyContent: "space-between",
    marginTop: -8
  },
  timeText: {
    color: palette.muted,
    fontSize: 12,
    fontFamily: "Outfit_700Bold"
  },
  trackList: {
    gap: 8
  },
  trackRow: {
    minHeight: 54,
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderRadius: 8,
    borderWidth: 1,
    borderColor: palette.border,
    backgroundColor: "rgba(255,255,255,0.035)",
    paddingHorizontal: 10,
    paddingVertical: 8
  },
  trackRowSelected: {
    borderColor: `${palette.info}66`,
    backgroundColor: `${palette.info}16`
  },
  trackIcon: {
    width: 34,
    height: 34,
    borderRadius: 8,
    alignItems: "center",
    justifyContent: "center",
    backgroundColor: "rgba(255,255,255,0.05)"
  },
  trackText: {
    flex: 1,
    minWidth: 0
  },
  trackName: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  trackMood: {
    color: palette.muted,
    fontSize: 12,
    lineHeight: 17
  },
  loadingText: {
    color: palette.info,
    fontSize: 12,
    fontFamily: "Outfit_700Bold"
  },
  error: {
    color: palette.secondary,
    lineHeight: 20
  },
  licenseBox: {
    gap: 8,
    borderTopWidth: 1,
    borderTopColor: palette.border,
    paddingTop: 12
  },
  licenseTitle: {
    color: palette.text,
    fontFamily: "Outfit_700Bold"
  },
  licenseText: {
    color: palette.muted,
    lineHeight: 20
  },
  licenseActions: {
    flexDirection: "row",
    flexWrap: "wrap",
    gap: 8
  }
});
