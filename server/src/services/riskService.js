/**
 * Centralized Deadline Risk & Urgency Calculation Engine
 * 
 * Accurately evaluates assignment risk based on:
 * 1. Exact remaining time (dueDateTime - currentDateTime)
 * 2. Estimated completion workload vs remaining time
 * 3. Overdue detection and strict priority rules
 * 4. Consistent date/time and timezone synthesis
 */

/**
 * Combines dueDate (Date or YYYY-MM-DD string) and dueTime ("HH:mm" or "HH:mm:ss")
 * into an exact, unambiguous Date object.
 * 
 * DATE-ONLY RULE:
 * If an assignment has a due date but no due time specified, it defaults to the
 * end of that day (23:59:59.999) in the local application timezone.
 * This prevents assignments from falsely becoming overdue at 00:00:00 on their due day.
 */
export function combineDueDateTime(dueDate, dueTime) {
  if (!dueDate) return null;

  let year, month, day;

  if (dueDate instanceof Date) {
    if (isNaN(dueDate.getTime())) return null;
    year = dueDate.getFullYear();
    month = dueDate.getMonth();
    day = dueDate.getDate();
  } else if (typeof dueDate === "string") {
    // If it's a date string like "2026-09-22" or "2026-09-22T..."
    const parts = dueDate.split("T")[0].split("-");
    if (parts.length === 3) {
      year = parseInt(parts[0], 10);
      month = parseInt(parts[1], 10) - 1;
      day = parseInt(parts[2], 10);
    } else {
      const parsed = new Date(dueDate);
      if (isNaN(parsed.getTime())) return null;
      year = parsed.getFullYear();
      month = parsed.getMonth();
      day = parsed.getDate();
    }
  } else {
    return null;
  }

  let hours = 23;
  let minutes = 59;
  let seconds = 59;
  let milliseconds = 999;

  if (dueTime && typeof dueTime === "string" && dueTime.trim()) {
    const timeParts = dueTime.trim().split(":");
    if (timeParts.length >= 2) {
      const parsedH = parseInt(timeParts[0], 10);
      const parsedM = parseInt(timeParts[1], 10);
      const parsedS = timeParts[2] ? parseInt(timeParts[2], 10) : 0;
      if (!isNaN(parsedH) && parsedH >= 0 && parsedH <= 23) hours = parsedH;
      if (!isNaN(parsedM) && parsedM >= 0 && parsedM <= 59) minutes = parsedM;
      if (!isNaN(parsedS) && parsedS >= 0 && parsedS <= 59) seconds = parsedS;
      milliseconds = 0;
    }
  }

  const combined = new Date(year, month, day, hours, minutes, seconds, milliseconds);
  return isNaN(combined.getTime()) ? null : combined;
}

/**
 * Calculates deterministic, normalized deadline risk for an assignment.
 * 
 * Baseline Rules:
 * - CRITICAL:
 *   * Overdue (currentTime > dueDateTime)
 *   * <= 6 hours remaining (remainingMinutes <= 360)
 *   * Estimated completion time exceeds remaining time (estimatedMinutes > remainingMinutes)
 * - HIGH:
 *   * > 6 hours and <= 24 hours remaining (360 < remainingMinutes <= 1440)
 *   * <= 48 hours remaining AND high estimated workload (remainingMinutes <= 2880 && estimatedMinutes >= 240)
 * - MEDIUM:
 *   * > 24 hours and <= 72 hours remaining (1440 < remainingMinutes <= 4320)
 * - LOW:
 *   * > 72 hours remaining (remainingMinutes > 4320)
 * - UNKNOWN:
 *   * Due date is missing or invalid
 * 
 * STRICT INVARIANT:
 * No assignment with remainingMinutes <= 1440 (due today / within 24h) may be classified as LOW!
 */
