/**
 * Parse opening_hours string (OSM-style) to daily hours and late night hours.
 * Late night = hours after 23:00 (11pm), cap 0–5.
 * Daily hours = max session length across any day, rounded.
 */

/**
 * @param {string} oh - e.g. "Mo-Su 08:30-23:00", "Mo-Th 11:00-00:00; Fr-Sa 11:00-01:00"
 * @returns {{ dailyHours: number, lateHours: number }}
 */
export function parseOpeningHours(oh) {
  let dailyHours = 12;
  let lateHours = 0;
  if (!oh || typeof oh !== 'string') return { dailyHours, lateHours };
  const s = oh.trim().replace(/^["']|["']$/g, '');
  if (!s || s.toLowerCase().includes('appointment')) return { dailyHours, lateHours };

  // Match time ranges: HH:MM-HH:MM or H:MM-HH:MM
  const timeRange = /(\d{1,2}):(\d{2})-(\d{1,2}):(\d{2})/g;
  let match;
  while ((match = timeRange.exec(s)) !== null) {
    const openH = parseInt(match[1], 10) + parseInt(match[2], 10) / 60;
    let closeH = parseInt(match[3], 10) + parseInt(match[4], 10) / 60;
    if (closeH <= openH) closeH += 24; // e.g. 23:00-01:00
    const duration = closeH - openH;
    if (duration > dailyHours) dailyHours = Math.min(24, Math.round(duration));
    if (closeH > 23) {
      const late = Math.min(5, Math.round(closeH - 23));
      if (late > lateHours) lateHours = late;
    }
  }
  dailyHours = Math.max(8, Math.min(24, dailyHours));
  lateHours = Math.max(0, Math.min(5, lateHours));
  return { dailyHours, lateHours };
}
