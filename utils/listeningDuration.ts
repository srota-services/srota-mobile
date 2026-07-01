/**
 * Format cumulative listening progress for profile stats.
 * API `progress` is a float representing seconds listened.
 */

export function sumListeningProgressSeconds(
   entries: readonly { progress: number }[]
): number {
   return entries.reduce((total, entry) => {
      const value = entry.progress;
      if (!Number.isFinite(value) || value <= 0) {
         return total;
      }
      return total + value;
   }, 0);
}

/** e.g. "0h0m", "0h14m", "2h15m", "31h56m" */
export function formatListeningDurationFromSeconds(totalSeconds: number): string {
   if (!Number.isFinite(totalSeconds) || totalSeconds <= 0) {
      return '0h0m';
   }

   const totalMinutes = Math.floor(totalSeconds / 60);
   const hours = Math.floor(totalMinutes / 60);
   const minutes = totalMinutes % 60;

   return `${hours}h${minutes}m`;
}

/** Sum progress (seconds) across all user-audiobooks and format as hours/minutes. */
export function formatProfileListeningHours(
   entries: readonly { progress: number }[]
): string {
   return formatListeningDurationFromSeconds(sumListeningProgressSeconds(entries));
}
