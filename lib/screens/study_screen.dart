import 'dart:async';
import 'package:flutter/material.dart';
import '../theme/forge_theme.dart';

class StudyScreen extends StatefulWidget {
  const StudyScreen({super.key});

  @override
  State<StudyScreen> createState() => _StudyScreenState();
}

class _StudyScreenState extends State<StudyScreen> {
  static const _totalSecs = 25 * 60;
  int _secsLeft = _totalSecs;
  bool _running = false;
  Timer? _timer;
  int _tab = 0;
  int _preset = 1;

  static const _tabs = ['Timer', 'Coach', 'Questions', 'Notes', 'Files', 'Calc'];

  static const _presets = [
    _Preset('Sprint', '12m · one topic', Icons.rocket_launch_rounded),
    _Preset('Deep work', '50m · check-ins on', Icons.psychology_rounded),
    _Preset('External work', 'Folio / Word / SAT', Icons.open_in_new_rounded),
  ];

  @override
  void dispose() {
    _timer?.cancel();
    super.dispose();
  }

  void _toggleTimer() {
    if (_running) {
      _timer?.cancel();
    } else {
      _timer = Timer.periodic(const Duration(seconds: 1), (_) {
        if (_secsLeft > 0) {
          setState(() => _secsLeft--);
        } else {
          _timer?.cancel();
          setState(() => _running = false);
        }
      });
    }
    setState(() => _running = !_running);
  }

  void _finish() {
    _timer?.cancel();
    setState(() {
      _running = false;
      _secsLeft = _totalSecs;
    });
  }

  String get _display {
    final m = _secsLeft ~/ 60;
    final s = _secsLeft % 60;
    return '${m.toString().padLeft(2, '0')}:${s.toString().padLeft(2, '0')}';
  }

