/**
 * Optional Vercel serverless route for Counterpoint's GPT-5.6 analysis.
 * Keep OPENAI_API_KEY in the host's server-side environment only.
 */

declare const process: { env: Record<string, string | undefined> };

type RequestLike = {
  method?: string;
  body?: unknown;
};

type ResponseLike = {
  status: (status: number) => ResponseLike;
  json: (body: unknown) => void;
  setHeader: (name: string, value: string) => void;
};

type AnonymousResponse = {
  id: string;
  claim: string;
  evidence: string;
};

type AnalyzeBody = {
  lesson: { title: string; learningGoal: string; question: string };
  responses: AnonymousResponse[];
};

const safeString = (value: unknown, limit: number) => typeof value === "string" && value.trim().length > 0 && value.length <= limit;

function parseBody(body: unknown): AnalyzeBody | null {
  const value = typeof body === "string" ? JSON.parse(body) : body;
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<AnalyzeBody>;
  if (!candidate.lesson || !candidate.responses || !Array.isArray(candidate.responses) || candidate.responses.length < 3 || candidate.responses.length > 30) return null;
  const { title, learningGoal, question } = candidate.lesson;
  if (![title, learningGoal, question].every((entry) => safeString(entry, 700))) return null;
  const ids = new Set<string>();
  for (const response of candidate.responses) {
    if (!response || !safeString(response.id, 80) || !safeString(response.claim, 1_500) || !safeString(response.evidence, 1_500) || ids.has(response.id)) return null;
    ids.add(response.id);
  }
  return candidate as AnalyzeBody;
}

function outputText(payload: unknown): string | null {
  if (!payload || typeof payload !== "object") return null;
  const response = payload as { output_text?: unknown; output?: Array<{ content?: Array<{ type?: string; text?: string }> }> };
  if (typeof response.output_text === "string") return response.output_text;
  for (const item of response.output ?? []) {
    for (const content of item.content ?? []) {
      if (content.type === "output_text" && typeof content.text === "string") return content.text;
    }
  }
  return null;
}

function schemaFor(responseIds: string[]) {
  return {
    type: "object",
    additionalProperties: false,
    required: ["viewpoints", "responseAssignments", "protocol", "teacherMove", "studentPrompt", "nextMove"],
    properties: {
      viewpoints: {
        type: "array",
        minItems: 3,
        maxItems: 3,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "title", "badge", "color", "summary", "teacherNote"],
          properties: {
            id: { type: "string", enum: ["weight", "gravity", "air"] },
            title: { type: "string" },
            badge: { type: "string" },
            color: { type: "string", enum: ["rose", "blue", "gold"] },
            summary: { type: "string" },
            teacherNote: { type: "string" }
          }
        }
      },
      responseAssignments: {
        type: "array",
        minItems: responseIds.length,
        maxItems: responseIds.length,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["responseId", "viewpoint"],
          properties: {
            responseId: { type: "string", enum: responseIds },
            viewpoint: { type: "string", enum: ["weight", "gravity", "air"] }
          }
        }
      },
      protocol: {
        type: "array",
        minItems: 3,
        maxItems: 5,
        items: {
          type: "object",
          additionalProperties: false,
          required: ["id", "title", "description", "duration"],
          properties: {
            id: { type: "string" },
            title: { type: "string" },
            description: { type: "string" },
            duration: { type: "string" }
          }
        }
      },
      teacherMove: { type: "string" },
      studentPrompt: { type: "string" },
      nextMove: { type: "string" }
    }
  };
}

export default async function handler(request: RequestLike, response: ResponseLike): Promise<void> {
  response.setHeader("cache-control", "no-store");
  if (request.method !== "POST") {
    response.status(405).json({ error: "Use POST for classroom reasoning analysis." });
    return;
  }

  let body: AnalyzeBody | null = null;
  try {
    body = parseBody(request.body);
  } catch {
    response.status(400).json({ error: "Counterpoint could not read that analysis request." });
    return;
  }
  if (!body) {
    response.status(400).json({ error: "Send a learning goal, question, and 3–30 anonymous responses." });
    return;
  }

  const apiKey = process.env.OPENAI_API_KEY;
  if (!apiKey) {
    response.status(503).json({ error: "GPT-5.6 analysis is not configured on this deployment. Demo mode is still available." });
    return;
  }

  const developerPrompt = [
    "You are Counterpoint's classroom reasoning mapper.",
    "Cluster anonymous written reasoning into exactly three contrasting, charitable viewpoints for teacher review.",
    "Do not grade, rank students, predict ability, infer identity, diagnose a learner, or reveal a correct answer.",
    "Every response id must appear exactly once in responseAssignments. Use the fixed viewpoint ids as presentation slots, but write neutral titles that fit the lesson.",
    "Teacher notes should name a productive question, not prescribe a verdict. The student prompt should invite evidence and listening.",
    "Return only content that fits the requested JSON schema."
  ].join(" ");

  try {
    const openAIResponse = await fetch("https://api.openai.com/v1/responses", {
      method: "POST",
      headers: {
        authorization: `Bearer ${apiKey}`,
        "content-type": "application/json"
      },
      body: JSON.stringify({
        model: process.env.OPENAI_MODEL || "gpt-5.6-terra",
        input: [
          { role: "developer", content: developerPrompt },
          { role: "user", content: JSON.stringify(body) }
        ],
        text: {
          format: {
            type: "json_schema",
            name: "counterpoint_reasoning_map",
            strict: true,
            schema: schemaFor(body.responses.map((item) => item.id))
          }
        }
      })
    });
    if (!openAIResponse.ok) {
      response.status(502).json({ error: "GPT-5.6 could not complete this analysis. The teacher can continue in demo mode." });
      return;
    }

    const rawText = outputText(await openAIResponse.json());
    if (!rawText) {
      response.status(502).json({ error: "GPT-5.6 returned no structured analysis. The teacher can continue in demo mode." });
      return;
    }
    const parsed = JSON.parse(rawText) as {
      responseAssignments: Array<{ responseId: string; viewpoint: string }>;
      [key: string]: unknown;
    };
    const { responseAssignments, ...analysis } = parsed;
    const responseViewpoints = Object.fromEntries(responseAssignments.map((item) => [item.responseId, item.viewpoint]));
    response.status(200).json({ ...analysis, model: process.env.OPENAI_MODEL || "gpt-5.6-terra", responseViewpoints });
  } catch {
    response.status(502).json({ error: "GPT-5.6 analysis could not be completed. The teacher can continue in demo mode." });
  }
}
