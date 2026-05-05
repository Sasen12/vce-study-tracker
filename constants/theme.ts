export const palette = {
  background: "#0F0F14",
  surface: "#1A1A24",
  surfaceRaised: "#232333",
  primary: "#7C6EFF",
  secondary: "#FF6B6B",
  success: "#4ADE80",
  warning: "#F59E0B",
  info: "#60A5FA",
  text: "#F0F0FF",
  muted: "#8888AA",
  border: "rgba(255,255,255,0.04)"
};

export type ThemeId =
  | "midnight"
  | "mint"
  | "sunset"
  | "ocean"
  | "royal"
  | "aurora"
  | "citrus"
  | "cherry"
  | "glacier"
  | "graphite"
  | "arcade"
  | "forest"
  | "rose_gold"
  | "matrix"
  | "cherry_blossom"
  | "spring_picnic"
  | "summer_glow"
  | "easter_pastel"
  | "christmas_lights"
  | "snow_day"
  | "pink_cloud";

export type ThemePalette = typeof palette;
export type ThemeMotion = "blossom" | "spring" | "glow" | "pastel" | "lights" | "snow";

export type ThemeShopItem = {
  id: ThemeId;
  name: string;
  price: number;
  colors: ThemePalette;
  motion?: ThemeMotion;
};

