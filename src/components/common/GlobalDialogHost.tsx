import React, { useEffect, useRef } from "react";
import {
  AlertTriangle,
  AlertCircle,
  CheckCircle2,
  Info,
  X,
  HelpCircle,
} from "lucide-react";
import { useDialogStore, DialogVariant } from "@/store/useDialogStore";

export const GlobalDialogHost: React.FC = () => {
  const {
    isOpen,
    type,
    title,
    message,
    variant,
    confirmText,
    cancelText,
    promptValue,
    promptPlaceholder,
    closeWithConfirm,
    closeWithCancel,
    setPromptValue,
  } = useDialogStore();

  const confirmBtnRef = useRef<HTMLButtonElement>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (!isOpen) return;

    if (type === "prompt") {
      inputRef.current?.focus();
      inputRef.current?.select();
    } else {
      confirmBtnRef.current?.focus();
    }

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.key === "Escape") {
        e.preventDefault();
        closeWithCancel();
      } else if (e.key === "Enter" && type !== "prompt") {
        e.preventDefault();
        closeWithConfirm();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    return () => window.removeEventListener("keydown", handleKeyDown);
  }, [isOpen, type, closeWithCancel, closeWithConfirm]);

  if (!isOpen) return null;

  const renderIcon = (v: DialogVariant) => {
    switch (v) {
      case "danger":
      case "error":
        return (
          <div className="p-2.5 rounded-xl bg-rose-500/15 border border-rose-500/30 text-rose-400 flex-shrink-0">
            <AlertCircle className="w-5 h-5" />
          </div>
        );
      case "warning":
        return (
          <div className="p-2.5 rounded-xl bg-amber-500/15 border border-amber-500/30 text-amber-400 flex-shrink-0">
            <AlertTriangle className="w-5 h-5" />
          </div>
        );
      case "success":
        return (
          <div className="p-2.5 rounded-xl bg-emerald-500/15 border border-emerald-500/30 text-emerald-400 flex-shrink-0">
            <CheckCircle2 className="w-5 h-5" />
          </div>
        );
      case "info":
      default:
        return (
          <div className="p-2.5 rounded-xl bg-sky-500/15 border border-sky-500/30 text-sky-400 flex-shrink-0">
            {type === "prompt" ? (
              <HelpCircle className="w-5 h-5" />
            ) : (
              <Info className="w-5 h-5" />
            )}
          </div>
        );
    }
  };

  const getConfirmButtonClasses = (v: DialogVariant) => {
    switch (v) {
      case "danger":
      case "error":
        return "bg-rose-600 hover:bg-rose-500 active:bg-rose-700 text-white shadow-lg shadow-rose-950/50";
      case "warning":
        return "bg-amber-600 hover:bg-amber-500 active:bg-amber-700 text-white shadow-lg shadow-amber-950/50";
      case "success":
        return "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700 text-white shadow-lg shadow-emerald-950/50";
      case "info":
      default:
        return "bg-sky-600 hover:bg-sky-500 active:bg-sky-700 text-white shadow-lg shadow-sky-950/50";
    }
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/75 backdrop-blur-sm animate-fade-in select-none"
      onClick={(e) => {
        if (e.target === e.currentTarget) {
          closeWithCancel();
        }
      }}
    >
      <div
        className="w-full max-w-md bg-shark-900 border border-shark-750 rounded-2xl shadow-2xl overflow-hidden flex flex-col text-slate-200 animate-in fade-in zoom-in-95 duration-150"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal Header */}
        <div className="flex items-start justify-between p-5 pb-3">
          <div className="flex items-center gap-3.5">
            {renderIcon(variant)}
            <div>
              <h3 className="text-sm font-semibold text-slate-100 tracking-tight">
                {title}
              </h3>
            </div>
          </div>
          <button
            onClick={closeWithCancel}
            className="p-1 rounded-lg text-slate-400 hover:text-slate-200 hover:bg-shark-800 transition-colors"
            title="Close (Esc)"
          >
            <X className="w-4 h-4" />
          </button>
        </div>

        {/* Modal Body */}
        <div className="px-5 py-2 space-y-4">
          <div className="text-xs text-slate-300 leading-relaxed break-words whitespace-pre-wrap">
            {message}
          </div>

          {type === "prompt" && (
            <form
              onSubmit={(e) => {
                e.preventDefault();
                closeWithConfirm(promptValue);
              }}
              className="mt-2"
            >
              <input
                ref={inputRef}
                type="text"
                value={promptValue}
                onChange={(e) => setPromptValue(e.target.value)}
                placeholder={promptPlaceholder}
                className="w-full px-3 py-2 bg-shark-950 border border-shark-750 rounded-lg text-xs text-slate-100 placeholder-slate-500 focus:outline-none focus:border-sky-500 transition-colors"
              />
            </form>
          )}
        </div>

        {/* Modal Actions */}
        <div className="flex items-center justify-end gap-2 px-5 py-4 border-t border-shark-800/80 bg-shark-950/40 mt-3">
          {type !== "alert" && (
            <button
              type="button"
              onClick={closeWithCancel}
              className="px-3.5 py-1.5 rounded-lg border border-shark-750 bg-shark-850 hover:bg-shark-800 text-slate-300 hover:text-slate-100 text-xs font-medium transition-colors"
            >
              {cancelText}
            </button>
          )}
          <button
            ref={confirmBtnRef}
            type="button"
            onClick={() => closeWithConfirm()}
            className={`px-4 py-1.5 rounded-lg text-xs font-medium transition-all ${getConfirmButtonClasses(
              variant
            )}`}
          >
            {confirmText}
          </button>
        </div>
      </div>
    </div>
  );
};
