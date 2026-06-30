import 'package:flutter/material.dart';
import '../theme/forge_theme.dart';
import '../data/forge_data.dart';
import '../models/forge_models.dart';

class ShopScreen extends StatefulWidget {
  const ShopScreen({super.key});

  @override
  State<ShopScreen> createState() => _ShopScreenState();
}

class _ShopScreenState extends State<ShopScreen> {
  int _tab = 0;
  static const _tabs = ['Themes', 'Titles', 'Badges', 'Perks'];

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
                    Text('COIN SHOP', style: TextStyle(
                      color: FC.textTertiary, fontSize: 10, letterSpacing: 1.6,
                    )),
                    const SizedBox(height: 6),
                    const Text('Shop', style: TextStyle(
                      color: FC.textPrimary, fontSize: 34, fontWeight: FontWeight.w700,
                    )),
                  ],
                ),
                const Spacer(),
                Container(
                  padding: const EdgeInsets.symmetric(horizontal: 16, vertical: 10),
                  decoration: BoxDecoration(
                    color: FC.card,
                    borderRadius: BorderRadius.circular(10),
                    border: Border.all(color: FC.border),
                  ),
                  child: Row(
                    children: [
                      const Icon(Icons.monetization_on_rounded, color: FC.blue, size: 18),
                      const SizedBox(width: 8),
                      Text('$userCoins', style: const TextStyle(
                        color: FC.textPrimary, fontWeight: FontWeight.w700, fontSize: 18,
                      )),
                      const SizedBox(width: 4),
                      Text('coins', style: TextStyle(color: FC.textSecondary)),
                    ],
                  ),
                ),
              ],
            ),
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
            // Grid
            Expanded(
              child: GridView.builder(
                gridDelegate: const SliverGridDelegateWithFixedCrossAxisCount(
                  crossAxisCount: 3,
                  crossAxisSpacing: 16,
                  mainAxisSpacing: 16,
                  childAspectRatio: 1.1,
                ),
                itemCount: shopThemes.length,
                itemBuilder: (context, i) => _ThemeCard(
                  theme: shopThemes[i],
                  onEquip: () => setState(() {
                    for (final t in shopThemes) {
                      t.isEquipped = false;
                    }
                    shopThemes[i].isEquipped = true;
                  }),
                  onUnlock: () => setState(() {
                    if (userCoins >= shopThemes[i].coinsRequired) {
                      userCoins -= shopThemes[i].coinsRequired;
                      shopThemes[i].isUnlocked = true;
                    }
                  }),
                ),
              ),
            ),
          ],
        ),
      ),
    );
  }
}

class _ThemeCard extends StatelessWidget {
  final ShopTheme theme;
  final VoidCallback onEquip;
  final VoidCallback onUnlock;

  const _ThemeCard({
    required this.theme,
    required this.onEquip,
    required this.onUnlock,
  });

  @override
  Widget build(BuildContext context) {
    return Container(
      padding: const EdgeInsets.all(18),
      decoration: BoxDecoration(
        color: FC.card,
        borderRadius: BorderRadius.circular(16),
        border: Border.all(
          color: theme.isEquipped ? FC.accent : FC.border,
          width: theme.isEquipped ? 2 : 1,
        ),
      ),
      child: Column(
        crossAxisAlignment: CrossAxisAlignment.start,
        children: [
          // Preview bars
          Column(
            children: theme.previewColors.map((c) => Container(
              margin: const EdgeInsets.only(bottom: 4),
              height: 8,
              decoration: BoxDecoration(
                color: c,
                borderRadius: BorderRadius.circular(4),
              ),
            )).toList(),
          ),
          const Spacer(),
          Text(theme.name, style: const TextStyle(
            color: FC.textPrimary, fontWeight: FontWeight.w700, fontSize: 14,
          )),
          const SizedBox(height: 4),
          Text(
            theme.isStarter ? 'Starter' : '${theme.coinsRequired} coins',
            style: TextStyle(color: FC.textSecondary, fontSize: 12),
          ),
          const SizedBox(height: 12),
          // Button
          SizedBox(
            width: double.infinity,
            child: _buildButton(),
          ),
        ],
      ),
    );
  }

  Widget _buildButton() {
    if (theme.isEquipped) {
      return _btn('Equipped', FC.accent, null);
    }
    if (theme.isUnlocked) {
      return _btn('Use', FC.green, onEquip);
    }
    if (userCoins >= theme.coinsRequired) {
      return _btn('Unlock', FC.red, onUnlock);
    }
    return _btn('${theme.coinsRequired} coins', FC.textTertiary, null);
  }

  Widget _btn(String label, Color color, VoidCallback? onTap) {
    return GestureDetector(
      onTap: onTap,
      child: MouseRegion(
        cursor: onTap != null ? SystemMouseCursors.click : SystemMouseCursors.basic,
        child: Container(
          padding: const EdgeInsets.symmetric(vertical: 10),
          decoration: BoxDecoration(
            color: onTap != null ? color : FC.cardAlt,
            borderRadius: BorderRadius.circular(8),
          ),
          child: Center(
            child: Text(label, style: TextStyle(
              color: onTap != null ? Colors.white : FC.textTertiary,
              fontWeight: FontWeight.w600,
              fontSize: 13,
            )),
          ),
        ),
      ),
    );
  }
}
