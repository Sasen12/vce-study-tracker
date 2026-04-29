import { themeById } from "@/constants/theme";
import { useAppStore } from "@/store/appStore";

export const useActiveTheme = () => {
  const activeTheme = useAppStore((state) => state.gamification?.activeTheme);
  return themeById(activeTheme);
};

export const useActivePalette = () => useActiveTheme().colors;
