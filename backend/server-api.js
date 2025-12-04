require('dotenv').config();
require('./utils/autoInstrument');
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
const { generateAvatar } = require("./routes/image");
const { generateNpcVoiceMaster } = require("./services/voiceGenerator");

const userRoutes = require('./routes/user');
const paymentsRoutes = require('./routes/payments');
const webhookRoutes = require('./routes/webhook');
const voiceRoutes = require('./routes/voice');
const messageRoutes = require('./routes/message');
const groupRoutes = require('./routes/group');
const groupInviteRoutes = require('./routes/groupInvite');
const aiContactsRoutes = require('./routes/aiContacts');
const npcRoutes = require('./routes/npc');
const groupManagementRoutes = require('./routes/groupManagement');
const userDiscoveryRoutes = require('./routes/userDiscovery'); // Added import
const audioRoutes = require('./routes/audio');
const videoRoutes = require('./routes/video');
const authRoutes = require('./routes/auth');
const npcShareRoutes = require('./routes/npc_share');
const npcFeedRoutes = require('./routes/npc_feed');
const brainCrudRoutes = require('./routes/brainCrud');
const couplePhotoRoutes = require('./routes/couplePhoto');
const contactsRoutes = require('./routes/contacts');

const app = express();
const port = process.env.PORT || 4000;

// Middleware
app.use(cors());
app.use(bodyParser.json({ limit: '50mb' }));

// Routes
app.use('/api/auth', authRoutes);
app.use('/api/audio', audioRoutes);
app.use('/api/video', videoRoutes);
app.use('/api/npc', npcShareRoutes);
app.use('/api/feed', npcFeedRoutes);
app.use('/api', webhookRoutes);
app.use('/api', paymentsRoutes);
app.use('/api', userRoutes);
app.use('/api', messageRoutes);
app.use('/api', groupRoutes);
app.use('/api', groupInviteRoutes);
app.use('/api', aiContactsRoutes);
app.use('/api/girlfriends', npcRoutes); // legacy path
app.use('/api/npcs', npcRoutes);
app.use('/api/group', groupManagementRoutes);
app.use('/api/users', userDiscoveryRoutes); // Added route usage
app.use('/api/voice', voiceRoutes);
app.use('/api', brainCrudRoutes);
app.use('/api', couplePhotoRoutes);
app.use('/api', contactsRoutes);

// Avatar Generation Route
app.post('/api/generate-avatar', async (req, res) => {
    const { prompt, npcId: bodyNpcId } = req.body;
    const npcId = bodyNpcId || req.body.girlfriendId; // legacy fallback
    console.log('🎨 Generate avatar request:', { prompt: prompt?.substring(0, 50), npcId });

    if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

    try {
        const result = await generateAvatar(prompt, npcId);
        console.log('✅ Avatar generated:', { result: result?.substring(0, 100), isSupabase: result?.startsWith('http') });

        // If result starts with http, it's a full URL (Supabase), otherwise it's a filename (local fallback)
        const imageUrl = result.startsWith('http') ? result : `http://${req.headers.host}/${result}`;
        res.json({ imageUrl });

        // 🔊 Try generating voice master if missing
        if (npcId) {
            try {
                const { data: npc } = await supabase.from('npcs').select('*').eq('id', npcId).single();
                if (npc && !npc.voice_master_url) {
                    console.log('🎤 Generating voice master for NPC:', npcId);
                    const voiceData = await generateNpcVoiceMaster({
                        name: npc.name,
                        age: npc.age || 25,
                        gender: npc.gender || 'female',
                        tone_mode: npc.tone || 'soft',
                        energy: npc.energy || 'medium',
                        speaking_speed: npc.speaking_speed || 'normal',
                        shyness: npc.shyness || 0.5,
                        confidence: npc.confidence || 0.5,
                        accent: npc.accent || 'italian'
                    });

                    if (voiceData?.voiceUrl) {
                        const { error: voiceUpdateError } = await supabase
                            .from('npcs')
                            .update({
                                voice_master_url: voiceData.voiceUrl,
                                voice_engine: voiceData.voiceEngine || null,
                                voice_profile: voiceData.voiceProfile ? JSON.stringify(voiceData.voiceProfile) : null
                            })
                            .eq('id', npcId);

                        if (voiceUpdateError) {
                            console.error('❌ Failed to update NPC voice_master_url:', voiceUpdateError);
                        } else {
                            console.log('✅ NPC voice_master_url saved:', voiceData.voiceUrl);
                        }
                    } else {
                        console.warn('⚠️ Voice master generation returned no URL for NPC:', npcId);
                    }
                }
            } catch (voiceErr) {
                console.error('❌ Voice master generation failed for NPC:', npcId, voiceErr);
            }
        }
    } catch (error) {
        console.error('Avatar generation error:', error);
        res.status(500).json({ error: 'Failed to generate avatar' });
    }
});

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

