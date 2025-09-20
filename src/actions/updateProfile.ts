"use server";

import prisma from "@/lib/client";
import { z } from "zod";
import { currentUser } from "@clerk/nextjs/server";
import { revalidateTag } from "next/cache";

async function UpdateProfile(formData: FormData, cover?: string) {
  const user = await currentUser();
  if (!user) throw new Error("Error getting current user");
  const currentUserId = user.id;

  // Convert formData to object
  const fields = Object.fromEntries(formData.entries());

  // Filter out empty fields
  const filteredFields = Object.fromEntries(
    Object.entries(fields).filter(([_, value]) => value !== "")
  );

  // Add cover if provided
  if (cover) {
    filteredFields.cover = cover;
  }

  // Zod schema
  const Profile = z.object({
    name: z.string().optional(),
    surname: z.string().optional(),
    description: z.string().optional(),
    city: z.string().optional(),
    school: z.string().optional(),
    work: z.string().optional(),
    website: z.string().optional(),
    cover: z.string().optional(),
  });

  const validatedFields = Profile.safeParse(filteredFields);

  if (!validatedFields.success) {
    console.log(validatedFields.error.flatten().fieldErrors);
    return; // stop if validation fails
  }

  try {
    await prisma.user.update({
      where: { id: currentUserId },
      data: validatedFields.data,
    });

    // 🔥 Invalidate the cached user so profile shows fresh data instantly
    revalidateTag("user-profile");
  } catch (error) {
    console.log(error);
  }
}

export default UpdateProfile;
