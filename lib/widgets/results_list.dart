import 'package:flutter/material.dart';
import '../models/study_item.dart';
import '../theme/app_colors.dart';

// Category dot colours — matches [_CategoryPill] so the list and pills agree.
const _categoryColors = {
  'Outcome': Color(0xFF34C759),
  'Key Knowledge': Color(0xFF007AFF),
  'Key Skill': Color(0xFFFF9500),
  'Command Term': Color(0xFFAF52DE),
  'SAT Criteria': Color(0xFFFF3B30),
};

/// Scrollable card list in the centre column.
///
/// Each card shows a colour-dot, title, category badge, subject label,
/// and an optional completion checkmark with an elastic pop animation.
/// Items are wrapped in [_ScrollRevealItem] for a scroll-triggered entrance.
///
/// An empty-state illustration is shown when [_filteredItems] is empty.
class ResultsList extends StatefulWidget {
  final List<StudyItem> items;
  final StudyItem? selectedItem;
  final ValueChanged<StudyItem> onItemSelected;
  final ValueChanged<bool>? onCompletionChanged;
  final int generation;

  const ResultsList({
    super.key,
    required this.items,
    required this.selectedItem,
    required this.onItemSelected,
    this.onCompletionChanged,
    this.generation = 0,
  });

  @override
  State<ResultsList> createState() => _ResultsListState();
}

class _ResultsListState extends State<ResultsList> {
  // Controls scroll position — used by the enclosing Scrollbar and for
  // scroll-driven entrance animations in child items.
  final _scrollController = ScrollController();

  @override
  void dispose() {
    _scrollController.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // Empty state: show a centred illustration with search_off icon + hint.
    if (widget.items.isEmpty) {
      return Center(
        child: Padding(
          padding: const EdgeInsets.all(40),
          child: Column(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(
                Icons.search_off,
                size: 40,
                color: context.textTertiary,
              ),
              const SizedBox(height: 12),
              Text(
                'No results found',
                style: TextStyle(
                  fontSize: 15,
                  fontWeight: FontWeight.w600,
                  color: context.textPrimary,
                ),
              ),
              const SizedBox(height: 4),
              Text(
                'Try a different search or category.',
                style: TextStyle(
                  fontSize: 13,
                  color: context.textSecondary,
                ),
              ),
            ],
          ),
        ),
      );
    }

    return Scrollbar(
      controller: _scrollController,
      child: ListView.separated(
        controller: _scrollController,
        padding: const EdgeInsets.fromLTRB(12, 8, 12, 8),
        itemCount: widget.items.length,
        separatorBuilder: (_, __) => const SizedBox(height: 4),
        itemBuilder: (context, index) {
          final item = widget.items[index];
          final isSelected = item.id == widget.selectedItem?.id;
          // Look up the category colour; fall back to neutral grey for
          // unrecognised categories.
          final catColor = _categoryColors[item.category] ?? const Color(0xFF8E8E93);

          return _ScrollRevealItem(
            // Include generation in the key so the animation resets on filter change.
            key: ValueKey('${item.id}_${widget.generation}'),
            index: index,
            child: _ResultCard(
              item: item,
              isSelected: isSelected,
              catColor: catColor,
              onTap: () => widget.onItemSelected(item),
              onCompletionChanged: widget.onCompletionChanged,
            ),
          );
        },
      ),
    );
  }
}

/// Wraps a widget in a fade + slide + scale entrance animation that
/// triggers when the item scrolls into the viewport.
///
/// Items above the fold cascade in (staggered by [index]); items below
/// animate when the user scrolls them into view.  The scale uses an
/// easeOutBack curve for a subtle overshoot "pop" like those slick
/// scroll-driven websites.
class _ScrollRevealItem extends StatefulWidget {
  final Widget child;
  final int index;

  const _ScrollRevealItem({super.key, required this.child, required this.index});

  @override
  State<_ScrollRevealItem> createState() => _ScrollRevealItemState();
}

