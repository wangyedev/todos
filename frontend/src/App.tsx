import React, { useState, useCallback } from "react";
import AgentInteraction from "./components/AgentInteraction";
import TodoList from "./components/TodoList";
import { Task, AppState } from "./types";
import "./App.css";

const App: React.FC = () => {
  const [state, setState] = useState<AppState>({
    tasks: [],
    isLoading: false,
    error: null,
  });

  const [activeView, setActiveView] = useState<string>("my-day");

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

  const handleDeleteTask = useCallback((taskId: string) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((task) => task.id !== taskId),
    }));
  }, []);

  const handleToggleTask = useCallback((taskId: string) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.map((task) =>
        task.id === taskId ? { ...task, completed: !task.completed } : task
      ),
    }));
  }, []);

  const clearAllTasks = useCallback(() => {
    setState((prev) => ({
      ...prev,
      tasks: [],
    }));
  }, []);

  const clearCompletedTasks = useCallback(() => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((task) => !task.completed),
    }));
  }, []);

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

  const sidebarItems = [
    {
      id: "my-day",
      label: "My Day",
      icon: "☀️",
      count: state.tasks.filter((t) => !t.completed).length,
    },
    { id: "calendar", label: "Calendar", icon: "📅", count: 2 },
    { id: "all", label: "All", icon: "📋", count: state.tasks.length },
    {
      id: "tasks",
      label: "Tasks",
      icon: "✅",
      count: state.tasks.filter((t) => !t.completed).length,
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
