import {
  ROLES,
  STUDENT_STATUS,
  ATTENDANCE_STATUS,
  EVENT_TYPES,
  GENDER,
  PAYMENT_METHODS,
  ASSESSMENT_TYPES,
  TERMS,
} from "../lib/constants";

describe("Constants", () => {
  describe("ROLES", () => {
    test("has all required roles", () => {
      expect(ROLES.SUPER_ADMIN).toBe("super_admin");
      expect(ROLES.SCHOOL_ADMIN).toBe("school_admin");
      expect(ROLES.ADMIN).toBe("admin");
      expect(ROLES.HEADMASTER).toBe("headmaster");
      expect(ROLES.BOARD).toBe("board");
      expect(ROLES.DEAN_OF_STUDIES).toBe("dean_of_studies");
      expect(ROLES.BURSAR).toBe("bursar");
      expect(ROLES.TEACHER).toBe("teacher");
      expect(ROLES.SECRETARY).toBe("secretary");
      expect(ROLES.DORM_MASTER).toBe("dorm_master");
      expect(ROLES.STUDENT).toBe("student");
      expect(ROLES.PARENT).toBe("parent");
      expect(ROLES.MARKETER).toBe("marketer");
    });
  });

  describe("STUDENT_STATUS", () => {
    test("has all student statuses", () => {
      expect(STUDENT_STATUS.ACTIVE).toBe("active");
      expect(STUDENT_STATUS.TRANSFERRED).toBe("transferred");
      expect(STUDENT_STATUS.DROPPED).toBe("dropped");
      expect(STUDENT_STATUS.COMPLETED).toBe("completed");
    });
  });

  describe("ATTENDANCE_STATUS", () => {
    test("has all attendance statuses", () => {
      expect(ATTENDANCE_STATUS.PRESENT).toBe("present");
      expect(ATTENDANCE_STATUS.ABSENT).toBe("absent");
      expect(ATTENDANCE_STATUS.LATE).toBe("late");
      expect(ATTENDANCE_STATUS.EXCUSED).toBe("excused");
    });
  });

  describe("EVENT_TYPES", () => {
    test("has all event types", () => {
      expect(EVENT_TYPES.EXAM).toBe("exam");
      expect(EVENT_TYPES.MEETING).toBe("meeting");
      expect(EVENT_TYPES.HOLIDAY).toBe("holiday");
      expect(EVENT_TYPES.EVENT).toBe("event");
      expect(EVENT_TYPES.ACADEMIC).toBe("academic");
      expect(EVENT_TYPES.SUBSTITUTION).toBe("substitution");
    });
  });

  describe("GENDER", () => {
    test("has male and female", () => {
      expect(GENDER.MALE).toBe("M");
      expect(GENDER.FEMALE).toBe("F");
    });
  });

  describe("PAYMENT_METHODS", () => {
    test("has all payment methods", () => {
      expect(PAYMENT_METHODS.CASH).toBe("cash");
      expect(PAYMENT_METHODS.MOBILE_MONEY).toBe("mobile_money");
      expect(PAYMENT_METHODS.BANK).toBe("bank");
      expect(PAYMENT_METHODS.INSTALLMENT).toBe("installment");
    });
  });

  describe("ASSESSMENT_TYPES", () => {
    test("has all assessment types", () => {
      expect(ASSESSMENT_TYPES.CA1).toBe("ca1");
      expect(ASSESSMENT_TYPES.CA2).toBe("ca2");
      expect(ASSESSMENT_TYPES.CA3).toBe("ca3");
      expect(ASSESSMENT_TYPES.CA4).toBe("ca4");
      expect(ASSESSMENT_TYPES.PROJECT).toBe("project");
      expect(ASSESSMENT_TYPES.EXAM).toBe("exam");
      expect(ASSESSMENT_TYPES.COMPETENCY).toBe("competency");
      expect(ASSESSMENT_TYPES.U1).toBe("u1");
      expect(ASSESSMENT_TYPES.U2).toBe("u2");
      expect(ASSESSMENT_TYPES.EOT).toBe("eot");
    });
  });

  describe("TERMS", () => {
    test("has three terms", () => {
      expect(TERMS).toEqual([1, 2, 3]);
    });
  });
});

describe("Enum Consistency", () => {
  test("student status values are lowercase", () => {
    Object.values(STUDENT_STATUS).forEach((status) => {
      expect(status).toBe(status.toLowerCase());
    });
  });

  test("attendance status values are lowercase", () => {
    Object.values(ATTENDANCE_STATUS).forEach((status) => {
      expect(status).toBe(status.toLowerCase());
    });
  });

  test("gender is single character", () => {
    Object.values(GENDER).forEach((g) => {
      expect(g.length).toBe(1);
    });
  });
});
