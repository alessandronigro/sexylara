require('dotenv').config();
require('./utils/autoInstrument');
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
const { brainEngine } = require('./ai/brainEngine'); // legacy (potrebbe essere rimosso dopo)
const AICoreRouter = require('./ai/core/AICoreRouter'); // ✨ AI Core v2.1
const memoryFlush = require('./ai/scheduler/memoryFlush'); // ✨ Memory scheduler
const globalScheduler = require('./ai/scheduler/globalScheduler');
const wsNotificationService = require('./services/wsNotificationService');
const MediaGenerationService = require('./services/MediaGenerationService');
const { getUserPhoto } = require('./ai/media/getUserPhoto');
const { saveUserPhoto } = require('./ai/media/saveUserPhoto');
const { askPhoto, captions } = require('./ai/language/translations');
const { detectInvokedNpcId } = require("./ai/engines/GroupBrainEngine");
const { checkForInitiative } = require('./ai/scheduler/NpcInitiativeEngine');
const globalScheduler = require('./ai/scheduler/globalScheduler');
const { classifyIntent } = require('./ai/intent/intentLLM');
const pendingCouplePhoto = new Map();

function resolveNpcAvatar(npc) {
  if (!npc) return null;
  return npc.avatar_url || npc.avatar || npc.image_reference || npc.face_image_url || null;
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

/**
 * Conta il numero totale di messaggi scambiati tra utente e NPC
 * @param {string} userId - ID dell'utente
 * @param {string} npcId - ID dell'NPC
 * @returns {Promise<number>} - Numero totale di messaggi
 */
async function countMessagesBetweenUserAndNpc(userId, npcId) {
  try {
    const { count, error } = await supabase
      .from('messages')
      .select('*', { count: 'exact', head: true })
      .eq('user_id', userId)
      .eq('npc_id', npcId);

    if (error) {
      console.error('❌ Error counting messages:', error);
      return 0;
    }
    return count || 0;
  } catch (err) {
    console.error('❌ Exception counting messages:', err);
    return 0;
  }
}

/**
 * Conta il numero totale di messaggi in un gruppo
 * @param {string} groupId - ID del gruppo
 * @returns {Promise<number>} - Numero totale di messaggi nel gruppo
 */
async function countGroupMessages(groupId) {
  try {
    const { count, error } = await supabase
      .from('group_messages')
      .select('*', { count: 'exact', head: true })
      .eq('group_id', groupId);

    if (error) {
      console.error('❌ Error counting group messages:', error);
      return 0;
    }
    return count || 0;
  } catch (err) {
    console.error('❌ Exception counting group messages:', err);
    return 0;
  }
}

/**
 * Genera una risposta riluttante quando l'utente richiede media troppo presto
 * @param {string} mediaType - Tipo di media richiesto ('photo', 'video', 'audio')
 * @param {string} npcName - Nome dell'NPC
 * @param {number} currentCount - Numero attuale di messaggi
 * @param {number} requiredCount - Numero richiesto di messaggi (default: 10)
 * @returns {string} - Messaggio di risposta riluttante
 */
function generateReluctantResponse(mediaType, npcName, currentCount, requiredCount = 10) {
  const remaining = requiredCount - currentCount;
  const mediaNames = {
    photo: 'foto',
    video: 'video',
    audio: 'audio'
  };
  const mediaName = mediaNames[mediaType] || 'media';

  const responses = [
    `Mmm... non so se sono pronta a mandarti una ${mediaName} così presto 😊 Conosciamoci ancora un po', no?`,
    `Aspetta, tesoro... siamo appena all'inizio! 😉 Parliamo ancora un po' prima, va bene?`,
    `Hai fretta? 😏 Preferisco conoscerci meglio prima di condividere ${mediaName === 'foto' ? 'una' : 'un'} ${mediaName}...`,
    `Non così in fretta! 😘 Facciamo ancora qualche chiacchierata, poi ne parliamo, ok?`,
    `Ehi, non correre! 😊 Mi piace parlare con te, ma per ${mediaName === 'foto' ? 'una' : 'un'} ${mediaName}... aspetta ancora un po' 😉`
  ];

  return responses[Math.floor(Math.random() * responses.length)];
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
let globalSchedulerStarted = false;

function sendNpcStatus(ws, npcId, status, traceId) {
  try {
    ws.send(JSON.stringify({
      event: 'npc_status',
      npcId,
      status,
      traceId
    }));
  } catch (err) {
    console.warn('⚠️ Failed to send npc_status:', err?.message);
  }
}

async function saveMessage({ user_id, session_id, role, type, content, npc_id, recipient_user_id }) {
  const data = { user_id, session_id, role, type, content };
  if (npc_id) data.npc_id = npc_id;
  if (recipient_user_id) data.recipient_user_id = recipient_user_id;
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

  if (!globalSchedulerStarted) {
    globalScheduler.start(userSockets, 60 * 1000);
    globalSchedulerStarted = true;
  }

  ws.on('message', async (msg) => {
    const sessionId = new Date().toISOString().slice(0, 10);
    const parsed = JSON.parse(msg.toString());
    const parsedNpcId = parsed.npc_id ? parsed.npc_id.toString() : null;

    if (parsed.event === 'typing') {
      const status = parsed.status || 'typing';
      if (parsedNpcId) {
        const recipientWs = userSockets.get(parsedNpcId);
        if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
          recipientWs.send(JSON.stringify({
            event: 'npc_status',
            npcId: userId,
            status,
          }));
        }
      }
      return;
    }

    const { text, traceId, npc_id, group_id, mediaType, mediaUrl } = parsed;
    console.log('📨 Messaggio ricevuto:', { text, traceId, npc_id, group_id, mediaType, mediaUrl, userId });

    try {
      // ========================================
      // GROUP CHAT HANDLING
      // ========================================
      if (group_id) {
        console.log('👥 Messaggio di gruppo rilevato:', group_id);

        const intentLabel = await classifyIntent(text || '', 'user');
        console.log('🧭 Detected intent user:', intentLabel);
        let classifierMediaType = null;
        switch (intentLabel) {
          case 'request_image':
            classifierMediaType = 'photo';
            break;
          case 'request_video':
            classifierMediaType = 'video';
            break;
          case 'request_audio':
            classifierMediaType = 'audio';
            break;
          default:
            classifierMediaType = null;
        }

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

        // Recupera i membri del gruppo (supporta sia user che npc)
        const { data: members, error: membersError } = await supabase
          .from('group_members')
          .select('member_id, member_type, npc_id, role, npcs(id, name, avatar_url, group_behavior_profile)')
          .eq('group_id', group_id);

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

        const npcIds = (members || [])
          .filter(m => m.member_type === 'npc' || m.member_type === 'ai')
          .map(m => m.npc_id || m.member_id);
        const userIds = (members || [])
          .filter(m => m.member_type === 'user')
          .map(m => m.member_id);

        const { data: npcData } = await supabase
          .from('npcs')
          .select('id, name, gender, personality_type, tone, age, ethnicity, hair_color, eye_color, body_type, avatar_url, face_image_url, group_behavior_profile')
          .in('id', npcIds.length ? npcIds : ['00000000-0000-0000-0000-000000000000']);

        const { data: userData } = await supabase
          .from('user_profile')
          .select('id, name, username, avatar_url')
          .in('id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']);

        const npcMap = (npcData || []).reduce((acc, n) => { acc[n.id] = n; return acc; }, {});
        const userMap = (userData || []).reduce((acc, u) => { acc[u.id] = u; return acc; }, {});

        const fullMembers = (members || []).map(m => {
          if (m.member_type === 'npc' || m.member_type === 'ai') {
            const npc = npcMap[m.npc_id || m.member_id] || m.npcs || {};
            return {
              id: npc.id || m.npc_id || m.member_id,
              type: 'npc',
              name: npc.name || 'Thriller',
              npcs: npc,
              member_id: m.member_id,
              npc_id: npc.id || m.npc_id || m.member_id
            };
          }
          const user = userMap[m.member_id] || {};
          return {
            id: user.id || m.member_id,
            type: 'user',
            name: user.username || user.name || 'Utente',
            member_id: m.member_id
          };
        });

        const aiMembers = fullMembers.filter(m => m.type === 'npc');

        console.log(`👥 Trovati ${aiMembers.length} membri AI nel gruppo`);

        // Cache avatar per NPC del gruppo
        const avatarCache = {};
        const resolveAvatar = (ai) => {
          if (!ai) return null;
          if (avatarCache[ai.id]) return avatarCache[ai.id];
          const url = ai.avatar_url && ai.avatar_url.startsWith('http')
            ? ai.avatar_url
            : resolveNpcAvatar(ai);
          avatarCache[ai.id] = url;
          return url;
        };

        const nameMap = {};
        fullMembers.forEach(m => { nameMap[m.id] = m.name; });

        const { data: recentMessages } = await supabase
          .from('group_messages')
          .select('content, sender_id, created_at, type')
          .eq('group_id', group_id)
          .order('created_at', { ascending: false })
          .limit(20);

        const historyForAi = (recentMessages || [])
          .reverse()
          .map(m => ({
            sender_id: m.sender_id,
            sender_name: nameMap[m.sender_id] || 'Utente',
            content: m.content
          }));

        // Notifica che le AI stanno "pensando"
        ws.send(JSON.stringify({
          traceId,
          status: 'group_thinking',
          memberCount: aiMembers.length
        }));

        const invokedNpcId = detectInvokedNpcId(text, aiMembers);

        if (classifierMediaType === 'photo' || classifierMediaType === 'video' || classifierMediaType === 'audio') {
          // Controlla se ci sono almeno 10 messaggi nel gruppo prima di accondiscendere
          const groupMessageCount = await countGroupMessages(group_id);
          const MIN_MESSAGES_REQUIRED = 10;

          if (groupMessageCount < MIN_MESSAGES_REQUIRED) {
            // NPC riluttante: rifiuta la richiesta
            let mediaTarget = null;
            if (invokedNpcId) {
              mediaTarget = aiMembers.find(m => m.id === invokedNpcId);
            } else if (aiMembers.length === 1) {
              mediaTarget = aiMembers[0];
            } else if (aiMembers.length > 0) {
              // Se ci sono più NPC, scegli uno casuale per la risposta
              mediaTarget = aiMembers[Math.floor(Math.random() * aiMembers.length)];
            }

            if (mediaTarget) {
              const ai = mediaTarget.npcs;
              const reluctantResponse = generateReluctantResponse(classifierMediaType, ai.name, groupMessageCount, MIN_MESSAGES_REQUIRED);

              // Salva risposta riluttante
              const { data: aiMessage } = await supabase
                .from('group_messages')
                .insert({
                  group_id,
                  sender_id: ai.id,
                  content: reluctantResponse,
                  type: 'text'
                })
                .select('id')
                .single();

              // Invia risposta riluttante
              ws.send(JSON.stringify({
                traceId,
                role: 'assistant',
                type: 'group_message',
                content: reluctantResponse,
                sender_id: ai.id,
                sender_name: ai.name,
                avatar: resolveAvatar(ai),
                group_id,
                messageId: aiMessage?.id
              }));

              ws.send(JSON.stringify({ traceId, end: true, group_id }));
              return;
            }
          }

          let mediaTarget = null;
          if (invokedNpcId) {
            mediaTarget = aiMembers.find(m => m.id === invokedNpcId);
          } else if (aiMembers.length === 1) {
            mediaTarget = aiMembers[0];
          }

          if (mediaTarget) {
            const ai = mediaTarget.npcs;
            const tempId = `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
            // Aggiorna stato NPC per evitare idle in UI
            if (classifierMediaType === 'photo') sendNpcStatus(ws, ai.id, 'sending_image', traceId);
            if (classifierMediaType === 'video') sendNpcStatus(ws, ai.id, 'sending_video', traceId);
            if (classifierMediaType === 'audio') sendNpcStatus(ws, ai.id, 'recording_audio', traceId);
            // Invia messaggio placeholder per mostrare attività immediata in chat
            try {
              const placeholderText = classifierMediaType === 'photo'
                ? `${ai.name} sta preparando una foto...`
                : classifierMediaType === 'video'
                  ? `${ai.name} sta preparando un video...`
                  : `${ai.name} sta registrando un audio...`;

              const { data: placeholderMsg } = await supabase.from('group_messages').insert({
                group_id,
                sender_id: ai.id,
                content: placeholderText,
                type: 'text'
              }).select('id').single();

              ws.send(JSON.stringify({
                traceId,
                role: 'assistant',
                type: 'group_message',
                content: placeholderText,
                sender_id: ai.id,
                sender_name: ai.name,
                avatar: resolveAvatar(ai),
                group_id,
                messageId: placeholderMsg?.id
              }));
            } catch (placeholderErr) {
              console.warn('⚠️ Unable to send placeholder media message:', placeholderErr?.message);
            }
            ws.send(JSON.stringify({
              event: 'media_generation_started',
              tempId,
              npcId: ai.id,
              mediaType: classifierMediaType,
              traceId
            }));
            try {
              let mediaResult;
              if (classifierMediaType === 'photo') {
                const faceRef = await ensureNpcImageForMedia(ai);
                mediaResult = await MediaGenerationService.generatePhoto(ai, { scenePrompt: text || '' }, faceRef);
              } else if (classifierMediaType === 'video') {
                mediaResult = await MediaGenerationService.generateVideo(ai, { scenePrompt: text || '' }, userId);
              } else if (classifierMediaType === 'audio') {
                mediaResult = await MediaGenerationService.generateAudio(ai, { scenePrompt: text || '' }, userId);
              }
              if (!mediaResult || !mediaResult.url) throw new Error('media generation failed');
              const { data: savedMsg } = await supabase.from('group_messages').insert({
                group_id,
                sender_id: ai.id,
                content: mediaResult.url,
                type: classifierMediaType
              }).select('id').single();
              ws.send(JSON.stringify({
                event: 'media_generation_completed',
                tempId,
                mediaType: classifierMediaType,
                finalUrl: mediaResult.url,
                caption: mediaResult.caption,
                messageId: savedMsg?.id,
                npcId: ai.id
              }));
              sendNpcStatus(ws, ai.id, '', traceId);
            } catch (mediaErr) {
              console.error('❌ Group media generation failed:', mediaErr);
              ws.send(JSON.stringify({
                event: 'media_generation_failed',
                tempId,
                error: mediaErr.message
              }));
              sendNpcStatus(ws, ai.id, '', traceId);
            }
          }
          ws.send(JSON.stringify({ traceId, end: true, group_id, totalResponses: mediaTarget ? 1 : 0 }));
          return;
        }

        // Genera risposte testuali orchestrate (GroupBrainEngine)
        let responseCount = 0;
        try {
          // Enrich npcMembers with LifeCore/SystemPrompt best-effort
          const { getNpcProfile } = require('./ai/memory/npcRepository');
          const npcMembers = await Promise.all(aiMembers.map(async (m) => {
            const baseNpc = m.npcs || {};
            try {
              const prof = await getNpcProfile(baseNpc.id, baseNpc.name);
              return {
                ...baseNpc,
                lifeCore: prof?.lifeCore || prof?.data?.npc_json || null,
                promptSystem: prof?.promptSystem || prof?.data?.prompt_system || prof?.npc?.prompt_system || null,
              };
            } catch (err) {
              console.warn('[Group] Unable to load npc profile for', baseNpc.id, err?.message || err);
              return baseNpc;
            }
          }));

          const userMembers = fullMembers
            .filter(m => m.type === 'user')
            .map(m => ({ id: m.id, name: m.name, avatar_url: userMap[m.id]?.avatar_url || null }));

          // Notify typing for all NPCs
          npcMembers.forEach(n => sendNpcStatus(ws, n.id, 'typing', traceId));

          const result = await AICoreRouter.routeGroupChat({
            groupId: group_id,
            userId,
            message: text,
            history: historyForAi,
            invokedNpcId,
            options: { rawMessage: text }
          });


          const replies = result?.responses || [];
          const npcLookup = npcMembers.reduce((acc, n) => { acc[n.id] = n; return acc; }, {});

          for (const resp of replies) {
            if (!resp) continue;
            const output = resp.output || resp.text;
            if (!output) continue;
            const ai = npcLookup[resp.npcId] || { id: resp.npcId, name: 'NPC' };

            const baseDelay = 1500;
            const charDelay = 30;
            const typingDelay = baseDelay + (output.length * charDelay);
            await new Promise(resolve => setTimeout(resolve, typingDelay));

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
              sendNpcStatus(ws, ai.id, '', traceId);
              continue;
            }

            ws.send(JSON.stringify({
              traceId,
              role: 'assistant',
              type: 'group_message',
              content: output,
              sender_id: ai.id,
              sender_name: ai.name,
              avatar: resolveAvatar(ai),
              group_id,
              messageId: aiMessage.id
            }));

            responseCount++;
            console.log(`✅ ${ai.name} ha risposto: ${output.substring(0, 50)}...`);
            sendNpcStatus(ws, ai.id, '', traceId);
          }
        } catch (aiError) {
          console.error('❌ Errore orchestrazione risposte di gruppo:', aiError);
        }

        // Fallback: se nessun NPC ha risposto, forza un messaggio breve da un NPC casuale
        if (responseCount === 0 && aiMembers.length > 0) {
          console.warn('⚠️ Nessuna risposta AI, attivo fallback', {
            aiMembers: aiMembers.map(m => ({
              id: m.id,
              name: m.npcs?.name || m.name,
              hasNpc: !!m.npcs,
            })),
            invokedNpcId,
            classifierMediaType,
            text,
          });
          const fallbackMember = aiMembers[Math.floor(Math.random() * aiMembers.length)];
          const fallbackAi = fallbackMember.npcs;
          const fallbackPhrases = [
            'Eccomi, sono qui!',
            'Sono qui, dimmi pure.',
            'Presente, raccontami.',
            'Ci sono, vai avanti.',
            'Ti ascolto, dimmi tutto.'
          ];
          const fallbackText = fallbackAi?.name
            ? `${fallbackAi.name}: ${fallbackPhrases[Math.floor(Math.random() * fallbackPhrases.length)]}`
            : fallbackPhrases[Math.floor(Math.random() * fallbackPhrases.length)];
          try {
            const { data: savedMsg, error: saveErr } = await supabase
              .from('group_messages')
              .insert({
                group_id,
                sender_id: fallbackAi?.id || aiMembers[0].id,
                content: fallbackText,
                type: 'text'
              })
              .select('id')
              .single();

            if (saveErr) {
              console.error('❌ Errore salvataggio fallback group message:', saveErr);
            } else {
              ws.send(JSON.stringify({
                traceId,
                role: 'assistant',
                type: 'group_message',
                content: fallbackText,
                sender_id: fallbackAi?.id || aiMembers[0].member_id,
                sender_name: fallbackAi?.name || 'NPC',
                avatar: fallbackAi?.avatar_url || resolveNpcAvatar(fallbackAi),
                group_id,
                messageId: savedMsg?.id,
              }));
              responseCount = 1;
              console.log('✅ Fallback group reply sent.');
            }
          } catch (fallbackErr) {
            console.error('❌ Errore fallback group reply:', fallbackErr);
          }
          sendNpcStatus(ws, fallbackAi?.id || aiMembers[0].id, '', traceId);
        }

        // Invia segnale di fine conversazione
        ws.send(JSON.stringify({
          traceId,
          end: true,
          group_id,
          totalResponses: responseCount
        }));

        console.log(`✅ Chat di gruppo completata: ${responseCount}/${aiMembers.length} AI hanno risposto`);

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
        console.log('👤 Handling individual chat message. Target ID:', npc_id);

        let npc = null;
        let recipientUser = null;

        // Check if target is NPC
        if (npc_id) {
          const { data: gfData } = await supabase
            .from('npcs')
            .select('*')
            .eq('id', npc_id)
            .single();

          if (gfData) {
            npc = gfData;
          } else {
            // Check if target is User
            const { data: userData } = await supabase
              .from('user_profile')
              .select('*')
              .eq('id', npc_id)
              .single();
            if (userData) {
              recipientUser = userData;
            }
          }
        }

        if (!npc && !recipientUser) {
          console.error('❌ Target not found (neither NPC nor User):', npc_id);
          // Try to save anyway if it's a valid UUID, maybe it's a new NPC not yet cached? 
          // But for now, let's assume if not found in DB, it's an error or we can't save with FK.
          // Actually, if we try to save with npc_id and it doesn't exist, it will fail.
          // So we should return error.
          ws.send(JSON.stringify({ traceId, type: 'error', content: 'Target not found' }));
          return;
        }

        const resolvedMediaType = (mediaType || '').toString().toLowerCase();
        let outgoingType = 'text';
        let outgoingContent = text;
        let statusHint = '';

        if (mediaUrl && resolvedMediaType) {
          switch (resolvedMediaType) {
            case 'photo':
            case 'image':
            case 'media':
              outgoingType = 'image';
              outgoingContent = mediaUrl;
              statusHint = 'sending_image';
              break;
            case 'video':
              outgoingType = 'video';
              outgoingContent = mediaUrl;
              statusHint = 'sending_video';
              break;
            case 'audio':
              outgoingType = 'audio';
              outgoingContent = mediaUrl;
              statusHint = 'sending_audio';
              break;
            default:
              outgoingType = 'text';
              outgoingContent = text;
              statusHint = '';
          }
        }

        const savedUserMessage = await saveMessage({
          user_id: userId,
          session_id: sessionId,
          role: 'user',
          type: outgoingType,
          content: outgoingContent,
          npc_id: npc ? npc.id : null,
          recipient_user_id: recipientUser ? recipientUser.id : null
        });
        console.log('💾 User message saved:', savedUserMessage.id);

        ws.send(JSON.stringify({ traceId, type: 'ack', serverId: savedUserMessage.id }));

        if (recipientUser) {
          console.log(`👤 User-to-User message to ${recipientUser.username}`);
          // Forward to recipient if connected
          const recipientWs = userSockets.get(recipientUser.id);
          if (recipientWs && recipientWs.readyState === WebSocket.OPEN) {
            // Fetch sender profile for display
            const { data: senderProfile } = await supabase.from('user_profile').select('username, avatar_url').eq('id', userId).single();

            if (statusHint) {
              recipientWs.send(JSON.stringify({
                event: 'npc_status',
                npcId: userId,
                status: statusHint,
              }));
            }

            console.log(`📤 Forwarding message to recipient ${recipientUser.id}`);
            recipientWs.send(JSON.stringify({
              traceId: `user_msg_${Date.now()}`,
              role: 'user',
              type: outgoingType,
              content: outgoingContent,
              npc_id: userId, // Use sender's ID as npc_id for routing
              sender_id: userId,
              sender_name: senderProfile?.username || 'User',
              avatar: senderProfile?.avatar_url,
              avatar_url: senderProfile?.avatar_url,
              timestamp: new Date().toISOString(),
              serverId: savedUserMessage.id
            }));
            if (statusHint) {
              recipientWs.send(JSON.stringify({
                event: 'npc_status',
                npcId: userId,
                status: '',
              }));
            }
            console.log(`✅ Message forwarded to ${recipientUser.username}`);
          } else {
            console.log(`⚠️ Recipient ${recipientUser.username} is not connected`);
          }
          // Stop processing AI response
          ws.send(JSON.stringify({ traceId, end: true }));
          return;
        }

        const intentLabel = await classifyIntent(text || '', 'user');
        console.log('🧭 Detected intent user:', intentLabel);
        let classifierMediaType = null;
        switch (intentLabel) {
          case 'request_image':
            classifierMediaType = 'photo';
            break;
          case 'request_video':
            classifierMediaType = 'video';
            break;
          case 'request_audio':
            classifierMediaType = 'audio';
            break;
          default:
            classifierMediaType = null;
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
              const audioResult = await MediaGenerationService.generateAudio(npc, audioIntent, userId);

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

        // Usa AI Core Router v2.1 per risposta intelligente
        const response = await AICoreRouter.routeChat({
          userId,
          npcId: npc.id,
          message: text,
          history: recentMsgs ? recentMsgs.reverse() : [],
          media: mediaAnalysisContext ? { type: 'image', url: mediaAnalysisContext.url } : null,
          options: {
            forcedMediaType: classifierMediaType,
            userPrefs
          }
        });

        let output = response.text || response.output;
        let type = classifierMediaType || 'chat';
        // Gestione errori Venice
        let npcIntent = null;
        if (output === "[VENICE_ERROR]" || output === "[EMPTY_RESPONSE]") {
          output = "Amore, scusa… credo di aver perso il filo. Cosa volevi dirmi?";
          npcIntent = "npc_send_none";
          type = 'chat';
        }

        // =======================================================
        // 🧠 CLASSIFICAZIONE INTENTO DELL'NPC (output del modello)
        // =======================================================

        if (!npcIntent) {
          npcIntent = await classifyIntent(output || '', 'npc');
        }
        console.log('🧭 Detected intent npc:', npcIntent);

        // Controlla se l'NPC vuole inviare media autonomamente (non richiesto dall'utente)
        // Se sì, verifica che ci siano almeno 10 messaggi
        if (npcIntent === 'npc_send_image' || npcIntent === 'npc_send_audio' || npcIntent === 'npc_send_video' || npcIntent === 'npc_send_couple_photo') {
          // Se l'utente non ha richiesto esplicitamente media, controlla il numero di messaggi
          if (!classifierMediaType) {
            const messageCount = await countMessagesBetweenUserAndNpc(userId, npc_id);
            const MIN_MESSAGES_REQUIRED = 10;

            if (messageCount < MIN_MESSAGES_REQUIRED) {
              // NPC riluttante: non invia media autonomamente, converte in risposta testuale
              console.log(`🚫 NPC wants to send ${npcIntent} but only ${messageCount} messages exchanged. Converting to text.`);
              npcIntent = 'npc_send_none';
              type = 'chat';
              // Modifica l'output per essere più riluttante
              output = output.replace(/\[MODE:(image|video|audio|chat)\]/i, '').trim();
              if (!output || output.length < 20) {
                output = generateReluctantResponse(
                  npcIntent === 'npc_send_image' ? 'photo' : npcIntent === 'npc_send_video' ? 'video' : 'audio',
                  npc?.name || 'NPC',
                  messageCount,
                  MIN_MESSAGES_REQUIRED
                );
              }
            }
          }
        }

        if (npcIntent === 'npc_send_image') {
          type = 'photo';
        }

        if (npcIntent === 'npc_send_audio') {
          type = 'audio';
        }

        if (npcIntent === 'npc_send_video') {
          type = 'video';
        }

        if (npcIntent === 'npc_send_couple_photo') {
          type = 'couple_photo';
        }

        // npc_send_none = non fare nulla, resta "chat"

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
            .from('user_profile')
            .update({ name: newName })
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

        // ===== HANDLE MEDIA GENERATION solo se intentLLM richiede media =====
        const generationType = type;
        const mediaRequested = generationType === 'photo' || generationType === 'video' || generationType === 'audio' || generationType === 'couple_photo';
        if (output && (output.includes("[VENICE_ERROR]") || output.includes("[EMPTY_RESPONSE]"))) {
          type = 'chat';
        }

        if (mediaRequested) {
          // Controlla se ci sono almeno 10 messaggi prima di accondiscendere
          const messageCount = await countMessagesBetweenUserAndNpc(userId, npc_id);
          const MIN_MESSAGES_REQUIRED = 10;

          if (messageCount < MIN_MESSAGES_REQUIRED) {
            // NPC riluttante: rifiuta la richiesta e invia risposta testuale
            const reluctantResponse = generateReluctantResponse(generationType, npc?.name || 'NPC', messageCount, MIN_MESSAGES_REQUIRED);

            // Salva risposta riluttante
            const savedMsg = await saveMessage({
              user_id: userId,
              session_id: sessionId,
              role: 'assistant',
              type: 'text',
              content: reluctantResponse,
              npc_id: npc_id
            });

            // Invia risposta riluttante come messaggio di testo
            sendNpcStatus(ws, npc_id || npc?.id, 'typing', traceId);
            await new Promise((resolve) => setTimeout(resolve, 1000 + Math.random() * 1000));

            ws.send(JSON.stringify({
              traceId,
              role: 'assistant',
              type: 'text',
              content: reluctantResponse,
              npc_id: npc_id,
              messageId: savedMsg.id,
              avatar: resolveNpcAvatar(npc)
            }));

            ws.send(JSON.stringify({ traceId, end: true }));
            sendNpcStatus(ws, npc_id || npc?.id, '', traceId);
            return; // Esci senza generare media
          }

          console.log(`🎬 Generating ${generationType} as requested by user... (${messageCount} messages exchanged)`);
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
          if (generationType === 'photo') sendNpcStatus(ws, npc_id || npc?.id, 'sending_image', traceId);
          if (generationType === 'video') sendNpcStatus(ws, npc_id || npc?.id, 'sending_video', traceId);
          if (generationType === 'audio') sendNpcStatus(ws, npc_id || npc?.id, 'recording_audio', traceId);

          try {
            let mediaResult;

            if (generationType === 'photo') {
              const faceRef = await ensureNpcImageForMedia(npc);
              mediaResult = await MediaGenerationService.generatePhoto(
                npc,
                { scenePrompt: text || output || '' },
                faceRef      // ensure a face reference is always available
              );
            } else if (generationType === 'video') {
              mediaResult = await MediaGenerationService.generateVideo(
                npc,
                { scenePrompt: text || output || '' },
                userId
              );
            } else if (generationType === 'audio') {
              mediaResult = await MediaGenerationService.generateAudio(
                npc,
                { scenePrompt: text || output || '' },
                userId
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
          sendNpcStatus(ws, npc_id || npc?.id, '', traceId);
        }

        // Se è immagine/video/audio, invia diretto (LEGACY PATH)
        if (type === 'image') {
          const tempId = `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          sendNpcStatus(ws, npc_id || npc?.id, 'sending_image', traceId);
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
          }).finally(() => {
            sendNpcStatus(ws, npc_id || npc?.id, '', traceId);
          });
          return; // esci subito
        }

        if (type === 'video') {
          const tempId = `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          sendNpcStatus(ws, npc_id || npc?.id, 'sending_video', traceId);
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
          }).finally(() => {
            sendNpcStatus(ws, npc_id || npc?.id, '', traceId);
          });

          return; // esci subito
        }

        if (type === 'audio') {
          const tempId = `pending_${Date.now()}_${Math.random().toString(36).substr(2, 9)}`;
          sendNpcStatus(ws, npc_id || npc?.id, 'recording_audio', traceId);
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
          generateAudio(text, voiceUrl, chatHistory, userId, npc_id).then(async (audioResult) => {
            const mediaUrl = typeof audioResult === 'string'
              ? audioResult
              : (audioResult?.mediaUrl || audioResult?.audioUrl || audioResult?.url);

            if (!mediaUrl) {
              throw new Error('missing audio url from generation');
            }

            const savedMsg = await saveMessage({
              user_id: userId,
              session_id: sessionId,
              role: 'assistant',
              type,
              content: mediaUrl,
              npc_id
            });

            ws.send(JSON.stringify({
              event: 'media_generation_completed',
              tempId,
              mediaType: 'audio',
              finalUrl: mediaUrl,
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
          }).finally(() => {
            sendNpcStatus(ws, npc_id || npc?.id, '', traceId);
          });
        }



        try {
          if (type === 'chat') {
            // Notifica il frontend che l'NPC sta scrivendo e aggiungi un ritardo iniziale più naturale
            sendNpcStatus(ws, npc_id || npc?.id, 'typing', traceId);
            const initialDelay = 1000 + Math.random() * 2000;
            await new Promise((resolve) => setTimeout(resolve, initialDelay));

            const chunks = splitIntoChunks(output);

            for (let i = 0; i < chunks.length; i++) {
              const delay = 200 + Math.random() * 1000;
              await new Promise((resolve) => setTimeout(resolve, delay));
              const chunkMessage = JSON.stringify({
                traceId,
                role: 'assistant',
                type: 'typing',
                content: chunks[i],
                npc_id: npc_id,
                avatar: resolveNpcAvatar(npc)
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
            sendNpcStatus(ws, npc_id || npc?.id, '', traceId);
          }

        } catch (err) {
          console.error("Errore invio risposta:", err);
          sendNpcStatus(ws, npc_id || npc?.id, '', traceId);
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

    const { data: members } = await supabase
      .from('group_members')
      .select('member_id, member_type, npc_id')
      .eq('group_id', groupId);

    const npcIds = (members || []).filter(m => m.member_type === 'npc' || m.member_type === 'ai').map(m => m.npc_id || m.member_id);
    const userIds = (members || []).filter(m => m.member_type === 'user').map(m => m.member_id);

    const { data: npcData } = await supabase
      .from('npcs')
      .select('id, name')
      .in('id', npcIds.length ? npcIds : ['00000000-0000-0000-0000-000000000000']);

    const { data: userData } = await supabase
      .from('user_profile')
      .select('id, name')
      .in('id', userIds.length ? userIds : ['00000000-0000-0000-0000-000000000000']);

    const nameMap = {};
    (npcData || []).forEach(n => { nameMap[n.id] = n.name; });
    (userData || []).forEach(u => { nameMap[u.id] = u.name; });

    const conversation = messages
      .map(m => `${nameMap[m.sender_id] || 'Utente'}: ${m.content}`)
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

  // ✨ Start memory consolidation scheduler (AI Core v2.1)
  memoryFlush.start(5000); // Flush ogni 5 secondi
  console.log('🧠 Memory consolidation scheduler started');
});
