import express from "express";
import bodyParser from "body-parser";
import cors from "cors";
import dotenv from "dotenv";
import path from "path";
import { fileURLToPath } from "url";
import sql from "mssql";
import { GoogleGenerativeAI } from "@google/generative-ai";

const app = express();
app.use(cors());
app.use(bodyParser.json());

// ✅ Path setup
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

dotenv.config({ path: path.join(__dirname, "apikey.env") });

// ✅ Serve static files (your HTML, JS, CSS) from project root
app.use(express.static(__dirname));

const dbConfig = {
  user: "sa", // change if needed
  password: "78792002CBb#", // your password
  server: "localhost",
  database: "SanctoMindDB",
  options: {
    encrypt: false,
    trustServerCertificate: true,
  },
};

let pool; // global connection pool

async function connectDB() {
  try {
    if (!pool) {
      pool = await sql.connect(dbConfig);
      console.log("✅ Connected to SanctoMindDB");
    }
    return pool;
  } catch (err) {
    console.error("❌ DB connection failed:", err.message);
  }
}

if (!process.env.GEMINI_API_KEY) {
  console.error("❌ GEMINI_API_KEY is missing. Check apikey.env file.");
}
else {
  console.log("✅ GEMINI_API_KEY loaded successfully.");
}

// ✅ Initialize Gemini
const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY);

// Serve your HTML file when user visits root
app.get("/", (req, res) => {
  res.sendFile(path.join(__dirname, "index.html"));
});

app.post("/api/chat", async (req, res) => {
  const userMessage = req.body.message;

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Safer: just pass string, not array
    const result = await model.generateContent(userMessage);

    const reply = result.response?.candidates?.[0]?.content?.parts?.[0]?.text 
               || "⚠️ No reply received from Gemini.";

    res.json({ reply });
  } catch (error) {
    console.error("❌ Gemini error (full):", error);

    // Return user-friendly error instead of 500
    if (error.status === 503) {
      return res.status(503).json({ reply: "⚠️ Gemini servers are busy, please try again later." });
    }

    res.status(500).json({ reply: "⚠️ Sorry, something went wrong on the server." });
  }
});

// General Chat API - empathetic mental health chatbot
app.post("/api/general-chat", async (req, res) => {
  try {
    const userMessage = req.body.message;

    if (!userMessage) {
      return res.status(400).json({ reply: "⚠️ Message cannot be empty." });
    }

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    // Prompt for empathetic, therapeutic guidance and possible mental health evaluation
    const prompt = `
      You are a compassionate mental health AI counsellor.
      1. Empathize with the user’s feelings.
      2. Gently ask diagnostic questions if appropriate.
      3. Suggest helpful therapy tips or coping strategies.
      4. If possible, list potential mental health conditions based on user's input.
      5. Keep your advice general and safe, avoid giving medical prescriptions.
      User's message: "${userMessage}"
    `;

    const result = await model.generateContent(prompt);

    const reply =
      result.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "⚠️ Sorry, I couldn't process that. Please try again.";

    res.json({ reply });
  } catch (error) {
    console.error("❌ General chat error:", error);
    if (error.status === 503) {
      return res.status(503).json({ reply: "⚠️ Gemini servers are busy, try again later." });
    }
    res.status(500).json({ reply: "⚠️ Something went wrong on the server." });
  }
});

// ✅ Specialised Chat API
app.post("/api/specialised-chat", async (req, res) => {
  const { disorder, message } = req.body;

  if (!disorder || !message) {
    return res.status(400).json({ reply: "❌ Disorder and message are required." });
  }

  try {
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    const prompt = `
      You are an empathetic mental health counsellor specializing in ${disorder}.
      The user is seeking counselling and therapy support for this condition.
      
      Guidelines:
      - Respond in a calm, supportive, and non-judgmental tone.
      - Do not give medical diagnoses or prescriptions.
      - Focus on emotional support, coping techniques, and general advice relevant to ${disorder}.
      - Encourage seeking professional help if the condition is severe.
      
      User message: "${message}"
      
      Provide a concise, empathetic, and disorder-focused reply.
    `;

    const result = await model.generateContent(prompt);

    const reply =
      result.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "⚠️ No reply received from Gemini.";

    res.json({ reply });
  } catch (error) {
    console.error("❌ Specialised Chat API error:", error);

    if (error.status === 503) {
      return res.status(503).json({
        reply: "⚠️ Gemini servers are busy, please try again later.",
      });
    }

    res.status(500).json({
      reply: "⚠️ Sorry, something went wrong on the server.",
    });
  }
});

