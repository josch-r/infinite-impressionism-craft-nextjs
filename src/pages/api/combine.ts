import { Element, ElementModel } from "@/interfaces/element";
import connectDb from "@/libs/connect-db";
import type { NextApiRequest, NextApiResponse } from "next";
// Use the local Ollama daemon to generate text with the qwen2.5:3b model.
// We use the builtin fetch API available in Node 18+/Next.js server runtime.

async function generateWithOllama(prompt: string): Promise<string> {
  const res = await fetch("http://127.0.0.1:11434/api/generate", {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
    },
    body: JSON.stringify({
      model: "mistral:7b",
      prompt,
      max_tokens: 16,
      temperature: 0.2,
      top_p: 0.6,
      // stream disabled for simplicity; enable streaming if needed later
      stream: false,
    }),
  });

  const text = await res.text();
  // Ollama responses can be JSON or plain text depending on version/config.
  try {
    const data = JSON.parse(text);

    // Try a few common response shapes produced by Ollama
    if (typeof data === "object" && data !== null) {
      // shape: { response: "..." }
      if (typeof data.response === "string") return data.response.trim();

      // shape: { choices: [{ content: [{ type: 'output_text', text: '...' }] }] }
      if (Array.isArray(data.choices) && data.choices[0]) {
        const choice = data.choices[0];
        if (choice?.content && Array.isArray(choice.content)) {
          const joined = choice.content
            .map((c: any) => (typeof c.text === "string" ? c.text : ""))
            .join("");
          if (joined.trim()) return joined.trim();
        }
        // older shape: choices[0].text
        if (typeof choice.text === "string") return choice.text.trim();
      }

      // shape: { output: [{ content: [{ text: '...' }] }] }
      if (Array.isArray((data as any).output) && (data as any).output[0]) {
        const out = (data as any).output[0];
        if (out?.content && Array.isArray(out.content)) {
          const joined = out.content
            .map((c: any) => (typeof c.text === "string" ? c.text : ""))
            .join("");
          if (joined.trim()) return joined.trim();
        }
      }
    }
  } catch (e) {
    // not JSON, fall through to return raw text
  }

  return text.trim();
}

type ResponseData = {
  message: string;
  element?: Element;
  discovered?: boolean;
};

