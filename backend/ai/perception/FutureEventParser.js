const { v4: uuidv4 } = require('uuid');

const WEEKDAYS = {
  lunedi: 1,
  lunedì: 1,
  martedi: 2,
  martedì: 2,
  mercoledi: 3,
  mercoledì: 3,
  giovedi: 4,
  giovedì: 4,
  venerdi: 5,
  venerdì: 5,
  sabato: 6,
  domenica: 0,
};

function nextWeekday(base, targetDay) {
  const date = new Date(base);
  const current = date.getDay();
  let delta = targetDay - current;
  if (delta <= 0) delta += 7;
  date.setDate(date.getDate() + delta);
  return date;
}

function detectTimeHint(text) {
  const timeMatch = text.match(/(?:alle|ore|h)\s*(\d{1,2})(?::|\.?(\d{2}))?/i);
  if (timeMatch) {
    const hour = Number(timeMatch[1]);
    const minute = Number(timeMatch[2] || 0);
    if (!Number.isNaN(hour) && hour >= 0 && hour < 24) {
      return { hour, minute: Number.isNaN(minute) ? 0 : minute };
    }
  }
  if (text.includes('mattina')) return { hour: 9, minute: 0 };
  if (text.includes('pomeriggio')) return { hour: 15, minute: 0 };
  if (text.includes('sera')) return { hour: 19, minute: 0 };
  if (text.includes('notte')) return { hour: 22, minute: 0 };
  return null;
}

function applyTime(date, timeHint) {
  if (!timeHint) return date;
  const copy = new Date(date);
  copy.setHours(timeHint.hour, timeHint.minute || 0, 0, 0);
  return copy;
}

function detectTypeAndPlan(text) {
  if (text.includes('colloquio')) return { type: 'interview', plan: 'Invia incoraggiamento prima del colloquio' };
  if (text.includes('esame')) return { type: 'exam', plan: 'Ricorda di chiedere com’è andato l’esame' };
  if (text.includes('parto') || text.includes('partenza') || text.includes('viaggio')) return { type: 'travel', plan: 'Messaggio di vicinanza il giorno della partenza' };
  if (text.includes('appuntamento')) return { type: 'appointment', plan: 'Promemoria leggero prima dell’appuntamento' };
  return { type: 'general', plan: 'Promemoria di cura e presenza' };
}

function parse(message, referenceTs = Date.now(), sentiment = 'neutral') {
  if (!message) return [];
  const text = message.toLowerCase();
  const base = new Date(referenceTs);
  const events = [];
  const timeHint = detectTimeHint(text);
  const { type, plan } = detectTypeAndPlan(text);

  const pushEvent = (date) => {
    const scheduled = applyTime(date, timeHint || { hour: 9, minute: 0 });
    events.push({
      event_id: uuidv4(),
      type,
      scheduled_at_timestamp: scheduled.getTime(),
      userMessageExtract: message.slice(0, 160),
      emotionalTag: sentiment,
      npcReactionPlan: plan,
      executed: false,
    });
  };

  if (text.includes('dopodomani')) {
    const date = new Date(base);
    date.setDate(date.getDate() + 2);
    pushEvent(date);
  } else if (text.includes('domani')) {
    const date = new Date(base);
    date.setDate(date.getDate() + 1);
    pushEvent(date);
  }

  const relDaysMatch = text.match(/tra\s+(\d+)\s+giorni|fra\s+(\d+)\s+giorni/i);
  if (relDaysMatch) {
    const days = Number(relDaysMatch[1] || relDaysMatch[2]);
    if (!Number.isNaN(days)) {
      const date = new Date(base);
      date.setDate(date.getDate() + days);
      pushEvent(date);
    }
  }

  const relHoursMatch = text.match(/tra\s+(\d+)\s+ore|fra\s+(\d+)\s+ore/i);
  if (relHoursMatch) {
    const hours = Number(relHoursMatch[1] || relHoursMatch[2]);
    if (!Number.isNaN(hours)) {
      const date = new Date(base.getTime() + hours * 60 * 60 * 1000);
      pushEvent(date);
    }
  }

  const weekMatch = text.match(/prossima settimana|tra\s+una\s+settimana|fra\s+una\s+settimana/i);
  if (weekMatch) {
    const date = new Date(base);
    date.setDate(date.getDate() + 7);
    pushEvent(date);
  }

  Object.keys(WEEKDAYS).forEach((key) => {
    if (text.includes(key)) {
      const date = nextWeekday(base, WEEKDAYS[key]);
      pushEvent(date);
    }
  });

  // If no specific trigger matched but we detected time, schedule for next day at that time.
  if (!events.length && timeHint) {
    const date = new Date(base);
    date.setDate(date.getDate() + 1);
    pushEvent(date);
  }

  return events;
}

module.exports = {
  parse,
};
