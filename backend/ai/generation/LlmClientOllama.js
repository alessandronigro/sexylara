const fetch = require("node-fetch");

async function generate(messages) {
  try {
    const prompt = messages
      .map(m => `${m.role.toUpperCase()}: ${m.content}`)
      .join("\n\n");

    const response = await fetch("http://localhost:11434/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        model: "llama2-uncensored",
        prompt,
        stream: false
      })
    });

    const data = await response.json();
    return data.response?.trim() || "…non riesco a rispondere 😳";
  } catch (e) {
    console.error("OLLAMA ERROR:", e);
    return "…sto avendo un momento di confusione 😵‍💫";
  }
}

module.exports = { generate };
