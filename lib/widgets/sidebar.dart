import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

// Maps each subject to an SF Symbols–style icon for visual recognition.
// Used in every sidebar item row to give a quick visual hint of the subject.
const _subjectIcons = {
  'Software Development': Icons.code,
  'Data Analytics': Icons.analytics,
  'Business Management': Icons.business,
  'General Mathematics': Icons.calculate,
  'English': Icons.book,
  'Physics': Icons.science,
  'Mathematical Methods': Icons.functions,
};

// Distinct accent colour per subject, used for the icon background /
// tint when the item is selected.  Matches common subject-association
// colours (blue for coding, orange for data, green for business, etc.).
const _subjectColors = {
  'Software Development': Color(0xFF007AFF),
  'Data Analytics': Color(0xFFFF9500),
  'Business Management': Color(0xFF34C759),
  'General Mathematics': Color(0xFFAF52DE),
  'English': Color(0xFFFF3B30),
  'Physics': Color(0xFF64D8FF),
  'Mathematical Methods': Color(0xFFFF6480),
};

/// Fixed-width subject list on the left edge of the screen.
///
/// Uses [AnimatedContainer] for a smooth highlight when switching subjects.
/// The selected entry fills with its subject colour; all others remain
/// transparent.  A chevron indicator appears on the active row.
class Sidebar extends StatelessWidget {
  final List<String> subjects;
  final String? selectedSubject;
  final ValueChanged<String> onSubjectSelected;

  const Sidebar({
    super.key,
    required this.subjects,
    required this.selectedSubject,
    required this.onSubjectSelected,
  });

  @override
  Widget build(BuildContext context) {
    // Fixed 220 px sidebar with a subtle right border separating it from
    // the centre panel.  The grey searchBg background gives the macOS
    // Finder-sidebar feel.
    return Container(
      width: 220,
      decoration: BoxDecoration(
        color: context.searchBg,
        border: Border(
          right: BorderSide(color: context.borderStrong, width: 0.5),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Section header label above the subject list.
          Padding(
            padding: const EdgeInsets.fromLTRB(16, 20, 16, 10),
            child: Text(
              'SUBJECTS',
              style: TextStyle(
                fontSize: 11,
                fontWeight: FontWeight.w600,
                color: context.textSecondary,
                letterSpacing: 0.8,
              ),
            ),
          ),
          // Scrollable list of subject items.
          Expanded(
            child: ListView.builder(
              padding: const EdgeInsets.symmetric(horizontal: 8),
              itemCount: subjects.length,
              itemBuilder: (context, index) {
                final subject = subjects[index];
                final isSelected = subject == selectedSubject;
                // Look up the subject's colour/icon; fall back to blue + folder
                // so the app doesn't crash if a subject is added to the list
                // without a corresponding map entry.
                final color = _subjectColors[subject] ?? const Color(0xFF007AFF);
                final icon = _subjectIcons[subject] ?? Icons.folder;

                return _SidebarItem(
                  isSelected: isSelected,
                  color: color,
                  icon: icon,
                  subject: subject,
                  onTap: () => onSubjectSelected(subject),
                );
              },
            ),
          ),
        ],
      ),
    );
  }
}

/// Individual sidebar item with hover and selection states.
///
/// Uses [AnimatedContainer] for the background highlight and a 3 px
/// accent bar on the left edge when selected.  Hover subtly increases
/// the icon's background opacity.
class _SidebarItem extends StatefulWidget {
  final bool isSelected;
  final Color color;
  final IconData icon;
  final String subject;
  final VoidCallback onTap;

  const _SidebarItem({
    required this.isSelected,
    required this.color,
    required this.icon,
    required this.subject,
    required this.onTap,
  });

  @override
  State<_SidebarItem> createState() => _SidebarItemState();
}

class _SidebarItemState extends State<_SidebarItem> {
  // Tracks mouse hover to show a subtle background tint on non-selected items.
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    final isSelected = widget.isSelected;
    final color = widget.color;

    return MouseRegion(
      cursor: SystemMouseCursors.click,
      // Toggle hover flag on enter/exit to drive background transparency.
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() => _isHovered = false),
      child: Padding(
        padding: const EdgeInsets.only(bottom: 3),
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOutCubic,
          decoration: BoxDecoration(
            // Selected = 8 % tint of subject colour; hovered = 4 % tint;
            // default = transparent.  withValues preserves the colour space.
            color: isSelected
                ? color.withValues(alpha: 0.08)
                : _isHovered
                    ? color.withValues(alpha: 0.04)
                    : Colors.transparent,
            borderRadius: BorderRadius.circular(10),
          ),
          child: Stack(
            children: [
              // Left accent bar — only visible when selected.
              if (isSelected)
                Positioned(
                  left: 0,
                  top: 5,
                  bottom: 5,
                  child: Container(
                    width: 3,
                    decoration: BoxDecoration(
                      color: color,
                      borderRadius: BorderRadius.circular(2),
                    ),
                  ),
                ),
              // The actual tappable row with icon, label, and chevron.
              Material(
                color: Colors.transparent,
                child: InkWell(
                  borderRadius: BorderRadius.circular(10),
                  onTap: widget.onTap,
                  child: Padding(
                    padding: const EdgeInsets.symmetric(
                      horizontal: 12,
                      vertical: 11,
                    ),
                    child: Row(
                      children: [
                        // Icon container with tinted background that shifts
                        // opacity on selection/hover.
                        AnimatedContainer(
                          duration: const Duration(milliseconds: 200),
                          width: 28,
                          height: 28,
                          decoration: BoxDecoration(
                            color: isSelected
                                ? color.withValues(alpha: 0.15)
                                : color.withValues(alpha: _isHovered ? 0.2 : 0.08),
                            borderRadius: BorderRadius.circular(7),
                          ),
                          child: Icon(
                            widget.icon,
                            size: 15,
                            color: color,
                          ),
                        ),
                        const SizedBox(width: 10),
                        // Subject label — bold + coloured when selected,
                        // regular weight + primary colour otherwise.
                        Expanded(
                          child: Text(
                            widget.subject,
                            style: TextStyle(
                              fontSize: 13,
                              fontWeight: isSelected
                                  ? FontWeight.w600
                                  : FontWeight.w500,
                              color: isSelected
                                  ? color
                                  : context.textPrimary,
                            ),
                          ),
                        ),
                        // Right chevron — guides the eye to the active item.
                        if (isSelected)
                          Icon(
                            Icons.chevron_right,
                            size: 16,
                            color: color.withValues(alpha: 0.5),
                          ),
                      ],
                    ),
                  ),
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
