import { FadeIn, FadeInUp, Layout } from "react-native-reanimated";

export const motion = {
  screen: () => FadeIn.duration(180),
  card: (delay = 0) => FadeInUp.delay(delay).duration(240),
  listItem: (index = 0) => FadeInUp.delay(Math.min(index * 35, 220)).duration(220),
  layout: () => Layout.duration(180)
};
