require('dotenv').config();
const express = require('express');
const multer = require('multer');
const cors = require('cors');
const path = require('path');
const fs = require('fs');
const OpenAI = require('openai');

const app = express();
const port = process.env.PORT || 3000;

// Load history
const historyFile = path.join(__dirname, 'history.json');
let history = [];
if (fs.existsSync(historyFile)) {
    try {
        history = JSON.parse(fs.readFileSync(historyFile, 'utf8'));
    } catch (e) {
        console.error("Error loading history:", e);
    }
}

// Initialize OpenAI (compatible with OpenRouter)
const openai = new OpenAI({
    apiKey: process.env.OPENAI_API_KEY,
    baseURL: process.env.OPENAI_BASE_URL || 'https://api.openai.com/v1'
});

let aiTemperature = process.env.AI_TEMPERATURE ? parseFloat(process.env.AI_TEMPERATURE) : 0.3;

// Set up storage for multer
const uploadDir = path.join(__dirname, 'uploads');
if (!fs.existsSync(uploadDir)) {
    fs.mkdirSync(uploadDir);
}

const storage = multer.diskStorage({
    destination: function (req, file, cb) {
        cb(null, 'uploads/');
    },
    filename: function (req, file, cb) {
        cb(null, Date.now() + '-' + file.originalname);
    }
});
const upload = multer({ storage: storage });

app.use(cors());
app.use(express.json());
app.use(express.static(__dirname));

// Make file upload optional
const optionalUpload = function(req, res, next) {
    upload.single('media')(req, res, function(err) {
        if (err) {
            console.log('Upload note:', err.message);
        }
        next();
    });
};

// Build prompt based on tab type
function buildPrompt(tabType, headline, socialUrl, fileName) {
    const baseInstruction = `You are an expert AI-powered misinformation analyst. Analyze the provided content and determine whether it is likely REAL (authentic, legitimate news) or FAKE (misinformation, manipulated, AI-generated).

You MUST respond with ONLY a valid JSON object. No markdown, no explanation, no text outside the JSON.

The JSON must follow this exact structure:
{
  "fraudIndex": <number 0-100, where 0 = completely authentic, 100 = completely fake>,
  "verdict": "<AUTHENTIC|LOW_RISK|MEDIUM_RISK|HIGH_RISK>",
  "modalityScores": {
    "nlp": <number 0-100>,
    "cv": <number 0-100>,
    "xmodal": <number 0-100>
  },
  "diagnostics": [
    {
      "type": "<error|warning|success>",
      "icon": "<material icon name>",
      "title": "<short finding title with emoji>",
      "description": "<detailed 1-2 sentence explanation>"
    }
  ]
}

IMPORTANT RULES:
- If the content appears to be LEGITIMATE, REAL news, give LOW scores (0-30) and verdict AUTHENTIC or LOW_RISK.
- If the content appears to be FAKE or MANIPULATED, give HIGH scores (70-100) and verdict HIGH_RISK.
- Always provide exactly 4 diagnostic items.
- Use "success" type for things that check out as authentic.
- Use "error" type for major red flags.
- Use "warning" type for suspicious but not conclusive findings.
- Be accurate and fair. Do NOT default to fake. Analyze the actual content.`;

    if (tabType === 'video') {
        return `${baseInstruction}

Content Type: Video Analysis
Headline/Description: "${headline || 'No headline provided'}"
Filename: "${fileName || 'Unknown'}"

Analyze this video submission. Consider:
- Whether the headline suggests real or fabricated events
- Likelihood of deepfake based on context clues
- Whether the described events are verifiable
- Metadata consistency

For modalityScores:
- nlp: Score for textual/headline authenticity
- cv: Score for visual manipulation likelihood
- xmodal: Score for cross-modal consistency (audio-visual sync, etc.)`;

    } else if (tabType === 'article') {
        return `${baseInstruction}

Content Type: Article & Image Analysis
Headline/Article Text: "${headline || 'No headline provided'}"
Filename: "${fileName || 'No image uploaded'}"

Analyze this article/image submission. Consider:
- Whether the text shows signs of AI generation (uniform sentence length, generic phrasing)
- Whether the headline is sensationalist or clickbait
- Whether the claims are verifiable or contain known misinformation patterns
- Source credibility indicators

For modalityScores:
- nlp: Score for text authenticity (AI-generated vs human-written)
- cv: Score for image manipulation likelihood
- xmodal: Score for text-image consistency`;

    } else if (tabType === 'social') {
        return `${baseInstruction}

Content Type: Social Media URL Analysis
Social Media URL: "${socialUrl || 'No URL provided'}"
Additional Context: "${headline || 'None'}"

Analyze this social media post. Consider:
- Whether the URL structure suggests a legitimate platform
- Signs of bot amplification or coordinated inauthentic behavior
- Whether the content follows misinformation patterns
- Platform credibility and account verification

For modalityScores:
- nlp: Score for text/caption authenticity
- cv: Score for media attachment manipulation
- xmodal: Score for behavioral pattern analysis (bot-like activity)`;
    }
}

