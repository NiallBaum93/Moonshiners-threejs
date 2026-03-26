'use client';

import { Component, ReactNode } from 'react';

interface Props {
  children: ReactNode;
  fallback?: ReactNode;
}

interface State {
  hasError: boolean;
}

/**
 * Catches WebGL context creation errors (and any other runtime errors) thrown
 * by @react-three/fiber's useIsomorphicLayoutEffect so the rest of the page
 * remains interactive even when the GPU is unavailable or sandboxed.
 */
export class CanvasErrorBoundary extends Component<Props, State> {
  constructor(props: Props) {
    super(props);
    this.state = { hasError: false };
  }

  static getDerivedStateFromError(): State {
    return { hasError: true };
  }

  override render() {
    if (this.state.hasError) {
      return (
        this.props.fallback ?? (
          <div className="w-full h-full flex flex-col items-center justify-center gap-3 text-zinc-500">
            <svg
              xmlns="http://www.w3.org/2000/svg"
              width="40"
              height="40"
              viewBox="0 0 24 24"
              fill="none"
              stroke="currentColor"
              strokeWidth="1.5"
              strokeLinecap="round"
              strokeLinejoin="round"
              aria-hidden
            >
              <rect x="2" y="3" width="20" height="14" rx="2" />
              <path d="M8 21h8M12 17v4" />
            </svg>
            <p className="text-sm font-medium">3D preview unavailable</p>
            <p className="text-xs text-zinc-400">WebGL is not supported in this browser</p>
          </div>
        )
      );
    }
    return this.props.children;
  }
}
