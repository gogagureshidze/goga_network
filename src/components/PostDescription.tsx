// components/PostDescription.tsx
"use client";

import Link from "next/link";

interface PostDescriptionProps {
  text: string;
  taggedUsernames: string[];
}

export default function PostDescription({
  text,
  taggedUsernames,
}: PostDescriptionProps) {
  // Find all @mentions in text
  const mentionRegex = /@(\w+)/g;
  const parts: React.ReactNode[] = [];
  const validUsernamesSet = new Set(taggedUsernames);

  let lastIndex = 0;
  let key = 0;
  const matches = Array.from(text.matchAll(mentionRegex));

  for (const match of matches) {
    const username = match[1];
    const matchIndex = match.index!;

    // Add normal text before the @mention
    if (matchIndex > lastIndex) {
      parts.push(
        <span
          key={`text-${key++}`}
          className="text-gray-800 dark:text-gray-200"
        >
          {text.substring(lastIndex, matchIndex)}
        </span>
      );
    }

    // Check if this username is valid (user follows them)
    if (validUsernamesSet.has(username)) {
      // Valid tag - make it orange and clickable
      parts.push(
        <Link
          key={`link-${key++}`}
          href={`/profile/${username}`}
          className="text-orange-500 dark:text-orange-400 hover:text-orange-600 dark:hover:text-orange-300 font-semibold hover:underline transition-colors"
          onClick={(e) => e.stopPropagation()}
        >
          @{username}
        </Link>
      );
    } else {
      // Invalid tag - show in gray, not clickable
      parts.push(
        <span
          key={`invalid-${key++}`}
          className="text-gray-500 dark:text-gray-500"
        >
          @{username}
        </span>
      );
    }

    lastIndex = matchIndex + match[0].length;
  }

  // Add remaining text after last mention
  if (lastIndex < text.length) {
    parts.push(
      <span key={`text-${key++}`} className="text-gray-800 dark:text-gray-200">
        {text.substring(lastIndex)}
      </span>
    );
  }

  return (
    <p className="text-sm leading-relaxed px-1 transition-colors">
      {parts.length > 0 ? (
        parts
      ) : (
        <span className="text-gray-800 dark:text-gray-200">{text}</span>
      )}
    </p>
  );
}
