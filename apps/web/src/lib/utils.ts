import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isInternalUser(email: string | null | undefined): boolean {
  return (
    !!email?.endsWith("@dealwire.ai") || !!email?.endsWith("@frontstep.ai")
  );
}
