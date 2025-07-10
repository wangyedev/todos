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

// Shared task generation function
async function generateTasksFromText(inputText: string): Promise<Task[]> {
  const taskPrompt = `You are an intelligent task management assistant. Your role is to break down user requests into MULTIPLE separate, actionable tasks that can be completed individually.

CRITICAL REQUIREMENTS:
1. **CREATE MULTIPLE TASKS** - Always break requests into several discrete, actionable items
2. **KEEP TASKS CONCISE** - Each task should be 1-2 sentences maximum, not paragraphs
3. **ONE ACTION PER TASK** - Each task should represent a single, specific action
4. **LOGICAL SEQUENCE** - Order tasks in a logical workflow when possible

TASK BREAKDOWN APPROACH:
- Identify the main goal from user input
- Break complex objectives into 3-8 separate preparatory and execution steps
- Each step should be independently actionable
- Include both preparation tasks and execution tasks
- Add follow-up tasks when relevant

TASK QUALITY STANDARDS:
- **Concise**: 1-2 sentences maximum per task
- **Specific**: Clear action verb and outcome
- **Actionable**: Can be completed in a single focused session
- **Independent**: Can be done without completing other tasks simultaneously

ENHANCED FIELDS TO PROVIDE:
- **task**: Brief, specific action (1-2 sentences max)
- **priority**: "high", "medium", or "low" based on urgency
- **estimatedDuration**: Realistic time estimate ("15 min", "1 hour", "2 hours")
- **category**: Logical grouping ("preparation", "execution", "follow-up", "research")
- **notes**: Brief tip or context (optional, 1 sentence max)

EXAMPLES - GOOD TASK BREAKDOWN:

Input: "Buy groceries"
Output: [
  {
    "task": "Check pantry and fridge to create shopping list",
    "priority": "high",
    "estimatedDuration": "10 minutes",
    "category": "preparation"
  },
  {
    "task": "Research weekly meal plan and add ingredients to list",
    "priority": "medium", 
    "estimatedDuration": "15 minutes",
    "category": "preparation"
  },
  {
    "task": "Go to grocery store and purchase items on list",
    "priority": "high",
    "estimatedDuration": "45 minutes", 
    "category": "execution"
  },
  {
    "task": "Organize and store groceries properly",
    "priority": "medium",
    "estimatedDuration": "10 minutes",
    "category": "execution"
  }
]

Input: "Prepare for job interview"
Output: [
  {
    "task": "Research the company background and recent news",
    "priority": "high",
    "estimatedDuration": "30 minutes",
    "category": "preparation"
  },
  {
    "task": "Review job description and match skills to requirements",
    "priority": "high", 
    "estimatedDuration": "20 minutes",
    "category": "preparation"
  },
  {
    "task": "Prepare answers to common interview questions",
    "priority": "high",
    "estimatedDuration": "45 minutes",
    "category": "preparation"
  },
  {
    "task": "Choose and prepare professional outfit",
    "priority": "medium",
    "estimatedDuration": "15 minutes",
    "category": "preparation"
  },
  {
    "task": "Print resume copies and gather required documents",
    "priority": "medium",
    "estimatedDuration": "10 minutes",
    "category": "preparation"
  }
]

User input: "${inputText}"

Break down this request into 3-8 separate, concise tasks. Each task should be independently actionable and 1-2 sentences maximum. Focus on creating a logical workflow from preparation to execution to follow-up.

Return JSON with "tasks" array containing separate task objects with the specified fields.`;

  // Generate response using Gemini API
  const result = await genAI.models.generateContent({
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
                priority: { type: "string", enum: ["low", "medium", "high"] },
                estimatedDuration: { type: "string" },
                category: { type: "string" },
                notes: { type: "string" },
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
  console.log("Task generation response:", generatedText);

  // Parse and validate the response
  const cleanResponse = generatedText.replace(/```json\n?|\n?```/g, "").trim();

  const parsedResponse = JSON.parse(cleanResponse) as StructuredTaskResponse;

  if (!parsedResponse.tasks || !Array.isArray(parsedResponse.tasks)) {
    throw new Error("Invalid task structure");
  }

  // Validate and format tasks
  const validatedTasks: Task[] = parsedResponse.tasks.map((task) => {
    const validatedTask: Task = {
      id: uuidv4(),
      task: task.task || "Untitled task",
      completed: false,
      priority: task.priority || "medium",
    };

    // Add optional fields only if they exist
    if (task.estimatedDuration)
      validatedTask.estimatedDuration = task.estimatedDuration;
    if (task.category) validatedTask.category = task.category;
    if (task.notes) validatedTask.notes = task.notes;

    return validatedTask;
  });

  console.log("Validated tasks:", validatedTasks);
  return validatedTasks;
}

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

      try {
        // Use the shared function to generate tasks
        const tasks = await generateTasksFromText(text);
        res.json(tasks);
      } catch (parseError) {
        console.error("Failed to parse task response:", parseError);

        // Fallback: create a single task from the original text
        const fallbackTasks: Task[] = [
          {
            id: uuidv4(),
            task: text,
            completed: false,
            priority: "medium",
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

      try {
        // Use the shared function to generate tasks
        const tasks = await generateTasksFromText(fullTranscription);

        // Send completion with all tasks at once
        res.write(
          `data: ${JSON.stringify({
            phase: "complete",
            transcription: fullTranscription,
            tasks: tasks,
          })}\n\n`
        );

        res.end();
      } catch (taskError) {
        console.error("Failed to generate tasks:", taskError);
        res.write(
          `data: ${JSON.stringify({
            phase: "error",
            message: "Failed to generate tasks. Please try again.",
          })}\n\n`
        );
        res.end();
        return;
      }
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