export const themeShopItems: ThemeShopItem[] = [
  {
    id: "midnight",
    name: "Midnight Focus",
    price: 0,
    colors: palette
  },
  {
    id: "mint",
    name: "Mint Sprint",
    price: 60,
    colors: {
      background: "#071412",
      surface: "#10211D",
      surfaceRaised: "#18322B",
      primary: "#34D399",
      secondary: "#60A5FA",
      success: "#86EFAC",
      warning: "#FBBF24",
      info: "#67E8F9",
      text: "#F4FFF9",
      muted: "#8FB7A8",
      border: "rgba(134,239,172,0.12)"
    }
  },
  {
    id: "sunset",
    name: "Sunset Revision",
    price: 90,
    colors: {
      background: "#180D12",
      surface: "#261820",
      surfaceRaised: "#34212A",
      primary: "#FB7185",
      secondary: "#F59E0B",
      success: "#4ADE80",
      warning: "#FBBF24",
      info: "#93C5FD",
      text: "#FFF5F7",
      muted: "#B99AA2",
      border: "rgba(251,113,133,0.12)"
    }
  },
  {
    id: "ocean",
    name: "Ocean Mode",
    price: 140,
    colors: {
      background: "#06111F",
      surface: "#0F1D2D",
      surfaceRaised: "#172B42",
      primary: "#38BDF8",
      secondary: "#2DD4BF",
      success: "#4ADE80",
      warning: "#F59E0B",
      info: "#818CF8",
      text: "#EFF8FF",
      muted: "#8BAFC8",
      border: "rgba(56,189,248,0.12)"
    }
  },
  {
    id: "royal",
    name: "Royal Grind",
    price: 320,
    colors: {
      background: "#120B22",
      surface: "#1F1633",
      surfaceRaised: "#2B2042",
      primary: "#A78BFA",
      secondary: "#F472B6",
      success: "#34D399",
      warning: "#FBBF24",
      info: "#60A5FA",
      text: "#FAF7FF",
      muted: "#A99BC6",
      border: "rgba(167,139,250,0.14)"
    }
  },
  {
    id: "aurora",
    name: "Aurora Shift",
    price: 360,
    colors: {
      background: "#07110F",
      surface: "#10201D",
      surfaceRaised: "#172B29",
      primary: "#2DD4BF",
      secondary: "#F472B6",
      success: "#84CC16",
      warning: "#F59E0B",
      info: "#38BDF8",
      text: "#F8FFFE",
      muted: "#89B8B1",
      border: "rgba(45,212,191,0.13)"
    }
  },
  {
    id: "citrus",
    name: "Citrus Lab",
    price: 420,
    colors: {
      background: "#10130A",
      surface: "#1D2212",
      surfaceRaised: "#293018",
      primary: "#A3E635",
      secondary: "#F97316",
      success: "#4ADE80",
      warning: "#FACC15",
      info: "#22D3EE",
      text: "#FAFFF0",
      muted: "#B3BE8E",
      border: "rgba(163,230,53,0.13)"
    }
  },
  {
    id: "cherry",
    name: "Cherry Desk",
    price: 460,
    colors: {
      background: "#17090D",
      surface: "#261018",
      surfaceRaised: "#351724",
      primary: "#F43F5E",
      secondary: "#22D3EE",
      success: "#34D399",
      warning: "#FBBF24",
      info: "#A78BFA",
      text: "#FFF1F4",
      muted: "#CFA0AD",
      border: "rgba(244,63,94,0.14)"
    }
  },
  {
    id: "glacier",
    name: "Glacier Notes",
    price: 520,
    colors: {
      background: "#071218",
      surface: "#10212A",
      surfaceRaised: "#18313E",
      primary: "#67E8F9",
      secondary: "#C084FC",
      success: "#86EFAC",
      warning: "#FDE047",
      info: "#60A5FA",
      text: "#F0FCFF",
      muted: "#91B9C6",
      border: "rgba(103,232,249,0.14)"
    }
  },
  {
    id: "graphite",
    name: "Graphite Focus",
    price: 560,
    colors: {
      background: "#111315",
      surface: "#1D2224",
      surfaceRaised: "#273033",
      primary: "#D1D5DB",
      secondary: "#F97316",
      success: "#22C55E",
      warning: "#FACC15",
      info: "#38BDF8",
      text: "#F7FAFC",
      muted: "#94A3B8",
      border: "rgba(209,213,219,0.13)"
    }
  },
  {
    id: "arcade",
    name: "Arcade Sprint",
    price: 620,
    colors: {
      background: "#0E0A18",
      surface: "#1B1230",
      surfaceRaised: "#281A46",
      primary: "#22D3EE",
      secondary: "#FB7185",
      success: "#A3E635",
      warning: "#F59E0B",
      info: "#818CF8",
      text: "#FAF7FF",
      muted: "#AFA4CC",
      border: "rgba(34,211,238,0.13)"
    }
  },
  {
    id: "forest",
    name: "Forest Method",
    price: 680,
    colors: {
      background: "#07120D",
      surface: "#102218",
      surfaceRaised: "#183322",
      primary: "#4ADE80",
      secondary: "#FBBF24",
      success: "#86EFAC",
      warning: "#F97316",
      info: "#67E8F9",
      text: "#F4FFF7",
      muted: "#8FBA9D",
      border: "rgba(74,222,128,0.13)"
    }
  },
  {
    id: "rose_gold",
    name: "Rose Gold",
    price: 740,
    colors: {
      background: "#160D11",
      surface: "#24161B",
      surfaceRaised: "#322027",
      primary: "#FDA4AF",
      secondary: "#F59E0B",
      success: "#34D399",
      warning: "#FDE047",
      info: "#93C5FD",
      text: "#FFF7F8",
      muted: "#C6A0A8",
      border: "rgba(253,164,175,0.14)"
    }
  },
  {
    id: "matrix",
    name: "Matrix Mode",
    price: 820,
    colors: {
      background: "#050A07",
      surface: "#0D1711",
      surfaceRaised: "#14241A",
      primary: "#22C55E",
      secondary: "#38BDF8",
      success: "#A3E635",
      warning: "#FACC15",
      info: "#2DD4BF",
      text: "#F1FFF5",
      muted: "#81A88C",
      border: "rgba(34,197,94,0.14)"
    }
  },
  {
    id: "cherry_blossom",
    name: "Cherry Blossom",
    price: 880,
    motion: "blossom",
    colors: {
      background: "#160D15",
      surface: "#251822",
      surfaceRaised: "#352331",
      primary: "#F9A8D4",
      secondary: "#A7F3D0",
      success: "#86EFAC",
      warning: "#FDE68A",
      info: "#93C5FD",
      text: "#FFF7FB",
      muted: "#D8AFC3",
      border: "rgba(249,168,212,0.16)"
    }
  },
  {
    id: "spring_picnic",
    name: "Spring Picnic",
    price: 940,
    motion: "spring",
    colors: {
      background: "#08130F",
      surface: "#13221A",
      surfaceRaised: "#203428",
      primary: "#86EFAC",
      secondary: "#F9A8D4",
      success: "#A7F3D0",
      warning: "#FDE047",
      info: "#67E8F9",
      text: "#F7FFF9",
      muted: "#A6C7B1",
      border: "rgba(134,239,172,0.15)"
    }
  },
  {
    id: "summer_glow",
    name: "Summer Glow",
    price: 1000,
    motion: "glow",
    colors: {
      background: "#081018",
      surface: "#132231",
      surfaceRaised: "#20334A",
      primary: "#38BDF8",
      secondary: "#FBBF24",
      success: "#34D399",
      warning: "#FB923C",
      info: "#A78BFA",
      text: "#F5FBFF",
      muted: "#9BBAD0",
      border: "rgba(56,189,248,0.15)"
    }
  },
  {
    id: "easter_pastel",
    name: "Easter Pastel",
    price: 1060,
    motion: "pastel",
    colors: {
      background: "#111022",
      surface: "#1D1A33",
      surfaceRaised: "#292542",
      primary: "#C4B5FD",
      secondary: "#F9A8D4",
      success: "#A7F3D0",
      warning: "#FDE68A",
      info: "#93C5FD",
      text: "#FBFAFF",
      muted: "#BDB5D5",
      border: "rgba(196,181,253,0.15)"
    }
  },
  {
    id: "christmas_lights",
    name: "Christmas Lights",
    price: 1120,
    motion: "lights",
    colors: {
      background: "#07110C",
      surface: "#121F17",
      surfaceRaised: "#1C2C21",
      primary: "#EF4444",
      secondary: "#FACC15",
      success: "#22C55E",
      warning: "#F97316",
      info: "#38BDF8",
      text: "#F7FFF9",
      muted: "#9BB69F",
      border: "rgba(239,68,68,0.16)"
    }
  },
  {
    id: "snow_day",
    name: "Snow Day",
    price: 1180,
    motion: "snow",
    colors: {
      background: "#071118",
      surface: "#10202A",
      surfaceRaised: "#18313D",
      primary: "#BAE6FD",
      secondary: "#C4B5FD",
      success: "#86EFAC",
      warning: "#FDE68A",
      info: "#67E8F9",
      text: "#F5FCFF",
      muted: "#A8C5D3",
      border: "rgba(186,230,253,0.16)"
    }
  },
  {
    id: "pink_cloud",
    name: "Pink Cloud",
    price: 1240,
    motion: "blossom",
    colors: {
      background: "#150F1A",
      surface: "#241929",
      surfaceRaised: "#32233A",
      primary: "#F0ABFC",
      secondary: "#FDA4AF",
      success: "#86EFAC",
      warning: "#FDE047",
      info: "#93C5FD",
      text: "#FFF7FE",
      muted: "#CDAFCC",
      border: "rgba(240,171,252,0.16)"
    }
  }
];

export const themeById = (themeId?: string | null) =>
  themeShopItems.find((theme) => theme.id === themeId) ?? themeShopItems[0];

export const subjectColors = [
  "#7C6EFF",
  "#FF6B6B",
  "#4ADE80",
  "#60A5FA",
  "#F59E0B",
  "#F472B6",
  "#22D3EE",
  "#A3E635"
];
