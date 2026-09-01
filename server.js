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

const PRIMARY_API_KEY = process.env.GEMINI_API_KEY;
const BACKUP_API_KEY = process.env.GEMINI_BACKUP_API_KEY;

const PRIMARY_MODEL = "gemini-flash-latest";
const BACKUP_MODEL = "gemini-flash-lite-latest";

async function callGemini(prompt, apiKey, model) {
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
})
}
);

```
const data = await response.json();

return {
    response,
    data
};
```

}

app.post("/ask", async (req, res) => {
try {
const prompt = req.body.prompt;

```
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
    ].filter(config => config.apiKey);

    let lastError;

    for (const config of configurations) {
        try {
            console.log(`Trying: ${config.name}`);

            const result = await callGemini(
                prompt,
                config.apiKey,
                config.model
            );

            if (result.response.ok) {
                console.log(`Success: ${config.name}`);

                const text =
                    result.data.candidates?.[0]?.content?.parts
                        ?.map(part => part.text || "")
                        .join("")
                        .trim() || "No response";

                try {
                    const parsed = JSON.parse(text);
                    return res.json(parsed);
                } catch {
                    return res.json({
                        result: text
                    });
                }
            }

            console.log(
                `Failed: ${config.name}`,
                result.response.status,
                result.data
            );

            lastError = result.data;

        } catch (error) {
            console.error(
                `Error with ${config.name}:`,
                error.message
            );

            lastError = {
                error: {
                    message: error.message
                }
            };
        }
    }

    return res.status(503).json({
        error:
            lastError?.error?.message ||
            "All Gemini services are temporarily unavailable"
    });

} catch (err) {
    console.error("Server error:", err);

    return res.status(500).json({
        error: "Server error"
    });
}
```

});

app.get("/", (req, res) => {
res.send("Backend running");
});

app.get("/ask", (req, res) => {
res.send("ASK route exists");
});

app.listen(PORT, () => {
console.log(`Server running on port ${PORT}`);
});
