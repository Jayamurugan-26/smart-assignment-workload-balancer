import { BaseAIProvider } from "./baseProvider.js";

/**
 * OpenAI Provider Adapter
 * Directly integrates with OpenAI REST API endpoints for text, vision, and DALL-E image generation.
 */
export class OpenAIProvider extends BaseAIProvider {
  constructor() {
    super({
      id: "openai",
      name: "OpenAI",
      capabilities: {
        supportsText: true,
        supportsVision: true,
        supportsDocument: true,
        supportsImageGeneration: true,
        supportsStructuredJson: true,
      },
    });
  }

  isConfigured() {
    const key = process.env.OPENAI_API_KEY;
    return Boolean(key && key !== "your_openai_api_key_here" && key.trim().startsWith("sk-"));
  }

  getModel() {
    return process.env.OPENAI_MODEL || "gpt-4o-mini";
  }

  async checkHealth() {
    const configured = this.isConfigured();
    return {
      id: this.id,
      name: this.name,
      available: configured,
      status: configured ? "available" : "configuration_missing",
      model: this.getModel(),
      capabilities: this.capabilities,
    };
  }

  async chat({ messages = [], systemInstruction = "", temperature = 0.7, timeoutMs = 20000 }) {
    if (!this.isConfigured()) throw new Error("OpenAI API key is not configured");

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
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY.trim()}`,
        },
        body: JSON.stringify({
          model: this.getModel(),
          messages: formattedMessages,
          temperature,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `OpenAI request failed with HTTP ${res.status}`);
      }

      const data = await res.json();
      const reply = data.choices?.[0]?.message?.content || "";

      return {
        reply,
        modelUsed: `OpenAI (${data.model || this.getModel()})`,
        usage: {
          inputTokens: data.usage?.prompt_tokens || 0,
          outputTokens: data.usage?.completion_tokens || 0,
        },
        raw: data,
      };
    };

    return this.withTimeout(executeCall(), timeoutMs, "chat");
  }

  async analyzeAssignmentJson({ title, description, rubric, subjectName, timeoutMs = 20000 }) {
    if (!this.isConfigured()) throw new Error("OpenAI API key is not configured");

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
      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY.trim()}`,
        },
        body: JSON.stringify({
          model: this.getModel(),
          messages: [
            { role: "system", content: "You are an expert academic advisor. Always respond with pure valid JSON only." },
            { role: "user", content: prompt },
          ],
          response_format: { type: "json_object" },
          temperature: 0.3,
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `OpenAI JSON decomposition failed with status ${res.status}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || "{}";
      const analysis = JSON.parse(content);

      return {
        analysis,
        modelUsed: `OpenAI (${data.model || this.getModel()})`,
      };
    };

    return this.withTimeout(executeCall(), timeoutMs, "analyzeAssignmentJson");
  }

  async analyzeDocumentMultimodal({ buffer, mimeType, fileName, assignmentContext = null, timeoutMs = 25000 }) {
    if (!this.isConfigured()) throw new Error("OpenAI API key is not configured");

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

      if (isImage && buffer) {
        const base64Data = buffer.toString("base64");
        userContent.push({
          type: "image_url",
          image_url: {
            url: `data:${mimeType};base64,${base64Data}`,
            detail: "high",
          },
        });
      } else if (buffer) {
        // For text-based files or extracted text previews
        const textSample = buffer.toString("utf-8", 0, Math.min(buffer.length, 12000));
        userContent.push({
          type: "text",
          text: `Extracted Document Content:\n${textSample}`,
        });
      }

      const res = await fetch("https://api.openai.com/v1/chat/completions", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY.trim()}`,
        },
        body: JSON.stringify({
          model: this.getModel(),
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
        throw new Error(errorData.error?.message || `OpenAI multimodal analysis failed with status ${res.status}`);
      }

      const data = await res.json();
      const content = data.choices?.[0]?.message?.content || "{}";
      const analysis = JSON.parse(content);

      return {
        analysis,
        modelUsed: `OpenAI Multimodal (${data.model || this.getModel()})`,
      };
    };

    return this.withTimeout(executeCall(), timeoutMs, "analyzeDocumentMultimodal");
  }

  async generateImage({ prompt, timeoutMs = 25000 }) {
    if (!this.isConfigured()) throw new Error("OpenAI API key is not configured");

    const executeCall = async () => {
      const res = await fetch("https://api.openai.com/v1/images/generations", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          Authorization: `Bearer ${process.env.OPENAI_API_KEY.trim()}`,
        },
        body: JSON.stringify({
          model: "dall-e-3",
          prompt,
          n: 1,
          size: "1024x1024",
        }),
      });

      if (!res.ok) {
        const errorData = await res.json().catch(() => ({}));
        throw new Error(errorData.error?.message || `OpenAI DALL-E image generation failed with status ${res.status}`);
      }

      const data = await res.json();
      const imageUrl = data.data?.[0]?.url;

      if (!imageUrl) {
        throw new Error("OpenAI DALL-E returned no image URL");
      }

      return {
        imageUrl,
        prompt,
        modelUsed: "OpenAI DALL-E 3",
      };
    };

    return this.withTimeout(executeCall(), timeoutMs, "generateImage");
  }
}

export const openAiProvider = new OpenAIProvider();