class _ScrollRevealItemState extends State<_ScrollRevealItem>
    with SingleTickerProviderStateMixin {
  // Animation controller for the reveal effect (fade + slide + pop).
  late AnimationController _controller;
  late Animation<double> _fadeAnim;
  late Animation<double> _slideAnim;
  late Animation<double> _popAnim;
  // The scroll position we're listening to for visibility checks.
  late ScrollPosition _scrollPosition;
  // Ensures the animation only fires once per item lifecycle.
  bool _hasTriggered = false;

  @override
  void initState() {
    super.initState();
    // 500 ms total animation for each item.
    _controller = AnimationController(
      duration: const Duration(milliseconds: 500),
      vsync: this,
    );
    // Fade: simple ease-out curve.
    _fadeAnim = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOut,
    );
    // Slide: moves from 8 px below to final position with a smooth cubic.
    _slideAnim = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOutCubic,
    );
    // Scale: easeOutBack gives a tiny overshoot for the "pop" feel.
    _popAnim = CurvedAnimation(
      parent: _controller,
      curve: Curves.easeOutBack,
    );

    // After the first frame, attach the scroll listener and check visibility.
    WidgetsBinding.instance.addPostFrameCallback((_) {
      _attachScrollListener();
    });
  }

  void _attachScrollListener() {
    if (!mounted) return;
    // Get the scroll position from the nearest Scrollable ancestor.
    _scrollPosition = Scrollable.of(context).position;
    _scrollPosition.addListener(_onScroll);
    // Immediate check in case the item is already visible.
    _checkVisibility();
  }

  void _onScroll() {
    if (_hasTriggered) return; // Already triggered — ignore.
    _checkVisibility();
  }

  void _checkVisibility() {
    // Get the render box to calculate the item's global Y position.
    final renderBox = context.findRenderObject() as RenderBox?;
    if (renderBox == null || !renderBox.attached) return;

    // Item's top edge relative to the viewport top.
    final itemTop = renderBox.localToGlobal(Offset.zero).dy;
    final viewportHeight = MediaQuery.of(context).size.height;

    // Trigger when the item enters the viewport bottom (60 px anticipation
    // so items feel like they "cascade in" before the user scrolls fully past).
    if (itemTop < viewportHeight - 60) {
      _hasTriggered = true;
      // Remove the scroll listener to avoid unnecessary checks.
      _scrollPosition.removeListener(_onScroll);
      // Stagger by index: each item starts 40 ms after the previous one.
      Future.delayed(Duration(milliseconds: widget.index * 40), () {
        if (mounted) _controller.forward();
      });
    }
  }

  @override
  void dispose() {
    // Always clean up the listener to prevent memory leaks.
    if (_hasTriggered) _scrollPosition.removeListener(_onScroll);
    _controller.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    return AnimatedBuilder(
      animation: _controller,
      builder: (context, child) {
        // Compose all three transforms on every animation tick.
        final fade = _fadeAnim.value;
        final slide = _slideAnim.value;
        final pop = _popAnim.value;
        return Opacity(
          opacity: fade,
          child: Transform.translate(
            offset: Offset(0, 8 * (1 - slide)),
            child: Transform.scale(
              scale: 0.95 + (0.05 * pop),
              child: child,
            ),
          ),
        );
      },
      child: widget.child,
    );
  }
}

/// Result card with hover state — subtle background shift on mouse enter/exit.
class _ResultCard extends StatefulWidget {
  final StudyItem item;
  final bool isSelected;
  final Color catColor;
  final VoidCallback onTap;
  final ValueChanged<bool>? onCompletionChanged;

  const _ResultCard({
    required this.item,
    required this.isSelected,
    required this.catColor,
    required this.onTap,
    this.onCompletionChanged,
  });

  @override
  State<_ResultCard> createState() => _ResultCardState();
}

class _ResultCardState extends State<_ResultCard> {
  // Tracks mouse hover for subtle background colour shift.
  bool _isHovered = false;