export default async function handler(
  req: NextApiRequest,
  res: NextApiResponse<ResponseData>
) {
  const w1 = req.query.word1 as string;
  const w2 = req.query.word2 as string;

  if (!w1 || !w2) {
    res.status(400).json({ message: "Bad Request" });
    return;
  }

  await connectDb();

  // Normalize and sort words
  const word1 = w1.toLowerCase();
  const word2 = w2.toLowerCase();
  const sortedWord1 = word1 > word2 ? word1 : word2;
  const sortedWord2 = word1 > word2 ? word2 : word1;

  // Check if combination already exists
  const existingElement = await ElementModel.findOne({
    word1: sortedWord1,
    word2: sortedWord2,
  });

  if (existingElement) {
    return res.status(200).json({
      message: "Element already exists",
      element: {
        emoji: existingElement.emoji,
        text: existingElement.text,
        discovered: false,
      },
    });
  }

  // Generate new combination via Ollama
  try {
    const systemPrompt = `
Du bist eine Wissensdatenbank für Impressionismus (1870–1910, Frankreich, Deutschland).

Du erhältst zwei Begriffe. Deine Aufgabe:
Gib **ein Emoji und einen einzigen passenden deutschen Fachbegriff, Motiv, Technik oder Namen** aus dem echten Impressionismus-Kontext (historisch relevant). 

KENNZEICHEN:
- KEIN Werktitel!
- KEIN Künstler außerhalb des Impressionismus (nur: Monet, Renoir, Morisot, Manet, Degas, Caillebotte, Sisley, Pissarro, Cassatt, Bazille, Guillaumin, u.ä.)
- KEINE Sätze, KEINE Erklärungen, KEINE neuen Kunstbegriffe.
- KEIN Metapher, KEIN Fließtext.
- KEIN Wiederholen eines der Eingabewörter.
- KEINE Fantasiebegriffe.

Nutze NUR Begriffe, Namen und Motive aus den folgenden Beispielen oder wähle einen etablierten Begriff, der im Kunstmuseum, im Katalog oder in Lehrbüchern verwendet wird.

Beispiele:
🎨,Monet
👩‍🎨,Morisot
🖼️,Pleinairmalerei
✨,Lichtstimmung
🌄,Landschaftsmalerei
💬,Kunstkritik
🏛️,Salon de Paris
🧑‍💼,Durand-Ruel
🏺,Wildenstein
🎁,Schenkung
🖌️,Pinselstrich
🌿,Naturmotiv
👤,Caillebotte
🗞️,Kunstjournalismus
☕,Café Guerbois

INPUT: '${sortedWord1}', '${sortedWord2}'
OUTPUT:

`;
    //     const systemPrompt = `
    // Du bist ein*e Expert*in für Impressionismus und Kunstnetzwerke.
    // Du erhältst zwei Begriffe und gibst EINEN passenden Begriff im Format [EMOJI],[deutscher Begriff] aus.
    // Wähle IMMER einen authentischen, thematisch passenden Begriff, keine Fantasie, keine Wiederholung, keine Erklärung.
    // Nutze IMMER verschiedene Begriffe/Namen, wenn es passt.

    // Beispiele:
    // 🧑‍💼,Durand-Ruel
    // 👤,Caillebotte
    // 👩‍🎨,Morisot
    // 🍃,Pleinair
    // ✉️,Presseerklärung
    // 🖼️,Ausstellungssaal
    // 🎭,Salon de Paris
    // 🔗,Künstlergemeinschaft
    // 💬,Kunststreit
    // 🏛️,Wildenstein
    // ✨,Lichtreflex
    // 🏺,Museumsbestand
    // ☕,Café Guerbois
    // 👥,Gruppendynamik
    // 🔍,Kunstrecherche
    // 🎤,Kunstkritik
    // 🚲,Montmartre
    // 🌆,Boulevard
    // 🎨,Impressionismus
    // 📸,Fotografie

    // INPUT: '${sortedWord1}', '${sortedWord2}'
    // OUTPUT:

    // `;

    const output = await generateWithOllama(systemPrompt);
    if (!output) {
      throw new Error("No output generated by Ollama");
    }
    console.log("Ollama output:", output);
    // Parse the output - extract only the first line
    const firstLine = output.split("\n")[0].trim();
    const splitOutput = firstLine.split(",");
    if (splitOutput.length < 2) {
      console.warn(
        `Invalid format: expected at least 2 parts, got ${splitOutput.length} from: "${firstLine}"`
      );
      throw new Error("Invalid format in Ollama response");
    }

    let [emoji, text] = splitOutput.map((item: string) => item.trim());

    // Extract text before any explanatory parentheses or excessive punctuation
    // This allows multi-word terms like "Claude Monet" or "Salon de Paris" but cuts off explanations
    const parenIndex = text.indexOf("(");
    if (parenIndex !== -1) {
      text = text.substring(0, parenIndex).trim();
    }

    // Validate: text should not be empty and should be reasonably short
    if (!text || text.length < 2 || text.length > 50) {
      console.warn(`Invalid text length: "${text}"`);
      throw new Error("Invalid text output from Ollama");
    }

    // Validate: emoji should be a single emoji (basic check)
    if (!emoji || emoji.length > 4) {
      console.warn(`Invalid emoji: "${emoji}"`);
      throw new Error("Invalid emoji output from Ollama");
    }

    const normalizedText = text.toLowerCase();

    // Check if generated text already exists in the database
    const existingElementByText = await ElementModel.findOne({
      text: normalizedText,
    });

    if (existingElementByText) {
      return res.status(200).json({
        message: "Text already exists",
        element: {
          emoji: existingElementByText.emoji,
          text: existingElementByText.text,
          discovered: false,
        },
      });
    }

    // Save the new element
    const newElement = new ElementModel({
      word1: sortedWord1,
      word2: sortedWord2,
      emoji,
      text: normalizedText,
    });
    await newElement.save();

    return res.status(200).json({
      message: "New element created",
      element: {
        emoji,
        text: normalizedText,
        discovered: true,
      },
    });
  } catch (error) {
    console.error("Error generating or saving element:", error);
    res.status(500).json({ message: "Internal Server Error" });
  }
}
