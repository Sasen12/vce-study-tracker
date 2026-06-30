import 'package:flutter/material.dart';

/// Lightweight state holder for the application's theme mode.
///
/// Extends [ChangeNotifier] so that [ListenableBuilder] (in [main.dart])
/// can reactively rebuild [MaterialApp] whenever the theme is toggled.
/// No external dependencies — plain Dart with Flutter's built-in listener
/// pattern.
class ThemeModel extends ChangeNotifier {
  // Start in light mode by default (macOS appearance convention).
  ThemeMode _mode = ThemeMode.light;

  /// Expose the current mode for MaterialApp.themeMode.
  ThemeMode get mode => _mode;

  /// Convenience boolean checked by the settings slideout switch.
  bool get isDark => _mode == ThemeMode.dark;

  /// Sets the theme to a specific [mode] (light / dark / system).
  /// Only fires a notification if the value actually changed,
  /// preventing unnecessary rebuilds in MaterialApp's ListenableBuilder.
  void setThemeMode(ThemeMode mode) {
    if (_mode != mode) {
      _mode = mode;
      notifyListeners();
    }
  }

  /// Flips between dark and light (no system option in the current UI).
  /// Called by the settings slideout Switch on toggle.
  void toggle() {
    _mode = _mode == ThemeMode.dark ? ThemeMode.light : ThemeMode.dark;
    notifyListeners();
  }
}
