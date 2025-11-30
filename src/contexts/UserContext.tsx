"use client";

import {
  createContext,
  useContext,
  useState,
  useEffect,
  ReactNode,
  useCallback,
} from "react";
import { useUser } from "@clerk/nextjs";
import { getUserData } from "@/actions/getUserData";

type UserData = {
  id: string;
  username?: string;
  name?: string;
  surname?: string;
  avatar?: string;
  cover?: string;
  description?: string;
  city?: string;
  school?: string;
  work?: string;
  website?: string;
  showActivityStatus?: boolean;
  bioPattern?: string;
  isPrivate: boolean;
  allowStoryComments?: boolean;
  showStoryLikes?: boolean;
};

type UserContextType = {
  userData: UserData | null;
  refreshUser: () => Promise<void>;
  isLoading: boolean;
};

const UserContext = createContext<UserContextType | undefined>(undefined);

export function UserProvider({ children }: { children: ReactNode }) {
  const { user, isLoaded } = useUser();
  const [userData, setUserData] = useState<UserData | null>(null);
  const [isLoading, setIsLoading] = useState(true);

  const mapDbUserToUserData = (dbUser: any): UserData => ({
    id: dbUser.id,
    username: dbUser.username ?? undefined,
    name: dbUser.name ?? undefined,
    surname: dbUser.surname ?? undefined,
    avatar: dbUser.avatar ?? undefined,
    cover: dbUser.cover ?? undefined,
    description: dbUser.description ?? undefined,
    city: dbUser.city ?? undefined,
    school: dbUser.school ?? undefined,
    work: dbUser.work ?? undefined,
    website: dbUser.website ?? undefined,
    showActivityStatus: dbUser.showActivityStatus ?? undefined,
    bioPattern: dbUser.bioPattern ?? undefined,
    isPrivate: dbUser.isPrivate,
    allowStoryComments: dbUser.allowStoryComments ?? undefined,
    showStoryLikes: dbUser.showStoryLikes ?? undefined,
  });

  const fetchUserData = useCallback(async () => {
    if (!isLoaded) return;

    if (!user) {
      setUserData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const dbUser = await getUserData();
      if (dbUser) {
        setUserData(mapDbUserToUserData(dbUser));
      } else {
        setUserData(null);
      }
    } catch (err) {
      console.error("Failed to fetch user data from Server Action:", err);
      setUserData(null);
    } finally {
      setIsLoading(false);
    }
  }, [user, isLoaded]);

  useEffect(() => {
    fetchUserData();
  }, [fetchUserData]);

  const refreshUser = async () => {
    console.log("Context: Refreshing user data...");
    await fetchUserData();
  };

  return (
    <UserContext.Provider value={{ userData, refreshUser, isLoading }}>
      {children}
    </UserContext.Provider>
  );
}

export function useUserContext() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUserContext must be used within a UserProvider");
  }
  return context;
}
