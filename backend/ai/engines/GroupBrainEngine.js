const { supabase } = require('../../lib/supabase');
const generateChatReply = require('../../routes/openRouterService');
const { classifySexualIntentV3 } = require('../intent/intentLLM');


const groupContextCache = new Map();
const CACHE_TTL = 10 * 60 * 1000;

/**
 * Computes group NPC mode based on semantic sexual intent classification
 * @param {string} userText - User's message text
 * @returns {Promise<{explicitMode: boolean, sexualMode: boolean, intentLabel: string}>}
 */
async function computeGroupNpcMode(userText) {
    const intent = await classifySexualIntentV3(userText);

    switch (intent) {
        case "sessuale_esplicito":
            return { explicitMode: true, sexualMode: true, intentLabel: intent };
        case "sessuale_soft":
            return { explicitMode: true, sexualMode: false, intentLabel: intent };
        default:
            return { explicitMode: false, sexualMode: false, intentLabel: intent };
    }
}

// ===============================================
// TURNAZIONE NATURALE NPC DI GRUPPO
// ===============================================

/**
 * Mantiene la rotazione tra NPC (Genny → Sara → Genny → …)
 */
let lastNpcResponder = null;

/**
 * Seleziona quale NPC deve rispondere,
 * garantendo 1 sola risposta a turno
 */
function selectNpcTurnation(members, invokedNpcId, userSemanticIntent) {
    // 1. Se l'utente invoca Genny o Sara → risponde SOLO quello
    if (invokedNpcId) {
        return [invokedNpcId];
    }

    // 2. Se il messaggio è sessuale esplicito → rispondono entrambi
    if (userSemanticIntent === "sessuale_esplicito") {
        return members.filter(m => m.type === "npc").map(m => m.id);
    }

    // 3. Turnazione naturale (solo un NPC parla)
    const npcIds = members.filter(m => m.type === "npc").map(m => m.id);

    if (!npcIds || npcIds.length === 0) {
        return [];
    }

    if (!lastNpcResponder || !npcIds.includes(lastNpcResponder)) {
        // primo turno o NPC precedente non più presente → prendi il primo NPC
        lastNpcResponder = npcIds[0];
        return [npcIds[0]];
    }

    // Trova prossimo NPC in rotazione
    const idx = npcIds.indexOf(lastNpcResponder);
    const nextIdx = (idx + 1) % npcIds.length;
    lastNpcResponder = npcIds[nextIdx];

    return [npcIds[nextIdx]];
}

const normalizeBehavior = (profile) => ({
    talkFrequency: Number(profile?.talkFrequency ?? profile?.talk_frequency ?? 0.25) || 0.25,
    groupRole: profile?.groupRole || profile?.group_role || 'member'
});

async function loadGroupContext(groupId) {
    const now = Date.now();
    const cached = groupContextCache.get(groupId);
    if (cached && now - cached.timestamp < CACHE_TTL) return cached.data;

    const { data: members, error: membersError } = await supabase
        .from('group_members')
        .select('member_id, member_type, npc_id, role')
        .eq('group_id', groupId);
    if (membersError) {
        console.error('Error loading group context:', membersError);
        return null;
    }

    const npcIds = members
        .filter(m => m.member_type === 'npc' || m.member_type === 'ai')
        .map(m => m.npc_id || m.member_id);
    const userIds = members
        .filter(m => m.member_type === 'user')
        .map(m => m.member_id);

    let npcMap = {};
    if (npcIds.length > 0) {
        const { data: npcData, error: npcError } = await supabase
            .from('npcs')
            .select('id, name, personality_type, tone, age, ethnicity, avatar_url, group_behavior_profile')
            .in('id', npcIds);
        if (npcError) console.error('Error loading NPC data:', npcError);
        npcMap = (npcData || []).reduce((acc, n) => {
            acc[n.id] = n;
            return acc;
        }, {});
    }

    let userMap = {};
    if (userIds.length > 0) {
        const { data: userData, error: userError } = await supabase
            .from('user_profile')
            .select('id, name, username, avatar_url')
            .in('id', userIds);
        if (userError) console.error('Error loading user data:', userError);
        userMap = (userData || []).reduce((acc, u) => {
            acc[u.id] = u;
            return acc;
        }, {});
    }

    const { data: relations, error: relError } = await supabase
        .from('ai_relations')
        .select('*')
        .eq('group_id', groupId);
    if (relError) console.error('Error loading relations:', relError);

    const npcRelations = {};
    (relations || []).forEach(rel => {
        if (!npcRelations[rel.ai_id_1]) npcRelations[rel.ai_id_1] = {};
        if (!npcRelations[rel.ai_id_2]) npcRelations[rel.ai_id_2] = {};
        npcRelations[rel.ai_id_1][rel.ai_id_2] = rel.relationship_type;
        npcRelations[rel.ai_id_2][rel.ai_id_1] = rel.relationship_type;
    });

    const { data: storedMemory, error: memError } = await supabase
        .from('group_memory')
        .select('summary, dynamics')
        .eq('group_id', groupId)
        .single();
    if (memError && memError.code !== 'PGRST116') console.error('Error loading group memory:', memError);

    const groupContext = {
        groupId,
        memory: storedMemory || { summary: 'Nessuna memoria salvata.', dynamics: {} },
        members: members.map(m => {
            if (m.member_type === 'npc' || m.member_type === 'ai') {
                const npc = npcMap[m.npc_id || m.member_id] || {};
                return {
                    id: npc.id || m.npc_id || m.member_id,
                    type: 'npc',
                    name: npc.name || 'NPC',
                    bio: npc.bio || `${npc.name || 'NPC'}, personalità ${npc.personality_type || ''}`.trim(),
                    personality: npc.personality_type || 'sconosciuta',
                    tone: npc.tone || 'neutro',
                    avatar: npc.avatar_url || null,
                    groupBehavior: normalizeBehavior(npc.group_behavior_profile || {})
                };
            }
            const user = userMap[m.member_id] || {};
            return {
                id: user.id || m.member_id,
                type: 'user',
                name: user.username || user.name || 'Utente',
                avatar: user.avatar_url || null
            };
        }),
        npcRelations
    };

    groupContextCache.set(groupId, { timestamp: now, data: groupContext });
    return groupContext;
}

