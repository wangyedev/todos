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
  if (tasks.length === 0) {
    return (
      <div className="glass p-12 text-center">
        <div className="text-gray-600">
          <div className="text-6xl mb-4">📝</div>
          <h3 className="text-2xl font-semibold mb-2 text-gray-700">
            No tasks yet
          </h3>
          <p className="text-gray-600">
            Add your first task by typing or recording a voice command above.
          </p>
        </div>
      </div>
    );
  }

  return (
    <div className="glass p-8">
      <h2 className="text-2xl font-semibold mb-4 text-gray-700">Your Tasks</h2>
      <div className="text-gray-600 mb-6 text-sm">
        {tasks.filter((task) => !task.completed).length} of {tasks.length} tasks
        remaining
      </div>
      <ul className="space-y-0 divide-y divide-gray-200">
        {tasks.map((task) => (
          <li
            key={task.id}
            className={`flex items-center justify-between p-4 transition-all duration-200 hover:bg-primary-50 hover:bg-opacity-50 ${
              task.completed ? "opacity-60" : ""
            }`}
          >
            <div className="flex items-center gap-4 flex-1">
              <button
                type="button"
                onClick={() => onToggleTask(task.id)}
                className="text-xl p-2 hover:bg-primary-100 hover:bg-opacity-50 rounded-full transition-colors duration-200"
                aria-label={
                  task.completed ? "Mark as incomplete" : "Mark as complete"
                }
              >
                {task.completed ? "✅" : "⭕"}
              </button>
              <span
                className={`flex-1 text-left text-base leading-6 ${
                  task.completed
                    ? "line-through text-gray-500"
                    : "text-gray-800"
                }`}
              >
                {task.task}
              </span>
            </div>
            <button
              type="button"
              onClick={() => onDeleteTask(task.id)}
              className="text-red-500 hover:text-red-700 p-2 hover:bg-red-50 hover:bg-opacity-50 rounded-full transition-colors duration-200"
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