// ✅ Professionals API
app.get("/api/professionals", async (req, res) => {
  try {
    const db = await connectDB();
    const result = await db.request().query(`
      SELECT HP_ID, HP_Name, HP_Sp_Field, HP_Profile_URL, WD_Timing, SD_Timing 
      FROM HP_Table
    `);

    res.json(result.recordset);
  } catch (err) {
    console.error("DB error:", err);
    res.status(500).json({ error: "Database query failed" });
  }
});

// Save diary entry
app.post("/api/diary", async (req, res) => {
  try {
    const { content, title, geminiReply } = req.body;
    console.log("📥 Received diary:", { content, title, geminiReply });

    if (!content || !title) {
      return res.status(400).json({ error: "Content and title required" });
    }

    const db = await connectDB();
    const now = new Date();
    const date = now.toISOString().slice(0, 10);
    const time = now.toTimeString().slice(0, 8);

    const result = await db.request()
      .input("date", sql.Date, date)
      .input("time", sql.VarChar(8), time)
      .input("content", sql.NVarChar(sql.MAX), content)
      .input("title", sql.NVarChar(255), title)
      .input("geminiReply", sql.NVarChar(sql.MAX), geminiReply || null)
      .query(`
        INSERT INTO DiaryEntries (EntryDate, EntryTime, Content, EntryName, GeminiReply)
        OUTPUT INSERTED.ID
        VALUES (@date, @time, @content, @title, @geminiReply)
      `);

    res.json({
      success: true,
      id: result.recordset[0].ID,
      date,
      time,
      title,
      content,
      geminiReply
    });
  } catch (err) {
    console.error("❌ Error saving diary:", err);
    res.status(500).json({ error: "Failed to save diary entry" });
  }
});

// Fetch all diary entries
app.get("/api/diary", async (req, res) => {
  try {
    const db = await connectDB(); // ✅ always use this
    const result = await db.request()
      .query("SELECT ID, EntryDate, EntryTime, Content, EntryName, GeminiReply FROM DiaryEntries ORDER BY ID DESC");

    res.json(result.recordset);
  } catch (err) {
    console.error("Error fetching diary entries:", err);
    res.status(500).json({ error: "Failed to fetch diary entries" });
  }
});

// ✅ Quiz API (generate questions or evaluate answers)
app.post("/api/quiz", async (req, res) => {
  try {
    const { type, disorder, answers } = req.body;

    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });

    let prompt;

    if (!answers) {
      // Generate questions
      prompt = `Generate 10 yes/no questions to ${
        type === "progress" ? "track progress of" : "diagnose"
      } ${disorder}. Only provide the questions in a numbered list.`;
    } else {
      // Evaluate answers
      prompt = `
        Here are the answers to a ${type} quiz for ${disorder}.
        Questions and answers: ${JSON.stringify(answers)}.
        
        1. Evaluate these answers and give a score out of 100.
        2. After the score, also provide a short recommendation on whether 
           the person should consult a mental health professional or not.
        3. For general mental health quiz in the diagnosis type, provide only a 
           list of possible conditions they might have based on their answers
           and no explanations to why they might have these conditions to keep the response concise.
           
        Format the reply as:
        "Your score is X/100."
        "Recommendation: [your advice here]"
        "Possible conditions: [list of conditions]" (only for general mental health diagnosis quiz)
      `;
    }

    const result = await model.generateContent([prompt]);

    const reply =
      result.response?.candidates?.[0]?.content?.parts?.[0]?.text ||
      "⚠️ No reply received from Gemini.";

    res.json({ reply });
  } catch (error) {
    console.error("❌ Quiz API error:", error);
    res.status(500).json({ reply: "⚠️ Failed to generate quiz." });
  }
});

