import { BaseAIProvider } from "./baseProvider.js";

/**
 * Mistral AI Provider Adapter
 * Directly integrates with Mistral AI REST API for fast text completion, structured JSON, and Pixtral vision.
 */
export class MistralProvider extends BaseAIProvider {
  constructor() {
    super({
      id: "mistral",
      name: "Mistral AI",
      capabilities: {
        supportsText: true,
        supportsVision: true,
        supportsDocument: true,
        supportsImageGeneration: false, // Honestly declared: Mistral does not generate images
        supportsStructuredJson: true,
      },
    });
  }

  isConfigured() {
    const key = process.env.MISTRAL_API_KEY;
    return Boolean(key && key !== "your_mistral_api_key_here" && key.trim());
  }

  getTextModel() {
    return process.env.MISTRAL_MODEL || "ministral-3b-latest";
  }

  getModelCandidates() {
    const configured = process.env.MISTRAL_MODEL;
    const defaults = ["ministral-3b-latest", "codestral-latest", "mistral-small-latest"];
    if (configured && !defaults.includes(configured)) {
      return [configured, ...defaults];
    }
    return defaults;
  }

  getVisionModel() {
    return "pixtral-12b-2409";
  }

  async checkHealth() {
    const configured = this.isConfigured();
    return {
      id: this.id,
      name: this.name,
      available: configured,
      status: configured ? "available" : "configuration_missing",
      model: this.getTextModel(),
      capabilities: this.capabilities,
    };
  }

