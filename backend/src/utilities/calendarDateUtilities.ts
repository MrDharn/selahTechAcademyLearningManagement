/** Adds calendar months, clamping to the last day of the month (31 Jan + 1 month = 28/29 Feb). */
export function addMonthsToDate(startingDate: Date, numberOfMonthsToAdd: number): Date {
  const resultingDate = new Date(startingDate.getTime());
  const originalDayOfMonth = resultingDate.getDate();

  resultingDate.setDate(1);
  resultingDate.setMonth(resultingDate.getMonth() + numberOfMonthsToAdd);

  const lastDayOfTargetMonth = new Date(resultingDate.getFullYear(), resultingDate.getMonth() + 1, 0).getDate();
  resultingDate.setDate(Math.min(originalDayOfMonth, lastDayOfTargetMonth));

  return resultingDate;
}
