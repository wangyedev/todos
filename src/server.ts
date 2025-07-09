import express, { Request, Response, NextFunction } from "express";
import cors from "cors";
import multer from "multer";
import rateLimit from "express-rate-limit";
import Joi from "joi";
import { GoogleGenAI } from "@google/genai";
import dotenv from "dotenv";
import { v4 as uuidv4 } from "uuid";
import {
  Task,
  GenerateTasksRequest,
  TranscribeVoiceResponse,
  HealthCheckResponse,
  ModelsResponse,
  ErrorResponse,
  StructuredTaskResponse,
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

const genAI = new GoogleGenAI({
  apiKey: process.env.GOOGLE_AI_API_KEY,
});

// Middleware
app.use(
  cors({
    origin: process.env.FRONTEND_URL || [
      "http://localhost:3000",
      "http://localhost:3001",
      "http://localhost:3002",
      "http://localhost:5173",
    ],
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

      // Convert audio buffer to base64
      const audioBase64 = req.file.buffer.toString("base64");

      // Determine MIME type from file buffer or use default
      const mimeType = req.file.mimetype || "audio/wav";

      // Create the prompt for transcription
      const prompt =
        "Please transcribe this audio file accurately. Focus on capturing the speaker's intended meaning, especially any tasks or instructions they mention. Return only the transcribed text, no explanations or additional commentary.";

      // Generate transcription using new API
      const result = await genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: [
          prompt,
          {
            inlineData: {
              mimeType: mimeType,
              data: audioBase64,
            },
          },
        ],
      });

      const transcribedText = result.text?.trim() || "";

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

      // Craft the prompt for task extraction
      const prompt = `You are a hyper-efficient AI assistant. Your sole function is to analyze the user's command and extract all identifiable tasks.

Analyze the following user command and extract all identifiable tasks. Return them in a JSON object with a "tasks" array. Each task should have a unique numeric id and a clear task description.

If the user's command doesn't contain any clear tasks (e.g., just greetings, testing, or unclear requests), return an empty tasks array.

User command: "${text}"

Extract all tasks and return them in the specified JSON format.`;

      // Generate response using new API
      const result = await genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              tasks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "number" },
                    task: { type: "string" },
                  },
                  required: ["id", "task"],
                },
              },
            },
            required: ["tasks"],
          },
        },
      });

      const generatedText = result.text || "";
      console.log("Gemini response for task generation:", generatedText);

      try {
        // Parse the structured JSON response
        const parsedResponse = JSON.parse(
          generatedText
        ) as StructuredTaskResponse;
        console.log("Parsed structured response:", parsedResponse);

        // Extract tasks from the structured response
        const tasks = parsedResponse.tasks || [];
        console.log("Extracted tasks:", tasks);

        // Validate the response format
        if (!Array.isArray(tasks)) {
          throw new Error("Tasks is not an array");
        }

        // Ensure each task has the required fields and add completed property
        const validatedTasks: Task[] = tasks.map((task) => {
          return {
            id: uuidv4(),
            task: task.task || "Untitled task",
            completed: false,
          };
        });

        console.log("Validated tasks:", validatedTasks);
        res.json(validatedTasks);
      } catch (parseError) {
        console.error(
          "Failed to parse Gemini structured response:",
          generatedText
        );
        console.error("Parse error:", parseError);

        // Fallback: create a single task from the original text
        const fallbackTasks: Task[] = [
          {
            id: uuidv4(),
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

// Native streaming voice transcription endpoint
app.post(
  "/api/transcribe-voice-stream",
  upload.single("audio"),
  async (req, res) => {
    try {
      if (!req.file) {
        res.status(400).json({ error: "No audio file provided" });
        return;
      }

      console.log(
        "Streaming transcription request received, file size:",
        req.file.size
      );

      // Set SSE headers
      res.writeHead(200, {
        "Content-Type": "text/event-stream",
        "Cache-Control": "no-cache",
        Connection: "keep-alive",
        "Access-Control-Allow-Origin": "*",
        "Access-Control-Allow-Headers": "Cache-Control",
      });

      // Send processing phase
      res.write(
        `data: ${JSON.stringify({
          phase: "processing",
          message: "Processing audio file...",
        })}\n\n`
      );

      // Convert audio to base64
      const audioBase64 = req.file.buffer.toString("base64");

      // Send transcribing phase
      res.write(
        `data: ${JSON.stringify({
          phase: "transcribing",
          message: "Transcribing audio with Gemini...",
        })}\n\n`
      );

      // Transcribe audio with native streaming
      const transcriptionResult = await genAI.models.generateContentStream({
        model: "gemini-2.5-flash",
        contents: [
          "Please transcribe this audio accurately. Only return the transcribed text without any additional commentary.",
          {
            inlineData: {
              data: audioBase64,
              mimeType: req.file.mimetype,
            },
          },
        ],
      });

      let fullTranscription = "";

      // Stream transcription chunks
      for await (const chunk of transcriptionResult) {
        const chunkText = chunk.text;
        if (chunkText) {
          fullTranscription += chunkText;

          // Send transcription chunk
          res.write(
            `data: ${JSON.stringify({
              phase: "transcribing",
              text: chunkText,
              fullText: fullTranscription,
            })}\n\n`
          );

          // Small delay for better UX
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      if (!fullTranscription.trim()) {
        res.write(
          `data: ${JSON.stringify({
            phase: "error",
            message: "Could not transcribe audio. Please try again.",
          })}\n\n`
        );
        res.end();
        return;
      }

      // Send generating phase
      res.write(
        `data: ${JSON.stringify({
          phase: "generating",
          message: "Generating tasks from transcription...",
        })}\n\n`
      );

      // Generate tasks with native streaming using structured output
      const taskPrompt = `You are a hyper-efficient AI assistant. Your sole function is to analyze the user's command and extract all identifiable tasks.

Analyze the following user command and extract all identifiable tasks. Return them in a JSON object with a "tasks" array. Each task should have a unique numeric id and a clear task description.

If the user's command doesn't contain any clear tasks (e.g., just greetings, testing, or unclear requests), return an empty tasks array.

User command: "${fullTranscription}"

Extract all tasks and return them in the specified JSON format.`;

      const taskResult = await genAI.models.generateContentStream({
        model: "gemini-2.5-flash",
        contents: taskPrompt,
        config: {
          responseMimeType: "application/json",
          responseSchema: {
            type: "object",
            properties: {
              tasks: {
                type: "array",
                items: {
                  type: "object",
                  properties: {
                    id: { type: "number" },
                    task: { type: "string" },
                  },
                  required: ["id", "task"],
                },
              },
            },
            required: ["tasks"],
          },
        },
      });

      let fullTaskResponse = "";

      // Stream task generation chunks
      for await (const chunk of taskResult) {
        const chunkText = chunk.text;
        if (chunkText) {
          fullTaskResponse += chunkText;

          // Send task generation chunk
          res.write(
            `data: ${JSON.stringify({
              phase: "generating",
              text: chunkText,
              fullText: fullTaskResponse,
            })}\n\n`
          );

          // Small delay for better UX
          await new Promise((resolve) => setTimeout(resolve, 50));
        }
      }

      // Parse and validate the final response
      let tasksData: StructuredTaskResponse;
      try {
        // Clean the response (remove any markdown formatting)
        const cleanResponse = fullTaskResponse
          .replace(/```json\n?|\n?```/g, "")
          .trim();

        console.log("Task generation response:", cleanResponse);
        tasksData = JSON.parse(cleanResponse);

        if (!tasksData.tasks || !Array.isArray(tasksData.tasks)) {
          throw new Error("Invalid task structure");
        }
      } catch (parseError) {
        console.error("Failed to parse task response:", parseError);
        console.error("Raw response:", fullTaskResponse);
        res.write(
          `data: ${JSON.stringify({
            phase: "error",
            message: "Failed to generate tasks. Please try again.",
          })}\n\n`
        );
        res.end();
        return;
      }

      // Ensure each task has the required fields and add completed property
      const validatedTasks: Task[] = tasksData.tasks.map((task, index) => {
        // Always generate a unique UUID to prevent conflicts
        const uniqueId = uuidv4();
        return {
          id: uniqueId,
          task: task.task || "Untitled task",
          completed: false,
        };
      });

      console.log("Validated tasks:", validatedTasks);

      // Send completion
      res.write(
        `data: ${JSON.stringify({
          phase: "complete",
          transcription: fullTranscription,
          tasks: validatedTasks,
        })}\n\n`
      );

      res.end();
    } catch (error) {
      console.error("Streaming transcription error:", error);
      res.write(
        `data: ${JSON.stringify({
          phase: "error",
          message: "An error occurred during transcription. Please try again.",
        })}\n\n`
      );
      res.end();
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
            name: "gemini-2.5-flash",
            displayName: "Gemini 2.5 flash",
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
