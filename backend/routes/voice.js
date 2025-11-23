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
 * Upload voice preview for girlfriend
 * POST /api/voice/upload/:girlfriendId
 */
router.post('/upload/:girlfriendId', upload.single('audio'), async (req, res) => {
    try {
        const { girlfriendId } = req.params;

        if (!req.file) {
            return res.status(400).json({ error: 'No audio file provided' });
        }

        // Upload to Supabase Storage
        const result = await storageService.uploadVoiceMaster(
            req.file.buffer,
            girlfriendId,
            req.file.originalname
        );

        // Update girlfriend record with voice_preview_url
        const { error: updateError } = await supabase
            .from('girlfriends')
            .update({ voice_preview_url: result.publicUrl })
            .eq('id', girlfriendId);

        if (updateError) {
            console.error('Error updating girlfriend:', updateError);
            return res.status(500).json({ error: 'Failed to update girlfriend' });
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
 * Get voice preview URL for girlfriend
 * GET /api/voice/:girlfriendId
 */
router.get('/:girlfriendId', async (req, res) => {
    try {
        const { girlfriendId } = req.params;

        const { data, error } = await supabase
            .from('girlfriends')
            .select('voice_preview_url')
            .eq('id', girlfriendId)
            .single();

        if (error) {
            return res.status(404).json({ error: 'Girlfriend not found' });
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
