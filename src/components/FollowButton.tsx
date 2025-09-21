// "use client";

// import { switchFollow } from "@/actions/switchFollow";
// import { useState, useTransition } from "react";

// function FollowButton({
//   userId,
//   isFollowing,
//   isFollowingSent,
//   onChange, // optional callback to notify parent of state change
// }: {
//   userId: string;
//   isFollowing: boolean;
//   isFollowingSent: boolean;
//   onChange?: (state: {
//     following: boolean;
//     followRequestSent: boolean;
//   }) => void;
// }) {
//   const [pending, startTransition] = useTransition();
//   const [state, setState] = useState({
//     following: isFollowing,
//     followRequestSent: isFollowingSent,
//   });

//   const handleClick = () => {
//     // Optimistically update the UI immediately
//     const newState =
//       state.following || state.followRequestSent
//         ? { following: false, followRequestSent: false }
//         : { following: false, followRequestSent: true };

//     setState(newState);
//     if (onChange) onChange(newState);

//     // Fire the server action
//     startTransition(async () => {
//       try {
//         await switchFollow(userId);
//         // Optionally you can re-fetch parent data here to sync counts
//       } catch (err) {
//         console.error("Follow action failed:", err);
//         // Revert optimistic update if needed
//         setState({
//           following: isFollowing,
//           followRequestSent: isFollowingSent,
//         });
//         if (onChange)
//           onChange({
//             following: isFollowing,
//             followRequestSent: isFollowingSent,
//           });
//       }
//     });
//   };

//   return (
//     <div className="w-full flex justify-center lg:justify-start">
//       <button
//         onClick={handleClick}
//         disabled={pending}
//         className={`w-[80%] font-semibold text-sm px-4 py-2 rounded-lg shadow-sm transition-all duration-200 disabled:opacity-70 disabled:cursor-not-allowed
//           ${
//             state.following
//               ? "bg-gray-200 text-gray-700 hover:bg-gray-300"
//               : state.followRequestSent
//               ? "bg-rose-200 text-rose-700 hover:bg-rose-300"
//               : "bg-orange-400 text-white hover:bg-orange-500"
//           }`}
//       >
//         {pending ? (
//           <span className="flex items-center justify-center gap-2">
//             <svg className="animate-spin h-4 w-4" viewBox="0 0 24 24">
//               <circle
//                 className="opacity-25"
//                 cx="12"
//                 cy="12"
//                 r="10"
//                 stroke="currentColor"
//                 strokeWidth="4"
//                 fill="none"
//               />
//               <path
//                 className="opacity-75"
//                 fill="currentColor"
//                 d="M4 12a8 8 0 018-8V0C5.373 0 0 5.373 0 12h4zm2 5.291A7.962 7.962 0 014 12H0c0 3.042 1.135 5.824 3 7.938l3-2.647z"
//               />
//             </svg>
//             Loading...
//           </span>
//         ) : state.following ? (
//           "Unfollow"
//         ) : state.followRequestSent ? (
//           "Requested"
//         ) : (
//           "Foldlow"
//         )}
//       </button>
//     </div>
//   );
// }

// export default FollowButton;
