import React from "react";

interface ConfirmationModalProps {
  isVisible: boolean;
  title: string;
  message: string;
  confirmText?: string;
  cancelText?: string;
  onConfirm: () => void;
  onCancel: () => void;
  variant?: "danger" | "warning" | "info";
}

const ConfirmationModal: React.FC<ConfirmationModalProps> = ({
  isVisible,
  title,
  message,
  confirmText = "Confirm",
  cancelText = "Cancel",
  onConfirm,
  onCancel,
  variant = "danger",
}) => {
  if (!isVisible) return null;

  const getVariantStyles = () => {
    switch (variant) {
      case "danger":
        return {
          icon: "🗑️",
          confirmButton: "bg-red-600 hover:bg-red-500 focus:ring-red-500",
        };
      case "warning":
        return {
          icon: "⚠️",
          confirmButton:
            "bg-orange-600 hover:bg-orange-500 focus:ring-orange-500",
        };
      case "info":
        return {
          icon: "ℹ️",
          confirmButton: "bg-blue-600 hover:bg-blue-500 focus:ring-blue-500",
        };
      default:
        return {
          icon: "❓",
          confirmButton: "bg-gray-600 hover:bg-gray-500 focus:ring-gray-500",
        };
    }
  };

  const styles = getVariantStyles();

  return (
    <>
      {/* Backdrop */}
      <div
        className="fixed inset-0 bg-black bg-opacity-50 z-50 flex items-center justify-center p-4"
        onClick={onCancel}
      >
        {/* Modal */}
        <div
          className="bg-gray-800 rounded-lg shadow-xl max-w-md w-full border border-gray-700"
          onClick={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="flex items-center gap-3 p-6 pb-4">
            <div className="text-2xl">{styles.icon}</div>
            <h3 className="text-lg font-semibold text-white">{title}</h3>
          </div>

          {/* Content */}
          <div className="px-6 pb-6">
            <p className="text-gray-300 leading-relaxed mb-6">{message}</p>

            {/* Actions */}
            <div className="flex gap-3 justify-end">
              <button
                onClick={onCancel}
                className="px-4 py-2 text-sm font-medium text-gray-300 bg-gray-700 hover:bg-gray-600 rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-gray-500 focus:ring-offset-2 focus:ring-offset-gray-800"
              >
                {cancelText}
              </button>
              <button
                onClick={onConfirm}
                className={`px-4 py-2 text-sm font-medium text-white rounded-lg transition-colors duration-200 focus:outline-none focus:ring-2 focus:ring-offset-2 focus:ring-offset-gray-800 ${styles.confirmButton}`}
              >
                {confirmText}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
};

export default ConfirmationModal;
