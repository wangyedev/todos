import React from "react";
import { Task } from "../types";

interface TodoListProps {
  tasks: Task[];
  onDeleteTask: (id: number) => void;
  onToggleTask: (id: number) => void;
}

const TodoList: React.FC<TodoListProps> = ({
  tasks,
  onDeleteTask,
  onToggleTask,
}) => {
  if (tasks.length === 0) {
    return (
      <div className="todo-list empty">
        <div className="empty-state">
          <div className="empty-icon">📝</div>
          <h3>No tasks yet</h3>
          <p>
            Add your first task by typing or recording a voice command above.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="todo-list">
      <h2>Your Tasks</h2>
      <div className="task-count">
        {tasks.filter((task) => !task.completed).length} of {tasks.length} tasks
        remaining
      </div>
      <ul className="task-list">
        {tasks.map((task) => (
          <li
            key={task.id}
            className={`task-item ${task.completed ? "completed" : ""}`}
          >
            <div className="task-content">
              <button
                type="button"
                onClick={() => onToggleTask(task.id)}
                className="task-checkbox"
                aria-label={
                  task.completed ? "Mark as incomplete" : "Mark as complete"
                }
              >
                {task.completed ? "✅" : "⭕"}
              </button>
              <span className="task-text">{task.task}</span>
            </div>
            <button
              type="button"
              onClick={() => onDeleteTask(task.id)}
              className="delete-button"
              aria-label="Delete task"
            >
              🗑️
            </button>
          </li>
        ))}
      </ul>
    </div>
  );
};

export default TodoList;
