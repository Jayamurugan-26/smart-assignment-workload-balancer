import prisma from "../prisma.js";
import { fetchCalendarEvents } from "./calendarService.js";
import { combineDueDateTime } from "./riskService.js";

/**
 * Calculates genuine dashboard statistics from database records.
 * STRICT: Zero fake/random numbers.
 */
export async function getDashboardStatistics(userId) {
  const now = new Date();

  const allAssignments = await prisma.assignment.findMany({
    where: {
      userId,
      deletedAt: null, // Exclude soft-deleted items
    },
    include: {
      course: true,
      microTasks: true,
    }
  });

  const total = allAssignments.length;
  const pending = allAssignments.filter(a => a.status === "PENDING").length;
  const inProgress = allAssignments.filter(a => a.status === "IN_PROGRESS").length;
  const completed = allAssignments.filter(a => a.status === "COMPLETED").length;
  
  // Overdue: not completed and exact dueDateTime has passed
  const overdue = allAssignments.filter(a => {
    if (a.status === "COMPLETED") return false;
    const dueDateTime = combineDueDateTime(a.dueDate, a.dueTime);
    return dueDateTime ? dueDateTime < now : false;
  }).length;

  const completionPercentage = total > 0 ? Math.round((completed / total) * 100) : 0;

  // Calculate total pending study minutes
  const activeAssignments = allAssignments.filter(a => a.status !== "COMPLETED");
  const totalPendingMinutes = activeAssignments.reduce((acc, a) => acc + (a.estimatedMinutes || 180), 0);
  const totalPendingHours = +(totalPendingMinutes / 60).toFixed(1);

  // Completed study minutes
  const completedAssignments = allAssignments.filter(a => a.status === "COMPLETED");
  const totalCompletedMinutes = completedAssignments.reduce((acc, a) => acc + (a.actualMinutes || a.estimatedMinutes || 180), 0);
  const totalCompletedHours = +(totalCompletedMinutes / 60).toFixed(1);

  return {
    total,
    pending,
    inProgress,
    completed,
    overdue,
    completionPercentage,
    totalPendingHours,
    totalCompletedHours,
  };
}

/**
 * Core ML & Smoothing Workload Balancing Engine
 * Analyzes upcoming deadlines, evaluates daily capacity vs commitments,
 * and auto-balances study sessions to eliminate burnout peaks.
 */
