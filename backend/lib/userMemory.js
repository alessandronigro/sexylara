const { supabase } = require("./supabase");

async function getUserPreferences(userId) {
    const { data, error } = await supabase
        .from("user_profile")
        .select("*")
        .eq("id", userId)
        .single();

    if (error) {
        console.warn("⚠️ Nessuna preferenza trovata, uso default.");
        return { tone: "playful", likes: [], dislikes: [], memory: {} };
    }

    return {
        tone: data.tone,
        likes: data.likes || [],
        dislikes: data.dislikes || [],
        memory: data.memory || {}
    };
}

async function updateUserMemory(userId, updates = {}) {
    const { error } = await supabase
        .from("user_profile")
        .upsert({
            id: userId,
            ...updates,
            updated_at: new Date()
        });

    if (error) console.error("Errore aggiornamento memoria:", error.message);
}

module.exports = { getUserPreferences, updateUserMemory };
