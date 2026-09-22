import { GeminiProvider } from "./geminiProvider.js";
import { OpenAIProvider } from "./openAiProvider.js";
import { MistralProvider } from "./mistralProvider.js";

/**
 * NEXYRA AI Multi-Provider Orchestrator
 * 
 * Orchestrates calls across Google Gemini, OpenAI, and Mistral AI.
 * Handles primary provider selection, intelligent capability routing,
 * automatic failover/retries, response normalization, and offline safety.
 */
class AIOrchestrator {
  constructor() {
    this.providers = new Map();
    this.registerProvider(new GeminiProvider());
    this.registerProvider(new OpenAIProvider());
    this.registerProvider(new MistralProvider());
  }

  registerProvider(provider) {
    this.providers.set(provider.id, provider);
  }

  getProvider(id) {
    return this.providers.get(id);
  }

  getAllProviders() {
    return Array.from(this.providers.values());
  }

  getPrimaryProviderId() {
    const configured = (process.env.AI_PRIMARY_PROVIDER || "gemini").toLowerCase().trim();
    if (this.providers.has(configured)) {
      return configured;
    }
    return "gemini";
  }

  isFallbackEnabled() {
    const val = process.env.AI_FALLBACK_ENABLED;
    return val !== "false" && val !== "0";
  }

  /**
   * Builds ordered list of candidate providers for a given capability.
   * @param {string} capability - e.g. "supportsText", "supportsVision", "supportsImageGeneration"
   */
  getCandidateProviders(capability = "supportsText") {
    const primaryId = this.getPrimaryProviderId();
    const fallbackEnabled = this.isFallbackEnabled();

    const candidates = [];
    const primary = this.providers.get(primaryId);

    if (primary && primary.isConfigured() && primary.capabilities[capability]) {
      candidates.push(primary);
    }

    if (fallbackEnabled) {
      for (const [id, provider] of this.providers.entries()) {
        if (id !== primaryId && provider.isConfigured() && provider.capabilities[capability]) {
          candidates.push(provider);
        }
      }
    }

    return candidates;
  }

  /**
   * Diagnostic health check for all providers.
   * Never exposes API keys.
   */
  async checkHealth() {
    const providerHealth = {};
    for (const [id, provider] of this.providers.entries()) {
      providerHealth[id] = await provider.checkHealth();
    }

    const availableCount = Object.values(providerHealth).filter(p => p.available).length;

    return {
      success: true,
      service: "NEXYRA AI Orchestrator",
      primaryProvider: this.getPrimaryProviderId(),
      fallbackEnabled: this.isFallbackEnabled(),
      totalProvidersConfigured: availableCount,
      providers: providerHealth,
    };
  }

  /**
   * Orchestrated Chat Completion with automatic failover.
   */
  async chat({ messages = [], systemInstruction = "", temperature = 0.7, timeoutMs = 20000 }) {
    const candidates = this.getCandidateProviders("supportsText");
    let lastError = null;

    for (const provider of candidates) {
      const startTime = Date.now();
      try {
        const result = await provider.chat({
          messages,
          systemInstruction,
          temperature,
          timeoutMs,
        });

        const latencyMs = Date.now() - startTime;
        console.log(`[AI Orchestrator] Chat request successfully fulfilled by ${provider.name} in ${latencyMs}ms`);

        return {
          success: true,
          reply: result.reply,
          modelUsed: "NEXYRA AI",
          _internal: {
            providerId: provider.id,
            providerName: provider.name,
            model: result.modelUsed,
            latencyMs,
            usage: result.usage,
          },
        };
      } catch (err) {
        lastError = err;
        console.warn(`[AI Orchestrator] ${provider.name} chat attempt failed: ${err.message}. Checking next available provider...`);
      }
    }

    throw lastError || new Error("No AI providers available to fulfill chat request");
  }

