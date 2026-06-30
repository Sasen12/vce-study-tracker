import 'package:flutter/material.dart';
import '../theme/forge_theme.dart';

class MoreScreen extends StatefulWidget {
  const MoreScreen({super.key});

  @override
  State<MoreScreen> createState() => _MoreScreenState();
}

class _MoreScreenState extends State<MoreScreen> {
  bool _resetRunning = false;
  int _resetSeconds = 60;

  void _startReset() {
    if (_resetRunning) return;
    setState(() => _resetRunning = true);
    Future.delayed(const Duration(seconds: 1), _tick);
  }

  void _tick() {
    if (!mounted) return;
    if (_resetSeconds > 0) {
      setState(() => _resetSeconds--);
      Future.delayed(const Duration(seconds: 1), _tick);
    } else {
      setState(() {
        _resetRunning = false;
        _resetSeconds = 60;
      });
    }
  }

  void _resetTimer() {
    setState(() {
      _resetRunning = false;
      _resetSeconds = 60;
    });
  }

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: FC.bg,
      body: Padding(
        padding: const EdgeInsets.fromLTRB(36, 36, 36, 36),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('MORE', style: TextStyle(
              color: FC.textTertiary, fontSize: 10, letterSpacing: 1.6,
            )),
            const SizedBox(height: 6),
            const Text('Keep it simple.', style: TextStyle(
              color: FC.textPrimary, fontSize: 34, fontWeight: FontWeight.w700,
            )),
            Text('Main rooms first. Tiny rescue tools underneath.', style: TextStyle(
              color: FC.textSecondary, fontSize: 14,
            )),
            const SizedBox(height: 28),

            // Quick links grid
            GridView.count(
              shrinkWrap: true,
              physics: const NeverScrollableScrollPhysics(),
              crossAxisCount: 3,
              crossAxisSpacing: 14,
              mainAxisSpacing: 14,
              childAspectRatio: 2.4,
              children: const [
                _QuickLink(
                  icon: Icons.insights_rounded,
                  color: Color(0xFF60A5FA),
                  title: 'Insights',
                  subtitle: 'Weak spots and evidence',
                ),
                _QuickLink(
                  icon: Icons.person_rounded,
                  color: Color(0xFF818CF8),
                  title: 'Profile',
                  subtitle: 'Subjects and defaults',
                ),
                _QuickLink(
                  icon: Icons.shopping_bag_rounded,
                  color: Color(0xFFFBBF24),
                  title: 'Shop',
                  subtitle: 'Themes and badges',
                ),
                _QuickLink(
                  icon: Icons.emoji_flags_rounded,
                  color: Color(0xFFF87171),
                  title: 'Guide',
                  subtitle: 'Restart the app tour',
                ),
                _QuickLink(
                  icon: Icons.sports_esports_rounded,
                  color: Color(0xFF34D399),
                  title: 'Chess break',
                  subtitle: 'Short study reset',
                ),
              ],
            ),
            const SizedBox(height: 24),

            // Rescue tools row
            Row(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Expanded(child: _RepairCard()),
                const SizedBox(width: 16),
                Expanded(child: _ResetCard(
                  running: _resetRunning,
                  seconds: _resetSeconds,
                  onStart: _startReset,
                  onReset: _resetTimer,
                )),
              ],
            ),
          ],
        ),
      ),
    );
  }
}

class _QuickLink extends StatelessWidget {
  final IconData icon;
  final Color color;
  final String title;
  final String subtitle;

  const _QuickLink({
    required this.icon,
    required this.color,
    required this.title,
    required this.subtitle,
  });

  @override
  Widget build(BuildContext context) {
    return MouseRegion(
      cursor: SystemMouseCursors.click,
      child: Container(
        padding: const EdgeInsets.all(16),
        decoration: BoxDecoration(
          color: FC.card,
          borderRadius: BorderRadius.circular(14),
          border: Border.all(color: FC.border),
        ),
        child: Row(
          children: [
            Container(
              width: 36,
              height: 36,
              decoration: BoxDecoration(
                color: color.withOpacity(0.15),
                borderRadius: BorderRadius.circular(9),
              ),
              child: Icon(icon, size: 18, color: color),
            ),
            const SizedBox(width: 12),
            Expanded(
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                mainAxisAlignment: MainAxisAlignment.center,
                children: [
                  Text(title, style: const TextStyle(
                    color: FC.textPrimary, fontWeight: FontWeight.w600, fontSize: 14,
                  )),
                  Text(subtitle, style: TextStyle(
                    color: FC.textSecondary, fontSize: 11,
                  ), maxLines: 1, overflow: TextOverflow.ellipsis),
                ],
              ),
            ),
            Icon(Icons.chevron_right_rounded, size: 16, color: FC.textTertiary),
          ],
        ),
      ),
    );
  }
}

