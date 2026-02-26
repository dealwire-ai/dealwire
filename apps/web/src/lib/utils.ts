import { type ClassValue, clsx } from 'clsx';
import { twMerge } from 'tailwind-merge';

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function isFrontstepUser(email: string | null | undefined): boolean {
  return !!email?.endsWith('@frontstep.ai');
}
