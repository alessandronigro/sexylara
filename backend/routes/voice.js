const express = require('express');
const router = express.Router();
const multer = require('multer');
const storageService = require('../services/supabase-storage');
const { supabase } = require('../lib/supabase');

// Configure multer for file upload
const upload = multer({
    storage: multer.memoryStorage(),
    limits: {
        fileSize: 50 * 1024 * 1024, // 50MB max
    },
    fileFilter: (req, file, cb) => {
        const allowedMimes = ['audio/mpeg', 'audio/mp3', 'audio/wav', 'audio/ogg', 'audio/flac'];
        if (allowedMimes.includes(file.mimetype)) {
            cb(null, true);
        } else {
            cb(new Error('Invalid file type. Only audio files are allowed.'));
        }
    },
});

/**
 * Upload voice preview for npc (legacy param kept)
 * POST /api/voice/upload/:npcId
 */
router.post('/upload/:npcId', upload.single('audio'), async (req, res) => {
    try {
        const { npcId } = req.params;

        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        // Upload to Supabase Storage
        const result = await storageService.uploadVoiceMaster(
            req.file.buffer,
            npcId,
            req.file.originalname
        );

        // Update npc record with voice_preview_url
        const { error: updateError } = await supabase
            .from('npcs')
            .update({ voice_preview_url: result.publicUrl })
            .eq('id', npcId);

        if (updateError) {
            console.error('Error updating npc:', updateError);
            return res.status(500).json({ error: 'Failed to update npc' });
        }

        res.json({
            success: true,
            url: result.publicUrl,
            message: 'Voice preview uploaded successfully',
        });
    } catch (error) {
        console.error('Error uploading voice preview:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Upload default voice preview (for initial setup)
 * POST /api/voice/upload-default
 */
router.post('/upload-default', upload.single('audio'), async (req, res) => {
    try {
        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        // Upload to Supabase Storage with a default name
        const result = await storageService.uploadVoiceMaster(
            req.file.buffer,
            'default',
            'default-voice.mp3'
        );

        res.json({
            success: true,
            url: result.publicUrl,
            message: 'Default voice preview uploaded successfully',
        });
    } catch (error) {
        console.error('Error uploading default voice:', error);
        res.status(500).json({ error: error.message });
    }
});

/**
 * Get voice preview URL for npc
 * GET /api/voice/:npcId
 */
router.get('/:npcId', async (req, res) => {
    try {
        const { npcId } = req.params;

        const { data, error } = await supabase
            .from('npcs')
            .select('voice_preview_url')
            .eq('id', npcId)
            .single();

        if (error) {
            return res.status(404).json({ error: 'NPC not found' });
        }

        res.json({
            url: data.voice_preview_url || null,
        });
    } catch (error) {
        console.error('Error fetching voice preview:', error);
        res.status(500).json({ error: error.message });
    }
});

module.exports = router;
