import Database from "better-sqlite3";
import path from "path";
import fs from "fs";
import { Task } from "./types";

// Database file path
const DB_PATH = path.join(process.cwd(), "data", "tasks.db");

// Create data directory if it doesn't exist
const dataDir = path.dirname(DB_PATH);
if (!fs.existsSync(dataDir)) {
  fs.mkdirSync(dataDir, { recursive: true });
}

// Initialize database
const db = new Database(DB_PATH);

// Enable foreign key constraints
db.pragma("foreign_keys = ON");

// Create tasks table immediately
db.exec(`
  CREATE TABLE IF NOT EXISTS tasks (
    id TEXT PRIMARY KEY,
    task TEXT NOT NULL,
    completed BOOLEAN DEFAULT FALSE,
    priority TEXT CHECK(priority IN ('low', 'medium', 'high')),
    estimated_duration TEXT,
    category TEXT,
    notes TEXT,
    is_parent BOOLEAN DEFAULT FALSE,
    parent_id TEXT,
    task_order INTEGER DEFAULT 0,
    due_date TEXT,
    created_date TEXT NOT NULL,
    start_date TEXT,
    user_id TEXT,
    created_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    updated_at DATETIME DEFAULT CURRENT_TIMESTAMP,
    FOREIGN KEY (parent_id) REFERENCES tasks (id) ON DELETE CASCADE
  )
`);

// Add user_id column if it doesn't exist (migration)
try {
  db.exec(`ALTER TABLE tasks ADD COLUMN user_id TEXT`);
} catch (error) {
  // Column already exists, ignore error
}

// Create index for better query performance
db.exec(`
  CREATE INDEX IF NOT EXISTS idx_tasks_parent_id ON tasks(parent_id);
  CREATE INDEX IF NOT EXISTS idx_tasks_due_date ON tasks(due_date);
  CREATE INDEX IF NOT EXISTS idx_tasks_created_at ON tasks(created_at);
  CREATE INDEX IF NOT EXISTS idx_tasks_user_id ON tasks(user_id);
`);

console.log("✅ Database initialized successfully");

// Database schema
export function initializeDatabase() {
  // This function is now mainly for compatibility
  // The actual initialization happens above at module load time
}

// Prepared statements for better performance
const insertTaskStmt = db.prepare(`
  INSERT INTO tasks (
    id, task, completed, priority, estimated_duration, category, notes,
    is_parent, parent_id, task_order, due_date, created_date, start_date, user_id
  ) VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?, ?)
`);

const getTasksStmt = db.prepare(`
  SELECT * FROM tasks WHERE parent_id IS NULL ORDER BY task_order ASC, created_at ASC
`);

const getUserTasksStmt = db.prepare(`
  SELECT * FROM tasks WHERE parent_id IS NULL AND user_id = ? ORDER BY task_order ASC, created_at ASC
`);

const getSubtasksStmt = db.prepare(`
  SELECT * FROM tasks WHERE parent_id = ? ORDER BY task_order ASC, created_at ASC
`);

const getUserSubtasksStmt = db.prepare(`
  SELECT * FROM tasks WHERE parent_id = ? AND user_id = ? ORDER BY task_order ASC, created_at ASC
`);

const updateTaskStmt = db.prepare(`
  UPDATE tasks SET 
    completed = ?, 
    updated_at = CURRENT_TIMESTAMP 
  WHERE id = ?
`);

const updateTaskTextStmt = db.prepare(`
  UPDATE tasks SET 
    task = ?, 
    updated_at = CURRENT_TIMESTAMP 
  WHERE id = ?
`);

const updateTaskNotesStmt = db.prepare(`
  UPDATE tasks SET 
    notes = ?, 
    updated_at = CURRENT_TIMESTAMP 
  WHERE id = ?
`);

const deleteTaskStmt = db.prepare(`
  DELETE FROM tasks WHERE id = ?
`);

const getTaskByIdStmt = db.prepare(`
  SELECT * FROM tasks WHERE id = ?
`);

