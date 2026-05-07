export type StudyMusicTrack = {
  id: string;
  title: string;
  artist: string;
  durationLabel: string;
  durationMillis: number;
  mood: string;
  isrc: string;
  audioUrl: string;
  sourceUrl: string;
  licenseName: string;
  licenseUrl: string;
  attribution: string;
};

const incompetechAudioUrl = (fileName: string) =>
  `https://www.incompetech.com/music/royalty-free/mp3-royaltyfree/${encodeURIComponent(fileName)}`;

export const STUDY_MUSIC_TRACKS: StudyMusicTrack[] = [
  {
    id: "study-and-relax",
    title: "Study And Relax",
    artist: "Kevin MacLeod",
    durationLabel: "3:43",
    durationMillis: 223000,
    mood: "Calm groove",
    isrc: "USUAN1900030",
    audioUrl: incompetechAudioUrl("Study And Relax.mp3"),
    sourceUrl: "https://www.incompetech.com/music/royalty-free/index.html?isrc=USUAN1900030",
    licenseName: "Creative Commons Attribution 4.0",
    licenseUrl: "http://creativecommons.org/licenses/by/4.0/",
    attribution:
      '"Study And Relax" Kevin MacLeod (incompetech.com). Licensed under Creative Commons: By Attribution 4.0 License.'
  },
  {
    id: "meditation-impromptu-01",
    title: "Meditation Impromptu 01",
    artist: "Kevin MacLeod",
    durationLabel: "3:32",
    durationMillis: 212000,
    mood: "Calm piano",
    isrc: "USUAN1100163",
    audioUrl: incompetechAudioUrl("Meditation Impromptu 01.mp3"),
    sourceUrl: "https://www.incompetech.com/music/royalty-free/index.html?isrc=USUAN1100163",
    licenseName: "Creative Commons Attribution 4.0",
    licenseUrl: "http://creativecommons.org/licenses/by/4.0/",
    attribution:
      '"Meditation Impromptu 01" Kevin MacLeod (incompetech.com). Licensed under Creative Commons: By Attribution 4.0 License.'
  },
  {
    id: "valse-gymnopedie",
    title: "Valse Gymnopedie",
    artist: "Kevin MacLeod",
    durationLabel: "3:12",
    durationMillis: 192000,
    mood: "Soft classical",
    isrc: "USUAN2100012",
    audioUrl: incompetechAudioUrl("Valse Gymnopedie.mp3"),
    sourceUrl: "https://www.incompetech.com/music/royalty-free/index.html?isrc=USUAN2100012",
    licenseName: "Creative Commons Attribution 4.0",
    licenseUrl: "http://creativecommons.org/licenses/by/4.0/",
    attribution:
      '"Valse Gymnopedie" Kevin MacLeod (incompetech.com). Licensed under Creative Commons: By Attribution 4.0 License.'
  },
  {
    id: "local-forecast-slower",
    title: "Local Forecast - Slower",
    artist: "Kevin MacLeod",
    durationLabel: "3:19",
    durationMillis: 199000,
    mood: "Light focus",
    isrc: "USUAN1300011",
    audioUrl: incompetechAudioUrl("Local Forecast - Slower.mp3"),
    sourceUrl: "https://www.incompetech.com/music/royalty-free/index.html?isrc=USUAN1300011",
    licenseName: "Creative Commons Attribution 4.0",
    licenseUrl: "http://creativecommons.org/licenses/by/4.0/",
    attribution:
      '"Local Forecast - Slower" Kevin MacLeod (incompetech.com). Licensed under Creative Commons: By Attribution 4.0 License.'
  }
];
