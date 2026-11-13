/**
 * Calculates total points: Total = Grade Points + Position Points.
 * Enforces decimal precision (2 decimal places).
 */
export function calculateTotalPoints(
  gradePoints: number | string = 0,
  positionPoints: number | string = 0
): string {
  const gp = typeof gradePoints === 'number' ? gradePoints : parseFloat(gradePoints) || 0;
  const pp = typeof positionPoints === 'number' ? positionPoints : parseFloat(positionPoints) || 0;
  return (gp + pp).toFixed(2);
}

/**
 * 5-level tie-breaking comparator for championship standings:
 * 1. Total Points (descending)
 * 2. 1st Places (descending)
 * 3. 2nd Places (descending)
 * 4. 3rd Places (descending)
 * 5. Grade A Counts (descending)
 * Returns negative if A ranks higher than B, positive if B ranks higher than A, 0 if tied.
 */
export function compareTieBreaker(
  a: { total_points: number; first_places: number; second_places: number; third_places: number; grade_a_count: number },
  b: { total_points: number; first_places: number; second_places: number; third_places: number; grade_a_count: number }
): number {
  if (b.total_points !== a.total_points) return b.total_points - a.total_points;
  if (b.first_places !== a.first_places) return b.first_places - a.first_places;
  if (b.second_places !== a.second_places) return b.second_places - a.second_places;
  if (b.third_places !== a.third_places) return b.third_places - a.third_places;
  return b.grade_a_count - a.grade_a_count;
}
