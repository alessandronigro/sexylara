// routes/message.js
const express = require('express');
const router = express.Router();
const { supabase } = require('../lib/supabase');
const storageService = require('../services/supabase-storage');

// Delete a single message (and its media if any)
router.delete('/messages/:id', async (req, res) => {
    const { id } = req.params;
    try {
        // Retrieve the message to know its type and possible media URL
        const { data: msg, error: fetchErr } = await supabase
            .from('messages')
            .select('type, content')
            .eq('id', id)
            .single();
        if (fetchErr) throw fetchErr;

        // If the message is not plain text, delete the stored file (image/video/audio)
        if (msg.type !== 'text' && msg.content && msg.content.startsWith('http')) {
            try {
                const url = new URL(msg.content);
                // Expected format: .../storage/v1/object/public/[bucket]/[path]
                const pathParts = url.pathname.split('/public/');
                if (pathParts.length > 1) {
                    const fullPath = pathParts[1]; // e.g., "chat-images/userId/gfId/filename.png"
                    const firstSlash = fullPath.indexOf('/');
                    if (firstSlash !== -1) {
                        const bucket = fullPath.substring(0, firstSlash);
                        const filePath = fullPath.substring(firstSlash + 1);
                        await storageService.deleteFile(bucket, filePath);
                    }
                }
            } catch (err) {
                console.error('Failed to delete file from storage:', err);
                // Continue to delete message from DB even if file deletion fails
            }
        }

        // Delete the message record
        const { error: delErr } = await supabase.from('messages').delete().eq('id', id);
        if (delErr) throw delErr;

        res.json({ success: true });
    } catch (e) {
        console.error('Error deleting message:', e);
        res.status(500).json({ error: e.message });
    }
});

module.exports = router;
