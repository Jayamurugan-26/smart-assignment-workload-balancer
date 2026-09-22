import express from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { notifyAssignmentCompleted } from "../services/notificationService.js";
import prisma from "../prisma.js";
import { 
  combineDueDateTime, 
  calculateAssignmentRisk, 
  attachRiskToAssignment 
} from "../services/riskService.js";

const router = express.Router();

/**
 * GET /api/assignments
 * Fetch assignments for the authenticated user.
 * Supports query: ?status=PENDING|IN_PROGRESS|COMPLETED|ALL
 * Excludes soft-deleted assignments.
 */
router.get("/", requireAuth, async (req, res) => {
  const { status, courseId } = req.query;

  try {
    const whereClause = {
      userId: req.user.id,
      deletedAt: null, // Never return soft-deleted assignments
    };

    if (status && status !== "ALL") {
      whereClause.status = status;
    }

    if (courseId) {
      whereClause.courseId = courseId;
    }

    const assignments = await prisma.assignment.findMany({
      where: whereClause,
      include: {
        course: true,
        microTasks: {
          orderBy: { orderIndex: "asc" }
        },
        studyBlocks: {
          orderBy: { startTime: "asc" }
        }
      },
      orderBy: [
        { dueDate: "asc" },
        { priority: "desc" }
      ]
    });

    const assignmentsWithRisk = assignments.map(a => attachRiskToAssignment(a, new Date()));
    res.json({ assignments: assignmentsWithRisk });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch assignments", details: err.message });
  }
});

/**
 * GET /api/assignments/completed
 * Dedicated endpoint for Completed assignments section.
 */
router.get("/completed", requireAuth, async (req, res) => {
  try {
    const completedAssignments = await prisma.assignment.findMany({
      where: {
        userId: req.user.id,
        status: "COMPLETED",
        deletedAt: null,
      },
      include: {
        course: true,
        microTasks: true,
      },
      orderBy: {
        completedAt: "desc"
      }
    });

    const completedWithRisk = completedAssignments.map(a => attachRiskToAssignment(a, new Date()));
    res.json({ assignments: completedWithRisk });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch completed assignments", details: err.message });
  }
});

/**
 * GET /api/assignments/:id
 * Detailed assignment view.
 */
router.get("/:id", requireAuth, async (req, res) => {
  try {
    const assignment = await prisma.assignment.findFirst({
      where: {
        id: req.params.id,
        userId: req.user.id,
        deletedAt: null,
      },
      include: {
        course: true,
        microTasks: {
          orderBy: { orderIndex: "asc" }
        },
        studyBlocks: true,
      }
    });

    if (!assignment) {
      return res.status(404).json({ error: "Assignment not found" });
    }

    res.json({ assignment: attachRiskToAssignment(assignment, new Date()) });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch assignment details", details: err.message });
  }
});

/**
 * POST /api/assignments
 * Create a new assignment.
 */
router.post("/", requireAuth, async (req, res) => {
  const {
    title,
    description,
    dueDate,
    dueTime,
    difficulty,
    estimatedMinutes,
    priority,
    courseId,
    notes,
  } = req.body;

  if (!title || !title.trim()) {
    return res.status(400).json({ error: "Assignment title is required" });
  }

  try {
    let targetCourseId = courseId;
    if (!targetCourseId) {
      const firstCourse = await prisma.course.findFirst({ where: { userId: req.user.id } });
      if (!firstCourse) {
        return res.status(400).json({ error: "No course found. Please connect Google Classroom or create a course." });
      }
      targetCourseId = firstCourse.id;
    }

    const combinedDueDate = combineDueDateTime(dueDate || new Date(), dueTime || "23:59");
    const diff = Math.max(1, Math.min(5, parseInt(difficulty, 10) || 3));
    const est = Math.max(15, parseInt(estimatedMinutes, 10) || 180);
    const prio = ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority) ? priority : "MEDIUM";

    const initialRisk = calculateAssignmentRisk({
      dueDate: combinedDueDate,
      dueTime: dueTime || "23:59",
      difficulty: diff,
      estimatedMinutes: est,
    }, new Date());

    const created = await prisma.assignment.create({
      data: {
        title: title.trim(),
        description: description ? description.trim() : null,
        dueDate: combinedDueDate || new Date(),
        dueTime: dueTime || "23:59",
        difficulty: diff,
        estimatedMinutes: est,
        priority: prio,
        status: "PENDING",
        deadlineRisk: initialRisk.riskLevel,
        isLocallyEdited: true,
        notes: notes || null,
        courseId: targetCourseId,
        userId: req.user.id,
      },
      include: {
        course: true,
        microTasks: true,
      }
    });

    const assignmentWithRisk = attachRiskToAssignment(created, new Date());

    const io = req.app.get("io");
    if (io) {
      io.to(req.user.id).emit("assignment:created", { assignment: assignmentWithRisk });
      io.to(req.user.id).emit("productivity:updated");
    }

    res.status(201).json({
      success: true,
      assignment: assignmentWithRisk,
    });
  } catch (err) {
    console.error("Create assignment error:", err);
    res.status(500).json({ error: "Failed to create assignment", details: err.message });
  }
});

