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

const ADMIN_EMAILS = [
  "imlevine@outlook.com",
  "isaac@dealwire.ai",
  "isaac@frontstep.ai",
  "noahweinstein345@outlook.com",
  "noah@dealwire.ai",
  "noah@frontstep.ai",
];

export function isAdminUser(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
