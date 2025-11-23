require('dotenv').config();
const storageService = require('./services/supabase-storage');

async function initializeStorage() {
    console.log('🚀 Inizializzazione Supabase Storage...');

    try {
        await storageService.initializeBuckets();
        console.log('✅ Supabase Storage inizializzato con successo!');
        process.exit(0);
    } catch (error) {
        console.error('❌ Errore inizializzazione:', error);
        process.exit(1);
    }
}

initializeStorage();
