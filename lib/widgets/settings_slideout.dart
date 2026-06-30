import 'package:flutter/material.dart';
import '../theme/theme_model.dart';
import '../theme/app_colors.dart';

/// Slideout panel displayed from the right edge via [showGeneralDialog].
///
/// Contains appearance controls (dark mode toggle) and general info
/// (version number).  The panel slides in with a [SlideTransition] and
/// can be dismissed by tapping the barrier, pressing the close button,
/// or swiping (future enhancement).
class SettingsSlideout extends StatelessWidget {
  final ThemeModel themeModel;
  final VoidCallback onClose;

  const SettingsSlideout({
    super.key,
    required this.themeModel,
    required this.onClose,
  });

  /// Opens the settings panel as a right-aligned overlay dialog.
  /// Uses [showGeneralDialog] for a custom slide-in transition instead
  /// of the default popup style.
  static void show(BuildContext context, ThemeModel themeModel) {
    showGeneralDialog(
      context: context,
      barrierDismissible: true,
      barrierLabel: 'Settings',
      barrierColor: Colors.black45,
      transitionDuration: const Duration(milliseconds: 350),
      pageBuilder: (context, animation, secondaryAnimation) {
        // Align the panel to the right edge; slide it in from off-screen.
        return Align(
          alignment: Alignment.centerRight,
          child: SlideTransition(
            position: Tween<Offset>(
              begin: const Offset(1, 0),
              end: Offset.zero,
            ).animate(CurvedAnimation(
              parent: animation,
              curve: Curves.easeOutCubic,
            )),
            child: SizedBox(
              width: 320,
              height: double.infinity,
              child: Material(
                color: Colors.transparent,
                child: SettingsSlideout(
                  themeModel: themeModel,
                  // Pop the dialog when the user taps the close button.
                  onClose: () => Navigator.of(context).pop(),
                ),
              ),
            ),
          ),
        );
      },
    );
  }

  @override
  Widget build(BuildContext context) {
    // ListenableBuilder ensures the settings panel live-updates when
    // themeModel toggles — the Switch and subtitle text both react.
    return ListenableBuilder(
      listenable: themeModel,
      builder: (context, _) {
        return Container(
          decoration: BoxDecoration(
            color: context.cardBg,
            border: Border(
              left: BorderSide(color: context.border, width: 0.5),
            ),
            // Shadow cast onto the main content to the left.
            boxShadow: [
              BoxShadow(
                color: Colors.black.withValues(alpha: 0.15),
                blurRadius: 20,
                offset: const Offset(-4, 0),
              ),
            ],
          ),
          child: Column(
            children: [
              // Drag handle + title bar + close button.
              _buildHeader(context),
              // Scrollable settings content.
              Expanded(
                child: ListView(
                  padding: const EdgeInsets.fromLTRB(16, 12, 16, 40),
                  children: [
                    _buildSectionHeader(context, 'Appearance'),
                    const SizedBox(height: 8),
                    // Dark mode toggle card.
                    _buildSettingCard(
                      context,
                      icon: themeModel.isDark ? Icons.dark_mode : Icons.light_mode,
                      iconColor: const Color(0xFF0078D4),
                      title: 'Dark Mode',
                      subtitle: themeModel.isDark
                          ? 'Dark theme is active'
                          : 'Light theme is active',
                      trailing: Switch(
                        value: themeModel.isDark,
                        onChanged: (_) => themeModel.toggle(),
                        activeColor: const Color(0xFF0078D4),
                      ),
                    ),
                    const SizedBox(height: 24),
                    _buildSectionHeader(context, 'General'),
                    const SizedBox(height: 8),
                    // Version info card (read-only).
                    _buildSettingCard(
                      context,
                      icon: Icons.info_outline,
                      iconColor: context.textSecondary,
                      title: 'Version',
                      subtitle: '1.0.0',
                    ),
                  ],
                ),
              ),
            ],
          ),
        );
      },
    );
  }

  /// Header row with a drag handle (decorative), "Settings" title, and close X.
  Widget _buildHeader(BuildContext context) {
    return Container(
      padding: const EdgeInsets.fromLTRB(0, 0, 0, 0),
      decoration: BoxDecoration(
        border: Border(
          bottom: BorderSide(color: context.border, width: 0.5),
        ),
      ),
      child: Column(
        children: [
          // Thin pill-shaped drag handle at the very top.
          const SizedBox(height: 8),
          DragHandle(color: context.textTertiary),
          // Title row with close button on the right.
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 14, 20, 14),
            child: Row(
              children: [
                Text(
                  'Settings',
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: context.textPrimary,
                  ),
                ),
                const Spacer(),
                // Close button — small rounded square with X icon.
                MouseRegion(
                  cursor: SystemMouseCursors.click,
                  child: GestureDetector(
                    onTap: onClose,
                    child: Container(
                      width: 30,
                      height: 30,
                      decoration: BoxDecoration(
                        color: context.fillBg,
                        borderRadius: BorderRadius.circular(8),
                      ),
                      child: Icon(
                        Icons.close,
                        size: 16,
                        color: context.textSecondary,
                      ),
                    ),
                  ),
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }

  /// Section label used inside the scrollable content area.
  Widget _buildSectionHeader(BuildContext context, String title) {
    return Padding(
      padding: const EdgeInsets.only(left: 4, bottom: 4),
      child: Text(
        title,
        style: TextStyle(
          fontSize: 13,
          fontWeight: FontWeight.w700,
          color: context.textSecondary,
          letterSpacing: 0.5,
        ),
      ),
    );
  }

  /// Reusable card row for a single setting (icon + title + subtitle + optional trailing widget).
  Widget _buildSettingCard(
    BuildContext context, {
    required IconData icon,
    required Color iconColor,
    required String title,
    String? subtitle,
    Widget? trailing,
  }) {
    return Container(
      decoration: BoxDecoration(
        color: context.cardBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: context.border, width: 0.5),
      ),
      child: Padding(
        padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 12),
        child: Row(
          children: [
            // Icon in a tinted square container.
            Container(
              width: 30,
              height: 30,
              decoration: BoxDecoration(
                color: iconColor.withAlpha(25),
                borderRadius: BorderRadius.circular(8),
              ),
              child: Icon(icon, size: 16, color: iconColor),
            ),
            const SizedBox(width: 12),
            // Title + optional subtitle.
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(
                    title,
                    style: TextStyle(
                      fontSize: 14,
                      fontWeight: FontWeight.w500,
                      color: context.textPrimary,
                    ),
                  ),
                  if (subtitle != null) ...[
                    const SizedBox(height: 2),
                    Text(
                      subtitle,
                      style: TextStyle(
                        fontSize: 12,
                        color: context.textSecondary,
                      ),
                    ),
                  ],
                ],
              ),
            ),
            // Trailing widget (Switch, etc.) at the right edge.
            if (trailing != null) trailing,
          ],
        ),
      ),
    );
  }
}

/// Thin pill-shaped indicator at the top of the slideout, mimicking the
/// visual handle on iOS / macOS sheets.  Purely decorative.
class DragHandle extends StatelessWidget {
  final Color color;

  const DragHandle({super.key, required this.color});

  @override
  Widget build(BuildContext context) {
    return Container(
      width: 36,
      height: 4,
      decoration: BoxDecoration(
        color: color,
        borderRadius: BorderRadius.circular(2),
      ),
    );
  }
}
