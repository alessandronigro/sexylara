// =====================================================
// MEMORY CONSOLIDATION ENGINE v2.0
// =====================================================
// Sistema batch/async per consolidamento memoria.
// NON scrive memoria nel flusso sincrono delle risposte.

const { supabase } = require('../../lib/supabase');

// ======================================
// QUEUE IN-MEMORY per eventi
// ======================================
let memoryQueue = [];
let isFlushingpending = false;

/**
 * Aggiungi evento memoria alla queue
 * @param {Object} event - Evento memoria
 */
function queueMemoryEvent(event) {
  const {
    type,
    npcId,
    userId,
    description,
    intensity = 'medium',
    metadata = {}
  } = event;

  // Validazione base
  if (!type || !npcId || !userId) {
    console.warn('⚠️ MemoryConsolidation: Invalid event, skipping', event);
    return;
  }
  if (!description || description.trim().length < 8) {
    console.warn('⚠️ MemoryConsolidation: Empty/short description, skipping');
    return;
  }
  const descLower = description.toLowerCase();
  if (type === 'mood' || descLower.startsWith('mood:')) {
    return;
  }

  memoryQueue.push({
    type,
    npcId,
    userId,
    description,
    intensity,
    metadata,
    timestamp: Date.now()
  });

  // Auto-flush se queue diventa troppo grande
  if (memoryQueue.length >= 10) {
    flush();
  }
}

/**
 * Flush immediato della queue
 * @returns {Promise<void>}
 */
async function flush() {
  if (isFlushingpending || memoryQueue.length === 0) return;

  isFlushingpending = true;
  const eventsToProcess = [...memoryQueue];
  memoryQueue = []; // Clear queue

  try {
    await processMemoryBatch(eventsToProcess);
  } catch (error) {
    console.error('❌ MemoryConsolidation flush error:', error);
    // Re-queue eventi falliti (limitato a evitare loop infiniti)
    if (eventsToProcess.length < 20) {
      memoryQueue.push(...eventsToProcess);
    }
  } finally {
    isFlushingpending = false;
  }
}

/**
 * Process batch di eventi memoria
 * @param {Array} events - Eventi da processare
 * @returns {Promise<void>}
 */
async function processMemoryBatch(events) {
  if (events.length === 0) return;

  console.log(`🧠 MemoryConsolidation: Processing ${events.length} events`);

  // Raggruppa per NPC
  const byNpc = {};
  events.forEach(event => {
    if (!byNpc[event.npcId]) byNpc[event.npcId] = [];
    byNpc[event.npcId].push(event);
  });

  // Process per ogni NPC
  for (const [npcId, npcEvents] of Object.entries(byNpc)) {
    try {
      await consolidateNpcMemories(npcId, npcEvents);
    } catch (error) {
      console.error(`❌ Error consolidating memories for NPC ${npcId}:`, error);
    }
  }
}

/**
 * Consolida memorie per singolo NPC
 * @param {String} npcId - ID NPC
 * @param {Array} events - Eventi del NPC
 * @returns {Promise<void>}
 */
async function consolidateNpcMemories(npcId, events) {
  // 1. Carica profilo NPC corrente
  const { data: profile } = await supabase
    .from('npc_profiles')
    .select('data')
    .eq('id', npcId)
    .maybeSingle();

  if (!profile) {
    console.warn(`⚠️ NPC ${npcId} profile not found, skipping consolidation`);
    return;
  }

  const npcData = profile.data || {};
  const memories = npcData.memories || {
    episodic: [],
    media: [],
    user_preferences: {},
    long_term_summary: ''
  };

  // 2. Aggiungi eventi episodici
  events.forEach(event => {
    if (event.type === 'episodic' || event.type === 'explicit_interaction') {
      memories.episodic.push({
        description: event.description,
        intensity: event.intensity,
        type: event.type,
        at: event.timestamp
      });
    }

    if (event.type === 'world_event') {
      memories.episodic.push({
        description: `World: ${event.description || event.metadata?.title || 'evento'}`,
        intensity: event.intensity || 'medium',
        type: 'world_event',
        at: event.timestamp,
      });
    }

    if (event.type === 'gossip') {
      memories.episodic.push({
        description: `Gossip: ${event.description || ''}`,
        intensity: event.intensity || 'low',
        type: 'gossip',
        at: event.timestamp,
      });
    }

    if (event.type === 'media') {
      memories.media.push({
        ...event.metadata,
        at: event.timestamp
      });
    }

    if (event.type === 'user_preference') {
      memories.user_preferences = {
        ...memories.user_preferences,
        ...event.metadata
      };
    }
  });

  // 3. Limita dimensione memoria episodica (max 50 eventi)
  if (memories.episodic.length > 50) {
    // Mantieni solo gli eventi più recenti e più intensi
    memories.episodic = memories.episodic
      .sort((a, b) => {
        // Priorità: intensity high > medium > low, poi timestamp recente
        const intensityScore = { high: 3, medium: 2, low: 1 };
        const scoreA = (intensityScore[a.intensity] || 1) * 1000 + (a.at || 0);
        const scoreB = (intensityScore[b.intensity] || 1) * 1000 + (b.at || 0);
        return scoreB - scoreA;
      })
      .slice(0, 50);
  }

  // 4. Aggiorna long term summary (ogni 10 eventi circa)
  const totalEvents = memories.episodic.length;
  if (totalEvents % 10 === 0 && totalEvents > 0) {
    const recentEvents = memories.episodic.slice(-10);
    const summary = recentEvents.map(e => e.description).join('; ');
    memories.long_term_summary = `Ultimi eventi: ${summary}`;
  }

  // 5. Salva in Supabase
  const { error } = await supabase
    .from('npc_profiles')
    .update({
      data: {
        ...npcData,
        memories
      },
      updated_at: new Date().toISOString()
    })
    .eq('id', npcId);

  if (error) {
    console.error(`❌ Error saving consolidated memories for NPC ${npcId}:`, error);
  } else {
    console.log(`✅ Consolidated ${events.length} memories for NPC ${npcId}`);
  }
}

/**
 * Get queue size (per monitoring)
 * @returns {Number}
 */
function getQueueSize() {
  return memoryQueue.length;
}

/**
 * Inline consolidation compatibility: aggiorna summary e queue event
 */
function consolidate(npcJson, summary = '') {
  if (!npcJson.memories) {
    npcJson.memories = { episodic: [], media: [], user_preferences: {}, long_term_summary: '' };
  }
  if (summary) {
    npcJson.memories.long_term_summary = summary;
  }
  const npcId = npcJson.id || npcJson.npc_id;
  const userId = npcJson.user_id || npcJson.owner_id;
  if (!npcId || !userId) {
    console.warn('⚠️ MemoryConsolidation: missing npcId/userId, skipping queue');
    return npcJson;
  }
  const desc = summary || 'interazione';
  if (desc.trim().length < 8 || desc.toLowerCase().startsWith('mood:')) {
    return npcJson;
  }
  // Queue a minimal event for async consolidation
  queueMemoryEvent({
    type: 'episodic',
    npcId,
    userId,
    description: desc,
    intensity: 'medium',
    metadata: {},
  });
  return npcJson;
}

/**
 * Clear queue (per testing/reset)
 */
function clearQueue() {
  memoryQueue = [];
}

module.exports = {
  queueMemoryEvent,
  flush,
  getQueueSize,
  clearQueue,
  consolidate
};
