import { GoogleGenAI } from "@google/genai";
import { BaseAIProvider } from "./baseProvider.js";

/**
 * Google Gemini AI Provider Adapter
 */
export class GeminiProvider extends BaseAIProvider {
  constructor() {
    super({
      id: "gemini",
      name: "Google Gemini",
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
    const key = process.env.GEMINI_API_KEY;
    return Boolean(key && key !== "your_gemini_api_key_here" && key.trim());
  }

  getClient() {
    if (!this.isConfigured()) return null;
    return new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });
  }

  getModelCandidates() {
    const envModel = process.env.GEMINI_MODEL;
    const defaults = [
      "gemini-3.6-flash",
      "gemini-flash-latest",
      "gemini-2.5-flash",
      "gemini-2.0-flash",
      "gemini-1.5-flash",
    ];
    const list = envModel ? [envModel, ...defaults] : defaults;
    return [...new Set(list.filter(Boolean))];
  }

  async checkHealth() {
    const configured = this.isConfigured();
    return {
      id: this.id,
      name: this.name,
      available: configured,
      status: configured ? "available" : "configuration_missing",
      model: process.env.GEMINI_MODEL || "gemini-3.6-flash",
      capabilities: this.capabilities,
    };
  }

  async chat({ messages = [], systemInstruction = "", temperature = 0.7, timeoutMs = 20000 }) {
    const client = this.getClient();
    if (!client) throw new Error("Gemini API key is not configured");

    const formattedContents = [];
    for (const msg of messages) {
      const role = msg.role === "assistant" ? "model" : "user";
      const text = (msg.content || "").trim();
      if (!text) continue;

      if (formattedContents.length === 0) {
        if (role === "user") {
          formattedContents.push({ role: "user", parts: [{ text }] });
        }
        continue;
      }

      const prev = formattedContents[formattedContents.length - 1];
      if (prev.role === role) {
        prev.parts[0].text += `\n\n${text}`;
      } else {
        formattedContents.push({ role, parts: [{ text }] });
      }
    }

    if (formattedContents.length === 0 || formattedContents[formattedContents.length - 1].role !== "user") {
      const lastMsg = messages[messages.length - 1]?.content || "Hello";
      formattedContents.push({ role: "user", parts: [{ text: lastMsg }] });
    }

    const executeCall = async () => {
      const candidates = this.getModelCandidates();
      let lastErr = null;

      for (const model of candidates) {
        try {
          const response = await client.models.generateContent({
            model,
            contents: formattedContents,
            config: {
              temperature,
              ...(systemInstruction ? { systemInstruction } : {}),
            },
          });

          if (response && response.text) {
            return {
              reply: response.text,
              modelUsed: `Gemini (${model})`,
              raw: response,
            };
          }
        } catch (err) {
          lastErr = err;
          console.warn(`[Gemini Adapter] Model ${model} failed: ${err.message}. Trying next candidate...`);
        }
      }
      throw lastErr || new Error("All Gemini model candidates failed");
    };

    return this.withTimeout(executeCall(), timeoutMs, "chat");
  }

  async analyzeAssignmentJson({ title, description, rubric, subjectName, timeoutMs = 20000 }) {
    const client = this.getClient();
    if (!client) throw new Error("Gemini API key is not configured");

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
      for (const model of candidates) {
        try {
          const res = await client.models.generateContent({
            model,
            contents: prompt,
            config: {
              systemInstruction: "You are an expert academic advisor. Output pure valid JSON only without markdown code fences or conversational text.",
            },
          });

          if (res && res.text) {
            const jsonMatch = res.text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              return {
                analysis: JSON.parse(jsonMatch[0]),
                modelUsed: `Gemini (${model})`,
              };
            }
          }
        } catch (err) {
          console.warn(`[Gemini Adapter] JSON decompose with ${model} failed: ${err.message}`);
        }
      }
      throw new Error("Gemini could not generate valid JSON structure");
    };

    return this.withTimeout(executeCall(), timeoutMs, "analyzeAssignmentJson");
  }

  async analyzeDocumentMultimodal({ buffer, mimeType, fileName, assignmentContext = null, timeoutMs = 25000 }) {
    const client = this.getClient();
    if (!client) throw new Error("Gemini API key is not configured");

    const prompt = `You are an expert academic evaluator. Analyze the attached student document/file (${fileName}).
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
      const contents = [
        {
          role: "user",
          parts: [
            { text: prompt },
            {
              inlineData: {
                data: buffer.toString("base64"),
                mimeType: mimeType || "application/pdf"
              }
            }
          ]
        }
      ];

      const candidates = this.getModelCandidates();
      for (const model of candidates) {
        try {
          const res = await client.models.generateContent({
            model,
            contents,
            config: {
              systemInstruction: "You are an expert academic evaluator. Return pure JSON only.",
            },
          });

          if (res && res.text) {
            const jsonMatch = res.text.match(/\{[\s\S]*\}/);
            if (jsonMatch) {
              return {
                analysis: JSON.parse(jsonMatch[0]),
                modelUsed: `Gemini Multimodal (${model})`,
              };
            }
          }
        } catch (err) {
          console.warn(`[Gemini Adapter] Multimodal analysis with ${model} failed: ${err.message}`);
        }
      }
      throw new Error("Gemini multimodal analysis could not process document");
    };

    return this.withTimeout(executeCall(), timeoutMs, "analyzeDocumentMultimodal");
  }

  async generateImage({ prompt, timeoutMs = 25000 }) {
    const client = this.getClient();
    if (!client) throw new Error("Gemini API key is not configured");

    const executeCall = async () => {
      const response = await client.models.generateImages({
        model: "imagen-3.0-generate-002",
        prompt,
        config: {
          numberOfImages: 1,
          aspectRatio: "1:1",
        }
      });

      if (response.generatedImages && response.generatedImages.length > 0) {
        const imgBytes = response.generatedImages[0].image.imageBytes;
        return {
          imageUrl: `data:image/png;base64,${imgBytes}`,
          prompt,
          modelUsed: "Gemini Imagen 3",
        };
      }
      throw new Error("Gemini Imagen produced no images");
    };

    return this.withTimeout(executeCall(), timeoutMs, "generateImage");
  }
}

export const geminiProvider = new GeminiProvider();
