import { google } from "googleapis";
import { getAuthenticatedClient } from "./googleAuthService.js";
import prisma from "../prisma.js";
import { combineDueDateTime, calculateAssignmentRisk } from "./riskService.js";

// Realistic sample courses with Subject Name and Subject Code
export const SAMPLE_COURSES = [
  {
    googleCourseId: "gc-cs301",
    name: "Data Structures & Algorithms",
    code: "CS 301",
    section: "Section A",
    room: "Hall 402",
    teacherName: "Dr. Evelyn Vance",
    color: "#3b82f6", // blue
  },
  {
    googleCourseId: "gc-cs305",
    name: "Distributed Systems & Cloud Computing",
    code: "CS 305",
    section: "Section B",
    room: "Lab 3",
    teacherName: "Prof. Marcus Brody",
    color: "#10b981", // emerald
  },
  {
    googleCourseId: "gc-math204",
    name: "Probability & Statistics for Engineers",
    code: "MATH 204",
    section: "Section 1",
    room: "Auditorium 2",
    teacherName: "Dr. Sarah Lin",
    color: "#f59e0b", // amber
  },
  {
    googleCourseId: "gc-eng102",
    name: "Technical Writing & Ethics in AI",
    code: "ENG 102",
    section: "Seminar 2",
    room: "Humanities 105",
    teacherName: "Prof. Arthur Pendelton",
    color: "#ec4899", // pink
  }
];

