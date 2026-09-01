import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
console.log(`Incoming: ${req.method} ${req.url}`);
next();
});

// Gemini configuration
const GEMINI_API_KEY = process.env.GEMINI_API_KEY;
const PRIMARY_MODEL = "gemini-flash-latest";
const BACKUP_MODEL = "gemini-flash-lite-latest";
const REQUEST_TIMEOUT = 30000;

// Sleep helper
function sleep(ms) {
return new Promise(resolve => setTimeout(resolve, ms));
}

// Temporary API errors
function isTemporaryError(status) {
return [429, 500, 502, 503, 504].includes(status);
}

// Call a Gemini model
async function callGemini(prompt, model) {
console.log(`Calling Gemini model: ${model}`);

```
const controller = new AbortController();

const timeoutId = setTimeout(() => {
    controller.abort();
}, REQUEST_TIMEOUT);

try {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent?key=${GEMINI_API_KEY}`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json"
            },
            body: JSON.stringify({
                contents: [
                    {
                        parts: [
                            {
                                text: prompt
                            }
                        ]
                    }
                ]
            }),
            signal: controller.signal
        }
    );

    const data = await response.json();

    if (response.ok) {
        console.log(`Gemini model successful: ${model}`);

        return {
            success: true,
            model,
            data
        };
    }

    console.error(
        `Gemini model failed: ${model}`,
        `Status: ${response.status}`,
        data
    );

    return {
        success: false,
        model,
        status: response.status,
        data
    };

} catch (error) {
    console.error(
        `Request error for model ${model}:`,
        error.message
    );

    return {
        success: false,
        model,
        status: error.name === "AbortError" ? 504 : 500,
        error: error.message
    };

} finally {
    clearTimeout(timeoutId);
}
```

}

// Try primary and backup models
async function askGemini(prompt) {
const models = [
PRIMARY_MODEL,
BACKUP_MODEL
];

```
let lastError;

// First attempt
console.log("========== GEMINI ROUND 1 ==========");

for (const model of models) {
    const result = await callGemini(prompt, model);

    if (result.success) {
        console.log(`Response generated using: ${model}`);
        return result.data;
    }

    lastError = result;

    if (isTemporaryError(result.status)) {
        console.log(`${model} temporarily unavailable. Trying next model...`);
        continue;
    }

    throw new Error(
        result.data?.error?.message ||
        result.error ||
        `Gemini API error: ${result.status}`
    );
}

// Wait before retrying
console.log("Both Gemini models failed. Waiting 2 seconds before retry...");
await sleep(2000);

// Second attempt
console.log("========== GEMINI ROUND 2 ==========");

for (const model of models) {
    const result = await callGemini(prompt, model);

    if (result.success) {
        console.log(`Response generated using: ${model}`);
        return result.data;
    }

    lastError = result;

    if (isTemporaryError(result.status)) {
        console.log(`${model} still temporarily unavailable.`);
        continue;
    }

    throw new Error(
        result.data?.error?.message ||
        result.error ||
        `Gemini API error: ${result.status}`
    );
}

throw new Error(
    lastError?.data?.error?.message ||
    lastError?.error ||
    "All Gemini models are currently unavailable"
);
```

}

// Ask endpoint
app.post("/ask", async (req, res) => {
try {
const prompt = req.body.prompt;

```
    if (!prompt) {
        return res.status(400).json({
            error: "Prompt is required"
        });
    }

    if (!GEMINI_API_KEY) {
        console.error("GEMINI_API_KEY is missing");

        return res.status(500).json({
            error: "Server configuration error"
        });
    }

    console.log("Sending request to Gemini...");

    const data = await askGemini(prompt);

    const text = data.candidates?.[0]?.content?.parts
        ?.map(part => part.text || "")
        .join("")
        .trim();

    if (!text) {
        console.error(
            "Gemini returned no usable text:",
            JSON.stringify(data, null, 2)
        );

        return res.status(502).json({
            error: "AI returned an empty response"
        });
    }

    console.log("Gemini response received successfully");

    try {
        const parsed = JSON.parse(text);
        return res.json(parsed);
    } catch {
        return res.json({
            result: text
        });
    }

} catch (err) {
    console.error("Final server error:", err.message);

    return res.status(503).json({
        error: "AI service is temporarily unavailable. Please try again in a moment."
    });
}
```

});

// Health check
app.get("/", (req, res) => {
res.send("Backend running");
});

// Ask route check
app.get("/ask", (req, res) => {
res.send("ASK route exists");
});

// Start server
app.listen(PORT, () => {
console.log(`Server running on port ${PORT}`);
});
