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
  AuthenticatedRequest,
} from "./types";
import { TaskRepository } from "./database";
import { authenticateUser, optionalAuth } from "./middleware/auth";

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

const refineTaskTextSchema = Joi.object({
  text: Joi.string().min(1).max(500).required(),
  refinementType: Joi.string()
    .valid("formal", "concise", "detailed", "casual")
    .required(),
});

const refineTaskNotesSchema = Joi.object({
  notes: Joi.string().min(1).max(1000).required(),
  refinementType: Joi.string()
    .valid("formal", "concise", "detailed", "casual")
    .required(),
});

// Shared task generation function
async function generateTasksFromText(inputText: string): Promise<Task[]> {
  const taskPrompt = `You are an intelligent task management assistant. Your role is to break down user requests into HIERARCHICAL task structures with parent tasks and subtasks.

CRITICAL REQUIREMENTS:
1. **CREATE ONE TASK GROUP** - Most requests should result in ONE parent task with multiple subtasks
2. **NO DUPLICATES** - Never create multiple tasks with the same or similar names/content
3. **FOCUSED SUBTASKS** - Break the main goal into 3-5 essential, actionable subtasks (only use more if truly necessary)
4. **LOGICAL SEQUENCE** - Subtasks should follow a logical workflow from start to finish
5. **SINGLE FOCUS** - Only create multiple parent tasks if the request contains genuinely distinct, unrelated goals

TASK STRUCTURE APPROACH:
- Identify the main goal from user input
- Create ONE parent task that represents the overall objective
- Break that goal into 3-5 ESSENTIAL subtasks (combine related steps to avoid over-granularity)
- Order subtasks chronologically (preparation → execution → follow-up)
- Only create multiple parent tasks if the request contains completely separate objectives

PARENT TASK GUIDELINES:
- **Descriptive**: Clear representation of the main goal
- **Comprehensive**: Encompasses the entire objective
- **Goal-oriented**: Represents the complete desired outcome

SUBTASK GUIDELINES:
- **Essential Only**: Focus on the most important steps, combine minor actions
- **Substantial**: Each subtask should represent meaningful progress toward the goal
- **Actionable**: Can be completed in a single focused session
- **Concise**: 1-2 sentences maximum
- **Sequential**: Follows logical order from preparation to completion
- **Avoid Over-Granularity**: Don't break down every tiny step - group related actions together

ENHANCED FIELDS TO PROVIDE:
- **task**: Brief, specific action or phase name
- **priority**: "high", "medium", or "low" based on urgency
- **estimatedDuration**: Realistic time estimate ("15 min", "1 hour", "2 hours")
- **category**: Logical grouping ("preparation", "execution", "follow-up", "research")
- **notes**: Brief tip or context (optional, 1 sentence max)
- **isParent**: true for parent tasks, false or undefined for subtasks
- **subtasks**: Array of subtask objects (only for parent tasks)
- **dueDate**: ISO date string for when task should be completed (YYYY-MM-DD format)
- **startDate**: ISO date string for when task should be started (optional, YYYY-MM-DD format)

DATE ASSIGNMENT RULES:
- Parent task due date should be when the overall goal is complete
- Subtasks should have staggered due dates leading up to parent completion
- Start with current date as baseline: ${new Date().toISOString().split("T")[0]}
- Spread subtasks over reasonable timeframes (preparation → execution → follow-up)
- Earlier preparation subtasks get earlier due dates
- Execution subtasks should follow preparation chronologically
- Allow realistic time between dependent subtasks

EXAMPLES - GOOD HIERARCHICAL TASK BREAKDOWN:

Input: "Plan a birthday party"
Output: [
  {
    "task": "Plan Birthday Party",
    "priority": "high",
    "estimatedDuration": "3 hours",
    "category": "project",
    "isParent": true,
    "dueDate": "2024-12-21",
    "startDate": "2024-12-15",
    "subtasks": [
      {
        "task": "Plan party details and send invitations",
        "priority": "high",
        "estimatedDuration": "1 hour",
        "category": "preparation",
        "dueDate": "2024-12-16",
        "startDate": "2024-12-15",
        "notes": "Choose date, create guest list, select venue/location, and send invitations"
      },
      {
        "task": "Shop for food, drinks, and party supplies",
        "priority": "high",
        "estimatedDuration": "1.5 hours",
        "category": "execution",
        "dueDate": "2024-12-20",
        "startDate": "2024-12-19",
        "notes": "Buy decorations, food, beverages, and any needed party supplies"
      },
      {
        "task": "Prepare party space and food",
        "priority": "medium",
        "estimatedDuration": "1 hour",
        "category": "execution",
        "dueDate": "2024-12-21",
        "startDate": "2024-12-21",
        "notes": "Set up decorations, arrange food and drinks, prepare music/entertainment"
      },
      {
        "task": "Host party and clean up",
        "priority": "medium",
        "estimatedDuration": "30 minutes",
        "category": "follow-up",
        "dueDate": "2024-12-21",
        "startDate": "2024-12-21",
        "notes": "Enjoy the party and clean up afterwards"
      }
    ]
  }
]

Input: "Do laundry"
Output: [
  {
    "task": "Do Laundry",
    "priority": "medium",
    "estimatedDuration": "2 hours",
    "category": "household",
    "isParent": true,
    "dueDate": "2024-12-08",
    "startDate": "2024-12-08",
    "subtasks": [
      {
        "task": "Gather and sort laundry",
        "priority": "medium",
        "estimatedDuration": "15 minutes",
        "category": "preparation",
        "dueDate": "2024-12-08",
        "startDate": "2024-12-08",
        "notes": "Collect dirty clothes and sort by color and fabric type"
      },
      {
        "task": "Wash clothes",
        "priority": "high",
        "estimatedDuration": "5 minutes",
        "category": "execution",
        "dueDate": "2024-12-08",
        "startDate": "2024-12-08",
        "notes": "Load washing machine, add detergent, and start cycle"
      },
      {
        "task": "Dry clothes",
        "priority": "high",
        "estimatedDuration": "10 minutes",
        "category": "execution",
        "dueDate": "2024-12-08",
        "startDate": "2024-12-08",
        "notes": "Transfer to dryer or hang to air dry"
      },
      {
        "task": "Fold and put away clean clothes",
        "priority": "medium",
        "estimatedDuration": "20 minutes",
        "category": "follow-up",
        "dueDate": "2024-12-08",
        "startDate": "2024-12-08",
        "notes": "Fold, iron if needed, and store in appropriate locations"
      }
    ]
  }
]

User input: "${inputText}"

IMPORTANT: 
- Create ONE parent task with 3-5 ESSENTIAL subtasks unless the request contains multiple completely unrelated goals
- NEVER create duplicate tasks - each task must be unique
- If you accidentally create similar tasks, only return the best one

Examples of SINGLE task group requests:
- "Plan a birthday party" → ONE parent task with 4 focused subtasks
- "Prepare for job interview" → ONE parent task with 3-4 subtasks
- "Organize office space" → ONE parent task with 4-5 subtasks
- "Do laundry" → ONE parent task with 4 subtasks
- "Learn to cook pasta" → ONE parent task with 3-4 subtasks

Examples of MULTIPLE task group requests (rare):
- "Plan a birthday party and learn Spanish" → TWO separate parent tasks
- "Organize office and plan vacation and study for exam" → THREE separate parent tasks

SUBTASK LIMIT: Keep subtasks to 3-5 per parent task. Combine related actions instead of creating many small steps.

FINAL CHECK: Before returning, ensure no duplicate tasks exist in your response.

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
                dueDate: { type: "string" },
                startDate: { type: "string" },
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
                      dueDate: { type: "string" },
                      startDate: { type: "string" },
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
  const seenTasks = new Set<string>(); // Track seen task names for deduplication

  parsedResponse.tasks.forEach((task, index) => {
    // Skip duplicate tasks (case-insensitive comparison)
    const taskKey = task.task?.toLowerCase().trim();
    if (!taskKey || seenTasks.has(taskKey)) {
      console.log(`Skipping duplicate task: ${task.task}`);
      return;
    }
    seenTasks.add(taskKey);
    const now = new Date().toISOString();
    const parentTask: Task = {
      id: uuidv4(),
      task: task.task || "Untitled task",
      completed: false,
      priority: task.priority || "medium",
      isParent: task.isParent || false,
      order: index,
      createdDate: now,
    };

    // Add optional fields only if they exist
    if (task.estimatedDuration)
      parentTask.estimatedDuration = task.estimatedDuration;
    if (task.category) parentTask.category = task.category;
    if (task.notes) parentTask.notes = task.notes;
    if (task.dueDate) parentTask.dueDate = task.dueDate;
    if (task.startDate) parentTask.startDate = task.startDate;

    // Handle subtasks if this is a parent task
    if (task.subtasks && Array.isArray(task.subtasks)) {
      parentTask.isParent = true; // Mark as parent task
      parentTask.subtasks = task.subtasks.map((subtask, subtaskIndex) => {
        const validatedSubtask: Task = {
          id: uuidv4(),
          task: subtask.task || "Untitled subtask",
          completed: false,
          priority: subtask.priority || "medium",
          parentId: parentTask.id,
          order: subtaskIndex,
          createdDate: now,
        };

        // Add optional fields only if they exist
        if (subtask.estimatedDuration)
          validatedSubtask.estimatedDuration = subtask.estimatedDuration;
        if (subtask.category) validatedSubtask.category = subtask.category;
        if (subtask.notes) validatedSubtask.notes = subtask.notes;
        if (subtask.dueDate) validatedSubtask.dueDate = subtask.dueDate;
        if (subtask.startDate) validatedSubtask.startDate = subtask.startDate;

        return validatedSubtask;
      });
    }

    validatedTasks.push(parentTask);
  });

  console.log(
    `Generated ${parsedResponse.tasks.length} tasks, kept ${validatedTasks.length} after deduplication`
  );
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

interface AuthenticatedMulterRequest extends MulterRequest {
  user?: {
    id: string;
    email: string;
    name?: string;
    avatarUrl?: string;
    provider?: string;
    createdAt: string;
    updatedAt: string;
  };
}

// POST /api/transcribe-voice
app.post(
  "/api/transcribe-voice",
  authenticateUser,
  upload.single("audio"),
  async (req: AuthenticatedMulterRequest, res: Response): Promise<void> => {
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
  authenticateUser,
  async (req: AuthenticatedRequest, res: Response<Task[]>): Promise<void> => {
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

        // Save tasks to database with user ID
        const tasksWithUserId = tasks.map((task) => {
          const taskWithUserId = {
            ...task,
            userId: req.user!.id,
          };

          // Add userId to subtasks if they exist
          if (task.subtasks && task.subtasks.length > 0) {
            taskWithUserId.subtasks = task.subtasks.map((subtask) => ({
              ...subtask,
              userId: req.user!.id,
            }));
          }

          return taskWithUserId;
        });
        const savedTasks =
          TaskRepository.createTasksWithSubtasks(tasksWithUserId);
        res.json(savedTasks);
      } catch (parseError) {
        console.error("Failed to parse task response:", parseError);

        // Fallback: create a single task from the original text
        const fallbackTasks: Task[] = [
          {
            id: uuidv4(),
            task: text,
            completed: false,
            priority: "medium",
            createdDate: new Date().toISOString(),
          },
        ];

        console.log("Using fallback tasks:", fallbackTasks);
        // Save fallback task to database with user ID
        const fallbackTasksWithUserId = fallbackTasks.map((task) => ({
          ...task,
          userId: req.user!.id,
        }));
        const savedFallbackTasks = TaskRepository.createTasksWithSubtasks(
          fallbackTasksWithUserId
        );
        res.json(savedFallbackTasks);
      }
    } catch (error) {
      handleError(res, error, "Failed to generate tasks");
    }
  }
);

// Native streaming voice transcription endpoint
app.post(
  "/api/transcribe-voice-stream",
  authenticateUser,
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

        // Save tasks to database with user ID
        const tasksWithUserId = tasks.map((task) => {
          const taskWithUserId = {
            ...task,
            userId: (req as AuthenticatedMulterRequest).user!.id,
          };

          // Add userId to subtasks if they exist
          if (task.subtasks && task.subtasks.length > 0) {
            taskWithUserId.subtasks = task.subtasks.map((subtask) => ({
              ...subtask,
              userId: (req as AuthenticatedMulterRequest).user!.id,
            }));
          }

          return taskWithUserId;
        });
        const savedTasks =
          TaskRepository.createTasksWithSubtasks(tasksWithUserId);

        // Send completion with all tasks at once
        res.write(
          `data: ${JSON.stringify({
            phase: "complete",
            transcription: fullTranscription,
            tasks: savedTasks,
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

// POST /api/refine-task-text - Refine task text using LLM
app.post(
  "/api/refine-task-text",
  authenticateUser,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Validate input
      const { error, value } = refineTaskTextSchema.validate(req.body);
      if (error) {
        res.status(400).json({ error: error.details[0]?.message } as any);
        return;
      }

      const { text, refinementType } = value;
      console.log("Refining text:", text, "Type:", refinementType);

      let prompt = "";
      switch (refinementType) {
        case "formal":
          prompt = `Please rewrite this task in a more formal, professional tone while keeping the same meaning and action. Make it sound more business-like and structured.

Original task: "${text}"

Return only the refined task text, no explanations or additional commentary.`;
          break;
        case "concise":
          prompt = `Please rewrite this task to be more concise and to-the-point while keeping the same meaning and action. Remove any unnecessary words and make it more direct.

Original task: "${text}"

Return only the refined task text, no explanations or additional commentary.`;
          break;
        case "detailed":
          prompt = `Please rewrite this task to be more detailed and comprehensive while keeping the same core action. Add helpful context and clarity to make the task more actionable.

Original task: "${text}"

Return only the refined task text, no explanations or additional commentary.`;
          break;
        case "casual":
          prompt = `Please rewrite this task in a more casual, friendly tone while keeping the same meaning and action. Make it sound more relaxed and conversational.

Original task: "${text}"

Return only the refined task text, no explanations or additional commentary.`;
          break;
      }

      // Generate refined text using Gemini API
      const result = await genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const refinedText = result.text?.trim() || text;
      console.log("Refined text:", refinedText);

      res.json({
        originalText: text,
        refinedText: refinedText,
        refinementType: refinementType,
      });
    } catch (error) {
      console.error("Text refinement error:", error);
      handleError(res, error, "Failed to refine text");
    }
  }
);

// POST /api/refine-task-notes - Refine task notes using LLM
app.post(
  "/api/refine-task-notes",
  authenticateUser,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      // Validate input
      const { error, value } = refineTaskNotesSchema.validate(req.body);
      if (error) {
        res.status(400).json({ error: error.details[0]?.message } as any);
        return;
      }

      const { notes, refinementType } = value;
      console.log("Refining notes:", notes, "Type:", refinementType);

      let prompt = "";
      switch (refinementType) {
        case "formal":
          prompt = `Please rewrite these task notes in a more formal, professional tone while keeping the same meaning and information. Make them sound more business-like and structured.

Original notes: "${notes}"

Return only the refined notes text, no explanations or additional commentary.`;
          break;
        case "concise":
          prompt = `Please rewrite these task notes to be more concise and to-the-point while keeping the same meaning and key information. Remove any unnecessary words and make them more direct.

Original notes: "${notes}"

Return only the refined notes text, no explanations or additional commentary.`;
          break;
        case "detailed":
          prompt = `Please rewrite these task notes to be more detailed and comprehensive while keeping the same core information. Add helpful context and clarity to make the notes more useful.

Original notes: "${notes}"

Return only the refined notes text, no explanations or additional commentary.`;
          break;
        case "casual":
          prompt = `Please rewrite these task notes in a more casual, friendly tone while keeping the same meaning and information. Make them sound more relaxed and conversational.

Original notes: "${notes}"

Return only the refined notes text, no explanations or additional commentary.`;
          break;
      }

      // Generate refined notes using Gemini API
      const result = await genAI.models.generateContent({
        model: "gemini-2.5-flash",
        contents: prompt,
      });

      const refinedNotes = result.text?.trim() || notes;
      console.log("Refined notes:", refinedNotes);

      res.json({
        originalNotes: notes,
        refinedNotes: refinedNotes,
        refinementType: refinementType,
      });
    } catch (error) {
      console.error("Notes refinement error:", error);
      handleError(res, error, "Failed to refine notes");
    }
  }
);

