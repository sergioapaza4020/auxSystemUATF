// Preserve the existing reserved attendance category until GradeItem has a type identifier.
function isAttendanceCriterion(name) {
  return name.toLowerCase() === "asistencias";
}
function attendancePercentage(present, total) {
  return total === 0 ? 0 : (present / total) * 100;
}
// Missing grades contribute zero; grouped callers provide the active activity count.
function averageScores(scores, activityCount = scores.length) {
  return activityCount > 0
    ? scores.reduce((sum, score) => sum + Number(score ?? 0), 0) / activityCount
    : null;
}
function weightedScore(score, percentage, multiplier = 1) {
  return score === null
    ? null
    : (Number(score) * Number(percentage) * multiplier) / 100;
}
function criterionScore(input) {
  if (input.attendance)
    return input.attendance.totalSessions
      ? Number(input.attendance.percentage)
      : null;
  return input.activityCount ? input.activityScore : input.directScore;
}
function totalScore(details) {
  if (!details.some((detail) => detail.score !== null)) return null;
  return details.reduce(
    (sum, detail) =>
      sum + (weightedScore(detail.score, detail.percentage) ?? 0),
    0,
  );
}
module.exports = {
  isAttendanceCriterion,
  attendancePercentage,
  averageScores,
  weightedScore,
  criterionScore,
  totalScore,
};
