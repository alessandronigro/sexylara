import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const supabaseUrl = Deno.env.get("SUPABASE_URL")!;
const supabaseKey = Deno.env.get("SUPABASE_SERVICE_ROLE_KEY")!;
const supabase = createClient(supabaseUrl, supabaseKey);

const OPENROUTER_API_KEY = Deno.env.get("OPENROUTER_API_KEY");
const OPENROUTER_URL = "https://openrouter.ai/api/v1/chat/completions";
const MODEL = "meta-llama/llama-3.1-70b-instruct";

// ----------------------------
// FUNZIONE: aggiornamento memoria collettiva del gruppo
// Analizza conversazioni e genera sintesi + dinamiche sociali
// ----------------------------
Deno.serve(async (req) => {
    try {
        const { group_id } = await req.json();

        if (!group_id) {
            return new Response(
                JSON.stringify({ error: "Missing group_id" }),
                { status: 400, headers: { "Content-Type": "application/json" } }
            );
        }

        // 1. Recupera informazioni sul gruppo
        const { data: group } = await supabase
            .from("groups")
            .select("name")
            .eq("id", group_id)
            .single();

        if (!group) {
            return new Response(
                JSON.stringify({ error: "Group not found" }),
                { status: 404, headers: { "Content-Type": "application/json" } }
            );
        }

        // 2. Recupera i membri del gruppo
        const { data: members } = await supabase
            .from("group_members")
            .select(`
        girlfriend_id,
        girlfriends (
          id,
          name,
          personality_type,
          tone
        )
      `)
            .eq("group_id", group_id);

        if (!members || members.length === 0) {
            return new Response(
                JSON.stringify({ message: "No members in group" }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );
        }

        const memberNames = members.map(m => m.girlfriends.name).join(", ");

        // 3. Recupera gli ultimi 100 messaggi del gruppo
        const { data: messages } = await supabase
            .from("group_messages")
            .select("sender_id, content, created_at")
            .eq("group_id", group_id)
            .order("created_at", { ascending: true })
            .limit(100);

        if (!messages || messages.length === 0) {
            return new Response(
                JSON.stringify({ message: "No messages to analyze" }),
                { status: 200, headers: { "Content-Type": "application/json" } }
            );
        }

        // 4. Costruisci la conversazione con nomi
        const conversation = messages
            .map(m => {
                const sender = members.find(mem => mem.girlfriends.id === m.sender_id);
                const senderName = sender ? sender.girlfriends.name : "Utente";
                return `${senderName}: ${m.content}`;
            })
            .join("\n");

        // 5. Genera analisi della memoria collettiva usando AI
        const analysisPrompt = `Analizza questa conversazione di gruppo chiamato "${group.name}".

Membri del gruppo: ${memberNames}

CONVERSAZIONE:
${conversation}

Produci un'analisi strutturata in questo formato:

## SINTESI NARRATIVA
[Scrivi 8-12 frasi che riassumono la storia del gruppo, i temi principali, l'evoluzione emotiva, eventi significativi]

## DYNAMICS
\`\`\`json
{
  "relationships": {
    "Nome1-Nome2": "descrizione della relazione (es: amici stretti, tensione, collaboratori)",
    "Nome3-Nome4": "..."
  },
  "leadership": ["nomi dei leader naturali del gruppo"],
  "topics": ["temi principali discussi"],
  "mood": "atmosfera generale del gruppo (es: positivo, teso, collaborativo)",
  "events": [
    "evento significativo 1",
    "evento significativo 2"
  ],
  "recurring_jokes": ["battute o riferimenti ricorrenti"],
  "conflicts": ["eventuali conflitti o tensioni"],
  "alliances": ["sottogruppi o alleanze"]
}
\`\`\`

Scrivi tutto in italiano. Sii specifico e dettagliato nelle relazioni.`;

        const response = await fetch(OPENROUTER_URL, {
            method: "POST",
            headers: {
                "Authorization": `Bearer ${OPENROUTER_API_KEY}`,
                "Content-Type": "application/json",
                "HTTP-Referer": supabaseUrl,
                "X-Title": "ThrilMe Group Memory"
            },
            body: JSON.stringify({
                model: MODEL,
                messages: [
                    {
                        role: "system",
                        content: "Sei un assistente che analizza conversazioni di gruppo e genera sintesi narrative dettagliate con dinamiche sociali."
                    },
                    { role: "user", content: analysisPrompt }
                ],
                temperature: 0.3,
                max_tokens: 800
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
        const aiOutput = completion.choices[0].message.content;

        // 6. Parse dell'output AI
        let summary = "";
        let dynamics = {};

        try {
            // Estrai la sintesi narrativa
            const summaryMatch = aiOutput.match(/## SINTESI NARRATIVA\s+([\s\S]+?)(?=## DYNAMICS|$)/);
            if (summaryMatch) {
                summary = summaryMatch[1].trim();
            }

            // Estrai il JSON delle dynamics
            const jsonMatch = aiOutput.match(/```json\s+([\s\S]+?)\s+```/);
            if (jsonMatch) {
                dynamics = JSON.parse(jsonMatch[1]);
            } else {
                // Fallback: cerca qualsiasi JSON nel testo
                const jsonFallback = aiOutput.match(/\{[\s\S]+\}/);
                if (jsonFallback) {
                    dynamics = JSON.parse(jsonFallback[0]);
                }
            }
        } catch (parseError) {
            console.error("Error parsing AI output:", parseError);
            // Usa l'output grezzo come summary se il parsing fallisce
            summary = aiOutput;
            dynamics = {
                relationships: {},
                leadership: [],
                topics: [],
                mood: "in evoluzione",
                events: []
            };
        }

        // 7. Salva o aggiorna la memoria nel database
        const { error: upsertError } = await supabase
            .from("group_memory")
            .upsert({
                group_id,
                summary,
                dynamics,
                updated_at: new Date().toISOString()
            });

        if (upsertError) {
            console.error("Error updating group memory:", upsertError);
            return new Response(
                JSON.stringify({ error: "Failed to save group memory", details: upsertError.message }),
                { status: 500, headers: { "Content-Type": "application/json" } }
            );
        }

        console.log(`Group memory updated for ${group_id}`);

        return new Response(
            JSON.stringify({
                success: true,
                message: "Group memory updated successfully",
                summary,
                dynamics,
                messagesAnalyzed: messages.length
            }),
            { status: 200, headers: { "Content-Type": "application/json" } }
        );

    } catch (error) {
        console.error("Update group memory error:", error);
        return new Response(
            JSON.stringify({ error: error.message }),
            { status: 500, headers: { "Content-Type": "application/json" } }
        );
    }
});
