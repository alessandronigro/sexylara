function sanitizeHistoryForLLM(history) {
    if (!Array.isArray(history)) {
        console.warn("⚠️ sanitizeHistoryForLLM: history non è un array. Lo converto a []");
        history = [];
    }

    return history
        .filter(msg => msg && msg.role && msg.content)
        .filter(m => m.role === 'user' || m.role === 'assistant')
        .filter(m => !/\\.(png|jpg|jpeg|gif)/i.test(m.content || ''))
        .filter(m => !/base64/i.test(m.content || ''))
        .slice(-20)
        .map(h => ({
            role: h.role,
            content: (h.content || '').toString().slice(0, 2000)
        }));
}

module.exports = { sanitizeHistoryForLLM };
