import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import multer from "multer";
import rateLimit from "express-rate-limit";
import Joi from "joi";
import { GoogleGenerativeAI } from "@google/generative-ai";
import dotenv from "dotenv";
import {
  Task,
  GenerateTasksRequest,
  TranscribeVoiceResponse,
  HealthCheckResponse,
  ModelsResponse,
  ErrorResponse,
} from "./types";

// Load environment variables
dotenv.config();

const app = express();
const PORT = parseInt(process.env.PORT || "8000", 10);

// Initialize Google AI
if (!process.env.GOOGLE_AI_API_KEY) {
  console.error(
    "⚠️  GOOGLE_AI_API_KEY not configured. Please set it in your environment variables."
  );
  process.exit(1);
}

const genAI = new GoogleGenerativeAI(process.env.GOOGLE_AI_API_KEY);

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || "http://localhost:3000",
    credentials: true,
  })
);

app.use(express.json({ limit: "10mb" }));
app.use(express.urlencoded({ extended: true, limit: "10mb" }));

// Rate limiting
const limiter = rateLimit({
  windowMs: 15 * 60 * 1000, // 15 minutes
  max: 100, // limit each IP to 100 requests per windowMs
  message: { error: "Too many requests, please try again later" },
});
app.use("/api/", limiter);

// Multer configuration for file uploads
const storage = multer.memoryStorage();
const upload = multer({
  storage: storage,
  limits: {
    fileSize: 10 * 1024 * 1024, // 10MB limit
  },
});

// Input validation schemas
const generateTasksSchema = Joi.object({
  text: Joi.string().min(1).max(1000).required(),
});

// Utility function to handle API errors
const handleError = (
  res: Response,
  error: unknown,
  message = "Internal server error"
): void => {
  console.error("API Error:", error);
  const response: ErrorResponse = {
    error: message,
    details:
      process.env.NODE_ENV === "development" && error instanceof Error
        ? error.message
        : undefined,
  };
  res.status(500).json(response);
};

// Custom Request interface for multer
interface MulterRequest extends Request {
  file?: Express.Multer.File | undefined;
}

// POST /api/transcribe-voice
app.post(
  "/api/transcribe-voice",
  upload.single("audio"),
  async (req: MulterRequest, res: Response): Promise<void> => {
    try {
      if (!req.file) {
        res
          .status(400)
          .json({ error: "No audio file provided" } as ErrorResponse);
        return;
      }

      // Get Gemini model for audio transcription
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

      // Convert audio buffer to base64
      const audioBase64 = req.file.buffer.toString("base64");

      // Determine MIME type from file buffer or use default
      const mimeType = req.file.mimetype || "audio/wav";

      // Create the prompt for transcription
      const prompt =
        "Please transcribe this audio file accurately. Focus on capturing the speaker's intended meaning, especially any tasks or instructions they mention. Return only the transcribed text, no explanations or additional commentary.";

      // Prepare the request with audio data
      const request = {
        contents: [
          {
            role: "user" as const,
            parts: [
              {
                text: prompt,
              },
              {
                inlineData: {
                  mimeType: mimeType,
                  data: audioBase64,
                },
              },
            ],
          },
        ],
      };

      // Generate transcription
      const result = await model.generateContent(request);
      const response = await result.response;
      const transcribedText = response.text().trim();

      console.log("transcribedText", transcribedText);

      // Return the transcribed text
      const transcriptionResponse: TranscribeVoiceResponse = {
        text: transcribedText,
      };
      res.json(transcriptionResponse);
    } catch (error) {
      console.error("Audio transcription error:", error);
      handleError(res, error, "Failed to transcribe audio");
    }
  }
);

