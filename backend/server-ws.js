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
const girlfriendRoutes = require('./routes/girlfriend');
const messageRoutes = require('./routes/message');
const groupRoutes = require('./routes/group');
const { brainEngine } = require('./ai/brainEngine');
const app = express();
app.use(cors());
app.use(express.json({ limit: '10mb' }));
app.use(express.static(path.join(__dirname, 'public')));

// Register routes
app.use('/girlfriends', girlfriendRoutes);
app.use('/messages', messageRoutes);
app.use('/groups', groupRoutes);

const server = http.createServer(app);
const wss = new WebSocket.Server({ server, path: '/ws' });
const { analyzeText } = require('./lib/analyzeUserInput');
const { getUserPreferences, updateUserMemory } = require("./lib/userMemory");


async function saveMessage({ user_id, session_id, role, type, content, girlfriend_id }) {
  const data = { user_id, session_id, role, type, content };
  if (girlfriend_id) data.girlfriend_id = girlfriend_id;
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
  const { prompt, girlfriendId } = req.body;
  console.log('🎨 Generate avatar request:', { prompt: prompt?.substring(0, 50), girlfriendId });

  if (!prompt) return res.status(400).json({ error: 'Prompt is required' });

  try {
    const result = await generateAvatar(prompt, girlfriendId);
    console.log('✅ Avatar generated:', { result: result?.substring(0, 100), isSupabase: result?.startsWith('http') });

    // If result starts with http, it's a full URL (Supabase), otherwise it's a filename (local fallback)
    const imageUrl = result.startsWith('http') ? result : `http://${req.headers.host}/${result}`;
    res.json({ imageUrl });
  } catch (error) {
    console.error('Avatar generation error:', error);
    res.status(500).json({ error: 'Failed to generate avatar' });
  }
});

