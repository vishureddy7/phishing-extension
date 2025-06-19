import express from "express";
import cors from "cors";
import fetch from "node-fetch";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = 5001;

app.use(cors());
app.use(express.json());

const OPENROUTER_API_KEY = process.env.OPENROUTER_API_KEY;

if (!OPENROUTER_API_KEY) {
  console.error("❌ OPENROUTER_API_KEY is not set in .env");
  process.exit(1);
}

// Allowed models list (update if you know more valid models)
const ALLOWED_MODELS = [
  "gpt-3.5-turbo",
  "gpt-4o-mini"
];

// Validate model or fallback to default
function validateModel(model) {
  if (ALLOWED_MODELS.includes(model)) {
    return model;
  }
  console.warn(`⚠️ Model "${model}" is invalid. Falling back to "gpt-3.5-turbo".`);
  return "gpt-3.5-turbo";
}

app.post("/openai-chat", async (req, res) => {
  try {
    let { messages, model = "gpt-3.5-turbo", temperature = 0.7, max_tokens = 150 } = req.body;

    if (!messages || !Array.isArray(messages)) {
      return res.status(400).json({ error: "Missing or invalid 'messages' array in request body" });
    }

    model = validateModel(model);

    // Log request payload for debugging
    console.log("Forwarding request to OpenRouter:", { model, messages, temperature, max_tokens });

    const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
      method: "POST",
      headers: {
        "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
        "Content-Type": "application/json"
      },
      body: JSON.stringify({
        model,
        messages,
        temperature,
        max_tokens,
      }),
    });

    if (!response.ok) {
      const errorData = await response.json().catch(() => ({}));
      console.error("OpenRouter API error:", response.status, errorData);
      return res.status(response.status).json(errorData);
    }

    const data = await response.json();
    res.json(data);
  } catch (error) {
    console.error("Proxy server error:", error);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

app.listen(PORT, () => {
  console.log(`OpenRouter proxy server running on http://localhost:${PORT}`);
});
