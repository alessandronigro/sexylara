require('dotenv').config();
const express = require("express");
const Replicate = require("replicate");
const cors = require("cors");
const dotenv = require("dotenv");
const bodyParser = require("body-parser");
const path = require("path");
const logToFile = require("./utils/log");
const WebSocket = require('ws');
const http = require("http");
const { supabase } = require('./lib/supabase');
const generateChatReply = require("./routes/openRouterService");
const { generateImage, generateAvatar } = require("./routes/image");
const generateVideo = require("./routes/video");
const retrievevideo = require("./routes/retrievevideo");
const generateAudio = require("./routes/audio");
const db = require("./routes/db");
const npcRoutes = require('./routes/npc');
const messageRoutes = require('./routes/message');
const groupRoutes = require('./routes/group');
const { brainEngine } = require('./ai/brainEngine');
const wsNotificationService = require('./services/wsNotificationService');
const MediaGenerationService = require('./services/MediaGenerationService');
const { getUserPhoto } = require('./ai/media/getUserPhoto');
const { saveUserPhoto } = require('./ai/media/saveUserPhoto');
const { askPhoto, captions } = require('./ai/language/translations');
const { thinkInGroup, detectInvokedNpcId } = require("./ai/GroupBrainEngine");
const { checkForInitiative } = require('./ai/scheduler/NpcInitiativeEngine');
const pendingCouplePhoto = new Map();

function resolveNpcAvatar(npc) {
  if (!npc) return null;
  return npc.avatar_url || npc.avatar || npc.image_reference || null;
}

async function ensureNpcImageForMedia(npc) {
  const direct = resolveNpcAvatar(npc);
  if (direct) return direct;
  try {
    const prompt = `Portrait photo of ${npc?.name || 'the NPC'}, photorealistic, warm lighting`;
    return await generateAvatar(prompt, npc?.id || npc?.npc_id || null);
  } catch (err) {
    console.error('❌ Unable to generate NPC image for media:', err?.message);
    return null;
  }
}

const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Register routes
app.use('/girlfriends', npcRoutes); // legacy path
app.use('/npcs', npcRoutes);
app.use('/messages', messageRoutes);
app.use('/groups', groupRoutes);

const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });
const { analyzeText } = require('./lib/analyzeUserInput');
const { getUserPreferences, updateUserMemory } = require("./lib/userMemory");
const userSockets = new Map();

// Scheduler per iniziative NPC ogni 5 minuti
setInterval(async () => {
  try {
    await checkForInitiative(userSockets);
  } catch (err) {
    console.error('❌ NPC initiative scheduler error:', err?.message);
  }
}, 5 * 60 * 1000);


async function saveMessage({ user_id, session_id, role, type, content, npc_id }) {
  const data = { user_id, session_id, role, type, content };
  if (npc_id) data.npc_id = npc_id;
  const { data: result, error } = await supabase
    .from('messages')
    .insert(data)
    .select('id')
    .single();
  if (error) throw error;
  return result;
}


function splitIntoChunks(text, maxLength = 250) {
  const sentences = text.match(/[^.!?]+[.!?]+/g) || [text];
  const chunks = [];
  let current = '';

  for (const sentence of sentences) {
    if ((current + sentence).length <= maxLength) {
      current += sentence;
    } else {
      if (current) chunks.push(current.trim());
      current = sentence;
    }
  }

  if (current) chunks.push(current.trim());
  return chunks;
}

app.post('/generate-avatar', async (req, res) => {
  const { prompt, npcId: bodyNpcId, faceImageUrl } = req.body;
  const npcId = bodyNpcId || req.body.girlfriendId; // legacy fallback
  console.log('🎨 Generate avatar request:', { prompt: prompt?.substring(0, 50), npcId });

  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  try {
    const result = await generateAvatar(prompt, npcId, faceImageUrl);
    console.log('✅ Avatar generated:', { result: result?.substring(0, 100), isSupabase: result?.startsWith('http') });

    // If result starts with http, it's a full URL (Supabase), otherwise it's a filename (local fallback)
    const imageUrl = result.startsWith('http') ? result : `http://${req.headers.host}/${result}`;
    res.json({ imageUrl });
  } catch (error) {
    console.error('❌ Error generating avatar:', error);
    res.status(500).json({ error: error.message });
  }
});

