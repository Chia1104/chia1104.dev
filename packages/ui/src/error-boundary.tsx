"use client";

import { Component } from "react";
import type { ErrorInfo, ReactNode } from "react";

import { Button } from "@heroui/react";

interface Props<TError> {
  children: ReactNode;
  errorMessage?: string;
  errorElement?:
    | (({
        error,
        errorMessage,
        reset,
      }: {
        error: TError | null;
        errorMessage?: string;
        reset: () => void;
      }) => ReactNode)
    | ReactNode;
  onError?: (error: TError, errorInfo: ErrorInfo) => void;
  /**
   * @deprecated
   */
  disableSentry?: boolean;
}

interface State<TError> {
  hasError: boolean;
  error: TError | null;
}

export class ErrorBoundary<TError extends Error> extends Component<
  Props<TError>,
  State<TError>
> {
  public state: State<TError> = {
    hasError: false,
    error: null,
  };

  public static getDerivedStateFromError() {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  public componentDidCatch(error: TError, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
    this.props.onError?.(error, errorInfo);
    this.setState({ error });
  }

  public render() {
    if (this.state.hasError) {
      return (
        <>
          {this.props.errorElement ? (
            typeof this.props.errorElement === "function" ? (
              this.props.errorElement({
                error: this.state.error,
                errorMessage: this.props.errorMessage,
                reset: () => this.setState({ hasError: false }),
              })
            ) : (
              this.props.errorElement
            )
          ) : (
            <div className="y-container prose dark:prose-invert flex size-full flex-col items-center justify-center px-3 py-5">
              <h2>{this.props.errorMessage ?? "Oops, there is an error!"}</h2>
              <Button
                onPress={() => this.setState({ hasError: false })}
                aria-label="Reload page">
                Try again?
              </Button>
            </div>
          )}
        </>
      );
    }

    return this.props.children;
  }
}