export function getSampleAssignments(courses) {
  const now = new Date();
  
  const inDays = (days, hour = 23, minute = 59) => {
    const d = new Date(now);
    d.setDate(d.getDate() + days);
    d.setHours(hour, minute, 0, 0);
    return d;
  };

  const cMap = {};
  courses.forEach(c => { 
    if (c.googleCourseId) cMap[c.googleCourseId] = c.id;
    if (c.code) cMap[c.code] = c.id;
  });

  const sampleList = [
    {
      classroomCourseworkId: "asg-cs301-ps4",
      title: "Problem Set 4: Dynamic Programming & Graph Flows",
      description: "Implement Dijkstra, Floyd-Warshall, and Bellman-Ford algorithms with benchmark tests on sparse graphs. Submit Jupyter notebook and formal PDF runtime analysis.",
      dueDate: inDays(3, 23, 59),
      dueTime: "23:59",
      estimatedMinutes: 360, // 6h
      difficulty: 4,
      priority: "HIGH",
      status: "IN_PROGRESS",
      deadlineRisk: "HIGH",
      notes: "Focus heavily on edge case handling for negative cycles.",
      courseId: cMap["gc-cs301"] || cMap["CS 301"] || courses[0].id,
      rubricSummary: "Complexity analysis (30%), Correctness & Edge Cases (40%), Benchmarking (30%)",
      aiAnalysis: JSON.stringify({
        summary: "Demanding algorithmic task with theoretical proofs and coding implementation.",
        timeEstimationHours: 6.0,
        recommendedDailyHours: 2.0,
        difficultyLabel: "Hard",
        keyFocusAreas: ["Negative weight edge detection", "Sparse graph representation", "Memory profiling"],
        tips: "Draft algorithm pseudocode first before starting benchmark test suite."
      }),
      driveAttachments: JSON.stringify([
        { 
          name: "PS4_Specification.pdf", 
          url: "https://drive.google.com/file/d/demo-ps4/view", 
          mimeType: "application/pdf",
          extractedText: "Assignment 4: Dynamic Programming and Single-Source Shortest Paths.\nObjective: Implement Bellman-Ford with cycle detection and benchmark against Dijkstra on sparse graphs containing V=10000, E=50000 vertices."
        },
        { 
          name: "sparse_graph_dataset.json", 
          url: "https://drive.google.com/file/d/demo-data/view", 
          mimeType: "application/json",
          extractedText: "Graph JSON adjacency list benchmark file (5.2 MB)."
        }
      ]),
      microTasks: [
        { title: "Review Graph Flow & Bellman-Ford theory", durationMinutes: 45, orderIndex: 0, completed: true },
        { title: "Implement graph algorithms in Python", durationMinutes: 90, orderIndex: 1, completed: true },
        { title: "Run benchmark tests & memory analysis", durationMinutes: 75, orderIndex: 2, completed: false },
        { title: "Write mathematical proofs & runtime report", durationMinutes: 90, orderIndex: 3, completed: false },
      ]
    },
    {
      classroomCourseworkId: "asg-cs305-raft",
      title: "Lab 2: Raft Consensus Algorithm Implementation",
      description: "Build leader election, heartbeat mechanism, and log replication module for a distributed key-value store using RPC protocols.",
      dueDate: inDays(4, 18, 0),
      dueTime: "18:00",
      estimatedMinutes: 480, // 8h
      difficulty: 5,
      priority: "URGENT",
      status: "PENDING",
      deadlineRisk: "CRITICAL",
      notes: "Requires deep debugging under network partition simulation.",
      courseId: cMap["gc-cs305"] || cMap["CS 305"] || courses[1].id,
      rubricSummary: "Election timeout handling (30%), Heartbeat replication (30%), Network partition resilience (40%)",
      aiAnalysis: JSON.stringify({
        summary: "Very high complexity distributed systems lab. Prone to race conditions and subtle timeout bugs.",
        timeEstimationHours: 8.0,
        recommendedDailyHours: 2.5,
        difficultyLabel: "Expert",
        keyFocusAreas: ["Leader heartbeat timers", "Term numbering and state persistence", "Split-brain avoidance"],
        tips: "Add verbose state machine logging early to trace leader election ballots."
      }),
      driveAttachments: JSON.stringify([
        { 
          name: "Raft_Consensus_Spec.pdf", 
          url: "https://drive.google.com/file/d/demo-raft/view", 
          mimeType: "application/pdf",
          extractedText: "CS 305 Raft Consensus Lab Specification.\nYou will implement Section 5 of the In Search of an Understandable Consensus Algorithm paper. Test using go test -run 2A."
        }
      ]),
      microTasks: [
        { title: "Study Raft state transition diagram", durationMinutes: 60, orderIndex: 0, completed: false },
        { title: "Write Election Timer and RequestVote RPC handlers", durationMinutes: 120, orderIndex: 1, completed: false },
        { title: "Implement AppendEntries log consistency check", durationMinutes: 150, orderIndex: 2, completed: false },
        { title: "Pass Chaos Network Split integration test", durationMinutes: 90, orderIndex: 3, completed: false },
      ]
    },
    {
      classroomCourseworkId: "asg-math204-hw6",
      title: "Homework 6: Bayesian Inference & Markov Chains",
      description: "Analytical derivations of posterior distributions using conjugate priors, and Metropolis-Hastings sampling simulation in Python.",
      dueDate: inDays(1, 23, 59),
      dueTime: "23:59",
      estimatedMinutes: 270, // 4.5h
      difficulty: 3,
      priority: "HIGH",
      status: "PENDING",
      deadlineRisk: "MODERATE",
      notes: "Check lecture 14 for conjugate Gamma-Poisson derivation.",
      courseId: cMap["gc-math204"] || cMap["MATH 204"] || courses[2].id,
      rubricSummary: "Mathematical derivation rigor (60%), MCMC convergence plot (40%)",
      aiAnalysis: JSON.stringify({
        summary: "Moderate mathematical difficulty combining algebraic derivations with simulation scripts.",
        timeEstimationHours: 4.5,
        recommendedDailyHours: 2.0,
        difficultyLabel: "Medium",
        keyFocusAreas: ["Beta-Binomial & Gamma-Poisson models", "Burn-in period diagnostics", "Trace plots"],
        tips: "Ensure proper burn-in removal before calculating sample variance."
      }),
      driveAttachments: JSON.stringify([
        { 
          name: "HW6_Probability_Problems.pdf", 
          url: "https://drive.google.com/file/d/demo-hw6/view", 
          mimeType: "application/pdf",
          extractedText: "MATH 204: Homework 6.\nQuestion 1: Suppose X ~ Poisson(lambda) with prior lambda ~ Gamma(alpha, beta). Show posterior is Gamma and compute MAP."
        }
      ]),
      microTasks: [
        { title: "Solve Problems 1-3 on Conjugate Priors", durationMinutes: 60, orderIndex: 0, completed: false },
        { title: "Derive Transition Kernel for Metropolis-Hastings", durationMinutes: 60, orderIndex: 1, completed: false },
        { title: "Simulate MCMC chain in Python and plot trace", durationMinutes: 90, orderIndex: 2, completed: false },
        { title: "Format LaTeX document for final submission", durationMinutes: 45, orderIndex: 3, completed: false },
      ]
    },
    {
      classroomCourseworkId: "asg-eng102-case",
      title: "Case Study: Algorithmic Bias in Autonomous Screening",
      description: "Analyze legal and ethical considerations in automated resume filtering pipelines. Propose an audit mitigation framework for demographic parity.",
      dueDate: inDays(7, 17, 0),
      dueTime: "17:00",
      estimatedMinutes: 210, // 3.5h
      difficulty: 2,
      priority: "LOW",
      status: "COMPLETED",
      completedAt: new Date(Date.now() - 3600 * 1000 * 24), // completed yesterday
      deadlineRisk: "LOW",
      actualMinutes: 195,
      notes: "Submitted draft to peer review forum.",
      courseId: cMap["gc-eng102"] || cMap["ENG 102"] || courses[3].id,
      rubricSummary: "Case background & analysis (40%), Mitigation plan (40%), Writing clarity (20%)",
      aiAnalysis: JSON.stringify({
        summary: "Ethics evaluation requiring structured essay writing and regulatory compliance references.",
        timeEstimationHours: 3.5,
        recommendedDailyHours: 1.0,
        difficultyLabel: "Accessible",
        keyFocusAreas: ["Title VII disparate impact", "False rejection parity", "Human-in-the-loop validation"],
        tips: "Structure with clear executive summary and tabulated policy recommendations."
      }),
      driveAttachments: JSON.stringify([
        { 
          name: "Algorithmic_Bias_Brief.docx", 
          url: "https://drive.google.com/file/d/demo-bias/view", 
          mimeType: "application/vnd.google-apps.document",
          extractedText: "Executive Case Study: AI in Recruiting.\nEvaluate the trade-offs between optimization objectives and adverse impact ratio across diverse applicant cohorts."
        }
      ]),
      microTasks: [
        { title: "Read case study background articles", durationMinutes: 45, orderIndex: 0, completed: true },
        { title: "Outline main ethical dilemmas & trade-offs", durationMinutes: 45, orderIndex: 1, completed: true },
        { title: "Draft 1500-word proposal & cited references", durationMinutes: 90, orderIndex: 2, completed: true },
      ]
    }
  ];

  return sampleList.map(item => ({
    ...item,
    deadlineRisk: calculateAssignmentRisk(item, now).riskLevel
  }));
}

