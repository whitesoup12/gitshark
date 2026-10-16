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

interface DialogState {
  isOpen: boolean;
  type: "alert" | "confirm" | "prompt";
  title: string;
  message: React.ReactNode | string;
  variant: DialogVariant;
  confirmText: string;
  cancelText: string;
  promptValue: string;
  promptPlaceholder: string;
  resolve?: (value: any) => void;

  showAlert: (options: AlertOptions) => Promise<void>;
  showConfirm: (options: ConfirmOptions) => Promise<boolean>;
  showPrompt: (options: PromptOptions) => Promise<string | null>;
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

  closeWithConfirm: (value?: any) => {
    const { resolve, type, promptValue } = get();
    set({ isOpen: false, resolve: undefined });
    if (resolve) {
      if (type === "confirm") {
        resolve(true);
      } else if (type === "prompt") {
        resolve(value !== undefined ? value : promptValue);
      } else {
        resolve(undefined);
      }
    }
  },

  closeWithCancel: () => {
    const { resolve, type } = get();
    set({ isOpen: false, resolve: undefined });
    if (resolve) {
      if (type === "confirm") {
        resolve(false);
      } else if (type === "prompt") {
        resolve(null);
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
