"use server";

import { GoogleGenerativeAI } from "@google/generative-ai";
import { auth } from "@clerk/nextjs/server";
import { fetchCaptionImage, validateCaptionMediaUrl } from "@/lib/caption-media";

const captionRequests = new Map<string, number>();

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
    const { userId } = await auth();
    if (!userId) return { success: false, error: "Not authenticated" };
    const now = Date.now();
    for (const [key, expiry] of captionRequests) if (expiry <= now) captionRequests.delete(key);
    if (captionRequests.has(userId) || captionRequests.size >= 10_000) return { success: false, error: "Please wait before generating another caption" };
    // Validate input
    if (!Array.isArray(media) || media.length === 0 || media.length > 4 || media.some((item) => !item || !["image", "video"].includes(item.resource_type) || typeof item.secure_url !== "string")) {
      return { success: false, error: "Provide between 1 and 4 media items" };
    }
    for (const item of media) if (item.resource_type === "image") validateCaptionMediaUrl(item.secure_url);
    captionRequests.set(userId, now + 30_000);

    // Check API key
    if (!process.env.GOOGLE_API_KEY) {
      return { success: false, error: "Google API key not configured" };
    }

    // Use Gemini 2.0 Flash for multimodal content
    const model = genAI.getGenerativeModel({
      model: "models/gemini-2.5-flash",
    }, { timeout: 30_000 });

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
          parts.push({
            inlineData: await fetchCaptionImage(item.secure_url),
          });
        } else if (item.resource_type === "video") {
          // Gemini doesn't support video in this model yet
          parts.push({
            text: `[Video content included - unable to analyze video frames]`,
          });
        }
      } catch (err) {
        return { success: false, error: "Could not load media. Images must be supported uploads under 5 MB." };
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
      error: "Failed to generate description",
    };
  }
}
