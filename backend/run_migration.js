require('dotenv').config();
const { createClient } = require('@supabase/supabase-js');
const fs = require('fs');
const path = require('path');

const supabaseUrl = process.env.SUPABASE_URL;
const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

if (!supabaseUrl || !supabaseServiceKey) {
    console.error('❌ Missing SUPABASE_URL or SUPABASE_SERVICE_ROLE_KEY');
    process.exit(1);
}

const supabase = createClient(supabaseUrl, supabaseServiceKey);

async function runMigration() {
    const migrationFile = process.argv[2];

    if (!migrationFile) {
        console.error('❌ Usage: node run_migration.js <migration_file.sql>');
        process.exit(1);
    }

    const migrationPath = path.join(__dirname, '..', 'supabase', 'migrations', migrationFile);

    if (!fs.existsSync(migrationPath)) {
        console.error(`❌ Migration file not found: ${migrationPath}`);
        process.exit(1);
    }

    const sql = fs.readFileSync(migrationPath, 'utf8');

    console.log(`🔄 Running migration: ${migrationFile}`);
    console.log(`📝 SQL:\n${sql}\n`);

    try {
        const { data, error } = await supabase.rpc('exec_sql', { sql_query: sql });

        if (error) {
            console.error('❌ Migration failed:', error);
            process.exit(1);
        }

        console.log('✅ Migration completed successfully!');
    } catch (err) {
        console.error('❌ Error running migration:', err);
        process.exit(1);
    }
}

runMigration();
