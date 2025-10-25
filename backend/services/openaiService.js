// services/openaiService.js
import axios from "axios";

/**
 * Send structured chat messages to Groq so the model truly uses prior turns.
 * @param {Array<{role: 'system'|'user'|'assistant', content: string}>} messages
 * @param {{temperature?: number, maxTokens?: number, model?: string, timeoutMs?: number}} opts
 * @returns {Promise<string>}
 */
export const chatWithGroq = async (
  messages,
  {
    temperature = 0.3,
    maxTokens = 900,
    model = "llama-3.3-70b-versatile",
    timeoutMs = 20000,
  } = {}
) => {
  try {
    const response = await axios.post(
      "https://api.groq.com/openai/v1/chat/completions",
      {
        model,
        messages,
        temperature,
        max_tokens: maxTokens,
      },
      {
        headers: {
          Authorization: `Bearer ${process.env.GROQ_API_KEY}`,
          "Content-Type": "application/json",
        },
        timeout: timeoutMs,
      }
    );

    const text = response?.data?.choices?.[0]?.message?.content?.trim();
    if (!text) throw new Error("Empty response from Groq.");
    return text;
  } catch (error) {
    const apiMsg =
      error?.response?.data?.error?.message ||
      error?.response?.data ||
      error?.message ||
      "Unknown Groq error";
    console.error("❌ Groq API Error:", apiMsg);
    return "Error generating summary.";
  }
};
