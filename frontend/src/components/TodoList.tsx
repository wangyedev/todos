import React, { useState, useRef } from "react";
import { Task } from "../types";
import TextRefinementTooltip from "./TextRefinementTooltip";
import NotesRefinementTooltip from "./NotesRefinementTooltip";

interface TodoListProps {
  tasks: Task[];
  onDeleteTask: (id: string) => void;
  onToggleTask: (id: string) => void;
  onUpdateTaskText: (id: string, newText: string) => void;
  onUpdateTaskNotes: (id: string, newNotes: string) => void;
}

const TodoList: React.FC<TodoListProps> = ({
  tasks,
  onDeleteTask,
  onToggleTask,
  onUpdateTaskText,
  onUpdateTaskNotes,
}) => {
  const [expandedTasks, setExpandedTasks] = useState<Set<string>>(new Set());
  const [editingTaskId, setEditingTaskId] = useState<string | null>(null);
  const [editingText, setEditingText] = useState<string>("");
  const [starredTasks, setStarredTasks] = useState<Set<string>>(new Set());
  const [textRefinementTooltip, setTextRefinementTooltip] = useState<{
    isVisible: boolean;
    taskId: string;
    text: string;
  }>({
    isVisible: false,
    taskId: "",
    text: "",
  });

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

  const toggleStarred = (taskId: string) => {
    setStarredTasks((prev) => {
      const newSet = new Set(prev);
      if (newSet.has(taskId)) {
        newSet.delete(taskId);
      } else {
        newSet.add(taskId);
      }
      return newSet;
    });
  };

  const handleTextDoubleClick = (task: Task) => {
    setEditingTaskId(task.id);
    setEditingText(task.task);
  };

  const handleEditingTextChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    setEditingText(e.target.value);
  };

  const handleEditingKeyPress = (e: React.KeyboardEvent<HTMLInputElement>) => {
    if (e.key === "Enter") {
      handleSaveEdit();
    } else if (e.key === "Escape") {
      handleCancelEdit();
    }
  };

  const handleSaveEdit = async () => {
    if (editingTaskId && editingText.trim()) {
      try {
        await onUpdateTaskText(editingTaskId, editingText.trim());
        setEditingTaskId(null);
        setEditingText("");
      } catch (error) {
        console.error("Failed to update task text:", error);
      }
    }
  };

  const handleCancelEdit = () => {
    setEditingTaskId(null);
    setEditingText("");
  };

  const closeTextRefinementTooltip = () => {
    setTextRefinementTooltip((prev) => ({ ...prev, isVisible: false }));
  };

  const getParentProgress = (task: Task) => {
    if (!task.subtasks || task.subtasks.length === 0) return 0;
    const completedSubtasks = task.subtasks.filter(
      (subtask) => subtask.completed
    ).length;
    return Math.round((completedSubtasks / task.subtasks.length) * 100);
  };

  const isParentCompleted = (task: Task) => {
    return (
      task.completed ||
      (task.subtasks && task.subtasks.every((st) => st.completed))
    );
  };

  const getStatusBadge = (task: Task) => {
    const today = new Date().toISOString().split("T")[0];

    if (task.dueDate) {
      if (task.dueDate < today && !isParentCompleted(task)) {
        return {
          text: "Yesterday",
          color: "text-red-400",
          bg: "bg-red-900 bg-opacity-30",
        };
      } else if (task.dueDate === today) {
        return {
          text: "Today",
          color: "text-blue-400",
          bg: "bg-blue-900 bg-opacity-30",
        };
      }
    }

    if (task.priority) {
      const priority = task.priority.toLowerCase();
      if (priority === "high") {
        return {
          text: "High",
          color: "text-red-400",
          bg: "bg-red-900 bg-opacity-30",
        };
      } else if (priority === "medium") {
        return {
          text: "Medium",
          color: "text-yellow-400",
          bg: "bg-yellow-900 bg-opacity-30",
        };
      }
    }

    return null;
  };

  const TaskItem = ({
    task,
    isSubtask = false,
  }: {
    task: Task;
    isSubtask?: boolean;
  }) => {
    const isExpanded = expandedTasks.has(task.id);
    const hasSubtasks = task.subtasks && task.subtasks.length > 0;
    const progress = getParentProgress(task);
    const isCompleted = isParentCompleted(task);
    const isStarred = starredTasks.has(task.id);
    const statusBadge = getStatusBadge(task);

    return (
      <div
        className={`task-item ${isCompleted ? "completed" : ""} ${
          isSubtask ? "ml-6 border-l-2 border-gray-600 pl-4" : ""
        }`}
      >
        <div className="flex items-start space-x-3">
          {/* Checkbox */}
          <button
            onClick={() => onToggleTask(task.id)}
            className={`task-checkbox mt-1 ${isCompleted ? "completed" : ""}`}
          >
            {isCompleted && (
              <svg
                className="w-3 h-3 text-white"
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M16.707 5.293a1 1 0 010 1.414l-8 8a1 1 0 01-1.414 0l-4-4a1 1 0 011.414-1.414L8 12.586l7.293-7.293a1 1 0 011.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>

          {/* Main content */}
          <div className="flex-1 min-w-0">
            <div className="flex items-center justify-between">
              <div className="flex-1 min-w-0">
                {editingTaskId === task.id ? (
                  <input
                    type="text"
                    value={editingText}
                    onChange={handleEditingTextChange}
                    onKeyDown={handleEditingKeyPress}
                    onBlur={handleSaveEdit}
                    className="input-field w-full"
                    autoFocus
                  />
                ) : (
                  <div className="space-y-2">
                    <div className="flex items-center space-x-2">
                      {hasSubtasks && !isSubtask && (
                        <button
                          onClick={() => toggleExpanded(task.id)}
                          className="text-gray-500 hover:text-white transition-colors"
                        >
                          <svg
                            className={`w-4 h-4 transition-transform ${
                              isExpanded ? "rotate-90" : ""
                            }`}
                            fill="currentColor"
                            viewBox="0 0 20 20"
                          >
                            <path
                              fillRule="evenodd"
                              d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                              clipRule="evenodd"
                            />
                          </svg>
                        </button>
                      )}

                      <h3
                        className={`font-medium text-white cursor-pointer ${
                          isCompleted ? "line-through opacity-60" : ""
                        }`}
                        onDoubleClick={() => handleTextDoubleClick(task)}
                      >
                        {task.task}
                      </h3>
                    </div>

                    {/* Status and metadata */}
                    <div className="flex items-center space-x-2 text-xs">
                      {statusBadge && (
                        <span
                          className={`px-2 py-1 rounded ${statusBadge.bg} ${statusBadge.color}`}
                        >
                          {statusBadge.text}
                        </span>
                      )}

                      {task.dueDate && (
                        <span className="text-gray-400">
                          📅 {new Date(task.dueDate).toLocaleDateString()}
                        </span>
                      )}

                      {hasSubtasks && (
                        <span className="text-gray-400">
                          📋{" "}
                          {task.subtasks!.filter((st) => st.completed).length}/
                          {task.subtasks!.length}
                        </span>
                      )}
                    </div>

                    {/* Progress bar for tasks with subtasks */}
                    {hasSubtasks && progress > 0 && (
                      <div className="progress-bar">
                        <div
                          className="progress-fill"
                          style={{ width: `${progress}%` }}
                        />
                      </div>
                    )}

                    {/* Task notes preview */}
                    {task.notes && (
                      <div className="text-xs text-gray-400 bg-gray-800 px-2 py-1 rounded">
                        💡 {task.notes.substring(0, 100)}
                        {task.notes.length > 100 ? "..." : ""}
                      </div>
                    )}
                  </div>
                )}
              </div>

              {/* Action buttons */}
              <div className="flex items-center space-x-1 opacity-0 group-hover:opacity-100 transition-opacity">
                {!isSubtask && (
                  <button
                    onClick={() => toggleStarred(task.id)}
                    className={`p-1 rounded hover:bg-gray-700 transition-colors ${
                      isStarred
                        ? "text-yellow-400"
                        : "text-gray-500 hover:text-yellow-400"
                    }`}
                  >
                    <svg
                      className="w-4 h-4"
                      fill={isStarred ? "currentColor" : "none"}
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M11.049 2.927c.3-.921 1.603-.921 1.902 0l1.519 4.674a1 1 0 00.95.69h4.915c.969 0 1.371 1.24.588 1.81l-3.976 2.888a1 1 0 00-.363 1.118l1.518 4.674c.3.922-.755 1.688-1.538 1.118l-3.976-2.888a1 1 0 00-1.176 0l-3.976 2.888c-.783.57-1.838-.197-1.538-1.118l1.518-4.674a1 1 0 00-.363-1.118l-3.976-2.888c-.784-.57-.38-1.81.588-1.81h4.914a1 1 0 00.951-.69l1.519-4.674z"
                      />
                    </svg>
                  </button>
                )}

                <button
                  onClick={() => onDeleteTask(task.id)}
                  className="p-1 rounded text-gray-500 hover:text-red-400 hover:bg-gray-700 transition-colors"
                >
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"
                    />
                  </svg>
                </button>

                <button className="p-1 rounded text-gray-500 hover:text-gray-300 hover:bg-gray-700 transition-colors">
                  <svg
                    className="w-4 h-4"
                    fill="none"
                    stroke="currentColor"
                    viewBox="0 0 24 24"
                  >
                    <path
                      strokeLinecap="round"
                      strokeLinejoin="round"
                      strokeWidth={2}
                      d="M12 5v.01M12 12v.01M12 19v.01M12 6a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2zm0 7a1 1 0 110-2 1 1 0 010 2z"
                    />
                  </svg>
                </button>
              </div>
            </div>
          </div>
        </div>

        {/* Subtasks */}
        {!isSubtask && hasSubtasks && isExpanded && (
          <div className="mt-3 space-y-2">
            {task.subtasks!.map((subtask) => (
              <TaskItem key={subtask.id} task={subtask} isSubtask={true} />
            ))}
          </div>
        )}
      </div>
    );
  };

  // Categorize tasks based on due dates
  const today = new Date();
  const todayStr = today.toISOString().split("T")[0];

  const isOverdue = (task: Task) => {
    if (!task.dueDate) return false;
    return task.dueDate < todayStr && !isParentCompleted(task);
  };

  const isDueToday = (task: Task) => {
    if (!task.dueDate) return false;
    return task.dueDate === todayStr;
  };

  const overdueTasks = tasks.filter((task) => isOverdue(task));
  const todayTasks = tasks.filter(
    (task) => !isOverdue(task) && (isDueToday(task) || !task.dueDate)
  );
  const completedTasks = tasks.filter((task) => isParentCompleted(task));

  const TaskSection = ({
    title,
    tasks,
    icon,
    isCollapsible = false,
  }: {
    title: string;
    tasks: Task[];
    icon?: string;
    isCollapsible?: boolean;
  }) => {
    const [isCollapsed, setIsCollapsed] = useState(false);

    if (tasks.length === 0) return null;

    return (
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <button
            onClick={() => isCollapsible && setIsCollapsed(!isCollapsed)}
            className="flex items-center space-x-2 text-gray-300 hover:text-white transition-colors"
          >
            <span className="text-lg font-semibold">{title}</span>
            {icon && <span className="text-sm">{icon}</span>}
            {isCollapsible && (
              <svg
                className={`w-4 h-4 transition-transform ${
                  isCollapsed ? "" : "rotate-90"
                }`}
                fill="currentColor"
                viewBox="0 0 20 20"
              >
                <path
                  fillRule="evenodd"
                  d="M7.293 14.707a1 1 0 010-1.414L10.586 10 7.293 6.707a1 1 0 011.414-1.414l4 4a1 1 0 010 1.414l-4 4a1 1 0 01-1.414 0z"
                  clipRule="evenodd"
                />
              </svg>
            )}
          </button>
        </div>

        {!isCollapsed && (
          <div className="space-y-2">
            {tasks.map((task) => (
              <div key={task.id} className="group">
                <TaskItem task={task} />
              </div>
            ))}
          </div>
        )}
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
            Add your first task using the AI task generator above.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <TaskSection title="Overdue" tasks={overdueTasks} icon="🔴" />
      <TaskSection
        title="Today"
        tasks={todayTasks.filter((t) => !isParentCompleted(t))}
        icon="☀️"
      />
      {completedTasks.length > 0 && (
        <TaskSection
          title="Completed"
          tasks={completedTasks}
          icon="✅"
          isCollapsible={true}
        />
      )}

      {/* Text Refinement Tooltip */}
      <TextRefinementTooltip
        text={textRefinementTooltip.text}
        isVisible={textRefinementTooltip.isVisible}
        onClose={closeTextRefinementTooltip}
        onRefinedTextSelect={(refinedText) => {
          if (textRefinementTooltip.taskId) {
            onUpdateTaskText(textRefinementTooltip.taskId, refinedText);
          }
        }}
      />
    </div>
  );
};

export default TodoList;
