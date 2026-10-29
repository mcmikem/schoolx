import {
  groupSubjectDetails,
  parseReportRows,
  parseTermGradeBasis,
  resolveReportRows,
  type ReportRowConfig,
} from "@/lib/report-rows";
import { classicReportSubject } from "@/lib/report-summary";
import { bucketUgandaSubject, gradeBasisAvg, type UgandaGradeRow } from "@/lib/uganda-report";

const row = (assessment_type: string, score: number, max_score?: number | null): UgandaGradeRow => ({
  assessment_type,
  score,
  max_score: max_score ?? null,
});

describe("term grade basis", () => {
  it("is unchanged when no basis is configured (classic mean of BOT/MOT/EOT)", () => {
    const rows = [row("bot", 60), row("mid_term", 70), row("eot", 80)];
    expect(bucketUgandaSubject(rows).avg).toBe(70);
    expect(bucketUgandaSubject(rows, null).avg).toBe(70);
  });

  it("grades on the end-of-term exam only when the school says so", () => {
    const rows = [row("bot", 10), row("mid_term", 20), row("eot", 80)];
    const result = bucketUgandaSubject(rows, { types: ["eot"] });
    expect(result.avg).toBe(80);
    // The printed BOT/MOT/EOT columns still show every recorded exam.
    expect(result.mid).toBe(10);
    expect(result.mot).toBe(20);
    expect(result.end).toBe(80);
  });

  it("can grade on the mid-term alone and converts custom maxima to percentages", () => {
    const rows = [row("bot", 10), row("mid_term", 40, 50), row("eot", 10)];
    expect(gradeBasisAvg(rows, { types: ["mid_term"] })).toBe(80);
  });

  it("weights BOT/MOT/EOT as the school set them", () => {
    const rows = [row("bot", 40), row("mid_term", 60), row("eot", 100)];
    const result = bucketUgandaSubject(rows, {
      types: ["bot", "mid_term", "eot"],
      weights: { bot: 30, mid_term: 30, eot: 40 },
    });
    // 40*0.3 + 60*0.3 + 100*0.4 = 70
    expect(result.avg).toBe(70);
  });

  it("redistributes weight when a pupil missed one of the chosen exams", () => {
    const rows = [row("bot", 50), row("eot", 90)];
    const avg = gradeBasisAvg(rows, { types: ["bot", "mid_term", "eot"], weights: { bot: 30, mid_term: 30, eot: 40 } });
    // MOT absent: remaining weights 30+40 -> (50*30 + 90*40) / 70
    expect(avg).toBe(Math.round((50 * 30 + 90 * 40) / 70));
  });

  it("treats legacy exam rows as EOT", () => {
    const rows = [row("exam", 88)];
    expect(gradeBasisAvg(rows, { types: ["eot"] })).toBe(88);
  });

  it("folds continuous assessment into the ca bucket", () => {
    const rows = [row("ca1", 50), row("ca2", 70), row("eot", 60)];
    const avg = gradeBasisAvg(rows, { types: ["ca", "eot"], weights: { ca: 40, eot: 60 } });
    // ca = 60, eot = 60 -> 60
    expect(avg).toBe(60);
  });

  it("falls back to percent-of-possible when none of the chosen exams were recorded", () => {
    const rows = [row("ca1", 55), row("ca2", 65)];
    const result = bucketUgandaSubject(rows, { types: ["eot"] });
    expect(result.avg).toBe(60);
  });

  it("returns null for a subject with nothing recorded", () => {
    expect(bucketUgandaSubject([], { types: ["eot"] }).avg).toBeNull();
    expect(bucketUgandaSubject([], { types: ["eot"] }).grade).toBe("—");
  });

  it("still rejects invalid rows before any basis maths", () => {
    const rows = [row("eot", 120)];
    expect(bucketUgandaSubject(rows, { types: ["eot"] }).avg).toBeNull();
  });

  it("flows through classicReportSubject for the card row", () => {
    const subject = classicReportSubject([row("eot", 85)], { types: ["eot"] });
    expect(subject.score).toBe(85);
    expect(subject.grade).toBe("D1");
    expect(subject.isMissing).toBe(false);
  });
});

describe("term grade basis parsing", () => {
  it("parses a stored JSON string", () => {
    const basis = parseTermGradeBasis('{"types":["eot"],"weights":{"eot":100}}');
    expect(basis).toEqual({ types: ["eot"], weights: { eot: 100 } });
  });

  it("accepts an already-parsed object (school_settings may hand back either)", () => {
    expect(parseTermGradeBasis({ types: ["bot"] })).toEqual({ types: ["bot"], weights: {} });
  });

  it("rejects garbage and empty selections", () => {
    expect(parseTermGradeBasis("nonsense")).toBeNull();
    expect(parseTermGradeBasis('{"types":[]}')).toBeNull();
    expect(parseTermGradeBasis('{"types":["made_up"]}')).toBeNull();
    expect(parseTermGradeBasis(null)).toBeNull();
  });
});