// GET /api/tasks - Get all tasks
app.get(
  "/api/tasks",
  authenticateUser,
  async (req: AuthenticatedRequest, res: Response<Task[]>): Promise<void> => {
    try {
      const tasks = TaskRepository.getTasksByUser(req.user!.id);
      res.json(tasks);
    } catch (error) {
      handleError(res, error, "Failed to get tasks");
    }
  }
);

// GET /api/tasks/:id - Get a specific task by ID
app.get(
  "/api/tasks/:id",
  authenticateUser,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: "Task ID is required" } as ErrorResponse);
        return;
      }
      const task = TaskRepository.getUserTaskById(id, req.user!.id);
      if (!task) {
        res.status(404).json({ error: "Task not found" } as ErrorResponse);
        return;
      }
      res.json(task);
    } catch (error) {
      handleError(res, error, "Failed to get task");
    }
  }
);

// PUT /api/tasks/:id/completion - Update task completion status
app.put(
  "/api/tasks/:id/completion",
  authenticateUser,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { completed } = req.body;
      if (!id) {
        res.status(400).json({ error: "Task ID is required" } as ErrorResponse);
        return;
      }

      // Verify task belongs to user
      const task = TaskRepository.getUserTaskById(id, req.user!.id);
      if (!task) {
        res.status(404).json({ error: "Task not found" } as ErrorResponse);
        return;
      }

      const success = TaskRepository.updateTaskCompletionWithLogic(
        id,
        completed,
        req.user!.id
      );
      if (!success) {
        res
          .status(500)
          .json({ error: "Failed to update task" } as ErrorResponse);
        return;
      }
      res.json({ success: true });
    } catch (error) {
      handleError(res, error, "Failed to update task");
    }
  }
);

