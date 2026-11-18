export function LoadingIndicator({ message = 'Loading...' }: { message?: string }) {
  return (
    <div className="loading-indicator" role="status">
      <div className="loading-indicator__spinner" />
      <span>{message}</span>
    </div>
  );
}
