const Replicate = require("replicate");
const replicate = new Replicate({ auth: process.env.REPLICATE_API_TOKEN });

exports.generateVideo = async (req, res) => {
  const { prompt } = req.body;
  if (!prompt) return res.status(400).json({ error: "Missing prompt" });

  try {
    const output = await replicate.run("cjwbw/animated-diffusion", {
      input: {
        prompt,
        motion: "subtle",
        num_frames: 24
      }
    });
    res.json({ video: output[0] });
  } catch (err) {
    console.error("Video error:", err.message);
    res.status(500).json({ error: "Video generation error" });
  }
};
