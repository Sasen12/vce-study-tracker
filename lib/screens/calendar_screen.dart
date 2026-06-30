import 'package:flutter/material.dart';
import '../theme/forge_theme.dart';
import '../data/forge_data.dart';
import '../models/forge_models.dart';

class CalendarScreen extends StatefulWidget {
  const CalendarScreen({super.key});

  @override
  State<CalendarScreen> createState() => _CalendarScreenState();
}

class _CalendarScreenState extends State<CalendarScreen> {
  final _now = DateTime.now();
  late DateTime _month;

  @override
  void initState() {
    super.initState();
    _month = DateTime(_now.year, _now.month, 1);
  }

  static const _monthNames = [
    'January', 'February', 'March', 'April', 'May', 'June',
    'July', 'August', 'September', 'October', 'November', 'December',
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: FC.bg,
      body: Padding(
        padding: const EdgeInsets.fromLTRB(36, 36, 36, 36),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            // Header
            Row(
              crossAxisAlignment: CrossAxisAlignment.end,
              children: [
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    Text('CALENDAR', style: TextStyle(
                      color: FC.textTertiary, fontSize: 10, letterSpacing: 1.6,
                    )),
                    const SizedBox(height: 6),
                    const Text('Assessment radar', style: TextStyle(
                      color: FC.textPrimary, fontSize: 34, fontWeight: FontWeight.w700,
                    )),
                  ],
                ),
                const Spacer(),
                OutlinedButton.icon(
                  onPressed: () {},
                  style: OutlinedButton.styleFrom(
                    foregroundColor: FC.textSecondary,
                    side: const BorderSide(color: FC.border),
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  icon: const Icon(Icons.timer_rounded, size: 14),
                  label: const Text('Study time', style: TextStyle(fontSize: 13)),
                ),
                const SizedBox(width: 10),
                ElevatedButton.icon(
                  onPressed: () {},
                  style: ElevatedButton.styleFrom(
                    backgroundColor: FC.accent,
                    elevation: 0,
                    padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 10),
                    shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
                  ),
                  icon: const Icon(Icons.add, size: 14, color: Colors.white),
                  label: const Text('Add assessment',
                      style: TextStyle(color: Colors.white, fontSize: 13)),
                ),
              ],
            ),
            const SizedBox(height: 28),
            Expanded(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Expanded(
                    child: Column(
                      children: [
                        _buildPressureCard(),
                        const SizedBox(height: 16),
                        Expanded(child: _buildCalendar()),
                      ],
                    ),
                  ),
                  const SizedBox(width: 24),
                  SizedBox(width: 270, child: _buildUpcoming()),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }

