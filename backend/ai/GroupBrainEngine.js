const { supabase } = require('../lib/supabase');
const generateChatReply = require('../routes/openRouterService');

// Simple in-memory cache
const groupContextCache = new Map();
const CACHE_TTL = 10 * 60 * 1000; // 10 minutes

/**
 * Loads group context (members, NPCs, relations)
 * Caches result for 10 minutes.
 */
async function loadGroupContext(groupId) {
    const now = Date.now();
    if (groupContextCache.has(groupId)) {
        const cached = groupContextCache.get(groupId);
        if (now - cached.timestamp < CACHE_TTL) {
            return cached.data;
        }
    }

    // 1. Fetch group members (users and NPCs)
    const { data: members, error } = await supabase
        .from('group_members')
        .select(`
      member_id,
      member_type,
      npcs (
        id, name, bio, personality_type, tone, avatar_url,
        age, ethnicity, hair_color, eye_color, body_type
      ),
      users (
        id, name, avatar_url
      )
    `)
        .eq('group_id', groupId);

    if (error) {
        console.error('Error loading group context:', error);
        return null;
    }

    // 2. Fetch NPC relations (mocked or from DB if table exists)
    // Assuming ai_relations table exists as seen in schema.sql
    const { data: relations } = await supabase
        .from('ai_relations')
        .select('*')
        .eq('group_id', groupId);

    const npcRelations = {};
    if (relations) {
        relations.forEach(rel => {
            if (!npcRelations[rel.ai_id_1]) npcRelations[rel.ai_id_1] = {};
            if (!npcRelations[rel.ai_id_2]) npcRelations[rel.ai_id_2] = {};

            npcRelations[rel.ai_id_1][rel.ai_id_2] = rel.relationship_type;
            npcRelations[rel.ai_id_2][rel.ai_id_1] = rel.relationship_type;
        });
    }

    // 3. Construct Group Memory Object
    const groupMemory = {
        groupId,
        members: members.map(m => {
            if (m.member_type === 'ai' && m.npcs) {
                return {
                    id: m.npcs.id,
                    type: 'npc',
                    name: m.npcs.name,
                    bio: m.npcs.bio || `A ${m.npcs.age} year old ${m.npcs.ethnicity} woman.`,
                    personality: m.npcs.personality_type,
                    traits: m.npcs.tone, // using tone as traits for now
                    avatar: m.npcs.avatar_url,
                    // Default group behavior if not present in DB
                    groupBehavior: m.npcs.group_behavior_profile || {
                        talkFrequency: 0.25,
                        interruptStyle: 'polite',
                        groupRole: 'observer'
                    }
                };
            } else if (m.member_type === 'user' && m.users) {
                return {
                    id: m.users.id,
                    type: 'user',
                    name: m.users.name || 'User',
                    bio: 'Group member',
                    avatar: m.users.avatar_url
                };
            }
            return null;
        }).filter(Boolean),
        npcRelations
    };

    // Save to cache
    groupContextCache.set(groupId, {
        timestamp: now,
        data: groupMemory
    });

    return groupMemory;
}

/**
 * Registers an NPC in a group if not already registered.
 * Creates initial knowledge card.
 */
async function registerNpcInGroup(npc, groupId) {
    // Check if already registered in npc_group_state
    const { data: existing } = await supabase
        .from('npc_group_state')
        .select('id')
        .eq('npc_id', npc.id)
        .eq('group_id', groupId)
        .single();

    if (!existing) {
        // Create knowledge card
        const groupContext = await loadGroupContext(groupId);
        const knownMembers = groupContext ? groupContext.members.map(m => m.id) : [];

        await supabase
            .from('npc_group_state')
            .insert({
                npc_id: npc.id,
                group_id: groupId,
                known_members: knownMembers,
                first_intro_done: false,
                last_active: new Date().toISOString()
            });

        console.log(`Registered NPC ${npc.name} in group ${groupId}`);
    }
}

/**
 * Detects if an NPC is explicitly invoked in the text.
 */
function detectNpcInvocation(text, npcName) {
    if (!text || !npcName) return false;
    const lowerText = text.toLowerCase();
    const lowerName = npcName.toLowerCase();

    // Patterns: "@Name", "Name?", "Name,"
    if (lowerText.includes(`@${lowerName}`)) return true;
    if (lowerText.includes(`${lowerName}?`)) return true;
    if (lowerText.includes(`${lowerName} `)) return true; // Name at start or middle
    if (lowerText.endsWith(lowerName)) return true; // Name at end

    return false;
}

/**
 * Detects which NPC is invoked from a list of members.
 * Returns the ID of the first invoked NPC found, or null.
 */
function detectInvokedNpcId(text, members) {
    if (!text || !members) return null;
    const lowerText = text.toLowerCase();

    for (const member of members) {
        // Handle both flat objects and nested objects (e.g. from Supabase join)
        const name = member.name || member.npcs?.name;
        const id = member.id || member.npcs?.id;

        if (name && id) {
            const lowerName = name.toLowerCase();
            if (lowerText.includes(lowerName)) {
                return id;
            }
        }
    }
    return null;
}

/**
 * Main decision engine for NPC in group.
 */
