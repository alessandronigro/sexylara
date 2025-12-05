// =====================================================
// AI CORE ROUTER v2.0
// =====================================================
// Entry point unico per TUTTE le richieste AI.
// Flusso: parse → load → context → brain → llm → output

const ContextBuilder = require('./ContextBuilder');
const { think } = require('../brain/BrainEngine');
const { think: thinkGroup } = require('../brain/GroupBrainEngine');
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
    npcMembers: providedNpcMembers = null,
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
    .select('member_id, member_type, npc_id, role')
    .eq('group_id', groupId);

  if (!members || members.length === 0) {
    throw new Error(`Group ${groupId} not found or empty`);
  }

  // 2. Use provided npcMembers or load from database
  let npcMembers = providedNpcMembers;

  if (!npcMembers || npcMembers.length === 0) {
    // Fallback: Load NPC data for AI members
    const npcIds = members
      .filter(m => m.member_type === 'npc' || m.member_type === 'ai')
      .map(m => m.npc_id || m.member_id);

    const { data: npcData } = await supabase
      .from('npcs')
      .select('id, name, gender, personality_type, tone, age, ethnicity, hair_color, eye_color, body_type, avatar_url, face_image_url, group_behavior_profile')
      .in('id', npcIds.length ? npcIds : ['00000000-0000-0000-0000-000000000000']);

    npcMembers = (npcData || []).map(npc => ({
      ...npc,
      group_behavior: npc.group_behavior_profile || {},
      groupBehavior: npc.group_behavior_profile || {}
    }));
  }

  // 2b. Enrich members with names for prompt context
  const userIds = members
    .filter(m => m.member_type === 'user')
    .map(m => m.member_id);

  const { data: userProfiles } = await supabase
    .from('user_profile')
    .select('id, username, name')
    .in('id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']);

  const npcMap = (npcMembers || []).reduce((acc, n) => { acc[n.id] = n; return acc; }, {});
  const userMap = (userProfiles || []).reduce((acc, u) => { acc[u.id] = u; return acc; }, {});

  const enrichedMembers = (members || []).map((m) => {
    if (m.member_type === 'npc' || m.member_type === 'ai') {
      const npc = npcMap[m.npc_id || m.member_id];
      return {
        ...m,
        name: npc?.name || 'NPC',
        avatar_url: npc?.avatar_url || null,
        type: 'npc',
      };
    }
    const user = userMap[m.member_id];
    return {
      ...m,
      name: user?.username || user?.name || 'Utente',
      avatar_url: user?.avatar_url || null,
      type: 'user',
    };
  });

  // 3. Build context per gruppo
  const context = await ContextBuilder.build({
    userId,
    groupId,
    members: enrichedMembers,
    npcMembers,
    message,
    history,
    invokedNpcId,
    options
  });

  // 3. Think Group (GroupBrainEngine)
  const replies = await thinkGroup(context);

  // 4. Return structured output
  return {
    responses: replies || [],
    updatedStates: {},
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