async function registerNpcInGroup(npc, groupId) {
    const { data: existing } = await supabase
        .from('npc_group_state')
        .select('id')
        .eq('npc_id', npc.id)
        .eq('group_id', groupId)
        .single();

    if (!existing) {
        const groupContext = await loadGroupContext(groupId);
        const knownMembers = (groupContext?.members || []).map(m => m.id);

        await supabase.from('npc_group_state').insert({
            npc_id: npc.id,
            group_id: groupId,
            known_members: knownMembers,
            first_intro_done: false,
            last_active: new Date().toISOString()
        });
    }
}

function detectNpcInvocation(text, npcName) {
    if (!text || !npcName) return false;
    const t = text.toLowerCase();
    const n = npcName.toLowerCase();
    return (
        t.includes(`@${n}`) ||
        t.includes(`${n}?`) ||
        t.includes(`${n},`) ||
        t.includes(`${n} `) ||
        t.endsWith(n)
    );
}

// PATCH: rilevamento NPC invocato con priorità sulla prima occorrenza nel testo
function detectInvokedNpcId(text, members) {
    if (!text) return null;

    if (typeof text !== "string") {
        if (text?.snippet) text = text.snippet;
        else text = String(text);
    }
    text = text.trim().toLowerCase();
    if (!text) return null;

    let matches = [];

    for (const m of members || []) {
        if (m.type !== 'npc') continue;
        const name = m.name?.toLowerCase();
        if (!name) continue;

        const index = text.indexOf(name);
        if (index !== -1) {
            matches.push({ npcId: m.id, index });
        }
    }

    // nessun match → nessuna invocazione
    if (matches.length === 0) return null;

    // se più NPC nominati → prende quello nominato per primo
    matches.sort((a, b) => a.index - b.index);
    return matches[0].npcId;
}

function buildGroupPrompt(ai, userProfile, groupData, userMessage) {
    const membersList = (groupData.members || [])
        .map(m => `- ${m.name} (${m.type === 'npc' ? 'AI' : 'utente'})`)
        .join('\n');

    const recentMsgs = (groupData.recentMessages || [])
        .map(m => `${m.senderName}: ${m.content}`)
        .join('\n');

    return `
Tu sei ${ai.name}, un personaggio AI all'interno di un gruppo.

=== IDENTITÀ DEL GRUPPO ===
Membri:
${membersList}

Ruolo tuo: ${ai.groupBehavior.groupRole || 'membro'}
Personalità: ${ai.personality}
Stile: ${ai.tone}

=== PROFILO UTENTE ===
Nome: ${userProfile.name}
Genere: ${userProfile.gender}
Età: ${userProfile.age || 'non specificata'}

=== MEMORIA COLLETTIVA ===
${groupData.memory.summary}

=== DINAMICHE SOCIALI ===
${JSON.stringify(groupData.memory.dynamics || {}, null, 2)}

=== MESSAGGI RECENTI ===
${recentMsgs}

=== ISTRUZIONI ===
1. Rispondi come ${ai.name}, mai come assistente.
2. Riconosci gli altri membri.
3. Sii naturale, spontaneo, variato.
4. Alterna brevi e lunghi messaggi.
5. Evita ripetizioni o frasi standard.
6. UniqueResponseSeed: ${Math.random().toString(36).slice(2)}

=== MESSAGGIO UTENTE ===
"${userMessage}"
`.trim();
}

