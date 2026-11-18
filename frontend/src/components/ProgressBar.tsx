export function ProgressBar({ completionPercentage }: { completionPercentage: number }) {
  return (
    <div className="progress-bar" role="progressbar" aria-valuenow={completionPercentage} aria-valuemin={0} aria-valuemax={100}>
      <div className="progress-bar__fill" style={{ width: `${completionPercentage}%` }} />
    </div>
  );
}
