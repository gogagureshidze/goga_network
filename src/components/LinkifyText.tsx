"use client";
import Link from "next/link";

interface LinkifyTextProps {
  text: string;
  validUsernames: string[]; // Array of valid usernames from database
  className?: string;
  linkClassName?: string;
  mentionClassName?: string;
  invalidMentionClassName?: string;
}

export default function LinkifyText({
  text,
  validUsernames,
  className = "",
  linkClassName = "text-orange-500 hover:text-orange-700 underline",
  mentionClassName = "text-rose-500 hover:text-rose-700 font-medium cursor-pointer",
  invalidMentionClassName = "text-gray-400 font-medium cursor-not-allowed",
}: LinkifyTextProps) {
  const validUsernamesSet = new Set(validUsernames);

  const parseText = () => {
    // URL regex pattern
    const urlPattern =
      /(https?:\/\/[^\s]+|www\.[^\s]+|[a-zA-Z0-9-]+\.[a-zA-Z]{2,}[^\s]*)/g;

    // Mention pattern
    const mentionPattern = /@([\w_]+)/g;

    // Combine patterns
    const combinedPattern = new RegExp(
      `(${urlPattern.source}|${mentionPattern.source})`,
      "g"
    );

    const parts = [];
    let lastIndex = 0;
    let match;

    while ((match = combinedPattern.exec(text)) !== null) {
      // Add text before the match
      if (match.index > lastIndex) {
        parts.push({
          type: "text",
          content: text.slice(lastIndex, match.index),
        });
      }

      const matchedText = match[0];

      // Check if it's a mention
      if (matchedText.startsWith("@")) {
        const username = matchedText.slice(1);
        const isValid = validUsernamesSet.has(username);

        parts.push({
          type: "mention",
          content: matchedText,
          username: username,
          isValid: isValid,
        });
      }
      // Check if it's a URL
      else {
        // Ensure URL has protocol
        let url = matchedText;
        if (!url.match(/^https?:\/\//)) {
          url = "https://" + url;
        }

        // Extract clean display text
        let displayText = matchedText;
        try {
          const urlObj = new URL(url);
          const domain = urlObj.hostname.replace(/^www\./, "");
          const path = urlObj.pathname;

          if (path && path !== "/" && path.length < 20) {
            displayText = domain + path;
          } else {
            displayText = domain;
          }
        } catch (e) {
          displayText = matchedText;
        }

        parts.push({
          type: "url",
          content: displayText,
          url: url,
        });
      }

      lastIndex = match.index + matchedText.length;
    }

    // Add remaining text
    if (lastIndex < text.length) {
      parts.push({
        type: "text",
        content: text.slice(lastIndex),
      });
    }

    return parts;
  };

  const parts = parseText();

  return (
    <span className={className}>
      {parts.map((part, index) => {
        if (part.type === "url") {
          return (
            <a
              key={index}
              href={part.url}
              target="_blank"
              rel="noopener noreferrer"
              className={linkClassName}
              onClick={(e) => e.stopPropagation()}
            >
              {part.content}
            </a>
          );
        } else if (part.type === "mention") {
          if (part.isValid) {
            return (
              <Link
                key={index}
                href={`/profile/${part.username}`}
                className={mentionClassName}
                onClick={(e) => e.stopPropagation()}
              >
                {part.content}
              </Link>
            );
          } else {
            return (
              <span
                key={index}
                className={invalidMentionClassName}
                title="User not found"
              >
                {part.content}
              </span>
            );
          }
        } else {
          return <span key={index}>{part.content}</span>;
        }
      })}
    </span>
  );
}