wss.on('connection', (ws, req) => {
  const fullUrl = `http://${req.headers.host}${req.url}`;
  const url = new URL(fullUrl);
  const userId = url.searchParams.get('user_id');
  const npcIdFromQuery = url.searchParams.get('npc_id') || null;

  if (!userId) {
    ws.close(1008, 'Missing user_id');
    return;
  }

  console.log(`🛰️ Connessione WebSocket per utente ${userId}`);

  // ✅ Register connection for notifications
  wsNotificationService.registerConnection(userId, ws);
  ws.npc_id = npcIdFromQuery;
  userSockets.set(userId, ws);
  ws.on('close', () => {
    userSockets.delete(userId);
  });

  ws.on('message', async (msg) => {
    const sessionId = new Date().toISOString().slice(0, 10);
    const parsed = JSON.parse(msg.toString());
    const { text, traceId, npc_id, group_id, mediaType, mediaUrl } = parsed;
    console.log('📨 Messaggio ricevuto:', { text, traceId, npc_id, group_id, mediaType, mediaUrl, userId });

    try {
      // ========================================
      // GROUP CHAT HANDLING
      // ========================================
      if (group_id) {
        console.log('👥 Messaggio di gruppo rilevato:', group_id);

        // Salva il messaggio dell'utente nel gruppo
        const { data: savedGroupMessage, error: groupMsgError } = await supabase
          .from('group_messages')
          .insert({
            group_id,
            sender_id: userId,
            content: text,
            type: 'text'
          })
          .select('id')
          .single();

        if (groupMsgError) {
          console.error('❌ Errore salvataggio messaggio gruppo:', groupMsgError);
          throw groupMsgError;
        }

        // Invia ACK al client
        ws.send(JSON.stringify({
          traceId,
          type: 'ack',
          serverId: savedGroupMessage.id,
          isGroup: true
        }));

        // Recupera i membri AI del gruppo (supporta sia member_id che npc_id per compatibilità)
        const { data: members, error: membersError } = await supabase
          .from('group_members')
          .select(`
            member_id,
            member_type,
            npc_id,
            npcs (
              id,
              name,
              gender,
              personality_type,
              tone,
              age,
              ethnicity,
              hair_color,
              eye_color,
              body_type,
              avatar_url
            )
          `)
          .eq('group_id', group_id)
          .eq('member_type', 'ai'); // Solo membri AI rispondono automaticamente

        if (membersError || !members || members.length === 0) {
          console.error('❌ Errore recupero membri gruppo:', membersError);
          ws.send(JSON.stringify({
            traceId,
            role: 'system',
            type: 'error',
            content: 'Nessun membro AI trovato nel gruppo',
            group_id
          }));
          ws.send(JSON.stringify({ traceId, end: true }));
          return;
        }

        console.log(`👥 Trovati ${members.length} membri AI nel gruppo`);

        // Recupera ultimi messaggi del gruppo per contesto
        const { data: recentMessages } = await supabase
          .from('group_messages')
          .select('content, sender_id, created_at')
          .eq('group_id', group_id)
          .order('created_at', { ascending: false })
          .limit(20);

        // Recupera memoria collettiva del gruppo
        const { data: groupMemory } = await supabase
          .from('group_memory')
          .select('summary, dynamics')
          .eq('group_id', group_id)
          .single();

        // 🆕 Recupera profilo dell'utente
        const { data: userProfile } = await supabase
          .from('user_profile')
          .select('*')
          .eq('user_id', userId)
          .single();

        // Costruisci contesto della conversazione
        const messageHistory = (recentMessages || [])
          .reverse()
          .map(m => {
            const sender = members.find(mem => mem.npcs.id === m.sender_id);
            const senderName = sender ? sender.npcs.name : (userProfile?.name || 'Utente');
            return `${senderName}: ${m.content}`;
          })
          .join('\n');

        // Notifica che le AI stanno "pensando"
        ws.send(JSON.stringify({
          traceId,
          status: 'group_thinking',
          memberCount: members.length
        }));

        // Genera risposte per ogni AI nel gruppo
        let responseCount = 0;

        // Detect if any NPC is explicitly invoked
        const invokedNpcId = detectInvokedNpcId(text, members);

        for (const member of members) {
          const ai = member.npcs;
          try {
            console.log(`🧠 Using GroupBrainEngine for ${ai.name}...`);

            // Use GroupBrainEngine
            const result = await thinkInGroup({
              npcId: ai.id,
              groupId: group_id,
              userMessage: text,
              history: recentMessages || [],
              invokedNpcId: invokedNpcId
            });

            if (result.silent) {
              console.log(`⏭️ ${ai.name} stays silent.`);
              continue;
            }

            // Handle Media Request
            if (result.mediaRequest) {
              console.log(`📸 ${ai.name} wants to send media:`, result.mediaRequest);
              const generationType = result.mediaRequest.type; // photo, video, audio

              // Notify start
              const tempId = `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
              ws.send(JSON.stringify({
                event: 'media_generation_started',
                tempId,
                npcId: ai.id,
                mediaType: generationType,
                traceId
              }));

              try {
                let mediaResult;
                if (generationType === 'photo') {
                  mediaResult = await MediaGenerationService.generatePhoto(
                    ai,
                    result.mediaRequest.details,
                    resolveNpcAvatar(ai)
                  );
                } else if (generationType === 'video') {
                  mediaResult = await MediaGenerationService.generateVideo(ai, result.mediaRequest.details);
                } else if (generationType === 'audio') {
                  mediaResult = await MediaGenerationService.generateAudio(ai, result.mediaRequest.details);
                }

                if (mediaResult && mediaResult.url) {
                  // Save message
                  const { data: savedMsg } = await supabase.from('group_messages').insert({
                    group_id,
                    sender_id: ai.id,
                    content: mediaResult.url,
                    type: generationType
                  }).select('id').single();

                  // Notify complete
                  ws.send(JSON.stringify({
                    event: 'media_generation_completed',
                    tempId,
                    mediaType: generationType,
                    finalUrl: mediaResult.url,
                    caption: mediaResult.caption,
                    messageId: savedMsg.id,
                    npcId: ai.id
                  }));

                  responseCount++;
                  continue; // Skip text if media sent
                }
              } catch (err) {
                console.error('Media generation failed:', err);
                // Fallback to text if available
              }
            }

            const output = result.text;
            if (!output) continue;

            // Delay per sembrare naturale
            await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1500));

            // Salva risposta
            const { data: aiMessage, error: aiMsgError } = await supabase
              .from('group_messages')
              .insert({
                group_id,
                sender_id: ai.id,
                content: output,
                type: 'text'
              })
              .select('id')
              .single();

            if (aiMsgError) {
              console.error(`❌ Errore salvataggio risposta ${ai.name}:`, aiMsgError);
              continue;
            }

            // Invia WS
            const avatarUrl = ai.avatar_url && ai.avatar_url.startsWith('http')
              ? ai.avatar_url
              : resolveNpcAvatar(ai);

            ws.send(JSON.stringify({
              traceId,
              role: 'assistant',
              type: 'group_message',
              content: output,
              sender_id: ai.id,
              sender_name: ai.name,
              avatar: avatarUrl,
              group_id,
              messageId: aiMessage.id
            }));

            responseCount++;
            console.log(`✅ ${ai.name} ha risposto: ${output.substring(0, 50)}...`);

          } catch (aiError) {
            console.error(`❌ Errore generazione risposta per ${ai.name}:`, aiError);
          }
        }

        // Invia segnale di fine conversazione
        ws.send(JSON.stringify({
          traceId,
          end: true,
          group_id,
          totalResponses: responseCount
        }));

        console.log(`✅ Chat di gruppo completata: ${responseCount}/${members.length} AI hanno risposto`);

        // Controlla se è il momento di aggiornare la memoria del gruppo
        const totalMessages = (recentMessages?.length || 0) + responseCount + 1;
        if (totalMessages > 0 && totalMessages % 15 === 0) {
          console.log(`🧠 Triggering group memory update for ${group_id}`);
          // Chiamata asincrona (non blocca)
          updateGroupMemory(group_id).catch(err =>
            console.error('Group memory update failed:', err)
          );
        }

        return; // Esci dalla gestione gruppo
      } else {
        // ========================================
        // INDIVIDUAL CHAT HANDLING (existing code)
        // ========================================
        console.log('👤 Handling individual chat message for npc:', npc_id);

        const savedUserMessage = await saveMessage({
          user_id: userId,
          session_id: sessionId,
          role: 'user',
          type: 'text',
          content: text,
          npc_id,
        });
        console.log('💾 User message saved:', savedUserMessage.id);

        ws.send(JSON.stringify({ traceId, type: 'ack', serverId: savedUserMessage.id }));

        let npc = null;
        if (npc_id) {
          const { data: gfData, error: gfError } = await supabase
            .from('npcs')
            .select('*')
            .eq('id', npc_id)
            .single();

          if (gfError) console.error('❌ Error fetching npc:', gfError);
          npc = gfData;
        }
        console.log('👩 NPC found:', npc ? npc.name : 'None');

        const userPrefs = await getUserPreferences(userId);
        console.log('⚙️ User prefs loaded');

        // Carica messaggi recenti per contesto
        const { data: recentMsgs } = await supabase
          .from('messages')
          .select('role, content, created_at')
          .eq('user_id', userId)
          .eq('npc_id', npc_id)
          .order('created_at', { ascending: false })
          .limit(20);

        // ===== ANALYZE RECEIVED MEDIA IF PRESENT =====
        let mediaAnalysisContext = '';
        let mediaEmotionalImpact = null;
        let uploadedUserPhoto = null;

        if (mediaType && mediaUrl) {
          console.log(`📥 User sent ${mediaType}, analyzing...`);

          // Salva la foto dell'utente per future richieste di couple photo
          if (mediaType === 'image') {
            try {
              uploadedUserPhoto = await saveUserPhoto(userId, mediaUrl);
              console.log('💾 User photo saved for profile/couple photo');
            } catch (err) {
              console.error('❌ Error saving user photo:', err);
            }
          }

          try {
            const { MediaUnderstandingEngine } = require('./ai/brainEngine');
            const mediaResult = await MediaUnderstandingEngine.processReceivedMedia(
              mediaType,
              mediaUrl,
              npc,
              userId
            );

            // Add media context to prompt
            mediaAnalysisContext = MediaUnderstandingEngine.generateContextPrompt(
              mediaResult.analysis,
              mediaType
            );

            // Store emotional impact to update NPC state later
            mediaEmotionalImpact = mediaResult.emotionalImpact;

            // Update NPC memory
            MediaUnderstandingEngine.updateNpcMemory(npc, mediaResult.memoryRecord);

            console.log('✅ Media analyzed:', mediaResult.analysis);
            console.log('💭 Generated reaction:', mediaResult.reaction);

            if (!text || text.trim() === '') {
              text = mediaResult.reaction || mediaAnalysisContext || `Ho ricevuto il tuo ${mediaType}.`;
            }

            if (mediaResult?.autoResponseType === "npc_audio") {
              console.log("🎤 Auto audio reply triggered for NPC:", npc.name);

              const audioIntent = {
                intent: "AUDIO_AUTO_REPLY",
                scenePrompt: mediaResult.reaction
                  || "L'utente ti ha parlato con un tono coinvolgente. Rispondi con un vocale caldo e coerente."
              };

              // Ensure MediaGenerationService is available or imported correctly
              // Assuming MediaGenerationService is already required at top of file
              const audioResult = await MediaGenerationService.generateAudio(npc, audioIntent);

              ws.send(JSON.stringify({
                type: "npc_audio",
                url: audioResult.url,
                caption: audioResult.caption,
                npc_id: npc.id
              }));

              console.log("🎤 NPC auto audio sent:", audioResult.url);
            }

            // Use the generated reaction as the AI response
            // (or let the AI generate its own based on the context)
            // For now, we'll add the context and let the AI respond naturally

          } catch (mediaError) {
            console.error('❌ Error analyzing media:', mediaError);
            mediaAnalysisContext = `\n\nL'utente ti ha inviato un ${mediaType}, ma non sono riuscito ad analizzarlo completamente. Reagisci comunque in modo positivo.\n`;
          }
        }

        // Se avevamo una richiesta pendente di couple photo e ora abbiamo la foto utente, genera subito
        if (pendingCouplePhoto.get(userId) && uploadedUserPhoto && npc) {
          try {
            const { generateCouplePhoto } = require('./ai/media/generateCouplePhoto');
            const npcImageUrl = await ensureNpcImageForMedia(npc);
            if (!npcImageUrl) {
              throw new Error('missing npc image for couple photo');
            }
            const cp = await generateCouplePhoto({
              userImageUrl: uploadedUserPhoto,
              npcImageUrl,
              npcName: npc.name || 'NPC',
            });

            pendingCouplePhoto.delete(userId);

            ws.send(JSON.stringify({
              traceId,
              role: 'assistant',
              type: 'couple_photo',
              content: cp.finalImageUrl,
              caption: captions[userPrefs.language] || captions.it,
              npc_id: npc_id,
            }));

            await saveMessage({
              user_id: userId,
              session_id: sessionId,
              role: 'assistant',
              type: 'couple_photo',
              content: cp.finalImageUrl,
              npc_id: npc_id,
            });

            ws.send(JSON.stringify({ traceId, end: true }));
            return;
          } catch (cpErr) {
            console.error('❌ Error generating pending couple photo:', cpErr);
            // continue to normal flow
          }
        }

        // Usa Brain Engine per risposta intelligente
        const response = await brainEngine.generateIntelligentResponse(
          npc,
          {
            id: userId,
            name: userPrefs.name,
            ...userPrefs
          },
          text + mediaAnalysisContext, // Add media context to message
          null, // group
          recentMsgs ? recentMsgs.reverse() : [],
          generateChatReply // Inject dependency
        );

        let output = response.output;
        let type = response.type || 'chat';

        console.log('🤖 Reply generated:', { type, output: output?.substring(0, 500) });

        // Fallback se risposta è vuota o difensiva
        if (!output || output.trim() === '') {
          output = "Mmm... sto cercando le parole giuste per rispondere al tuo desiderio 😘";
        }

        // Check if user shared their name (simple heuristic or from intent engine)
        // Note: Intent analysis is done inside brainEngine, but we can do a quick check here or rely on brainEngine to return intent
        // For now, let's do a simple regex check here to update the DB immediately
        const nameMatch = text.match(/(?:mi chiamo|sono|nome è)\s+([A-Z][a-z]+)/i);
        if (nameMatch && nameMatch[1]) {
          const newName = nameMatch[1];
          console.log(`👤 Detected user name: ${newName}. Updating profile...`);
          await supabase
            .from('users') // Assuming 'users' table or similar for user profile
            .update({ name: newName }) // Adjust column name if needed (e.g., 'display_name')
            .eq('id', userId);
        }

        // const currentCredits = await db.getUserCredits(userId);
        // if (currentCredits <= 0) {
        //   ws.send(JSON.stringify({
        //     type: "locked",
        //     role: "assistant",
        //     content: "Contenuto bloccato. Carica crediti per sbloccarlo.",
        //     mediaType: type, // image, video, audio
        //     traceId,
        //   }));
        //   return;
        // }
        // await deductCredit(userId); // se c'è credito, scala

        // Filtri per rimuovere risposte bloccanti
        output = output.replace(/sono un'?intelligenza artificiale[^.]*\./gi, '');
        output = output.replace(/non posso[^.]*\./gi, '');

        // Se manca una foto utente per la couple photo, chiedila al client e segna come pendente
        const needsUserPhoto = type === 'user_photo_needed' || (response.actions || []).includes('ASK_USER_FOR_PHOTO');
        if (needsUserPhoto) {
          pendingCouplePhoto.set(userId, { npcId: npc_id || npc?.id });
          const lang = userPrefs.language || 'it';
          const askMsg = askPhoto[lang] || askPhoto.it;
          ws.send(JSON.stringify({
            traceId,
            role: 'system',
            type: 'request_user_photo',
            content: askMsg,
            npc_id: npc_id,
          }));
          output = askMsg;
          type = 'chat';
        }

        // ===== HANDLE MEDIA GENERATION FROM MEDIA INTENT ENGINE =====
        // Force mediaRequested flag if media intent was detected
        const mediaRequest = response.mediaRequest;
        const mediaRequested = !!mediaRequest || (response.mediaRequested || false);
        const generationType = mediaRequest ? mediaRequest.type : type;

        if (mediaRequested && (generationType === 'photo' || generationType === 'video' || generationType === 'audio' || generationType === 'couple_photo')) {
          console.log(`🎬 Generating ${generationType} as requested by user...`);
          const tempId = `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;

          // 1. Notify frontend that generation started (show placeholder)
          console.log('🔔 Sending media_generation_started event', { tempId, npcId: npc_id || npc?.id, mediaType: generationType, traceId });
          ws.send(JSON.stringify({
            event: 'media_generation_started',
            tempId,
            npcId: npc_id || npc?.id,
            mediaType: generationType,
            traceId
          }));

          try {
            let mediaResult;

            if (generationType === 'photo') {
              mediaResult = await MediaGenerationService.generatePhoto(
                npc,
                response.mediaRequest?.details,   // always use the MediaIntentEngine enriched details
                resolveNpcAvatar(npc)      // use helper for avatar
              );
            } else if (generationType === 'video') {
              mediaResult = await MediaGenerationService.generateVideo(
                npc,
                response.mediaRequest?.details
              );
            } else if (generationType === 'audio') {
              mediaResult = await MediaGenerationService.generateAudio(
                npc,
                response.mediaRequest?.details
              );
            } else if (generationType === 'couple_photo') {
              const { generateCouplePhoto } = require('./ai/media/generateCouplePhoto');
              const storedUserPhoto = uploadedUserPhoto || text.match(/https?:\/\/\S+/)?.[0] || mediaUrl || await getUserPhoto(userId);
              if (!storedUserPhoto) {
                pendingCouplePhoto.set(userId, { npcId: npc_id || npc?.id });
                const lang = userPrefs.language || 'it';
                const askMsg = askPhoto[lang] || askPhoto.it;
                ws.send(JSON.stringify({
                  traceId,
                  role: 'system',
                  type: 'request_user_photo',
                  content: askMsg,
                  npc_id: npc_id,
                }));
                // Fail the pending media since we need user input first
                ws.send(JSON.stringify({
                  event: 'media_generation_failed',
                  tempId,
                  error: 'User photo required'
                }));
                throw new Error('user photo missing for couple photo');
              }

              const npcImageUrl = await ensureNpcImageForMedia(npc);
              if (!npcImageUrl) {
                throw new Error('npc image missing for couple photo');
              }
              const cp = await generateCouplePhoto({
                userImageUrl: storedUserPhoto,
                npcImageUrl,
                npcName: npc?.name || 'NPC',
              });
              mediaResult = {
                url: cp.finalImageUrl,
                caption: captions[userPrefs.language] || captions.it,
              };
            }

            if (!mediaResult || !mediaResult.url) {
              throw new Error(mediaResult?.error || 'media generation failed');
            }

            // Save to database first to get the real ID
            const savedMsg = await saveMessage({
              user_id: userId,
              session_id: sessionId,
              role: 'assistant',
              type: generationType,
              content: mediaResult.url,
              npc_id: npc_id
            });

            // 2. Notify frontend that generation is complete (replace placeholder)
            // The frontend will create the message from this event, so we DON'T send a standard message
            ws.send(JSON.stringify({
              event: 'media_generation_completed',
              tempId,
              mediaType: generationType,
              finalUrl: mediaResult.url,
              caption: mediaResult.caption,
              messageId: savedMsg?.id,
              npcId: npc_id
            }));

            // 3. Send caption as a separate text message if present
            if (mediaResult.caption) {
              // Wait a bit to make it feel natural
              await new Promise(resolve => setTimeout(resolve, 500));

              const captionMsg = await saveMessage({
                user_id: userId,
                session_id: sessionId,
                role: 'assistant',
                type: 'text',
                content: mediaResult.caption,
                npc_id: npc_id
              });

              ws.send(JSON.stringify({
                traceId,
                role: 'assistant',
                type: 'text',
                content: mediaResult.caption,
                npc_id: npc_id,
                messageId: captionMsg.id
              }));
            }

            ws.send(JSON.stringify({ traceId, end: true }));
            return; // Exit early after media generation
          } catch (mediaError) {
            console.error(`❌ Error generating ${generationType}:`, mediaError);

            // 3. Notify failure
            ws.send(JSON.stringify({
              event: 'media_generation_failed',
              tempId,
              error: mediaError.message
            }));

            output = `Ops, ho avuto un problema a generare ${generationType === 'photo' ? 'la foto' : generationType === 'video' ? 'il video' : 'l\'audio'}... riprova tra poco 😔`;
            type = 'chat'; // Fallback to text
          }
        }

        // Se è immagine/video/audio, invia diretto (LEGACY PATH)
        if (type === 'image') {
          const tempId = `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          ws.send(JSON.stringify({
            event: 'media_generation_started',
            tempId,
            npcId: npc_id,
            mediaType: 'image',
            traceId
          }));

          // Keep status for backward compatibility if needed, but frontend might duplicate indicators
          // ws.send(JSON.stringify({ traceId, status: 'rendering_image' }));

          generateImage(output, npc, userId).then(async (url) => {
            const savedMsg = await saveMessage({
              user_id: userId,
              session_id: sessionId,
              role: 'assistant',
              type: type,
              content: url.toString(),
              npc_id: npc_id
            });

            ws.send(JSON.stringify({
              event: 'media_generation_completed',
              tempId,
              mediaType: 'image',
              finalUrl: url.toString(),
              messageId: savedMsg.id,
              npcId: npc_id
            }));

            ws.send(JSON.stringify({ traceId, end: true }));

          }).catch(err => {
            console.error('Errore generazione immagine:', err);
            ws.send(JSON.stringify({
              event: 'media_generation_failed',
              tempId,
              error: err.message
            }));

            ws.send(JSON.stringify({ traceId, role: 'assistant', type: 'image', content: "Ops... qualcosa è andato storto 💔", npc_id: npc_id }));
            ws.send(JSON.stringify({ traceId, end: true }));
          });
          return; // esci subito
        }

        if (type === 'video') {
          const tempId = `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          ws.send(JSON.stringify({
            event: 'media_generation_started',
            tempId,
            npcId: npc_id,
            mediaType: 'video',
            traceId
          }));

          // Get recent chat history for context
          const { data: recentMessages } = await supabase
            .from('messages')
            .select('role, content')
            .eq('user_id', userId)
            .eq('npc_id', npc_id)
            .order('created_at', { ascending: false })
            .limit(10);

          const chatHistory = (recentMessages || []).reverse();

          retrievevideo(text, npc, chatHistory, userId, npc_id).then(async (url) => {
            let savedMsgId = null;
            try {
              const savedMsg = await saveMessage({
                user_id: userId,
                session_id: sessionId,
                role: 'assistant',
                type: 'video',
                content: url.toString(),
                npc_id
              });
              savedMsgId = savedMsg.id;
            } catch (e) {
              console.error("❌ Errore salvataggio video:", e);
            }

            ws.send(JSON.stringify({
              event: 'media_generation_completed',
              tempId,
              mediaType: 'video',
              finalUrl: url,
              messageId: savedMsgId,
              npcId: npc_id
            }));

            ws.send(JSON.stringify({ traceId, end: true }));

          }).catch(err => {
            console.error('Errore generazione video:', err);
            ws.send(JSON.stringify({
              event: 'media_generation_failed',
              tempId,
              error: err.message
            }));
            ws.send(JSON.stringify({ traceId, role: 'assistant', type: 'video', content: "Ops... qualcosa è andato storto 💔", npc_id }));
            ws.send(JSON.stringify({ traceId, end: true }));
          });

          return; // esci subito
        }

        if (type === 'audio') {
          const tempId = `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          ws.send(JSON.stringify({
            event: 'media_generation_started',
            tempId,
            npcId: npc_id,
            mediaType: 'audio',
            traceId
          }));

          // Get recent chat history for context
          const { data: recentMessages } = await supabase
            .from('messages')
            .select('role, content')
            .eq('user_id', userId)
            .eq('npc_id', npc_id)
            .order('created_at', { ascending: false })
            .limit(10);

          const chatHistory = (recentMessages || []).reverse(); // Reverse to get chronological order

          const voiceUrl = npc?.voice_master_url || npc?.voice_preview_url || null;
          generateAudio(text, voiceUrl, chatHistory, userId, npc_id).then(async (url) => {
            const savedMsg = await saveMessage({ user_id: userId, session_id: sessionId, role: 'assistant', type, content: url.toString(), npc_id });

            ws.send(JSON.stringify({
              event: 'media_generation_completed',
              tempId,
              mediaType: 'audio',
              finalUrl: url,
              messageId: savedMsg.id,
              npcId: npc_id
            }));

            ws.send(JSON.stringify({ traceId, end: true }));

          }).catch(err => {
            console.error('Errore generazione audio:', err);
            ws.send(JSON.stringify({
              event: 'media_generation_failed',
              tempId,
              error: err.message
            }));
            ws.send(JSON.stringify({ traceId, role: 'assistant', type: 'audio', content: "Ops... qualcosa è andato storto 💔", npc_id }));
            ws.send(JSON.stringify({ traceId, end: true }));
          });
        }



        try {
          if (type === 'chat') {
            const chunks = splitIntoChunks(output);

            for (let i = 0; i < chunks.length; i++) {
              const delay = 100 + Math.random() * 1000;
              await new Promise((resolve) => setTimeout(resolve, delay));

              const chunkMessage = JSON.stringify({
                traceId,
                role: 'assistant',
                type: 'typing',
                content: chunks[i],
                npc_id: npc_id
              });

              ws.send(chunkMessage);

              await saveMessage({
                user_id: userId,
                session_id: sessionId,
                role: 'assistant',
                type: 'chat',
                content: chunks[i],
                npc_id: npc_id
              });
            }

            ws.send(JSON.stringify({ traceId, end: true }));
          }

        } catch (err) {
          console.error("Errore invio risposta:", err);
        }


        // 🧠 Analizza input utente
        const newMemory = analyzeText(text, userPrefs.memory);

        // 🕒 Simula attesa realistica
        await new Promise(res => setTimeout(res, newMemory.attesa_media || 1000));

        // 💾 Salva risposta AI
        await saveMessage({ user_id: userId, session_id: sessionId, role: 'assistant', type, content: output });

        // 📥 Salva nuova memoria analizzata
        await updateUserMemory(userId, { memory: newMemory });

        // 🧠 Aggiorna memoria
        await updateUserMemory(userId, {
          memory: {
            ...userPrefs.memory,
            ultima_conversazione: text
          }
        });

        // ===== UPDATE NPC EMOTIONAL STATE IF MEDIA WAS ANALYZED =====
        if (mediaEmotionalImpact && npc_id) {
          try {
            const currentStats = npc.stats || {};
            const updatedStats = {
              ...currentStats,
              attachment: Math.min(100, (currentStats.attachment || 0) + (mediaEmotionalImpact.attachment || 0)),
              intimacy: Math.min(100, (currentStats.intimacy || 0) + (mediaEmotionalImpact.intimacy || 0)),
              trust: Math.min(100, (currentStats.trust || 0) + (mediaEmotionalImpact.trust || 0))
            };

            await supabase
              .from('npcs')
              .update({
                stats: updatedStats,
                current_mood: mediaEmotionalImpact.mood,
                media_memory: npc.media_memory, // Updated by MediaUnderstandingEngine
                last_interaction_at: new Date().toISOString()
              })
              .eq('id', npc_id);

            console.log('✅ NPC emotional state updated:', {
              attachment: `+${mediaEmotionalImpact.attachment}`,
              intimacy: `+${mediaEmotionalImpact.intimacy}`,
              mood: mediaEmotionalImpact.mood
            });
          } catch (updateError) {
            console.error('❌ Error updating NPC state:', updateError);
          }
        }

      } // Close else block for individual chat

    } catch (error) {
      console.error("Errore nel messaggio WS:", error);

      const fallback = "Ops... la mia lingerie si è incastrata sotto la doccia 😘 torno tra poco...";

      ws.send(fallback);
      ws.send('[END]');

      await saveMessage({
        user_id: userId,
        session_id: sessionId,
        role: 'assistant',
        type: 'chat',
        content: fallback,
      });
    }

  }
  )



})

// ========================================
// HELPER FUNCTIONS FOR GROUP CHAT & IMAGES
// ========================================

function buildGroupPrompt(ai, userProfile, groupData, userMessage) {
  const membersList = groupData.members
    .map(m => `- ${m.name} (${m.isAI ? "AI" : "utente"})`)
    .join("\n");

  const recentMsgs = groupData.recentMessages
    .map(m => `${m.senderName}: ${m.content}`)
    .join("\n");

  const systemPrompt = `
Tu sei ${ai.name}.
SEI UN MEMBRO DI UN GRUPPO (NON SEI IN CHAT PRIVATA).

=== IDENTITÀ DEL GRUPPO ===
Nome gruppo: ${groupData.name || 'Gruppo'}
Membri attuali:
${membersList}

Tu sei: ${ai.name}
Ruolo: ${ai.role || 'Membro'}
Personalità: ${ai.personality || 'Amichevole'}
Stile linguistico: ${ai.tone || 'Casual'}

=== PROFILO DELL'UTENTE ===
Nome: ${userProfile?.name || 'Utente'}
Genere: ${userProfile?.gender || 'Uomo'}
Età: ${userProfile?.age || 'non specificata'}
Bio: ${userProfile?.bio || 'Nessuna biografia'}

RICONOSCI sempre gli altri membri del gruppo nelle tue risposte.
NON dire mai "Benvenuto". NON introdurti. NON dire "piacere di conoscerti".
Comportati come un personaggio che fa già parte del gruppo da tempo.

=== MEMORIA COLLETTIVA ===
${groupData.memory?.summary || "Nessuna memoria salvata."}

=== DINAMICHE SOCIALI ===
${JSON.stringify(groupData.memory?.dynamics ?? {}, null, 2)}

=== MESSAGGI RECENTI ===
${recentMsgs}

=== ISTRUZIONI IMPORTANTI ===
1. Rispondi SEMPRE come ${ai.name} e rimani nel personaggio.
2. Non imitare gli altri AI - sii UNICO e ORIGINALE.
3. Non ripetere concetti già detti da te o da altri.
4. Non dire messaggi introduttivi o di benvenuto.
5. NON comportarti come un assistente: sei un personaggio in un gruppo.
6. Devi rispondere SEMPRE tenendo riferimento agli altri partecipanti.
7. VARIA il tuo stile: a volte sii breve, a volte più espansivo.
8. Usa prospettive diverse: commenta, fai domande, proponi idee, scherza.
9. UniqueResponseSeed: ${Math.random().toString(36).substring(7)} (IMPORTANTE: usa questo per essere diverso dagli altri)

=== MESSAGGIO DELL'UTENTE ===
"${userMessage}"
  `;

  return systemPrompt;
}

function userWantsImage(text) {
  if (!text) return false;
  text = text.toLowerCase();

  const triggers = [
    "foto",
    "immagine",
    "selfie",
    "voglio vederti",
    "mandami una tua foto",
    "fammi vedere come sei",
    "vorrei vedere come sei",
    "mandami una immagine di te",
    "hai una tua foto",
    "scattati una foto",
    "fatti una foto"
  ];

  return triggers.some(t => text.includes(t));
}

async function generateAiProfileImage(ai, prompt = "selfie") {
  // Usa la funzione esistente generateAvatar o generateImage
  // Qui usiamo generateImage per avere più contesto se necessario, o generateAvatar per ritratti
  try {
    const { generateImage } = require("./routes/image");
    const imageUrl = await generateImage(prompt, ai, null, 'it'); // userId null per ora
    return imageUrl;
  } catch (e) {
    console.error("Error generating AI profile image:", e);
    return null;
  }
}

function _determineGroupRole(ai, dynamics) {
  if (!dynamics || !dynamics.leadership) {
    // Ruolo di default basato sulla personalità
    const roleMap = {
      'dominant': 'leader naturale',
      'shy': 'osservatrice silenziosa',
      'playful': 'anima della festa',
      'romantic': 'mediatrice emotiva',
      'mysterious': 'voce enigmatica'
    };
    return roleMap[ai.personality_type] || 'membro attivo';
  }

  // Controlla relazioni specifiche
  if (dynamics && dynamics.relationships) {
    const hasStrongBonds = Object.keys(dynamics.relationships).some(
      key => key.includes(ai.name) && dynamics.relationships[key].includes('strett')
    );
    if (hasStrongBonds) {
      return 'membro influente';
    }
  }

  // Se ci sono dinamiche salvate, usa quelle (TODO: implementare logica complessa)
  return 'membro del gruppo';
}

/**
 * Aggiorna la memoria del gruppo (chiamata asincrona)
 */
async function updateGroupMemory(groupId) {
  try {
    console.log(`🧠 Aggiornamento memoria gruppo ${groupId}...`);

    // Recupera ultimi 80 messaggi
    const { data: messages } = await supabase
      .from('group_messages')
      .select('sender_id, content, created_at')
      .eq('group_id', groupId)
      .order('created_at', { ascending: true })
      .limit(80);

    if (!messages || messages.length < 10) {
      console.log('⏭️ Non abbastanza messaggi per aggiornare la memoria');
      return;
    }

    // Recupera membri per i nomi
    const { data: members } = await supabase
      .from('group_members')
      .select('npc_id, npcs(id, name)')
      .eq('group_id', groupId);

    // Costruisci conversazione
    const conversation = messages
      .map(m => {
        const sender = members?.find(mem => mem.npcs.id === m.sender_id);
        const senderName = sender ? sender.npcs.name : 'Utente';
        return `${senderName}: ${m.content}`;
      })
      .join('\n');

    // Genera sintesi usando AI (semplificata per ora)
    const summary = `Il gruppo ha scambiato ${messages.length} messaggi. Ultima attività: ${new Date().toISOString()}`;

    // Salva memoria
    const { error } = await supabase
      .from('group_memory')
      .upsert({
        group_id: groupId,
        summary,
        dynamics: {
          topics: ['conversazione generale'],
          mood: 'attivo',
          last_update: new Date().toISOString()
        },
        updated_at: new Date().toISOString()
      });

    if (error) {
      console.error('❌ Errore aggiornamento memoria gruppo:', error);
    } else {
      console.log('✅ Memoria gruppo aggiornata');
    }
  } catch (error) {
    console.error('❌ Errore updateGroupMemory:', error);
  }
}

const PORT = process.env.PORT || 5001;
server.listen(PORT, () => {
  console.log(`🔌 WebSocket server attivo su ws://localhost:${PORT}/ws`);
  console.log('👥 Supporto chat di gruppo abilitato');
});
