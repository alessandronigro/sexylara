import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "meta-llama/llama-3.1-70b-instruct";

// ----------------------------
// FUNZIONE: aggiorna memoria sintetica
// (chiamare ogni 8–12 messaggi)
// ----------------------------
Deno.serve(async (req) => {
    try {
        const { chat_id } = await req.json();

        if (!chat_id) {
            return new Response(
                JSON.stringify({ error: "Missing chat_id" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // 1. Recupera informazioni sulla npc
        const { data: npc } = await supabase
            .from("npcs")
            .select("name, gender, personality_type, tone")
            .eq("id", chat_id)
            .single();

        if (!npc) {
            return new Response(
                JSON.stringify({ error: "Chat not found" }),
                { status: 404, headers: { "Content-Type": "application/json" } }
            );
        }

        // 2. Recupera gli ultimi 80 messaggi della conversazione
        const { data: messages } = await supabase
            .from("messages")
            .select("content, role, created_at")
            .eq("npc_id", chat_id)
            .order("created_at", { ascending: true })
            .limit(80);

        if (!messages || messages.length === 0) {
            return new Response(
                JSON.stringify({ message: "No messages to summarize" }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );
        }

        // 3. Costruisci la conversazione completa
        const conversation = messages
            .map(m => `${m.role === 'user' ? 'Utente' : npc.name}: ${m.content}`)
            .join("\n");

        // 4. Genera il riassunto sintetico usando AI
        const summaryPrompt = `Sei un assistente che analizza conversazioni tra un utente e ${npc.name}, un'AI con personalità ${npc.personality_type} e stile ${npc.tone}.

Riassumi in 8-10 righe l'intera relazione e conversazione, evidenziando:
- Stato emotivo dell'utente e dell'AI
- Temi principali ricorrenti
- Informazioni personali importanti condivise
- Obiettivi conversazionali
- Evoluzione sentimentale/emotiva nel tempo
- Momenti significativi della relazione

Scrivi il riassunto in italiano, in terza persona, come se stessi documentando la relazione per uso futuro.

CONVERSAZIONE:
${conversation}`;

        const response = await fetch(OPENROUTER_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": supabaseUrl,
                "X-Title": "ThrilMe Memory Update"
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    { role: "system", content: "Sei un assistente che crea riassunti sintetici di conversazioni." },
                    { role: "user", content: summaryPrompt }
                ],
                temperature: 0.3,
                max_tokens: 400
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
        const summary = completion.choices[0].message.content;

        // 5. Salva o aggiorna la memoria nel database
        const { error: upsertError } = await supabase
            .from("chat_memory")
            .upsert({
                chat_id,
                summary,
                updated_at: new Date().toISOString()
            });

        if (upsertError) {
            console.error("Error updating memory:", upsertError);
            return new Response(
                JSON.stringify({ error: "Failed to save memory", details: upsertError.message }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }

        console.log(`Memory updated for chat ${chat_id}`);

        return new Response(
            JSON.stringify({
                message: "Memory updated successfully",
                summary,
                messagesAnalyzed: messages.length
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Update memory error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
});
