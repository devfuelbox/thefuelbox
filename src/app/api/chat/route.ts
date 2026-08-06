import { NextResponse } from 'next/server';

export async function POST(req: Request) {
  try {
    const { messages, systemPrompt } = await req.json();

    const groqKey = process.env.GROQ_API_KEY;
    const openrouterKey = process.env.OPENROUTER_API_KEY;

    // Check if Groq key is set and is not the mock value
    if (groqKey && !groqKey.startsWith('gsk_xxxxx') && groqKey !== 'gsk_xxxxx' && groqKey.trim() !== '') {
      try {
        const response = await fetch("https://api.groq.com/openai/v1/chat/completions", {
          method: "POST",
          headers: {
            "Content-Type": "application/json",
            "Authorization": `Bearer ${groqKey}`
          },
          body: JSON.stringify({
            model: "llama-3.1-8b-instant",
            messages: [
              { role: "system", content: systemPrompt },
              ...messages
            ],
            temperature: 0.7
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.choices?.[0]?.message?.content) {
            return NextResponse.json({ text: data.choices[0].message.content });
          }
        } else {
          const errText = await response.text();
          console.error("[Chat API] Groq error:", errText);
        }
      } catch (err) {
        console.error("[Chat API] Failed calling Groq:", err);
      }
    }

    // Fallback to OpenRouter
    if (openrouterKey && !openrouterKey.startsWith('sk-xxxxx') && openrouterKey.trim() !== '') {
      try {
        const response = await fetch("https://openrouter.ai/api/v1/chat/completions", {
          method: "POST",
          headers: {
            "Authorization": `Bearer ${openrouterKey}`,
            "Content-Type": "application/json",
            "HTTP-Referer": "https://fuelbox.in",
            "X-Title": "FuelBox",
          },
          body: JSON.stringify({
            model: "meta-llama/llama-3.2-3b-instruct:free",
            messages: [
              { role: "system", content: systemPrompt },
              ...messages
            ],
            temperature: 0.7
          })
        });

        if (response.ok) {
          const data = await response.json();
          if (data.choices?.[0]?.message?.content) {
            return NextResponse.json({ text: data.choices[0].message.content });
          }
        } else {
          const errText = await response.text();
          console.error("[Chat API] OpenRouter error:", errText);
        }
      } catch (err) {
        console.error("[Chat API] Failed calling OpenRouter:", err);
      }
    }

    return NextResponse.json({
      text: "I'm having trouble connecting to my AI brain right now. Please verify that a valid GROQ_API_KEY or OPENROUTER_API_KEY is configured in your server's .env file."
    });

  } catch (error: any) {
    console.error("[Chat API] General error:", error);
    return NextResponse.json({ error: error.message || "Failed to process chat request" }, { status: 500 });
  }
}
