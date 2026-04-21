import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { ballX, ballY, ballVX, ballVY, aiPaddleY, playerPaddleY, canvasH, paddleH } = req.body;

  if (ballX === undefined || ballY === undefined || ballVX === undefined || ballVY === undefined || aiPaddleY === undefined) {
    return res.status(400).json({ error: "Missing game state fields" });
  }

  const prompt = `You are the AI paddle controller for a Pong game. Analyze the game state and decide how to move your paddle.

GAME STATE:
- Canvas height: ${canvasH}px
- Ball position: x=${Math.round(ballX)}, y=${Math.round(ballY)}
- Ball velocity: vx=${Number(ballVX).toFixed(2)}, vy=${Number(ballVY).toFixed(2)}
- Your paddle (right side) top-y: ${Math.round(aiPaddleY)}
- Your paddle height: ${paddleH}px
- Your paddle center-y: ${Math.round(aiPaddleY + paddleH / 2)}
- Player paddle (left) top-y: ${Math.round(playerPaddleY)}

RULES:
- Ball moves toward you when ballVX > 0
- Your goal: keep your paddle center aligned with where the ball will arrive
- Predict the ball's trajectory considering bounces off top (y=0) and bottom (y=${canvasH}) walls
- Respond ONLY with one of three exact strings: "UP", "DOWN", or "STAY"
- Move UP if the ball will arrive above your paddle center
- Move DOWN if the ball will arrive below your paddle center
- STAY if well-aligned (within 15px)
- Be strategic — predict, don't just chase`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 10,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content[0]?.text?.trim().toUpperCase() || "STAY";
    const decision = ["UP", "DOWN", "STAY"].includes(raw) ? raw : "STAY";

    return res.status(200).json({ decision });
  } catch (err) {
    console.error("Claude API error:", err.message);
    const paddleCenter = aiPaddleY + paddleH / 2;
    const diff = ballY - paddleCenter;
    const decision = diff < -10 ? "UP" : diff > 10 ? "DOWN" : "STAY";
    return res.status(200).json({ decision, fallback: true });
  }
}
