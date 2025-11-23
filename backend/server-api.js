require('dotenv').config();
const express = require("express");
const cors = require("cors");
const bodyParser = require("body-parser");
const path = require("path");
const { supabase } = require('./lib/supabase');
const logToFile = require("./utils/log");
const { getUserPreferences } = require("./lib/userMemory");
const generateChatReply = require("./routes/openRouterService");
const storageService = require("./services/supabase-storage");
const { analyzeImage } = require("./services/image-analysis");

const userRoutes = require('./routes/user');
const paymentsRoutes = require('./routes/payments');
const webhookRoutes = require('./routes/webhook');
const voiceRoutes = require('./routes/voice');
const messageRoutes = require('./routes/message');
const groupRoutes = require('./routes/group');
const groupInviteRoutes = require('./routes/groupInvite');
const aiContactsRoutes = require('./routes/aiContacts');

const app = express();
const port = process.env.PORT || 4000;

app.use('/api', webhookRoutes);
app.use(bodyParser.json({ limit: '10mb' }));
app.use('/api', paymentsRoutes);
app.use('/api', userRoutes);
app.use('/api', messageRoutes);
app.use('/api', groupRoutes);
app.use('/api', groupInviteRoutes);
app.use('/api', aiContactsRoutes);
app.use('/api/voice', voiceRoutes);
app.use(cors());
app.use("/public", express.static(path.join(__dirname, "public")));


// === Rotte REST API
app.get('/api/history/:userId/sessions', async (req, res) => {
    const { userId } = req.params;
    try {
        const { data, error } = await supabase
            .from('messages')
            .select('session_id')
            .eq('user_id', userId)
            .order('created_at', { ascending: true });

        if (error) {
            logToFile("Error: " + JSON.stringify(error).toString())
            return res.status(500).json({ error: error.message });
        }
        const uniqueSessions = [...new Set(data.map((msg) => msg.session_id))];

        res.json(uniqueSessions);

    } catch (err) {
        logToFile("Error: " + err)
        res.status(500).json({ error: 'Errore recupero sessioni' });
    }
});

app.get('/api/history/:userId', async (req, res) => {
    const { userId } = req.params;
    const { session_id } = req.query;
    try {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('user_id', userId)
            .eq('session_id', session_id)
            .order('created_at', { ascending: true });

        if (error) {
            logToFile("error2:" + error)
            return res.status(500).json({ error: error.message });
        }

        res.json(data);

    } catch (err) {
        logToFile("error3:" + err)
        res.status(500).json({ error: 'Errore recupero messaggi' });
    }
});