/**
 * PATCH /api/assignments/:id
 * Edit local assignment information.
 * Does NOT modify Google Classroom coursework.
 * Clearly marks record with isLocallyEdited = true.
 */
router.patch("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;
  const {
    title,
    description,
    dueDate,
    dueTime,
    difficulty,
    estimatedMinutes,
    priority,
    notes,
  } = req.body;

  try {
    // 1. Verify existence and ownership
    const existing = await prisma.assignment.findFirst({
      where: { id, userId: req.user.id, deletedAt: null }
    });

    if (!existing) {
      return res.status(404).json({ error: "Assignment not found or access denied" });
    }

    // 2. Prepare validated update payload
    const updateData = {
      isLocallyEdited: true, // Clearly mark as local customization
    };

    if (title !== undefined && title.trim()) updateData.title = title.trim();
    if (description !== undefined) updateData.description = description.trim();
    
    const targetDueTime = dueTime !== undefined ? dueTime : existing.dueTime;
    if (dueTime !== undefined) updateData.dueTime = dueTime;

    if (dueDate) {
      const combined = combineDueDateTime(dueDate, targetDueTime);
      updateData.dueDate = combined || new Date(dueDate);
    } else if (dueTime !== undefined && existing.dueDate) {
      const combined = combineDueDateTime(existing.dueDate, dueTime);
      updateData.dueDate = combined || existing.dueDate;
    }

    if (difficulty !== undefined) updateData.difficulty = Math.max(1, Math.min(5, parseInt(difficulty, 10)));
    if (estimatedMinutes !== undefined) updateData.estimatedMinutes = Math.max(15, parseInt(estimatedMinutes, 10));
    if (priority && ["LOW", "MEDIUM", "HIGH", "URGENT"].includes(priority)) updateData.priority = priority;
    if (notes !== undefined) updateData.notes = notes;

    // Recalculate risk on update and store
    const risk = calculateAssignmentRisk({
      ...existing,
      ...updateData,
    }, new Date());
    updateData.deadlineRisk = risk.riskLevel;

    const updated = await prisma.assignment.update({
      where: { id },
      data: updateData,
      include: {
        course: true,
        microTasks: true,
      }
    });

    const assignmentWithRisk = attachRiskToAssignment(updated, new Date());

    // 3. Emit real-time Socket.IO event if available
    const io = req.app.get("io");
    if (io) {
      io.to(req.user.id).emit("assignment:updated", { assignment: assignmentWithRisk });
      io.to(req.user.id).emit("productivity:updated");
    }

    res.json({
      success: true,
      message: "Assignment updated locally",
      assignment: assignmentWithRisk,
    });
  } catch (err) {
    console.error("Update assignment error:", err);
    res.status(500).json({ error: "Failed to update assignment", details: err.message });
  }
});

/**
 * PATCH /api/assignments/:id/status
 * Mark as Done (COMPLETED) or Mark as Undone (RESTORE to PENDING/IN_PROGRESS).
 * Does NOT submit/turn in to Google Classroom.
 */
