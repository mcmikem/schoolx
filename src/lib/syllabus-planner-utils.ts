/**
 * Syllabus Tracker & Auto Lesson Planner Utilities
 * Logic for timeline calculation, progress tracking, and lesson generation
 */

export interface SyllabusTimelineEntry {
  id: string;
  week_number: number;
  planned_start_date: string;
  planned_end_date: string;
  actual_start_date?: string;
  actual_end_date?: string;
  status: "not_started" | "in_progress" | "completed" | "postponed" | "accelerated";
  completion_percentage: number;
  lessons_planned: number;
  lessons_completed: number;
  student_comprehension_rating?: number;
  teacher_notes?: string;
}

export interface AutoPlannerConfig {
  enable_ai_generation: boolean;
  enable_weekly_distribution: boolean;
  enable_smart_scheduling: boolean;
  lessons_per_week_target: number;
  account_for_holidays: boolean;
  account_for_exams: boolean;
  ai_provider: "openai" | "claude" | "rules_based";
  ai_temperature: number;
  default_lesson_duration: number;
  include_homework: boolean;
  include_assessment: boolean;
}

/**
 * Calculate term dates for a given academic year and term number
 */
export function calculateTermDates(
  academicYear: string,
  termNumber: 1 | 2 | 3,
  schoolRegion: string = "central"
): { startDate: Date; endDate: Date; holidays: { start: Date; end: Date }[] } {
  const year = parseInt(academicYear);

  // Uganda standard school calendar 2025/2026
  const ugandasTerms: Record<
    number,
    { startMonth: number; startDay: number; endMonth: number; endDay: number }
  > = {
    1: { startMonth: 0, startDay: 15, endMonth: 3, endDay: 31 }, // Jan 15 - Mar 31
    2: { startMonth: 4, startDay: 5, endMonth: 7, endDay: 31 }, // May 5 - Jul 31
    3: { startMonth: 8, startDay: 1, endMonth: 11, endDay: 15 }, // Sep 1 - Dec 15
  };

  const term = ugandasTerms[termNumber];
  const startDate = new Date(year, term.startMonth, term.startDay);
  const endDate = new Date(year, term.endMonth, term.endDay);

  // Standard Uganda holidays per term
  const holidays = [
    { start: new Date(year, 0, 1), end: new Date(year, 0, 5) }, // New Year
    { start: new Date(year, 1, 14), end: new Date(year, 1, 18) }, // Half-term 1
    { start: new Date(year, 5, 5), end: new Date(year, 5, 10) }, // Half-term 2
    { start: new Date(year, 10, 5), end: new Date(year, 10, 10) }, // Half-term 3
  ];

  return { startDate, endDate, holidays };
}

/**
 * Distribute syllabus topics across weeks considering holidays and exam dates
 */
export function distributeTopicsAcrossWeeks(
  topics: Array<{ topic: string; weeks_needed?: number }>,
  startDate: Date,
  endDate: Date,
  holidays: { start: Date; end: Date }[],
  lessonDaysPerWeek: number = 5 // Mon-Fri
): SyllabusTimelineEntry[] {
  const weeksData: SyllabusTimelineEntry[] = [];
  let currentDate = new Date(startDate);
  let weekNumber = 1;
  let topicIndex = 0;

  // Calculate total teaching weeks (excluding holidays)
  let totalTeachingWeeks = 0;
  let checkDate = new Date(startDate);
  while (checkDate < endDate) {
    const isHoliday = holidays.some(
      (h) => checkDate >= h.start && checkDate <= h.end
    );
    if (!isHoliday) totalTeachingWeeks++;
    checkDate.setDate(checkDate.getDate() + 7);
  }

  // Distribute topics
  while (currentDate < endDate && topicIndex < topics.length) {
    const weekStart = new Date(currentDate);
    const weekEnd = new Date(currentDate);
    weekEnd.setDate(weekEnd.getDate() + 6);

    const isHolidayWeek = holidays.some(
      (h) =>
        (weekStart >= h.start && weekStart <= h.end) ||
        (weekEnd >= h.start && weekEnd <= h.end)
    );

    if (!isHolidayWeek && topicIndex < topics.length) {
      const topic = topics[topicIndex];
      const weeksNeeded = topic.weeks_needed || 1;

      weeksData.push({
        id: `week-${weekNumber}`,
        week_number: weekNumber,
        planned_start_date: weekStart.toISOString().split("T")[0],
        planned_end_date: weekEnd.toISOString().split("T")[0],
        status: "not_started",
        completion_percentage: 0,
        lessons_planned: 0,
        lessons_completed: 0,
      });

      if (weeksNeeded === 1) topicIndex++;
      weekNumber++;
    }

    currentDate.setDate(currentDate.getDate() + 7);
  }

  return weeksData;
}

/**
 * Generate lesson plan outline from syllabus topic
 * Uses templates + optional AI
 */
