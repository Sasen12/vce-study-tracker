/// A single VCE study resource — maps to one row in the curriculum.
///
/// Each item represents something the student must know or be able to do:
/// an *Outcome* (a unit-level goal), *Key Knowledge* (a concept to learn),
/// *Key Skill* (a technique to practise), or *Command Term* (a verb like
/// "Evaluate" that appears in exam questions).
///
/// [id] is a stable unique key; [isCompleted] is mutable and toggled from
/// the detail panel.  Completion state is in-memory only (not persisted yet).
///
/// [unit], [areaOfStudy], and [outcome] carry the curriculum hierarchy
/// (e.g. "Unit 3: Data analytics", "Area of Study 1", "Outcome 1") and
/// are used to render a breadcrumb in the UI.  They're optional so
/// hand-crafted sample data can omit them.
class StudyItem {
  // Stable identifier used as a ValueKey in list widgets and for equality checks.
  final String id;
  // Subject name — must match one of the seven entries in the sidebar list.
  final String subject;
  // Short display title shown in result cards and the detail panel header.
  final String title;
  // Category label: Outcome, Key Knowledge, Key Skill, or Command Term.
  // Drives the filter pills, dot colours, and tag badge.
  final String category;
  // Verbatim VCAA study design wording — the "official" curriculum text.
  final String officialText;
  // Student-friendly re-phrasing displayed in the tinted card below official text.
  final String plainLanguageText;
  // Optional curriculum breadcrumb segment, e.g. "Unit 3: Software development".
  final String? unit;
  // Optional curriculum breadcrumb segment, e.g. "Area of Study 1".
  final String? areaOfStudy;
  // Optional curriculum breadcrumb segment, e.g. "Outcome 2".
  final String? outcome;
  // Mutable — toggled from both the result list checkmark and the detail panel
  // Complete button.  Currently in-memory only; no persistence.
  bool isCompleted;

  StudyItem({
    required this.id,
    required this.subject,
    required this.title,
    required this.category,
    required this.officialText,
    required this.plainLanguageText,
    this.unit,
    this.areaOfStudy,
    this.outcome,
    this.isCompleted = false,
  });
}
