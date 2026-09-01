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
const PRIMARY_API_KEY = process.env.GEMINI_API_KEY;
const BACKUP_API_KEY = process.env.GEMINI_BACKUP_API_KEY;

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

// Call Gemini
async function callGemini(prompt, apiKey, model, apiName) {
console.log(`Trying ${apiName} with model: ${model}`);

```
const controller = new AbortController();

const timeoutId = setTimeout(() => {
    controller.abort();
}, REQUEST_TIMEOUT);

try {
    const response = await fetch(
        `https://generativelanguage.googleapis.com/v1beta/models/${model}:generateContent`,
        {
            method: "POST",
            headers: {
                "Content-Type": "application/json",
                "X-goog-api-key": apiKey
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
        console.log(`Success using ${apiName} + ${model}`);

        return {
            success: true,
            data
        };
    }

    console.error(
        `${apiName} + ${model} failed with status ${response.status}:`,
        data
    );

    return {
        success: false,
        status: response.status,
        data
    };

} catch (error) {
    console.error(
        `${apiName} + ${model} request error:`,
        error.message
    );

    return {
        success: false,
        status: error.name === "AbortError" ? 504 : 500,
        error: error.message
    };

} finally {
    clearTimeout(timeoutId);
}
```

}

// Gemini fallback system
async function askGemini(prompt) {
const configurations = [
{
apiKey: PRIMARY_API_KEY,
apiName: "PRIMARY API",
model: PRIMARY_MODEL
},
{
apiKey: PRIMARY_API_KEY,
apiName: "PRIMARY API",
model: BACKUP_MODEL
},
{
apiKey: BACKUP_API_KEY,
apiName: "BACKUP API",
model: PRIMARY_MODEL
},
{
apiKey: BACKUP_API_KEY,
apiName: "BACKUP API",
model: BACKUP_MODEL
}
].filter(config => config.apiKey);

```
if (configurations.length === 0) {
    throw new Error("No Gemini API keys configured");
}

let lastError;

// First round
console.log("========== GEMINI ROUND 1 ==========");

for (const config of configurations) {
    const result = await callGemini(
        prompt,
        config.apiKey,
        config.model,
        config.apiName
    );

    if (result.success) {
        return result.data;
    }

    lastError = result;

    if (!isTemporaryError(result.status)) {
        throw new Error(
            result.data?.error?.message ||
            result.error ||
            `Gemini API error: ${result.status}`
        );
    }
}

// Wait before retry
console.log("All Gemini configurations failed. Waiting 2 seconds...");
await sleep(2000);

// Second round
console.log("========== GEMINI ROUND 2 ==========");

for (const config of configurations) {
    const result = await callGemini(
        prompt,
        config.apiKey,
        config.model,
        config.apiName
    );

    if (result.success) {
        return result.data;
    }

    lastError = result;

    if (!isTemporaryError(result.status)) {
        throw new Error(
            result.data?.error?.message ||
            result.error ||
            `Gemini API error: ${result.status}`
        );
    }
}

throw new Error(
    lastError?.data?.error?.message ||
    lastError?.error ||
    "All Gemini API configurations are currently unavailable"
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

    if (!PRIMARY_API_KEY && !BACKUP_API_KEY) {
        return res.status(500).json({
            error: "Gemini API keys are missing"
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
