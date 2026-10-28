"use client";
import * as Sentry from "@sentry/nextjs";
import React, { Component, ReactNode } from "react";
import MaterialIcon from "@/components/MaterialIcon";
import { ErrorDetails } from "@/components/ErrorDetails";
import { OfflineErrorFallback } from "@/components/OfflineErrorFallback";
import { recoverFromStaleBuild, retryStaleBuildOnce } from "@/lib/build-recovery";
import { logger } from "@/lib/logger";

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
  error: Error | null;
  recovering: boolean;
}

export class PageErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false, error: null, recovering: false };
  }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, error, recovering: false };
  }

  componentDidCatch(error: Error, errorInfo: React.ErrorInfo) {
    logger.error("Page error:", error, errorInfo);
    Sentry.captureException(error);
    // A chunk that no longer exists on the server (stale service-worker HTML)
    // cannot be fixed by re-rendering. Clear the caches and reload once.
    void retryStaleBuildOnce(error);
  }

  handleReset = () => {
    this.setState({ hasError: false, error: null, recovering: false });
  };

  handleClearCache = async () => {
    this.setState({ recovering: true });
    await recoverFromStaleBuild();
  };

  render() {
    if (this.state.hasError) {
      if (this.props.fallback) {
        return this.props.fallback;
      }

      if (typeof navigator !== "undefined" && !navigator.onLine) {
        return <OfflineErrorFallback onRetry={this.handleReset} />;
      }

      return (
        <div className="flex flex-col items-center justify-center min-h-[400px] p-8">
          <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mb-6">
            <MaterialIcon icon="warning" className="text-red-500" size={32} />
          </div>
          <h2 className="text-xl font-bold text-gray-900 mb-2">Something went wrong</h2>
          {this.state.error && (
            <ErrorDetails error={this.state.error} source="page-boundary" className="text-center mb-6" />
          )}
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              onClick={this.handleReset}
              className="flex items-center gap-2 px-6 py-3 bg-primary-800 text-white rounded-xl font-bold text-sm hover:opacity-90 transition-all"
            >
              <MaterialIcon icon="refresh" size={16} />
              Try Again
            </button>
            <button
              onClick={this.handleClearCache}
              disabled={this.state.recovering}
              className="flex items-center gap-2 px-6 py-3 bg-white border border-gray-200 text-gray-800 rounded-xl font-bold text-sm hover:bg-gray-50 transition-all disabled:opacity-60"
            >
              <MaterialIcon icon="cleaning_services" size={16} />
              {this.state.recovering ? "Clearing…" : "Clear cache & reload"}
            </button>
          </div>
        </div>
      );
    }

    return this.props.children;
  }
}