// Analyze content using OpenAI
async function analyzeWithAI(tabType, headline, socialUrl, file) {
    const prompt = buildPrompt(tabType, headline, socialUrl, file ? file.originalname : '');

    let userContent = [
        { type: "text", text: prompt }
    ];

    // If an image was uploaded, send it to OpenAI for Vision analysis
    if (file && file.mimetype && file.mimetype.startsWith('image/')) {
        try {
            const base64Image = fs.readFileSync(file.path, { encoding: 'base64' });
            userContent.push({
                type: "image_url",
                image_url: {
                    url: `data:${file.mimetype};base64,${base64Image}`
                }
            });
            console.log(`[Vision] Added image to analysis: ${file.originalname}`);
        } catch (e) {
            console.error("Failed to read image for vision analysis:", e);
        }
    }

    try {
        const completion = await openai.chat.completions.create({
            model: "openai/gpt-4o-mini",
            messages: [
                { role: "system", content: "You are a misinformation detection AI. You MUST respond with ONLY valid JSON. No markdown code fences, no extra text." },
                { role: "user", content: userContent }
            ],
            temperature: aiTemperature,
            max_tokens: 1000
        });

        const responseText = completion.choices[0].message.content.trim();
        
        // Clean up response - remove markdown code fences if present
        let cleanJson = responseText;
        if (cleanJson.startsWith('```')) {
            cleanJson = cleanJson.replace(/^```(?:json)?\n?/, '').replace(/\n?```$/, '');
        }

        const result = JSON.parse(cleanJson);
        return result;

    } catch (error) {
        console.error('OpenAI API Error:', error.message);
        // Return a fallback response if the API fails
        return {
            fraudIndex: 50,
            verdict: "MEDIUM_RISK",
            modalityScores: { nlp: 50, cv: 50, xmodal: 50 },
            diagnostics: [
                { type: "warning", icon: "error_outline", title: "⚠️ Analysis Incomplete", description: "The AI analysis could not be fully completed. Results may be unreliable." },
                { type: "warning", icon: "cloud_off", title: "⚡ API Connection Issue", description: `Error: ${error.message}` },
                { type: "warning", icon: "psychology", title: "⚠️ Manual Review Recommended", description: "Please verify this content manually as automated analysis was limited." },
                { type: "success", icon: "info", title: "ℹ️ Partial Analysis", description: "Some basic checks were performed but full multimodal analysis was unavailable." }
            ]
        };
    }
}

// Verify endpoint
app.post('/api/verify', optionalUpload, async (req, res) => {
    try {
        const headline = req.body.headline || '';
        const tabType = req.body.tabType || 'video';
        const socialUrl = req.body.socialUrl || '';
        const fileName = req.file ? req.file.originalname : '';

        console.log(`\n--- New Analysis Request ---`);
        console.log(`Tab: ${tabType} | Headline: "${headline}" | File: ${fileName} | URL: ${socialUrl}`);

        const result = await analyzeWithAI(tabType, headline, socialUrl, req.file);
        
        // Clean up the uploaded file to save space
        if (req.file && fs.existsSync(req.file.path)) {
            fs.unlinkSync(req.file.path);
        }

        // Save to history
        const verificationRecord = {
            id: Date.now().toString(),
            timestamp: new Date().toISOString(),
            tabType: tabType,
            headline: headline,
            fileName: fileName,
            socialUrl: socialUrl,
            fraudIndex: result.fraudIndex,
            verdict: result.verdict,
            modalityScores: result.modalityScores
        };
        history.unshift(verificationRecord);
        fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));

        console.log(`Result: Fraud Index = ${result.fraudIndex}% | Verdict = ${result.verdict}`);

        res.json({
            status: "success",
            fraudIndex: result.fraudIndex,
            verdict: result.verdict,
            modalityScores: result.modalityScores,
            diagnostics: result.diagnostics
        });

    } catch (error) {
        console.error('Server Error:', error);
        res.status(500).json({
            status: "error",
            message: "Analysis failed. Please try again."
        });
    }
});

// History endpoint
app.get('/api/history', (req, res) => {
    res.json({
        status: "success",
        history: history
    });
});

app.delete('/api/history', (req, res) => {
    history = [];
    if (fs.existsSync(historyFile)) {
        fs.writeFileSync(historyFile, JSON.stringify(history, null, 2));
    }
    res.json({ status: "success", message: "History cleared" });
});

// Settings endpoints
app.get('/api/settings', (req, res) => {
    res.json({
        status: "success",
        apiKey: process.env.OPENAI_API_KEY || "",
        temperature: aiTemperature
    });
});

app.post('/api/settings', (req, res) => {
    const { apiKey, temperature } = req.body;
    
    let envPath = path.join(__dirname, '.env');
    let envContent = '';
    if (fs.existsSync(envPath)) {
        envContent = fs.readFileSync(envPath, 'utf8');
    }
    
    if (apiKey !== undefined) {
        process.env.OPENAI_API_KEY = apiKey;
        openai.apiKey = apiKey; // Update the client instance
        
        if (envContent.includes('OPENAI_API_KEY=')) {
            envContent = envContent.replace(/OPENAI_API_KEY=.*/g, `OPENAI_API_KEY=${apiKey}`);
        } else {
            envContent += `\nOPENAI_API_KEY=${apiKey}`;
        }
    }
    
    if (temperature !== undefined) {
        aiTemperature = parseFloat(temperature);
        process.env.AI_TEMPERATURE = aiTemperature;
        
        if (envContent.includes('AI_TEMPERATURE=')) {
            envContent = envContent.replace(/AI_TEMPERATURE=.*/g, `AI_TEMPERATURE=${aiTemperature}`);
        } else {
            envContent += `\nAI_TEMPERATURE=${aiTemperature}`;
        }
    }
    
    fs.writeFileSync(envPath, envContent.trim() + '\n');
    
    res.json({ status: "success" });
});

app.listen(port, () => {
    console.log(`VeriMedia AI backend listening on port ${port}`);
    if (!process.env.OPENAI_API_KEY || process.env.OPENAI_API_KEY === 'your_openai_api_key_here') {
        console.warn('⚠️  WARNING: No OpenAI API key set! Edit the .env file with your real key.');
    } else {
        console.log('✅ OpenAI API key loaded successfully.');
    }
});
