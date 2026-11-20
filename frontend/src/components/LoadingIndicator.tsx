import { SelahTechSpinner } from './SelahTechSpinner';

interface LoadingIndicatorProps {
  message?: string;
  /** "fullscreen" centres the loader over the whole page (used while the app starts or a session is restored). */
  layoutVariant?: 'inline' | 'fullscreen';
}

const BRAND_WORDMARK_LETTERS = Array.from('SelahTech');
const NUMBER_OF_LETTERS_IN_FIRST_WORD = 'Selah'.length;

/** The SelahTech loader: a spinning ring around the "S" mark, with the wordmark's letters bouncing one after another. */
export function LoadingIndicator({ message = 'Loading...', layoutVariant = 'inline' }: LoadingIndicatorProps) {
  return (
    <div className={`loading-indicator loading-indicator--${layoutVariant}`} role="status" aria-live="polite">
      <SelahTechSpinner spinnerSize="large" />

      <div className="selahtech-loader__wordmark" aria-hidden="true">
        {BRAND_WORDMARK_LETTERS.map((wordmarkLetter, letterPosition) => (
          <span
            key={letterPosition}
            className={letterPosition < NUMBER_OF_LETTERS_IN_FIRST_WORD ? 'selahtech-loader__letter' : 'selahtech-loader__letter selahtech-loader__letter--accent'}
            style={{ animationDelay: `${letterPosition * 0.09}s` }}
          >
            {wordmarkLetter}
          </span>
        ))}
      </div>

      <span className="loading-indicator__message">{message}</span>
    </div>
  );
}
