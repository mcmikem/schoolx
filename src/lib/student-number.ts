// Collision-resistant student number generator.
//
// students carries UNIQUE(school_id, student_number), so a duplicate number
// fails the whole insert. The old timestamp-mod scheme clustered (concurrent
// creates in the same millisecond) and wrapped every ~11 days; a uniform
// random draw over the full 6-digit space makes a clash a 1-in-a-million
// event. Callers that hit a 23505 should rotate and retry rather than
// surface a 500.
export function generateStudentNumber(): string {
  const year = new Date().getFullYear();
  return `SM/${year}/${String(Math.floor(Math.random() * 1000000)).padStart(6, "0")}`;
}
