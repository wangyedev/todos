import React from "react";
import { Task } from "../types";

interface TodoListProps {
  tasks: Task[];
  onDeleteTask: (id: string) => void;
  onToggleTask: (id: string) => void;
}

const TodoList: React.FC<TodoListProps> = ({
  tasks,
  onDeleteTask,
  onToggleTask,
}) => {
  const getPriorityColor = (priority?: string) => {
    switch (priority) {
      case "high":
        return "bg-red-500 bg-opacity-20 text-red-300 border-red-500 border-opacity-30";
      case "medium":
        return "bg-yellow-500 bg-opacity-20 text-yellow-300 border-yellow-500 border-opacity-30";
      case "low":
        return "bg-green-500 bg-opacity-20 text-green-300 border-green-500 border-opacity-30";
      default:
        return "bg-gray-500 bg-opacity-20 text-gray-300 border-gray-500 border-opacity-30";
    }
  };

  const getPriorityIcon = (priority?: string) => {
    switch (priority) {
      case "high":
        return "🔴";
      case "medium":
        return "🟡";
      case "low":
        return "🟢";
      default:
        return "⚪";
    }
  };

  // Categorize tasks
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const overdueTasks = tasks.filter(
    (task) => !task.completed && Math.random() < 0.2
  ); // Simulate overdue
  const todayTasks = tasks.filter((task) => !overdueTasks.includes(task));
  const completedTasks = tasks.filter((task) => task.completed);

  const TaskSection = ({
    title,
    tasks,
    color = "text-gray-400",
  }: {
    title: string;
    tasks: Task[];
    color?: string;
  }) => {
    if (tasks.length === 0) return null;

    return (
      <div className="mb-8">
        <div className={`section-header ${color}`}>
          <span>{title}</span>
          <span className="text-xs bg-gray-600 bg-opacity-50 px-2 py-1 rounded-full">
            {tasks.length}
          </span>
        </div>
        <div className="space-y-3">
          {tasks.map((task) => (
            <div
              key={task.id}
              className={`task-item ${task.completed ? "completed" : ""}`}
            >
              <div className="flex items-start gap-4">
                <button
                  type="button"
                  onClick={() => onToggleTask(task.id)}
                  className={`task-checkbox ${
                    task.completed ? "completed" : ""
                  }`}
                  aria-label={
                    task.completed ? "Mark as incomplete" : "Mark as complete"
                  }
                >
                  {task.completed && (
                    <span className="text-white text-xs">✓</span>
                  )}
                </button>

                <div className="flex-1 min-w-0">
                  <div className="flex items-start justify-between gap-4">
                    <div className="flex-1">
                      <p
                        className={`text-base leading-6 font-medium ${
                          task.completed
                            ? "line-through text-gray-500"
                            : "text-white"
                        }`}
                      >
                        {task.task}
                      </p>

                      {/* Task metadata */}
                      <div className="flex flex-wrap gap-2 mt-2">
                        {task.priority && (
                          <span
                            className={`inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium border ${getPriorityColor(
                              task.priority
                            )}`}
                          >
                            {getPriorityIcon(task.priority)}
                            {task.priority}
                          </span>
                        )}

                        {task.estimatedDuration && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-blue-500 bg-opacity-20 text-blue-300 border border-blue-500 border-opacity-30">
                            ⏱️ {task.estimatedDuration}
                          </span>
                        )}

                        {task.category && (
                          <span className="inline-flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium bg-purple-500 bg-opacity-20 text-purple-300 border border-purple-500 border-opacity-30">
                            📂 {task.category}
                          </span>
                        )}
                      </div>

                      {/* Task notes */}
                      {task.notes && (
                        <div className="mt-2 text-sm text-gray-400 bg-gray-800 bg-opacity-50 p-3 rounded border-l-4 border-gray-600">
                          💡 {task.notes}
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-2">
                      <button
                        type="button"
                        className="text-gray-500 hover:text-white p-1 hover:bg-gray-700 hover:bg-opacity-50 rounded transition-colors duration-200"
                        aria-label="Star task"
                      >
                        ⭐
                      </button>
                      <button
                        type="button"
                        onClick={() => onDeleteTask(task.id)}
                        className="text-gray-500 hover:text-red-400 p-1 hover:bg-gray-700 hover:bg-opacity-50 rounded transition-colors duration-200"
                        aria-label="Delete task"
                      >
                        🗑️
                      </button>
                    </div>
                  </div>
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    );
  };

  if (tasks.length === 0) {
    return (
      <div className="text-center py-12">
        <div className="text-gray-500">
          <div className="text-6xl mb-4">📝</div>
          <h3 className="text-xl font-medium mb-2 text-gray-400">
            No tasks yet
          </h3>
          <p className="text-gray-500 text-sm">
            Add your first task by typing or recording a voice command above.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TaskSection title="Overdue" tasks={overdueTasks} color="text-red-400" />
      <TaskSection
        title="Today"
        tasks={todayTasks.filter((t) => !t.completed)}
      />
      {completedTasks.length > 0 && (
        <TaskSection
          title="Completed"
          tasks={completedTasks}
          color="text-green-400"
        />
      )}
    </div>
  );
};

export default TodoList;
