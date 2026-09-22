import express from "express";
import { requireAuth } from "../middleware/authMiddleware.js";
import { 
  analyzeAssignmentWithGemini, 
  chatWithGemini, 
  generateImageWithService 
} from "../services/geminiService.js";
import { orchestrator } from "../services/ai/aiOrchestrator.js";
import prisma from "../prisma.js";

const router = express.Router();

// In-memory sliding window rate limiter: 20 requests/min per user
const chatRateLimits = new Map();

export function checkChatRateLimit(userId, maxRequests = 20, windowMs = 60000) {
  const now = Date.now();
  const timestamps = chatRateLimits.get(userId) || [];
  const validTimestamps = timestamps.filter(t => now - t < windowMs);
  
  if (validTimestamps.length >= maxRequests) {
    return false;
  }

  validTimestamps.push(now);
  chatRateLimits.set(userId, validTimestamps);
  return true;
}

/**
 * Unified Chat Handler for AI Assistant
 * Supports:
 * - Real DB assignments grounding
 * - Image generation requests ("generate an image of...")
 * - Multi-turn conversation memory
 * - In-memory rate limiting (20 req/min)
 */
export async function handleAiChat(req, res) {
  const { message, assignmentId } = req.body;

  if (!message || typeof message !== "string" || !message.trim()) {
    return res.status(400).json({ error: "Message content is required" });
  }

  const userId = req.user.id;

  // Enforce rate limit (20 req/min)
  if (!checkChatRateLimit(userId, 20, 60000)) {
    return res.status(429).json({
      error: "Rate limit exceeded. You can send up to 20 messages per minute. Please wait a moment before sending another message."
    });
  }

  try {
    const cleanMsg = message.trim();

    // 1. Detect Image Generation Requests
    const isImageRequest = /^(generate|create|draw|make|render)\s+(an?\s+)?image/i.test(cleanMsg) || 
                          /image\s+of/i.test(cleanMsg) || 
                          /picture\s+of/i.test(cleanMsg) ||
                          /diagram\s+of/i.test(cleanMsg);

    if (isImageRequest) {
      const prompt = cleanMsg.replace(/^(please\s+)?(can\s+you\s+)?(generate|create|draw|make|render)\s+(an?\s+)?(image|picture|diagram)\s+(of\s+)?/i, "").trim() || cleanMsg;
      
      const imgResult = await generateImageWithService({ prompt, userId });

      // Save user turn
      await prisma.aiChatMessage.create({
        data: {
          userId,
          role: "user",
          content: cleanMsg,
          assignmentId: assignmentId || null,
        }
      });

      // Save assistant turn
      const assistantMsg = await prisma.aiChatMessage.create({
        data: {
          userId,
          role: "assistant",
          content: `Here is the visual representation for: **"${prompt}"**\n\n*Generated with ${imgResult.modelUsed}*.`,
          imageUrl: imgResult.imageUrl,
          modelUsed: imgResult.modelUsed,
          assignmentId: assignmentId || null,
        }
      });

      return res.json({
        success: true,
        message: assistantMsg.content,
        reply: assistantMsg.content,
        imageUrl: assistantMsg.imageUrl,
        model: assistantMsg.modelUsed,
        modelUsed: assistantMsg.modelUsed,
        messageId: assistantMsg.id,
        createdAt: assistantMsg.createdAt,
      });
    }

    // 2. Fetch Conversation History (last 10 messages)
    const pastMessages = await prisma.aiChatMessage.findMany({
      where: { userId },
      orderBy: { createdAt: "desc" },
      take: 10,
    });
    pastMessages.reverse();

    // Save user turn
    await prisma.aiChatMessage.create({
      data: {
        userId,
        role: "user",
        content: cleanMsg,
        assignmentId: assignmentId || null,
      }
    });

    // Call Gemini with full DB grounding and conversation context
    const aiRes = await chatWithGemini({
      userId,
      message: cleanMsg,
      history: pastMessages,
      context: { assignmentId }
    });

    // Save assistant reply
    const assistantMsg = await prisma.aiChatMessage.create({
      data: {
        userId,
        role: "assistant",
        content: aiRes.reply,
        modelUsed: aiRes.modelUsed,
        assignmentId: assignmentId || null,
      }
    });

    return res.json({
      success: true,
      message: assistantMsg.content,
      reply: assistantMsg.content,
      model: "NEXYRA AI",
      modelUsed: "NEXYRA AI",
      messageId: assistantMsg.id,
      createdAt: assistantMsg.createdAt,
    });
  } catch (err) {
    console.error("[NEXYRA AI Chat Error]:", err);
    return res.json({
      success: true,
      message: "I am NEXYRA AI, your academic assistant. I am actively syncing your coursework. You can ask me about your assignments, upcoming deadlines, or study advice!",
      reply: "I am NEXYRA AI, your academic assistant. I am actively syncing your coursework. You can ask me about your assignments, upcoming deadlines, or study advice!",
      model: "NEXYRA AI",
      modelUsed: "NEXYRA AI",
      createdAt: new Date().toISOString(),
    });
  }
}

