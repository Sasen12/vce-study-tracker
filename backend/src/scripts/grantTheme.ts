import "dotenv/config";
import { prisma } from "../db/prismaClient.js";
import { DEFAULT_THEME_ID, THEME_SHOP_ITEMS } from "../services/gamificationService.js";

const readArg = (name: string) => {
  const flag = `--${name}`;
  const index = process.argv.indexOf(flag);
  if (index === -1) return null;
  return process.argv[index + 1] ?? null;
};

const hasFlag = (name: string) => process.argv.includes(`--${name}`);

const asStringArray = (value: unknown) =>
  Array.isArray(value) ? value.filter((item): item is string => typeof item === "string") : [];

const email = readArg("email")?.trim().toLowerCase();
const themeId = readArg("theme")?.trim();
const shouldEquip = hasFlag("equip");

if (!email || !themeId) {
  console.error("Usage: npm run grant:theme -- --email student@example.com --theme cherry_blossom [--equip]");
  process.exit(1);
}

const theme = THEME_SHOP_ITEMS.find((item) => item.id === themeId);
if (!theme) {
  console.error(`Theme not found: ${themeId}`);
  console.error(`Available themes: ${THEME_SHOP_ITEMS.map((item) => item.id).join(", ")}`);
  process.exit(1);
}

try {
  const user = await prisma.user.findUnique({
    where: { email },
    select: {
      id: true,
      email: true,
      displayName: true,
      gamification: {
        select: {
          unlockedCosmetics: true,
          activeTheme: true,
          xpBalance: true
        }
      }
    }
  });

  if (!user) {
    console.error(`User not found: ${email}`);
    process.exit(1);
  }

  const currentUnlocks = asStringArray(user.gamification?.unlockedCosmetics);
  const unlockedCosmetics = Array.from(new Set([DEFAULT_THEME_ID, ...currentUnlocks, theme.id]));
  const activeTheme = shouldEquip ? theme.id : (user.gamification?.activeTheme ?? DEFAULT_THEME_ID);

  const gamification = await prisma.userGamification.upsert({
    where: { userId: user.id },
    update: {
      unlockedCosmetics,
      activeTheme
    },
    create: {
      userId: user.id,
      unlockedCosmetics,
      activeTheme
    }
  });

  console.log(
    JSON.stringify(
      {
        email: user.email,
        displayName: user.displayName,
        grantedTheme: theme.id,
        equipped: gamification.activeTheme === theme.id,
        activeTheme: gamification.activeTheme,
        xpBalance: gamification.xpBalance,
        unlockedCosmetics: gamification.unlockedCosmetics
      },
      null,
      2
    )
  );
} finally {
  await prisma.$disconnect();
}
