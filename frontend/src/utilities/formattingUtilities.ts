export function formatKoboAsNaira(amountInKobo: number): string {
  if (amountInKobo === 0) return 'Free';
  return new Intl.NumberFormat('en-NG', { style: 'currency', currency: 'NGN', maximumFractionDigits: 2 }).format(amountInKobo / 100);
}

export function convertNairaToKobo(amountInNaira: number): number {
  return Math.round(amountInNaira * 100);
}

export function formatCalendarDate(isoDateString: string | null): string {
  if (!isoDateString) return '-';
  return new Date(isoDateString).toLocaleDateString('en-GB', { day: 'numeric', month: 'short', year: 'numeric' });
}

export function formatDurationInMinutesAndSeconds(totalSeconds: number | null): string {
  if (totalSeconds === null) return '';
  const wholeMinutes = Math.floor(totalSeconds / 60);
  const remainingSeconds = totalSeconds % 60;
  return `${wholeMinutes}:${String(remainingSeconds).padStart(2, '0')}`;
}