const getUserTaskByIdStmt = db.prepare(`
  SELECT * FROM tasks WHERE id = ? AND user_id = ?
`);

// Database operations
export class TaskRepository {
  // Create a new task (parent or subtask)
  static createTask(task: Task): Task {
    const result = insertTaskStmt.run(
      task.id,
      task.task,
      task.completed ? 1 : 0,
      task.priority || null,
      task.estimatedDuration || null,
      task.category || null,
      task.notes || null,
      task.isParent ? 1 : 0,
      task.parentId || null,
      task.order || 0,
      task.dueDate || null,
      task.createdDate,
      task.startDate || null,
      task.userId || null
    );

    if (result.changes === 0) {
      throw new Error("Failed to create task");
    }

    return task;
  }

  // Create multiple tasks (with subtasks) in a transaction
  static createTasksWithSubtasks(tasks: Task[]): Task[] {
    const transaction = db.transaction((tasks: Task[]) => {
      const createdTasks: Task[] = [];

      for (const task of tasks) {
        // Create parent task
        this.createTask(task);

        // Create subtasks if they exist
        if (task.subtasks && task.subtasks.length > 0) {
          for (const subtask of task.subtasks) {
            this.createTask(subtask);
          }
        }

        createdTasks.push(task);
      }

      return createdTasks;
    });

    return transaction(tasks);
  }

  // Get all tasks with their subtasks (backward compatibility)
  static getAllTasks(): Task[] {
    const parentTasks = getTasksStmt.all() as any[];

    return parentTasks.map((row) => {
      const task = this.mapRowToTask(row);

      // Get subtasks if this is a parent task
      if (task.isParent) {
        const subtaskRows = getSubtasksStmt.all(task.id) as any[];
        task.subtasks = subtaskRows.map((subtaskRow) =>
          this.mapRowToTask(subtaskRow)
        );
      }

      return task;
    });
  }

  // Get tasks for a specific user
  static getTasksByUser(userId: string): Task[] {
    const parentTasks = getUserTasksStmt.all(userId) as any[];

    return parentTasks.map((row) => {
      const task = this.mapRowToTask(row);

      // Get subtasks if this is a parent task
      if (task.isParent) {
        const subtaskRows = getUserSubtasksStmt.all(task.id, userId) as any[];
        task.subtasks = subtaskRows.map((subtaskRow) =>
          this.mapRowToTask(subtaskRow)
        );
      }

      return task;
    });
  }

  // Get a single task by ID (backward compatibility)
  static getTaskById(id: string): Task | null {
    const row = getTaskByIdStmt.get(id) as any;
    if (!row) return null;

    const task = this.mapRowToTask(row);

    // Get subtasks if this is a parent task
    if (task.isParent) {
      const subtaskRows = getSubtasksStmt.all(task.id) as any[];
      task.subtasks = subtaskRows.map((subtaskRow) =>
        this.mapRowToTask(subtaskRow)
      );
    }

    return task;
  }

  // Get a single task by ID for a specific user
  static getUserTaskById(id: string, userId: string): Task | null {
    const row = getUserTaskByIdStmt.get(id, userId) as any;
    if (!row) return null;

    const task = this.mapRowToTask(row);

    // Get subtasks if this is a parent task
    if (task.isParent) {
      const subtaskRows = getUserSubtasksStmt.all(task.id, userId) as any[];
      task.subtasks = subtaskRows.map((subtaskRow) =>
        this.mapRowToTask(subtaskRow)
      );
    }

    return task;
  }

  // Update task completion status
  static updateTaskCompletion(id: string, completed: boolean): boolean {
    const result = updateTaskStmt.run(completed ? 1 : 0, id);
    return result.changes > 0;
  }

