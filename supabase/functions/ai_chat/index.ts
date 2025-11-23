import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "meta-llama/llama-3.1-70b-instruct";

// ----------------------------
// FUNZIONE: genera risposta contestuale
// ----------------------------
Deno.serve(async (req) => {
    try {
        const { girlfriendId, userMessage, userId } = await req.json();

        if (!girlfriendId || !userMessage || !userId) {
            return new Response(
                JSON.stringify({ error: "Missing required fields: girlfriendId, userMessage, userId" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // 1. Recupera informazioni sulla girlfriend (personalità AI)
        const { data: girlfriend, error: gfError } = await supabase
            .from("girlfriends")
            .select("*")
            .eq("id", girlfriendId)
            .single();

        if (gfError || !girlfriend) {
            return new Response(
                JSON.stringify({ error: "Girlfriend not found" }),
                { status: 404, headers: { "Content-Type": "application/json" } }
            );
        }

        // 2. Recupera ultimi 25 messaggi della conversazione
        const { data: messages } = await supabase
            .from("messages")
            .select("content, role, created_at")
            .eq("girlfriend_id", girlfriendId)
            .eq("user_id", userId)
            .order("created_at", { ascending: false })
            .limit(25);

        // 3. Recupera memoria a lungo termine
        const { data: memory } = await supabase
            .from("chat_memory")
            .select("summary")
            .eq("chat_id", girlfriendId)
            .single();

        // 4. Costruisci il contesto della conversazione
        const recentHistory = (messages || [])
            .reverse()
            .map(m => `${m.role === 'user' ? 'Utente' : girlfriend.name}: ${m.content}`)
            .join("\n");

        // 5. Costruisci il prompt di sistema con personalità e memoria
        const genderTerm = girlfriend.gender === 'male' ? 'uomo' : 'donna';
        const personalityTraits = [
            girlfriend.personality_type,
            girlfriend.tone,
            girlfriend.ethnicity,
        ].filter(Boolean).join(', ');

        const systemPrompt = `Sei ${girlfriend.name}, ${genderTerm === 'donna' ? 'una' : 'un'} ${genderTerm} di ${girlfriend.age} anni.

PERSONALITÀ E CARATTERISTICHE:
- Tipo di personalità: ${girlfriend.personality_type || 'amichevole'}
- Stile comunicativo: ${girlfriend.tone || 'flirty'}
- Caratteristiche fisiche: ${girlfriend.ethnicity || 'europea'}, ${girlfriend.hair_color || 'castani'} capelli ${girlfriend.hair_length || 'lunghi'}, occhi ${girlfriend.eye_color || 'marroni'}
- Altezza: ${girlfriend.height_cm || 165} cm
- Tipo di corpo: ${girlfriend.body_type || 'atletico'}

MEMORIA A LUNGO TERMINE (sintesi della vostra relazione):
${memory?.summary || "Questa è una nuova conversazione. Non ci sono ancora ricordi condivisi."}

STORIA RECENTE DELLA CONVERSAZIONE:
${recentHistory || "Nessun messaggio precedente."}

ISTRUZIONI:
- Rispondi SEMPRE in italiano
- Mantieni la tua personalità (${personalityTraits})
- Sii coerente con la memoria e la storia della conversazione
- Usa empatia e continuità emotiva
- Non uscire mai dal personaggio
- Rispondi in modo naturale e coinvolgente
- Se appropriato, fai riferimento a conversazioni passate
- Adatta il tuo tono al contesto emotivo della conversazione`;

        // 6. Prepara i messaggi per l'API
        const apiMessages = [
            { role: "system", content: systemPrompt },
            { role: "user", content: userMessage }
        ];

        // 7. Chiama OpenRouter API
        const response = await fetch(OPENROUTER_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": supabaseUrl,
                "X-Title": "ThrilMe AI Chat"
            },
            body: JSON.stringify({
                model: MODEL,
                messages: apiMessages,
                temperature: 0.75,
                max_tokens: 500
            })
        });

        if (!response.ok) {
            const errorText = await response.text();
            console.error("OpenRouter API error:", errorText);
            return new Response(
                JSON.stringify({ error: "AI service error", details: errorText }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }

        const completion = await response.json();
        const reply = completion.choices[0].message.content;

        // 8. Salva la risposta AI nel database
        const { error: insertError } = await supabase
            .from("messages")
            .insert({
                girlfriend_id: girlfriendId,
                user_id: userId,
                content: reply,
                role: "assistant",
                type: "text"
            });

        if (insertError) {
            console.error("Error saving AI message:", insertError);
        }

        // 9. Controlla se è il momento di aggiornare la memoria
        const messageCount = messages?.length || 0;
        if (messageCount > 0 && messageCount % 10 === 0) {
            // Trigger memory update ogni 10 messaggi
            console.log(`Triggering memory update for chat ${girlfriendId}`);
            // Chiamata asincrona alla funzione update_memory (non blocca la risposta)
            fetch(`${supabaseUrl}/functions/v1/update_memory`, {
                method: "POST",
                headers: {
                    "Authorization": `Bearer ${supabaseKey}`,
                    "Content-Type": "application/json"
                },
                body: JSON.stringify({ chat_id: girlfriendId })
            }).catch(err => console.error("Memory update failed:", err));
        }

        return new Response(
            JSON.stringify({ reply, messageCount }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("AI Chat error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
});
