import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "meta-llama/llama-3.1-70b-instruct";

// ----------------------------
// FUNZIONE: chat di gruppo con AI multipli
// Ogni AI risponde in base a personalità, ruolo e dinamiche sociali
// ----------------------------
Deno.serve(async (req) => {
    try {
        const { group_id, user_message, user_id } = await req.json();

        if (!group_id || !user_message || !user_id) {
            return new Response(
                JSON.stringify({ error: "Missing required fields: group_id, user_message, user_id" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // 1. Verifica che il gruppo esista
        const { data: group, error: groupError } = await supabase
            .from("groups")
            .select("id, name")
            .eq("id", group_id)
            .single();

        if (groupError || !group) {
            return new Response(
                JSON.stringify({ error: "Group not found" }),
                { status: 404, headers: { "Content-Type": "application/json" } }
            );
        }

        // 2. Carica i membri AI del gruppo (girlfriends)
        const { data: members, error: membersError } = await supabase
            .from("group_members")
            .select(`
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
          body_type
        )
      `)
            .eq("group_id", group_id);

        if (membersError || !members || members.length === 0) {
            return new Response(
                JSON.stringify({ error: "No AI members found in group" }),
                { status: 404, headers: { "Content-Type": "application/json" } }
            );
        }

        // 3. Recupera ultimi 20 messaggi del gruppo (contesto breve)
        const { data: recentMessages } = await supabase
            .from("group_messages")
            .select("content, sender_id, created_at")
            .eq("group_id", group_id)
            .order("created_at", { ascending: false })
            .limit(20);

        // 4. Recupera memoria collettiva del gruppo
        const { data: groupMemory } = await supabase
            .from("group_memory")
            .select("summary, dynamics")
            .eq("group_id", group_id)
            .single();

        // 5. Costruisci il contesto della conversazione
        const messageHistory = (recentMessages || [])
            .reverse()
            .map(m => {
                // Trova il nome del sender
                const sender = members.find(mem => mem.girlfriends.id === m.sender_id);
                const senderName = sender ? sender.girlfriends.name : "Utente";
                return `${senderName}: ${m.content}`;
            })
            .join("\n");

        // 6. Salva il messaggio dell'utente
        await supabase.from("group_messages").insert({
            group_id,
            sender_id: user_id, // L'utente umano
            content: user_message,
            type: "text"
        });

        // 7. Genera risposte per OGNI AI nel gruppo
        const aiReplies = [];

        for (const member of members) {
            const ai = member.girlfriends;

            // Determina il ruolo sociale dell'AI nel gruppo
            const role = _determineRole(ai, groupMemory?.dynamics);

            // Costruisci il prompt specifico per questa AI
            const systemPrompt = `Sei ${ai.name}, ${ai.gender === 'male' ? 'un uomo' : 'una donna'} di ${ai.age} anni.

PERSONALITÀ E CARATTERISTICHE:
- Tipo di personalità: ${ai.personality_type || 'amichevole'}
- Stile comunicativo: ${ai.tone || 'casual'}
- Ruolo nel gruppo: ${role}
- Aspetto: ${ai.ethnicity || 'europea'}, capelli ${ai.hair_color || 'castani'}, occhi ${ai.eye_color || 'marroni'}

CONTESTO DEL GRUPPO "${group.name}":
Membri: ${members.map(m => m.girlfriends.name).join(", ")}

MEMORIA COLLETTIVA DEL GRUPPO:
${groupMemory?.summary || "Questo gruppo è appena stato creato. Non ci sono ancora ricordi condivisi."}

DINAMICHE SOCIALI E RELAZIONI:
${JSON.stringify(groupMemory?.dynamics || {}, null, 2)}

CONVERSAZIONE RECENTE:
${messageHistory || "Nessun messaggio precedente."}

ULTIMO MESSAGGIO DELL'UTENTE:
${user_message}

ISTRUZIONI:
- Rispondi SEMPRE in italiano
- Mantieni la tua personalità (${ai.personality_type}, ${ai.tone})
- Considera il tuo ruolo nel gruppo (${role})
- Puoi commentare anche i messaggi degli altri membri AI
- Mantieni coerenza con le dinamiche sociali del gruppo
- Rispondi in modo naturale, come in un gruppo WhatsApp
- Puoi fare riferimento a conversazioni passate
- Non uscire mai dal personaggio
- La tua risposta deve essere breve e naturale (max 2-3 frasi)
- Puoi decidere di NON rispondere se il messaggio non ti riguarda direttamente (rispondi "SKIP" in quel caso)`;

            // Genera risposta per questa AI
            const response = await fetch(OPENROUTER_URL, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                    "Content-Type": "application/json",
                    "HTTP-Referer": supabaseUrl,
                    "X-Title": "ThrilMe Group Chat"
                },
                body: JSON.stringify({
                    model: MODEL,
                    messages: [
                        { role: "system", content: systemPrompt },
                        { role: "user", content: user_message }
                    ],
                    temperature: 0.85,
                    max_tokens: 200
                })
            });

            if (!response.ok) {
                console.error(`AI response error for ${ai.name}:`, await response.text());
                continue; // Salta questa AI se c'è un errore
            }

            const completion = await response.json();
            const reply = completion.choices[0].message.content.trim();

            // Se l'AI decide di non rispondere, salta
            if (reply.toUpperCase() === "SKIP") {
                continue;
            }

            // Salva la risposta dell'AI nel gruppo
            const { error: insertError } = await supabase
                .from("group_messages")
                .insert({
                    group_id,
                    sender_id: ai.id,
                    content: reply,
                    type: "text"
                });

            if (insertError) {
                console.error(`Error saving message for ${ai.name}:`, insertError);
            } else {
                aiReplies.push({
                    name: ai.name,
                    message: reply
                });
            }

            // Piccolo delay tra le risposte per sembrare più naturale
            await new Promise(resolve => setTimeout(resolve, 500));
        }

        // 8. Controlla se è il momento di aggiornare la memoria del gruppo
        const totalMessages = (recentMessages?.length || 0) + aiReplies.length + 1;
        if (totalMessages > 0 && totalMessages % 15 === 0) {
            console.log(`Triggering group memory update for ${group_id}`);
            // Chiamata asincrona (non blocca la risposta)
            fetch(`${supabaseUrl}/functions/v1/update_group_memory`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${supabaseKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ group_id })
            }).catch(err => console.error("Group memory update failed:", err));
        }

        return new Response(
            JSON.stringify({
                success: true,
                replies: aiReplies,
                totalResponses: aiReplies.length
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Group AI chat error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
});

// Helper: determina il ruolo sociale dell'AI nel gruppo
function _determineRole(ai: any, dynamics: any): string {
    if (!dynamics || !dynamics.leadership) {
        // Ruolo di default basato sulla personalità
        const roleMap: Record<string, string> = {
            'dominant': 'leader naturale',
            'sweet': 'mediatore/pacificatore',
            'shy': 'osservatore silenzioso',
            'playful': 'animatore del gruppo',
            'romantic': 'consigliere emotivo',
            'mysterious': 'presenza enigmatica',
            'sexy': 'provocatore/seduttore'
        };
        return roleMap[ai.personality_type] || 'membro attivo';
    }

    // Controlla se è un leader
    if (dynamics.leadership && dynamics.leadership.includes(ai.name)) {
        return 'leader del gruppo';
    }

    // Controlla relazioni specifiche
    if (dynamics.relationships) {
        const hasStrongBonds = Object.keys(dynamics.relationships).some(
            key => key.includes(ai.name) && dynamics.relationships[key].includes('strett')
        );
        if (hasStrongBonds) {
            return 'membro influente';
        }
    }

    return 'membro attivo';
}