export function calculateAssignmentRisk(assignment, currentTime = new Date()) {
  if (!assignment) {
    return {
      riskLevel: "UNKNOWN",
      riskScore: 0,
      remainingMinutes: 0,
      remainingHours: 0,
      isDueToday: false,
      isOverdue: false,
      isCompleted: false,
      estimatedCompletionMinutes: 180,
      reason: "No assignment data provided.",
    };
  }

  const isCompleted = assignment.status === "COMPLETED";
  const now = currentTime instanceof Date ? currentTime : new Date(currentTime);
  const dueDateTime = combineDueDateTime(assignment.dueDate, assignment.dueTime);

  if (!dueDateTime) {
    return {
      riskLevel: "UNKNOWN",
      riskScore: 0,
      remainingMinutes: 0,
      remainingHours: 0,
      isDueToday: false,
      isOverdue: false,
      isCompleted,
      estimatedCompletionMinutes: assignment.estimatedMinutes || 180,
      reason: "No valid due date specified.",
    };
  }

  // Exact difference in minutes
  const remainingMillis = dueDateTime.getTime() - now.getTime();
  const rawRemainingMinutes = Math.round(remainingMillis / (1000 * 60));
  const isOverdue = rawRemainingMinutes < 0;

  // Calendar comparison for "due today"
  const isDueToday = 
    dueDateTime.getFullYear() === now.getFullYear() &&
    dueDateTime.getMonth() === now.getMonth() &&
    dueDateTime.getDate() === now.getDate();

  const estimatedMinutes = Math.max(15, parseInt(assignment.estimatedMinutes, 10) || 180);
  const difficulty = Math.max(1, Math.min(5, parseInt(assignment.difficulty, 10) || 3));

  let riskLevel = "LOW";
  let reason = "";

  // 1. Evaluate Risk Level
  if (isOverdue) {
    riskLevel = "CRITICAL";
    const overdueHours = Math.abs(+(rawRemainingMinutes / 60).toFixed(1));
    reason = overdueHours >= 24 
      ? `Overdue by ${Math.floor(overdueHours / 24)}d ${Math.round(overdueHours % 24)}h. Immediate action required.` 
      : `Overdue by ${overdueHours} hours. Immediate submission required.`;
  } else if (rawRemainingMinutes <= 360) {
    // <= 6 hours remaining
    riskLevel = "CRITICAL";
    const remHours = +(rawRemainingMinutes / 60).toFixed(1);
    reason = `Critical deadline: Only ${remHours} hours remaining before cut-off.`;
  } else if (estimatedMinutes > rawRemainingMinutes) {
    // Workload exceeds available time
    riskLevel = "CRITICAL";
    const remHours = +(rawRemainingMinutes / 60).toFixed(1);
    const estHours = +(estimatedMinutes / 60).toFixed(1);
    reason = `Critical workload: Estimated completion (${estHours}h) exceeds remaining time (${remHours}h).`;
  } else if (rawRemainingMinutes <= 1440) {
    // Due within 24 hours / Due today
    riskLevel = "HIGH";
    const remHours = +(rawRemainingMinutes / 60).toFixed(1);
    reason = isDueToday
      ? `Due today with ${remHours} hours remaining.`
      : `High priority: Due in ${remHours} hours.`;
  } else if (rawRemainingMinutes <= 2880 && estimatedMinutes >= 240) {
    // Due within 48 hours with heavy workload (>= 4 hours)
    riskLevel = "HIGH";
    const remHours = +(rawRemainingMinutes / 60).toFixed(1);
    const estHours = +(estimatedMinutes / 60).toFixed(1);
    reason = `High workload: Due in ${remHours} hours with ${estHours} hours estimated study required.`;
  } else if (rawRemainingMinutes <= 4320) {
    // > 24 hours and <= 72 hours (up to 3 days)
    riskLevel = "MEDIUM";
    const remDays = Math.ceil(rawRemainingMinutes / 1440);
    const remHours = +(rawRemainingMinutes / 60).toFixed(1);
    reason = `Medium priority: Due in ${remDays} days (${remHours} hours remaining).`;
  } else {
    // > 72 hours
    riskLevel = "LOW";
    const remDays = Math.ceil(rawRemainingMinutes / 1440);
    reason = `Low risk: Due in ${remDays} days. Ample preparation time.`;
  }

  // Double-check invariant: Never allow LOW if <= 24 hours
  if (rawRemainingMinutes <= 1440 && riskLevel === "LOW") {
    riskLevel = "HIGH";
  }

  // 2. Deterministic Bounded Risk Score (0 to 100)
  // Component A: Deadline Urgency (0 to 60 points)
  let urgencyScore = 0;
  if (isOverdue) {
    urgencyScore = 60;
  } else if (rawRemainingMinutes <= 360) {
    urgencyScore = 55;
  } else if (rawRemainingMinutes <= 720) { // 12h
    urgencyScore = 48;
  } else if (rawRemainingMinutes <= 1440) { // 24h
    urgencyScore = 40;
  } else if (rawRemainingMinutes <= 2880) { // 48h
    urgencyScore = 28;
  } else if (rawRemainingMinutes <= 4320) { // 72h
    urgencyScore = 18;
  } else {
    // Scale down from 14 to 0 based on days beyond 3 days (capped at 14 days)
    const extraDays = (rawRemainingMinutes - 4320) / 1440;
    urgencyScore = Math.max(0, Math.round(14 - Math.min(14, extraDays)));
  }

  // Component B: Completion Pressure Ratio (estimatedMinutes / remainingMinutes) (0 to 30 points)
  let pressureScore = 0;
  if (isOverdue) {
    pressureScore = 30;
  } else {
    const ratio = estimatedMinutes / Math.max(1, rawRemainingMinutes);
    if (ratio >= 1.0) pressureScore = 30;
    else if (ratio >= 0.75) pressureScore = 25;
    else if (ratio >= 0.5) pressureScore = 20;
    else if (ratio >= 0.25) pressureScore = 12;
    else pressureScore = 5;
  }

  // Component C: Difficulty factor (2 to 10 points)
  const difficultyScore = difficulty * 2;

  const totalRawScore = isOverdue ? 100 : (urgencyScore + pressureScore + difficultyScore);
  const riskScore = Math.max(0, Math.min(100, Math.round(totalRawScore)));

  const displayRemainingMinutes = Math.max(0, rawRemainingMinutes);
  const displayRemainingHours = +(displayRemainingMinutes / 60).toFixed(1);

  return {
    riskLevel,
    riskScore,
    remainingMinutes: displayRemainingMinutes,
    remainingHours: displayRemainingHours,
    rawRemainingMinutes,
    isDueToday,
    isOverdue,
    isCompleted,
    estimatedCompletionMinutes: estimatedMinutes,
    reason,
    dueDateTime: dueDateTime.toISOString(),
  };
}

/**
 * Attaches calculated risk metadata directly to an assignment record.
 * Keeps backward-compatible assignment.deadlineRisk in sync with risk.riskLevel.
 */
export function attachRiskToAssignment(assignment, currentTime = new Date()) {
  if (!assignment) return assignment;

  const risk = calculateAssignmentRisk(assignment, currentTime);

  return {
    ...assignment,
    deadlineRisk: risk.riskLevel,
    isOverdue: risk.isOverdue,
    isDueToday: risk.isDueToday,
    risk,
  };
}
