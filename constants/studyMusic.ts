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
  },
  {
    id: "calmant",
    title: "Calmant",
    artist: "Kevin MacLeod",
    durationLabel: "3:20",
    durationMillis: 200000,
    mood: "Slow piano",
    isrc: "USUAN1100859",
    audioUrl: incompetechAudioUrl("Calmant.mp3"),
    sourceUrl: "https://www.incompetech.com/music/royalty-free/index.html?isrc=USUAN1100859",
    licenseName: "Creative Commons Attribution 3.0",
    licenseUrl: "http://creativecommons.org/licenses/by/3.0/",
    attribution:
      '"Calmant" Kevin MacLeod (incompetech.com). Licensed under Creative Commons: By Attribution 3.0 License.'
  },
  {
    id: "pensif",
    title: "Pensif",
    artist: "Kevin MacLeod",
    durationLabel: "2:09",
    durationMillis: 129000,
    mood: "Somber piano",
    isrc: "USUAN1100857",
    audioUrl: incompetechAudioUrl("Pensif.mp3"),
    sourceUrl: "https://www.incompetech.com/music/royalty-free/index.html?isrc=USUAN1100857",
    licenseName: "Creative Commons Attribution 3.0",
    licenseUrl: "http://creativecommons.org/licenses/by/3.0/",
    attribution:
      '"Pensif" Kevin MacLeod (incompetech.com). Licensed under Creative Commons: By Attribution 3.0 License.'
  },
  {
    id: "facile",
    title: "Facile",
    artist: "Kevin MacLeod",
    durationLabel: "3:32",
    durationMillis: 212000,
    mood: "Deliberate piano",
    isrc: "USUAN1100858",
    audioUrl: incompetechAudioUrl("Facile.mp3"),
    sourceUrl: "https://www.incompetech.com/music/royalty-free/index.html?isrc=USUAN1100858",
    licenseName: "Creative Commons Attribution 3.0",
    licenseUrl: "http://creativecommons.org/licenses/by/3.0/",
    attribution:
      '"Facile" Kevin MacLeod (incompetech.com). Licensed under Creative Commons: By Attribution 3.0 License.'
  },
  {
    id: "avec-soin",
    title: "Avec Soin",
    artist: "Kevin MacLeod",
    durationLabel: "2:25",
    durationMillis: 145000,
    mood: "Easy piano",
    isrc: "USUAN1100860",
    audioUrl: incompetechAudioUrl("Avec Soin.mp3"),
    sourceUrl: "https://www.incompetech.com/music/royalty-free/index.html?isrc=USUAN1100860",
    licenseName: "Creative Commons Attribution 3.0",
    licenseUrl: "http://creativecommons.org/licenses/by/3.0/",
    attribution:
      '"Avec Soin" Kevin MacLeod (incompetech.com). Licensed under Creative Commons: By Attribution 3.0 License.'
  },
  {
    id: "dream-culture",
    title: "Dream Culture",
    artist: "Kevin MacLeod",
    durationLabel: "3:34",
    durationMillis: 214000,
    mood: "Dreamy focus",
    isrc: "USUAN1300046",
    audioUrl: incompetechAudioUrl("Dream Culture.mp3"),
    sourceUrl: "https://www.incompetech.com/music/royalty-free/index.html?isrc=USUAN1300046",
    licenseName: "Creative Commons Attribution 3.0",
    licenseUrl: "http://creativecommons.org/licenses/by/3.0/",
    attribution:
      '"Dream Culture" Kevin MacLeod (incompetech.com). Licensed under Creative Commons: By Attribution 3.0 License.'
  },
  {
    id: "floating-cities",
    title: "Floating Cities",
    artist: "Kevin MacLeod",
    durationLabel: "3:04",
    durationMillis: 184000,
    mood: "Calm synth",
    isrc: "USUAN1600018",
    audioUrl: incompetechAudioUrl("Floating Cities.mp3"),
    sourceUrl: "https://www.incompetech.com/music/royalty-free/index.html?isrc=USUAN1600018",
    licenseName: "Creative Commons Attribution 3.0",
    licenseUrl: "http://creativecommons.org/licenses/by/3.0/",
    attribution:
      '"Floating Cities" Kevin MacLeod (incompetech.com). Licensed under Creative Commons: By Attribution 3.0 License.'
  },
  {
    id: "peaceful-desolation",
    title: "Peaceful Desolation",
    artist: "Kevin MacLeod",
    durationLabel: "1:31",
    durationMillis: 91000,
    mood: "Low-key strings",
    isrc: "USUAN1200017",
    audioUrl: incompetechAudioUrl("Peaceful Desolation.mp3"),
    sourceUrl: "https://www.incompetech.com/music/royalty-free/index.html?isrc=USUAN1200017",
    licenseName: "Creative Commons Attribution 3.0",
    licenseUrl: "http://creativecommons.org/licenses/by/3.0/",
    attribution:
      '"Peaceful Desolation" Kevin MacLeod (incompetech.com). Licensed under Creative Commons: By Attribution 3.0 License.'
  },
  {
    id: "porch-swing-days-slower",
    title: "Porch Swing Days - slower",
    artist: "Kevin MacLeod",
    durationLabel: "3:36",
    durationMillis: 216000,
    mood: "Warm acoustic",
    isrc: "USUAN1100715",
    audioUrl: incompetechAudioUrl("Porch Swing Days - slower.mp3"),
    sourceUrl: "https://www.incompetech.com/music/royalty-free/index.html?isrc=USUAN1100715",
    licenseName: "Creative Commons Attribution 3.0",
    licenseUrl: "http://creativecommons.org/licenses/by/3.0/",
    attribution:
      '"Porch Swing Days - slower" Kevin MacLeod (incompetech.com). Licensed under Creative Commons: By Attribution 3.0 License.'
  },
  {
    id: "ambiment",
    title: "Ambiment",
    artist: "Kevin MacLeod",
    durationLabel: "22:53",
    durationMillis: 1373000,
    mood: "Long ambient",
    isrc: "USUAN1100630",
    audioUrl: incompetechAudioUrl("Ambiment.mp3"),
    sourceUrl: "https://www.incompetech.com/music/royalty-free/index.html?isrc=USUAN1100630",
    licenseName: "Creative Commons Attribution 3.0",
    licenseUrl: "http://creativecommons.org/licenses/by/3.0/",
    attribution:
      '"Ambiment" Kevin MacLeod (incompetech.com). Licensed under Creative Commons: By Attribution 3.0 License.'
  },
  {
    id: "peace-of-mind",
    title: "Peace of Mind",
    artist: "Kevin MacLeod",
    durationLabel: "35:58",
    durationMillis: 2158000,
    mood: "Long calm",
    isrc: "USUAN1200099",
    audioUrl: incompetechAudioUrl("Peace of Mind.mp3"),
    sourceUrl: "https://www.incompetech.com/music/royalty-free/index.html?isrc=USUAN1200099",
    licenseName: "Creative Commons Attribution 3.0",
    licenseUrl: "http://creativecommons.org/licenses/by/3.0/",
    attribution:
      '"Peace of Mind" Kevin MacLeod (incompetech.com). Licensed under Creative Commons: By Attribution 3.0 License.'
  },
  {
    id: "relaxing-piano-music",
    title: "Relaxing Piano Music",
    artist: "Kevin MacLeod",
    durationLabel: "24:54",
    durationMillis: 1494000,
    mood: "Long piano",
    isrc: "USUAN1500075",
    audioUrl: incompetechAudioUrl("Relaxing Piano Music.mp3"),
    sourceUrl: "https://www.incompetech.com/music/royalty-free/index.html?isrc=USUAN1500075",
    licenseName: "Creative Commons Attribution 3.0",
    licenseUrl: "http://creativecommons.org/licenses/by/3.0/",
    attribution:
      '"Relaxing Piano Music" Kevin MacLeod (incompetech.com). Licensed under Creative Commons: By Attribution 3.0 License.'
  }
];
