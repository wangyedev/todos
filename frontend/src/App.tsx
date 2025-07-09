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

  return (
    <div className="min-h-screen flex flex-col p-5">
      <header className="glass sticky top-0 z-100 p-8 mb-8">
        <div className="max-w-6xl mx-auto">
          <AgentInteraction
            onTasksGenerated={handleTasksGenerated}
            isLoading={state.isLoading}
          />
        </div>
      </header>

      <main className="flex-1 pb-8">
        <div className="max-w-6xl mx-auto">
          <div className="task-section">
            <TodoList
              tasks={state.tasks}
              onDeleteTask={handleDeleteTask}
              onToggleTask={handleToggleTask}
            />

            {state.tasks.length > 0 && (
              <div className="flex gap-4 justify-center mt-6 pt-6 border-t border-gray-200">
                <button
                  onClick={clearCompletedTasks}
                  className="bg-gray-100 hover:bg-gray-200 text-gray-700 font-medium py-2 px-4 rounded-lg transition-colors duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
                  disabled={!state.tasks.some((task) => task.completed)}
                >
                  Clear Completed
                </button>
                <button
                  onClick={clearAllTasks}
                  className="bg-red-500 hover:bg-red-600 text-white font-medium py-2 px-4 rounded-lg transition-colors duration-200"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="bg-black bg-opacity-10 p-4 text-center text-white text-opacity-80 text-sm">
        <div className="max-w-6xl mx-auto">
          <p>VOB - AI Task Agent powered by Google Gemini</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
