import Image from "next/image";
import { Friend } from "../page";

interface ChatWindowProps {
  friend: Friend | null;
  onBack: () => void;
}

export default function ChatWindow({ friend, onBack }: ChatWindowProps) {
  if (!friend) {
    return (
      <div className="flex items-center justify-center h-full text-gray-500">
        <p>Select a friend to start chatting!</p>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Chat header */}
      <div className="flex items-center p-4 bg-white border-b border-gray-200">
        <button onClick={onBack} className="md:hidden mr-2 text-gray-600">
          {/* Back icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M15 19l-7-7 7-7"
            />
          </svg>
        </button>
        <Image
          src={friend.avatar}
          alt={friend.name}
          width={40}
          height={40}
          className="rounded-full mr-4"
        />
        <span className="font-semibold text-gray-800">{friend.name}</span>
      </div>

      {/* Chat messages area */}
      <div className="flex-1 p-4 overflow-y-auto">
        {/* Dummy chat messages will go here */}
        <div className="bg-gray-200 p-3 rounded-lg my-2 w-fit">
          Hey, how are you?
        </div>
        <div className="bg-blue-200 p-3 rounded-lg my-2 w-fit ml-auto">
          I'm good, thanks!
        </div>
      </div>

      {/* Message input field */}
      <div className="p-4 bg-white border-t border-gray-200 flex items-center">
        <input
          type="text"
          placeholder="Type a message..."
          className="flex-1 p-3 rounded-full bg-gray-100 border border-transparent focus:border-blue-500 focus:outline-none"
        />
        <button className="ml-4 p-3 rounded-full bg-blue-500 text-white hover:bg-blue-600 transition-colors">
          {/* Send icon */}
          <svg
            xmlns="http://www.w3.org/2000/svg"
            className="h-6 w-6"
            fill="none"
            viewBox="0 0 24 24"
            stroke="currentColor"
          >
            <path
              strokeLinecap="round"
              strokeLinejoin="round"
              strokeWidth={2}
              d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
            />
          </svg>
        </button>
      </div>
    </div>
  );
}
