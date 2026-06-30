import 'package:flutter/material.dart';
import '../models/study_item.dart';
import '../theme/app_colors.dart';

/// Right-hand detail panel showing the selected study item's content.
///
/// Two sections are displayed side-by-side (vertically stacked):
///   - **Official Text** — the VCAA curriculum wording.
///   - **Plain-Language Explanation** — a student-friendly re-phrasing
///     with a distinct tinted background.
///
/// An [AnimatedSwitcher] cross-fades + slides when switching between items
/// (or between an item and the empty state).
class DetailPanel extends StatelessWidget {
  final StudyItem? item;
  final ValueChanged<bool> onCompletionChanged;

  const DetailPanel({
    super.key,
    required this.item,
    required this.onCompletionChanged,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      decoration: BoxDecoration(
        color: context.surfaceBg,
        border: Border(
          left: BorderSide(color: context.border, width: 0.5),
        ),
      ),
      child: AnimatedSwitcher(
        duration: const Duration(milliseconds: 300),
        switchInCurve: Curves.easeOutCubic,
        switchOutCurve: Curves.easeInCubic,
        // Stack layout keeps the outgoing child visible during the transition
        // (avoids a sudden flash when the key changes).
        layoutBuilder: (currentChild, previousChildren) {
          return Stack(
            children: [
              ...previousChildren,
              if (currentChild != null) currentChild,
            ],
          );
        },
        transitionBuilder: (child, animation) {
          // Slide in from the right (6 % offset) while fading.
          final slideAnim = CurvedAnimation(
            parent: animation,
            curve: Curves.easeOutCubic,
          );
          return FadeTransition(
            opacity: animation,
            child: SlideTransition(
              position: Tween<Offset>(
                begin: const Offset(0.06, 0),
                end: Offset.zero,
              ).animate(slideAnim),
              child: child,
            ),
          );
        },
        // Use null vs non-null item to switch between empty and detail views.
        child: item == null
            ? _buildEmptyState(context)
            : _buildDetail(context, item!),
      ),
    );
  }