  /**
   * Orchestrated Assignment Decomposition into micro-tasks.
   */
  async analyzeAssignmentJson(params) {
    const candidates = this.getCandidateProviders("supportsStructuredJson");
    let lastError = null;

    for (const provider of candidates) {
      const startTime = Date.now();
      try {
        const result = await provider.analyzeAssignmentJson({
          ...params,
          timeoutMs: params.timeoutMs || 20000,
        });

        const latencyMs = Date.now() - startTime;
        console.log(`[AI Orchestrator] Assignment decomposition successfully fulfilled by ${provider.name} in ${latencyMs}ms`);

        return {
          success: true,
          analysis: result.analysis,
          modelUsed: "NEXYRA AI",
          _internal: {
            providerId: provider.id,
            providerName: provider.name,
            model: result.modelUsed,
            latencyMs,
          },
        };
      } catch (err) {
        lastError = err;
        console.warn(`[AI Orchestrator] ${provider.name} JSON decomposition failed: ${err.message}. Checking next provider...`);
      }
    }

    throw lastError || new Error("No AI providers available for assignment decomposition");
  }

  /**
   * Orchestrated Multimodal Document / Image Analysis.
   */
  async analyzeDocumentMultimodal(params) {
    const candidates = this.getCandidateProviders("supportsVision");
    let lastError = null;

    for (const provider of candidates) {
      const startTime = Date.now();
      try {
        const result = await provider.analyzeDocumentMultimodal({
          ...params,
          timeoutMs: params.timeoutMs || 25000,
        });

        const latencyMs = Date.now() - startTime;
        console.log(`[AI Orchestrator] Multimodal analysis successfully fulfilled by ${provider.name} in ${latencyMs}ms`);

        return {
          success: true,
          analysis: result.analysis,
          modelUsed: "NEXYRA AI",
          _internal: {
            providerId: provider.id,
            providerName: provider.name,
            model: result.modelUsed,
            latencyMs,
          },
        };
      } catch (err) {
        lastError = err;
        console.warn(`[AI Orchestrator] ${provider.name} multimodal analysis failed: ${err.message}. Checking next provider...`);
      }
    }

    throw lastError || new Error("No AI providers available for multimodal document analysis");
  }

  /**
   * Orchestrated Image Generation.
   * Only routes to providers that honestly support image generation (Gemini Imagen, OpenAI DALL-E).
   * Falls back to academic visualizer engine if providers fail.
   */
  async generateImage(params) {
    const candidates = this.getCandidateProviders("supportsImageGeneration");

    for (const provider of candidates) {
      const startTime = Date.now();
      try {
        const result = await provider.generateImage({
          ...params,
          timeoutMs: params.timeoutMs || 25000,
        });

        const latencyMs = Date.now() - startTime;
        console.log(`[AI Orchestrator] Image generation successfully fulfilled by ${provider.name} in ${latencyMs}ms`);

        return {
          success: true,
          imageUrl: result.imageUrl,
          prompt: params.prompt,
          modelUsed: "NEXYRA Image Engine",
          _internal: {
            providerId: provider.id,
            providerName: provider.name,
            model: result.modelUsed,
            latencyMs,
          },
        };
      } catch (err) {
        console.warn(`[AI Orchestrator] ${provider.name} image generation failed: ${err.message}. Trying next image provider...`);
      }
    }

    // Safe academic visualization fallback
    const seed = Math.floor(Math.random() * 1000000);
    const cleanPrompt = encodeURIComponent((params.prompt || "academic study concept").trim());
    const fallbackUrl = `https://image.pollinations.ai/prompt/${cleanPrompt}?width=800&height=800&nologo=true&seed=${seed}`;

    return {
      success: true,
      imageUrl: fallbackUrl,
      prompt: params.prompt,
      modelUsed: "NEXYRA Image Engine",
      _internal: {
        providerId: "fallback-visualizer",
        providerName: "Academic Visualizer Engine",
      },
    };
  }
}

export const orchestrator = new AIOrchestrator();
