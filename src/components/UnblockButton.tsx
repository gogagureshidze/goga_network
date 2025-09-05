"use client";

import { useOptimistic, useState } from "react";
import { switchBlock } from "../actions/block";
import { useRouter } from "next/navigation"; // <-- NEW IMPORT

function UnblockButton({ userId }: { userId: string }) {
  const router = useRouter(); // <-- INITIALIZE ROUTER

  const [unblocked, setUnblocked] = useState(false);
  const [optimisticUnblocked, toggleOptimistic] = useOptimistic(
    unblocked,
    (state) => !state
  );

  const handleUnblock = async () => {
    toggleOptimistic(true);
    await switchBlock(userId);
    setUnblocked(true); // Persist the state change
    router.refresh(); // <-- ADDED ROUTER REFRESH
  };

  if (optimisticUnblocked) {
    return null; // Hide the button immediately after clicking
  }

  return (
    <button
      onClick={handleUnblock}
      className="bg-red-500 text-white text-sm rounded-md p-2 w-full"
    >
      Unblock
    </button>
  );
}

export default UnblockButton;