  Widget _buildEmptyState(BuildContext context) {
    // Centred placeholder with a book icon and instructional text.
    return Center(
      key: const ValueKey('empty'),
      child: Column(
        mainAxisAlignment: MainAxisAlignment.center,
        children: [
          Container(
            width: 64,
            height: 64,
            decoration: BoxDecoration(
              color: context.fillBg,
              borderRadius: BorderRadius.circular(16),
            ),
            child: Icon(
              Icons.book_outlined,
              size: 28,
              color: context.textTertiary,
            ),
          ),
          const SizedBox(height: 16),
          Text(
            'Select an item',
            style: TextStyle(
              fontSize: 15,
              fontWeight: FontWeight.w600,
              color: context.textPrimary,
            ),
          ),
          const SizedBox(height: 4),
          Text(
            'Choose from the list to view\ndetails and explanations.',
            textAlign: TextAlign.center,
            style: TextStyle(
              fontSize: 13,
              color: context.textSecondary,
              height: 1.4,
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildDetail(BuildContext context, StudyItem item) {
    return Column(
      // Key is the item.id so AnimatedSwitcher detects when the selection changes.
      key: ValueKey(item.id),
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        // Header with breadcrumb, title, complete button, and tags.
        _buildHeader(context, item),
        // Scrollable content area with Official Text + Plain Language cards.
        Expanded(
          child: SingleChildScrollView(
            padding: const EdgeInsets.all(20),
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                // Official Text card — solid white/grey background.
                _buildSectionCard(
                  context,
                  'Official Text',
                  item.officialText,
                  context.cardBg,
                  context.border,
                  context.textPrimary,
                ),
                const SizedBox(height: 16),
                // Plain-Language Explanation card — tinted blue background.
                _buildSectionCard(
                  context,
                  'Plain-Language Explanation',
                  item.plainLanguageText,
                  context.plainLanguageBg,
                  context.plainLanguageBorder,
                  context.textPrimary,
                ),
              ],
            ),
          ),
        ),
      ],
    );
  }

  Widget _buildHeader(BuildContext context, StudyItem item) {
    return Container(
      padding: const EdgeInsets.fromLTRB(20, 20, 20, 14),
      decoration: BoxDecoration(
        color: context.cardBg,
        border: Border(
          bottom: BorderSide(color: context.border, width: 0.5),
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Optional curriculum breadcrumb (unit > AOS > outcome).
          if (item.unit != null)
            Padding(
              padding: const EdgeInsets.only(bottom: 6),
              child: _DetailBreadcrumb(item: item),
            ),
          // Title row + completion button.
          Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              Expanded(
                child: Text(
                  item.title,
                  style: TextStyle(
                    fontSize: 18,
                    fontWeight: FontWeight.w700,
                    color: context.textPrimary,
                    height: 1.3,
                  ),
                ),
              ),
              const SizedBox(width: 12),
              _CompletionButton(
                isCompleted: item.isCompleted,
                onToggle: () => onCompletionChanged(!item.isCompleted),
              ),
            ],
          ),
          const SizedBox(height: 8),
          // Subject and category tag badges in a Wrap row to handle overflow.
          Wrap(
            spacing: 6,
            runSpacing: 4,
            children: [
              _buildTag(context, item.subject, const Color(0xFF0078D4)),
              _buildTag(context, item.category, _tagColor(item.category)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _buildTag(BuildContext context, String text, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 2),
      decoration: BoxDecoration(
        color: color.withValues(alpha: 0.1),
        borderRadius: BorderRadius.circular(4),
      ),
      child: Text(
        text,
        style: TextStyle(
          fontSize: 11,
          fontWeight: FontWeight.w600,
          color: color,
        ),
      ),
    );
  }

  /// Maps category names to the same colour palette used by pills & list dots.
  Color _tagColor(String category) {
    switch (category) {
      case 'Outcome':
        return const Color(0xFF34C759);
      case 'Key Knowledge':
        return const Color(0xFF0078D4);
      case 'Key Skill':
        return const Color(0xFFFF9500);
      case 'Command Term':
        return const Color(0xFFAF52DE);
      default:
        return const Color(0xFF8E8E93);
    }
  }

  /// Reusable card for a labelled text section (official or plain-language).
  /// Uses a subtle shadow + left accent bar for visual structure.
  Widget _buildSectionCard(
    BuildContext context,
    String label,
    String text,
    Color bgColor,
    Color borderColor,
    Color textColor,
  ) {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(14),
      decoration: BoxDecoration(
        color: bgColor,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: borderColor, width: 0.5),
        boxShadow: [
          BoxShadow(
            color: Colors.black.withValues(alpha: 0.03),
            blurRadius: 6,
            offset: const Offset(0, 2),
          ),
        ],
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Label row with left accent bar.
          Row(
            children: [
              // Small vertical bar: blue for plain-language, grey for official.
              Container(
                width: 3,
                height: 14,
                decoration: BoxDecoration(
                  color: borderColor == context.plainLanguageBorder
                      ? const Color(0xFF0078D4)
                      : context.textTertiary,
                  borderRadius: BorderRadius.circular(2),
                ),
              ),
              const SizedBox(width: 8),
              // Section label — uses Flexible + overflow ellipsis to prevent
              // horizontal overflow on narrow detail panels.
              Flexible(
                child: Text(
                  label,
                  overflow: TextOverflow.ellipsis,
                  style: TextStyle(
                    fontSize: 11,
                    fontWeight: FontWeight.w700,
                    color: context.textSecondary,
                    letterSpacing: 0.5,
                  ),
                ),
              ),
            ],
          ),
          const SizedBox(height: 10),
          // Body text with generous line height for readability.
          Text(
            text,
            style: TextStyle(
              fontSize: 14,
              color: textColor,
              height: 1.6,
            ),
          ),
        ],
      ),
    );
  }
}

/// Breadcrumb row showing the curriculum hierarchy above the title:
/// "Unit 3: Data analytics  ›  AOS 1  ›  Outcome 1"
class _DetailBreadcrumb extends StatelessWidget {
  final StudyItem item;

  const _DetailBreadcrumb({required this.item});

  @override
  Widget build(BuildContext context) {
    // Build the segment widgets: unit -> AOS -> outcome, separated by "›".
    final parts = <Widget>[
      _crumbPart(context, _shortUnit(item.unit!)),
      if (item.areaOfStudy != null) ...[
        _sep(context),
        _crumbPart(context, _shortAos(item.areaOfStudy!)),
      ],
      if (item.outcome != null) ...[
        _sep(context),
        _crumbPart(context, item.outcome!),
      ],
    ];
    if (parts.isEmpty) return const SizedBox.shrink();

    return Wrap(
      children: parts,
    );
  }

  Widget _crumbPart(BuildContext context, String text) {
    return Text(
      text,
      style: TextStyle(
        fontSize: 11,
        fontWeight: FontWeight.w500,
        color: context.textTertiary,
      ),
    );
  }

  Widget _sep(BuildContext context) {
    return Padding(
      padding: const EdgeInsets.symmetric(horizontal: 4),
      child: Text(
        '›',
        style: TextStyle(
          fontSize: 13,
          color: context.textTertiary,
        ),
      ),
    );
  }

  String _shortUnit(String unit) {
    return unit.replaceAll('Unit ', 'U').replaceAll(': ', ' ');
  }

  String _shortAos(String aos) {
    return aos.replaceAll('Area of Study ', 'AOS ');
  }
}

/// Toggle button with hover effect for the complete/done state.
/// Shows "Complete" (outline) or "Done" (solid green) depending on state.
class _CompletionButton extends StatefulWidget {
  final bool isCompleted;
  final VoidCallback onToggle;

  const _CompletionButton({
    required this.isCompleted,
    required this.onToggle,
  });

  @override
  State<_CompletionButton> createState() => _CompletionButtonState();
}

class _CompletionButtonState extends State<_CompletionButton> {
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    final isCompleted = widget.isCompleted;
    return MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() => _isHovered = false),
      child: GestureDetector(
        onTap: widget.onToggle,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 6),
          decoration: BoxDecoration(
            // Completed = solid green; not completed = neutral fill with border.
            color: isCompleted
                ? const Color(0xFF34C759)
                : context.inactiveBadge,
            borderRadius: BorderRadius.circular(16),
            border: Border.all(
              color: isCompleted
                  ? const Color(0xFF34C759)
                  : _isHovered
                      ? context.borderStrong
                      : context.border,
              width: 0.5,
            ),
            // Green glow when completed.
            boxShadow: isCompleted
                ? [
                    BoxShadow(
                      color: const Color(0xFF34C759).withValues(alpha: 0.2),
                      blurRadius: 6,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : null,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              Icon(
                isCompleted
                    ? Icons.check_circle
                    : Icons.circle_outlined,
                size: 14,
                color: isCompleted
                    ? Colors.white
                    : _isHovered
                        ? context.textPrimary
                        : context.textSecondary,
              ),
              const SizedBox(width: 5),
              Text(
                isCompleted ? 'Done' : 'Complete',
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: FontWeight.w600,
                  color: isCompleted
                      ? Colors.white
                      : _isHovered
                          ? context.textPrimary
                          : context.textSecondary,
                ),
              ),
            ],
          ),
        ),
      ),
    );
  }
}
