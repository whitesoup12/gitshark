import { Component, ErrorInfo, ReactNode } from "react";
import { AlertTriangle, RefreshCw, X } from "lucide-react";
import { getCurrentWebviewWindow } from "@tauri-apps/api/webviewWindow";
import { isTauriEnvironment } from "@/lib/ipc";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  errorInfo: ErrorInfo | null;
}

export class CodeSharkErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
    error: null,
    errorInfo: null,
  };

  public static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, errorInfo: null };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("CodeShark caught an unhandled error:", error, errorInfo);
    this.setState({ errorInfo });
  }

  private handleClose = async () => {
    if (isTauriEnvironment()) {
      try {
        const win = getCurrentWebviewWindow();
        await win.close();
      } catch (err) {
        window.close();
      }
    } else {
      window.close();
    }
  };

  public render() {
    if (this.state.hasError) {
      return (
        <div className="flex flex-col items-center justify-center h-screen w-screen bg-shark-950 text-shark-100 p-8 select-none font-sans">
          <div className="max-w-md w-full bg-shark-900 border border-red-500/40 rounded-xl p-6 shadow-2xl text-center space-y-4">
            <div className="w-12 h-12 rounded-full bg-red-950/80 border border-red-500/50 flex items-center justify-center text-red-400 mx-auto">
              <AlertTriangle className="w-6 h-6" />
            </div>
            <div>
              <h2 className="text-lg font-bold text-white">CodeShark Encountered an Error</h2>
              <p className="text-xs text-red-300 font-mono mt-2 break-all bg-shark-950/80 p-3 rounded border border-shark-800 text-left overflow-auto max-h-32">
                {this.state.error?.message || "Unknown error occurred"}
              </p>
            </div>
            <div className="flex items-center justify-center space-x-3 pt-2">
              <button
                onClick={() => window.location.reload()}
                className="flex items-center space-x-1.5 px-3.5 py-2 text-xs rounded-md bg-cyan-600 hover:bg-cyan-500 text-white font-medium transition-colors shadow"
              >
                <RefreshCw className="w-3.5 h-3.5" />
                <span>Reload</span>
              </button>
              <button
                onClick={this.handleClose}
                className="flex items-center space-x-1.5 px-3.5 py-2 text-xs rounded-md bg-shark-800 hover:bg-shark-700 text-shark-200 border border-shark-700 font-medium transition-colors"
              >
                <X className="w-3.5 h-3.5" />
                <span>Close Window</span>
              </button>
            </div>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
