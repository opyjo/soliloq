import { NextResponse } from "next/server";

import { consumeRateLimit } from "@/lib/rate-limit";
import { createSupabaseServerClient } from "@/lib/supabase/server";

export type CompanionMode =
  | "devils-advocate"
  | "socratic-questions"
  | "blind-spots"
  | "summarize"
  | "freeform";

export type ChatMessage = {
  role: "user" | "assistant" | "system";
  content: string;
};

const MODE_PROMPTS: Record<CompanionMode, string> = {
  "devils-advocate":
    "Act as a constructive Devil's Advocate. Challenge the user's reasoning, point out potential flaws or counterarguments, and push them to defend or refine their core claim.",
  "socratic-questions":
    "Ask 3 deep, probing follow-up questions to help the user unpack their thought more deeply. Keep your response brief and question-focused.",
  "blind-spots":
    "Identify 2 or 3 unstated assumptions or potential blind spots in the user's writing that they may not have considered.",
  summarize:
    "Provide a concise 2-sentence synthesis capturing the essential thesis and insight of this thought.",
  freeform:
    "You are a Socratic thought companion in 'Still', a private minimalist thought space. Help the user think deeply, unpack ideas, and reflect without being prescriptive or wordy.",
};

const VALID_MODES = new Set<CompanionMode>(
  Object.keys(MODE_PROMPTS) as CompanionMode[],
);
const MAX_REQUEST_BYTES = 32_000;
const MAX_THOUGHT_TITLE_LENGTH = 200;
const MAX_THOUGHT_BODY_LENGTH = 12_000;
const MAX_MESSAGE_LENGTH = 2_000;
const MAX_MESSAGES = 12;
const MAX_CONVERSATION_LENGTH = 8_000;

type ValidatedBody = {
  thoughtTitle: string;
  thoughtBody: string;
  mode: CompanionMode;
  messages: ChatMessage[];
};

function validateRequestBody(value: unknown): ValidatedBody | null {
  if (!value || typeof value !== "object" || Array.isArray(value)) return null;

  const body = value as Record<string, unknown>;
  const thoughtTitle =
    typeof body.thoughtTitle === "string" ? body.thoughtTitle.trim() : "";
  const thoughtBody =
    typeof body.thoughtBody === "string" ? body.thoughtBody : "";
  const mode =
    typeof body.mode === "string" && VALID_MODES.has(body.mode as CompanionMode)
      ? (body.mode as CompanionMode)
      : "freeform";

  if (
    thoughtTitle.length > MAX_THOUGHT_TITLE_LENGTH ||
    thoughtBody.length > MAX_THOUGHT_BODY_LENGTH ||
    !Array.isArray(body.messages) ||
    body.messages.length === 0 ||
    body.messages.length > MAX_MESSAGES
  ) {
    return null;
  }

  let conversationLength = 0;
  const messages: ChatMessage[] = [];

  for (const item of body.messages) {
    if (!item || typeof item !== "object" || Array.isArray(item)) return null;
    const candidate = item as Record<string, unknown>;
    if (
      (candidate.role !== "user" && candidate.role !== "assistant") ||
      typeof candidate.content !== "string"
    ) {
      return null;
    }

    const content = candidate.content.trim();
    if (!content || content.length > MAX_MESSAGE_LENGTH) return null;
    conversationLength += content.length;
    if (conversationLength > MAX_CONVERSATION_LENGTH) return null;
    messages.push({ role: candidate.role, content });
  }

  return { thoughtTitle, thoughtBody, mode, messages };
}

function jsonResponse(
  responseHeaders: Headers,
  body: Record<string, unknown>,
  status: number,
  additionalHeaders?: Record<string, string>,
) {
  const headers = new Headers(responseHeaders);
  Object.entries(additionalHeaders ?? {}).forEach(([name, value]) => {
    headers.set(name, value);
  });
  return NextResponse.json(body, { status, headers });
}