/**
 * Intelligent Google Classroom Synchronization
 * STRICT RULES:
 * 1. Re-sync MUST NOT create duplicate assignments (matched by user_id + classroom_coursework_id).
 * 2. If locally deleted (deleted_at != null), DO NOT re-create or resurrect it.
 * 3. If locally COMPLETED, NEVER revert to PENDING.
 * 4. If locally edited (isLocallyEdited == true), PRESERVE user's custom title, description, due date, etc.
 * 5. NEVER call any Google Classroom delete endpoint.
 */
export async function syncClassroomData(user) {
  let isUsingMock = false;
  let syncedCount = 0;

  try {
    if (!user.accessToken || user.email === "demo.student@university.edu") {
      isUsingMock = true;
    } else {
      const auth = await getAuthenticatedClient(user);
      const classroom = google.classroom({ version: "v1", auth });

      const resCourses = await classroom.courses.list({
        courseStates: ["ACTIVE"],
        pageSize: 20,
      });

      const coursesData = resCourses.data.courses || [];

      if (coursesData.length === 0) {
        isUsingMock = true;
      } else {
        // Sync real Google Classroom courses
        for (const gCourse of coursesData) {
          // Extract subject code from course name if present e.g. "CS 101 - Intro"
          const codeMatch = gCourse.name.match(/^([A-Z]{2,4}\s*\d{3,4})/i);
          const courseCode = codeMatch ? codeMatch[1].toUpperCase() : (gCourse.section || "CRS");

          const course = await prisma.course.upsert({
            where: { id: `${user.id}-${gCourse.id}` },
            create: {
              id: `${user.id}-${gCourse.id}`,
              googleCourseId: gCourse.id,
              name: gCourse.name,
              code: courseCode,
              section: gCourse.section,
              room: gCourse.room,
              teacherName: gCourse.ownerId,
              userId: user.id,
            },
            update: {
              name: gCourse.name,
              code: courseCode,
              section: gCourse.section,
            },
          });

          // Fetch coursework from Google Classroom
          const resWork = await classroom.courses.courseWork.list({
            courseId: gCourse.id,
            courseWorkStates: ["PUBLISHED"],
            pageSize: 50,
          });

          const workItems = resWork.data.courseWork || [];
          for (const item of workItems) {
            const externalId = item.id;

            // Check if assignment already exists for this user by external ID
            const existing = await prisma.assignment.findFirst({
              where: {
                userId: user.id,
                classroomCourseworkId: externalId,
              }
            });

            // RULE 2: If soft-deleted by user, do not resurrect
            if (existing && existing.deletedAt) {
              continue;
            }

            let dueDate = null;
            let dueTime = "23:59";
            if (item.dueDate) {
              const yr = item.dueDate.year;
              const mo = item.dueDate.month || 1;
              const dy = item.dueDate.day || 1;
              if (item.dueTime) {
                const hh = String(item.dueTime.hours || 23).padStart(2, "0");
                const mm = String(item.dueTime.minutes || 59).padStart(2, "0");
                dueTime = `${hh}:${mm}`;
              }
              const dateStr = `${yr}-${String(mo).padStart(2, "0")}-${String(dy).padStart(2, "0")}`;
              dueDate = combineDueDateTime(dateStr, dueTime);
            } else {
              const d = new Date();
              d.setDate(d.getDate() + 7);
              dueDate = combineDueDateTime(d, "23:59");
            }

            const initialRisk = calculateAssignmentRisk({
              dueDate,
              dueTime,
              estimatedMinutes: 180,
              difficulty: 3,
            }, new Date());

            const attachments = (item.materials || []).map(m => {
              if (m.driveFile) return { name: m.driveFile.driveFile.title, url: m.driveFile.driveFile.alternateLink, mimeType: "application/pdf" };
              if (m.link) return { name: m.link.title || "External Link", url: m.link.url, mimeType: "link" };
              return null;
            }).filter(Boolean);

            if (existing) {
              // RULE 3 & 4: Preserve local status & local user edits
              const updateData = {
                driveAttachments: JSON.stringify(attachments),
              };

              // Only update title/description/due date if user HAS NOT manually edited locally
              if (!existing.isLocallyEdited) {
                updateData.title = item.title;
                updateData.description = item.description;
                updateData.dueDate = dueDate;
                updateData.dueTime = dueTime;
                updateData.deadlineRisk = initialRisk.riskLevel;
              }

              // NEVER overwrite COMPLETED with PENDING
              if (existing.status !== "COMPLETED") {
                // leave as current status
              }

              await prisma.assignment.update({
                where: { id: existing.id },
                data: updateData,
              });
            } else {
              // Insert new assignment with calculated risk
              await prisma.assignment.create({
                data: {
                  classroomCourseworkId: externalId,
                  title: item.title,
                  description: item.description,
                  dueDate,
                  dueTime,
                  estimatedMinutes: 180,
                  difficulty: 3,
                  priority: "MEDIUM",
                  deadlineRisk: initialRisk.riskLevel,
                  status: "PENDING",
                  courseId: course.id,
                  userId: user.id,
                  driveAttachments: JSON.stringify(attachments),
                }
              });
            }
            syncedCount++;
          }
        }
      }
    }
  } catch (err) {
    console.warn("Classroom API call failed, using mock data:", err.message);
    isUsingMock = true;
  }

  // Fallback demo mock seed if needed
  if (isUsingMock) {
    const existingCourses = await prisma.course.findMany({ where: { userId: user.id } });
    let savedCourses = existingCourses;

    if (existingCourses.length === 0) {
      for (const sc of SAMPLE_COURSES) {
        const c = await prisma.course.create({
          data: {
            ...sc,
            userId: user.id,
          }
        });
        savedCourses.push(c);
      }
    }

    const existingAssignments = await prisma.assignment.findMany({ 
      where: { userId: user.id } 
    });

    if (existingAssignments.length === 0) {
      const sampleAsgs = getSampleAssignments(savedCourses);
      for (const sa of sampleAsgs) {
        const { microTasks, ...asgData } = sa;
        const createdAsg = await prisma.assignment.create({
          data: {
            ...asgData,
            userId: user.id,
          }
        });

        if (microTasks && microTasks.length > 0) {
          for (const mt of microTasks) {
            await prisma.microTask.create({
              data: {
                ...mt,
                assignmentId: createdAsg.id,
              }
            });
          }
        }
        syncedCount++;
      }
    } else {
      syncedCount = existingAssignments.filter(a => !a.deletedAt).length;
    }
  }

  return { success: true, isUsingMock, syncedCount };
}