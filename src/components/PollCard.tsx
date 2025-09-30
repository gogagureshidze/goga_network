"use client";

import React, { useState, useOptimistic } from "react";
import {
  BarChart3,
  Clock,
  CheckCircle2,
  TrendingUp,
  Users,
  AlertCircle,
} from "lucide-react";
import { castPollVote } from "@/actions/pollActions";
import { useUser } from "@clerk/nextjs";

interface PollOption {
  id: number;
  text: string;
  _count: {
    votes: number;
  };
  votes?: Array<{
    userId: string;
    user?: { avatar?: string; username?: string };
  }>;
}

interface Poll {
  id: number;
  expiresAt: Date;
  options: PollOption[];
}

interface PollCardProps {
  poll: Poll;
}

export default function PollCard({ poll }: PollCardProps) {
  const { user } = useUser();
  const [isVoting, setIsVoting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [showVoters, setShowVoters] = useState<number | null>(null);

  const totalVotes = poll.options.reduce(
    (sum, option) => sum + option._count.votes,
    0
  );

  const userVote = poll.options
    .flatMap(
      (option) =>
        option.votes?.map((v) => ({ ...v, optionId: option.id })) ?? []
    )
    .find((v) => v.userId === user?.id);
  const hasVoted = !!userVote;

  const isExpired = new Date(poll.expiresAt) < new Date();
  const timeLeft = new Date(poll.expiresAt).getTime() - new Date().getTime();
  const hoursLeft = Math.floor(timeLeft / (1000 * 60 * 60));
  const minutesLeft = Math.floor((timeLeft % (1000 * 60 * 60)) / (1000 * 60));

  const [optimisticVote, setOptimisticVote] = useOptimistic(
    userVote?.optionId ?? null,
    (state, newVote: number | null) => newVote
  );

  const handleVote = async (optionId: number) => {
    if (hasVoted || isExpired || !user) return;

    setIsVoting(true);
    setError(null);
    setOptimisticVote(optionId);

    try {
      const result = await castPollVote({
        userId: user.id,
        pollId: poll.id,
        optionId,
      });

      if (result.error) {
        setError(result.error);
        setOptimisticVote(null);
      }
    } catch (err) {
      setError("Failed to cast vote. Please try again.");
      setOptimisticVote(null);
    } finally {
      setIsVoting(false);
    }
  };

  const getBarColor = (index: number) => {
    const colors = [
      "from-rose-500 to-orange-500",
      "from-orange-500 to-amber-500",
      "from-amber-500 to-yellow-500",
      "from-rose-400 to-pink-500",
      "from-orange-400 to-rose-400",
    ];
    return colors[index % colors.length];
  };

  return (
    <div className="bg-gradient-to-br from-rose-50 via-orange-50 to-amber-50 rounded-2xl p-5 border-2 border-orange-200 shadow-lg">
      {/* Header */}
      <div className="flex items-center justify-between mb-6">
        <div className="flex items-center gap-2">
          <BarChart3 className="w-7 h-7 text-orange-600" />
          <span className="font-bold text-rose-900 text-xl">Poll</span>
        </div>

        {isExpired ? (
          <div className="flex items-center gap-1 px-3 py-1 bg-gray-200 rounded-full">
            <Clock className="w-3 h-3 text-gray-600" />
            <span className="text-xs font-semibold text-gray-700">Ended</span>
          </div>
        ) : (
          <div className="flex items-center gap-1 px-3 py-1 bg-gradient-to-r from-rose-500 to-orange-500 rounded-full animate-pulse">
            <Clock className="w-3 h-3 text-white" />
            <span className="text-xs font-semibold text-white">
              {hoursLeft}h {minutesLeft}m left
            </span>
          </div>
        )}
      </div>

      {/* Warning Message */}
      {!hasVoted && !isExpired && user && (
        <div className="mb-3 p-3 bg-amber-100 border-2 border-amber-300 rounded-xl flex items-start gap-2">
          <AlertCircle className="w-4 h-4 text-amber-700 flex-shrink-0 mt-0.5" />
          <p className="text-xs text-amber-800 font-semibold">
            Choose wisely! You can only vote once and cannot change your vote.
          </p>
        </div>
      )}

      {/* Options */}
      <div className="flex flex-col gap-3">
        {poll.options.map((option, index) => {
          const percentage =
            totalVotes > 0 ? (option._count.votes / totalVotes) * 100 : 0;
          const isSelected =
            hasVoted || optimisticVote
              ? (optimisticVote || userVote?.optionId) === option.id
              : false;
          const isLeading =
            totalVotes > 0 &&
            option._count.votes ===
              Math.max(...poll.options.map((o) => o._count.votes));

          return (
            <div key={option.id} className="flex flex-col gap-2">
              <button
                onClick={() => handleVote(option.id)}
                disabled={hasVoted || isExpired || isVoting || !user}
                className={`relative overflow-hidden rounded-xl border-2 transition-all duration-300 ${
                  isSelected
                    ? "border-rose-500 shadow-lg scale-105"
                    : hasVoted || isExpired
                    ? "border-orange-200"
                    : "border-orange-300 hover:border-rose-400 hover:scale-102 hover:shadow-md active:scale-98"
                } ${
                  !hasVoted && !isExpired && user
                    ? "cursor-pointer"
                    : "cursor-default"
                }`}
              >
                {(hasVoted || isExpired) && (
                  <div
                    className={`absolute inset-0 bg-gradient-to-r ${getBarColor(
                      index
                    )} opacity-20 transition-all duration-1000 ease-out`}
                    style={{ width: `${percentage}%` }}
                  />
                )}

                <div className="relative px-4 py-3 flex items-center justify-between">
                  <div className="flex items-center gap-2 flex-1">
                    {isSelected && (
                      <CheckCircle2 className="w-5 h-5 text-rose-600 animate-bounce" />
                    )}
                    {isLeading && (hasVoted || isExpired) && totalVotes > 0 && (
                      <TrendingUp className="w-4 h-4 text-orange-600 animate-pulse" />
                    )}
                    <span
                      className={`font-semibold text-sm ${
                        isSelected ? "text-rose-900" : "text-gray-800"
                      }`}
                    >
                      {option.text}
                    </span>
                  </div>

                  {(hasVoted || isExpired) && (
                    <div className="flex items-center gap-2">
                      <span className="text-xs font-bold text-gray-600">
                        {option._count.votes}
                      </span>
                      <span className="text-sm font-black text-rose-700 min-w-[45px] text-right">
                        {percentage.toFixed(1)}%
                      </span>
                    </div>
                  )}
                </div>
              </button>

              {/* Show voters button */}
              {(hasVoted || isExpired) && option._count.votes > 0 && (
                <button
                  onClick={() =>
                    setShowVoters(showVoters === option.id ? null : option.id)
                  }
                  className="flex items-center gap-1 text-xs text-rose-700 hover:text-rose-900 font-semibold transition-colors ml-4"
                >
                  <Users className="w-3 h-3" />
                  {showVoters === option.id ? "Hide" : "Show"} voters (
                  {option._count.votes})
                </button>
              )}

              {/* Voters list */}
              {showVoters === option.id &&
                option.votes &&
                option.votes.length > 0 && (
                  <div className="ml-4 p-3 bg-white/80 rounded-lg border border-orange-200 max-h-40 overflow-y-auto">
                    <div className="flex flex-col gap-2">
                      {option.votes.map((vote, idx) => (
                        <div key={idx} className="flex items-center gap-2">
                          <div className="w-6 h-6 bg-gradient-to-br from-orange-400 to-rose-500 rounded-full flex items-center justify-center text-white text-xs font-bold">
                            {vote.user?.username?.[0]?.toUpperCase() || "?"}
                          </div>
                          <span className="text-xs font-medium text-gray-700">
                            {vote.user?.username || "Anonymous"}
                          </span>
                          {vote.userId === user?.id && (
                            <span className="text-xs text-rose-600 font-bold">
                              (You)
                            </span>
                          )}
                        </div>
                      ))}
                    </div>
                  </div>
                )}
            </div>
          );
        })}
      </div>

      {/* Footer */}
      <div className="mt-4 pt-3 border-t-2 border-orange-200/50 flex items-center justify-between">
        <div className="flex items-center gap-2">
          <div className="w-2 h-2 bg-gradient-to-r from-rose-500 to-orange-500 rounded-full animate-pulse" />
          <span className="text-xs font-semibold text-gray-700">
            {totalVotes} {totalVotes === 1 ? "vote" : "votes"}
          </span>
        </div>

        {hasVoted && !isExpired && (
          <div className="flex items-center gap-1 px-2 py-1 bg-green-100 rounded-full">
            <CheckCircle2 className="w-3 h-3 text-green-600" />
            <span className="text-xs font-bold text-green-700">Voted!</span>
          </div>
        )}
      </div>

      {error && (
        <div className="mt-3 p-2 bg-red-100 border border-red-300 rounded-lg">
          <p className="text-xs text-red-700 font-medium">{error}</p>
        </div>
      )}

      {!user && !hasVoted && !isExpired && (
        <div className="mt-3 p-2 bg-orange-100 border border-orange-300 rounded-lg">
          <p className="text-xs text-orange-700 font-medium text-center">
            Log in to vote!
          </p>
        </div>
      )}
    </div>
  );
}
