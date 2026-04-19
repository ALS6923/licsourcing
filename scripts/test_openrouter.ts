import * as dotenv from 'dotenv';
import path from 'path';
import { ChatOpenAI } from "@langchain/openai";

dotenv.config({ path: path.resolve(process.cwd(), '.env.local') });

async function testOpenRouter() {
  console.log("Testing OpenRouter Connection...");
  
  try {
    const llm = new ChatOpenAI({
      modelName: "openai/gpt-4o-mini",
      apiKey: process.env.OPENROUTER_API_KEY,
      configuration: {
        baseURL: "https://openrouter.ai/api/v1",
      },
    });

    const res = await llm.invoke("Hello, simple test.");
    console.log("SUCCESS:", res.content);
  } catch (err: any) {
    console.error("FAILED:", err.message);
    if (err.stack) console.error(err.stack);
  }
}

testOpenRouter();
