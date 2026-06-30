import 'package:flutter/material.dart';

/// Theme-aware colour palette exposed as getters on [BuildContext].
///
/// Every colour in the app pulls from this extension rather than hard-coding
/// hex values.  The [isDark] flag selects the correct variant from the
/// user's custom palette:
///   Light:  SF-style greys (#F5F5F7, #F2F2F7, #1D1D1F)
///   Dark:   #121212 bg, #1B1B1B cards, #222222 fills, #333333 borders,
///           #0078D4 accent, white primary text, #BBBBBB secondary.
extension ThemeColors on BuildContext {
  /// Derive brightness from the current theme so every colour is reactive.
  bool get isDark => Theme.of(this).brightness == Brightness.dark;

  /// Background for input fields and the sidebar — grey in light, dark grey in dark.
  Color get searchBg => isDark ? const Color(0xFF222222) : const Color(0xFFF2F2F7);

  /// Border for the search field — mid-grey on light, subtle dark on dark.
  Color get searchBorder => isDark ? const Color(0xFF333333) : const Color(0xFFD1D1D6);

  /// Highest-emphasis text: titles, headings, body copy.
  Color get textPrimary => isDark ? const Color(0xFFFFFFFF) : const Color(0xFF1D1D1F);

  /// Medium-emphasis text: labels, subtitles, descriptions.
  Color get textSecondary => isDark ? const Color(0xFFBBBBBB) : const Color(0xFF8E8E93);

  /// Lowest-emphasis / placeholder text: breadcrumbs, footnotes, hints.
  Color get textTertiary => isDark ? const Color(0xFF666666) : const Color(0xFFC7C7CC);

  /// Card / panel surface — white on light, near-black on dark.
  Color get cardBg => isDark ? const Color(0xFF1B1B1B) : Colors.white;

  /// Solid fill backgrounds: stat badges, inactive pills, icon containers.
  Color get fillBg => isDark ? const Color(0xFF222222) : const Color(0xFFF2F2F7);

  /// Highlighted / selected row background: blue-tinted for contrast.
  Color get selectedBg => isDark ? const Color(0xFF1A3050) : const Color(0xFFE8F0FE);

  /// Subtle line separators: dividers, hairline borders.
  Color get border => isDark ? const Color(0xFF333333) : const Color(0xFFE5E5EA);

  /// Stronger border for selected / hovered states and panel edges.
  Color get borderStrong => isDark ? const Color(0xFF333333) : const Color(0xFFD1D1D6);

  /// Primary panel separator — slightly more visible than [borderStrong] to
  /// distinguish the three columns from each other.
  Color get panelBorder => isDark ? const Color(0xFF3A3A3A) : const Color(0xFFC7C7CC);

  /// Outer scaffold / detail panel background — a shade off-white on light, darkest grey on dark.
  Color get surfaceBg => isDark ? const Color(0xFF121212) : const Color(0xFFF9F9FB);

  /// Bottom status bar background — same as [fillBg] to sit below the content.
  Color get statusBg => isDark ? const Color(0xFF1E1E1E) : const Color(0xFFF2F2F7);

  /// Tinted card background for the "Plain-Language Explanation" section.
  Color get plainLanguageBg => isDark ? const Color(0xFF162230) : const Color(0xFFE8F0FE);

  /// Border accent for the plain-language card.
  Color get plainLanguageBorder => isDark ? const Color(0xFF1A3A50) : const Color(0xFFB8D4F8);

  /// Same as [fillBg] — used for stat count badges.
  Color get statsBg => isDark ? const Color(0xFF222222) : const Color(0xFFF2F2F7);

  /// Fallback background for unselected pills and buttons.
  Color get inactiveBadge => isDark ? const Color(0xFF222222) : const Color(0xFFF2F2F7);
}
