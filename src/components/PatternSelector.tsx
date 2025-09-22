// src/components/PatternSelector.tsx

import React from "react";
import allPatterns from "../actions/allPaterns"; // Import the list of patterns we created earlier

// Define the types for the props this component will receive.
interface PatternSelectorProps {
  onSelect: (patternId: string) => void;
  selectedPatternId: string;
}

const PatternSelector: React.FC<PatternSelectorProps> = ({
  onSelect,
  selectedPatternId,
}) => {
  return (
    <div className="flex flex-col gap-2">
      <label className="text-sm text-gray-500">Choose a Pattern</label>
      <div className="flex flex-wrap gap-2">
        {/*
          We loop through the 'allPatterns' array we imported.
          Each 'pattern' object holds the ID, name, component, and text color.
        */}
        {allPatterns.map((pattern) => (
          <div
            key={pattern.id}
            onClick={() => onSelect(pattern.id)}
            className={`
              w-24 h-16 rounded-lg overflow-hidden relative cursor-pointer
              border-2 transition-all duration-200
              ${
                selectedPatternId === pattern.id
                  ? "border-orange-500 ring-2 ring-orange-200"
                  : "border-gray-300"
              }
            `}
          >
            {/*
              We render the pattern component inside this container.
              We use the `component` property from our pattern object.
            */}
            <div className="absolute inset-0 z-0">
              <pattern.component />
            </div>

            {/*
              We add the pattern's name and use the correct text color
              for readability, based on the `textColor` property.
            */}
            <span
              className={`absolute inset-0 flex items-center justify-center font-bold text-xs z-10 ${pattern.textColor}`}
            >
              {pattern.name}
            </span>
          </div>
        ))}
      </div>
    </div>
  );
};

export default PatternSelector;
