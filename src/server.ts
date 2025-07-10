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
  const taskPrompt = `You are an intelligent task management assistant. Your role is to break down user requests into HIERARCHICAL task structures with parent tasks and subtasks.

CRITICAL REQUIREMENTS:
1. **CREATE PARENT TASKS** - Identify 2-4 main categories or phases from the user request
2. **CREATE SUBTASKS** - Break each parent task into 2-5 specific, actionable subtasks
3. **LOGICAL HIERARCHY** - Parent tasks represent major phases, subtasks are specific actions
4. **CLEAR ORGANIZATION** - Structure should be intuitive and easy to follow

TASK STRUCTURE APPROACH:
- Identify main phases or categories from user input
- Create parent tasks that represent these major phases
- Break each parent task into specific, actionable subtasks
- Ensure subtasks are concrete and completable
- Order subtasks logically within each parent

PARENT TASK GUIDELINES:
- **Descriptive**: Clear phase or category name
- **Comprehensive**: Covers a logical grouping of related actions
- **Goal-oriented**: Represents a meaningful milestone

SUBTASK GUIDELINES:
- **Specific**: Clear action verb and outcome
- **Actionable**: Can be completed in a single focused session
- **Concise**: 1-2 sentences maximum
- **Independent**: Can be done without other subtasks simultaneously

ENHANCED FIELDS TO PROVIDE:
- **task**: Brief, specific action or phase name
- **priority**: "high", "medium", or "low" based on urgency
- **estimatedDuration**: Realistic time estimate ("15 min", "1 hour", "2 hours")
- **category**: Logical grouping ("preparation", "execution", "follow-up", "research")
- **notes**: Brief tip or context (optional, 1 sentence max)
- **isParent**: true for parent tasks, false or undefined for subtasks
- **subtasks**: Array of subtask objects (only for parent tasks)

EXAMPLES - GOOD HIERARCHICAL TASK BREAKDOWN:

Input: "Plan a birthday party"
Output: [
  {
    "task": "Party Planning & Preparation",
    "priority": "high",
    "estimatedDuration": "2 hours",
    "category": "preparation",
    "isParent": true,
    "subtasks": [
      {
        "task": "Choose party date and create guest list",
        "priority": "high",
        "estimatedDuration": "30 minutes",
        "category": "preparation"
      },
      {
        "task": "Select and book venue or prepare home space",
        "priority": "high",
        "estimatedDuration": "45 minutes",
        "category": "preparation"
      },
      {
        "task": "Send invitations to guests",
        "priority": "medium",
        "estimatedDuration": "30 minutes",
        "category": "preparation"
      },
      {
        "task": "Plan party theme and decorations",
        "priority": "medium",
        "estimatedDuration": "15 minutes",
        "category": "preparation"
      }
    ]
  },
  {
    "task": "Food & Beverage Preparation",
    "priority": "high",
    "estimatedDuration": "1.5 hours",
    "category": "execution",
    "isParent": true,
    "subtasks": [
      {
        "task": "Plan menu and create shopping list",
        "priority": "high",
        "estimatedDuration": "20 minutes",
        "category": "preparation"
      },
      {
        "task": "Shop for food, drinks, and party supplies",
        "priority": "high",
        "estimatedDuration": "1 hour",
        "category": "execution"
      },
      {
        "task": "Prepare food and arrange beverages",
        "priority": "medium",
        "estimatedDuration": "45 minutes",
        "category": "execution"
      }
    ]
  },
  {
    "task": "Party Setup & Execution",
    "priority": "medium",
    "estimatedDuration": "1 hour",
    "category": "execution",
    "isParent": true,
    "subtasks": [
      {
        "task": "Set up decorations and party area",
        "priority": "medium",
        "estimatedDuration": "30 minutes",
        "category": "execution"
      },
      {
        "task": "Prepare music playlist and entertainment",
        "priority": "low",
        "estimatedDuration": "15 minutes",
        "category": "execution"
      },
      {
        "task": "Clean up after party",
        "priority": "low",
        "estimatedDuration": "30 minutes",
        "category": "follow-up"
      }
    ]
  }
]

User input: "${inputText}"

Break down this request into 2-4 parent tasks, each with 2-5 subtasks. Create a logical hierarchy that makes the overall goal manageable and organized.

Return JSON with "tasks" array containing parent task objects with nested subtasks.`;

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
                isParent: { type: "boolean" },
                subtasks: {
                  type: "array",
                  items: {
                    type: "object",
                    properties: {
                      id: { type: "number" },
                      task: { type: "string" },
                      priority: {
                        type: "string",
                        enum: ["low", "medium", "high"],
                      },
                      estimatedDuration: { type: "string" },
                      category: { type: "string" },
                      notes: { type: "string" },
                    },
                    required: ["task"],
                  },
                },
              },
              required: ["task"],
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

  // Validate and format tasks with hierarchical structure
  const validatedTasks: Task[] = [];

  parsedResponse.tasks.forEach((task, index) => {
    const parentTask: Task = {
      id: uuidv4(),
      task: task.task || "Untitled task",
      completed: false,
      priority: task.priority || "medium",
      isParent: task.isParent || false,
      order: index,
    };

    // Add optional fields only if they exist
    if (task.estimatedDuration)
      parentTask.estimatedDuration = task.estimatedDuration;
    if (task.category) parentTask.category = task.category;
    if (task.notes) parentTask.notes = task.notes;

    // Handle subtasks if this is a parent task
    if (task.subtasks && Array.isArray(task.subtasks)) {
      parentTask.subtasks = task.subtasks.map((subtask, subtaskIndex) => {
        const validatedSubtask: Task = {
          id: uuidv4(),
          task: subtask.task || "Untitled subtask",
          completed: false,
          priority: subtask.priority || "medium",
          parentId: parentTask.id,
          order: subtaskIndex,
        };

        // Add optional fields only if they exist
        if (subtask.estimatedDuration)
          validatedSubtask.estimatedDuration = subtask.estimatedDuration;
        if (subtask.category) validatedSubtask.category = subtask.category;
        if (subtask.notes) validatedSubtask.notes = subtask.notes;

        return validatedSubtask;
      });
    }

    validatedTasks.push(parentTask);
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