async function thinkInGroup(context) {
    const { npcId, groupId, userMessage, history, invokedNpcId } = context;

    // 1. Load Context
    const groupContext = await loadGroupContext(groupId);
    if (!groupContext) return { silent: true };

    const me = groupContext.members.find(m => m.id === npcId);
    if (!me) return { silent: true };

    // 2. Check Registration / First Intro
    let isFirstIntro = false;
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

    // 3. Decision to Speak
    // Check if *I* am the one invoked
    const isInvoked = (invokedNpcId === npcId) || detectNpcInvocation(userMessage, me.name);
    const isRelevant = userMessage.toLowerCase().includes(me.name.toLowerCase()); // Simple relevance check

    // Probability check (unless invoked or relevant or first intro)
    let shouldSpeak = false;
    const talkProbability = me.groupBehavior?.talkFrequency || 0.25;

    if (isInvoked || isRelevant || isFirstIntro) {
        shouldSpeak = true;
    } else {
        shouldSpeak = Math.random() < talkProbability;
    }

    if (!shouldSpeak) {
        return { silent: true };
    }

    // 4. Media Logic
    let mediaRequest = null;
    // Only consider media if not first intro and random chance
    if (!isFirstIntro && Math.random() < 0.10) { // 10% chance
        const role = me.groupBehavior?.groupRole || 'observer';
        if (role === 'flirty' || role === 'playful') {
            // Check if we already sent media this session? (Simplified: just allow it for now, 
            // maybe check history for recent media from me)
            const myRecentMedia = history.find(m => m.sender_id === npcId && m.type !== 'text');
            if (!myRecentMedia) {
                // Allow media
                // We don't generate it here, we just flag it for the prompt or return a media request
                // But the prompt says "L’Engine deve arricchire il prompt... Se un NPC invia un media... deve apparire come..."
                // We will let the LLM decide if it wants to send media based on the prompt instructions.
            }
        }
    }

    // 5. Prepare Prompt for Venice
    const systemPrompt = buildGroupSystemPrompt(me, groupContext, isFirstIntro, state);

    // 6. Call LLM
    // We use the existing generateChatReply or similar. 
    // We need to pass the system prompt and the history.

    // Format history for LLM
    const formattedHistory = history.map(h => ({
        role: h.sender_id === npcId ? 'assistant' : 'user', // Simplified, actually need to distinguish other NPCs
        content: `${h.sender_name || 'User'}: ${h.content}`
    }));

    // Add current user message
    formattedHistory.push({
        role: 'user',
        content: `User: ${userMessage}`
    });

    try {
        const response = await generateChatReply(formattedHistory, systemPrompt, {
            temperature: 0.8,
            max_tokens: 150
        });

        // 7. Parse Response
        // We expect the LLM to just reply with text, or maybe a JSON if we instructed it for media.
        // For now, let's assume text. If we want media, we might need to instruct the LLM to output a specific tag.

        let finalText = response;
        let finalMediaRequest = null;

        // Check for media tag if we instructed it (we haven't yet, but let's add it to prompt)
        if (finalText.includes('[MEDIA:')) {
            // Parse media request
            // [MEDIA:photo|caption]
            const match = finalText.match(/\[MEDIA:(.*?)\]/);
            if (match) {
                const content = match[1].split('|');
                const type = content[0];
                const caption = content[1] || '';
                finalMediaRequest = {
                    type: type, // photo, video, audio
                    details: caption
                };
                finalText = finalText.replace(match[0], '').trim();
            }
        }

        // Update state if first intro
        if (isFirstIntro) {
            await supabase
                .from('npc_group_state')
                .update({ first_intro_done: true })
                .eq('npc_id', npcId)
                .eq('group_id', groupId);
        }

        return {
            silent: false,
            text: finalText,
            mediaRequest: finalMediaRequest
        };

    } catch (err) {
        console.error('Error in thinkInGroup LLM call:', err);
        return { silent: true };
    }
}

function buildGroupSystemPrompt(me, groupContext, isFirstIntro, state) {
    const otherMembers = groupContext.members.filter(m => m.id !== me.id);
    const relations = groupContext.npcRelations[me.id] || {};

    let prompt = `You are ${me.name}, a ${me.personality} character in a group chat.\n`;
    prompt += `Bio: ${me.bio}\n`;
    prompt += `Traits: ${me.traits}\n`;
    prompt += `Role in group: ${me.groupBehavior?.groupRole || 'member'}\n\n`;

    prompt += `Group Members:\n`;
    otherMembers.forEach(m => {
        const rel = relations[m.id] || 'neutral';
        prompt += `- ${m.name} (${m.type}): ${rel}\n`;
    });

    prompt += `\nContext:\n`;
    if (isFirstIntro) {
        prompt += `This is your first time speaking in this group. Introduce yourself briefly, recognize others if you know them, and make a joke or comment consistent with your personality.\n`;
    } else {
        prompt += `You are participating in the conversation. Be natural, concise, and engaging.\n`;
    }

    // Media instructions
    if (me.groupBehavior?.groupRole === 'flirty' || me.groupBehavior?.groupRole === 'playful') {
        prompt += `\nYou can occasionally send a photo/selfie if the mood is right. To send a photo, include [MEDIA:photo|description of photo] in your response. Do NOT send explicit content. Only send if it fits the flow.\n`;
    }

    return prompt;
}

module.exports = {
    loadGroupContext,
    registerNpcInGroup,
    thinkInGroup,
    detectNpcInvocation,
    detectInvokedNpcId
};
