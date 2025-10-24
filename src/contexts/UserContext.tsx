// contexts/UserContext.tsx

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

// ... (Your UserData type is fine)
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

  // Define the fetching function
  const fetchUserData = useCallback(async () => {
    // 1. Don't fetch anything until Clerk is fully loaded
    if (!isLoaded) {
      return;
    }

    // 2. If Clerk is loaded but there's no user, they are logged out.
    if (!user) {
      setUserData(null);
      setIsLoading(false);
      return;
    }

    setIsLoading(true);
    try {
      const dbUser = await getUserData(); 
      if (dbUser) {
        setUserData(dbUser);
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

  // Manual refresh function
  const refreshUser = async () => {
    console.log("Context: Refreshing user data...");
    await fetchUserData();
  };

  const value = {
    userData,
    refreshUser,
    isLoading,
  };

  return <UserContext.Provider value={value}>{children}</UserContext.Provider>;
}

export function useUserContext() {
  const context = useContext(UserContext);
  if (context === undefined) {
    throw new Error("useUserContext must be used within a UserProvider");
  }
  return context;
}
