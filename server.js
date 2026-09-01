import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

app.use((req, res, next) => {
console.log("Incoming: " + req.method + " " + req.url);
next();
});

const PRIMARY_API_KEY = process.env.GEMINI_API_KEY;
const BACKUP_API_KEY = process.env.GEMINI_BACKUP_API_KEY;

const PRIMARY_MODEL = "gemini-flash-latest";
const BACKUP_MODEL = "gemini-flash-lite-latest";

async function callGemini(prompt, apiKey, model) {
const url =
"https://generativelanguage.googleapis.com/v1beta/models/" +
model +
":generateContent";

const response = await fetch(url, {
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
    })
});

const data = await response.json();

return {
    response: response,
    data: data
};
}

app.post("/ask", async (req, res) => {
try {
const prompt = req.body.prompt;

    if (!prompt) {
        return res.status(400).json({
            error: "Prompt is required"
        });
    }

    const configurations = [
        {
            apiKey: PRIMARY_API_KEY,
            model: PRIMARY_MODEL,
            name: "Primary API + Primary Model"
        },
        {
            apiKey: PRIMARY_API_KEY,
            model: BACKUP_MODEL,
            name: "Primary API + Backup Model"
        },
        {
            apiKey: BACKUP_API_KEY,
            model: PRIMARY_MODEL,
            name: "Backup API + Primary Model"
        },
        {
            apiKey: BACKUP_API_KEY,
            model: BACKUP_MODEL,
            name: "Backup API + Backup Model"
        }
    ];

    let lastError = null;
    let hasApiKey = false;

    for (const config of configurations) {
        if (!config.apiKey) {
            console.log("Skipping " + config.name + " because API key is missing");
            continue;
        }

        hasApiKey = true;

        console.log("Trying: " + config.name);

        try {
            const result = await callGemini(
                prompt,
                config.apiKey,
                config.model
            );

            if (!result.response.ok) {
                console.log(
                    "Failed: " +
                    config.name +
                    " Status: " +
                    result.response.status
                );

                console.log("Trying next fallback...");

                lastError = result.data;

                continue;
            }

            console.log("Success: " + config.name);

            const parts =
                result.data.candidates &&
                result.data.candidates[0] &&
                result.data.candidates[0].content &&
                result.data.candidates[0].content.parts;

            let text = "";

            if (parts && parts.length > 0) {
                for (const part of parts) {
                    if (part.text) {
                        text += part.text;
                    }
                }
            }

            if (!text) {
                console.log(
                    "Empty response from " +
                    config.name +
                    ". Trying next fallback..."
                );

                lastError = {
                    error: {
                        message: "AI returned an empty response"
                    }
                };

                continue;
            }

            console.log("Sending successful AI response to app");

            return res.json({
                result: text
            });

        } catch (error) {
            console.error(
                "Request failed for " +
                config.name +
                ": " +
                error.message
            );

            console.log("Trying next fallback...");

            lastError = {
                error: {
                    message: error.message
                }
            };

            continue;
        }
    }

    if (!hasApiKey) {
        console.error("No Gemini API keys configured");

        return res.status(500).json({
            error: "No Gemini API keys configured"
        });
    }

    console.error("All AI configurations failed");

    console.error(
        "Last error:",
        lastError
    );

    return res.status(503).json({
        error: "AI service is temporarily unavailable. Please try again later."
    });

} catch (error) {
    console.error("Server error:", error);

    return res.status(500).json({
        error: "Server error"
    });
}


});

app.get("/", (req, res) => {
res.send("Backend running");
});

app.get("/ask", (req, res) => {
res.send("ASK route exists");
});

app.listen(PORT, () => {
console.log("Server running on port " + PORT);
});
