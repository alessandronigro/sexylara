require('dotenv').config({ path: '../../env/local.env' });
const { supabase } = require('../lib/supabase');
// Import the updated store modules (they already use supabase internally)
const { getNpcProfile, updateNpcProfile } = require('./memory/NpcMemoryStore');
const { getUserSummary } = require('./memory/UserMemoryStore');
const { getGroupSummary } = require('./memory/GroupMemoryStore');
const { recordEpisode } = require('./memory/EpisodicMemoryStore');
const { addMedia, listMedia } = require('./memory/MediaMemoryStore');
const { getEpisodes } = require('./memory/EpisodicMemoryStore');

async function main() {
    console.log('🔎 Starting Supabase sync validation...');

    // 1️⃣ Pick a sample NPC (girlfriend) – first record in table
    const { data: npcData, error: npcErr } = await supabase
        .from('npcs')
        .select('id, name')
        .limit(1);
    if (npcErr || !npcData || npcData.length === 0) {
        console.error('❌ Could not fetch NPC:', npcErr || 'no rows');
        return;
    }
    const npc = npcData[0];
    const npcId = npc.id;
    console.log('✅ Sample NPC:', npc);

    // 2️⃣ Fetch NPC profile via store
    const npcProfile = await getNpcProfile(npcId);
    console.log('🧠 NPC Profile from store:', npcProfile);

    // 3️⃣ Pick a sample user – first auth user (if any)
    const { data: userData, error: userErr } = await supabase
        .from('auth.users')
        .select('id')
        .limit(1)
        .single();
    let userId = null;
    if (userErr) {
        console.warn('⚠️ No auth.users table or no users found – skipping user‑related checks');
    } else {
        userId = userData.id;
        console.log('✅ Sample User ID:', userId);

        // 4️⃣ User summary
        const userSummary = await getUserSummary(userId, npcId);
        console.log('👤 User Summary from store:', userSummary);
    }

    // 5️⃣ Sample group – first group (if any)
    const { data: groupData, error: groupErr } = await supabase
        .from('groups')
        .select('id')
        .limit(1)
        .single();
    if (groupErr) {
        console.warn('⚠️ No groups found – skipping group‑related checks');
    } else {
        const groupId = groupData.id;
        console.log('✅ Sample Group ID:', groupId);
        const groupSummary = await getGroupSummary(groupId);
        console.log('👥 Group Summary from store:', groupSummary);
    }

    // 6️⃣ Record a test episode (will create a row in significant_events)
    if (userId) {
        await recordEpisode(npcId, {
            userId,
            description: 'Test episode from sync validation script',
            impact: 'low',
        });
        console.log('🗓️ Recorded test episode');
    }

    // 7️⃣ Add a test media entry and list media
    await addMedia(npcId, {
        type: 'image',
        url: 'https://example.com/test-image.jpg',
        caption: 'Test image added by sync script',
    });
    const mediaList = await listMedia(npcId);
    console.log('📸 Media list for NPC (should include test entry):', mediaList);

    // 8️⃣ Fetch episodes for NPC
    const episodes = await getEpisodes(npcId);
    console.log('📚 Episodes for NPC (latest):', episodes.slice(0, 3)); // show first few

    console.log('✅ Sync validation completed');
}

main().catch((e) => console.error('❌ Unexpected error in validation script:', e));
