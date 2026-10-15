import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatShortHash(hash: string | null | undefined): string {
  if (!hash) return "-------";
  return hash.slice(0, 7);
}
