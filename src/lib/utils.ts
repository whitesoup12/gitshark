import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatShortHash(hash: string | null | undefined): string {
  if (!hash) return "-------";
  return hash.slice(0, 7);
}

export function formatRelativeTime(timestamp: number): string {
  if (!timestamp) return "";
  const now = Math.floor(Date.now() / 1000);
  const diff = Math.max(0, now - timestamp);

  if (diff < 60) return "just now";
  if (diff < 3600) return `${Math.floor(diff / 60)}m ago`;
  if (diff < 86400) return `${Math.floor(diff / 3600)}h ago`;
  if (diff < 2592000) return `${Math.floor(diff / 86400)}d ago`;
  if (diff < 31536000) return `${Math.floor(diff / 2592000)}mo ago`;
  return `${Math.floor(diff / 31536000)}y ago`;
}