export async function POST(req: Request) {
  try {
    const { supabase, responseHeaders } =
      await createSupabaseServerClient();
    const {
      data: { user },
      error: authError,
    } = await supabase.auth.getUser();

    if (authError || !user) {
      return jsonResponse(
        responseHeaders,
        { error: "You must be signed in to use the AI companion." },
        401,
      );
    }

    const rateLimit = consumeRateLimit(user.id);
    const rateLimitHeaders = {
      "X-RateLimit-Limit": String(rateLimit.limit),
      "X-RateLimit-Remaining": String(rateLimit.remaining),
    };

    if (!rateLimit.allowed) {
      return jsonResponse(
        responseHeaders,
        { error: "Too many AI requests. Please wait a moment and try again." },
        429,
        {
          ...rateLimitHeaders,
          "Retry-After": String(rateLimit.retryAfterSeconds),
        },
      );
    }

    const declaredLength = Number(req.headers.get("content-length") ?? 0);
    if (declaredLength > MAX_REQUEST_BYTES) {
      return jsonResponse(
        responseHeaders,
        { error: "The AI request is too large." },
        413,
        rateLimitHeaders,
      );
    }

    const apiKey = process.env.MOONSHOT_API_KEY;

    if (!apiKey) {
      return jsonResponse(
        responseHeaders,
        {
          error:
            "Moonshot API key not found. Please add MOONSHOT_API_KEY=your_key to your .env.local file and restart the dev server.",
        },
        503,
        rateLimitHeaders,
      );
    }

    let rawBody: unknown;
    try {
      rawBody = await req.json();
    } catch {
      return jsonResponse(
        responseHeaders,
        { error: "The request body must be valid JSON." },
        400,
        rateLimitHeaders,
      );
    }

    const body = validateRequestBody(rawBody);
    if (!body) {
      return jsonResponse(
        responseHeaders,
        { error: "The AI request contains invalid or oversized fields." },
        400,
        rateLimitHeaders,
      );
    }

    const modePrompt = MODE_PROMPTS[body.mode];

    const systemPrompt = `You are a Socratic thought companion for 'Still', a private minimalist writing space.
Target Instruction: ${modePrompt}

Active Thought Title: ${body.thoughtTitle || "Untitled"}
Active Thought Content:
"""
${body.thoughtBody || "(empty)"}
"""

Rules:
- Be concise, insightful, and constructive.
- Do not repeat the entire thought back to the user.
- Focus on helping the user deepen their perspective.`;

    const formattedMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...body.messages,
    ];

    const response = await fetch("https://api.moonshot.cn/v1/chat/completions", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        Authorization: `Bearer ${apiKey}`,
      },
      body: JSON.stringify({
        model: "moonshot-v1-8k",
        messages: formattedMessages,
        temperature: 0.7,
      }),
      signal: AbortSignal.timeout(30_000),
    });

    if (!response.ok) {
      const upstreamError = (await response.text()).slice(0, 500);
      console.error(
        `Moonshot API returned ${response.status}: ${upstreamError}`,
      );
      return jsonResponse(
        responseHeaders,
        { error: "The AI provider could not complete this request." },
        502,
        rateLimitHeaders,
      );
    }

    const data: unknown = await response.json();
    const assistantMessage =
      data &&
      typeof data === "object" &&
      "choices" in data &&
      Array.isArray(data.choices) &&
      typeof data.choices[0]?.message?.content === "string"
        ? data.choices[0].message.content
        : null;

    if (!assistantMessage) {
      return jsonResponse(
        responseHeaders,
        { error: "The AI provider returned an unexpected response." },
        502,
        rateLimitHeaders,
      );
    }

    return jsonResponse(
      responseHeaders,
      { message: assistantMessage },
      200,
      rateLimitHeaders,
    );
  } catch (error) {
    console.error("AI Companion API Error:", error);
    return NextResponse.json(
      { error: "Internal error processing request." },
      { status: 500 }
    );
  }
}