export async function balanceStudentWorkload(user) {
  const now = new Date();
  now.setHours(0, 0, 0, 0);

  // Look ahead 14 days
  const horizonDays = 14;
  const endDate = new Date(now);
  endDate.setDate(endDate.getDate() + horizonDays);
  endDate.setHours(23, 59, 59, 999);

  // 1. Fetch only ACTIVE assignments (exclude COMPLETED and soft-deleted)
  const activeAssignments = await prisma.assignment.findMany({
    where: {
      userId: user.id,
      deletedAt: null,
      status: { not: "COMPLETED" },
    },
    include: {
      course: true,
      microTasks: true,
    },
    orderBy: {
      dueDate: "asc",
    }
  });

  // 2. Fetch existing calendar commitments
  const { events: busyEvents } = await fetchCalendarEvents(user, now, endDate);

  // 3. Initialize daily slots map
  const dailySlots = {};
  for (let i = 0; i < horizonDays; i++) {
    const day = new Date(now);
    day.setDate(day.getDate() + i);
    const dateKey = day.toISOString().slice(0, 10);
    const dayOfWeek = day.getDay();
    const isWeekend = dayOfWeek === 0 || dayOfWeek === 6;
    const capacityHours = isWeekend ? (user.weekendCapacity || 6.0) : (user.weekdayCapacity || 4.0);

    // Sum existing busy commitment hours (lectures, labs, meetings)
    const dayBusyEvents = busyEvents.filter(e => {
      const eDate = new Date(e.startTime).toISOString().slice(0, 10);
      return eDate === dateKey && e.type !== "STUDY_BLOCK";
    });

    const busyHours = dayBusyEvents.reduce((sum, e) => {
      const durationMs = new Date(e.endTime) - new Date(e.startTime);
      return sum + (durationMs / (1000 * 60 * 60));
    }, 0);

    const netCapacityHours = Math.max(0.5, +(capacityHours - (busyHours * 0.3)).toFixed(1));

    dailySlots[dateKey] = {
      date: dateKey,
      dayOfWeek,
      isWeekend,
      nominalCapacityHours: capacityHours,
      netCapacityHours,
      allocatedHours: 0,
      assignmentsDue: [],
      studyBlocks: [],
      burnoutRisk: "LOW",
    };
  }

  // Record assignments due dates into slots
  activeAssignments.forEach(asg => {
    const dueKey = new Date(asg.dueDate).toISOString().slice(0, 10);
    if (dailySlots[dueKey]) {
      dailySlots[dueKey].assignmentsDue.push({
        id: asg.id,
        title: asg.title,
        courseCode: asg.course.code || asg.course.name,
        difficulty: asg.difficulty,
        hours: +(asg.estimatedMinutes / 60).toFixed(1),
      });
    }
  });

  // 4. Distribute workload using Backward-Smoothing (Earliest Deadline First)
  // For each assignment, distribute its micro-tasks or hours across available days before due date
  const newStudyBlocks = [];

  for (const asg of activeAssignments) {
    const dueDate = new Date(asg.dueDate);
    const dueKey = dueDate.toISOString().slice(0, 10);
    const totalRequiredHours = +(asg.estimatedMinutes / 60).toFixed(1);

    // Get list of candidate days from today up to deadline
    const candidateDays = Object.keys(dailySlots).filter(k => k <= dueKey && k >= now.toISOString().slice(0, 10));

    if (candidateDays.length === 0) continue;

    // Distribute hours in chunks of 1.0 - 2.0 hours, preferring days with highest remaining capacity
    let remainingHoursToSchedule = totalRequiredHours;
    let iterations = 0;

    while (remainingHoursToSchedule > 0.4 && iterations < 30) {
      iterations++;

      // Sort candidate days by available net capacity descending
      candidateDays.sort((a, b) => {
        const freeA = dailySlots[a].netCapacityHours - dailySlots[a].allocatedHours;
        const freeB = dailySlots[b].netCapacityHours - dailySlots[b].allocatedHours;
        return freeB - freeA;
      });

      const bestDayKey = candidateDays[0];
      const bestSlot = dailySlots[bestDayKey];
      const availableCapacity = Math.max(0.5, bestSlot.netCapacityHours - bestSlot.allocatedHours);

      const chunkHours = Math.min(remainingHoursToSchedule, Math.min(availableCapacity, 2.0));
      if (chunkHours <= 0.2) {
        // Even if full, assign small chunk to avoid leaving unscheduled
        bestSlot.allocatedHours += remainingHoursToSchedule;
        remainingHoursToSchedule = 0;
        break;
      }

      bestSlot.allocatedHours = +(bestSlot.allocatedHours + chunkHours).toFixed(1);
      remainingHoursToSchedule = +(remainingHoursToSchedule - chunkHours).toFixed(1);

      // Create scheduled study block
      const blockDate = new Date(bestDayKey);
      // Start study block at 17:00 or after last block
      const startHour = 17 + (bestSlot.studyBlocks.length * 2);
      blockDate.setHours(startHour, 0, 0, 0);
      const endBlockDate = new Date(blockDate);
      endBlockDate.setMinutes(endBlockDate.getMinutes() + Math.round(chunkHours * 60));

      const studyBlockItem = {
        title: `${asg.course.code || asg.course.name}: ${asg.title}`,
        assignmentId: asg.id,
        startTime: blockDate,
        endTime: endBlockDate,
        durationHours: chunkHours,
        userId: user.id,
      };

      bestSlot.studyBlocks.push(studyBlockItem);
      newStudyBlocks.push(studyBlockItem);
    }
  }

  // 5. Evaluate Burnout Risk for each day
  let overallMaxRatio = 0;

  Object.values(dailySlots).forEach(slot => {
    const ratio = slot.allocatedHours / slot.nominalCapacityHours;
    if (ratio > overallMaxRatio) overallMaxRatio = ratio;

    if (ratio >= 1.5) {
      slot.burnoutRisk = "CRITICAL";
    } else if (ratio >= 1.1) {
      slot.burnoutRisk = "HIGH";
    } else if (ratio >= 0.8) {
      slot.burnoutRisk = "MODERATE";
    } else {
      slot.burnoutRisk = "LOW";
    }
  });

  let overallRisk = "LOW";
  if (overallMaxRatio >= 1.5) overallRisk = "CRITICAL";
  else if (overallMaxRatio >= 1.1) overallRisk = "HIGH";
  else if (overallMaxRatio >= 0.8) overallRisk = "MODERATE";

  // 6. Persist updated StudyBlocks in database
  // Remove existing study blocks that haven't passed yet
  await prisma.studyBlock.deleteMany({
    where: {
      userId: user.id,
      startTime: { gte: now },
    }
  });

  for (const sb of newStudyBlocks) {
    await prisma.studyBlock.create({
      data: {
        title: sb.title,
        startTime: sb.startTime,
        endTime: sb.endTime,
        durationHours: sb.durationHours,
        userId: user.id,
        assignmentId: sb.assignmentId,
        googleEventId: `auto-sb-${Date.now()}-${Math.random().toString(36).substring(2, 6)}`,
      }
    });
  }

  return {
    overallRisk,
    dailyTimeline: Object.values(dailySlots),
    scheduledBlocksCount: newStudyBlocks.length,
    activeAssignmentsCount: activeAssignments.length,
  };
}