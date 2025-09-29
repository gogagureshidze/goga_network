"use client";
import React, { useState, useEffect } from "react";
import {
  X,
  Plus,
  Sparkles,
  Trash2,
  Flame,
  Heart,
  Star,
  Rocket,
} from "lucide-react";
import { createPollPost } from "@/actions/pollActions";

interface PollPostModalProps {
  isOpen: boolean;
  onClose: () => void;
  userId: string;
}

export default function PollPostModal({
  isOpen,
  onClose,
  userId,
}: PollPostModalProps) {
  const [question, setQuestion] = useState("");
  const [options, setOptions] = useState<string[]>(["", ""]);
  const [focusedInput, setFocusedInput] = useState<number | null>(null);
  const [particles, setParticles] = useState<
    Array<{ id: number; x: number; y: number; icon: number }>
  >([]);
  const [shake, setShake] = useState(false);
  const [hoveredOption, setHoveredOption] = useState<number | null>(null);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const maxOptions = 5;

  useEffect(() => {
    if (isOpen) {
      setParticles([]);
      setQuestion("");
      setOptions(["", ""]);
    }
  }, [isOpen]);

  if (!isOpen) return null;

  const handleOptionChange = (value: string, idx: number) => {
    const newOptions = [...options];
    newOptions[idx] = value;
    setOptions(newOptions);

    if (value.length > 0 && value.length % 5 === 0) {
      createParticle();
    }
  };

  const createParticle = () => {
    const id = Date.now() + Math.random();
    const x = Math.random() * 100;
    const y = Math.random() * 100;
    const icon = Math.floor(Math.random() * 4);
    setParticles((prev) => [...prev, { id, x, y, icon }]);
    setTimeout(() => {
      setParticles((prev) => prev.filter((p) => p.id !== id));
    }, 2000);
  };

  const handleAddOption = () => {
    if (options.length < maxOptions) {
      setOptions([...options, ""]);
      for (let i = 0; i < 3; i++) {
        setTimeout(() => createParticle(), i * 100);
      }
    } else {
      setShake(true);
      setTimeout(() => setShake(false), 500);
    }
  };

  const handleDeleteOption = (idx: number) => {
    if (options.length > 2) {
      const newOptions = options.filter((_, i) => i !== idx);
      setOptions(newOptions);
      for (let i = 0; i < 5; i++) {
        setTimeout(() => createParticle(), i * 50);
      }
    }
  };

  const handleSubmit = async () => {
    const filteredOptions = options.filter((opt) => opt.trim() !== "");

    if (!question.trim() || filteredOptions.length < 2) {
      setShake(true);
      setTimeout(() => setShake(false), 500);
      return;
    }

    setIsSubmitting(true);

    for (let i = 0; i < 20; i++) {
      setTimeout(() => createParticle(), i * 40);
    }

    try {
      const result = await createPollPost({
        userId: userId,
        question: question.trim(),
        options: filteredOptions,
      });

      if (result.error) {
        console.error("Poll creation failed:", result.error);
        alert(`Error: ${result.error}`);
        setIsSubmitting(false);
        setShake(true);
        setTimeout(() => setShake(false), 500);
        return;
      }

      setTimeout(() => {
        onClose();
      }, 800);
    } catch (error) {
      console.error("Network or action error:", error);
      alert("An unexpected error occurred while creating the poll.");
      setShake(true);
      setTimeout(() => setShake(false), 500);
    } finally {
      setIsSubmitting(false);
    }
  };

  const filledOptions = options.filter((opt) => opt.trim() !== "").length;
  const progress = (filledOptions / options.length) * 100;

  const particleIcons = [
    <Heart key="heart" className="w-4 h-4" />,
    <Star key="star" className="w-4 h-4" />,
    <Flame key="flame" className="w-4 h-4" />,
    <Sparkles key="sparkles" className="w-4 h-4" />,
  ];

  return (
    <div className="fixed inset-0 bg-gradient-to-br from-rose-900/60 via-orange-900/50 to-rose-800/60 backdrop-blur-md flex items-center justify-center z-50">
      <div
        className={`bg-gradient-to-br from-rose-50 via-orange-50 to-rose-100 rounded-2xl shadow-2xl w-full max-w-md p-6 relative overflow-hidden border-2 border-orange-300 transform transition-all duration-500 ${
          shake ? "animate-bounce" : ""
        }`}
      >
        {particles.map((particle) => (
          <div
            key={particle.id}
            className="absolute text-orange-500 pointer-events-none animate-ping"
            style={{
              left: `${particle.x}%`,
              top: `${particle.y}%`,
            }}
          >
            {particleIcons[particle.icon]}
          </div>
        ))}

        <div className="absolute top-0 right-0 w-72 h-72 bg-orange-300 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" />
        <div className="absolute bottom-0 left-0 w-72 h-72 bg-rose-400 rounded-full mix-blend-multiply filter blur-3xl opacity-30 animate-pulse" />
        <div className="absolute top-1/2 left-1/2 w-72 h-72 bg-orange-400 rounded-full mix-blend-multiply filter blur-3xl opacity-25 animate-pulse" />

        <button
          type="button"
          onClick={onClose}
          className="absolute top-3 right-3 text-rose-600 hover:text-rose-800 transition-all duration-300 z-10 hover:rotate-180 hover:scale-125 bg-white/80 hover:bg-white rounded-full p-1.5 shadow-md hover:shadow-lg active:scale-95"
          disabled={isSubmitting}
        >
          <X className="w-4 h-4" />
        </button>

        <div className="relative z-10">
          <div className="flex items-center gap-2 mb-4">
            <div className="relative group cursor-pointer">
              <Rocket
                className={`w-6 h-6 text-orange-500 ${
                  isSubmitting ? "animate-spin" : "animate-bounce"
                } group-hover:text-orange-600 transition-colors`}
              />
              <div className="absolute inset-0 bg-orange-400 rounded-full blur-lg opacity-50 animate-pulse group-hover:opacity-70 transition-opacity" />
            </div>
            <h2 className="text-2xl font-black bg-gradient-to-r from-rose-600 via-orange-500 to-rose-700 bg-clip-text text-transparent">
              Create Your Poll
            </h2>
          </div>

          <div className="mb-4 bg-rose-200/50 rounded-full h-1.5 overflow-hidden backdrop-blur-sm border border-orange-300 shadow-inner">
            <div
              className="h-full bg-gradient-to-r from-rose-500 via-orange-500 to-rose-600 transition-all duration-500 ease-out relative overflow-hidden"
              style={{ width: `${progress}%` }}
            >
              <div className="absolute inset-0 bg-white/40 animate-pulse" />
            </div>
          </div>

          <div className="flex flex-col gap-3">
            <div className="relative group">
              <div className="absolute -top-2 left-3 bg-gradient-to-r from-rose-500 to-orange-500 text-white px-2 py-0.5 rounded-full text-[10px] font-bold shadow-md z-10">
                Question
              </div>
              <input
                type="text"
                placeholder="Ask something amazing..."
                value={question}
                onChange={(e) => setQuestion(e.target.value)}
                onFocus={() => setFocusedInput(-1)}
                onBlur={() => setFocusedInput(null)}
                className="w-full pl-3 pr-10 py-2.5 bg-white/90 backdrop-blur-sm border-2 border-orange-300 rounded-xl text-rose-900 placeholder-rose-400 text-sm focus:border-rose-500 focus:outline-none transition-all duration-300 focus:ring-2 focus:ring-rose-300 font-semibold shadow-md"
                disabled={isSubmitting}
              />
              {focusedInput === -1 && (
                <Flame className="absolute right-3 top-1/2 -translate-y-1/2 w-4 h-4 text-orange-500 animate-pulse scale-110" />
              )}
            </div>

            <div className="flex flex-col gap-2 mt-1">
              {options.map((opt, idx) => (
                <div
                  key={idx}
                  className="relative group pl-8"
                  onMouseEnter={() => setHoveredOption(idx)}
                  onMouseLeave={() => setHoveredOption(null)}
                >
                  <div className="absolute left-0 top-1/2 -translate-y-1/2 w-6 h-6 bg-gradient-to-br from-orange-400 to-rose-500 rounded-full flex items-center justify-center text-white text-xs font-black transition-all duration-500 shadow-md group-hover:scale-[1.35] group-hover:rotate-[720deg] group-hover:shadow-rose-600/70 group-hover:shadow-2xl group-hover:bg-gradient-to-bl">
                    {idx + 1}
                  </div>
                  <input
                    type="text"
                    placeholder={`Option ${idx + 1}`}
                    value={opt}
                    onChange={(e) => handleOptionChange(e.target.value, idx)}
                    onFocus={() => setFocusedInput(idx)}
                    onBlur={() => setFocusedInput(null)}
                    className="w-full pl-3 pr-9 py-2.5 bg-white/80 backdrop-blur-sm border-2 border-orange-200 rounded-xl text-rose-900 placeholder-orange-400 text-sm focus:border-orange-500 focus:outline-none transition-all duration-300 focus:ring-2 focus:ring-orange-300 hover:border-orange-300 font-medium shadow-sm"
                    disabled={isSubmitting}
                  />
                  {opt.trim() && (
                    <Heart className="absolute right-9 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-rose-500 animate-pulse fill-rose-500 scale-110" />
                  )}
                  {options.length > 2 && hoveredOption === idx && (
                    <button
                      type="button"
                      onClick={() => handleDeleteOption(idx)}
                      className="absolute right-2 top-1/2 -translate-y-1/2 text-rose-600 hover:text-red-700 transition-all duration-300 bg-rose-100 hover:bg-red-200 rounded-full p-1 active:scale-90 hover:scale-125"
                      disabled={isSubmitting}
                    >
                      <Trash2 className="w-3 h-3" />
                    </button>
                  )}
                </div>
              ))}
            </div>

            {options.length < maxOptions && (
              <button
                type="button"
                onClick={handleAddOption}
                className="flex items-center justify-center gap-2 text-xs bg-gradient-to-r from-orange-400 to-rose-500 text-white font-bold py-2 px-3 rounded-lg transition-all duration-300 hover:scale-110 hover:shadow-xl active:scale-95 group mt-0.5"
                disabled={isSubmitting}
              >
                <Plus className="w-3.5 h-3.5 group-hover:rotate-180 transition-transform duration-500" />
                <span>Add Option</span>
                <Sparkles className="w-3 h-3 group-hover:rotate-12 group-hover:scale-125 transition-all duration-300" />
              </button>
            )}

            <button
              type="button"
              onClick={handleSubmit}
              className="relative bg-gradient-to-r from-rose-500 via-orange-500 to-rose-600 hover:from-rose-600 hover:via-orange-600 hover:to-rose-700 text-white px-5 py-3 rounded-xl font-black text-base transition-all duration-300 hover:scale-110 active:scale-95 mt-2 overflow-hidden group shadow-xl hover:shadow-2xl hover:shadow-rose-500/50 disabled:opacity-50 disabled:scale-100"
              disabled={isSubmitting}
            >
              <span className="relative z-10 flex items-center justify-center gap-2">
                <Rocket className="w-4 h-4 group-hover:-translate-y-2 group-hover:-rotate-45 group-hover:scale-125 transition-all duration-500" />
                {isSubmitting ? "Launching..." : "Launch Your Poll"}
                <Star className="w-4 h-4 group-hover:rotate-[360deg] group-hover:scale-125 transition-all duration-500" />
              </span>
              <div className="absolute inset-0 bg-gradient-to-r from-yellow-300 via-orange-300 to-rose-300 opacity-0 group-hover:opacity-40 transition-opacity duration-300" />
            </button>

            <div className="flex items-center justify-between text-center text-rose-700 text-[10px] font-semibold bg-rose-100/70 rounded-full px-3 py-1.5">
              <span className="flex items-center gap-1">
                <Flame className="w-3 h-3" />
                {filledOptions}/{options.length}
              </span>
              <span>•</span>
              <span className="flex items-center gap-1">
                {question.length} chars
                <Sparkles className="w-3 h-3" />
              </span>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