  @override
  Widget build(BuildContext context) {
    final item = widget.item;
    final isSelected = widget.isSelected;
    final catColor = widget.catColor;

    return MouseRegion(
      cursor: SystemMouseCursors.click,
      onEnter: (_) => setState(() => _isHovered = true),
      onExit: (_) => setState(() => _isHovered = false),
      child: GestureDetector(
        onTap: widget.onTap,
        child: AnimatedContainer(
          duration: const Duration(milliseconds: 200),
          curve: Curves.easeOutCubic,
          padding: const EdgeInsets.all(12),
          decoration: BoxDecoration(
            // Selected = blue tint; hovered = subtle dark/light shift;
            // default = card background.
            color: isSelected
                ? context.selectedBg
                : _isHovered
                    ? (context.isDark
                        ? const Color(0xFF252525)
                        : const Color(0xFFF5F5F7))
                    : context.cardBg,
            borderRadius: BorderRadius.circular(10),
            border: Border.all(
              color: isSelected
                  ? const Color(0xFF0078D4)
                  : _isHovered
                      ? context.borderStrong
                      : context.border,
              width: isSelected ? 1.5 : 0.5,
            ),
            // Blue glow on selected cards.
            boxShadow: isSelected
                ? [
                    BoxShadow(
                      color: const Color(0xFF0078D4).withValues(alpha: 0.08),
                      blurRadius: 8,
                      offset: const Offset(0, 2),
                    ),
                  ]
                : null,
          ),
          child: Row(
            crossAxisAlignment: CrossAxisAlignment.start,
            children: [
              // Category colour dot.
              Container(
                margin: const EdgeInsets.only(top: 2),
                width: 10,
                height: 10,
                decoration: BoxDecoration(
                  color: catColor,
                  shape: BoxShape.circle,
                ),
              ),
              const SizedBox(width: 10),
              // Title + category badge + subject + optional breadcrumb.
              Expanded(
                child: Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text(
                      item.title,
                      style: TextStyle(
                        fontSize: 13,
                        fontWeight: FontWeight.w600,
                        // Selected title turns blue for colour-coding.
                        color: isSelected
                            ? const Color(0xFF0078D4)
                            : context.textPrimary,
                      ),
                    ),
                    const SizedBox(height: 3),
                    // Row of category badge + subject label.
                    Row(
                      children: [
                        // Coloured category badge.
                        Container(
                          padding: const EdgeInsets.symmetric(
                            horizontal: 6,
                            vertical: 1,
                          ),
                          decoration: BoxDecoration(
                            color: catColor.withValues(alpha: 0.1),
                            borderRadius: BorderRadius.circular(4),
                          ),
                          child: Text(
                            item.category,
                            style: TextStyle(
                              fontSize: 10,
                              fontWeight: FontWeight.w600,
                              color: catColor,
                            ),
                          ),
                        ),
                        const SizedBox(width: 6),
                        // Subject name — wrapped in Flexible to prevent
                        // overflow on narrow centre panels.
                        Flexible(
                          child: Text(
                            item.subject,
                            overflow: TextOverflow.ellipsis,
                            style: TextStyle(
                              fontSize: 10,
                              color: context.textSecondary,
                            ),
                          ),
                        ),
                      ],
                    ),
                    // Optional curriculum breadcrumb (unit > AOS > outcome).
                    if (item.unit != null) ...[
                      const SizedBox(height: 2),
                      _HierarchyBreadcrumb(item: item),
                    ],
                  ],
                ),
              ),
              // Completion checkmark or empty circle on the right edge.
              // Tapping toggles completion directly without selecting the item.
              if (item.isCompleted)
                // Green filled circle with white check — elastic pop on appear.
                MouseRegion(
                  cursor: SystemMouseCursors.click,
                  child: GestureDetector(
                    onTap: () => widget.onCompletionChanged
                        ?.call(!item.isCompleted),
                    child: TweenAnimationBuilder<double>(
                      // Key includes isCompleted so the animation re-triggers
                      // when toggled back from incomplete to complete.
                      key: ValueKey('check_${item.id}_${item.isCompleted}'),
                      tween: Tween(begin: 0.0, end: 1.0),
                      duration: const Duration(milliseconds: 300),
                      curve: Curves.elasticOut,
                      builder: (context, value, child) {
                        return Transform.scale(
                          scale: value,
                          child: child,
                        );
                      },
                      child: Container(
                        width: 22,
                        height: 22,
                        decoration: const BoxDecoration(
                          color: Color(0xFF34C759),
                          shape: BoxShape.circle,
                        ),
                        child: const Icon(
                          Icons.check,
                          size: 14,
                          color: Colors.white,
                        ),
                      ),
                    ),
                  ),
                )
              else
                // Empty circle outline — tappable to mark as complete.
                MouseRegion(
                  cursor: SystemMouseCursors.click,
                  child: GestureDetector(
                    onTap: () => widget.onCompletionChanged
                        ?.call(!item.isCompleted),
                    child: Container(
                      width: 22,
                      height: 22,
                      decoration: BoxDecoration(
                        shape: BoxShape.circle,
                        border: Border.all(
                          color: context.textTertiary,
                          width: 1.5,
                        ),
                      ),
                      // Invisible check icon keeps the layout stable so the
                      // circle doesn't shift when the checkmark appears.
                      child: Icon(
                        Icons.check,
                        size: 14,
                        color: Colors.transparent,
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

/// A small grey breadcrumb showing the curriculum hierarchy, e.g.
/// "Unit 3: Data analytics > AOS 1 > Outcome 1".
class _HierarchyBreadcrumb extends StatelessWidget {
  final StudyItem item;

  const _HierarchyBreadcrumb({required this.item});

  @override
  Widget build(BuildContext context) {
    // Build the segment list: unit -> AOS -> outcome.
    final parts = <String>[
      if (item.unit != null) _shortUnit(item.unit!),
      if (item.areaOfStudy != null) _shortAos(item.areaOfStudy!),
      if (item.outcome != null) item.outcome!,
    ];
    // If no hierarchy data is present, render nothing (not even an empty box).
    if (parts.isEmpty) return const SizedBox.shrink();

    // Join segments with a spaced guillemet separator.
    final label = parts.join('  ›  ');
    return Text(
      label,
      style: TextStyle(
        fontSize: 10,
        color: context.textTertiary,
        height: 1.3,
      ),
    );
  }

  // Shorten "Unit 3: Software development" → "U3 Software development".
  String _shortUnit(String unit) {
    return unit.replaceAll('Unit ', 'U').replaceAll(': ', ' ');
  }

  // Shorten "Area of Study 1" → "AOS 1".
  String _shortAos(String aos) {
    return aos.replaceAll('Area of Study ', 'AOS ');
  }
}
