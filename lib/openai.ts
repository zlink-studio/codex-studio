import OpenAI from "openai";

export function createOpenAIClient() {
  if (!process.env.OPENAI_API_KEY) {
    return null;
  }

  return new OpenAI({
    apiKey: process.env.OPENAI_API_KEY
  });
}

export const defaultModel = process.env.OPENAI_MODEL || "gpt-4o-mini";
