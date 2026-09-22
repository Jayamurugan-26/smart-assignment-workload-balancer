/**
 * Client-side Deadline Risk & Urgency Engine
 * 
 * Provides:
 * 1. Safe due date + due time synthesis (defaults to 23:59:59 for date-only)
 * 2. Deterministic risk calculation mirroring backend riskService.js
 * 3. Human-readable duration formatting and "Why this risk?" explanations
 * 4. Consistent UI theme styling for CRITICAL, HIGH, MEDIUM, LOW, and UNKNOWN
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

export function calculateClientRisk(assignment, currentTime = new Date()) {
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

  const remainingMillis = dueDateTime.getTime() - now.getTime();
  const rawRemainingMinutes = Math.round(remainingMillis / (1000 * 60));
  const isOverdue = rawRemainingMinutes < 0;

  const isDueToday = 
    dueDateTime.getFullYear() === now.getFullYear() &&
    dueDateTime.getMonth() === now.getMonth() &&
    dueDateTime.getDate() === now.getDate();

  const estimatedMinutes = Math.max(15, parseInt(assignment.estimatedMinutes, 10) || 180);
  const difficulty = Math.max(1, Math.min(5, parseInt(assignment.difficulty, 10) || 3));

  let riskLevel = "LOW";
  let reason = "";

  if (isOverdue) {
    riskLevel = "CRITICAL";
    const overdueMins = Math.abs(rawRemainingMinutes);
    if (overdueMins < 60) {
      reason = `Overdue by ${overdueMins} minute${overdueMins === 1 ? "" : "s"}.`;
    } else {
      const overdueHours = +(overdueMins / 60).toFixed(1);
      reason = `Overdue by ${overdueHours} hour${overdueHours === 1 ? "" : "s"}. Immediate action required!`;
    }
  } else if (rawRemainingMinutes <= 360) {
    riskLevel = "CRITICAL";
    const remH = +(rawRemainingMinutes / 60).toFixed(1);
    reason = `Critical: Due in only ${remH} hour${remH === 1 ? "" : "s"} (${rawRemainingMinutes} mins remaining).`;
  } else if (estimatedMinutes > rawRemainingMinutes) {
    riskLevel = "CRITICAL";
    const estH = +(estimatedMinutes / 60).toFixed(1);
    const remH = +(rawRemainingMinutes / 60).toFixed(1);
    reason = `Critical overload: Estimated work (${estH}h) exceeds remaining time (${remH}h).`;
  } else if (rawRemainingMinutes <= 1440) {
    riskLevel = "HIGH";
    const remH = +(rawRemainingMinutes / 60).toFixed(1);
    if (isDueToday) {
      reason = `High priority: Due today in ${remH} hours. Complete promptly.`;
    } else {
      reason = `High priority: Due within 24 hours (${remH}h remaining).`;
    }
  } else if (rawRemainingMinutes <= 2880 && estimatedMinutes >= 240) {
    riskLevel = "HIGH";
    const estH = +(estimatedMinutes / 60).toFixed(1);
    const remH = +(rawRemainingMinutes / 60).toFixed(1);
    reason = `High workload: Requires ${estH}h of work with ${remH}h left before deadline.`;
  } else if (rawRemainingMinutes <= 4320) {
    riskLevel = "MEDIUM";
    const remDays = +(rawRemainingMinutes / 1440).toFixed(1);
    reason = `Moderate priority: Due in ${remDays} days. Schedule study blocks soon.`;
  } else {
    riskLevel = "LOW";
    const remDays = Math.floor(rawRemainingMinutes / 1440);
    reason = `On track: Due in ${remDays} days. Sufficient preparation window available.`;
  }

  // Calculate normalized 0-100 score
  let urgencyScore = 0;
  if (isOverdue) {
    urgencyScore = 60;
  } else if (rawRemainingMinutes <= 360) {
    urgencyScore = 60 - Math.round((rawRemainingMinutes / 360) * 15);
  } else if (rawRemainingMinutes <= 1440) {
    urgencyScore = 45 - Math.round(((rawRemainingMinutes - 360) / 1080) * 15);
  } else if (rawRemainingMinutes <= 4320) {
    urgencyScore = 30 - Math.round(((rawRemainingMinutes - 1440) / 2880) * 15);
  } else {
    urgencyScore = Math.max(0, 15 - Math.round(((rawRemainingMinutes - 4320) / 10080) * 15));
  }

  let pressureScore = 0;
  if (isOverdue) {
    pressureScore = 25;
  } else if (rawRemainingMinutes > 0) {
    const ratio = estimatedMinutes / rawRemainingMinutes;
    if (ratio >= 1.0) {
      pressureScore = 25;
    } else {
      pressureScore = Math.round(ratio * 25);
    }
  }

  const difficultyScore = Math.round(((difficulty - 1) / 4) * 15);
  const totalRawScore = isOverdue ? 100 : (urgencyScore + pressureScore + difficultyScore);
  const riskScore = Math.max(0, Math.min(100, Math.round(totalRawScore)));

  return {
    riskLevel,
    riskScore,
    remainingMinutes: isOverdue ? 0 : rawRemainingMinutes,
    remainingHours: +( (isOverdue ? 0 : rawRemainingMinutes) / 60 ).toFixed(1),
    rawRemainingMinutes,
    isDueToday,
    isOverdue,
    isCompleted,
    estimatedCompletionMinutes: estimatedMinutes,
    reason,
  };
}

export function getResolvedRisk(assignment) {
  if (!assignment) return calculateClientRisk(null);
  // If backend provided a detailed risk object with reason, prioritize it
  if (assignment.risk && assignment.risk.riskLevel && assignment.risk.reason) {
    return {
      ...assignment.risk,
      riskLevel: assignment.risk.riskLevel === "MODERATE" ? "MEDIUM" : assignment.risk.riskLevel,
    };
  }
  return calculateClientRisk(assignment);
}

export const RISK_THEMES = {
  CRITICAL: {
    label: "CRITICAL",
    colorName: "rose",
    badge: "text-rose-700 dark:text-rose-400 bg-rose-50 dark:bg-rose-950/50 border-rose-200 dark:border-rose-800/60",
    border: "border-rose-500/50 dark:border-rose-500/40 shadow-rose-500/10",
    bar: "bg-rose-500",
    dot: "bg-rose-500",
  },
  HIGH: {
    label: "HIGH",
    colorName: "orange",
    badge: "text-orange-700 dark:text-orange-400 bg-orange-50 dark:bg-orange-950/50 border-orange-200 dark:border-orange-800/60",
    border: "border-orange-400/40 dark:border-orange-500/30",
    bar: "bg-orange-500",
    dot: "bg-orange-500",
  },
  MEDIUM: {
    label: "MEDIUM",
    colorName: "amber",
    badge: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800/60",
    border: "border-amber-400/30 dark:border-amber-500/20",
    bar: "bg-amber-500",
    dot: "bg-amber-500",
  },
  MODERATE: {
    label: "MEDIUM",
    colorName: "amber",
    badge: "text-amber-700 dark:text-amber-400 bg-amber-50 dark:bg-amber-950/50 border-amber-200 dark:border-amber-800/60",
    border: "border-amber-400/30 dark:border-amber-500/20",
    bar: "bg-amber-500",
    dot: "bg-amber-500",
  },
  LOW: {
    label: "LOW",
    colorName: "emerald",
    badge: "text-emerald-700 dark:text-emerald-400 bg-emerald-50 dark:bg-emerald-950/40 border-emerald-200 dark:border-emerald-800/50",
    border: "border-slate-200 dark:border-slate-800",
    bar: "bg-emerald-500",
    dot: "bg-emerald-500",
  },
  UNKNOWN: {
    label: "UNKNOWN",
    colorName: "slate",
    badge: "text-slate-600 dark:text-slate-400 bg-slate-100 dark:bg-slate-800/50 border-slate-200 dark:border-slate-700",
    border: "border-slate-200 dark:border-slate-800",
    bar: "bg-slate-400",
    dot: "bg-slate-400",
  },
};

export function formatTimeRemaining(remainingMinutes, isOverdue) {
  if (isOverdue) return "Overdue";
  if (remainingMinutes == null || isNaN(remainingMinutes)) return "Unknown";
  if (remainingMinutes <= 0) return "Due now";
  if (remainingMinutes < 60) return `${remainingMinutes}m left`;
  const hours = +(remainingMinutes / 60).toFixed(1);
  if (hours < 24) return `${hours}h left`;
  const days = Math.round(remainingMinutes / 1440);
  return `${days}d left`;
}