  double get _progress => 1.0 - (_secsLeft / _totalSecs);

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: FC.bg,
      body: Row(
        children: [
          Expanded(
            child: Padding(
              padding: const EdgeInsets.fromLTRB(36, 36, 24, 36),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text('STUDY TIMER', style: TextStyle(
                    color: FC.textTertiary, fontSize: 10, letterSpacing: 1.6,
                  )),
                  const SizedBox(height: 6),
                  const Text('Deep work', style: TextStyle(
                    color: FC.textPrimary, fontSize: 34, fontWeight: FontWeight.w700,
                  )),
                  const SizedBox(height: 22),
                  _buildTabs(),
                  const SizedBox(height: 22),
                  Expanded(child: _buildTimerCard()),
                ],
              ),
            ),
          ),
          _buildRightPanel(),
        ],
      ),
    );
  }

  Widget _buildTabs() {
    return SingleChildScrollView(
      scrollDirection: Axis.horizontal,
      child: Row(
        children: List.generate(_tabs.length, (i) {
          final sel = i == _tab;
          return GestureDetector(
            onTap: () => setState(() => _tab = i),
            child: MouseRegion(
              cursor: SystemMouseCursors.click,
              child: Container(
                margin: const EdgeInsets.only(right: 6),
                padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 8),
                decoration: BoxDecoration(
                  color: sel ? FC.accent : FC.card,
                  borderRadius: BorderRadius.circular(8),
                  border: Border.all(color: sel ? FC.accent : FC.border),
                ),
                child: Text(_tabs[i], style: TextStyle(
                  color: sel ? Colors.white : FC.textSecondary,
                  fontSize: 13,
                  fontWeight: sel ? FontWeight.w600 : FontWeight.w400,
                )),
              ),
            ),
          );
        }),
      ),
    );
  }

  Widget _buildTimerCard() {
    return Container(
      width: double.infinity,
      padding: const EdgeInsets.all(32),
      decoration: BoxDecoration(
        color: FC.card,
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: FC.borderStrong),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Subject row
          Row(
            children: [
              Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Container(
                    padding: const EdgeInsets.symmetric(horizontal: 8, vertical: 3),
                    decoration: BoxDecoration(
                      color: FC.greenDim,
                      borderRadius: BorderRadius.circular(4),
                    ),
                    child: Text('LOCKED IN', style: TextStyle(
                      color: FC.green, fontSize: 9, fontWeight: FontWeight.w700, letterSpacing: 1.3,
                    )),
                  ),
                  const SizedBox(height: 8),
                  const Text('Mathematical Methods', style: TextStyle(
                    color: FC.textPrimary, fontSize: 18, fontWeight: FontWeight.w700,
                  )),
                  Text('Differentiation drill · 25m target', style: TextStyle(
                    color: FC.textSecondary, fontSize: 13,
                  )),
                ],
              ),
              const Spacer(),
              Container(
                padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 8),
                decoration: BoxDecoration(
                  color: FC.greenDim,
                  borderRadius: BorderRadius.circular(20),
                  border: Border.all(color: FC.green.withOpacity(0.3)),
                ),
                child: Row(
                  children: [
                    Icon(Icons.remove_red_eye_rounded, size: 13, color: FC.green),
                    const SizedBox(width: 6),
                    Text('Focus on', style: TextStyle(
                      color: FC.green, fontWeight: FontWeight.w600, fontSize: 13,
                    )),
                  ],
                ),
              ),
            ],
          ),
          const Spacer(),

          // Timer display - centred
          Center(
            child: Text(_display, style: const TextStyle(
              color: FC.textPrimary,
              fontSize: 100,
              fontWeight: FontWeight.w200,
              letterSpacing: -4,
              height: 1,
            )),
          ),
          const SizedBox(height: 28),

          // Progress bar
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: LinearProgressIndicator(
              value: _progress,
              minHeight: 6,
              backgroundColor: FC.border,
              valueColor: const AlwaysStoppedAnimation<Color>(FC.accent),
            ),
          ),
          const SizedBox(height: 8),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              Text('Time remaining', style: TextStyle(color: FC.textSecondary, fontSize: 12)),
              Text(
                '${_secsLeft ~/ 60}:${(_secsLeft % 60).toString().padLeft(2, '0')}',
                style: TextStyle(color: FC.textSecondary, fontSize: 12),
              ),
            ],
          ),
          const SizedBox(height: 20),

          // Badges
          Wrap(
            spacing: 8,
            children: [
              _badge('120 XP est.', FC.textSecondary),
              _badge('Check-ins every 10m', FC.green),
              _badge('+16 bonus XP', FC.amber),
            ],
          ),
          const SizedBox(height: 28),

          // Buttons
          Row(
            children: [
              Expanded(
                child: _ActionBtn(
                  label: _running ? 'Pause' : 'Start',
                  icon: _running ? Icons.pause_rounded : Icons.play_arrow_rounded,
                  color: FC.accent,
                  onTap: _toggleTimer,
                ),
              ),
              const SizedBox(width: 12),
              Expanded(
                child: _ActionBtn(
                  label: 'Finish',
                  icon: Icons.stop_rounded,
                  color: FC.red,
                  onTap: _finish,
                ),
              ),
            ],
          ),
        ],
      ),
    );
  }

  Widget _badge(String label, Color color) {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 10, vertical: 5),
      decoration: BoxDecoration(
        color: color.withOpacity(0.12),
        borderRadius: BorderRadius.circular(20),
        border: Border.all(color: color.withOpacity(0.3)),
      ),
      child: Text(label, style: TextStyle(color: color, fontSize: 12, fontWeight: FontWeight.w500)),
    );
  }

  Widget _buildRightPanel() {
    return Container(
      width: 250,
      decoration: const BoxDecoration(
        color: FC.navBg,
        border: Border(left: BorderSide(color: FC.border)),
      ),
      padding: const EdgeInsets.fromLTRB(20, 36, 20, 36),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          const SizedBox(height: 68),
          Text('SESSION PRESETS', style: TextStyle(
            color: FC.textTertiary, fontSize: 10, letterSpacing: 1.6,
          )),
          const SizedBox(height: 12),
          ...List.generate(_presets.length, (i) {
            final p = _presets[i];
            final sel = i == _preset;
            return GestureDetector(
              onTap: () => setState(() => _preset = i),
              child: Container(
                margin: const EdgeInsets.only(bottom: 8),
                padding: const EdgeInsets.all(14),
                decoration: BoxDecoration(
                  color: sel ? FC.card : Colors.transparent,
                  borderRadius: BorderRadius.circular(10),
                  border: Border.all(color: sel ? FC.borderStrong : Colors.transparent),
                ),
                child: Row(
                  children: [
                    Icon(p.icon, size: 16, color: sel ? FC.accent : FC.textTertiary),
                    const SizedBox(width: 10),
                    Expanded(
                      child: Column(
                        crossAxisAlignment: CrossAxisAlignment.start,
                        children: [
                          Text(p.name, style: TextStyle(
                            color: FC.textPrimary, fontWeight: FontWeight.w600, fontSize: 13,
                          )),
                          Text(p.desc, style: TextStyle(color: FC.textSecondary, fontSize: 11)),
                        ],
                      ),
                    ),
                  ],
                ),
              ),
            );
          }),
          const SizedBox(height: 24),
          Text('THIS SUBJECT, THIS WEEK', style: TextStyle(
            color: FC.textTertiary, fontSize: 10, letterSpacing: 1.6,
          )),
          const SizedBox(height: 14),
          Row(
            children: [
              Expanded(child: _weekStat('3h 40m', 'logged')),
              Expanded(child: _weekStat('52m', 'best block')),
            ],
          ),
        ],
      ),
    );
  }

  Widget _weekStat(String value, String label) {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text(value, style: const TextStyle(
          color: FC.textPrimary, fontWeight: FontWeight.w700, fontSize: 22,
        )),
        Text(label, style: TextStyle(color: FC.textSecondary, fontSize: 12)),
      ],
    );
  }
}

class _ActionBtn extends StatelessWidget {
  final String label;
  final IconData icon;
  final Color color;
  final VoidCallback onTap;

  const _ActionBtn({
    required this.label,
    required this.icon,
    required this.color,
    required this.onTap,
  });

  @override
  Widget build(BuildContext context) {
    return GestureDetector(
      onTap: onTap,
      child: MouseRegion(
        cursor: SystemMouseCursors.click,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 16),
          decoration: BoxDecoration(
            color: color,
            borderRadius: BorderRadius.circular(12),
          ),
          child: Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              Icon(icon, color: Colors.white, size: 20),
              const SizedBox(width: 8),
              Text(label, style: const TextStyle(
                color: Colors.white, fontWeight: FontWeight.w600, fontSize: 15,
              )),
            ],
          ),
        ),
      ),
    );
  }
}

class _Preset {
  final String name;
  final String desc;
  final IconData icon;
  const _Preset(this.name, this.desc, this.icon);
}