wss.on('connection', (ws, req) => {
  const fullUrl = `http://${req.headers.host}${req.url}`;
  const url = new URL(fullUrl);
  const userId = url.searchParams.get('user_id');

  if (!userId) {
    ws.close(1008, 'Missing user_id');
    return;
  }

  console.log(`🛰️ Connessione WebSocket per utente ${userId}`);

  ws.on('message', async (msg) => {
    const sessionId = new Date().toISOString().slice(0, 10);
    const { text, traceId, girlfriend_id, group_id } = JSON.parse(msg.toString());
    console.log('📨 Messaggio ricevuto:', { text, traceId, girlfriend_id, group_id, userId });

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

        // Recupera i membri AI del gruppo (supporta sia member_id che girlfriend_id per compatibilità)
        const { data: members, error: membersError } = await supabase
          .from('group_members')
          .select(`
            member_id,
            member_type,
            girlfriend_id,
            girlfriends (
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
            const sender = members.find(mem => mem.girlfriends.id === m.sender_id);
            const senderName = sender ? sender.girlfriends.name : (userProfile?.name || 'Utente');
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
        // Costruisci dati del gruppo per il prompt (una volta sola)
        const groupData = {
          name: 'Gruppo',
          members: members.map(m => ({
            name: m.girlfriends.name,
            isAI: true,
            role: _determineGroupRole(m.girlfriends, groupMemory?.dynamics),
            personality: m.girlfriends.personality_type,
            style: m.girlfriends.tone
          })),
          recentMessages: (recentMessages || []).reverse().map(m => {
            const sender = members.find(mem => mem.girlfriends.id === m.sender_id);
            return {
              senderName: sender ? sender.girlfriends.name : (m.sender_id === userId ? (userProfile?.name || 'Utente') : 'Sconosciuto'),
              content: m.content
            };
          }),
          memory: groupMemory || {}
        };
        // Aggiungi l'utente alla lista membri per il prompt
        groupData.members.push({
          name: userProfile?.name || 'Utente',
          isAI: false
        });

        for (const member of members) {
          const ai = member.girlfriends;
          try {
            // Check if user is requesting an image
            if (userWantsImage(text)) {
              console.log(`📸 User requested image from ${ai.name}`);
              const imageUrl = await generateAiProfileImage(ai, text);
              if (imageUrl) {
                // Save image message
                const { data: imgMsg } = await supabase
                  .from('group_messages')
                  .insert({
                    group_id,
                    sender_id: ai.id,
                    content: imageUrl,
                    type: 'image'
                  })
                  .select('id')
                  .single();

                // Send via WebSocket
                ws.send(JSON.stringify({
                  traceId,
                  role: 'assistant',
                  type: 'group_message',
                  content: imageUrl,
                  sender_id: ai.id,
                  sender_name: ai.name,
                  avatar: ai.avatar_url || 'https://ui-avatars.com/api/?name=' + encodeURIComponent(ai.name),
                  group_id,
                  messageId: imgMsg?.id,
                  is_image: true
                }));

                continue; // Skip text response for this AI
              }
            }

            // 2. Genera risposta intelligente con Brain Engine
            console.log(`🧠 Using Brain Engine for ${ai.name}...`);

            const response = await brainEngine.generateIntelligentResponse({
              ai: ai,
              user: userProfile,
              group: {
                id: group_id,
                name: groupData.name,
                members: members
              },
              message: text,
              recentMessages: recentMessages || []
            });

            const output = response.output;

            // Se l'AI decide di non rispondere, salta
            if (!output || output.trim().toUpperCase() === 'SKIP' || output.length < 2) {
              console.log(`⏭️ ${ai.name} ha deciso di non rispondere`);
              continue;
            }

            // Delay per sembrare naturale (variabile in base alla lunghezza)
            await new Promise(resolve => setTimeout(resolve, 500 + Math.random() * 1500));

            // Salva la risposta dell'AI nel gruppo
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

            // Invia la risposta al client via WebSocket
            // FIX: Assicurati che l'avatar sia valido
            const avatarUrl = ai.avatar_url && ai.avatar_url.startsWith('http')
              ? ai.avatar_url
              : 'https://ui-avatars.com/api/?name=' + encodeURIComponent(ai.name) + '&background=random';

            ws.send(JSON.stringify({
              traceId,
              role: 'assistant',
              type: 'group_message',
              content: output,
              sender_id: ai.id,
              sender_name: ai.name,
              avatar: avatarUrl, // ← Avatar garantito
              group_id,
              messageId: aiMessage.id
            }));

            responseCount++;
            console.log(`✅ ${ai.name} ha risposto: ${output.substring(0, 50)}...`);

          } catch (aiError) {
            console.error(`❌ Errore generazione risposta per ${ai.name}:`, aiError);
            // Continua con gli altri AI anche se uno fallisce
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
        console.log('👤 Handling individual chat message for girlfriend:', girlfriend_id);

        const savedUserMessage = await saveMessage({
          user_id: userId,
          session_id: sessionId,
          role: 'user',
          type: 'text',
          content: text,
          girlfriend_id,
        });
        console.log('💾 User message saved:', savedUserMessage.id);

        ws.send(JSON.stringify({ traceId, type: 'ack', serverId: savedUserMessage.id }));

        let girlfriend = null;
        if (girlfriend_id) {
          const { data: gfData, error: gfError } = await supabase
            .from('girlfriends')
            .select('*')
            .eq('id', girlfriend_id)
            .single();

          if (gfError) console.error('❌ Error fetching girlfriend:', gfError);
          girlfriend = gfData;
        }
        console.log('👩 Girlfriend found:', girlfriend ? girlfriend.name : 'None');

        const userPrefs = await getUserPreferences(userId);
        console.log('⚙️ User prefs loaded');

        // Carica messaggi recenti per contesto
        const { data: recentMsgs } = await supabase
          .from('messages')
          .select('role, content, created_at')
          .eq('user_id', userId)
          .eq('girlfriend_id', girlfriend_id)
          .order('created_at', { ascending: false })
          .limit(20);

        console.log('🧠 Using Brain Engine for 1-to-1 chat...');

        // Usa Brain Engine per risposta intelligente
        const response = await brainEngine.generateIntelligentResponse({
          ai: girlfriend,
          user: {
            id: userId,
            name: userPrefs.name,
            ...userPrefs
          },
          group: null, // null per chat 1-to-1
          message: text,
          recentMessages: recentMsgs || []
        });

        let output = response.output;
        let type = response.type || 'chat';

        console.log('🤖 Reply generated:', { type, output: output?.substring(0, 50) });

        // Fallback se risposta è vuota o difensiva
        if (!output || output.trim() === '') {
          output = "Mmm... sto cercando le parole giuste per rispondere al tuo desiderio 😘";
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

        // Se è immagine/video/audio, invia diretto
        if (type === 'image') {
          ws.send(JSON.stringify({ traceId, status: 'rendering_image' }));

          generateImage(output, girlfriend, userId).then(async (url) => {
            const imageMessage = JSON.stringify({
              traceId: traceId,
              role: 'assistant',
              type: 'image',
              content: url.toString(),
              girlfriend_id: girlfriend_id
            });

            ws.send(imageMessage);
            ws.send(JSON.stringify({ traceId, end: true }));

            await saveMessage({
              user_id: userId,
              session_id: sessionId,
              role: 'assistant',
              type: type,
              content: url.toString(),
              girlfriend_id: girlfriend_id
            });
          }).catch(err => {
            console.error('Errore generazione immagine:', err);
            ws.send(JSON.stringify({ traceId, role: 'assistant', type: 'image', content: "Ops... qualcosa è andato storto 💔", girlfriend_id: girlfriend_id }));
            ws.send(JSON.stringify({ traceId, end: true }));
          });
          return; // esci subito
        }

        if (type === 'video') {
          ws.send(JSON.stringify({ traceId, status: 'rendering_video' }));

          // Get recent chat history for context
          const { data: recentMessages } = await supabase
            .from('messages')
            .select('role, content')
            .eq('user_id', userId)
            .eq('girlfriend_id', girlfriend_id)
            .order('created_at', { ascending: false })
            .limit(10);

          const chatHistory = (recentMessages || []).reverse();

          retrievevideo(text, girlfriend, chatHistory, userId, girlfriend_id).then(async (url) => {
            const videoMessage = JSON.stringify({
              traceId: traceId,
              role: 'assistant',
              type: 'video',
              content: url,
              girlfriend_id
            });

            try {
              await saveMessage({
                user_id: userId,
                session_id: sessionId,
                role: 'assistant',
                type: 'video',
                content: url.toString(),
                girlfriend_id
              });
            } catch (e) {
              console.error("❌ Errore salvataggio video:", e);
            }

            ws.send(videoMessage);
            ws.send(JSON.stringify({ traceId, end: true }));

          }).catch(err => {
            console.error('Errore generazione video:', err);
            ws.send(JSON.stringify({ traceId, role: 'assistant', type: 'video', content: "Ops... qualcosa è andato storto 💔", girlfriend_id }));
            ws.send(JSON.stringify({ traceId, end: true }));
          });

          return; // esci subito
        }

        if (type === 'audio') {
          ws.send(JSON.stringify({ traceId, status: 'recording_audio' }));

          // Get recent chat history for context
          const { data: recentMessages } = await supabase
            .from('messages')
            .select('role, content')
            .eq('user_id', userId)
            .eq('girlfriend_id', girlfriend_id)
            .order('created_at', { ascending: false })
            .limit(10);

          const chatHistory = (recentMessages || []).reverse(); // Reverse to get chronological order

          generateAudio(text, girlfriend?.voice_preview_url, chatHistory, userId, girlfriend_id).then(async (url) => {
            const audioMessage = JSON.stringify({
              traceId: traceId,
              role: 'assistant',
              type: 'audio',
              content: url,
              girlfriend_id
            });
            await saveMessage({ user_id: userId, session_id: sessionId, role: 'assistant', type, content: url.toString(), girlfriend_id });
            ws.send(audioMessage);
            ws.send(JSON.stringify({ traceId, end: true }));

          }).catch(err => {
            console.error('Errore generazione audio:', err);
            ws.send(JSON.stringify({ traceId, role: 'assistant', type: 'audio', content: "Ops... qualcosa è andato storto 💔", girlfriend_id }));
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
                girlfriend_id: girlfriend_id
              });

              ws.send(chunkMessage);

              await saveMessage({
                user_id: userId,
                session_id: sessionId,
                role: 'assistant',
                type: 'chat',
                content: chunks[i],
                girlfriend_id: girlfriend_id
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
      .select('girlfriend_id, girlfriends(id, name)')
      .eq('group_id', groupId);

    // Costruisci conversazione
    const conversation = messages
      .map(m => {
        const sender = members?.find(mem => mem.girlfriends.id === m.sender_id);
        const senderName = sender ? sender.girlfriends.name : 'Utente';
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
