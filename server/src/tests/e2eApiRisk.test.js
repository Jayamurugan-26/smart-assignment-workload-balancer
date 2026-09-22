import assert from "assert";

const BASE_URL = process.env.TEST_API_URL || "http://localhost:5000";

async function runE2ETests() {
  console.log("=== RUNNING END-TO-END DEADLINE RISK API TESTS ===");
  console.log(`Target Backend: ${BASE_URL}\n`);

  // 1. Authenticate Demo User
  console.log("1. Authenticating as demo user...");
  const authRes = await fetch(`${BASE_URL}/api/auth/demo`, { method: "POST" });
  if (!authRes.ok) {
    throw new Error(`Demo auth failed with status ${authRes.status}`);
  }
  const { token, user } = await authRes.json();
  assert.ok(token, "JWT token must be present");
  console.log(`   Authenticated successfully as: ${user.name} (${user.email})`);

  const headers = {
    "Content-Type": "application/json",
    Authorization: `Bearer ${token}`,
  };

  // 2. Fetch Assignments and inspect risk objects
  console.log("\n2. Testing GET /api/assignments risk decoration...");
  const listRes = await fetch(`${BASE_URL}/api/assignments?status=ALL`, { headers });
  assert.strictEqual(listRes.status, 200, "GET /api/assignments must return 200");
  const { assignments } = await listRes.json();
  assert.ok(Array.isArray(assignments), "Assignments must be an array");
  console.log(`   Retrieved ${assignments.length} assignments.`);

  for (const asg of assignments) {
    assert.ok(asg.deadlineRisk, `Assignment ${asg.id} must have deadlineRisk`);
    assert.ok(asg.risk, `Assignment ${asg.id} must have attached risk object`);
    assert.strictEqual(
      asg.deadlineRisk, 
      asg.risk.riskLevel, 
      `asg.deadlineRisk must match risk.riskLevel for ${asg.title}`
    );
    assert.ok(
      typeof asg.risk.riskScore === "number" && asg.risk.riskScore >= 0 && asg.risk.riskScore <= 100,
      `Risk score must be bounded between 0 and 100 (got ${asg.risk.riskScore})`
    );
    assert.ok(
      typeof asg.risk.reason === "string" && asg.risk.reason.length > 0,
      `Risk reason must be a non-empty string for ${asg.title}`
    );

    // CRITICAL INVARIANT: No assignment due <= 24 hours can be LOW
    if (!asg.risk.isCompleted && asg.risk.rawRemainingMinutes <= 1440 && asg.dueDate) {
      assert.notStrictEqual(
        asg.deadlineRisk,
        "LOW",
        `INVARIANT VIOLATION: Assignment '${asg.title}' has ${asg.risk.rawRemainingMinutes}m left (<=24h) but is marked LOW risk!`
      );
    }
  }
  console.log("   ✓ All existing assignments have valid normalized risk metadata and uphold invariants.");

  // Helper date functions
  const now = new Date();
  const formatYMD = (d) => {
    const y = d.getFullYear();
    const m = String(d.getMonth() + 1).padStart(2, "0");
    const day = String(d.getDate()).padStart(2, "0");
    return `${y}-${m}-${day}`;
  };

  // 3. Test creating assignment due TODAY
  console.log("\n3. Testing assignment due TODAY at 23:59...");
  const todayYMD = formatYMD(now);
  const createTodayRes = await fetch(`${BASE_URL}/api/assignments`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: "TEST: Due Today Verification",
      dueDate: todayYMD,
      dueTime: "23:59",
      estimatedMinutes: 120,
      priority: "MEDIUM",
      difficulty: 3,
    }),
  });
  assert.strictEqual(createTodayRes.status, 201, "Creation must return 201");
  const { assignment: todayAsg } = await createTodayRes.json();

  console.log(`   Result: riskLevel=${todayAsg.deadlineRisk}, score=${todayAsg.risk.riskScore}, remainingHours=${todayAsg.risk.remainingHours}`);
  console.log(`   Reason: "${todayAsg.risk.reason}"`);
  assert.ok(
    todayAsg.deadlineRisk === "HIGH" || todayAsg.deadlineRisk === "CRITICAL",
    `Assignment due today must be HIGH or CRITICAL, got: ${todayAsg.deadlineRisk}`
  );
  assert.notStrictEqual(todayAsg.deadlineRisk, "LOW", "Assignment due today MUST NEVER BE LOW!");
  console.log("   ✓ Assignment due today is correctly HIGH or CRITICAL!");

  // 4. Test creating assignment with remaining hours <= 6 (e.g. 3 hours from now)
  console.log("\n4. Testing assignment due in 3 hours (CRITICAL)...");
  const threeHoursLater = new Date(now.getTime() + 3 * 3600 * 1000);
  const threeHoursTime = `${String(threeHoursLater.getHours()).padStart(2, "0")}:${String(threeHoursLater.getMinutes()).padStart(2, "0")}`;
  const create3hRes = await fetch(`${BASE_URL}/api/assignments`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: "TEST: Due in 3 Hours",
      dueDate: formatYMD(threeHoursLater),
      dueTime: threeHoursTime,
      estimatedMinutes: 60,
      priority: "HIGH",
    }),
  });
  const { assignment: asg3h } = await create3hRes.json();
  console.log(`   Result: riskLevel=${asg3h.deadlineRisk}, score=${asg3h.risk.riskScore}`);
  console.log(`   Reason: "${asg3h.risk.reason}"`);
  assert.strictEqual(asg3h.deadlineRisk, "CRITICAL", "Due in 3 hours must be CRITICAL");
  console.log("   ✓ Due in 3 hours is CRITICAL!");

  // 5. Test creating assignment due in 5 days (LOW)
  console.log("\n5. Testing assignment due in 5 days (LOW)...");
  const fiveDaysLater = new Date(now.getTime() + 5 * 24 * 3600 * 1000);
  const create5dRes = await fetch(`${BASE_URL}/api/assignments`, {
    method: "POST",
    headers,
    body: JSON.stringify({
      title: "TEST: Due in 5 Days",
      dueDate: formatYMD(fiveDaysLater),
      dueTime: "23:59",
      estimatedMinutes: 60,
      priority: "LOW",
    }),
  });
  const { assignment: asg5d } = await create5dRes.json();
  console.log(`   Result: riskLevel=${asg5d.deadlineRisk}, score=${asg5d.risk.riskScore}`);
  console.log(`   Reason: "${asg5d.risk.reason}"`);
  assert.strictEqual(asg5d.deadlineRisk, "LOW", "Due in 5 days with low workload must be LOW");
  console.log("   ✓ Due in 5 days is LOW!");

  // 6. Test updating an assignment's deadline via PATCH
  console.log("\n6. Testing PATCH deadline change recalculation...");
  const yesterday = new Date(now.getTime() - 24 * 3600 * 1000);
  const patchRes = await fetch(`${BASE_URL}/api/assignments/${asg5d.id}`, {
    method: "PATCH",
    headers,
    body: JSON.stringify({
      dueDate: formatYMD(yesterday),
      dueTime: "12:00",
    }),
  });
  const { assignment: patchedAsg } = await patchRes.json();
  console.log(`   Updated to yesterday: riskLevel=${patchedAsg.deadlineRisk}, score=${patchedAsg.risk.riskScore}, isOverdue=${patchedAsg.risk.isOverdue}`);
  console.log(`   Reason: "${patchedAsg.risk.reason}"`);
  assert.strictEqual(patchedAsg.deadlineRisk, "CRITICAL", "Overdue assignment must become CRITICAL");
  assert.strictEqual(patchedAsg.risk.isOverdue, true, "isOverdue must be true");
  assert.strictEqual(patchedAsg.risk.riskScore, 100, "Overdue score must be 100");
  console.log("   ✓ PATCH instantly recalculated risk to CRITICAL with score 100!");

  // Cleanup test assignments
  console.log("\n7. Cleaning up test assignments...");
  await fetch(`${BASE_URL}/api/assignments/${todayAsg.id}`, { method: "DELETE", headers });
  await fetch(`${BASE_URL}/api/assignments/${asg3h.id}`, { method: "DELETE", headers });
  await fetch(`${BASE_URL}/api/assignments/${asg5d.id}`, { method: "DELETE", headers });
  console.log("   ✓ Cleaned up test items.");

  console.log("\n=======================================================");
  console.log("🎉 ALL END-TO-END DEADLINE RISK API TESTS PASSED 100%!");
  console.log("=======================================================\n");
}

runE2ETests().catch((err) => {
  console.error("E2E Test Failure:", err);
  process.exit(1);
});
