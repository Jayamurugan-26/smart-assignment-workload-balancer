import prisma from "../prisma.js";
import { calculateAssignmentRisk } from "../services/riskService.js";

async function refreshAllAssignmentRisks() {
  console.log("=== REFRESHING ASSIGNMENT RISKS IN DATABASE ===");
  const now = new Date();
  console.log(`Current Reference Time: ${now.toISOString()} (${now.toString()})`);

  const assignments = await prisma.assignment.findMany({
    where: { deletedAt: null },
    include: { course: true }
  });

  console.log(`Found ${assignments.length} active assignments in database.`);

  let updatedCount = 0;
  for (const asg of assignments) {
    const risk = calculateAssignmentRisk(asg, now);
    const oldRisk = asg.deadlineRisk;
    
    await prisma.assignment.update({
      where: { id: asg.id },
      data: {
        deadlineRisk: risk.riskLevel,
      }
    });

    console.log(`- [${asg.course?.code || "COURSE"}] "${asg.title}":`);
    console.log(`    Due: ${asg.dueDate ? asg.dueDate.toISOString().split("T")[0] : "None"} ${asg.dueTime || "(no time)"}`);
    console.log(`    Previous Risk: ${oldRisk} -> Updated Risk: ${risk.riskLevel} (Score: ${risk.riskScore}%)`);
    console.log(`    Reason: ${risk.reason}`);
    updatedCount++;
  }

  console.log(`\nSuccessfully updated baseline risk for ${updatedCount} assignments.`);
  await prisma.$disconnect();
}

refreshAllAssignmentRisks().catch(err => {
  console.error("Failed to refresh assignment risks:", err);
  process.exit(1);
});
