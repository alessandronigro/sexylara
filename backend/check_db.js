require('dotenv').config({ path: '../env/local.env' });
const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseKey = process.env.SUPABASE_ANON_KEY; // Using anon key, might need service role for some checks

if (!supabaseUrl || !supabaseKey) {
    console.error('Missing Supabase credentials');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseKey);

async function checkTables() {
    console.log('Checking tables...');

    const tables = [
        'user_memory',
        'ai_user_memory',
        'group_memory',
        'ai_relations',
        'significant_events',
        'ai_personality_evolution'
    ];

    for (const table of tables) {
        const { error } = await supabase.from(table).select('count', { count: 'exact', head: true });
        if (error) {
            console.error(`❌ Table '${table}' check failed:`, error.message);
        } else {
            console.log(`✅ Table '${table}' exists.`);
        }
    }
}

checkTables();
