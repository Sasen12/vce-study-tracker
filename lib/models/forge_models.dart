import 'package:flutter/material.dart';

class AppSubject {
  final String name;
  final Color color;
  final double mastery;
  final String riskLevel; // 'low', 'med', 'high'
  final double weeklyHoursLogged;
  final double weeklyHoursGoal;
  final int weakAreaCount;
  final int evidencePoints;

  const AppSubject({
    required this.name,
    required this.color,
    required this.mastery,
    required this.riskLevel,
    required this.weeklyHoursLogged,
    required this.weeklyHoursGoal,
    required this.weakAreaCount,
    required this.evidencePoints,
  });
}

class Assessment {
  final String name;
  final String subject;
  final String type;
  final DateTime date;

  const Assessment({
    required this.name,
    required this.subject,
    required this.type,
    required this.date,
  });

  int get daysUntil => date.difference(DateTime.now()).inDays;
}

class StudyRoom {
  final String name;
  final String description;
  final int participants;
  final IconData icon;

  const StudyRoom({
    required this.name,
    required this.description,
    required this.participants,
    required this.icon,
  });
}

class ShopTheme {
  final String name;
  final List<Color> previewColors;
  final int coinsRequired;
  final bool isStarter;
  bool isEquipped;
  bool isUnlocked;

  ShopTheme({
    required this.name,
    required this.previewColors,
    required this.coinsRequired,
    this.isStarter = false,
    this.isEquipped = false,
    this.isUnlocked = false,
  });
}

class WeakArea {
  final String topic;
  final String subject;
  final String reason;

  const WeakArea({
    required this.topic,
    required this.subject,
    required this.reason,
  });
}

class QueuedTask {
  final String subject;
  final String label;
  final int durationMinutes;
  final Color color;
  final IconData icon;

  const QueuedTask({
    required this.subject,
    required this.label,
    required this.durationMinutes,
    required this.color,
    required this.icon,
  });
}
