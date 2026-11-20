interface SelahTechSpinnerProps {
  /** "small" fits inside a button or a line of text; "large" is the full-size loader. */
  spinnerSize?: 'small' | 'large';
  /** "light" is for buttons with a coloured background; "brand" is for white backgrounds. */
  spinnerTone?: 'brand' | 'light';
}

/** The SelahTech mark: a spinning ring around the "S". Used on its own for small loading states. */
export function SelahTechSpinner({ spinnerSize = 'small', spinnerTone = 'brand' }: SelahTechSpinnerProps) {
  return (
    <span
      className={`selahtech-loader__mark-wrapper selahtech-loader__mark-wrapper--${spinnerSize} selahtech-loader__mark-wrapper--${spinnerTone}`}
      aria-hidden="true"
    >
      <span className="selahtech-loader__ring" />
      <span className="selahtech-loader__mark">S</span>
    </span>
  );
}
