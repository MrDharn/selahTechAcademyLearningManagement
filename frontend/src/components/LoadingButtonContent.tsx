import type { ReactNode } from 'react';
import { SelahTechSpinner } from './SelahTechSpinner';

interface LoadingButtonContentProps {
  isLoading: boolean;
  /** Not shown on screen (the spinner says it already); it is read out by screen readers. */
  loadingText: string;
  children: ReactNode;
  /** Use "brand" inside light buttons (button--secondary); the default "light" suits coloured buttons. */
  spinnerTone?: 'brand' | 'light';
}

/**
 * Put this inside a <button>. While loading, the button's label is hidden (so the button keeps its size) and the
 * SelahTech spinner sits in the centre of the button.
 */
export function LoadingButtonContent({ isLoading, loadingText, children, spinnerTone = 'light' }: LoadingButtonContentProps) {
  if (!isLoading) return <>{children}</>;

  return (
    <span className="loading-button-content">
      <span className="loading-button-content__hidden-label">{children}</span>
      <span className="loading-button-content__spinner">
        <SelahTechSpinner spinnerSize="small" spinnerTone={spinnerTone} />
      </span>
      <span className="visually-hidden">{loadingText}</span>
    </span>
  );
}