app.get('/api/chat-history/:userId/:girlfriendId', async (req, res) => {
    const { userId, girlfriendId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    try {
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('user_id', userId)
            .eq('girlfriend_id', girlfriendId)
            .order('created_at', { ascending: true })
            .range(parseInt(offset), parseInt(offset) + parseInt(limit) - 1);

        if (error) {
            logToFile("Error fetching chat history: " + JSON.stringify(error));
            return res.status(500).json({ error: error.message });
        }

        res.json(data);
    } catch (err) {
        logToFile("Error in chat-history endpoint: " + err);
        res.status(500).json({ error: 'Failed to fetch chat history' });
    }
});

app.post('/api/photos/comment', async (req, res) => {
    const { userId, girlfriendId, filename, imageBase64 } = req.body || {};
    if (!userId || !imageBase64) {
        return res.status(400).json({ error: 'userId e imageBase64 sono obbligatori' });
    }

    try {
        const buffer = Buffer.from(imageBase64, 'base64');
        const uploadResult = await storageService.uploadChatImage(buffer, userId, girlfriendId);
        const imageUrl = uploadResult.publicUrl;
        let girlfriend = null;

        if (girlfriendId) {
            const { data: gfData, error: gfError } = await supabase
                .from('girlfriends')
                .select('*')
                .eq('id', girlfriendId)
                .single();
            if (gfError) {
                console.warn('Girlfriend non trovata durante il commento foto', gfError);
            } else {
                girlfriend = gfData;
            }
        }


        const userPrefs = await getUserPreferences(userId);

        // Analyze the image first
        let imageDescription = "Un'immagine";
        try {
            imageDescription = await analyzeImage(imageUrl, "Describe this image in detail, focusing on the main subjects and actions.");
        } catch (err) {
            console.error("Image analysis failed:", err);
        }

        const prompt = `L'utente ha inviato una foto. 
        Descrizione dell'immagine: "${imageDescription}".
        Nome file originale: "${filename || 'sconosciuto'}".
        
        Commenta questa foto in base alla descrizione fornita. Sii naturale, come se la stessi guardando.`;

        let { type, output } = await generateChatReply(prompt, girlfriend ? girlfriend.tone : userPrefs.tone, girlfriend, userPrefs.memory);
        if (!output || output.trim() === '') {
            output = 'Wow, che bella foto! 😍';
        }

        const sessionId = new Date().toISOString().slice(0, 10);
        const { data: userMessage, error: userError } = await supabase
            .from('messages')
            .insert({
                user_id: userId,
                session_id: sessionId,
                role: 'user',
                type: 'image',
                content: imageUrl,
                girlfriend_id: girlfriendId,
            })
            .select('*')
            .single();

        if (userError) throw userError;

        const { data: assistantMessage, error: assistantError } = await supabase
            .from('messages')
            .insert({
                user_id: userId,
                session_id: sessionId,
                role: 'assistant',
                type: 'chat', // Force chat type for photo comments as we don't support media generation here yet
                content: output,
                girlfriend_id: girlfriendId,
            })
            .select('*')
            .single();

        if (assistantError) throw assistantError;

        res.json({ userMessage, assistantMessage });
    } catch (error) {
        console.error('Errore commento foto:', error);
        res.status(500).json({ error: 'Impossibile commentare la foto' });
    }
});

app.get('/api/girlfriend-gallery/:userId/:girlfriendId', async (req, res) => {
    const { userId, girlfriendId } = req.params;

    try {
        const { data, error } = await supabase.storage
            .from('chat-images')
            .list(`${userId}/${girlfriendId}`, {
                sortBy: { column: 'created_at', order: 'desc' }
            });

        if (error) {
            logToFile("Error fetching gallery: " + JSON.stringify(error));
            return res.status(500).json({ error: error.message });
        }

        // Convert file paths to public URLs
        const imageUrls = data.map(file => {
            const { data: { publicUrl } } = supabase.storage
                .from('chat-images')
                .getPublicUrl(`${userId}/${girlfriendId}/${file.name}`);
            return publicUrl;
        });

        res.json(imageUrls);
    } catch (err) {
        logToFile("Error in girlfriend-gallery endpoint: " + err);
        res.status(500).json({ error: 'Failed to fetch gallery' });
    }
});

app.delete('/api/girlfriend/:id', async (req, res) => {
    const { id } = req.params;
    const storageService = require('./services/supabase-storage');

    try {
        // Get girlfriend data first
        const { data: girlfriend, error: fetchError } = await supabase
            .from('girlfriends')
            .select('user_id')
            .eq('id', id)
            .single();

        if (fetchError) {
            logToFile("Error fetching girlfriend: " + JSON.stringify(fetchError));
            return res.status(404).json({ error: 'Girlfriend not found' });
        }

        // Delete all files from Supabase Storage
        try {
            await storageService.deleteGirlfriendFiles(id);
            logToFile(`Deleted files for girlfriend ${id}`);
        } catch (storageError) {
            logToFile("Error deleting files: " + storageError);
            // Continue even if file deletion fails
        }

        // Delete all messages
        const { error: messagesError } = await supabase
            .from('messages')
            .delete()
            .eq('girlfriend_id', id);

        if (messagesError) {
            logToFile("Error deleting messages: " + JSON.stringify(messagesError));
        }

        // Delete girlfriend from database
        const { error: deleteError } = await supabase
            .from('girlfriends')
            .delete()
            .eq('id', id);

        if (deleteError) {
            logToFile("Error deleting girlfriend: " + JSON.stringify(deleteError));
            return res.status(500).json({ error: deleteError.message });
        }

        res.json({ success: true, message: 'Girlfriend deleted successfully' });
    } catch (err) {
        logToFile("Error in delete girlfriend endpoint: " + err);
        res.status(500).json({ error: 'Failed to delete girlfriend' });
    }
});

app.listen(port, () => {
    console.log(`📦 API server in ascolto su http://localhost:${port}`);
});
