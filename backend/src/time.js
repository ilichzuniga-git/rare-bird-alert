// All regions are in California. If a region outside Pacific time is ever added,
// move this onto the regions table.
const REGION_TIME_ZONE = 'America/Los_Angeles';

/** Milliseconds the zone's wall clock is ahead of UTC at this instant (negative for the Americas). */
function zoneOffsetMs(date, timeZone) {
  const parts = Object.fromEntries(
    new Intl.DateTimeFormat('en-US', {
      timeZone, hourCycle: 'h23',
      year: 'numeric', month: '2-digit', day: '2-digit',
      hour: '2-digit', minute: '2-digit', second: '2-digit',
    }).formatToParts(date).map(p => [p.type, p.value])
  );
  const wallAsUtc = Date.UTC(parts.year, parts.month - 1, parts.day, parts.hour, parts.minute, parts.second);
  return wallAsUtc - date.getTime();
}

/**
 * Parse a local wall-clock time with no zone ("2026-09-23 15:37" or "2026-09-23"),
 * as eBird reports obsDt, into the correct instant for that time zone.
 */
function parseLocalTime(local, timeZone = REGION_TIME_ZONE) {
  const iso = local.trim().replace(' ', 'T');
  const wall = new Date(iso.length === 10 ? `${iso}T00:00:00Z` : `${iso}Z`); // the wall clock, read as if UTC
  let offset = zoneOffsetMs(wall, timeZone);
  let result = new Date(wall.getTime() - offset);
  // Near a DST switch the offset at the true instant can differ; recheck once
  const actual = zoneOffsetMs(result, timeZone);
  if (actual !== offset) result = new Date(wall.getTime() - actual);
  return result;
}

module.exports = { parseLocalTime, REGION_TIME_ZONE };
