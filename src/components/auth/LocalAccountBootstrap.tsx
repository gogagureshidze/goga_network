"use client";

import { createContext, useContext, type ReactNode } from "react";

const LocalAccountBootstrapContext = createContext<{ required: boolean; readyUserId: string | null }>({ required: false, readyUserId: null });

/** The server supplies readiness only after awaiting the verified local mirror. */
export function LocalAccountBootstrap({ required, readyUserId, children }: {
  required: boolean;
  readyUserId: string | null;
  children: ReactNode;
}) {
  return <LocalAccountBootstrapContext.Provider value={{ required, readyUserId }}>{children}</LocalAccountBootstrapContext.Provider>;
}

export function useLocalAccountReady(userId: string | null | undefined) {
  const { required, readyUserId } = useContext(LocalAccountBootstrapContext);
  return !required || Boolean(userId && userId === readyUserId);
}