// PUT /api/tasks/:id/text - Update task text
app.put(
  "/api/tasks/:id/text",
  authenticateUser,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { text } = req.body;
      if (!id) {
        res.status(400).json({ error: "Task ID is required" } as ErrorResponse);
        return;
      }
      if (!text || text.trim().length === 0) {
        res
          .status(400)
          .json({ error: "Task text is required" } as ErrorResponse);
        return;
      }

      // Verify task belongs to user
      const task = TaskRepository.getUserTaskById(id, req.user!.id);
      if (!task) {
        res.status(404).json({ error: "Task not found" } as ErrorResponse);
        return;
      }

      const success = TaskRepository.updateTaskText(id, text.trim());
      if (!success) {
        res
          .status(500)
          .json({ error: "Failed to update task" } as ErrorResponse);
        return;
      }
      res.json({ success: true });
    } catch (error) {
      handleError(res, error, "Failed to update task text");
    }
  }
);

// PUT /api/tasks/:id/notes - Update task notes
app.put(
  "/api/tasks/:id/notes",
  authenticateUser,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      const { notes } = req.body;
      if (!id) {
        res.status(400).json({ error: "Task ID is required" } as ErrorResponse);
        return;
      }

      // Verify task belongs to user
      const task = TaskRepository.getUserTaskById(id, req.user!.id);
      if (!task) {
        res.status(404).json({ error: "Task not found" } as ErrorResponse);
        return;
      }

      // Allow empty notes to clear them
      const notesValue = notes || "";
      const success = TaskRepository.updateTaskNotes(id, notesValue);
      if (!success) {
        res
          .status(500)
          .json({ error: "Failed to update task" } as ErrorResponse);
        return;
      }
      res.json({ success: true });
    } catch (error) {
      handleError(res, error, "Failed to update task notes");
    }
  }
);