describe("report row grouping", () => {
  const science = {
    subjectId: "sci",
    name: "Integrated Science",
    score: 70,
    grade: "C3",
    gradeColor: "text-blue-500",
    isMissing: false,
    uganda: { mid: 60, mot: 70, end: 80, avg: 70, agg: 3, grade: "C3" },
  };
  const sst = {
    subjectId: "sst",
    name: "Social Studies",
    score: 80,
    grade: "D2",
    gradeColor: "text-green-500",
    isMissing: false,
    uganda: { mid: 80, mot: 80, end: 80, avg: 80, agg: 2, grade: "D2" },
  };
  const english = {
    subjectId: "eng",
    name: "English",
    score: 90,
    grade: "D1",
    gradeColor: "text-green-600",
    isMissing: false,
    uganda: { mid: 90, mot: 90, end: 90, avg: 90, agg: 1, grade: "D1" },
  };

  const rows: ReportRowConfig[] = [
    { id: "r1", label: "Science and Social Studies", subjectIds: ["sci", "sst"], mode: "mean" },
  ];

  it("combines two subjects into one averaged line", () => {
    const [combined, ...rest] = groupSubjectDetails([science, sst, english], rows);
    expect(combined.name).toBe("Science and Social Studies");
    expect(combined.score).toBe(75);
    expect(combined.grade).toBe("D2");
    expect(combined.uganda?.mid).toBe(70);
    expect(combined.uganda?.end).toBe(80);
    expect(combined.uganda?.agg).toBe(3);
    expect(rest.map((s) => s.name)).toEqual(["English"]);
  });

  it("lets the strongest member stand for the line in best mode", () => {
    const [combined, ...rest] = groupSubjectDetails(
      [science, sst, english],
      [{ id: "r1", label: "Studies", subjectIds: ["sci", "sst"], mode: "best" }],
    );
    expect(combined.score).toBe(80);
    expect(combined.uganda?.agg).toBe(2);
    expect(rest).toHaveLength(1);
  });

  it("prints a missing line when no member has marks", () => {
    const empty = [
      { ...science, score: 0, isMissing: true, uganda: { ...science.uganda, avg: null, agg: null, grade: "—" } },
      { ...sst, score: 0, isMissing: true, uganda: { ...sst.uganda, avg: null, agg: null, grade: "—" } },
    ];
    const [combined] = groupSubjectDetails(empty, rows);
    expect(combined.isMissing).toBe(true);
    expect(combined.grade).toBe("M.M");
    expect(combined.uganda?.avg).toBeNull();
  });

  it("keeps every subject that is not in a group as its own line", () => {
    const out = groupSubjectDetails([science, sst, english], rows);
    expect(out.map((s) => s.name)).toEqual(["Science and Social Studies", "English"]);
  });

  it("is the identity when nothing is configured", () => {
    const details = [science, sst, english];
    expect(groupSubjectDetails(details, [])).toBe(details);
    expect(groupSubjectDetails(details, resolveReportRows(null, "P.2"))).toBe(details);
  });

  it("skips a group whose subjects do not exist at this school", () => {
    const out = groupSubjectDetails(
      [english],
      [{ id: "r1", label: "Ghost line", subjectIds: ["sci", "sst"], mode: "mean" }],
    );
    expect(out.map((s) => s.name)).toEqual(["English"]);
  });
});

describe("report rows configuration", () => {
  it("resolves the level override, else the default, else nothing", () => {
    const config = {
      default: [{ id: "d", label: "Default line", subjectIds: ["a"], mode: "mean" as const }],
      levels: { "P.2": [{ id: "p2", label: "P2 line", subjectIds: ["b"], mode: "best" as const }] },
    };
    expect(resolveReportRows(config, "P.2")[0].id).toBe("p2");
    expect(resolveReportRows(config, "P.5")[0].id).toBe("d");
    expect(resolveReportRows(config, null)[0].id).toBe("d");
    expect(resolveReportRows({ levels: { "P.2": [] } }, "P.2")).toEqual([]);
  });

  it("parses the stored shape and repairs ids", () => {
    const parsed = parseReportRows('{"default":[{"label":"Studies","subjectIds":["sci","sst"],"mode":"mean"}]}');
    expect(parsed?.default).toEqual([{ id: "row-0", label: "Studies", subjectIds: ["sci", "sst"], mode: "mean" }]);
  });

  it("rejects garbage and empty groups", () => {
    expect(parseReportRows("nonsense")).toBeNull();
    expect(parseReportRows('{"default":[{"label":"x","subjectIds":[]}]}')).toBeNull();
    expect(parseReportRows(null)).toBeNull();
  });
});