  async chat({ messages = [], systemInstruction = "", temperature = 0.7, timeoutMs = 20000 }) {
    if (!this.isConfigured()) throw new Error("Mistral API key is not configured");

    const formattedMessages = [];
    if (systemInstruction) {
      formattedMessages.push({ role: "system", content: systemInstruction });
    }

    for (const msg of messages) {
      const role = msg.role === "model" || msg.role === "assistant" ? "assistant" : "user";
      const content = (msg.content || "").trim();
      if (content) {
        formattedMessages.push({ role, content });
      }
    }

    if (formattedMessages.length === 0 || formattedMessages[formattedMessages.length - 1].role !== "user") {
      formattedMessages.push({ role: "user", content: "Hello" });
    }

    const executeCall = async () => {
      const candidates = this.getModelCandidates();
      let lastErr = null;

      for (const model of candidates) {
        try {
          const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.MISTRAL_API_KEY.trim()}`,
            },
            body: JSON.stringify({
              model,
              messages: formattedMessages,
              temperature,
            }),
          });

          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.message || `Mistral request failed with HTTP ${res.status}`);
          }

          const data = await res.json();
          const reply = data.choices?.[0]?.message?.content || "";

          return {
            reply,
            modelUsed: `Mistral (${data.model || model})`,
            usage: {
              inputTokens: data.usage?.prompt_tokens || 0,
              outputTokens: data.usage?.completion_tokens || 0,
            },
            raw: data,
          };
        } catch (err) {
          lastErr = err;
          // If rate limited or model not found, try next candidate model
          console.warn(`[Mistral Adapter] Model ${model} failed: ${err.message}. Trying candidate model...`);
        }
      }

      throw lastErr || new Error("All Mistral model candidates failed");
    };

    return this.withTimeout(executeCall(), timeoutMs, "chat");
  }

  async analyzeAssignmentJson({ title, description, rubric, subjectName, timeoutMs = 20000 }) {
    if (!this.isConfigured()) throw new Error("Mistral API key is not configured");

    const prompt = `You are an expert academic advisor and workload balancing AI.
Analyze the following assignment for a university course and provide a JSON response.

Course: ${subjectName || "Academic Course"}
Assignment Title: ${title}
Description: ${description || "No description provided"}
Rubric / Notes: ${rubric || "Standard grading rubric"}

Return ONLY a valid JSON object matching this schema:
{
  "difficulty": <number 1 to 5, where 1 is simple and 5 is very challenging>,
  "estimatedMinutes": <integer total estimated minutes to complete thoroughly, e.g. 180>,
  "priority": <"LOW" | "MEDIUM" | "HIGH" | "URGENT">,
  "deadlineRisk": <"LOW" | "MODERATE" | "HIGH" | "CRITICAL">,
  "summary": <concise 2-sentence summary of the task>,
  "keyFocusAreas": [<array of 3 strings highlighting critical concepts>],
  "tips": <actionable study strategy tip>,
  "microTasks": [
    {
      "title": <string step name>,
      "durationMinutes": <integer minutes, 30 to 90 mins each>,
      "orderIndex": <integer 0, 1, 2...>
    }
  ]
}`;

    const executeCall = async () => {
      const candidates = this.getModelCandidates();
      let lastErr = null;

      for (const model of candidates) {
        try {
          const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
            method: "POST",
            headers: {
              "Content-Type": "application/json",
              Authorization: `Bearer ${process.env.MISTRAL_API_KEY.trim()}`,
            },
            body: JSON.stringify({
              model,
              messages: [
                { role: "system", content: "You are an expert academic advisor. Output pure valid JSON only without markdown code blocks." },
                { role: "user", content: prompt },
              ],
              response_format: { type: "json_object" },
              temperature: 0.3,
            }),
          });

          if (!res.ok) {
            const errorData = await res.json().catch(() => ({}));
            throw new Error(errorData.message || `Mistral JSON decomposition failed with status ${res.status}`);
          }

          const data = await res.json();
          const content = data.choices?.[0]?.message?.content || "{}";
          const analysis = JSON.parse(content);

          return {
            analysis,
            modelUsed: `Mistral (${data.model || model})`,
          };
        } catch (err) {
          lastErr = err;
          console.warn(`[Mistral Adapter] Model ${model} JSON decomposition failed: ${err.message}. Trying candidate model...`);
        }
      }

      throw lastErr || new Error("All Mistral model candidates failed for JSON decomposition");
    };

    return this.withTimeout(executeCall(), timeoutMs, "analyzeAssignmentJson");
  }

  async analyzeDocumentMultimodal({ buffer, mimeType, fileName, assignmentContext = null, timeoutMs = 25000 }) {
    if (!this.isConfigured()) throw new Error("Mistral API key is not configured");

    const promptText = `You are an expert academic evaluator. Analyze the attached student document/file (${fileName}).
${assignmentContext ? `Associated Assignment Context: ${JSON.stringify(assignmentContext)}` : ""}

Carefully examine all readable content and return ONLY a valid JSON object matching this structure:
{
  "summary": "<comprehensive 2-3 paragraph summary of the document>",
  "importantPoints": ["<key concept 1>", "<key concept 2>", "<key concept 3>", "<key concept 4>"],
  "assignmentRequirements": ["<requirement 1>", "<requirement 2>", "<requirement 3>"],
  "keyTasksOrQuestions": ["<question/task 1>", "<question/task 2>"],
  "importantDatesOrInstructions": ["<instruction/date 1>", "<instruction/date 2>"],
  "difficultSections": ["<identified challenging area 1>", "<identified challenging area 2>"],
  "suggestedApproach": "<detailed step-by-step strategy for tackling this assignment or document>",
  "studyBreakdown": [
    { "phase": "Phase 1: Preparation", "estimatedHours": 1.5, "tasks": ["Task A", "Task B"] },
    { "phase": "Phase 2: Execution", "estimatedHours": 3.0, "tasks": ["Task C", "Task D"] },
    { "phase": "Phase 3: Review", "estimatedHours": 1.0, "tasks": ["Task E"] }
  ],
  "extractedTextPreview": "<first 300 characters of readable text>"
}`;

    const executeCall = async () => {
      const isImage = mimeType.startsWith("image/");
      const userContent = [];

      userContent.push({ type: "text", text: promptText });

      let model = this.getTextModel();

      if (isImage && buffer) {
        model = this.getVisionModel();
        const base64Data = buffer.toString("base64");
        userContent.push({
          type: "image_url",
          image_url: `data:${mimeType};base64,${base64Data}`,
        });
      } else if (buffer) {
        const textSample = buffer.toString("utf-8", 0, Math.min(buffer.length, 12000));
        userContent.push({
          type: "text",
          text: `Extracted Document Content:\n${textSample}`,
        });
      }

      const res = await fetch("https://api.mistral.ai/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.MISTRAL_API_KEY.trim()}`,
        },
        body: JSON.stringify({
          model,
          messages: [
            { role: "system", content: "You are an expert academic evaluator. Return pure JSON only." },
            { role: "user", content: userContent },
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.message || `Mistral multimodal analysis failed with status ${res.status}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || "{}";
      const analysis = JSON.parse(content);

      return {
        analysis,
        modelUsed: `Mistral (${data.model || model})`,
      };
    };

    return this.withTimeout(executeCall(), timeoutMs, "analyzeDocumentMultimodal");
  }
}

export const mistralProvider = new MistralProvider();