  Widget _buildPressureCard() {
    return Container(
      padding: const EdgeInsets.symmetric(horizontal: 24, vertical: 20),
      decoration: BoxDecoration(
        color: FC.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: FC.border),
      ),
      child: Row(
        children: [
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                const Text('Assessment pressure', style: TextStyle(
                  color: FC.textPrimary, fontWeight: FontWeight.w700, fontSize: 16,
                )),
                const SizedBox(height: 4),
                Text('Next: Methods SAC in 3 days', style: TextStyle(
                  color: FC.textSecondary, fontSize: 13,
                )),
              ],
            ),
          ),
          _pressureStat('0', 'today'),
          const SizedBox(width: 28),
          _pressureStat('2', 'next 7 days'),
          const SizedBox(width: 28),
          _pressureStat('6', 'upcoming'),
        ],
      ),
    );
  }

  Widget _pressureStat(String value, String label) {
    return Column(
      children: [
        Text(value, style: const TextStyle(
          color: FC.textPrimary, fontSize: 30, fontWeight: FontWeight.w700,
        )),
        Text(label, style: TextStyle(color: FC.textSecondary, fontSize: 12)),
      ],
    );
  }

  Widget _buildCalendar() {
    final daysInMonth = DateUtils.getDaysInMonth(_month.year, _month.month);
    final firstDay = DateTime(_month.year, _month.month, 1);
    // Mon-first offset (Mon=1 → offset 0, Tue=2 → offset 1, ..., Sun=7 → offset 6)
    final offset = (firstDay.weekday - 1) % 7;

    // Assessment dates as Set for quick lookup
    final assessmentDates = {
      for (final a in assessments) '${a.date.year}-${a.date.month}-${a.date.day}',
    };

    return Container(
      padding: const EdgeInsets.all(24),
      decoration: BoxDecoration(
        color: FC.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: FC.border),
      ),
      child: Column(
        children: [
          // Month nav
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              IconButton(
                icon: Icon(Icons.chevron_left_rounded, color: FC.textSecondary),
                onPressed: () => setState(() =>
                    _month = DateTime(_month.year, _month.month - 1, 1)),
              ),
              Text('${_monthNames[_month.month - 1]} ${_month.year}',
                  style: const TextStyle(
                    color: FC.textPrimary, fontWeight: FontWeight.w600, fontSize: 16,
                  )),
              IconButton(
                icon: Icon(Icons.chevron_right_rounded, color: FC.textSecondary),
                onPressed: () => setState(() =>
                    _month = DateTime(_month.year, _month.month + 1, 1)),
              ),
            ],
          ),
          const SizedBox(height: 8),
          // Weekday headers
          Row(
            children: ['M', 'T', 'W', 'T', 'F', 'S', 'S'].map((d) => Expanded(
              child: Center(
                child: Text(d, style: TextStyle(color: FC.textTertiary, fontSize: 12)),
              ),
            )).toList(),
          ),
          const SizedBox(height: 8),
          // Day grid
          Expanded(
            child: GridView.builder(
              physics: const NeverScrollableScrollPhysics(),
              gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                crossAxisCount: 7,
                mainAxisSpacing: 2,
                crossAxisSpacing: 2,
              ),
              itemCount: 42,
              itemBuilder: (context, idx) {
                final dayNum = idx - offset + 1;
                if (dayNum < 1 || dayNum > daysInMonth) return const SizedBox();
                final date = DateTime(_month.year, _month.month, dayNum);
                final isToday = DateUtils.isSameDay(date, _now);
                final key = '${date.year}-${date.month}-${date.day}';
                final hasAssessment = assessmentDates.contains(key);
                final hasStudy = [3, 9, 12, 18, 24].contains(dayNum) && _month.month == _now.month;

                return Column(
                  mainAxisAlignment: MainAxisAlignment.center,
                  children: [
                    Container(
                      width: 30,
                      height: 30,
                      decoration: BoxDecoration(
                        color: isToday ? FC.accent : Colors.transparent,
                        shape: BoxShape.circle,
                      ),
                      child: Center(
                        child: Text('$dayNum', style: TextStyle(
                          color: isToday ? Colors.white : FC.textSecondary,
                          fontSize: 13,
                          fontWeight: isToday ? FontWeight.w700 : FontWeight.w400,
                        )),
                      ),
                    ),
                    const SizedBox(height: 2),
                    Row(
                      mainAxisAlignment: MainAxisAlignment.center,
                      children: [
                        if (hasStudy) _dot(FC.green),
                        if (hasStudy && hasAssessment) const SizedBox(width: 2),
                        if (hasAssessment) _dot(FC.amber),
                      ],
                    ),
                  ],
                );
              },
            ),
          ),
          const SizedBox(height: 8),
          // Legend
          Row(
            mainAxisAlignment: MainAxisAlignment.center,
            children: [
              _dot(FC.green),
              const SizedBox(width: 6),
              Text('Study session', style: TextStyle(color: FC.textSecondary, fontSize: 12)),
              const SizedBox(width: 16),
              _dot(FC.amber),
              const SizedBox(width: 6),
              Text('Assessment', style: TextStyle(color: FC.textSecondary, fontSize: 12)),
            ],
          ),
        ],
      ),
    );
  }

  Widget _dot(Color color) => Container(
    width: 6, height: 6,
    decoration: BoxDecoration(color: color, shape: BoxShape.circle),
  );

  Widget _buildUpcoming() {
    return Column(
      crossAxisAlignment: CrossAxisAlignment.start,
      children: [
        Text('UPCOMING', style: TextStyle(
          color: FC.textTertiary, fontSize: 10, letterSpacing: 1.6,
        )),
        const SizedBox(height: 12),
        ...assessments.map((a) => _AssessmentCard(assessment: a)),
      ],
    );
  }
}

class _AssessmentCard extends StatelessWidget {
  final Assessment assessment;
  const _AssessmentCard({required this.assessment});

  @override
  Widget build(BuildContext context) {
    final days = assessment.daysUntil;
    final color = FC.subjectColor(assessment.subject);
    final daysColor = days <= 3 ? FC.red : days <= 7 ? FC.amber : FC.textSecondary;

    return Container(
      margin: const EdgeInsets.only(bottom: 8),
      decoration: BoxDecoration(
        color: FC.card,
        borderRadius: BorderRadius.circular(12),
        border: Border.all(color: FC.border),
      ),
      child: Row(
        children: [
          Container(
            width: 4,
            height: 62,
            decoration: BoxDecoration(
              color: color,
              borderRadius: const BorderRadius.only(
                topLeft: Radius.circular(12),
                bottomLeft: Radius.circular(12),
              ),
            ),
          ),
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 14, vertical: 14),
              child: Column(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  Text(assessment.name, style: const TextStyle(
                    color: FC.textPrimary, fontWeight: FontWeight.w600, fontSize: 14,
                  )),
                  const SizedBox(height: 3),
                  Text('${assessment.subject} · ${assessment.type}', style: TextStyle(
                    color: FC.textSecondary, fontSize: 12,
                  )),
                ],
              ),
            ),
          ),
          Padding(
            padding: const EdgeInsets.only(right: 14),
            child: Text('${days}d', style: TextStyle(
              color: daysColor, fontWeight: FontWeight.w700, fontSize: 14,
            )),
          ),
        ],
      ),
    );
  }
}
