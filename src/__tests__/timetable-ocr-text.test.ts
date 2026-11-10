import { parseTimetableOcrText } from "@/lib/timetable/ocr-text";

describe("parseTimetableOcrText", () => {
  it("extracts simple lesson lines and normalizes times", () => {
    expect(
      parseTimetableOcrText(
        [
          "MONDAY timetable",
          "Monday 1 P1 English Ms Nakanwagi 08.00 08.40 Room 2",
          "Tuesday 2 P1 Mathematics Mr Okello 08:40 09:20",
        ].join("\n"),
      ),
    ).toEqual([
      {
        day: "Monday",
        period: "1",
        className: "P1",
        subject: "English",
        teacher: "Ms Nakanwagi",
        startTime: "08:00",
        endTime: "08:40",
        room: "2",
      },
      {
        day: "Tuesday",
        period: "2",
        className: "P1",
        subject: "Mathematics",
        teacher: "Mr Okello",
        startTime: "08:40",
        endTime: "09:20",
        room: "",
      },
    ]);
  });

  it("returns no records for headers or text without a weekday", () => {
    expect(parseTimetableOcrText("Class Subject Teacher\nTerm 2 timetable")).toEqual([]);
  });

  it("handles P1 and Period 1 period labels without shifting the class column", () => {
    expect(
      parseTimetableOcrText("Monday P1 P1 Mathematics Ms A 08:00 08:40\nTuesday Period 2 P2 English Mr B 08:40 09:20"),
    ).toEqual([
      {
        day: "Monday",
        period: "1",
        className: "P1",
        subject: "Mathematics",
        teacher: "Ms A",
        startTime: "08:00",
        endTime: "08:40",
        room: "",
      },
      {
        day: "Tuesday",
        period: "2",
        className: "P2",
        subject: "English",
        teacher: "Mr B",
        startTime: "08:40",
        endTime: "09:20",
        room: "",
      },
    ]);
  });

  it("preserves partial rows for correction instead of dropping uncertain fields", () => {
    expect(parseTimetableOcrText("Wed 4 10.20 11.00")).toEqual([
      {
        day: "Wed",
        period: "4",
        className: "",
        subject: "",
        teacher: "",
        startTime: "10:20",
        endTime: "11:00",
        room: "",
      },
    ]);
  });
});
