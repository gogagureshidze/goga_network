'use client'

import { useFormStatus } from "react-dom";

function UpdateButton() {
     const {pending} = useFormStatus();
  return (
    <div>
      <button
        disabled={pending}
        className="px-4 py-2 text-sm bg-orange-300 hover:bg-rose-300 text-white font-semibold rounded-lg disabled:cursor-not-allowed disabled:bg-gray-300"
      >
       {pending ? "Updating..." : "Update"}
      </button>
    </div>
  );
}

export default UpdateButton