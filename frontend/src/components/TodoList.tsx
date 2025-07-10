import React, { useState } from "react";
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
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());

  const toggleExpanded = (taskId: string) => {
    setExpandedTasks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

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

  // Calculate progress for parent tasks
  const getParentProgress = (task: Task) => {
    if (!task.subtasks || task.subtasks.length === 0) return 0;
    const completedSubtasks = task.subtasks.filter(
      (subtask) => subtask.completed
    ).length;
    return Math.round((completedSubtasks / task.subtasks.length) * 100);
  };

  // Check if parent task should be considered completed
  const isParentCompleted = (task: Task) => {
    if (!task.subtasks || task.subtasks.length === 0) return task.completed;
    return task.subtasks.every((subtask) => subtask.completed);
  };

  const TaskItem = ({
    task,
    isSubtask = false,
  }: {
    task: Task;
    isSubtask?: boolean;
  }) => {
    const isExpanded = expandedTasks.has(task.id);
    const parentProgress = isSubtask ? 0 : getParentProgress(task);
    const isCompleted = isSubtask ? task.completed : isParentCompleted(task);

    return (
      <div className={`${isSubtask ? "ml-8" : ""}`}>
        <div className={`task-item ${isCompleted ? "completed" : ""}`}>
          <div className="flex items-start gap-4">
            <div className="flex items-center gap-2">
              {/* Parent task expand/collapse button */}
              {!isSubtask && task.subtasks && task.subtasks.length > 0 && (
                <button
                  onClick={() => toggleExpanded(task.id)}
                  className="text-gray-400 hover:text-white transition-colors p-1"
                >
                  {isExpanded ? "▼" : "▶"}
                </button>
              )}

              {/* Task checkbox */}
              <button
                type="button"
                onClick={() => onToggleTask(task.id)}
                className={`task-checkbox ${isCompleted ? "completed" : ""}`}
                aria-label={
                  isCompleted ? "Mark as incomplete" : "Mark as complete"
                }
              >
                {isCompleted && <span className="text-white text-xs">✓</span>}
              </button>
            </div>

            <div className="flex-1 min-w-0">
              <div className="flex items-start justify-between gap-4">
                <div className="flex-1">
                  <div className="flex items-center gap-2 mb-1">
                    <p
                      className={`text-base leading-6 font-medium ${
                        isCompleted
                          ? "line-through text-gray-500"
                          : isSubtask
                          ? "text-gray-200"
                          : "text-white"
                      }`}
                    >
                      {task.task}
                    </p>

                    {/* Parent task indicator */}
                    {!isSubtask &&
                      task.subtasks &&
                      task.subtasks.length > 0 && (
                        <span className="text-xs bg-blue-500 bg-opacity-20 text-blue-300 px-2 py-1 rounded-full">
                          {task.subtasks.length} tasks
                        </span>
                      )}
                  </div>

                  {/* Progress bar for parent tasks */}
                  {!isSubtask && task.subtasks && task.subtasks.length > 0 && (
                    <div className="mb-2">
                      <div className="flex items-center gap-2 text-xs text-gray-400 mb-1">
                        <span>Progress: {parentProgress}%</span>
                      </div>
                      <div className="w-full bg-gray-700 rounded-full h-2">
                        <div
                          className="bg-blue-500 h-2 rounded-full transition-all duration-300"
                          style={{ width: `${parentProgress}%` }}
                        />
                      </div>
                    </div>
                  )}

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
                  {!isSubtask && (
                    <button
                      type="button"
                      className="text-gray-500 hover:text-white p-1 hover:bg-gray-700 hover:bg-opacity-50 rounded transition-colors duration-200"
                      aria-label="Star task"
                    >
                      ⭐
                    </button>
                  )}
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

        {/* Subtasks */}
        {!isSubtask &&
          task.subtasks &&
          task.subtasks.length > 0 &&
          isExpanded && (
            <div className="mt-2 space-y-2">
              {task.subtasks.map((subtask) => (
                <TaskItem key={subtask.id} task={subtask} isSubtask={true} />
              ))}
            </div>
          )}
      </div>
    );
  };

  // Categorize tasks
  const today = new Date();
  const yesterday = new Date(today);
  yesterday.setDate(today.getDate() - 1);

  const overdueTasks = tasks.filter(
    (task) => !isParentCompleted(task) && Math.random() < 0.2
  ); // Simulate overdue
  const todayTasks = tasks.filter((task) => !overdueTasks.includes(task));
  const completedTasks = tasks.filter((task) => isParentCompleted(task));

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
            <TaskItem key={task.id} task={task} />
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
        tasks={todayTasks.filter((t) => !isParentCompleted(t))}
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
