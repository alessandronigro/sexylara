const { v4: uuidv4 } = require('uuid');
const FutureEventParser = require('../perception/FutureEventParser');

const DEFAULT_LIFECORE = {
  time_memory: {
    past_events: [],
    present_context: {
      days_since_last_message: 0,
      emotional_climate: 'neutral',
      relationship_level: 0,
      last_significant_topic: null,
    },
    future_events: [],
  },
  relationship: {
    confidence_level: 0,
    interaction_history_summary: '',
    npc_initiative_intensity: 'low',
    typical_rhythm_of_contact: 'weekly',
  },
  routine_readiness: {
    preferred_hours: ['morning', 'evening'],
    busy_days: [],
    free_days: [],
    recall_propensity: 0.6,
    memory_reliability: 0.8,
    emotional_recall_intensity: 0.6,
  },
  groupPersona: {
    role: 'supporter',
    proactivity: 'medium',
  },
  worldAwareness: {
    likes_meteo: true,
    likes_news: false,
    sensitivity: 'light',
  },
  timePatterns: {
    morning_energy: 0.6,
    afternoon_energy: 0.7,
    evening_energy: 0.8,
  },
  socialUrges: {
    baseline: 0.3,
    peaks_at: ['evening'],
    topics: [],
  },
};

function clamp(num, min, max) {
  return Math.min(Math.max(num, min), max);
}

function ensureLifeCoreStructure(raw = {}) {
  // Idempotency check: if it looks like a valid LifeCore, return it as is.
  if (
    raw &&
    raw.time_memory &&
    raw.relationship &&
    raw.routine_readiness &&
    raw.groupPersona &&
    raw.worldAwareness &&
    raw.timePatterns &&
    raw.socialUrges
  ) {
    return raw;
  }

  const base = { ...DEFAULT_LIFECORE, ...(raw || {}) };
  const timeMemory = raw.time_memory || {};
  const relationship = raw.relationship || {};
  const routine = raw.routine_readiness || {};
  const groupPersona = raw.groupPersona || raw.group_persona || {};
  const worldAwareness = raw.worldAwareness || raw.world_awareness || {};
  const timePatterns = raw.timePatterns || raw.time_patterns || {};
  const socialUrges = raw.socialUrges || raw.social_urges || {};

  base.time_memory = {
    past_events: Array.isArray(timeMemory.past_events) ? timeMemory.past_events : [],
    present_context: {
      ...DEFAULT_LIFECORE.time_memory.present_context,
      ...(timeMemory.present_context || {}),
    },
    future_events: Array.isArray(timeMemory.future_events)
      ? timeMemory.future_events.map((ev) => ({
        executed: false,
        ...ev,
      }))
      : [],
  };

  base.relationship = {
    ...DEFAULT_LIFECORE.relationship,
    ...relationship,
    confidence_level: clamp(Number(relationship.confidence_level ?? DEFAULT_LIFECORE.relationship.confidence_level), 0, 5),
  };

  base.routine_readiness = {
    ...DEFAULT_LIFECORE.routine_readiness,
    ...routine,
    preferred_hours: Array.isArray(routine.preferred_hours) ? routine.preferred_hours : DEFAULT_LIFECORE.routine_readiness.preferred_hours,
    busy_days: Array.isArray(routine.busy_days) ? routine.busy_days : [],
    free_days: Array.isArray(routine.free_days) ? routine.free_days : [],
  };

  base.groupPersona = {
    ...DEFAULT_LIFECORE.groupPersona,
    ...groupPersona,
  };

  base.worldAwareness = {
    ...DEFAULT_LIFECORE.worldAwareness,
    ...worldAwareness,
  };

  base.timePatterns = {
    ...DEFAULT_LIFECORE.timePatterns,
    ...timePatterns,
  };

  base.socialUrges = {
    ...DEFAULT_LIFECORE.socialUrges,
    ...socialUrges,
    peaks_at: Array.isArray(socialUrges.peaks_at) ? socialUrges.peaks_at : DEFAULT_LIFECORE.socialUrges.peaks_at,
    topics: Array.isArray(socialUrges.topics) ? socialUrges.topics : [],
  };

  return base;
}

function computeDaysSinceLastMessage(history = [], nowTs = Date.now()) {
  const last = [...history].reverse().find((h) => h?.created_at || h?.timestamp || h?.at);
  if (!last) return 0;
  const ts = new Date(last.created_at || last.timestamp || last.at).getTime();
  if (!ts) return 0;
  const diff = nowTs - ts;
  return Math.max(0, Math.floor(diff / (24 * 60 * 60 * 1000)));
}

