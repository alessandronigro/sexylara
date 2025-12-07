// =====================================================
// AI CORE ROUTER v2.0
// =====================================================
// Entry point unico per TUTTE le richieste AI.
// Flusso: parse → load → context → brain → llm → output

const ContextBuilder = require('./ContextBuilder');
const { think } = require('../brain/BrainEngine');
const GroupTurnEngine = require('../brain/GroupTurnEngine');
const PromptBuilder = require('../generation/PromptBuilder'); // or new GroupPromptBuilder
const { veniceSafeCall } = require('../generation/VeniceSafeCall');
const GroupLogContext = require('../../utils/GroupLogContext');
const { think: thinkGroup } = require('../engines/GroupBrainEngine');
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

  // 🔍 DEBUG: Log the response from BrainEngine
  console.log('🔍 [AICoreRouter] BrainEngine result:', {
    hasText: !!result.text,
    textLength: result.text?.length || 0,
    textPreview: (result.text || '').substring(0, 100),
    mediaRequest: result.mediaRequest,
    actions: result.actions
  });

  // 5. Return structured output
  return {
    text: result.text,
    output: result.text, // Add output alias for compatibility
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
async function routeGroupChat(ctx) {
  const { groupId, userId, message, invokedNpcId = null, npcMembers: providedNpcMembers = null, history = [], options = {} } = ctx;
  const logPrefix = GroupLogContext.get(groupId, userId, 'ROUTE');

  console.log(`${logPrefix} 🧠 AICoreRouter: Routing Group Chat`, {
    groupId,
    userId,
    messageLen: message?.length,
    historyCount: history?.length,
    npcCount: providedNpcMembers?.length,
    npcNames: providedNpcMembers ? providedNpcMembers.map(n => n.name).join(', ') : 'N/A',
    invokedNpcId
  });

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
      .select('id, name, gender, personality_type, tone, age, ethnicity, hair_color, eye_color, body_type, avatar_url, face_image_url, group_behavior_profile, npc_json, prompt_system, preferences')
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

  // 3. Think Group (GroupBrainEngine) - Call for each NPC
  const replies = [];

  for (const npc of npcMembers) {
    const npcContext = {
      npcId: npc.id,
      groupId,
      userMessage: message,
      userId,
      history,
      invokedNpcId
    };

    console.log(`[AICoreRouter] Calling thinkInGroup for NPC: ${npc.id} (${npc.name})`);

    const reply = await thinkGroup(npcContext);

    console.log(`[AICoreRouter] thinkInGroup returned for ${npc.id}:`, {
      type: typeof reply,
      silent: reply?.silent,
      hasText: !!reply?.text
    });

    // Only add non-silent replies
    if (reply && !reply.silent && reply.text) {
      replies.push({
        npcId: npc.id,
        text: reply.text,
        output: reply.text, // Compatibility
        mediaRequest: reply.mediaRequest || null
      });
    }
  }

  // 🔍 DIAGNOSTIC LOGGING
  console.log("[AICoreRouter] All thinkInGroup calls completed:", {
    totalNpcs: npcMembers.length,
    repliesCount: replies.length,
    replies: replies.map(r => ({ npcId: r.npcId, hasText: !!r.text }))
  });

  // 4. Return structured output
  return {
    responses: replies,
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