class _RepairCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: FC.cardAlt,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: FC.borderStrong),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Row(
            children: [
              Container(
                width: 36,
                height: 36,
                decoration: BoxDecoration(
                  color: FC.redDim,
                  borderRadius: BorderRadius.circular(9),
                ),
                child: Icon(Icons.build_rounded, size: 18, color: FC.red),
              ),
              const SizedBox(width: 12),
              Text('10 MINUTE REPAIR', style: TextStyle(
                color: FC.textTertiary, fontSize: 10, letterSpacing: 1.4,
              )),
            ],
          ),
          const SizedBox(height: 14),
          const Text('Fix one mistake properly.', style: TextStyle(
            color: FC.textPrimary, fontWeight: FontWeight.w700, fontSize: 18,
          )),
          const SizedBox(height: 8),
          Text('Pick a recent mistake, rewrite the rule, then do one similar question.', style: TextStyle(
            color: FC.textSecondary, fontSize: 13, height: 1.5,
          )),
          const SizedBox(height: 20),
          Row(
            children: [
              OutlinedButton.icon(
                onPressed: () {},
                style: OutlinedButton.styleFrom(
                  foregroundColor: FC.textSecondary,
                  side: const BorderSide(color: FC.border),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                icon: const Icon(Icons.add, size: 14),
                label: const Text('New mission', style: TextStyle(fontSize: 13)),
              ),
              const SizedBox(width: 10),
              ElevatedButton(
                onPressed: () {},
                style: ElevatedButton.styleFrom(
                  backgroundColor: FC.accent,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 10),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                child: const Text('Start', style: TextStyle(color: Colors.white, fontSize: 13)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}

class _ResetCard extends StatelessWidget {
  final bool running;
  final int seconds;
  final VoidCallback onStart;
  final VoidCallback onReset;

  const _ResetCard({
    required this.running,
    required this.seconds,
    required this.onStart,
    required this.onReset,
  });

  @override
  Widget build(BuildContext context) {
    final progress = 1.0 - (seconds / 60.0);

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: FC.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: FC.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('60-SECOND RESET', style: TextStyle(
            color: FC.textTertiary, fontSize: 10, letterSpacing: 1.4,
          )),
          const SizedBox(height: 12),
          Text('${seconds}s', style: const TextStyle(
            color: FC.textPrimary, fontSize: 52, fontWeight: FontWeight.w200,
            letterSpacing: -2, height: 1,
          )),
          const SizedBox(height: 8),
          Text('Breathe, unclench, choose one next move.', style: TextStyle(
            color: FC.textSecondary, fontSize: 13, height: 1.5,
          )),
          const SizedBox(height: 16),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: progress,
              minHeight: 6,
              backgroundColor: FC.border,
              valueColor: const AlwaysStoppedAnimation<Color>(FC.green),
            ),
          ),
          const SizedBox(height: 16),
          Row(
            children: [
              ElevatedButton.icon(
                onPressed: running ? null : onStart,
                style: ElevatedButton.styleFrom(
                  backgroundColor: FC.accent,
                  disabledBackgroundColor: FC.cardAlt,
                  elevation: 0,
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                icon: const Icon(Icons.play_arrow_rounded, size: 15, color: Colors.white),
                label: const Text('Start', style: TextStyle(color: Colors.white, fontSize: 13)),
              ),
              const SizedBox(width: 10),
              OutlinedButton(
                onPressed: onReset,
                style: OutlinedButton.styleFrom(
                  foregroundColor: FC.textSecondary,
                  side: const BorderSide(color: FC.border),
                  padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                  shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                ),
                child: const Text('Reset', style: TextStyle(fontSize: 13)),
              ),
            ],
          ),
        ],
      ),
    );
  }
}
