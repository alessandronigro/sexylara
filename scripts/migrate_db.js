#!/usr/bin/env node

/**
 * Database Migration Script
 * Adds allow_member_invite column to groups table
 */

const fs = require('fs');
const path = require('path');

// Load environment variables from backend/.env
require('dotenv').config({ path: path.join(__dirname, '../backend/.env') });

const { supabase } = require('../backend/lib/supabase');

async function runMigration() {
    try {
        console.log('🔧 Checking database migration status...\n');

        // Read migration file
        const migrationPath = path.join(__dirname, '../supabase/migrations/add_allow_member_invite.sql');
        const migrationSQL = fs.readFileSync(migrationPath, 'utf8');

        // Try to verify if column exists by querying
        console.log('🔍 Checking if column already exists...');
        const { data, error } = await supabase
            .from('groups')
            .select('id, allow_member_invite')
            .limit(1);

        if (error) {
            if (error.message.includes('column') && error.message.includes('does not exist')) {
                console.log('❌ Column "allow_member_invite" does not exist yet.\n');
                console.log('📋 Please run this migration manually via Supabase Dashboard:\n');
                console.log('   1. Go to: https://supabase.com/dashboard/project/tnxdohjldclgbyadgdnt/sql');
                console.log('   2. Create a new query');
                console.log('   3. Copy and paste the SQL below');
                console.log('   4. Click "Run"\n');
                console.log('─'.repeat(70));
                console.log(migrationSQL);
                console.log('─'.repeat(70));
                console.log('\n✅ After running the migration, restart the backend with: pm2 reload all\n');
                process.exit(0);
            } else {
                console.error('❌ Error checking column:', error.message);
                process.exit(1);
            }
        } else {
            console.log('✅ Column "allow_member_invite" already exists!');
            console.log('✅ Migration has been run successfully.');
            if (data && data.length > 0) {
                console.log('📊 Sample data:', data[0]);
            }
            process.exit(0);
        }

    } catch (error) {
        console.error('❌ Migration check failed:', error.message);
        process.exit(1);
    }
}

runMigration();