// DELETE /api/tasks/:id - Delete a task
app.delete(
  "/api/tasks/:id",
  authenticateUser,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      const { id } = req.params;
      if (!id) {
        res.status(400).json({ error: "Task ID is required" } as ErrorResponse);
        return;
      }

      // Verify task belongs to user
      const task = TaskRepository.getUserTaskById(id, req.user!.id);
      if (!task) {
        res.status(404).json({ error: "Task not found" } as ErrorResponse);
        return;
      }

      const success = TaskRepository.deleteTask(id);
      if (!success) {
        res
          .status(500)
          .json({ error: "Failed to delete task" } as ErrorResponse);
        return;
      }
      res.json({ success: true });
    } catch (error) {
      handleError(res, error, "Failed to delete task");
    }
  }
);

// DELETE /api/tasks - Clear all tasks
app.delete(
  "/api/tasks",
  authenticateUser,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      TaskRepository.clearUserTasks(req.user!.id);
      res.json({ success: true });
    } catch (error) {
      handleError(res, error, "Failed to clear tasks");
    }
  }
);

// DELETE /api/tasks/completed - Clear completed tasks
app.delete(
  "/api/tasks/completed",
  authenticateUser,
  async (req: AuthenticatedRequest, res: Response): Promise<void> => {
    try {
      TaskRepository.clearUserCompletedTasks(req.user!.id);
      res.json({ success: true });
    } catch (error) {
      handleError(res, error, "Failed to clear completed tasks");
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
