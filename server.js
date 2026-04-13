import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();

// 🔥 IMPORTANT for Render (port fix)
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// ✅ Debug log (helps you see requests in Render logs)
app.use((req, res, next) => {
    console.log(`Incoming: ${req.method} ${req.url}`);
    next();
});

// ✅ MAIN ROUTE
app.post("/ask", async (req, res) => {
    try {
        const prompt = req.body.prompt;

        if (!prompt) {
            return res.status(400).json({ error: "Prompt is required" });
        }

        const response = await fetch(
            `https://generativelanguage.googleapis.com/v1beta/models/gemini-pro:generateContent?key=${process.env.GEMINI_API_KEY}`,
            {
                method: "POST",
                headers: {
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({
                    contents: [{
                        parts: [{ text: prompt }]
                    }]
                })
            }
        );

        const data = await response.json();

        console.log("Gemini response:", data); // 🔥 debug

        const text =
            data.candidates?.[0]?.content?.parts?.[0]?.text || "No response";

        // ✅ Try to return clean JSON if possible
        try {
            const parsed = JSON.parse(text);
            res.json(parsed);
        } catch {
            res.json({ result: text });
        }

    } catch (err) {
        console.error("Error:", err);
        res.status(500).json({ error: "Server error" });
    }
});

// ✅ Root check
app.get("/", (req, res) => {
    res.send("Backend running 🚀");
});

// ✅ Optional: test route
app.get("/ask", (req, res) => {
    res.send("ASK route exists ✅");
});

// ❌ Remove hardcoded 3000
app.listen(PORT, () => {
    console.log(`Server running on port ${PORT}`);
});