// POST /api/generate-tasks
app.post(
  "/api/generate-tasks",
  async (
    req: Request<{}, Task[], GenerateTasksRequest>,
    res: Response<Task[]>
  ): Promise<void> => {
    try {
      // Validate input
      const { error, value } = generateTasksSchema.validate(req.body);
      if (error) {
        res.status(400).json({ error: error.details[0]?.message } as any);
        return;
      }

      const { text } = value;
      console.log("Received text for task generation:", text);

      // Get Gemini model - using the latest version
      const model = genAI.getGenerativeModel({ model: "gemini-2.5-pro" });

      // Craft the prompt for task extraction
      const prompt = `You are a hyper-efficient AI assistant. Your sole function is to analyze the user's command and extract all identifiable tasks. You must return these tasks in a valid JSON array of objects. Each object must contain a unique 'id' (a random number or timestamp) and a 'task' string. Do not add any conversational text or explanations to your response.

If the user's command doesn't contain any clear tasks (e.g., just greetings, testing, or unclear requests), return an empty array [].

User command: "${text}"

Your response must be only the JSON output. Example format:
[
  {"id": 1720532709001, "task": "Email the team about the new project"},
  {"id": 1720532709002, "task": "Buy a birthday cake for Sarah"}
]

If no clear tasks are found, return: []

Return only the JSON array, no other text:`;

      // Generate response
      const result = await model.generateContent(prompt);
      const response = await result.response;
      const generatedText = response.text();
      console.log("Gemini response for task generation:", generatedText);

      try {
        // Parse the JSON response
        const tasks = JSON.parse(generatedText) as Task[];
        console.log("Parsed tasks:", tasks);

        // Validate the response format
        if (!Array.isArray(tasks)) {
          throw new Error("Response is not an array");
        }

        // Ensure each task has the required fields
        const validatedTasks: Task[] = tasks.map((task, index) => ({
          id: task.id || Date.now() + index,
          task: task.task || "Untitled task",
          completed: false,
        }));

        console.log("Validated tasks:", validatedTasks);
        res.json(validatedTasks);
      } catch (parseError) {
        console.error("Failed to parse Gemini response:", generatedText);

        // Fallback: create a single task from the original text
        const fallbackTasks: Task[] = [
          {
            id: Date.now(),
            task: text,
            completed: false,
          },
        ];

        console.log("Using fallback tasks:", fallbackTasks);
        res.json(fallbackTasks);
      }
    } catch (error) {
      handleError(res, error, "Failed to generate tasks");
    }
  }
);

// Health check endpoint
app.get(
  "/api/health",
  (req: Request, res: Response<HealthCheckResponse>): void => {
    const healthResponse: HealthCheckResponse = {
      status: "healthy",
      timestamp: new Date().toISOString(),
      service: "vob-backend",
    };
    res.json(healthResponse);
  }
);

// List available models endpoint (for troubleshooting)
app.get(
  "/api/models",
  async (req: Request, res: Response<ModelsResponse>): Promise<void> => {
    try {
      const modelsResponse: ModelsResponse = {
        models: [
          {
            name: "gemini-2.5-pro",
            displayName: "Gemini 2.5 Pro",
            supportedGenerationMethods: ["generateContent"],
          },
        ],
      };
      res.json(modelsResponse);
    } catch (error) {
      handleError(res, error, "Failed to list models");
    }
  }
);

// Error handling middleware
app.use(
  (error: Error, req: Request, res: Response, next: NextFunction): void => {
    console.error("Unhandled error:", error);
    res.status(500).json({ error: "Internal server error" } as ErrorResponse);
  }
);

// 404 handler
app.use((req: Request, res: Response): void => {
  res.status(404).json({ error: "Endpoint not found" } as ErrorResponse);
});

// Start server
app.listen(PORT, (): void => {
  console.log(`🚀 Server running on port ${PORT}`);
  console.log(`📝 Environment: ${process.env.NODE_ENV || "development"}`);
  console.log(
    `🔗 Frontend URL: ${process.env.FRONTEND_URL || "http://localhost:3000"}`
  );

  if (process.env.NODE_ENV === "development") {
    console.log(`🔍 Debug endpoints:`);
    console.log(`   Health: http://localhost:${PORT}/api/health`);
    console.log(`   Models: http://localhost:${PORT}/api/models`);
  }
});
