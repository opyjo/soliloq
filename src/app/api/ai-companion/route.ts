import { NextResponse } from "next/server";

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

export async function POST(req: Request) {
  try {
    const apiKey = process.env.MOONSHOT_API_KEY;

    if (!apiKey) {
      return NextResponse.json(
        {
          error:
            "Moonshot API key not found. Please add MOONSHOT_API_KEY=your_key to your .env.local file and restart the dev server.",
        },
        { status: 400 }
      );
    }

    const body = await req.json();
    const { thoughtTitle, thoughtBody, mode, messages } = body as {
      thoughtTitle?: string;
      thoughtBody?: string;
      mode?: CompanionMode;
      messages?: ChatMessage[];
    };

    const activeMode: CompanionMode = mode || "freeform";
    const modePrompt = MODE_PROMPTS[activeMode];

    const systemPrompt = `You are a Socratic thought companion for 'Still', a private minimalist writing space.
Target Instruction: ${modePrompt}

Active Thought Title: ${thoughtTitle || "Untitled"}
Active Thought Content:
"""
${thoughtBody || "(empty)"}
"""

Rules:
- Be concise, insightful, and constructive.
- Do not repeat the entire thought back to the user.
- Focus on helping the user deepen their perspective.`;

    const formattedMessages: ChatMessage[] = [
      { role: "system", content: systemPrompt },
      ...(messages || []),
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
    });

    if (!response.ok) {
      const errText = await response.text();
      return NextResponse.json(
        { error: `Moonshot API returned status ${response.status}: ${errText}` },
        { status: response.status }
      );
    }

    const data = await response.json();
    const assistantMessage =
      data.choices?.[0]?.message?.content || "No response generated.";

    return NextResponse.json({ message: assistantMessage });
  } catch (error) {
    console.error("AI Companion API Error:", error);
    return NextResponse.json(
      { error: "Internal error processing request." },
      { status: 500 }
    );
  }
}