function deriveTopic(message = '', perception) {
  if (perception?.textAnalysis?.intentHints?.length) {
    return perception.textAnalysis.intentHints[0];
  }
  const lower = message.toLowerCase();
  if (lower.includes('colloquio')) return 'colloquio';
  if (lower.includes('viaggio') || lower.includes('parto')) return 'viaggio';
  if (lower.includes('esame')) return 'esame';
  if (lower.includes('appuntamento')) return 'appuntamento';
  return message.slice(0, 80) || 'interazione';
}

function emotionalWeightFromSentiment(sentiment = 'neutral') {
  if (sentiment === 'negative') return 0.8;
  if (sentiment === 'positive') return 0.4;
  return 0.6;
}

function updateRelationship(lifeCore, perception, intentReport = {}) {
  const relationship = lifeCore.relationship || { ...DEFAULT_LIFECORE.relationship };
  let confidence = Number(relationship.confidence_level || 0);
  const intents = intentReport.intents || [];
  const sentiment = perception?.textAnalysis?.sentiment;

  if (intents.includes('intimacy')) confidence += 0.25;
  if (intents.includes('richiesta_supporto') || intentReport.flags?.userWantsExplicitSexualTone) confidence += 0.15;
  if (sentiment === 'negative') confidence += 0.1;
  if (intents.includes('question')) confidence += 0.05;

  relationship.confidence_level = clamp(confidence, 0, 5);
  if (relationship.confidence_level >= 4) {
    relationship.npc_initiative_intensity = 'high';
    relationship.typical_rhythm_of_contact = 'daily';
  } else if (relationship.confidence_level >= 2) {
    relationship.npc_initiative_intensity = 'medium';
    relationship.typical_rhythm_of_contact = 'every_2_days';
  } else {
    relationship.npc_initiative_intensity = 'low';
    relationship.typical_rhythm_of_contact = 'weekly';
  }

  relationship.interaction_history_summary = `Confidenza ${relationship.confidence_level.toFixed(
    1
  )}/5 • Ritmo: ${relationship.typical_rhythm_of_contact}`;

  return relationship;
}

function updateFromInteraction({ lifeCore: rawLifeCore, message, perception, intentReport, history, now = Date.now() }) {
  const lifeCore = ensureLifeCoreStructure(rawLifeCore);
  const days = computeDaysSinceLastMessage(history, now);
  const topic = deriveTopic(message, perception);
  const sentiment = perception?.textAnalysis?.sentiment || 'neutral';
  const emotionalWeight = emotionalWeightFromSentiment(sentiment);

  lifeCore.time_memory.present_context = {
    ...lifeCore.time_memory.present_context,
    days_since_last_message: days,
    emotional_climate: sentiment,
    relationship_level: lifeCore.relationship.confidence_level,
    last_significant_topic: topic,
  };

  lifeCore.time_memory.past_events = [
    ...lifeCore.time_memory.past_events,
    {
      event_id: uuidv4(),
      timestamp: now,
      topic,
      emotional_weight: emotionalWeight,
      npcReflection: sentiment === 'negative' ? 'deve supportare' : 'ricordo positivo',
    },
  ].slice(-50);

  const parsedEvents = FutureEventParser.parse(message, now, sentiment);
  const existingKeys = new Set(
    (lifeCore.time_memory.future_events || []).map((ev) => `${ev.type}-${ev.scheduled_at_timestamp}`)
  );
  const newEvents = parsedEvents.filter((ev) => !existingKeys.has(`${ev.type}-${ev.scheduled_at_timestamp}`));
  lifeCore.time_memory.future_events = [
    ...(lifeCore.time_memory.future_events || []),
    ...newEvents.map((ev) => ({ ...ev, executed: ev.executed ?? false })),
  ].slice(-40);

  lifeCore.relationship = updateRelationship(lifeCore, perception, intentReport);
  lifeCore.time_memory.present_context.relationship_level = lifeCore.relationship.confidence_level;

  return {
    lifeCore,
    signals: {
      addedFutureEvents: newEvents,
      sentiment,
      daysSinceLastMessage: days,
      confidenceLevel: lifeCore.relationship.confidence_level,
    },
  };
}

module.exports = {
  ensureLifeCoreStructure,
  updateFromInteraction,
  DEFAULT_LIFECORE,
};
