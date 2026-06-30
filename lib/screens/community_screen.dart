import 'package:flutter/material.dart';
import '../theme/forge_theme.dart';
import '../data/forge_data.dart';
import '../models/forge_models.dart';

class CommunityScreen extends StatefulWidget {
  const CommunityScreen({super.key});

  @override
  State<CommunityScreen> createState() => _CommunityScreenState();
}

class _CommunityScreenState extends State<CommunityScreen> {
  int _tab = 0;
  static const _tabs = ['Study rooms', 'Leaderboard', 'Chess knockout', 'Squads'];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: FC.bg,
      body: Padding(
        padding: const EdgeInsets.fromLTRB(36, 36, 36, 36),
        child: Column(
          crossAxisAlignment: CrossAxisAlignment.start,
          children: [
            Text('COMMUNITY', style: TextStyle(
              color: FC.textTertiary, fontSize: 10, letterSpacing: 1.6,
            )),
            const SizedBox(height: 6),
            const Text('Grind together', style: TextStyle(
              color: FC.textPrimary, fontSize: 34, fontWeight: FontWeight.w700,
            )),
            const SizedBox(height: 22),
            // Tabs
            Row(
              children: List.generate(_tabs.length, (i) {
                final sel = i == _tab;
                return GestureDetector(
                  onTap: () => setState(() => _tab = i),
                  child: MouseRegion(
                    cursor: SystemMouseCursors.click,
                    child: Container(
                      margin: const EdgeInsets.only(right: 8),
                      padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 9),
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
            const SizedBox(height: 24),
            Expanded(
              child: Row(
                crossAxisAlignment: CrossAxisAlignment.start,
                children: [
                  // Rooms list
                  Expanded(
                    child: Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        Text('LIVE ROOMS · ${studyRooms.length} OPEN', style: TextStyle(
                          color: FC.textTertiary, fontSize: 10, letterSpacing: 1.6,
                        )),
                        const SizedBox(height: 12),
                        ...studyRooms.map((r) => _RoomCard(room: r)),
                      ],
                    ),
                  ),
                  const SizedBox(width: 24),
                  // Right panels
                  SizedBox(
                    width: 280,
                    child: Column(
                      children: [
                        _ChessKnockoutCard(),
                        const SizedBox(height: 16),
                        _CommunityGoalCard(),
                      ],
                    ),
                  ),
                ],
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _RoomCard extends StatelessWidget {
  final StudyRoom room;
  const _RoomCard({required this.room});

  @override
  Widget build(BuildContext context) {
    return Container(
      margin: const EdgeInsets.only(bottom: 10),
      padding: const EdgeInsets.symmetric(horizontal: 20, vertical: 18),
      decoration: BoxDecoration(
        color: FC.card,
        borderRadius: BorderRadius.circular(14),
        border: Border.all(color: FC.border),
      ),
      child: Row(
        children: [
          Container(
            width: 40,
            height: 40,
            decoration: BoxDecoration(
              color: FC.cardAlt,
              borderRadius: BorderRadius.circular(10),
            ),
            child: Icon(room.icon, size: 20, color: FC.accent),
          ),
          const SizedBox(width: 14),
          Expanded(
            child: Column(
              crossAxisAlignment: CrossAxisAlignment.start,
              children: [
                Text(room.name, style: const TextStyle(
                  color: FC.textPrimary, fontWeight: FontWeight.w600, fontSize: 15,
                )),
                const SizedBox(height: 2),
                Text(room.description, style: TextStyle(color: FC.textSecondary, fontSize: 13)),
              ],
            ),
          ),
          Row(
            children: [
              Container(
                width: 8,
                height: 8,
                decoration: const BoxDecoration(color: FC.green, shape: BoxShape.circle),
              ),
              const SizedBox(width: 5),
              Text('${room.participants}', style: TextStyle(color: FC.textSecondary, fontSize: 14)),
            ],
          ),
          const SizedBox(width: 16),
          ElevatedButton(
            onPressed: () {},
            style: ElevatedButton.styleFrom(
              backgroundColor: FC.accent,
              elevation: 0,
              padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
              shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(8)),
            ),
            child: const Text('Join', style: TextStyle(
              color: Colors.white, fontWeight: FontWeight.w600, fontSize: 13,
            )),
          ),
        ],
      ),
    );
  }
}

class _ChessKnockoutCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(20),
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
                width: 32,
                height: 32,
                decoration: BoxDecoration(
                  color: FC.amberDim,
                  borderRadius: BorderRadius.circular(8),
                ),
                child: const Center(
                  child: Text('♛', style: TextStyle(fontSize: 16)),
                ),
              ),
              const SizedBox(width: 10),
              const Text('Chess knockout', style: TextStyle(
                color: FC.textPrimary, fontWeight: FontWeight.w700, fontSize: 15,
              )),
            ],
          ),
          const SizedBox(height: 12),
          Text('42 signed up · bracket opens Sat 7pm. Win study coins as you advance.', style: TextStyle(
            color: FC.textSecondary, fontSize: 13, height: 1.5,
          )),
          const SizedBox(height: 16),
          SizedBox(
            width: double.infinity,
            child: ElevatedButton(
              onPressed: () {},
              style: ElevatedButton.styleFrom(
                backgroundColor: FC.accent,
                elevation: 0,
                padding: const EdgeInsets.symmetric(vertical: 12),
                shape: RoundedRectangleBorder(borderRadius: BorderRadius.circular(10)),
              ),
              child: const Text("You're in · view bracket", style: TextStyle(
                color: Colors.white, fontWeight: FontWeight.w600,
              )),
            ),
          ),
        ],
      ),
    );
  }
}

class _CommunityGoalCard extends StatelessWidget {
  @override
  Widget build(BuildContext context) {
    const progress = 430 / 600;
    return Container(
      padding: const EdgeInsets.all(20),
      decoration: BoxDecoration(
        color: FC.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(color: FC.border),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          Text('COMMUNITY GOAL', style: TextStyle(
            color: FC.textTertiary, fontSize: 10, letterSpacing: 1.6,
          )),
          const SizedBox(height: 12),
          const Text('Study minutes this week', style: TextStyle(
            color: FC.textSecondary, fontSize: 13,
          )),
          const SizedBox(height: 6),
          Row(
            mainAxisAlignment: MainAxisAlignment.spaceBetween,
            children: [
              const Text('430', style: TextStyle(
                color: FC.textPrimary, fontWeight: FontWeight.w700, fontSize: 24,
              )),
              Text('/ 600', style: TextStyle(color: FC.textSecondary, fontSize: 14)),
            ],
          ),
          const SizedBox(height: 10),
          ClipRRect(
            borderRadius: BorderRadius.circular(4),
            child: const LinearProgressIndicator(
              value: progress,
              minHeight: 8,
              backgroundColor: FC.border,
              valueColor: AlwaysStoppedAnimation<Color>(FC.green),
            ),
          ),
        ],
      ),
    );
  }
}
