import React, { useState, useCallback, useEffect } from "react";
import AgentInteraction from "./components/AgentInteraction";
import TodoList from "./components/TodoList";
import { Task, AppState } from "./types";
import { apiService } from "./services/api";
import "./App.css";

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    tasks: [],
    isLoading: false,
    error: null,
  });

  const [activeView, setActiveView] = useState<string>("my-day");

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

  const clearAllTasks = useCallback(async () => {
    try {
      // Clear from database
      await apiService.clearAllTasks();

      // Update local state
      setState((prev) => ({
        ...prev,
        tasks: [],
      }));
    } catch (error) {
      console.error("Failed to clear all tasks:", error);
    }
  }, []);

  const clearCompletedTasks = useCallback(async () => {
    try {
      // Clear from database
      await apiService.clearCompletedTasks();

      // Update local state
      setState((prev) => ({
        ...prev,
        tasks: prev.tasks
          .map((task) => {
            // For parent tasks, remove completed subtasks
            if (task.subtasks) {
              return {
                ...task,
                subtasks: task.subtasks.filter((subtask) => !subtask.completed),
              };
            }
            return task;
          })
          .filter((task) => {
            // Remove parent tasks that are fully completed
            if (task.subtasks && task.subtasks.length > 0) {
              // Keep parent if it has remaining subtasks
              return task.subtasks.some((subtask) => !subtask.completed);
            }
            // Remove standalone completed tasks
            return !task.completed;
          }),
      }));
    } catch (error) {
      console.error("Failed to clear completed tasks:", error);
    }
  }, []);

  const handleUpdateTaskText = useCallback(
    async (taskId: string, newText: string) => {
      try {
        // Update in database
        await apiService.updateTaskText(taskId, newText);

        // Update local state
        setState((prev) => ({
          ...prev,
          tasks: prev.tasks.map((task) => {
            // If updating a parent task
            if (task.id === taskId) {
              return {
                ...task,
                task: newText,
              };
            }

            // If updating a subtask, update it within the parent
            if (task.subtasks) {
              const updatedSubtasks = task.subtasks.map((subtask) =>
                subtask.id === taskId ? { ...subtask, task: newText } : subtask
              );

              // Check if this subtask update affects the parent
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
        console.error("Failed to update task text:", error);
      }
    },
    []
  );

  const handleUpdateTaskNotes = useCallback(
    async (taskId: string, newNotes: string) => {
      try {
        // Update in database
        await apiService.updateTaskNotes(taskId, newNotes);

        // Update local state
        setState((prev) => ({
          ...prev,
          tasks: prev.tasks.map((task) => {
            // If updating a parent task
            if (task.id === taskId) {
              return {
                ...task,
                notes: newNotes,
              };
            }

            // If updating a subtask, update it within the parent
            if (task.subtasks) {
              const updatedSubtasks = task.subtasks.map((subtask) =>
                subtask.id === taskId
                  ? { ...subtask, notes: newNotes }
                  : subtask
              );

              // Check if this subtask update affects the parent
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
        console.error("Failed to update task notes:", error);
      }
    },
    []
  );

  const getCurrentDate = () => {
    const now = new Date();
    const options: Intl.DateTimeFormatOptions = {
      weekday: "short",
      day: "2-digit",
      month: "long",
    };
    return now.toLocaleDateString("en-US", options);
  };

  const getCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString("en-US", {
      hour: "numeric",
      minute: "2-digit",
      hour12: true,
    });
  };

  // Calculate task counts for hierarchical structure
  const getTotalTaskCount = () => {
    return state.tasks.reduce((total, task) => {
      return total + 1 + (task.subtasks ? task.subtasks.length : 0);
    }, 0);
  };

  const getIncompleteTaskCount = () => {
    return state.tasks.reduce((total, task) => {
      const parentIncomplete = task.subtasks
        ? task.subtasks.some((subtask) => !subtask.completed)
        : !task.completed;
      const subtaskIncomplete = task.subtasks
        ? task.subtasks.filter((subtask) => !subtask.completed).length
        : 0;
      return total + (parentIncomplete ? 1 : 0) + subtaskIncomplete;
    }, 0);
  };

  const sidebarItems = [
    {
      id: "my-day",
      label: "My Day",
      icon: "☀️",
      count: getIncompleteTaskCount(),
    },
    { id: "calendar", label: "Calendar", icon: "📅", count: 2 },
    { id: "all", label: "All", icon: "📋", count: getTotalTaskCount() },
    {
      id: "tasks",
      label: "Tasks",
      icon: "✅",
      count: getIncompleteTaskCount(),
    },
    { id: "notes", label: "Notes", icon: "📝", count: 4 },
  ];

  const projects = [
    { id: "tech-upgrade", label: "Tech-Upgrade", icon: "⚡", count: 3 },
    { id: "new-design", label: "New-Design", icon: "🎨", count: 3 },
  ];

  return (
    <div className="min-h-screen flex bg-gray-900">
      {/* Sidebar */}
      <div className="w-80 sidebar flex flex-col">
        <div className="p-6 border-b border-gray-700 border-opacity-30">
          <div className="flex items-center gap-3 mb-6">
            <div className="w-8 h-8 bg-blue-500 rounded-full flex items-center justify-center">
              <span className="text-white text-sm font-semibold">J</span>
            </div>
            <span className="text-white font-medium">Jessie</span>
          </div>

          <div className="add-task-btn">
            <span className="text-xl">+</span>
            <span>Add Task</span>
          </div>
        </div>

        <div className="flex-1 p-6 overflow-y-auto">
          <div className="space-y-2 mb-8">
            {sidebarItems.map((item) => (
              <button
                key={item.id}
                onClick={() => setActiveView(item.id)}
                className={`btn-sidebar ${
                  activeView === item.id ? "active" : ""
                }`}
              >
                <span className="text-lg">{item.icon}</span>
                <span className="flex-1">{item.label}</span>
                <span className="text-xs text-gray-400">{item.count}</span>
              </button>
            ))}
          </div>

          <div className="section-header">
            <span>Projects</span>
          </div>

          <div className="space-y-2">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => setActiveView(project.id)}
                className={`btn-sidebar ${
                  activeView === project.id ? "active" : ""
                }`}
              >
                <span className="text-lg">{project.icon}</span>
                <span className="flex-1">{project.label}</span>
                <span className="text-xs text-gray-400">{project.count}</span>
              </button>
            ))}
          </div>
        </div>

        <div className="p-6 border-t border-gray-700 border-opacity-30">
          <div className="add-task-btn">
            <span className="text-xl">📝</span>
            <span>New List</span>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col main-content">
        {/* Header */}
        <div className="p-8 border-b border-gray-700 border-opacity-30">
          <div className="flex items-center justify-between">
            <div>
              <h1 className="text-4xl font-bold text-white mb-2">My Day</h1>
              <p className="text-gray-400">
                {getCurrentDate()} • {getCurrentTime()}
              </p>
            </div>
            <div className="flex items-center gap-4">
              <button className="p-2 text-gray-400 hover:text-white transition-colors">
                <span className="text-xl">⚙️</span>
              </button>
              <button className="p-2 text-gray-400 hover:text-white transition-colors">
                <span className="text-xl">🔔</span>
              </button>
            </div>
          </div>
        </div>

        {/* AI Task Agent Section */}
        <div className="p-8 border-b border-gray-700 border-opacity-30">
          <AgentInteraction
            onTasksGenerated={handleTasksGenerated}
            isLoading={state.isLoading}
          />
        </div>

        {/* Tasks Content */}
        <div className="flex-1 p-8 overflow-y-auto">
          <TodoList
            tasks={state.tasks}
            onDeleteTask={handleDeleteTask}
            onToggleTask={handleToggleTask}
            onUpdateTaskText={handleUpdateTaskText}
            onUpdateTaskNotes={handleUpdateTaskNotes}
          />

          {state.tasks.length > 0 && (
            <div className="flex gap-4 justify-center mt-8 pt-6 border-t border-gray-700 border-opacity-30">
              <button
                onClick={clearCompletedTasks}
                className="bg-gray-700 hover:bg-gray-600 text-gray-300 hover:text-white font-medium py-2 px-4 rounded-lg transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                disabled={!state.tasks.some((task) => task.completed)}
              >
                Clear Completed
              </button>
              <button
                onClick={clearAllTasks}
                className="bg-red-600 hover:bg-red-500 text-white font-medium py-2 px-4 rounded-lg transition-all duration-200"
              >
                Clear All
              </button>
            </div>
          )}
        </div>
      </div>
    </div>
  );
};

export default App;
