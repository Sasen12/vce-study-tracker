import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

// Small dot colours for each category — shown only when the pill is
// not selected (selected pills fill solid with the accent colour).
const _categoryColors = {
  'Outcome': Color(0xFF34C759),
  'Key Knowledge': Color(0xFF007AFF),
  'Key Skill': Color(0xFFFF9500),
  'Command Term': Color(0xFFAF52DE),
  'SAT Criteria': Color(0xFFFF3B30),
};

/// Horizontally scrollable row of filter pills ("All", "Outcome", …).
///
/// Each pill is a [_CategoryPill] with a subtle tap-scale animation.
/// The currently selected category fills with the accent colour; others
/// show a tinted dot + border.
class CategoryTabs extends StatelessWidget {
  final List<String> categories;
  final String? selectedCategory;
  final ValueChanged<String> onCategorySelected;

  const CategoryTabs({
    super.key,
    required this.categories,
    required this.selectedCategory,
    required this.onCategorySelected,
  });

  @override
  Widget build(BuildContext context) {
    // Horizontal scrollable row of filter pills — scrolls naturally on narrow
    // centre-panel widths, no wrapping needed.
    return Container(
      // Bottom padding (8) creates breathing room before the results header;
      // combined with the search bar's 0 bottom margin, the filter area feels
      // like one contiguous group.
      padding: const EdgeInsets.fromLTRB(16, 6, 16, 8),
      child: SingleChildScrollView(
        scrollDirection: Axis.horizontal,
        child: Row(
          children: categories.map((category) {
            final isSelected = category == selectedCategory;
            // Look up the dot colour; null for "All" which has no colour dot.
            final dotColor = _categoryColors[category];
            return Padding(
              padding: const EdgeInsets.only(right: 8),
              child: _CategoryPill(
                isSelected: isSelected,
                dotColor: dotColor,
                category: category,
                onTap: () => onCategorySelected(category),
              ),
            );
          }).toList(),
        ),
      ),
    );
  }
}

/// Individual category pill with a press-scale animation.
///
/// On pointer-down the pill shrinks to 93 % via [AnimationController];
/// on release (or cancel) it bounces back.  The scale is wrapped around
/// the whole [AnimatedContainer] so the visual "squish" feels tactile.
class _CategoryPill extends StatefulWidget {
  final bool isSelected;
  final Color? dotColor;
  final String category;
  final VoidCallback onTap;

  const _CategoryPill({
    required this.isSelected,
    this.dotColor,
    required this.category,
    required this.onTap,
  });

  @override
  State<_CategoryPill> createState() => _CategoryPillState();
}

class _CategoryPillState extends State<_CategoryPill>
    with SingleTickerProviderStateMixin {
  late AnimationController _scaleController;
  late Animation<double> _scaleAnimation;

  @override
  void initState() {
    super.initState();
    // Set up a 200 ms scale animation from 1.0 → 0.93 for a subtle
    // press-down "squish" feel, using easeOutCubic for a natural deceleration.
    _scaleController = AnimationController(
      duration: const Duration(milliseconds: 200),
      vsync: this,
    );
    _scaleAnimation = Tween<double>(begin: 1.0, end: 0.93).animate(
      CurvedAnimation(parent: _scaleController, curve: Curves.easeOutCubic),
    );
  }

  @override
  void dispose() {
    // Tear down the animation controller to free resources.
    _scaleController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    final dotColor = widget.dotColor;
    final isSelected = widget.isSelected;

    return MouseRegion(
      cursor: SystemMouseCursors.click,
      child: GestureDetector(
        onTap: widget.onTap,
        // Start the "squish" animation on press, reverse on release/cancel.
        onTapDown: (_) => _scaleController.forward(),
        onTapUp: (_) => _scaleController.reverse(),
        onTapCancel: () => _scaleController.reverse(),
        child: AnimatedBuilder(
        animation: _scaleController,
        builder: (context, child) {
          // Apply the live scale value from the animation; child is the
          // AnimatedContainer below, rebuilt only when scale changes.
          return Transform.scale(
            scale: _scaleAnimation.value,
            child: child,
          );
        },
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOutCubic,
          padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 7),
          decoration: BoxDecoration(
            // Selected pill gets a solid blue fill; unselected gets the
            // neutral fillBg colour with a dot indicator.
            color: isSelected
                ? const Color(0xFF0078D4)
                : context.inactiveBadge,
            borderRadius: BorderRadius.circular(20),
            border: Border.all(
              color: isSelected
                  ? const Color(0xFF0078D4)
                  : context.border,
              width: 0.5,
            ),
            // Soft blue glow behind the selected pill.
            boxShadow: isSelected
                ? [
                    BoxShadow(
                      color: const Color(0xFF0078D4).withValues(alpha: 0.15),
                      blurRadius: 6,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : null,
          ),
          child: Row(
            mainAxisSize: MainAxisSize.min,
            children: [
              // Colour dot — only visible when NOT selected (selected = solid fill).
              if (dotColor != null && !isSelected)
                Container(
                  width: 6,
                  height: 6,
                  decoration: BoxDecoration(
                    color: dotColor,
                    shape: BoxShape.circle,
                  ),
                ),
              if (dotColor != null && !isSelected)
                const SizedBox(width: 6),
              Text(
                widget.category,
                style: TextStyle(
                  fontSize: 12,
                  fontWeight: isSelected ? FontWeight.w600 : FontWeight.w500,
                  // White text on the solid blue selected pill; normal text
                  // colour when unselected.
                  color: isSelected
                      ? Colors.white
                      : context.textPrimary,
                ),
              ),
            ],
          ),
        ),
      ),
    ),
  );
  }
}