async function thinkInGroup(context) {
    const { npcId, groupId, userMessage, userId, history, invokedNpcId } = context;

    console.log("[DEBUG][thinkInGroup] START", {
        npcId: context.npcId,
        userMessage: context.userMessage,
        invokedNpcId: context.invokedNpcId
    });

    const groupContext = await loadGroupContext(groupId);
    if (!groupContext) return { silent: true };

    const me = groupContext.members.find(m => m.id === npcId && m.type === 'npc');
    if (!me) return { silent: true };

    let userProfile = null;
    try {
        const { data } = await supabase
            .from('user_profile')
            .select('id, name, gender, age, bio')
            .eq('id', userId)
            .single();
        userProfile = data;
    } catch (err) {
        console.error('Error loading user profile for group chat:', err?.message || err);
    }
    if (!userProfile) {
        userProfile = { name: 'Utente', gender: 'Uomo', age: null, bio: null };
    }

    let isFirstIntro = false;
    try {
        const { data: state } = await supabase
            .from('npc_group_state')
            .select('*')
            .eq('npc_id', npcId)
            .eq('group_id', groupId)
            .single();

        if (!state) {
            await registerNpcInGroup(me, groupId);
            isFirstIntro = true;
        } else if (!state.first_intro_done) {
            isFirstIntro = true;
        }
    } catch (stateErr) {
        console.error('Error checking npc_group_state:', stateErr?.message || stateErr);
    }

    const isInvoked = invokedNpcId === npcId || detectNpcInvocation(userMessage, me.name);
    const talkProbability = normalizeBehavior(me.groupBehavior).talkFrequency;
    const talkRoll = Math.random();
    const decisionReason = isInvoked
        ? 'explicit_invocation'
        : isFirstIntro
            ? 'first_introduction'
            : talkRoll < talkProbability
                ? 'random_chance'
                : 'silenced_by_probability';
    const shouldSpeak = isInvoked || isFirstIntro || talkRoll < talkProbability;
    const decisionMeta = {
        isInvoked,
        isFirstIntro,
        talkProbability,
        talkRoll: Number(talkRoll.toFixed(3)),
        reason: decisionReason,
        shouldSpeak,
        invokedNpcId
    };
    console.log("[DEBUG][thinkInGroup] Decision Meta:", decisionMeta);

    // FORCE NPC RESPONSE - Never suppress based on probability
    // if (!shouldSpeak) return { silent: true, decision: decisionMeta };

    const normalizedHistory = (history || []).map(h => ({
        sender_id: h.sender_id,
        sender_name: h.sender_name || 'Utente',
        content: h.content
    }));

    const systemPrompt = buildGroupPrompt(
        me,
        userProfile,
        {
            name: groupContext.groupId,
            members: groupContext.members,
            memory: groupContext.memory,
            recentMessages: normalizedHistory.map(h => ({
                senderName: h.sender_name,
                content: h.content
            }))
        },
        userMessage
    );

    // ============================================================
    // SEMANTIC INTENT CLASSIFICATION V3
    // ============================================================
    const mode = await computeGroupNpcMode(userMessage);
    console.log('[GroupBrainEngine] Semantic intent:', mode.intentLabel, '— Routing model:', mode);
    console.log("[DEBUG][thinkInGroup] Intent Mode:", mode);

    // ============================================================
    // TURNAZIONE NPC - Verifica se questo NPC deve rispondere
    // ============================================================
    const npcIdsToRespond = selectNpcTurnation(
        groupContext.members,
        invokedNpcId,
        mode.intentLabel
    );

    if (!npcIdsToRespond.includes(npcId)) {
        console.log(`[GroupBrainEngine] NPC ${npcId} skipped by turnation (selected: ${npcIdsToRespond.join(', ')})`);
        return { silent: true, reason: "turnazione_skip" };
    }

    console.log(`[GroupBrainEngine] NPC ${npcId} selected to respond (turnation)`);

    try {
        const formattedHistory = normalizedHistory.map(h => ({
            role: h.sender_id === npcId ? 'assistant' : 'user',
            content: `${h.sender_name}: ${h.content}`
        }));

        // Usa overrideSystemPrompt + history corretti: il messaggio utente resta separato
        console.log("[DEBUG][ModelCall] Calling LLM for npc:", npcId);
        const reply = await generateChatReply(
            `${userProfile.name}: ${userMessage}`,
            'sensuale',
            null,
            null,
            systemPrompt,
            formattedHistory
        );
        console.log("[DEBUG][ModelCall] LLM reply raw:", reply);

        if (isFirstIntro) {
            await supabase
                .from('npc_group_state')
                .update({ first_intro_done: true })
                .eq('npc_id', npcId)
                .eq('group_id', groupId);
        }

        // Estrai la stringa dall'oggetto reply (generateChatReply ritorna { type, output, stateUpdates })
        const replyText = typeof reply === 'string' ? reply : (reply?.output || reply?.text || '');

        console.log("[DEBUG][thinkInGroup] Final result:", {
            npcId,
            silent: false,
            text: replyText
        });

        return {
            silent: false,
            text: replyText,
            mediaRequest: null,
            decision: decisionMeta
        };
    } catch (err) {
        console.error('[ERROR][thinkInGroup] LLM error:', err);
        return { silent: true, decision: decisionMeta };
    }
}

module.exports = {
    loadGroupContext,
    registerNpcInGroup,
    thinkInGroup,
    think: thinkInGroup, // Alias for compatibility
    detectNpcInvocation,
    detectInvokedNpcId,
    buildGroupPrompt,
    computeGroupNpcMode
};