app.post("/generate", async (req, res) => {
  try {
    const response = await generateContent(req.body);
    res.json(response);
  } catch (err) {
    if (err.status === 429) {
      const retryAfter = err.errorDetails?.find(d => d['@type']?.includes('RetryInfo'))?.retryDelay || "a few seconds";
      return res.status(429).json({ 
        error: `Rate limit exceeded. Try again after ${retryAfter}.`
      });
    }
    console.error("Gemini API error:", err);
    res.status(500).json({ error: "Internal Server Error" });
  }
});

// ✅ Create Account API
app.post("/api/create-account", async (req, res) => {
  try {
    const { username, emailPhone, password } = req.body;

    if (!username || !emailPhone || !password) {
      return res.status(400).json({ message: "All fields are required." });
    }

    const db = await connectDB();

    // Insert into Users table
    await db.request()
      .input("Username", sql.NVarChar(100), username)
      .input("EmailPhone", sql.NVarChar(150), emailPhone)
      .input("PasswordHash", sql.NVarChar(255), password) // 👉 use bcrypt for production
      .query(`
        INSERT INTO Users (Username, EmailPhone, PasswordHash)
        VALUES (@Username, @EmailPhone, @PasswordHash)
      `);

    res.json({ message: "✅ Account created successfully!" });
  } catch (err) {
    console.error("❌ Error creating account:", err);
    if (err.number === 2627) {
      // duplicate key (unique constraint violation)
      res.status(400).json({ message: "Email/Phone already exists." });
    } else {
      res.status(500).json({ message: "Failed to create account." });
    }
  }
});// ✅ Login API
app.post("/api/login", async (req, res) => {
  try {
    const { username, password } = req.body;

    if (!username || !password) {
      return res.status(400).json({ message: "Username and password are required." });
    }

    const db = await connectDB();
    const result = await db.request()
      .input("Username", sql.NVarChar(100), username)
      .query(`SELECT UserID, Username, PasswordHash FROM Users WHERE Username = @Username`);

    if (result.recordset.length === 0) {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    const user = result.recordset[0];

    // ⚠️ For production: use bcrypt.compare
    if (user.PasswordHash !== password) {
      return res.status(401).json({ message: "Invalid username or password." });
    }

    res.json({ success: true, message: "✅ Login successful!", userId: user.UserID });
  } catch (err) {
    console.error("❌ Login error:", err);
    res.status(500).json({ message: "Failed to login." });
  }
});

app.post("/api/checklist-response", async (req, res) => {
  try {
    const { disorder, tasks, type } = req.body;

    if (!disorder) {
      return res.status(400).json({ error: "Disorder is required" });
    }
    let prompt = "";

    if (type === "checklist") {
      // Generate a checklist of 5 tasks
      prompt = `Provide a checklist of 5 daily tasks to help manage ${disorder}. 
      Keep them short, practical, and empathetic. Return only the tasks in numbered list.`;
    } else if (type === "remarks") {
      // Generate remarks depending on task completion
      const completed = tasks.filter(t => t.done).length;
      const total = tasks.length;

      if (completed === total) {
        prompt = `The user has successfully completed all ${total} tasks for ${disorder}.
        Write an empathetic and encouraging remark that motivates them to keep going.`;
      } else {
        prompt = `The user completed ${completed} out of ${total} tasks for ${disorder}.
        Write a supportive remark: explain kindly why finishing all tasks is important,
        mention possible consequences of missing tasks, and motivate them to try again tomorrow.`;
      }
    } else {
      return res.status(400).json({ error: "Invalid type" });
    }

    // Call Gemini
    const model = genAI.getGenerativeModel({ model: "gemini-1.5-flash" });
    const result = await model.generateContent(prompt);

    const text = result.response.text();
    res.json({ message: text });
  } catch (err) {
    console.error("Checklist Response Error:", err);
    res.status(500).json({ error: "Failed to generate checklist or remarks" });
  }
});

// ✅ Start server
const PORT = 3000;
app.listen(PORT, () =>
  console.log(`🚀 Server running at http://localhost:${PORT}`)
);