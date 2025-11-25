"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";

// Initialize the Gemini API
const genAI = new GoogleGenerativeAI(process.env.GOOGLE_API_KEY!);

interface MediaItem {
  secure_url: string;
  resource_type: "image" | "video";
  format?: string;
}

interface GenerateDescriptionResult {
  success: boolean;
  description?: string;
  error?: string;
}

export async function generateDescription(
  media: MediaItem[]
): Promise<GenerateDescriptionResult> {
  try {
    // Validate input
    if (!media || media.length === 0) {
      return { success: false, error: "No media provided" };
    }

    // Check API key
    if (!process.env.GOOGLE_API_KEY) {
      return { success: false, error: "Google API key not configured" };
    }

    // Use Gemini 2.0 Flash for multimodal content
    const model = genAI.getGenerativeModel({
      model: "models/gemini-2.5-flash",
    });

    // Prepare the prompt parts
    const parts: any[] = [];

    // Add text instruction
    const hasVideo = media.some((m) => m.resource_type === "video");
    const mediaType = hasVideo
      ? "media"
      : media.length > 1
      ? "images"
      : "image";

    parts.push({
      text: `You are a social media caption writer. Analyze this ${mediaType} and write ONE single caption that sounds like a real person posting casually.

RULES:
- Write ONLY the caption text itself - no options, no labels, no markdown, no explanations
- Maximum 2-3 sentences use relatable emojis if appropriate
- Be conversational and natural, like texting a friend and specific to the content
- Don't be overly dramatic or poetic dia
- Don't use excessive emojis (max 1-2 if any)
- Just describe what you see in a chill, authentic way

Example good captions:
- "Best sunset I've seen all year 🌅"
- "Trying out this new cafe downtown and the vibes are immaculate"
- "When the lighting hits just right"

Write the caption NOW:`,
    });
    // Process each media item
    for (const item of media) {
      try {
        if (item.resource_type === "image") {
          // Fetch and convert image to base64
          const base64Data = await fetchMediaAsBase64(item.secure_url);
          const mimeType = getMimeType(item.secure_url, item.format);

          parts.push({
            inlineData: {
              mimeType,
              data: base64Data,
            },
          });
        } else if (item.resource_type === "video") {
          // Gemini doesn't support video in this model yet
          parts.push({
            text: `[Video content included - unable to analyze video frames]`,
          });
        }
      } catch (err) {
        console.error(`Failed to process media item:`, err);
      }
    }

    // Generate content
    const result = await model.generateContent({
      contents: [{ role: "user", parts }],
    });

    const response = await result.response;
    const description = response.text();

    if (!description) {
      return { success: false, error: "No description generated" };
    }

    return {
      success: true,
      description: description.trim(),
    };
  } catch (error: any) {
    console.error("Error generating description:", error);

    // Handle specific error types
    if (error.message?.includes("API key")) {
      return { success: false, error: "Invalid API key" };
    }

    if (error.message?.includes("quota")) {
      return {
        success: false,
        error: "API quota exceeded 429. Please try again later.",
      };
    }

    return {
      success: false,
      error: error.message || "Failed to generate description",
    };
  }
}

/**
 convert to base64
 */
async function fetchMediaAsBase64(url: string): Promise<string> {
  try {
    const response = await fetch(url);

    if (!response.ok) {
      throw new Error(`Failed to fetch media: ${response.statusText}`);
    }

    const arrayBuffer = await response.arrayBuffer();
    const buffer = Buffer.from(arrayBuffer);
    return buffer.toString("base64");
  } catch (error) {
    console.error("Error fetching media:", error);
    throw new Error("Failed to fetch media from URL");
  }
}

/**
 * Determine MIME type from URL and format
 */
function getMimeType(url: string, format?: string): string {
  // If format is provided, use it
  if (format) {
    const formatMap: Record<string, string> = {
      jpg: "image/jpeg",
      jpeg: "image/jpeg",
      png: "image/png",
      gif: "image/gif",
      webp: "image/webp",
    };
    return formatMap[format.toLowerCase()] || "image/jpeg";
  }

  // Otherwise, try to determine from URL extension
  const extension = url.split(".").pop()?.toLowerCase();
  const extensionMap: Record<string, string> = {
    jpg: "image/jpeg",
    jpeg: "image/jpeg",
    png: "image/png",
    gif: "image/gif",
    webp: "image/webp",
  };
  return extensionMap[extension || ""] || "image/jpeg";
}
