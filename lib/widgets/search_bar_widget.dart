import 'package:flutter/material.dart';
import '../theme/app_colors.dart';

/// macOS-style search field with a clear button and focus highlight.
///
/// Lives in the centre column, directly above the category pills.
/// Filtering is handled externally via [onChanged]; this widget only
/// displays the text field and a conditional suffix close icon.
class SearchBarWidget extends StatefulWidget {
  final TextEditingController controller;
  final ValueChanged<String> onChanged;

  const SearchBarWidget({
    super.key,
    required this.controller,
    required this.onChanged,
  });

  @override
  State<SearchBarWidget> createState() => _SearchBarWidgetState();
}

class _SearchBarWidgetState extends State<SearchBarWidget> {
  // Tracks focus so we can tint the border blue when the user is typing.
  late FocusNode _focusNode;
  bool _isFocused = false;

  @override
  void initState() {
    super.initState();
    // Create a FocusNode and listen for focus changes to drive the border colour.
    _focusNode = FocusNode();
    _focusNode.addListener(() {
      setState(() => _isFocused = _focusNode.hasFocus);
    });
  }

  @override
  void dispose() {
    // Must dispose FocusNode to avoid memory leaks.
    _focusNode.dispose();
    super.dispose();
  }

  @override
  Widget build(BuildContext context) {
    // AnimatedContainer smoothly transitions between focused/unfocused states:
    // thicker blue border + glow shadow when focused, thin grey border when not.
    return AnimatedContainer(
      duration: const Duration(milliseconds: 200),
      curve: Curves.easeOutCubic,
      // Tight margin to group the search field close to the category pills below.
      margin: const EdgeInsets.fromLTRB(16, 12, 16, 0),
      decoration: BoxDecoration(
        color: context.searchBg,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(
          color: _isFocused ? const Color(0xFF0078D4) : context.searchBorder,
          width: _isFocused ? 1.5 : 0.5,
        ),
        // Subtle blue glow on focus — matches the accent colour.
        boxShadow: _isFocused
            ? [
                BoxShadow(
                  color: const Color(0xFF0078D4).withValues(alpha: 0.08),
                  blurRadius: 6,
                  offset: const Offset(0, 2),
                ),
              ]
            : null,
      ),
      child: TextField(
        focusNode: _focusNode,
        controller: widget.controller,
        onChanged: widget.onChanged,
        decoration: InputDecoration(
          hintText: 'Search outcomes, key knowledge, skills...',
          hintStyle: TextStyle(fontSize: 13, color: context.textSecondary),
          // Magnifying glass icon on the left.
          prefixIcon: Padding(
            padding: const EdgeInsets.only(left: 12, right: 8),
            child: Icon(Icons.search, size: 18, color: context.textSecondary),
          ),
          // Conditional close (X) button — only appears when text is non-empty.
          suffixIcon: widget.controller.text.isNotEmpty
              ? MouseRegion(
                  cursor: SystemMouseCursors.click,
                  child: GestureDetector(
                    onTap: () {
                      // Clear the field and immediately notify the parent
                      // so the result list resets to the unfiltered view.
                      widget.controller.clear();
                      widget.onChanged('');
                    },
                    child: Padding(
                      padding: const EdgeInsets.only(right: 12),
                      child: Icon(Icons.close, size: 16, color: context.textSecondary),
                    ),
                  ),
                )
              : null,
          // Remove the default underline — our container's border handles it.
          border: InputBorder.none,
          contentPadding: const EdgeInsets.symmetric(vertical: 11),
        ),
        style: TextStyle(fontSize: 13, color: context.textPrimary),
      ),
    );
  }
}
