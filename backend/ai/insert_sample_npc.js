require('dotenv').config({ path: '../../env/local.env' });
const { supabase } = require('../lib/supabase');
const { randomUUID } = require('crypto');

async function insertSampleNpc() {
    try {
        const dummyUserId = randomUUID();
        const { data, error } = await supabase.from('npcs').insert({
            id: randomUUID(),
            user_id: dummyUserId,
            name: 'Luna',
            avatar_url: null,
            ethnicity: 'latina',
            body_type: 'curvy',
            hair_length: 'long',
            hair_color: 'black',
            eye_color: 'brown',
            height_cm: 165,
            age: 25,
            personality_type: 'sweet',
            tone: 'flirty',
            characteristics: {},
            is_active: true,
        });
        if (error) {
            console.error('❌ Insert error:', error);
        } else {
            console.log('✅ Inserted NPC:', data);
        }
    } catch (e) {
        console.error('❌ Unexpected error:', e);
    }
}

insertSampleNpc();
