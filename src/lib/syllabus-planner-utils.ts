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
