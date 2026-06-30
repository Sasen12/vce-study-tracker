import 'package:flutter/material.dart';
import '../models/forge_models.dart';

final List<AppSubject> subjects = [
  const AppSubject(
    name: 'Mathematical Methods',
    color: Color(0xFF818CF8),
    mastery: 0.72,
    riskLevel: 'med',
    weeklyHoursLogged: 3.7,
    weeklyHoursGoal: 5.0,
    weakAreaCount: 9,
    evidencePoints: 47,
  ),
  const AppSubject(
    name: 'Chemistry',
    color: Color(0xFFF87171),
    mastery: 0.48,
    riskLevel: 'high',
    weeklyHoursLogged: 1.2,
    weeklyHoursGoal: 4.0,
    weakAreaCount: 14,
    evidencePoints: 23,
  ),
  const AppSubject(
    name: 'English',
    color: Color(0xFF34D399),
    mastery: 0.81,
    riskLevel: 'low',
    weeklyHoursLogged: 2.8,
    weeklyHoursGoal: 3.0,
    weakAreaCount: 3,
    evidencePoints: 62,
  ),
  const AppSubject(
    name: 'Physics',
    color: Color(0xFF60A5FA),
    mastery: 0.64,
    riskLevel: 'med',
    weeklyHoursLogged: 2.1,
    weeklyHoursGoal: 4.0,
    weakAreaCount: 7,
    evidencePoints: 38,
  ),
  const AppSubject(
    name: 'Specialist Maths',
    color: Color(0xFFFBBF24),
    mastery: 0.55,
    riskLevel: 'med',
    weeklyHoursLogged: 1.6,
    weeklyHoursGoal: 4.0,
    weakAreaCount: 11,
    evidencePoints: 29,
  ),
];

final List<Assessment> assessments = [
  Assessment(
    name: 'Methods SAC',
    subject: 'Mathematical Methods',
    type: 'Actual SAC',
    date: DateTime(2026, 7, 3),
  ),
  Assessment(
    name: 'Chemistry prac SAC',
    subject: 'Chemistry',
    type: 'Practice SAC',
    date: DateTime(2026, 7, 5),
  ),
  Assessment(
    name: 'English essay',
    subject: 'English',
    type: 'Task',
    date: DateTime(2026, 7, 8),
  ),
  Assessment(
    name: 'Physics SAT check',
    subject: 'Physics',
    type: 'Practice SAT',
    date: DateTime(2026, 7, 11),
  ),
  Assessment(
    name: 'Methods exam',
    subject: 'Mathematical Methods',
    type: 'Exam',
    date: DateTime(2026, 7, 24),
  ),
];

final List<StudyRoom> studyRooms = [
  const StudyRoom(
    name: 'Methods grind',
    description: 'Pomodoro · cameras off',
    participants: 12,
    icon: Icons.functions_rounded,
  ),
  const StudyRoom(
    name: 'Silent library',
    description: 'Deep focus · no chat',
    participants: 8,
    icon: Icons.menu_book_rounded,
  ),
  const StudyRoom(
    name: 'Late night SAC prep',
    description: 'Mixed subjects',
    participants: 5,
    icon: Icons.nightlight_round,
  ),
];

List<ShopTheme> shopThemes = [
  ShopTheme(
    name: 'Midnight Focus',
    previewColors: const [Color(0xFF818CF8), Color(0xFFF87171), Color(0xFF34D399)],
    coinsRequired: 0,
    isStarter: true,
    isEquipped: true,
    isUnlocked: true,
  ),
  ShopTheme(
    name: 'Mint Sprint',
    previewColors: const [Color(0xFF34D399), Color(0xFF6EE7B7), Color(0xFF10B981)],
    coinsRequired: 60,
    isUnlocked: true,
  ),
  ShopTheme(
    name: 'Sunset Revision',
    previewColors: const [Color(0xFFF87171), Color(0xFFFBBF24), Color(0xFFF59E0B)],
    coinsRequired: 90,
  ),
  ShopTheme(
    name: 'Ocean Mode',
    previewColors: const [Color(0xFF60A5FA), Color(0xFF38BDF8), Color(0xFF0EA5E9)],
    coinsRequired: 140,
  ),
  ShopTheme(
    name: 'Royal Grind',
    previewColors: const [Color(0xFFA78BFA), Color(0xFFEC4899), Color(0xFF8B5CF6)],
    coinsRequired: 320,
  ),
  ShopTheme(
    name: 'Matrix Mode',
    previewColors: const [Color(0xFF22C55E), Color(0xFF16A34A), Color(0xFF15803D)],
    coinsRequired: 820,
  ),
  ShopTheme(
    name: 'Cherry Blossom',
    previewColors: const [Color(0xFFF9A8D4), Color(0xFFF472B6), Color(0xFFEC4899)],
    coinsRequired: 880,
  ),
  ShopTheme(
    name: 'Snow Day',
    previewColors: const [Color(0xFFE0E7FF), Color(0xFFC7D2FE), Color(0xFFA5B4FC)],
    coinsRequired: 1180,
  ),
];

final List<WeakArea> weakAreas = [
  const WeakArea(
    topic: 'Chain rule applications',
    subject: 'Chemistry',
    reason: '3 missed check-ins',
  ),
  const WeakArea(
    topic: 'Titration calculations',
    subject: 'Chemistry',
    reason: '2 mistake logs',
  ),
  const WeakArea(
    topic: 'Essay structure under time',
    subject: 'English',
    reason: 'last practice SAC',
  ),
];

final List<QueuedTask> queuedTasks = [
  const QueuedTask(
    subject: 'Chemistry',
    label: 'Weakness repair',
    durationMinutes: 25,
    color: Color(0xFFF87171),
    icon: Icons.science_rounded,
  ),
  const QueuedTask(
    subject: 'English',
    label: 'Clear revision debt',
    durationMinutes: 20,
    color: Color(0xFF34D399),
    icon: Icons.edit_rounded,
  ),
];

// App state (mutable globals for simplicity)
int userCoins = 240;
int dayStreak = 7;
int totalXP = 3180;
int userLevel = 6;
