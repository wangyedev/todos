import React, { useState, useCallback, useEffect } from "react";
import { AuthProvider } from "./contexts/AuthContext";
import AuthGuard from "./components/Auth/AuthGuard";
import UserProfile from "./components/Auth/UserProfile";
import AgentInteraction from "./components/AgentInteraction";
import TodoList from "./components/TodoList";
import ConfirmationModal from "./components/ConfirmationModal";
import { Task, AppState } from "./types";
import { apiService } from "./services/api";
import "./App.css";

const MainApp: React.FC = () => {
  const [state, setState] = useState<AppState>({
    tasks: [],
    isLoading: false,
    error: null,
    user: null,
    isAuthenticated: false,
  });

  const [confirmModal, setConfirmModal] = useState<{
    isVisible: boolean;
    title: string;
    message: string;
    onConfirm: () => void;
    variant?: "danger" | "warning" | "info";
    confirmText?: string;
  }>({
    isVisible: false,
    title: "",
    message: "",
    onConfirm: () => {},
  });

  // Load tasks from database on mount
  useEffect(() => {
    const loadTasks = async () => {
      try {
        setState((prev) => ({ ...prev, isLoading: true }));
        const tasks = await apiService.getAllTasks();
        setState((prev) => ({ ...prev, tasks, isLoading: false }));
      } catch (error) {
        console.error("Failed to load tasks:", error);
        setState((prev) => ({
          ...prev,
          isLoading: false,
          error:
            error instanceof Error ? error.message : "Failed to load tasks",
        }));
      }
    };

    loadTasks();
  }, []);

  const handleTasksGenerated = useCallback((newTasks: Task[]) => {
    setState((prev) => {
      // Filter out tasks that already exist to prevent duplicates
      const existingIds = new Set(prev.tasks.map((task) => task.id));
      const uniqueNewTasks = newTasks.filter(
        (task) => !existingIds.has(task.id)
      );

      return {
        ...prev,
        tasks: [...prev.tasks, ...uniqueNewTasks],
        isLoading: false,
        error: null,
      };
    });
  }, []);

  const handleDeleteTask = useCallback(async (taskId: string) => {
    try {
      // Delete from database
      await apiService.deleteTask(taskId);

      // Update local state
      setState((prev) => ({
        ...prev,
        tasks: prev.tasks
          .map((task) => {
            // If deleting a subtask, remove it from the parent's subtasks array
            if (task.subtasks) {
              return {
                ...task,
                subtasks: task.subtasks.filter(
                  (subtask) => subtask.id !== taskId
                ),
              };
            }
            return task;
          })
          .filter((task) => task.id !== taskId), // Remove parent tasks
      }));
    } catch (error) {
      console.error("Failed to delete task:", error);
    }
  }, []);

  const handleToggleTask = useCallback(
    async (taskId: string) => {
      try {
        // Find the task being toggled
        const task = state.tasks.find((t) => t.id === taskId);
        const subtask = state.tasks
          .find((t) => t.subtasks?.some((s) => s.id === taskId))
          ?.subtasks?.find((s) => s.id === taskId);

        const taskToToggle = task || subtask;
        if (!taskToToggle) return;

        // Update in database
        await apiService.updateTaskCompletion(taskId, !taskToToggle.completed);

        // Update local state
        setState((prev) => ({
          ...prev,
          tasks: prev.tasks.map((task) => {
            // If toggling a parent task, toggle all its subtasks
            if (task.id === taskId) {
              const newCompleted = !task.completed;
              return {
                ...task,
                completed: newCompleted,
                subtasks: task.subtasks?.map((subtask) => ({
                  ...subtask,
                  completed: newCompleted,
                })),
              };
            }

            // If toggling a subtask, update it within the parent
            if (task.subtasks) {
              const updatedSubtasks = task.subtasks.map((subtask) =>
                subtask.id === taskId
                  ? { ...subtask, completed: !subtask.completed }
                  : subtask
              );

              // Check if this subtask toggle affects the parent
              const hasUpdatedSubtask = task.subtasks.some(
                (s) => s.id === taskId
              );
              if (hasUpdatedSubtask) {
                return {
                  ...task,
                  subtasks: updatedSubtasks,
                };
              }
            }

            return task;
          }),
        }));
      } catch (error) {
        console.error("Failed to toggle task:", error);
      }
    },
    [state.tasks]
  );

  const handleTaskTextUpdate = useCallback(
    async (taskId: string, newText: string) => {
      try {
        // Update in database
        await apiService.updateTaskText(taskId, newText);

        // Update local state
        setState((prev) => ({
          ...prev,
          tasks: prev.tasks.map((task) => {
            // Update parent task
            if (task.id === taskId) {
              return { ...task, task: newText };
            }

            // Update subtask
            if (task.subtasks) {
              return {
                ...task,
                subtasks: task.subtasks.map((subtask) =>
                  subtask.id === taskId
                    ? { ...subtask, task: newText }
                    : subtask
                ),
              };
            }

            return task;
          }),
        }));
      } catch (error) {
        console.error("Failed to update task text:", error);
      }
    },
    []
  );

  const handleTaskNotesUpdate = useCallback(
    async (taskId: string, newNotes: string) => {
      try {
        // Update in database
        await apiService.updateTaskNotes(taskId, newNotes);

        // Update local state
        setState((prev) => ({
          ...prev,
          tasks: prev.tasks.map((task) => {
            // Update parent task
            if (task.id === taskId) {
              return { ...task, notes: newNotes };
            }

            // Update subtask
            if (task.subtasks) {
              return {
                ...task,
                subtasks: task.subtasks.map((subtask) =>
                  subtask.id === taskId
                    ? { ...subtask, notes: newNotes }
                    : subtask
                ),
              };
            }

            return task;
          }),
        }));
      } catch (error) {
        console.error("Failed to update task notes:", error);
      }
    },
    []
  );

  const closeConfirmation = () => {
    setConfirmModal((prev) => ({ ...prev, isVisible: false }));
  };

  const getCurrentDate = () => {
    const now = new Date();
    return now.toLocaleDateString("en-US", {
      weekday: "long",
      year: "numeric",
      month: "long",
      day: "numeric",
    });
  };

  const getCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  return (
    <div className="min-h-screen bg-gray-50">
      {/* Header */}
      <header className="bg-white shadow-sm border-b border-gray-200">
        <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
          <div className="flex justify-between items-center h-16">
            <div className="flex items-center">
              <h1 className="text-xl font-semibold text-gray-900">
                AI Task Manager
              </h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-sm text-gray-500">
                {getCurrentDate()} • {getCurrentTime()}
              </div>
              <UserProfile />
            </div>
          </div>
        </div>
      </header>

      {/* Main Content */}
      <main className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 py-8">
        <div className="grid grid-cols-1 lg:grid-cols-3 gap-8">
          {/* Left Column - Agent Interaction */}
          <div className="lg:col-span-1">
            <AgentInteraction
              onTasksGenerated={handleTasksGenerated}
              isLoading={state.isLoading}
            />
          </div>

          {/* Right Column - Todo List */}
          <div className="lg:col-span-2">
            <TodoList
              tasks={state.tasks}
              onToggleTask={handleToggleTask}
              onDeleteTask={handleDeleteTask}
              onUpdateTaskText={handleTaskTextUpdate}
              onUpdateTaskNotes={handleTaskNotesUpdate}
            />
          </div>
        </div>
      </main>

      {/* Confirmation Modal */}
      {confirmModal.isVisible && (
        <ConfirmationModal
          isVisible={confirmModal.isVisible}
          title={confirmModal.title}
          message={confirmModal.message}
          onConfirm={confirmModal.onConfirm}
          onCancel={closeConfirmation}
          variant={confirmModal.variant}
          confirmText={confirmModal.confirmText}
        />
      )}
    </div>
  );
};

const App: React.FC = () => {
  return (
    <AuthProvider>
      <AuthGuard>
        <MainApp />
      </AuthGuard>
    </AuthProvider>
  );
};

export default App;
