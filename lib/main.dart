import 'package:flutter/material.dart';
import 'package:flutter/services.dart';
import 'theme/forge_theme.dart';
import 'widgets/nav_shell.dart';

void main() {
  SystemChrome.setSystemUIOverlayStyle(
    const SystemUiOverlayStyle(statusBarColor: Colors.transparent),
  );
  runApp(const ForgeApp());
}

class ForgeApp extends StatelessWidget {
  const ForgeApp({super.key});

  @override
  Widget build(BuildContext context) {
    return MaterialApp(
      title: 'VCE Forge',
      debugShowCheckedModeBanner: false,
      theme: ForgeTheme.dark,
      home: const NavShell(),
    );
  }
}
