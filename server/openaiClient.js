import fs from "node:fs";
import path from "node:path";

let envLoaded = false;

function loadDotEnv() {
  if (envLoaded) {
    return;
  }

  envLoaded = true;
  const envPath = path.resolve(process.cwd(), ".env");

  if (!fs.existsSync(envPath)) {
    return;
  }

  const lines = fs.readFileSync(envPath, "utf8").split(/\r?\n/);

  for (const line of lines) {
    const trimmed = line.trim();

    if (!trimmed || trimmed.startsWith("#") || !trimmed.includes("=")) {
      continue;
    }

    const [key, ...valueParts] = trimmed.split("=");
    const value = valueParts.join("=").trim().replace(/^['"]|['"]$/g, "");

    if (!process.env[key]) {
      process.env[key] = value;
    }
  }
}

function extractOutputText(response) {
  if (response.output_text) {
    return response.output_text;
  }

  const message = response.output?.find((item) => item.type === "message");
  const textItem = message?.content?.find((item) => item.type === "output_text");
  return textItem?.text || "";
}

export async function createStructuredResponse({ instructions, input, schema, maxOutputTokens = 600 }) {
  loadDotEnv();

  const apiKey =
    process.env.OPENAI_API_KEY ||
    process.env["OpenAI-API-KEY"] ||
    process.env.OPENAI_KEY ||
    process.env.OPENAI_APIKEY;

  if (!apiKey) {
    throw new Error("OpenAI API key is missing. Add OPENAI_API_KEY to .env or your shell environment.");
  }

  const model = process.env.OPENAI_MODEL || "gpt-4.1-mini";
  const response = await fetch("https://api.openai.com/v1/responses", {
    method: "POST",
    headers: {
      Authorization: `Bearer ${apiKey}`,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model,
      instructions,
      input,
      max_output_tokens: maxOutputTokens,
      text: {
        format: {
          type: "json_schema",
          name: schema.name,
          strict: true,
          schema: schema.schema,
        },
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`OpenAI API error ${response.status}: ${errorText}`);
  }

  const payload = await response.json();
  const outputText = extractOutputText(payload);

  if (!outputText) {
    throw new Error("OpenAI response did not include output text.");
  }

  return {
    model,
    responseId: payload.id,
    data: JSON.parse(outputText),
  };
}