export function generateLessonOutline(
  topic: string,
  subtopics: string[],
  objectives: string[],
  suggestedResources: string[] = [],
  config: Partial<AutoPlannerConfig> = {}
): {
  introduction: string;
  main_content: string;
  consolidation: string;
  assessment: string;
  resources: string[];
  estimated_duration: number;
} {
  const defaults = {
    include_homework: true,
    include_assessment: true,
    default_lesson_duration: 40,
    ...config,
  };

  // Rules-based template (works without AI)
  const introduction = `
Introduction (5-7 minutes):
- Recap previous lesson: [Previous topic]
- Link to real-world context: ${topic}
- State learning objectives:
${objectives.map((obj) => `  • ${obj}`).join("\n")}
- Show relevance to students' lives
`.trim();

  const main_content = `
Main Content (20-25 minutes):
- Present subtopics:
${subtopics.map((st) => `  1. ${st}`).join("\n")}
- Use interactive examples
- Student participation activities
- Check for understanding at intervals
`.trim();

  const consolidation = `
Consolidation & Practice (8-10 minutes):
- Summarize key points
- Class discussion/questions
- Small group work or pair activity
- Demonstrate application
`.trim();

  const assessment = defaults.include_assessment
    ? `
Assessment (3-5 minutes):
- Quick formative check (quiz/poll/exit ticket)
- Observation of student participation
- Work samples review
`.trim()
    : "";

  return {
    introduction,
    main_content,
    consolidation,
    assessment,
    resources: suggestedResources,
    estimated_duration: defaults.default_lesson_duration,
  };
}

/**
 * Auto-suggest teaching resources based on topic
 */
export function suggestTeachingResources(
  topic: string,
  subtopics: string[],
  resourceDatabase: Array<{
    topic: string;
    resource_name: string;
    resource_type: string;
  }> = []
): string[] {
  // Filter resources matching topic or subtopics
  const topicLower = topic.toLowerCase();
  const subtopicsLower = subtopics.map((s) => s.toLowerCase());

  const matchedResources = resourceDatabase.filter((res) => {
    const resTopicLower = res.topic.toLowerCase();
    return (
      resTopicLower.includes(topicLower) ||
      subtopicsLower.some((st) => resTopicLower.includes(st))
    );
  });

  // Sort by type relevance and return names
  return matchedResources
    .sort((a, b) => {
      const priority: Record<string, number> = {
        video: 1,
        simulation: 2,
        image: 3,
        document: 4,
      };
      return (priority[a.resource_type] || 5) - (priority[b.resource_type] || 5);
    })
    .map((r) => r.resource_name)
    .slice(0, 5);
}

/**
 * Calculate progress percentage for a syllabus
 */
export function calculateSyllabusProgress(
  timeline: SyllabusTimelineEntry[]
): {
  overall_percentage: number;
  weeks_completed: number;
  weeks_total: number;
  on_track: boolean;
} {
  if (timeline.length === 0) return { overall_percentage: 0, weeks_completed: 0, weeks_total: 0, on_track: true };

  const completed = timeline.filter((t) => t.status === "completed").length;
  const inProgress = timeline.filter((t) => t.status === "in_progress").length;

  const overall_percentage = Math.round(
    ((completed + inProgress * 0.5) / timeline.length) * 100
  );
  const on_track =
    overall_percentage >= (new Date().getTime() / 100) % 100; // Simple check

  return {
    overall_percentage,
    weeks_completed: completed,
    weeks_total: timeline.length,
    on_track,
  };
}

/**
 * Identify topics needing revision based on performance
 */
export function identifyRevisionTopics(
  performanceData: Array<{
    topic: string;
    average_score?: number;
    students_below_50: number;
    student_count: number;
  }>
): Array<{ topic: string; revision_priority: "low" | "medium" | "high" }> {
  return performanceData
    .map((perf) => {
      const failureRate = perf.students_below_50 / (perf.student_count || 1);
      let priority: "low" | "medium" | "high" = "low";

      if (failureRate > 0.4) priority = "high";
      else if (failureRate > 0.2) priority = "medium";

      if (perf.average_score && perf.average_score < 50) priority = "high";
      else if (perf.average_score && perf.average_score < 65) priority = "medium";

      return { topic: perf.topic, revision_priority: priority };
    })
    .filter((t) => t.revision_priority !== "low");
}

/**
 * Generate AI-powered lesson objectives using templates
 * (Actual AI call would happen server-side with proper API key handling)
 */
export function generateLearningObjectives(
  topic: string,
  bloomsLevel: "remember" | "understand" | "apply" | "analyze" | "evaluate" | "create" = "understand"
): string[] {
  // Template-based generation for different Bloom's levels
  const templates: Record<string, string[]> = {
    remember: [
      `Students will be able to recall and list key ${topic} concepts`,
      `Students will be able to identify ${topic} examples`,
    ],
    understand: [
      `Students will be able to explain the meaning of ${topic}`,
      `Students will be able to describe how ${topic} works`,
    ],
    apply: [
      `Students will be able to use ${topic} principles in new situations`,
      `Students will be able to solve problems involving ${topic}`,
    ],
    analyze: [
      `Students will be able to compare and contrast ${topic} examples`,
      `Students will be able to identify causes and effects in ${topic}`,
    ],
    evaluate: [
      `Students will be able to judge the value of ${topic}`,
      `Students will be able to justify decisions about ${topic}`,
    ],
    create: [
      `Students will be able to design new approaches to ${topic}`,
      `Students will be able to combine ${topic} with other ideas`,
    ],
  };

  return templates[bloomsLevel] || templates["understand"];
}

/**
 * Calculate ideal lesson distribution per week
 */
export function calculateLessonDistribution(
  topicCount: number,
  weekCount: number,
  lessonDurationMinutes: number = 40,
  periodsPerDay: number = 8
): {
  lessons_per_week: number;
  total_lessons_needed: number;
  feasible: boolean;
} {
  const lessons_per_week = Math.ceil(topicCount / weekCount);
  const total_lessons_needed = topicCount;

  // Assume 2 periods per day per subject, 5 days/week = 10 periods available
  const periodsPerWeek = periodsPerDay * 5;
  const feasible = lessons_per_week <= Math.floor(periodsPerWeek / 2);

  return { lessons_per_week, total_lessons_needed, feasible };
}
