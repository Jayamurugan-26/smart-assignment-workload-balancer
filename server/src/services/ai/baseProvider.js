/**
 * Base AI Provider Abstract Interface
 * 
 * Standard contract for all NEXYRA AI engine adapters.
 * Every provider must implement supported capabilities honestly without pretending
 * to support capabilities that are unsupported by the underlying API.
 */

export class BaseAIProvider {
  /**
   * @param {Object} options
   * @param {string} options.id - Internal provider identifier ("gemini", "openai", "mistral")
   * @param {string} options.name - Human-readable provider label
   * @param {Object} options.capabilities - Declared capabilities
   */
  constructor({ id, name, capabilities = {} }) {
    if (new.target === BaseAIProvider) {
      throw new TypeError("Cannot construct BaseAIProvider instances directly");
    }

    this.id = id;
    this.name = name;
    this.capabilities = {
      supportsText: capabilities.supportsText ?? true,
      supportsVision: capabilities.supportsVision ?? false,
      supportsDocument: capabilities.supportsDocument ?? false,
      supportsImageGeneration: capabilities.supportsImageGeneration ?? false,
      supportsStructuredJson: capabilities.supportsStructuredJson ?? true,
      ...capabilities,
    };
  }

  /**
   * Checks if required environment variables or credentials are set.
   * @returns {boolean}
   */
  isConfigured() {
    throw new Error("isConfigured() must be implemented by subclass");
  }

  /**
   * Diagnostic check returning provider availability status.
   * @returns {Promise<{ available: boolean, status: string, model: string }>}
   */
  async checkHealth() {
    return {
      available: this.isConfigured(),
      status: this.isConfigured() ? "available" : "configuration_missing",
      capabilities: this.capabilities,
    };
  }

  /**
   * Conversational completion.
   * @param {Object} params
   * @param {Array<{ role: string, content: string }>} params.messages
   * @param {string} params.systemInstruction
   * @param {number} [params.temperature]
   * @param {number} [params.timeoutMs]
   * @returns {Promise<{ reply: string, modelUsed: string, usage?: Object }>}
   */
  async chat(params) {
    throw new Error(`chat() is not implemented by ${this.name}`);
  }

  /**
   * Structured assignment decomposition into microtasks.
   * @param {Object} params
   * @returns {Promise<{ analysis: Object, modelUsed: string }>}
   */
  async analyzeAssignmentJson(params) {
    throw new Error(`analyzeAssignmentJson() is not implemented by ${this.name}`);
  }

  /**
   * Multimodal document/image analysis.
   * @param {Object} params
   * @returns {Promise<{ analysis: Object, modelUsed: string }>}
   */
  async analyzeDocumentMultimodal(params) {
    throw new Error(`analyzeDocumentMultimodal() is not supported by ${this.name}`);
  }

  /**
   * Image generation.
   * @param {Object} params
   * @returns {Promise<{ imageUrl: string, prompt: string, modelUsed: string }>}
   */
  async generateImage(params) {
    throw new Error(`generateImage() is not supported by ${this.name}`);
  }

  /**
   * Wraps a promise with a timeout.
   */
  async withTimeout(promise, timeoutMs = 20000, operationName = "AI operation") {
    let timeoutHandle;
    const timeoutPromise = new Promise((_, reject) => {
      timeoutHandle = setTimeout(() => {
        reject(new Error(`[${this.name}] ${operationName} timed out after ${timeoutMs}ms`));
      }, timeoutMs);
    });

    try {
      return await Promise.race([promise, timeoutPromise]);
    } finally {
      clearTimeout(timeoutHandle);
    }
  }
}
