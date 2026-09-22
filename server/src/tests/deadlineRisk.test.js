import assert from "assert";
import { calculateAssignmentRisk, combineDueDateTime } from "../services/riskService.js";

console.log("🧪 Running Deadline Risk Calculation Test Suite...\n");

// Base date: Sep 22, 2026, 10:00 AM local time
const current = new Date(2026, 8, 22, 10, 0, 0, 0); // Note: Month 8 is September (0-indexed)

console.log(`Reference Current Time: ${current.toLocaleString()}`);

// TEST 1: Current: Sep 22, 10:00 AM | Due: Sep 22, 4:00 PM (6 hours)
{
  const asg = {
    dueDate: new Date(2026, 8, 22),
    dueTime: "16:00",
    estimatedMinutes: 180,
  };
  const result = calculateAssignmentRisk(asg, current);
  console.log("TEST 1 (6h remaining):", result.riskLevel, `[Score: ${result.riskScore}]`, `[Reason: ${result.reason}]`);
  assert.strictEqual(result.riskLevel, "CRITICAL", "Test 1 failed: 6 hours remaining must be CRITICAL");
  assert.strictEqual(result.remainingHours, 6.0);
  assert.strictEqual(result.isDueToday, true);
  assert.strictEqual(result.isOverdue, false);
}

// TEST 2: Current: Sep 22, 10:00 AM | Due: Sep 22, 11:00 PM (13 hours)
{
  const asg = {
    dueDate: new Date(2026, 8, 22),
    dueTime: "23:00",
    estimatedMinutes: 180,
  };
  const result = calculateAssignmentRisk(asg, current);
  console.log("TEST 2 (13h remaining):", result.riskLevel, `[Score: ${result.riskScore}]`, `[Reason: ${result.reason}]`);
  assert.strictEqual(result.riskLevel, "HIGH", "Test 2 failed: 13 hours remaining must be HIGH");
  assert.strictEqual(result.remainingHours, 13.0);
  assert.strictEqual(result.isDueToday, true);
}

// TEST 3: Current: Sep 22, 10:00 AM | Due: Sep 23, 10:00 AM (24 hours)
{
  const asg = {
    dueDate: new Date(2026, 8, 23),
    dueTime: "10:00",
    estimatedMinutes: 180,
  };
  const result = calculateAssignmentRisk(asg, current);
  console.log("TEST 3 (24h remaining):", result.riskLevel, `[Score: ${result.riskScore}]`, `[Reason: ${result.reason}]`);
  assert.strictEqual(result.riskLevel, "HIGH", "Test 3 failed: 24 hours remaining must be HIGH");
  assert.strictEqual(result.remainingHours, 24.0);
}

// TEST 4: Current: Sep 22, 10:00 AM | Due: Sep 25, 10:00 AM (72 hours)
{
  const asg = {
    dueDate: new Date(2026, 8, 25),
    dueTime: "10:00",
    estimatedMinutes: 180,
  };
  const result = calculateAssignmentRisk(asg, current);
  console.log("TEST 4 (72h remaining):", result.riskLevel, `[Score: ${result.riskScore}]`, `[Reason: ${result.reason}]`);
  assert.strictEqual(result.riskLevel, "MEDIUM", "Test 4 failed: 72 hours remaining must be MEDIUM");
  assert.strictEqual(result.remainingHours, 72.0);
}

// TEST 5: Current: Sep 22, 10:00 AM | Due: Sep 30, 10:00 AM (8 days)
{
  const asg = {
    dueDate: new Date(2026, 8, 30),
    dueTime: "10:00",
    estimatedMinutes: 180,
  };
  const result = calculateAssignmentRisk(asg, current);
  console.log("TEST 5 (8 days remaining):", result.riskLevel, `[Score: ${result.riskScore}]`, `[Reason: ${result.reason}]`);
  assert.strictEqual(result.riskLevel, "LOW", "Test 5 failed: 8 days remaining must be LOW");
  assert.strictEqual(result.isDueToday, false);
}

// TEST 6: Current: Sep 22, 10:00 AM | Due: Sep 21, 10:00 AM (Overdue)
{
  const asg = {
    dueDate: new Date(2026, 8, 21),
    dueTime: "10:00",
    estimatedMinutes: 180,
  };
  const result = calculateAssignmentRisk(asg, current);
  console.log("TEST 6 (Overdue):", result.riskLevel, `[Score: ${result.riskScore}]`, `[Reason: ${result.reason}]`);
  assert.strictEqual(result.riskLevel, "CRITICAL", "Test 6 failed: Overdue assignment must be CRITICAL");
  assert.strictEqual(result.isOverdue, true, "Test 6 failed: isOverdue must be true");
  assert.strictEqual(result.riskScore, 100, "Test 6 failed: Overdue risk score should be 100");
}

// TEST 7: Current: Sep 22, 10:00 AM | Due: Sep 22, 8:00 PM (10h remaining, 12h estimated)
{
  const asg = {
    dueDate: new Date(2026, 8, 22),
    dueTime: "20:00",
    estimatedMinutes: 720, // 12 hours
  };
  const result = calculateAssignmentRisk(asg, current);
  console.log("TEST 7 (10h remaining, 12h estimated):", result.riskLevel, `[Score: ${result.riskScore}]`, `[Reason: ${result.reason}]`);
  assert.strictEqual(result.riskLevel, "CRITICAL", "Test 7 failed: When estimated workload > remaining time, must be CRITICAL");
  assert.strictEqual(result.remainingHours, 10.0);
}

// TEST 8: Current: Sep 22, 10:00 AM | Due: Sep 22, 8:00 PM (10h remaining, 1h estimated)
{
  const asg = {
    dueDate: new Date(2026, 8, 22),
    dueTime: "20:00",
    estimatedMinutes: 60, // 1 hour
  };
  const result = calculateAssignmentRisk(asg, current);
  console.log("TEST 8 (10h remaining, 1h estimated):", result.riskLevel, `[Score: ${result.riskScore}]`, `[Reason: ${result.reason}]`);
  assert.strictEqual(result.riskLevel, "HIGH", "Test 8 failed: Due today with 10h remaining must be HIGH");
  assert.strictEqual(result.remainingHours, 10.0);
}

// TEST 9: Date-only assignment (no dueTime specified)
{
  const asg = {
    dueDate: "2026-09-22",
    dueTime: null,
    estimatedMinutes: 180,
  };
  const result = calculateAssignmentRisk(asg, current);
  console.log("TEST 9 (Date-only assignment):", result.riskLevel, `[Score: ${result.riskScore}]`, `[Reason: ${result.reason}]`);
  assert.strictEqual(result.isDueToday, true);
  assert.strictEqual(result.isOverdue, false, "Date-only assignment should not be overdue at 10 AM on due day");
  assert.strictEqual(result.riskLevel, "HIGH", "Date-only assignment due today must be HIGH (or CRITICAL if workload high)");
}

// TEST 10: Missing due date
{
  const asg = {
    dueDate: null,
    dueTime: null,
  };
  const result = calculateAssignmentRisk(asg, current);
  console.log("TEST 10 (Missing due date):", result.riskLevel, `[Score: ${result.riskScore}]`);
  assert.strictEqual(result.riskLevel, "UNKNOWN");
  assert.strictEqual(result.riskScore, 0);
}

console.log("\n✅ ALL 10 TESTS PASSED SUCCESSFULLY! 🚀");
