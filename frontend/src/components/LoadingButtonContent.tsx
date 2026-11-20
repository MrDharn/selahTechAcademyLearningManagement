import type { ReactNode } from 'react';
import { SelahTechSpinner } from './SelahTechSpinner';

interface LoadingButtonContentProps {
  isLoading: boolean;
  loadingText: string;
  children: ReactNode;
  /** Use "brand" inside light buttons (button--secondary); the default "light" suits coloured buttons. */
  spinnerTone?: 'brand' | 'light';
}

/** Put this inside a <button>: shows the SelahTech spinner and a "doing it..." text while the action runs. */
export function LoadingButtonContent({ isLoading, loadingText, children, spinnerTone = 'light' }: LoadingButtonContentProps) {
  if (!isLoading) return <>{children}</>;

  return (
    <span className="loading-button-content">
      <SelahTechSpinner spinnerSize="small" spinnerTone={spinnerTone} />
      <span>{loadingText}</span>
    </span>
  );
}
