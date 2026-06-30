import 'package:flutter/material.dart';
import '../theme/forge_theme.dart';
import '../data/forge_data.dart';
import '../screens/home_screen.dart';
import '../screens/study_screen.dart';
import '../screens/calendar_screen.dart';
import '../screens/community_screen.dart';
import '../screens/insights_screen.dart';
import '../screens/shop_screen.dart';
import '../screens/profile_screen.dart';
import '../screens/more_screen.dart';

class NavShell extends StatefulWidget {
  const NavShell({super.key});

  @override
  State<NavShell> createState() => _NavShellState();
}

class _NavShellState extends State<NavShell> {
  int _index = 0;

  static const _items = [
    _NavItem(Icons.home_rounded, 'Home'),
    _NavItem(Icons.timer_rounded, 'Study'),
    _NavItem(Icons.calendar_month_rounded, 'Calendar'),
    _NavItem(Icons.people_rounded, 'Community'),
    _NavItem(Icons.insights_rounded, 'Insights'),
    _NavItem(Icons.shopping_bag_rounded, 'Shop'),
    _NavItem(Icons.person_rounded, 'Profile'),
    _NavItem(Icons.more_horiz_rounded, 'More'),
  ];

  @override
  Widget build(BuildContext context) {
    return Scaffold(
      backgroundColor: FC.bg,
      body: Row(
        children: [
          _buildSidebar(),
          Expanded(
            child: IndexedStack(
              index: _index,
              children: const [
                HomeScreen(),
                StudyScreen(),
                CalendarScreen(),
                CommunityScreen(),
                InsightsScreen(),
                ShopScreen(),
                ProfileScreen(),
                MoreScreen(),
              ],
            ),
          ),
        ],
      ),
    );
  }

  Widget _buildSidebar() {
    return Container(
      width: 200,
      decoration: const BoxDecoration(
        color: FC.navBg,
        border: Border(right: BorderSide(color: FC.border)),
      ),
      child: Column(
        children: [
          // Logo
          Padding(
            padding: const EdgeInsets.fromLTRB(20, 28, 20, 28),
            child: Row(
              children: [
                Container(
                  width: 34,
                  height: 34,
                  decoration: BoxDecoration(
                    gradient: const LinearGradient(
                      colors: [Color(0xFF9D8FFF), Color(0xFF5C51CC)],
                      begin: Alignment.topLeft,
                      end: Alignment.bottomRight,
                    ),
                    borderRadius: BorderRadius.circular(9),
                  ),
                  child: const Center(
                    child: Icon(Icons.local_fire_department_rounded, color: Colors.white, size: 18),
                  ),
                ),
                const SizedBox(width: 10),
                Column(
                  crossAxisAlignment: CrossAxisAlignment.start,
                  children: [
                    const Text('VCE Forge', style: TextStyle(
                      color: FC.textPrimary, fontSize: 14, fontWeight: FontWeight.w700,
                    )),
                    Text('study tracker', style: TextStyle(
                      color: FC.textTertiary, fontSize: 10, letterSpacing: 0.4,
                    )),
                  ],
                ),
              ],
            ),
          ),

          // Nav items
          Expanded(
            child: Padding(
              padding: const EdgeInsets.symmetric(horizontal: 10),
              child: Column(
                children: List.generate(_items.length, (i) {
                  final item = _items[i];
                  final selected = i == _index;
                  return GestureDetector(
                    onTap: () => setState(() => _index = i),
                    child: MouseRegion(
                      cursor: SystemMouseCursors.click,
                      child: Container(
                        margin: const EdgeInsets.only(bottom: 2),
                        padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 10),
                        decoration: BoxDecoration(
                          color: selected ? FC.accent.withOpacity(0.14) : Colors.transparent,
                          borderRadius: BorderRadius.circular(8),
                        ),
                        child: Row(
                          children: [
                            Icon(item.icon, size: 17,
                                color: selected ? FC.accent : FC.textSecondary),
                            const SizedBox(width: 10),
                            Text(item.label, style: TextStyle(
                              color: selected ? FC.textPrimary : FC.textSecondary,
                              fontSize: 14,
                              fontWeight: selected ? FontWeight.w600 : FontWeight.w400,
                            )),
                          ],
                        ),
                      ),
                    ),
                  );
                }),
              ),
            ),
          ),

          // Bottom: coins + user
          Container(
            padding: const EdgeInsets.all(16),
            decoration: const BoxDecoration(
              border: Border(top: BorderSide(color: FC.border)),
            ),
            child: Column(
              children: [
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 12, vertical: 9),
                  decoration: BoxDecoration(
                    color: FC.card,
                    borderRadius: BorderRadius.circular(8),
                    border: Border.all(color: FC.border),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.monetization_on_rounded, color: FC.blue, size: 15),
                      const SizedBox(width: 6),
                      Text('$userCoins', style: const TextStyle(
                        color: FC.textPrimary, fontWeight: FontWeight.w700, fontSize: 14,
                      )),
                      const SizedBox(width: 4),
                      Text('coins', style: TextStyle(color: FC.textSecondary, fontSize: 12)),
                    ],
                  ),
                ),
                const SizedBox(height: 12),
                Row(
                  children: [
                    CircleAvatar(
                      radius: 16,
                      backgroundColor: FC.accent,
                      child: const Text('S', style: TextStyle(
                        color: Colors.white, fontWeight: FontWeight.w700, fontSize: 14,
                      )),
                    ),
                    const SizedBox(width: 10),
                    Column(
                      crossAxisAlignment: CrossAxisAlignment.start,
                      children: [
                        const Text('Sasen', style: TextStyle(
                          color: FC.textPrimary, fontWeight: FontWeight.w600, fontSize: 13,
                        )),
                        Text('Lv $userLevel', style: TextStyle(
                          color: FC.textTertiary, fontSize: 11,
                        )),
                      ],
                    ),
                  ],
                ),
              ],
            ),
          ),
        ],
      ),
    );
  }
}

class _NavItem {
  final IconData icon;
  final String label;
  const _NavItem(this.icon, this.label);
}
