// calendar.js — Creates a Google Calendar event at 4:45pm today via a "data:text/calendar" ICS file.
// This approach works without any OAuth: it generates an .ics file the user downloads and opens,
// which any calendar app (Google, Apple, Outlook) will import as an event.
// A future version can upgrade to direct Google Calendar API with OAuth for a more seamless flow.

function createReminder() {
  const now = new Date();
  const year = now.getFullYear();
  const month = String(now.getMonth() + 1).padStart(2, '0');
  const day = String(now.getDate()).padStart(2, '0');

  // 4:45 PM = 16:45 local time → convert to UTC for ICS
  const localStart = new Date(year, now.getMonth(), now.getDate(), 16, 45, 0);
  const localEnd   = new Date(year, now.getMonth(), now.getDate(), 17,  0, 0);

  const dtStart = toICSDate(localStart);
  const dtEnd   = toICSDate(localEnd);
  const uid = `wins-${Date.now()}@wins-app`;

  const ics = [
    'BEGIN:VCALENDAR',
    'VERSION:2.0',
    'PRODID:-//Wins App//EN',
    'BEGIN:VEVENT',
    `UID:${uid}`,
    `DTSTAMP:${toICSDate(new Date())}`,
    `DTSTART:${dtStart}`,
    `DTEND:${dtEnd}`,
    'SUMMARY:Record your wins today 🏆',
    'DESCRIPTION:Open Wins and do a quick brain dump of what you accomplished today.',
    'BEGIN:VALARM',
    'TRIGGER:-PT0M',
    'ACTION:DISPLAY',
    'DESCRIPTION:Time to record your wins!',
    'END:VALARM',
    'END:VEVENT',
    'END:VCALENDAR',
  ].join('\r\n');

  const blob = new Blob([ics], { type: 'text/calendar' });
  const url  = URL.createObjectURL(blob);
  const a    = document.createElement('a');
  a.href     = url;
  a.download = `wins-reminder-${year}${month}${day}.ics`;
  a.click();
  URL.revokeObjectURL(url);
}

function toICSDate(date) {
  // ICS datetime format: YYYYMMDDTHHMMSSZ (UTC)
  return date.toISOString().replace(/[-:]/g, '').replace(/\.\d{3}/, '');
}
