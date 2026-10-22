"use client";

import { createContext, useContext, useEffect, useState } from "react";

type TitleState = { title?: string; back?: string } | null;
const Ctx = createContext<{ value: TitleState; set: (v: TitleState) => void }>({ value: null, set: () => {} });

export function PageTitleProvider({ children }: { children: React.ReactNode }) {
  const [value, set] = useState<TitleState>(null);
  return <Ctx value={{ value, set }}>{children}</Ctx>;
}

export function usePageTitle() {
  return useContext(Ctx).value;
}

/** Lets a page give the phone top bar a specific title (e.g. the company name) and back link. */
export function PhoneTitle({ title, back }: { title: string; back?: string }) {
  const { set } = useContext(Ctx);
  useEffect(() => {
    set({ title, back });
    return () => set(null);
  }, [title, back, set]);
  return null;
}
