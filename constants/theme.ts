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

export type ThemeId = "midnight" | "mint" | "sunset" | "ocean" | "royal";

export type ThemePalette = typeof palette;

export type ThemeShopItem = {
  id: ThemeId;
  name: string;
  price: number;
  colors: ThemePalette;
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
    price: 120,
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
    price: 180,
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
    price: 240,
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
