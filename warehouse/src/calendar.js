const TOKEN_URL = 'https://oauth2.googleapis.com/token';
const CAL_BASE  = 'https://www.googleapis.com/calendar/v3/calendars';

export async function getAccessToken(env) {
  const res = await fetch(TOKEN_URL, {
    method: 'POST',
    headers: { 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams({
      client_id:     env.GOOGLE_CLIENT_ID,
      client_secret: env.GOOGLE_CLIENT_SECRET,
      refresh_token: env.GOOGLE_REFRESH_TOKEN,
      grant_type:    'refresh_token',
    }),
  });
  if (!res.ok) throw new Error('Token fetch failed: ' + res.status);
  const { access_token } = await res.json();
  return access_token;
}

// Google Calendar all-day end is exclusive — shift forward one day
function nextDay(dateStr) {
  const d = new Date(dateStr + 'T00:00:00');
  d.setDate(d.getDate() + 1);
  return d.toISOString().slice(0, 10);
}

export function jobToEvent(job) {
  const startDate = job.startDate || job.date || '';
  const endDate   = job.endDate   || startDate;
  const colorId   = job.status === 'confirmed' ? '11' : '7';

  const descParts = [];
  if (job.time)         descParts.push('Time: ' + job.time);
  if (job.clientName)   descParts.push('Client: ' + job.clientName);
  if (job.contactName)  descParts.push('Contact: ' + job.contactName);
  if (job.contactPhone) descParts.push('Phone: ' + job.contactPhone);
  if (job.contactEmail) descParts.push('Email: ' + job.contactEmail);
  if (job.crewSize)     descParts.push('Crew: ' + job.crewSize);
  if (job.description)  descParts.push('', job.description);
  if (job.notes)        descParts.push('', job.notes);

  return {
    summary:     job.title,
    location:    job.venue || undefined,
    description: descParts.join('\n').trim() || undefined,
    start:       { date: startDate },
    end:         { date: nextDay(endDate) },
    colorId,
    sendUpdates: 'none',
  };
}

export function taskToEvent(task, jobs) {
  const job     = (jobs || []).find(j => j.id === task.jobId);
  const summary = job ? job.title + ': ' + task.title : task.title;

  const descParts = [];
  if (task.detail)          descParts.push(task.detail);
  if (task.calClientName)   descParts.push('Client: ' + task.calClientName);
  if (task.calContactName)  descParts.push('Contact: ' + task.calContactName);
  if (task.calContactPhone) descParts.push('Phone: ' + task.calContactPhone);
  if (task.calContactEmail) descParts.push('Email: ' + task.calContactEmail);
  if (task.notes)           descParts.push(task.notes);

  let start, end;
  if (task.date && task.startTime) {
    start = { dateTime: task.date + 'T' + task.startTime + ':00', timeZone: 'Europe/London' };
    if (task.endTime) {
      end = { dateTime: task.date + 'T' + task.endTime + ':00', timeZone: 'Europe/London' };
    } else {
      const [h, m] = task.startTime.split(':').map(Number);
      const endH = String((h + 1) % 24).padStart(2, '0');
      const endM = String(m).padStart(2, '0');
      end = { dateTime: task.date + 'T' + endH + ':' + endM + ':00', timeZone: 'Europe/London' };
    }
  } else {
    start = { date: task.date };
    end   = { date: nextDay(task.date) };
  }

  return {
    summary,
    location:    task.calVenue || undefined,
    description: descParts.join('\n').trim() || undefined,
    start, end,
    colorId: '7',
    sendUpdates: 'none',
  };
}

export async function createEvent(env, event) {
  const token = await getAccessToken(env);
  const calId = encodeURIComponent(env.GOOGLE_CALENDAR_ID);
  const res = await fetch(CAL_BASE + '/' + calId + '/events', {
    method: 'POST',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  if (!res.ok) throw new Error('createEvent failed: ' + res.status + ' ' + await res.text());
  return (await res.json()).id;
}

export async function updateEvent(env, eventId, event) {
  const token = await getAccessToken(env);
  const calId = encodeURIComponent(env.GOOGLE_CALENDAR_ID);
  const res = await fetch(CAL_BASE + '/' + calId + '/events/' + encodeURIComponent(eventId), {
    method: 'PUT',
    headers: { 'Authorization': 'Bearer ' + token, 'Content-Type': 'application/json' },
    body: JSON.stringify(event),
  });
  if (!res.ok) throw new Error('updateEvent failed: ' + res.status + ' ' + await res.text());
}

export async function deleteEvent(env, eventId) {
  const token = await getAccessToken(env);
  const calId = encodeURIComponent(env.GOOGLE_CALENDAR_ID);
  const res = await fetch(CAL_BASE + '/' + calId + '/events/' + encodeURIComponent(eventId), {
    method: 'DELETE',
    headers: { 'Authorization': 'Bearer ' + token },
  });
  // 404/410 = already gone, treat as success
  if (!res.ok && res.status !== 404 && res.status !== 410) {
    throw new Error('deleteEvent failed: ' + res.status);
  }
}
