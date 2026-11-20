import { SelahTechSpinner } from './SelahTechSpinner';

/** A small pill pinned to the bottom of the screen while a save/delete/update is in progress. */
export function WorkingNotice({ isWorking, workingText = 'Saving...' }: { isWorking: boolean; workingText?: string }) {
  if (!isWorking) return null;

  return (
    <div className="working-notice" role="status" aria-live="polite">
      <SelahTechSpinner spinnerSize="small" spinnerTone="light" />
      <span>{workingText}</span>
    </div>
  );
}
