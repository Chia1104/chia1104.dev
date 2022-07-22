import { Component, type ErrorInfo, type ReactNode } from "react";
import Image from "next/image";

interface Props {
  children: ReactNode;
}

interface State {
  hasError: boolean;
}

export class ErrorBoundary extends Component<Props, State> {
  public state: State = {
    hasError: false,
  };

  public static getDerivedStateFromError(_: Error): State {
    // Update state so the next render will show the fallback UI.
    return { hasError: true };
  }

  public componentDidCatch(error: Error, errorInfo: ErrorInfo) {
    console.error("Uncaught error:", error, errorInfo);
  }

  public render() {
    if (this.state.hasError) {
      return (
        <div className="w-screen h-screen c-container flex flex-col justify-center items-center">
          <h1 className="title text-warning">Oops, there is an error!</h1>
          <Image
            src="/error/error-memoji.png"
            alt={"Error Memoji"}
            width={200}
            height={200}
            priority
            aria-label={"Error Memoji"}
          />
          <button
            type="button"
            onClick={() => this.setState({ hasError: false })}
            className="c-button-primary"
            aria-label={"Reload page"}
          >
            Try again?
          </button>
        </div>
      );
    }

    return this.props.children;
  }
}
