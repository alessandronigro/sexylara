// =====================================================
// AI CORE ROUTER v2.0
// =====================================================
// Entry point unico per TUTTE le richieste AI.
// Flusso: parse → load → context → brain → llm → output

const ContextBuilder = require('./ContextBuilder');
const { think } = require('../brain/BrainEngine');
const { thinkGroup } = require('../engines/GroupBrainEngine');
const { getNpcProfile } = require('../memory/npcRepository');
const { supabase } = require('../../lib/supabase');

/**
 * Route principale per chat 1:1
 * @param {Object} request - { userId, npcId, message, media, history }
 * @returns {Object} - { text, mediaRequest, actions, updatedState }
 */
async function routeChat(request) {
  const {
    userId,
    npcId,
    message,
    media = null,
    history = [],
    options = {}
  } = request;

  // Validazione
  if (!userId || !npcId || !message) {
    throw new Error('Missing required fields: userId, npcId, message');
  }

  // 1. Load NPC Profile (LifeCore + state)
  const npcProfile = await getNpcProfile(npcId);
  if (!npcProfile.data) {
    throw new Error(`NPC ${npcId} not found`);
  }

  // 2. Load user profile
  const { data: user } = await supabase
    .from('user_profile')
    .select('id, username, language')
    .eq('id', userId)
    .single();

  // 3. Build context
  const context = await ContextBuilder.build({
    userId,
    npcId,
    npc: npcProfile.data,
    user,
    message,
    media,
    history,
    groupId: null,
    options
  });

  // 4. Think (BrainEngine)
  const result = await think(context);

  // 5. Return structured output
  return {
    text: result.text,
    mediaRequest: result.mediaRequest,
    actions: result.actions,
    updatedState: result.updatedState,
    npcId,
    userId
  };
}

/**
 * Route principale per chat di gruppo
 * @param {Object} request - { userId, groupId, message, invokedNpcId }
 * @returns {Object} - { responses: [{npcId, text}], updatedStates }
 */
async function routeGroupChat(request) {
  const {
    userId,
    groupId,
    message,
    invokedNpcId = null,
    history = [],
    options = {}
  } = request;

  // Validazione
  if (!userId || !groupId || !message) {
    throw new Error('Missing required fields: userId, groupId, message');
  }

  // 1. Load group members
  const { data: members } = await supabase
    .from('group_members')
    .select('member_id, member_type, role')
    .eq('group_id', groupId);

  if (!members || members.length === 0) {
    throw new Error(`Group ${groupId} not found or empty`);
  }

  // 2. Build context per gruppo
  const context = await ContextBuilder.build({
    userId,
    groupId,
    members,
    message,
    history,
    invokedNpcId,
    options
  });

  // 3. Think Group (GroupBrainEngine)
  const result = await thinkGroup(context);

  // 4. Return structured output
  return {
    responses: result.responses || [],
    updatedStates: result.updatedStates || {},
    groupId,
    userId
  };
}

/**
 * Route per media analysis (foto/audio inviati dall'utente)
 * @param {Object} request - { userId, npcId, mediaType, mediaUrl }
 * @returns {Object} - { analysis, reaction, memoryRecord }
 */
async function routeMediaAnalysis(request) {
  const {
    userId,
    npcId,
    mediaType,
    mediaUrl,
    options = {}
  } = request;

  // Validazione
  if (!userId || !npcId || !mediaType || !mediaUrl) {
    throw new Error('Missing required fields: userId, npcId, mediaType, mediaUrl');
  }

  // Load NPC
  const npcProfile = await getNpcProfile(npcId);
  if (!npcProfile.data) {
    throw new Error(`NPC ${npcId} not found`);
  }

  // Build context with media
  const context = await ContextBuilder.build({
    userId,
    npcId,
    npc: npcProfile.data,
    message: `[USER SENT ${mediaType.toUpperCase()}]`,
    media: { type: mediaType, url: mediaUrl },
    history: [],
    options
  });

  // Think con media context
  const result = await think(context);

  return {
    text: result.text,
    analysis: context.perception?.mediaAnalysis || null,
    memoryRecord: result.updatedState?.memorySnapshot || null,
    npcId,
    userId
  };
}

/**
 * Route unificata - Auto-detect tipo di richiesta
 * @param {Object} request - Request generico
 * @returns {Object} - Output appropriato
 */
async function route(request) {
  // Auto-detect tipo di richiesta
  if (request.groupId) {
    return routeGroupChat(request);
  } else if (request.mediaType && request.mediaUrl) {
    return routeMediaAnalysis(request);
  } else {
    return routeChat(request);
  }
}

module.exports = {
  route,
  routeChat,
  routeGroupChat,
  routeMediaAnalysis
};
