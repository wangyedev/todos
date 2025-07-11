import React, { useState, useCallback, useEffect } from "react";
import { AuthProvider } from "./contexts/AuthContext";
import AuthGuard from "./components/Auth/AuthGuard";
import UserProfile from "./components/Auth/UserProfile";
import AgentInteraction from "./components/AgentInteraction";
import TodoList from "./components/TodoList";
import ConfirmationModal from "./components/ConfirmationModal";
import { Task, AppState } from "./types";
import { apiService, ApiError } from "./services/api";
import "./App.css";

const MainApp: React.FC = () => {
  const [state, setState] = useState<AppState>({
    tasks: [],
    isLoading: false,
    error: null,
    user: null,
    isAuthenticated: false,
  });

  const [activeView, setActiveView] = useState<string>("my-day");
  const [sidebarCollapsed, setSidebarCollapsed] = useState(false);

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

  // Load tasks from database
  const loadTasks = useCallback(async () => {
    try {
      setState((prev) => ({ ...prev, isLoading: true }));
      const tasks = await apiService.getAllTasks();
      setState((prev) => ({ ...prev, tasks, isLoading: false }));
    } catch (error) {
      console.error("Failed to load tasks:", error);
      setState((prev) => ({
        ...prev,
        isLoading: false,
        error: error instanceof Error ? error.message : "Failed to load tasks",
      }));
    }
  }, []);

  // Load tasks on mount
  useEffect(() => {
    loadTasks();
  }, [loadTasks]);

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

  const handleDeleteTask = useCallback(
    async (taskId: string) => {
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

        // If the task doesn't exist in the database (404), refresh tasks from backend
        if (error instanceof ApiError && error.status === 404) {
          console.log(
            "Task not found in database, refreshing tasks from backend"
          );
          loadTasks();
        }
      }
    },
    [loadTasks]
  );

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

        // Update in database - backend handles parent-subtask logic
        await apiService.updateTaskCompletion(taskId, !taskToToggle.completed);

        // Refresh tasks from backend to get the correct state
        // This ensures frontend stays in sync with backend logic
        await loadTasks();
      } catch (error) {
        console.error("Failed to toggle task:", error);

        // If the task doesn't exist in the database (404), refresh tasks from backend
        if (error instanceof ApiError && error.status === 404) {
          console.log(
            "Task not found in database, refreshing tasks from backend"
          );
          // Refresh tasks from backend to sync local state
          loadTasks();
        }
      }
    },
    [state.tasks, loadTasks]
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

        // If the task doesn't exist in the database (404), refresh tasks from backend
        if (error instanceof ApiError && error.status === 404) {
          console.log(
            "Task not found in database, refreshing tasks from backend"
          );
          loadTasks();
        }
      }
    },
    [loadTasks]
  );

  const closeConfirmation = () => {
    setConfirmModal((prev) => ({ ...prev, isVisible: false }));
  };

  const getCurrentDate = () => {
    const now = new Date();
    return now.toLocaleDateString("en-US", {
      weekday: "short",
      day: "2-digit",
      month: "long",
    });
  };

  const getCurrentTime = () => {
    const now = new Date();
    return now.toLocaleTimeString("en-US", {
      hour: "2-digit",
      minute: "2-digit",
    });
  };

  const getViewTitle = () => {
    switch (activeView) {
      case "my-day":
        return "My Day";
      case "tasks":
        return "Tasks";
      case "calendar":
        return "Calendar";
      case "notes":
        return "Notes";
      default:
        return "My Day";
    }
  };

  const navItems = [
    {
      id: "my-day",
      icon: "☀️",
      label: "My Day",
      count: state.tasks.filter((t) => !t.completed).length,
    },
    { id: "calendar", icon: "📅", label: "Calendar", count: 2 },
    { id: "tasks", icon: "📋", label: "Tasks", count: state.tasks.length },
    { id: "notes", icon: "📝", label: "Notes", count: 4 },
  ];

  const projects = [
    { id: "tech-upgrade", icon: "🔧", label: "Tech-Upgrade", count: 3 },
    { id: "new-design", icon: "🎨", label: "New-Design", count: 3 },
  ];

  return (
    <div className="flex h-screen bg-gray-900 text-white">
      {/* Sidebar */}
      <div
        className={`${
          sidebarCollapsed ? "w-16" : "w-74"
        } bg-gray-800 transition-all duration-300 flex flex-col`}
      >
        {/* User Profile Header */}
        <div className="p-4 border-b border-gray-700">
          <div className="flex items-center space-x-3">
            <UserProfile />
            {!sidebarCollapsed && (
              <div className="flex-1">
                <h2 className="text-sm font-medium text-gray-300">
                  Welcome back
                </h2>
              </div>
            )}
          </div>
        </div>

        {/* Add Task Button */}
        <div className="p-4">
          <button
            onClick={() => setActiveView("add-task")}
            className="w-full flex items-center space-x-2 px-3 py-2 bg-blue-600 hover:bg-blue-700 rounded-lg transition-colors"
          >
            <span>+</span>
            {!sidebarCollapsed && <span>Add Task</span>}
          </button>
        </div>

        {/* Navigation */}
        <nav className="flex-1 px-4 space-y-1">
          {navItems.map((item) => (
            <button
              key={item.id}
              onClick={() => setActiveView(item.id)}
              className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                activeView === item.id
                  ? "bg-gray-700 text-white"
                  : "text-gray-300 hover:bg-gray-700 hover:text-white"
              }`}
            >
              <div className="flex items-center space-x-3">
                <span className="text-lg">{item.icon}</span>
                {!sidebarCollapsed && <span>{item.label}</span>}
              </div>
              {!sidebarCollapsed && item.count > 0 && (
                <span className="text-xs bg-gray-600 px-2 py-1 rounded-full">
                  {item.count}
                </span>
              )}
            </button>
          ))}
        </nav>

        {/* Projects Section */}
        <div className="px-4 py-2">
          <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-2">
            {!sidebarCollapsed && "Projects"}
          </h3>
          <div className="space-y-1">
            {projects.map((project) => (
              <button
                key={project.id}
                onClick={() => setActiveView(project.id)}
                className={`w-full flex items-center justify-between px-3 py-2 rounded-lg transition-colors ${
                  activeView === project.id
                    ? "bg-gray-700 text-white"
                    : "text-gray-300 hover:bg-gray-700 hover:text-white"
                }`}
              >
                <div className="flex items-center space-x-3">
                  <span className="text-lg">{project.icon}</span>
                  {!sidebarCollapsed && <span>{project.label}</span>}
                </div>
                {!sidebarCollapsed && project.count > 0 && (
                  <span className="text-xs bg-gray-600 px-2 py-1 rounded-full">
                    {project.count}
                  </span>
                )}
              </button>
            ))}
          </div>
        </div>

        {/* New List Button */}
        <div className="p-4 border-t border-gray-700">
          <button className="w-full flex items-center space-x-2 px-3 py-2 text-gray-400 hover:text-white hover:bg-gray-700 rounded-lg transition-colors">
            <span>+</span>
            {!sidebarCollapsed && <span>New List</span>}
          </button>
        </div>
      </div>

      {/* Main Content */}
      <div className="flex-1 flex flex-col">
        {/* Header */}
        <header className="bg-gray-800 border-b border-gray-700 px-6 py-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center space-x-4">
              <button
                onClick={() => setSidebarCollapsed(!sidebarCollapsed)}
                className="p-2 hover:bg-gray-700 rounded-lg transition-colors"
              >
                <svg
                  className="w-5 h-5"
                  fill="none"
                  stroke="currentColor"
                  viewBox="0 0 24 24"
                >
                  <path
                    strokeLinecap="round"
                    strokeLinejoin="round"
                    strokeWidth={2}
                    d="M4 6h16M4 12h16M4 18h16"
                  />
                </svg>
              </button>
              <h1 className="text-2xl font-semibold">{getViewTitle()}</h1>
            </div>
            <div className="flex items-center space-x-4">
              <div className="text-right">
                <div className="text-lg font-medium">{getCurrentDate()}</div>
                <div className="text-sm text-gray-400">{getCurrentTime()}</div>
              </div>
              <div className="flex items-center space-x-2">
                <button className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 3v1m0 16v1m9-9h-1M4 12H3m15.364 6.364l-.707-.707M6.343 6.343l-.707-.707m12.728 0l-.707.707M6.343 17.657l-.707.707M16 12a4 4 0 11-8 0 4 4 0 018 0z"
                    />
                  </svg>
                </button>
                <button className="p-2 hover:bg-gray-700 rounded-lg transition-colors">
                  <svg
                    className="w-5 h-5"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M8.228 9c.549-1.165 2.03-2 3.772-2 2.21 0 4 1.343 4 3 0 1.4-1.278 2.575-3.006 2.907-.542.104-.994.54-.994 1.093m0 3h.01M21 12a9 9 0 11-18 0 9 9 0 0118 0z"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </header>

        {/* Content Area */}
        <main className="flex-1 overflow-auto">
          {(activeView === "my-day" ||
            activeView === "tasks" ||
            activeView === "add-task") && (
            <div className="p-6">
              {/* Agent Interaction for adding tasks */}
              {activeView === "add-task" && (
                <div className="mb-8 max-w-3xl">
                  <AgentInteraction
                    onTasksGenerated={handleTasksGenerated}
                    isLoading={state.isLoading}
                  />
                </div>
              )}

              {/* Task List */}
              <div className="max-w-4xl">
                <TodoList
                  tasks={state.tasks}
                  onToggleTask={handleToggleTask}
                  onDeleteTask={handleDeleteTask}
                  onUpdateTaskText={handleTaskTextUpdate}
                />
              </div>
            </div>
          )}

          {activeView === "calendar" && (
            <div className="p-6">
              <div className="text-center text-gray-400">
                <h3 className="text-lg font-medium mb-2">Calendar View</h3>
                <p>Calendar functionality coming soon</p>
              </div>
            </div>
          )}

          {activeView === "notes" && (
            <div className="p-6">
              <div className="text-center text-gray-400">
                <h3 className="text-lg font-medium mb-2">Notes</h3>
                <p>Notes functionality coming soon</p>
              </div>
            </div>
          )}
        </main>
      </div>

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
