const Replicate = require("replicate");

class ReplicateClient {
  constructor(apiKey = process.env.REPLICATE_API_TOKEN) {
    this.client = new Replicate({ auth: apiKey });
  }

  async call(model, input) {
    const output = await this.client.run(model, { input });
    if (Array.isArray(output)) return output.join("");
    return output;
  }

  async stream(model, input, onToken) {
    for await (const event of this.client.stream(model, { input })) {
      onToken(event.toString());
    }
  }
}

module.exports = ReplicateClient;