router.patch("/:id/status", requireAuth, async (req, res) => {
  const { id } = req.params;
  const { status, actualMinutes } = req.body;

  if (!status || !["PENDING", "IN_PROGRESS", "COMPLETED"].includes(status)) {
    return res.status(400).json({ error: "Invalid status value" });
  }

  try {
    const existing = await prisma.assignment.findFirst({
      where: { id, userId: req.user.id, deletedAt: null }
    });

    if (!existing) {
      return res.status(404).json({ error: "Assignment not found or access denied" });
    }

    const updateData = { status };

    if (status === "COMPLETED") {
      updateData.completedAt = new Date();
      if (actualMinutes) {
        updateData.actualMinutes = parseInt(actualMinutes, 10);
      }
    } else if (status === "IN_PROGRESS") {
      if (!existing.startedAt) {
        updateData.startedAt = new Date();
      }
    } else {
      // Mark as Undone / Restore
      updateData.completedAt = null;
    }

    const updated = await prisma.assignment.update({
      where: { id },
      data: updateData,
      include: {
        course: true,
        microTasks: true,
      }
    });

    const assignmentWithRisk = attachRiskToAssignment(updated, new Date());

    // Emit real-time Socket.IO event
    const io = req.app.get("io");
    if (io) {
      io.to(req.user.id).emit("assignment:status_changed", {
        assignmentId: updated.id,
        status: updated.status,
        completedAt: updated.completedAt,
        startedAt: updated.startedAt,
        assignment: assignmentWithRisk,
      });
      io.to(req.user.id).emit("productivity:updated");

      if (status === "COMPLETED") {
        await notifyAssignmentCompleted({
          userId: req.user.id,
          assignment: assignmentWithRisk,
          io,
        });
      }
    }

    res.json({
      success: true,
      message: status === "COMPLETED" ? "Marked as completed" : "Restored to active workload",
      assignment: assignmentWithRisk,
    });
  } catch (err) {
    console.error("Change status error:", err);
    res.status(500).json({ error: "Failed to update status", details: err.message });
  }
});

/**
 * DELETE /api/assignments/:id
 * Remove assignment from dashboard.
 * Soft-delete only. NEVER call Google Classroom delete endpoint.
 */
router.delete("/:id", requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const existing = await prisma.assignment.findFirst({
      where: { id, userId: req.user.id, deletedAt: null }
    });

    if (!existing) {
      return res.status(404).json({ error: "Assignment not found or access denied" });
    }

    // Soft delete: keep classroomCourseworkId to avoid duplicate recreation on sync
    await prisma.assignment.update({
      where: { id },
      data: {
        deletedAt: new Date(),
        status: "DELETED",
      }
    });

    // Remove any scheduled study blocks for this deleted assignment
    await prisma.studyBlock.deleteMany({
      where: { assignmentId: id }
    });

    // Emit real-time Socket.IO event
    const io = req.app.get("io");
    if (io) {
      io.to(req.user.id).emit("assignment:deleted", { assignmentId: id });
      io.to(req.user.id).emit("productivity:updated");
    }

    res.json({
      success: true,
      message: "Assignment removed from dashboard. Google Classroom original remains untouched.",
    });
  } catch (err) {
    console.error("Delete assignment error:", err);
    res.status(500).json({ error: "Failed to remove assignment", details: err.message });
  }
});

/**
 * POST /api/assignments/:id/microtasks/:taskId/toggle
 * Toggle microtask completion state
 */
router.post("/:id/microtasks/:taskId/toggle", requireAuth, async (req, res) => {
  const { id, taskId } = req.params;

  try {
    const task = await prisma.microTask.findFirst({
      where: { id: taskId, assignmentId: id, assignment: { userId: req.user.id } }
    });

    if (!task) return res.status(404).json({ error: "Microtask not found" });

    const updated = await prisma.microTask.update({
      where: { id: taskId },
      data: { completed: !task.completed }
    });

    res.json({ success: true, microTask: updated });
  } catch (err) {
    res.status(500).json({ error: "Failed to toggle microtask", details: err.message });
  }
});

export default router;