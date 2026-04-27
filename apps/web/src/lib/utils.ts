import { type ClassValue, clsx } from "clsx";
import { twMerge } from "tailwind-merge";

const ADMIN_EMAILS = ["isaac@dealwire.ai", "noah@dealwire.ai"];

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isInternalUser(email: string | null | undefined): boolean {
  return !!email?.endsWith("@dealwire.ai");
}

export function isAdminUser(email: string | null | undefined): boolean {
  if (!email) return false;
  return ADMIN_EMAILS.includes(email.toLowerCase());
}