app.get('/api/chat-history/:userId/:npcId', async (req, res) => {
    const { userId, npcId } = req.params;
    const { limit = 50, offset = 0 } = req.query;

    try {
        // Detect if the target is another user (contact chat) or an NPC
        let targetUser = null;
        try {
            const { data: userLookup } = await supabase
                .from('user_profile')
                .select('id, username, avatar_url')
                .eq('id', npcId)
                .limit(1);
            if (userLookup && userLookup.length > 0) {
                targetUser = userLookup[0];
            }
        } catch (lookupErr) {
            console.warn('User lookup failed (chat history):', lookupErr);
        }

        const limitInt = parseInt(limit);
        const offsetInt = parseInt(offset);

        if (targetUser) {
            // User-to-user chat: fetch both directions and merge locally to keep ordering
            const [
                { data: sent, error: sentErr },
                { data: received, error: recvErr },
            ] = await Promise.all([
                supabase
                    .from('messages')
                    .select('*')
                    .eq('user_id', userId)
                    .eq('recipient_user_id', npcId),
                supabase
                    .from('messages')
                    .select('*')
                    .eq('user_id', npcId)
                    .eq('recipient_user_id', userId),
            ]);

            if (sentErr || recvErr) {
                const err = sentErr || recvErr;
                logToFile("Error fetching chat history (user-user): " + JSON.stringify(err));
                return res.status(500).json({ error: err.message });
            }

            const merged = [...(sent || []), ...(received || [])].sort(
                (a, b) => new Date(a.created_at) - new Date(b.created_at)
            );
            const sliced = merged.slice(offsetInt, offsetInt + limitInt);

            const senderIds = [
                ...new Set(
                    sliced
                        .map((row) => row.user_id)
                        .filter((id) => !!id)
                ),
            ];

            const { data: profiles, error: profileErr } = senderIds.length
                ? await supabase
                    .from('user_profile')
                    .select('id, username, avatar_url')
                    .in('id', senderIds)
                : { data: [], error: null };

            if (profileErr) {
                console.warn('Unable to load sender profiles for history:', profileErr);
            }

            const profileMap = {};
            (profiles || []).forEach((p) => {
                profileMap[p.id] = p;
            });

            const enriched = sliced.map((row) => {
                const profile = profileMap[row.user_id] || {};
                return {
                    ...row,
                    sender_id: row.user_id,
                    sender_name: profile.username || null,
                    avatar_url: profile.avatar_url || null,
                };
            });

            return res.json(enriched);
        }

        // NPC chat
        const { data, error } = await supabase
            .from('messages')
            .select('*')
            .eq('user_id', userId)
            .eq('npc_id', npcId)
            .order('created_at', { ascending: true })
            .range(offsetInt, offsetInt + limitInt - 1);

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
    const { userId, npcId: bodyNpcId, filename, imageBase64 } = req.body || {};
    const npcId = bodyNpcId || req.body.girlfriendId;
    if (!userId || !imageBase64) {
        return res.status(400).json({ error: 'userId e imageBase64 sono obbligatori' });
    }

    try {
        const buffer = Buffer.from(imageBase64, 'base64');
        const uploadResult = await storageService.uploadChatImage(buffer, userId, npcId);
        const imageUrl = uploadResult.publicUrl;
        let npc = null;

        if (npcId) {
            const { data: gfData, error: gfError } = await supabase
                .from('npcs')
                .select('*')
                .eq('id', npcId)
                .single();
            if (gfError) {
                console.warn('NPC non trovato durante il commento foto', gfError);
            } else {
                npc = gfData;
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

        let { type, output } = await generateChatReply(prompt, npc ? npc.tone : userPrefs.tone, npc, userPrefs.memory);
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
                npc_id: npcId,
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
                npc_id: npcId,
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

// Audio Upload Route
app.post('/api/audio/upload', async (req, res) => {
    const { userId, npcId: bodyNpcId, filename, audioBase64 } = req.body || {};
    const npcId = bodyNpcId || req.body.girlfriendId;
    if (!userId || !audioBase64) {
        return res.status(400).json({ error: 'userId e audioBase64 sono obbligatori' });
    }

    try {
        const buffer = Buffer.from(audioBase64, 'base64');

        // Upload to Supabase Storage
        const uploadPath = `${userId}/${npcId || 'general'}/${filename || `audio_${Date.now()}.m4a`}`;
        const { data: uploadData, error: uploadError } = await supabase.storage
            .from('chat-audio')
            .upload(uploadPath, buffer, {
                contentType: 'audio/m4a',
                upsert: false
            });

        if (uploadError) {
            console.error('❌ Supabase upload error:', uploadError);
            throw uploadError;
        }

        // Get public URL
        const { data: { publicUrl } } = supabase.storage
            .from('chat-audio')
            .getPublicUrl(uploadPath);

        console.log('✅ Audio uploaded:', publicUrl);

        res.json({
            url: publicUrl,
            path: uploadPath
        });

    } catch (error) {
        console.error('❌ Error uploading audio:', error);
        res.status(500).json({ error: 'Impossibile caricare l\'audio' });
    }
});

const handleGallery = async (req, res) => {
    const { userId, girlfriendId } = req.params;
    const npcId = girlfriendId; // legacy param name retained

    try {
        const { data, error } = await supabase.storage
            .from('chat-images')
            .list(`${userId}/${npcId}`, {
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
                .getPublicUrl(`${userId}/${npcId}/${file.name}`);
            return publicUrl;
        });

        res.json(imageUrls);
    } catch (err) {
        logToFile("Error in npc-gallery endpoint: " + err);
        res.status(500).json({ error: 'Failed to fetch gallery' });
    }
};
app.get('/api/girlfriend-gallery/:userId/:girlfriendId', handleGallery); // legacy
app.get('/api/npc-gallery/:userId/:girlfriendId', handleGallery);

app.delete('/api/girlfriend/:id', async (req, res) => {
    const { id } = req.params;
    const storageService = require('./services/supabase-storage');

    try {
        // Get npc data first
        const { data: npc, error: fetchError } = await supabase
            .from('npcs')
            .select('user_id')
            .eq('id', id)
            .single();

        if (fetchError) {
            logToFile("Error fetching npc: " + JSON.stringify(fetchError));
            return res.status(404).json({ error: 'NPC not found' });
        }

        // Delete all files from Supabase Storage
        try {
            await storageService.deleteNpcFiles(id);
            logToFile(`Deleted files for npc ${id}`);
        } catch (storageError) {
            logToFile("Error deleting files: " + storageError);
            // Continue even if file deletion fails
        }

        // Delete all messages
        const { error: messagesError } = await supabase
            .from('messages')
            .delete()
            .eq('npc_id', id);

        if (messagesError) {
            logToFile("Error deleting messages: " + JSON.stringify(messagesError));
        }

        // Delete npc from group memberships
        const { error: groupMembersError } = await supabase
            .from('group_members')
            .delete()
            .eq('npc_id', id);
        if (groupMembersError) {
            logToFile("Error deleting npc from group_members: " + JSON.stringify(groupMembersError));
        }

        // Delete npc messages in groups
        const { error: groupMessagesError } = await supabase
            .from('group_messages')
            .delete()
            .eq('sender_id', id);
        if (groupMessagesError) {
            logToFile("Error deleting npc group messages: " + JSON.stringify(groupMessagesError));
        }

        // Delete npc from database
        const { error: deleteError } = await supabase
            .from('npcs')
            .delete()
            .eq('id', id);

        if (deleteError) {
            logToFile("Error deleting npc: " + JSON.stringify(deleteError));
            return res.status(500).json({ error: deleteError.message });
        }

        res.json({ success: true, message: 'NPC deleted successfully' });
    } catch (err) {
        logToFile("Error in delete npc endpoint: " + err);
        res.status(500).json({ error: 'Failed to delete npc' });
    }
});

app.listen(port, () => {
    console.log(`📦 API server in ascolto su http://localhost:${port}`);
});
