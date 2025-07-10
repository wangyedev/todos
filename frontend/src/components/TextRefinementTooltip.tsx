import React, { useState } from "react";
import { apiService } from "../services/api";

interface TextRefinementTooltipProps {
  text: string;
  isVisible: boolean;
  onClose: () => void;
  onRefinedTextSelect: (refinedText: string) => void;
}

const TextRefinementTooltip: React.FC<TextRefinementTooltipProps> = ({
  text,
  isVisible,
  onClose,
  onRefinedTextSelect,
}) => {
  const [isLoading, setIsLoading] = useState(false);
  const [refinedTexts, setRefinedTexts] = useState<{ [key: string]: string }>(
    {}
  );
  const [error, setError] = useState<string | null>(null);

  const refinementOptions = [
    { id: "formal", label: "✨ Make Formal", description: "Professional tone" },
    {
      id: "concise",
      label: "🎯 Make Concise",
      description: "Brief and direct",
    },
    {
      id: "detailed",
      label: "📝 Add Detail",
      description: "More comprehensive",
    },
    { id: "casual", label: "😊 Make Casual", description: "Friendly tone" },
  ];

  const handleRefinement = async (
    refinementType: "formal" | "concise" | "detailed" | "casual"
  ) => {
    try {
      setIsLoading(true);
      setError(null);

      const result = await apiService.refineTaskText(text, refinementType);

      setRefinedTexts((prev) => ({
        ...prev,
        [refinementType]: result.refinedText,
      }));
    } catch (error) {
      console.error("Failed to refine text:", error);
      setError("Failed to refine text. Please try again.");
    } finally {
      setIsLoading(false);
    }
  };

  const handleSelectRefinement = (refinementType: string) => {
    const refinedText = refinedTexts[refinementType];
    if (refinedText) {
      onRefinedTextSelect(refinedText);
      onClose();
    }
  };

  if (!isVisible) return null;

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40" onClick={onClose} />

      {/* Tooltip */}
      <div
        className="fixed z-50 bg-gray-800 border border-gray-600 rounded-lg shadow-xl p-4 max-w-md w-full max-h-[80vh] overflow-y-auto mx-4"
        style={{
          left: "50%",
          top: "50%",
          transform: "translate(-50%, -50%)",
        }}
      >
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-sm font-semibold text-white">Refine Task Text</h3>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-white transition-colors"
          >
            ✕
          </button>
        </div>

        <div className="text-xs text-gray-400 mb-3 p-2 bg-gray-900 rounded border-l-2 border-blue-500">
          📝 Original: "{text}"
        </div>

        {error && (
          <div className="text-xs text-red-400 mb-3 p-2 bg-red-900 bg-opacity-20 rounded border-l-2 border-red-500">
            {error}
          </div>
        )}

        <div className="space-y-2">
          {refinementOptions.map((option) => (
            <div
              key={option.id}
              className="border border-gray-700 rounded-lg p-3"
            >
              <div className="flex items-center justify-between mb-2">
                <div>
                  <div className="text-sm font-medium text-white">
                    {option.label}
                  </div>
                  <div className="text-xs text-gray-400">
                    {option.description}
                  </div>
                </div>
                <button
                  onClick={() => handleRefinement(option.id as any)}
                  disabled={isLoading}
                  className="px-3 py-1 text-xs bg-blue-600 hover:bg-blue-500 text-white rounded transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? "..." : "Try"}
                </button>
              </div>

              {refinedTexts[option.id] && (
                <div className="mt-2 p-2 bg-gray-900 rounded text-xs text-gray-300 border-l-2 border-green-500">
                  <div className="mb-2">
                    ✨ Result: "{refinedTexts[option.id]}"
                  </div>
                  <button
                    onClick={() => handleSelectRefinement(option.id)}
                    className="px-2 py-1 text-xs bg-green-600 hover:bg-green-500 text-white rounded transition-colors"
                  >
                    Use This
                  </button>
                </div>
              )}
            </div>
          ))}
        </div>
      </div>
    </>
  );
};

export default TextRefinementTooltip;
