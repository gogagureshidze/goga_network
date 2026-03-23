"use server";
import prisma from "@/lib/client";
import { z } from "zod";
import { currentUser } from "@clerk/nextjs/server";
import { revalidateTag } from "next/cache";

async function UpdateProfile(
  formData: FormData,
  cover?: string,
  bioPattern?: string
) {
  const user = await currentUser();
  if (!user) throw new Error("Error getting current user");
  const currentUserId = user.id;

  const fields = Object.fromEntries(formData.entries());

  const filteredFields = Object.fromEntries(
    Object.entries(fields).filter(([_, value]) => value !== "")
  );

  console.log(cover);

  if (cover) {
    filteredFields.cover = cover;
  }
  // << NEW CODE >>
  if (bioPattern) {
    filteredFields.bioPattern = bioPattern;
  }

const Profile = z.object({
  // Add .trim() to all your string inputs!
  name: z.string().trim().optional(),
  surname: z.string().trim().optional(),
  description: z.string().trim().optional(),
  city: z.string().trim().optional(),
  school: z.string().trim().optional(),
  work: z.string().trim().optional(),
  website: z.string().trim().optional(), // This stops the infinite space issue!
  cover: z.string().optional(),
  bioPattern: z.string().optional(),
});

  const validatedFields = Profile.safeParse(filteredFields);
  console.log(validatedFields);
  if (!validatedFields.success) {
    console.log(validatedFields.error.flatten().fieldErrors);
    return;
  }

try {
  await prisma.user.update({
    where: { id: currentUserId },
    data: validatedFields.data,
  });
  // @ts-ignore
  revalidateTag("user-profile");
} catch (error) {
  console.log("Database update error:", error);
  // YOU MUST THROW THE ERROR HERE so the frontend catches it
  throw new Error(
    "Failed to update profile. You might have exceeded the character limit.",
  );
}
}

export default UpdateProfile;
