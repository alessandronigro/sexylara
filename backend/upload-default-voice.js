require('dotenv').config();
const fs = require('fs').promises;
const path = require('path');
const storageService = require('./services/supabase-storage');

async function uploadDefaultVoice() {
    console.log('🎤 Caricamento voice preview di default su Supabase Storage...');

    try {
        // Read the preview-audio.mp3 file
        const audioPath = path.join(__dirname, 'public', 'preview-audio.mp3');
        const audioBuffer = await fs.readFile(audioPath);

        console.log(`📁 File trovato: ${audioPath}`);
        console.log(`📊 Dimensione: ${(audioBuffer.length / 1024).toFixed(2)} KB`);

        // Upload to Supabase Storage
        const result = await storageService.uploadVoiceMaster(
            audioBuffer,
            'default',
            'default-voice.mp3'
        );

        console.log('✅ Voice preview caricato con successo!');
        console.log(`🔗 URL pubblico: ${result.publicUrl}`);
        console.log('\n📝 Salva questo URL per usarlo come voice preview di default per le nuove girlfriends.');

        process.exit(0);
    } catch (error) {
        console.error('❌ Errore durante il caricamento:', error);
        process.exit(1);
    }
}

uploadDefaultVoice();