  // Update task completion with parent-subtask logic
  static updateTaskCompletionWithLogic(
    id: string,
    completed: boolean,
    userId: string
  ): boolean {
    const transaction = db.transaction(() => {
      // Get the task to determine if it's a parent or subtask
      const task = this.getUserTaskById(id, userId);
      if (!task) return false;

      // If it's a parent task, handle parent-specific logic
      if (task.isParent && task.subtasks) {
        if (completed) {
          // Completing a Parent Task → All subtasks should be marked as complete
          // First complete the parent
          const parentResult = updateTaskStmt.run(1, id);
          if (parentResult.changes === 0) return false;

          // Then complete all subtasks
          for (const subtask of task.subtasks) {
            const subtaskResult = updateTaskStmt.run(1, subtask.id);
            if (subtaskResult.changes === 0) return false;
          }
        } else {
          // Uncompleting a Parent Task → Only the parent task is affected; subtasks remain unchanged
          const parentResult = updateTaskStmt.run(0, id);
          if (parentResult.changes === 0) return false;
          // Subtasks are left unchanged as requested
        }
      } else {
        // For subtasks or standalone tasks, update normally
        const mainResult = updateTaskStmt.run(completed ? 1 : 0, id);
        if (mainResult.changes === 0) return false;

        // If it's a subtask, auto-update parent based on ALL subtasks
        if (!task.isParent && task.parentId) {
          const parentTask = this.getUserTaskById(task.parentId, userId);
          if (!parentTask || !parentTask.subtasks) return false;

          // IMPORTANT: Get fresh subtask data after our update
          // The parentTask.subtasks contains stale data from before our update
          const freshParentTask = this.getUserTaskById(task.parentId, userId);
          if (!freshParentTask || !freshParentTask.subtasks) return false;

          // All Subtasks Completed → Automatically mark the parent task as completed
          // Any Subtask Uncompleted → Automatically uncomplete the parent task
          const allSubtasksCompleted = freshParentTask.subtasks.every(
            (subtask) => subtask.completed
          );

          // Auto-update parent completion status based on subtasks
          const parentResult = updateTaskStmt.run(
            allSubtasksCompleted ? 1 : 0,
            parentTask.id
          );
          if (parentResult.changes === 0) return false;
        }
      }

      return true;
    });

    return transaction();
  }

  // Update task text
  static updateTaskText(id: string, text: string): boolean {
    const result = updateTaskTextStmt.run(text, id);
    return result.changes > 0;
  }

  // Update task notes
  static updateTaskNotes(id: string, notes: string): boolean {
    const result = updateTaskNotesStmt.run(notes, id);
    return result.changes > 0;
  }

  // Delete task (and its subtasks due to CASCADE)
  static deleteTask(id: string): boolean {
    const result = deleteTaskStmt.run(id);
    return result.changes > 0;
  }

  // Clear all tasks (backward compatibility)
  static clearAllTasks(): void {
    db.exec("DELETE FROM tasks");
  }

  // Clear all tasks for a specific user
  static clearUserTasks(userId: string): void {
    const clearUserTasksStmt = db.prepare(
      "DELETE FROM tasks WHERE user_id = ?"
    );
    clearUserTasksStmt.run(userId);
  }

  // Clear completed tasks (backward compatibility)
  static clearCompletedTasks(): void {
    db.exec("DELETE FROM tasks WHERE completed = 1");
  }

  // Clear completed tasks for a specific user
  static clearUserCompletedTasks(userId: string): void {
    const clearUserCompletedTasksStmt = db.prepare(
      "DELETE FROM tasks WHERE completed = 1 AND user_id = ?"
    );
    clearUserCompletedTasksStmt.run(userId);
  }

  // Map database row to Task object
  private static mapRowToTask(row: any): Task {
    return {
      id: row.id,
      task: row.task,
      completed: Boolean(row.completed),
      priority: row.priority,
      estimatedDuration: row.estimated_duration,
      category: row.category,
      notes: row.notes,
      isParent: Boolean(row.is_parent),
      parentId: row.parent_id,
      order: row.task_order,
      dueDate: row.due_date,
      createdDate: row.created_date,
      startDate: row.start_date,
      userId: row.user_id,
    };
  }
}

// Initialize database on module load
initializeDatabase();
