import { Audio, type AVPlaybackStatus } from "expo-av";
import { create } from "zustand";
import { STUDY_MUSIC_TRACKS, type StudyMusicTrack } from "@/constants/studyMusic";

type StudyMusicState = {
  selectedTrackId: string;
  loadedTrackId: string | null;
  playing: boolean;
  loadingTrackId: string | null;
  stopping: boolean;
  repeat: boolean;
  positionMillis: number;
  durationMillis: number;
  error: string | null;
  initialise: () => void;
  playOrPauseTrack: (track: StudyMusicTrack) => Promise<void>;
  stop: () => Promise<void>;
  setRepeat: (value: boolean) => Promise<void>;
};

let soundRef: Audio.Sound | null = null;
let playbackToken = 0;
let audioModeReady = false;

const defaultTrack = STUDY_MUSIC_TRACKS[0];

const ensureAudioMode = async () => {
  if (audioModeReady) return;
  await Audio.setAudioModeAsync({
    allowsRecordingIOS: false,
    playsInSilentModeIOS: true,
    staysActiveInBackground: false,
    shouldDuckAndroid: true
  });
  audioModeReady = true;
};

const nextTrackAfter = (track: StudyMusicTrack) => {
  const currentIndex = STUDY_MUSIC_TRACKS.findIndex((item) => item.id === track.id);
  const nextIndex = currentIndex >= 0 ? (currentIndex + 1) % STUDY_MUSIC_TRACKS.length : 0;
  return STUDY_MUSIC_TRACKS[nextIndex];
};

const unloadSound = async (sound: Audio.Sound | null) => {
  if (!sound) return;
  sound.setOnPlaybackStatusUpdate(null);
  await sound.unloadAsync();
};

export const useStudyMusicStore = create<StudyMusicState>((set, get) => {
  const resetPlaybackState = () => {
    set({
      loadedTrackId: null,
      playing: false,
      positionMillis: 0
    });
  };

  const replaceCurrentSound = async () => {
    const sound = soundRef;
    soundRef = null;
    resetPlaybackState();
    await unloadSound(sound);
  };

  const stopPlayback = async () => {
    playbackToken += 1;
    set({ loadingTrackId: null });
    const sound = soundRef;
    soundRef = null;
    resetPlaybackState();
    await unloadSound(sound);
  };

  const loadAndPlay = async (track: StudyMusicTrack) => {
    const token = playbackToken + 1;
    playbackToken = token;
    set({ loadingTrackId: track.id, error: null });
    try {
      await ensureAudioMode();
      await replaceCurrentSound();
      const { sound, status } = await Audio.Sound.createAsync(
        { uri: track.audioUrl },
        {
          shouldPlay: true,
          isLooping: get().repeat,
          volume: 0.72,
          progressUpdateIntervalMillis: 600
        },
        updateStatus(track, token)
      );

      if (token !== playbackToken) {
        await unloadSound(sound);
        return;
      }

      soundRef = sound;
      set({
        selectedTrackId: track.id,
        loadedTrackId: track.id
      });
      if (status.isLoaded) {
        set({
          playing: status.isPlaying,
          positionMillis: status.positionMillis,
          durationMillis: status.durationMillis ?? track.durationMillis
        });
      }
    } catch (loadError) {
      if (token === playbackToken) {
        set({
          error: loadError instanceof Error ? loadError.message : "Could not play this study track.",
          playing: false
        });
      }
    } finally {
      if (token === playbackToken) {
        set({ loadingTrackId: null });
      }
    }
  };

  const updateStatus = (track: StudyMusicTrack, token: number) => (status: AVPlaybackStatus) => {
    if (token !== playbackToken) return;
    if (!status.isLoaded) return;

    set({
      playing: status.isPlaying,
      positionMillis: status.positionMillis,
      durationMillis: status.durationMillis ?? track.durationMillis
    });

    if (status.didJustFinish && !status.isLooping) {
      const nextTrack = nextTrackAfter(track);
      if (nextTrack) void loadAndPlay(nextTrack);
    }
  };

  return {
    selectedTrackId: defaultTrack?.id ?? "",
    loadedTrackId: null,
    playing: false,
    loadingTrackId: null,
    stopping: false,
    repeat: false,
    positionMillis: 0,
    durationMillis: defaultTrack?.durationMillis ?? 0,
    error: null,
    initialise: () => {
      ensureAudioMode().catch(() => undefined);
    },
    playOrPauseTrack: async (track) => {
      if (get().loadedTrackId !== track.id || !soundRef) {
        await loadAndPlay(track);
        return;
      }

      const status = await soundRef.getStatusAsync();
      if (!status.isLoaded) {
        await loadAndPlay(track);
        return;
      }

      if (status.isPlaying) {
        await soundRef.pauseAsync();
        set({ playing: false });
        return;
      }

      await soundRef.playAsync();
      set({ playing: true });
    },
    stop: async () => {
      if (!soundRef && !get().loadingTrackId) return;
      set({ stopping: true, error: null });
      try {
        await stopPlayback();
      } catch (stopError) {
        set({
          error: stopError instanceof Error ? stopError.message : "Could not stop this study track."
        });
        resetPlaybackState();
      } finally {
        set({ stopping: false });
      }
    },
    setRepeat: async (value) => {
      set({ repeat: value });
      if (soundRef) {
        await soundRef.setIsLoopingAsync(value);
      }
    }
  };
});
