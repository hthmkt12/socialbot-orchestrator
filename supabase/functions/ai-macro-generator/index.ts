import "jsr:@supabase/functions-js/edge-runtime.d.ts";
import { createClient } from "npm:@supabase/supabase-js@2.57.4";
import { buildSystemPrompt } from "./system-prompt.ts";
import { sanitizeLlmMacroOutput } from "./output-sanitizer.ts";

const corsHeaders = {
  "Access-Control-Allow-Origin": "*",
  "Access-Control-Allow-Methods": "POST, OPTIONS",
  "Access-Control-Allow-Headers":
    "Content-Type, Authorization, X-Client-Info, Apikey",
};

interface GenerateRequest {
  prompt: string;
  existingMacro?: Record<string, unknown>;
}

function json(body: unknown, status = 200) {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, "Content-Type": "application/json" },
  });
}

function readRequiredEnv(name: string) {
  const value = Deno.env.get(name);
  if (!value) throw new Error(`Missing required env var: ${name}`);
  return value;
}

Deno.serve(async (req: Request) => {
  if (req.method === "OPTIONS") {
    return new Response(null, { status: 204, headers: corsHeaders });
  }

  if (req.method !== "POST") {
    return json({ error: "Method not allowed" }, 405);
  }

  try {
    // Auth check
    const authHeader = req.headers.get("Authorization");
    if (!authHeader) return json({ error: "Missing auth" }, 401);

    const supabaseUrl = readRequiredEnv("SUPABASE_URL");
    const anonKey = readRequiredEnv("SUPABASE_ANON_KEY");
    const userClient = createClient(supabaseUrl, anonKey, {
      global: { headers: { Authorization: authHeader } },
    });

    const { data: { user }, error: authError } = await userClient.auth.getUser();
    if (authError || !user) return json({ error: "Unauthorized" }, 401);

    // Parse body
    const body = (await req.json()) as GenerateRequest;
    if (!body.prompt || typeof body.prompt !== "string" || body.prompt.trim().length < 3) {
      return json({ error: "Prompt must be at least 3 characters" }, 400);
    }

    // LLM provider config
    const provider = Deno.env.get("AI_MACRO_LLM_PROVIDER") ?? "openai";
    const model = Deno.env.get("AI_MACRO_LLM_MODEL") ?? "gpt-4o";
    const apiKey = readRequiredEnv("AI_MACRO_LLM_API_KEY");

    const systemPrompt = buildSystemPrompt(body.existingMacro);
    const userMessage = body.prompt.trim();

    let macroJson: Record<string, unknown>;

    if (provider === "openai") {
      macroJson = await callOpenAI(apiKey, model, systemPrompt, userMessage);
    } else if (provider === "anthropic") {
      macroJson = await callAnthropic(apiKey, model, systemPrompt, userMessage);
    } else {
      return json({ error: `Unsupported LLM provider: ${provider}` }, 400);
    }

    // Sanitize & validate structure
    const sanitized = sanitizeLlmMacroOutput(macroJson);
    return json({ macro: sanitized });
  } catch (err) {
    const message = err instanceof Error ? err.message : "Unknown error";
    console.error("ai-macro-generator error:", message);
    return json({ error: message }, 500);
  }
});

async function callOpenAI(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
): Promise<Record<string, unknown>> {
  const response = await fetch("https://api.openai.com/v1/chat/completions", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      Authorization: `Bearer ${apiKey}`,
    },
    body: JSON.stringify({
      model,
      messages: [
        { role: "system", content: systemPrompt },
        { role: "user", content: userMessage },
      ],
      response_format: { type: "json_object" },
      temperature: 0.3,
      max_tokens: 4096,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  const content = data.choices?.[0]?.message?.content;
  if (!content) throw new Error("Empty response from OpenAI");

  return JSON.parse(content);
}

async function callAnthropic(
  apiKey: string,
  model: string,
  systemPrompt: string,
  userMessage: string,
): Promise<Record<string, unknown>> {
  const response = await fetch("https://api.anthropic.com/v1/messages", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-api-key": apiKey,
      "anthropic-version": "2023-06-01",
    },
    body: JSON.stringify({
      model,
      max_tokens: 4096,
      system: systemPrompt,
      messages: [{ role: "user", content: userMessage }],
      temperature: 0.3,
    }),
  });

  if (!response.ok) {
    const errorBody = await response.text();
    throw new Error(`Anthropic API error ${response.status}: ${errorBody}`);
  }

  const data = await response.json();
  const textBlock = data.content?.find(
    (b: { type: string }) => b.type === "text",
  );
  if (!textBlock?.text) throw new Error("Empty response from Anthropic");

  // Extract JSON from markdown fences if present
  const raw = textBlock.text.trim();
  const fenceMatch = raw.match(/```(?:json)?\s*([\s\S]*?)```/);
  const jsonStr = fenceMatch ? fenceMatch[1].trim() : raw;

  return JSON.parse(jsonStr);
}