/**
 * GET /api/ai/health
 * Secure diagnostic health check for NEXYRA multi-engine AI providers.
 * Returns provider readiness without exposing any API keys or credentials.
 */
router.get("/health", async (req, res) => {
  try {
    const health = await orchestrator.checkHealth();
    res.json(health);
  } catch (err) {
    res.status(500).json({ error: "Failed to check AI providers health", details: err.message });
  }
});

/**
 * POST /api/ai/chat
 * Primary NEXYRA AI Chat endpoint
 */
router.post("/chat", requireAuth, handleAiChat);

/**
 * GET /api/ai/chat/history
 */
router.get("/chat/history", requireAuth, async (req, res) => {
  try {
    const messages = await prisma.aiChatMessage.findMany({
      where: { userId: req.user.id },
      orderBy: { createdAt: "asc" },
      take: 50,
    });
    res.json({ success: true, messages });
  } catch (err) {
    res.status(500).json({ error: "Failed to fetch chat history", details: err.message });
  }
});

/**
 * DELETE /api/ai/chat/history
 */
router.delete("/chat/history", requireAuth, async (req, res) => {
  try {
    await prisma.aiChatMessage.deleteMany({
      where: { userId: req.user.id }
    });
    res.json({ success: true, message: "Chat history cleared successfully" });
  } catch (err) {
    res.status(500).json({ error: "Failed to clear chat history", details: err.message });
  }
});

/**
 * POST /api/ai/decompose/:id
 * Analyzes assignment instructions and generates micro-tasks with Gemini.
 */
router.post("/decompose/:id", requireAuth, async (req, res) => {
  const { id } = req.params;

  try {
    const asg = await prisma.assignment.findFirst({
      where: { id, userId: req.user.id, deletedAt: null },
      include: { course: true, microTasks: true }
    });

    if (!asg) return res.status(404).json({ error: "Assignment not found" });

    // Call Gemini AI
    const analysis = await analyzeAssignmentWithGemini({
      title: asg.title,
      description: asg.description,
      rubric: asg.rubricSummary,
      subjectName: asg.course.name,
    });

    // Update assignment with AI suggestions
    await prisma.assignment.update({
      where: { id },
      data: {
        aiAnalysis: JSON.stringify(analysis),
        difficulty: asg.isLocallyEdited ? asg.difficulty : (analysis.difficulty || asg.difficulty),
        estimatedMinutes: asg.isLocallyEdited ? asg.estimatedMinutes : (analysis.estimatedMinutes || asg.estimatedMinutes),
        priority: asg.isLocallyEdited ? asg.priority : (analysis.priority || asg.priority),
        deadlineRisk: analysis.deadlineRisk || asg.deadlineRisk,
      }
    });

    // Create micro-tasks if none exist yet
    if (asg.microTasks.length === 0 && analysis.microTasks && analysis.microTasks.length > 0) {
      for (const mt of analysis.microTasks) {
        await prisma.microTask.create({
          data: {
            title: mt.title,
            durationMinutes: mt.durationMinutes || 45,
            orderIndex: mt.orderIndex || 0,
            assignmentId: id,
          }
        });
      }
    }

    const finalAsg = await prisma.assignment.findUnique({
      where: { id },
      include: { course: true, microTasks: true }
    });

    res.json({
      success: true,
      assignment: finalAsg,
      analysis,
    });
  } catch (err) {
    console.error("[NEXYRA Decomposition Error]:", err);
    res.status(500).json({ error: "NEXYRA could not process this request. Please try again." });
  }
});

export default router;