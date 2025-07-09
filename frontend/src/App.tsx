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
    setState((prev) => ({
      ...prev,
      tasks: [...prev.tasks, ...newTasks],
      isLoading: false,
      error: null,
    }));
  }, []);

  const handleDeleteTask = useCallback((taskId: number) => {
    setState((prev) => ({
      ...prev,
      tasks: prev.tasks.filter((task) => task.id !== taskId),
    }));
  }, []);

  const handleToggleTask = useCallback((taskId: number) => {
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
    <div className="app">
      <header className="app-header">
        <div className="container">
          <AgentInteraction
            onTasksGenerated={handleTasksGenerated}
            isLoading={state.isLoading}
          />
        </div>
      </header>

      <main className="app-main">
        <div className="container">
          <div className="task-section">
            <TodoList
              tasks={state.tasks}
              onDeleteTask={handleDeleteTask}
              onToggleTask={handleToggleTask}
            />

            {state.tasks.length > 0 && (
              <div className="task-actions">
                <button
                  onClick={clearCompletedTasks}
                  className="action-button secondary"
                  disabled={!state.tasks.some((task) => task.completed)}
                >
                  Clear Completed
                </button>
                <button
                  onClick={clearAllTasks}
                  className="action-button danger"
                >
                  Clear All
                </button>
              </div>
            )}
          </div>
        </div>
      </main>

      <footer className="app-footer">
        <div className="container">
          <p>Powered by Google Gemini AI</p>
        </div>
      </footer>
    </div>
  );
};

export default App;
