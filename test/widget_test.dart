import 'package:flutter_test/flutter_test.dart';
import 'package:vce_study_tracker/main.dart';

void main() {
  testWidgets('App loads without error', (WidgetTester tester) async {
    await tester.pumpWidget(const ForgeApp());
    await tester.pump(const Duration(seconds: 2));
    expect(find.text('VCE Forge'), findsOneWidget);
  });
}
