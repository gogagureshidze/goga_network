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
    name: z.string().optional(),
    surname: z.string().optional(),
    description: z.string().optional(),
    city: z.string().optional(),
    school: z.string().optional(),
    work: z.string().optional(),
    website: z.string().optional(),
    cover: z.string().optional(),
    // << NEW CODE >>
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
    // Revalidating the user tag is crucial for a smooth UI update.
    revalidateTag("user-profile");
  } catch (error) {
    console.log(error);
  }
}

export default UpdateProfile;
