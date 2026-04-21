import Anthropic from "@anthropic-ai/sdk";

const client = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY });

// Simulate ball bouncing to the AI paddle wall and return predicted Y.
function predictBallY(ballX, ballY, ballVX, ballVY, canvasH, paddleW) {
  if (ballVX <= 0) return canvasH / 2;
  const BALL_R = 8;
  const targetX = 700 - 24 - paddleW;
  let x = ballX, y = ballY, vx = ballVX, vy = ballVY;
  let steps = 0;
  while (x < targetX && steps < 2000) {
    x += vx; y += vy; steps++;
    if (y - BALL_R < 0)        { y = BALL_R;            vy =  Math.abs(vy); }
    if (y + BALL_R > canvasH)  { y = canvasH - BALL_R;  vy = -Math.abs(vy); }
  }
  return Math.max(0, Math.min(canvasH, y));
}

export default async function handler(req, res) {
  if (req.method !== "POST") {
    return res.status(405).json({ error: "Method not allowed" });
  }

  const { ballX, ballY, ballVX, ballVY, aiPaddleY, playerPaddleY, canvasH, paddleH } = req.body;

  if (ballX === undefined || ballY === undefined || ballVX === undefined || ballVY === undefined) {
    return res.status(400).json({ error: "Missing game state fields" });
  }

  const localTargetY = predictBallY(ballX, ballY, ballVX, ballVY, canvasH, paddleH);

  const prompt = `You are the AI brain for a Pong paddle. Predict exactly where the ball will be when it reaches your paddle wall.

GAME STATE:
- Canvas: 700 x ${canvasH}px
- Ball position: x=${Math.round(ballX)}, y=${Math.round(ballY)}
- Ball velocity: vx=${Number(ballVX).toFixed(2)}, vy=${Number(ballVY).toFixed(2)}
- Your paddle face x: ${700 - 24 - paddleH}px
- Ball radius: 8px

TASK:
Simulate the ball moving step by step (add vx to x, vy to y each step). When y goes below 0 or above ${canvasH}, reflect vy. Stop when x reaches ${700 - 24 - paddleH}.

If ballVX <= 0 (ball moving away from you), return ${Math.round(canvasH / 2)}.

Respond with ONLY a single integer — the predicted Y. No words, no punctuation.`;

  try {
    const message = await client.messages.create({
      model: "claude-haiku-4-5-20251001",
      max_tokens: 10,
      messages: [{ role: "user", content: prompt }],
    });

    const raw = message.content[0]?.text?.trim().replace(/[^\d]/g, "");
    const parsed = parseInt(raw, 10);

    if (!isNaN(parsed) && parsed >= 0 && parsed <= canvasH) {
      return res.status(200).json({ targetY: parsed });
    }
    return res.status(200).json({ targetY: localTargetY, fallback: true });

  } catch (err) {
    console.error("Claude API error:", err.message);
    return res.status(200).json({ targetY: localTargetY, fallback: true });
  }
}
