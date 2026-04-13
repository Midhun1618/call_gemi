import express from "express";
import cors from "cors";
import dotenv from "dotenv";

dotenv.config();

const app = express();
app.use(cors());
app.use(express.json());

app.post("/ask", async (req, res) => {
    try {
        const prompt = req.body.prompt;

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

        const text =
            data.candidates?.[0]?.content?.parts?.[0]?.text || "No response";

        res.json({ result: text });

    } catch (err) {
        res.status(500).json({ error: "Server error" });
    }
});

app.get("/", (req, res) => {
    res.send("Backend running 🚀");
});

app.listen(3000, () => {
    console.log("Server running on port 3000");
});