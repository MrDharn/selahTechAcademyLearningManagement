interface StatusMessageProps {
  messageKind: 'error' | 'success' | 'info' | 'warning';
  messageText: string | null | undefined;
}

export function StatusMessage({ messageKind, messageText }: StatusMessageProps) {
  if (!messageText) return null;
  return (
    <div className={`status-message status-message--${messageKind}`} role={messageKind === 'error' ? 'alert' : 'status'}>
      {messageText}
    </div>
  );
}
