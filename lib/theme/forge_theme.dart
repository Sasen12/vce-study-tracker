import 'package:flutter/material.dart';

class FC {
  // Backgrounds
  static const bg = Color(0xFF0D0F14);
  static const navBg = Color(0xFF12141C);
  static const card = Color(0xFF1A1D26);
  static const cardAlt = Color(0xFF1E2134);

  // Accent purple
  static const accent = Color(0xFF7C6FFF);
  static const accentLight = Color(0xFF9D8FFF);
  static const accentDim = Color(0xFF2D2860);

  // Semantic
  static const green = Color(0xFF34D399);
  static const greenDim = Color(0xFF0E3D2A);
  static const red = Color(0xFFF06B6B);
  static const redDim = Color(0xFF3D1818);
  static const amber = Color(0xFFFBBF24);
  static const amberDim = Color(0xFF3D3010);
  static const blue = Color(0xFF60A5FA);
  static const blueDim = Color(0xFF102840);

  // Text
  static const textPrimary = Color(0xFFFFFFFF);
  static const textSecondary = Color(0xFF8A8FA8);
  static const textTertiary = Color(0xFF4A4E6A);

  // Borders
  static const border = Color(0xFF252836);
  static const borderStrong = Color(0xFF2E3145);

  static Color subjectColor(String subject) {
    switch (subject) {
      case 'Mathematical Methods':
        return const Color(0xFF818CF8);
      case 'Chemistry':
        return const Color(0xFFF87171);
      case 'English':
        return const Color(0xFF34D399);
      case 'Physics':
        return const Color(0xFF60A5FA);
      case 'Specialist Maths':
        return const Color(0xFFFBBF24);
      default:
        return accent;
    }
  }
}

class ForgeTheme {
  static ThemeData get dark => ThemeData(
        useMaterial3: false,
        brightness: Brightness.dark,
        scaffoldBackgroundColor: FC.bg,
        colorScheme: const ColorScheme.dark(
          primary: FC.accent,
          secondary: FC.accentLight,
          surface: FC.card,
        ),
        dividerColor: FC.border,
        iconTheme: const IconThemeData(color: FC.textSecondary),
        textTheme: const TextTheme(
          bodyMedium: TextStyle(color: FC.textSecondary),
        ),
      );
}
