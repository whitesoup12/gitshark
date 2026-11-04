import { create } from "zustand";
import React from "react";

export type DialogVariant = "danger" | "warning" | "info" | "success" | "error";

export interface AlertOptions {
  title: string;
  message: React.ReactNode | string;
  variant?: DialogVariant;
  confirmText?: string;
}

export interface ConfirmOptions {
  title: string;
  message: React.ReactNode | string;
  variant?: DialogVariant;
  confirmText?: string;
  cancelText?: string;
}

export interface PromptOptions {
  title: string;
  message: React.ReactNode | string;
  defaultValue?: string;
  placeholder?: string;
  confirmText?: string;
  cancelText?: string;
}

export type HookDecision = "run" | "skip" | "cancel";

export interface HookConfirmOptions {
  action: "commit" | "push";
  hookNames: string[];
}

interface DialogState {
  isOpen: boolean;
  type: "alert" | "confirm" | "prompt" | "hook-confirm";
  title: string;
  message: React.ReactNode | string;
  variant: DialogVariant;
  confirmText: string;
  cancelText: string;
  promptValue: string;
  promptPlaceholder: string;
  hookAction?: "commit" | "push";
  hookNames?: string[];
  resolve?: (value: any) => void;

  showAlert: (options: AlertOptions) => Promise<void>;
  showConfirm: (options: ConfirmOptions) => Promise<boolean>;
  showPrompt: (options: PromptOptions) => Promise<string | null>;
  showHookConfirm: (options: HookConfirmOptions) => Promise<HookDecision>;
  closeWithConfirm: (value?: any) => void;
  closeWithCancel: () => void;
  setPromptValue: (val: string) => void;
}

export const useDialogStore = create<DialogState>((set, get) => ({
  isOpen: false,
  type: "alert",
  title: "",
  message: "",
  variant: "info",
  confirmText: "OK",
  cancelText: "Cancel",
  promptValue: "",
  promptPlaceholder: "",
  resolve: undefined,

  showAlert: (options: AlertOptions) => {
    return new Promise<void>((resolve) => {
      set({
        isOpen: true,
        type: "alert",
        title: options.title,
        message: options.message,
        variant: options.variant ?? "error",
        confirmText: options.confirmText ?? "OK",
        cancelText: "Cancel",
        resolve: () => resolve(),
      });
    });
  },

  showConfirm: (options: ConfirmOptions) => {
    return new Promise<boolean>((resolve) => {
      set({
        isOpen: true,
        type: "confirm",
        title: options.title,
        message: options.message,
        variant: options.variant ?? "danger",
        confirmText: options.confirmText ?? "Confirm",
        cancelText: options.cancelText ?? "Cancel",
        resolve: (confirmed: boolean) => resolve(confirmed),
      });
    });
  },

  showPrompt: (options: PromptOptions) => {
    return new Promise<string | null>((resolve) => {
      set({
        isOpen: true,
        type: "prompt",
        title: options.title,
        message: options.message,
        variant: "info",
        promptValue: options.defaultValue ?? "",
        promptPlaceholder: options.placeholder ?? "",
        confirmText: options.confirmText ?? "OK",
        cancelText: options.cancelText ?? "Cancel",
        resolve: (val: string | null) => resolve(val),
      });
    });
  },

  showHookConfirm: (options: HookConfirmOptions) => {
    return new Promise<HookDecision>((resolve) => {
      const isPush = options.action === "push";
      const hookTitle = isPush ? "Pre-Push Hook Detected" : "Pre-Commit Hooks Detected";
      const hookDesc = isPush
        ? "This repository has an active pre-push hook configured (such as Nx, automated tests, or validation scripts). Would you like to run the hook or skip it for this push?"
        : "This repository has active pre-commit hooks configured (such as linters, formatters, or unit tests). Would you like to run the hooks or skip them for this commit?";

      set({
        isOpen: true,
        type: "hook-confirm",
        title: hookTitle,
        message: hookDesc,
        variant: "info",
        hookAction: options.action,
        hookNames: options.hookNames,
        confirmText: isPush ? "Run Pre-Push Hook" : "Run Pre-Commit Hooks",
        cancelText: "Cancel",
        resolve: (decision: HookDecision) => resolve(decision ?? "cancel"),
      });
    });
  },

  closeWithConfirm: (value?: any) => {
    const { resolve, type, promptValue } = get();
    set({ isOpen: false, resolve: undefined, hookAction: undefined, hookNames: undefined });
    if (resolve) {
      if (type === "confirm") {
        resolve(true);
      } else if (type === "prompt") {
        resolve(value !== undefined ? value : promptValue);
      } else if (type === "hook-confirm") {
        resolve(value ?? "run");
      } else {
        resolve(undefined);
      }
    }
  },

  closeWithCancel: () => {
    const { resolve, type } = get();
    set({ isOpen: false, resolve: undefined, hookAction: undefined, hookNames: undefined });
    if (resolve) {
      if (type === "confirm") {
        resolve(false);
      } else if (type === "prompt") {
        resolve(null);
      } else if (type === "hook-confirm") {
        resolve("cancel");
      } else {
        resolve(undefined);
      }
    }
  },

  setPromptValue: (promptValue: string) => set({ promptValue }),
}));

// Convenience helper exports
export const showAlert = (options: AlertOptions) =>
  useDialogStore.getState().showAlert(options);

export const showConfirm = (options: ConfirmOptions) =>
  useDialogStore.getState().showConfirm(options);

export const showPrompt = (options: PromptOptions) =>
  useDialogStore.getState().showPrompt(options);

export const showHookConfirm = (options: HookConfirmOptions) =>
  useDialogStore.getState().showHookConfirm(options);
