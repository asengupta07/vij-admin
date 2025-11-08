import { GoogleGenerativeAI } from "@google/generative-ai";
import { ALL, parseJSON } from 'partial-json';


const API_KEY = process.env.GEMINI_API_KEY;

export async function summarizeError(params: {
  message: string;
  stack?: string;
  metadata?: Record<string, unknown>;
}): Promise<string | null> {
  if (!API_KEY) return null;
  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const { summary } = (await summarizeErrorStructured(params)) ?? {};
    return summary ?? null;
  } catch {
    return null;
  }
}

export async function summarizeErrorStructured(params: {
  message: string;
  stack?: string;
  metadata?: Record<string, unknown>;
}): Promise<{ summary: string; causes: string[]; fixes: string[]; tags: string[]; confidence?: number } | null> {
  if (!API_KEY) return null;
  try {
    const genAI = new GoogleGenerativeAI(API_KEY);
    const model = genAI.getGenerativeModel({ model: "gemini-2.5-flash" });
    const prompt = [
      "You are an AI assistant summarizing JavaScript error logs for developers.",
      "Return ONLY a strict minified JSON object with the following shape and nothing else:",
      `{"summary": string, "causes": string[], "fixes": string[], "tags": string[], "confidence": number}`,
      "Rules:",
      "- Keep strings concise and actionable.",
      "- Provide 1-3 items for causes and fixes.",
      "- Tags should be lowercase keywords (e.g., network, fetch, 404).",
      "- confidence is 0..1.",
      "",
      `Error: ${safeSlice(params.message, 800)}`,
      `Stack trace (first lines): ${safeSlice(params.stack ?? "N/A", 1200)}`,
      `Metadata: ${safeSlice(JSON.stringify(params.metadata ?? {}), 1500)}`
    ].join("\n");
    const res = await model.generateContent(prompt);
    const raw = res.response.text().trim();
    const parsed = parseUntilJson(raw);
    if (!parsed) return null;
    // Basic sanitation
    return {
      summary: safeSlice(String(parsed.summary ?? ""), 500),
      causes: Array.isArray(parsed.causes) ? parsed.causes.map((s: any) => String(s)).slice(0, 5) : [],
      fixes: Array.isArray(parsed.fixes) ? parsed.fixes.map((s: any) => String(s)).slice(0, 5) : [],
      tags: Array.isArray(parsed.tags) ? parsed.tags.map((s: any) => String(s)).slice(0, 10) : [],
      confidence: typeof parsed.confidence === "number" ? Math.max(0, Math.min(1, parsed.confidence)) : undefined
    };
  } catch {
    return null;
  }
}

function safeSlice(input: string, max: number): string {
  if (input.length <= max) return input;
  return input.slice(0, max) + "…";
}


export function parseUntilJson(jsonstr: string): Record<string, any> {
  let jsonRes: Record<string, any> | string = jsonstr;
  jsonRes = jsonRes.replaceAll('\n', '')
  if (jsonRes.startsWith('```json')) {
    jsonRes = jsonRes.replace('```json', '');
  }
  if (jsonRes.startsWith('```') || jsonRes.endsWith('```')) {
    jsonRes = jsonRes.replaceAll('```', '');
  }
  try {
    const properlyParsedJson = JSON.parse(jsonRes);
    if (typeof properlyParsedJson === 'object' && properlyParsedJson !== null) {
      return properlyParsedJson;
    } else {
      jsonRes = properlyParsedJson;
    }
  } catch (error) {
    console.error(error);
  }
  const curlIndex =
    jsonRes.indexOf('{') === -1 ? jsonRes.length : jsonRes.indexOf('{');
  const sqIndex =
    jsonRes.indexOf('[') === -1 ? jsonRes.length : jsonRes.indexOf('[');
  jsonRes = jsonRes.slice(Math.min(curlIndex, sqIndex));

  if (jsonRes.startsWith('```json')) {
    jsonRes = jsonRes.replace('```json', '');
  }
  if (jsonRes.startsWith('```') || jsonRes.endsWith('```')) {
    jsonRes = jsonRes.replaceAll('```', '');
  }
  jsonRes = jsonRes.replaceAll('{\\n', '{').replaceAll('\\n}', '}');
  try {
    while (typeof jsonRes === 'string') {
      jsonRes = parseJSON(jsonRes, ALL);
    }
    return jsonRes;
  } catch (error) {
    console.error(error);
    return {};
  }
}


