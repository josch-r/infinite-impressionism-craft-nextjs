import { Element, ElementModel } from "@/interfaces/element";
import connectDb from "@/libs/connect-db";
import type { NextApiRequest, NextApiResponse } from "next";

// Impressionism vocabulary database for validation and context
const IMPRESSIONISM_VOCABULARY = {
  artists: [
    "Monet",
    "Renoir",
    "Morisot",
    "Manet",
    "Degas",
    "Caillebotte",
    "Sisley",
    "Pissarro",
    "Cassatt",
    "Bazille",
    "Cézanne",
    "Signac",
    "Seurat",
    "Vlaminck",
    "Guillaumin",
  ],
  dealers: [
    "Durand-Ruel",
    "Wildenstein",
    "Vollard",
    "Tanguy",
    "Bernheim",
    "Chocquet",
    "Ephrussi",
    "Hoschedé",
  ],
  techniques: [
    "Pleinairmalerei",
    "Pinselstrich",
    "Lichtstimmung",
    "Lichtreflex",
    "Komplementärfarben",
    "Farbauftrag",
    "Farbtheorie",
    "Tonalismus",
  ],
  motifs: [
    "Landschaftsmalerei",
    "Naturmotiv",
    "Wasserlandschaft",
    "Seerosenteich",
    "Boulevard",
    "Pariser Leben",
    "Ballett",
    "Theaterszene",
    "Bahnhof",
    "Flusslandschaft",
  ],
  institutions: [
    "Salon de Paris",
    "Café Guerbois",
    "Nouvelle Athènes",
    "Salon des Refusés",
    "Impressionisten-Ausstellung",
  ],
  concepts: [
    "Impressionismus",
    "Kunstkritik",
    "Ausstellung",
    "Schenkung",
    "Kunstmarkt",
    "Moderne",
    "Kunstjournalismus",
    "Künstlergruppe",
    "Sammlung",
    "Provenienz",
  ],
};

// Fallback combinations for safe defaults
const FALLBACK_COMBINATIONS = {
  default: { emoji: "🎨", text: "Impressionismus" },
  artist_artist: { emoji: "👥", text: "Künstlergruppe" },
  artist_technique: { emoji: "🖌️", text: "Pinselstrich" },
  artist_motif: { emoji: "🌄", text: "Landschaftsmalerei" },
  technique_motif: { emoji: "✨", text: "Lichtstimmung" },
  institution_artist: { emoji: "🏛️", text: "Salon de Paris" },
};

// Helper functions for vocabulary categorization
function getWordCategory(word: string): string | null {
  const normalized = word.toLowerCase();
  for (const [category, terms] of Object.entries(IMPRESSIONISM_VOCABULARY)) {
    if (terms.some((term) => term.toLowerCase() === normalized)) {
      return category;
    }
  }
  return null;
}

function isValidImpressionismTerm(text: string): boolean {
  const normalized = text.toLowerCase();
  return Object.values(IMPRESSIONISM_VOCABULARY)
    .flat()
    .some((term) => term.toLowerCase() === normalized);
}

function getCombinationContext(word1: string, word2: string): string {
  const cat1 = getWordCategory(word1);
  const cat2 = getWordCategory(word2);

  // Both artists - suggest shared characteristics
  if (cat1 === "artists" && cat2 === "artists") {
    return "Hinweis: Beide Künstler arbeiteten zeitgleich. Nenne eine gemeinsame Technik, einen Ausstellungsort oder eine Kunstbewegung.";
  }

  // Artist + technique - describe artistic approach
  if (cat1 === "artists" && cat2 === "techniques") {
    return "Hinweis: Nenne eine charakteristische Malweise oder ein visuelles Merkmal dieses Künstlers.";
  }
  if (cat1 === "techniques" && cat2 === "artists") {
    return "Hinweis: Nenne einen Künstler, der diese Technik perfektioniert hat oder einen innovativen Ort.";
  }

  // Artist + motif - thematic connection
  if (cat1 === "artists" && cat2 === "motifs") {
    return "Hinweis: Nenne ein Werk, einen Ort oder eine Kunstsammlung, die dieser Künstler liebte.";
  }
  if (cat1 === "motifs" && cat2 === "artists") {
    return "Hinweis: Nenne einen bekannten Künstler, der dieses Motiv häufig malte.";
  }

  // Dealer/Collector + artist
  if (cat1 === "dealers" && cat2 === "artists") {
    return "Hinweis: Nenne eine Ausstellung oder einen wichtigen Kunstmoment zwischen diesem Händler und Künstler.";
  }
  if (cat1 === "artists" && cat2 === "dealers") {
    return "Hinweis: Nenne einen Kunsthändler, der diesen Künstler förderte oder bekannt machte.";
  }

  // Institution + artist
  if (cat1 === "institutions" && cat2 === "artists") {
    return "Hinweis: Nenne einen Künstler, der dort ausgestellt hat oder eine Reaktion auf die Institution.";
  }
  if (cat1 === "artists" && cat2 === "institutions") {
    return "Hinweis: Nenne einen Ausstellungsort oder ein Café, das dieser Künstler besuchte.";
  }

  // Default context
  return "Hinweis: Kombiniere beide Begriffe zu einem authentischen Impressionismus-Konzept.";
}

function buildSystemPrompt(word1: string, word2: string): string {
  const context = getCombinationContext(word1, word2);

  return `Du kombinierst zwei Begriffe aus dem Impressionismus (1870–1910) und gibst EXAKT ein Ergebnis im Format: EMOJI,Begriff

Regeln:
- Nur EINE Zeile ausgeben
- Format: [emoji],[deutscher Begriff]
- Keine Erklärungen, Sätze oder Kommas im Begriff
- Nur authentische Begriffe aus der echten Kunstgeschichte
- Nicht die Eingabewörter wiederholen

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
🖌️,Pinselstrich
🌿,Naturmotiv
👤,Caillebotte
🗞️,Kunstjournalismus
☕,Café Guerbois
🌊,Wasserlandschaft

${context}

Kombiniere: '${word1}' + '${word2}'
Ausgabe (NUR EMOJI,Begriff):`;
}

// Validate emoji using Unicode regex
function isValidEmoji(text: string): boolean {
  // Basic emoji Unicode ranges check
  const emojiRegex =
    /^[\p{Emoji}\p{Emoji_Modifier}\p{Emoji_Component}\p{Emoji_Modifier_Base}\p{Emoji_Presentation}]+$/u;
  try {
    return emojiRegex.test(text) && text.length <= 4;
  } catch (e) {
    // Fallback: check if it looks like an emoji (not ASCII)
    return text.length <= 4 && !/^[a-zA-Z0-9]+$/.test(text);
  }
}

// Enhanced output parsing
function parseOllamaOutput(output: string): {
  emoji: string;
  text: string;
} | null {
  const firstLine = output.split("\n")[0].trim();

  // Try comma-separated format
  if (firstLine.includes(",")) {
    const parts = firstLine.split(",").map((p) => p.trim());
    if (parts.length >= 2) {
      let [emoji, text] = parts;

      // Clean text: remove brackets, excessive punctuation
      text = text
        .replace(/[()\[\]{}]/g, "")
        .replace(/[.!?;:—–-]+$/g, "")
        .split(/\s+/)
        .slice(0, 3)
        .join(" ")
        .trim();

      // Validate
      if (
        isValidEmoji(emoji) &&
        text.length >= 2 &&
        text.length <= 50 &&
        !/^[0-9]+$/.test(text)
      ) {
        return { emoji, text };
      }
    }
  }

  return null;
}

// Generate with Ollama with retry logic
async function generateWithOllama(
  prompt: string,
  maxRetries: number = 3
): Promise<{ emoji: string; text: string } | null> {
  for (let attempt = 0; attempt < maxRetries; attempt++) {
    try {
      const res = await fetch("http://127.0.0.1:11434/api/generate", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
        },
        body: JSON.stringify({
          model: "gemma2:9b",
          prompt,
          max_tokens: 20,
          temperature: 0.1,
          top_p: 0.5,
          seed: 42,
          repeat_penalty: 1.1,
          stop: ["\n", "INPUT:", "Beispiel:"],
          stream: false,
        }),
      });

      if (!res.ok) {
        console.error(
          `Ollama API error (attempt ${attempt + 1}): ${res.status}`
        );
        continue;
      }

      const text = await res.text();
      let data;

      try {
        data = JSON.parse(text);
      } catch (e) {
        // If not JSON, treat as raw response
        const parsed = parseOllamaOutput(text);
        if (parsed) return parsed;
        continue;
      }

      // Extract response based on Ollama response shape
      let responseText = "";

      if (typeof data.response === "string") {
        responseText = data.response;
      } else if (Array.isArray(data.choices) && data.choices[0]) {
        const choice = data.choices[0];
        if (choice?.content && Array.isArray(choice.content)) {
          responseText = choice.content
            .map((c: any) => (typeof c.text === "string" ? c.text : ""))
            .join("");
        } else if (typeof choice.text === "string") {
          responseText = choice.text;
        }
      } else if (
        Array.isArray((data as any).output) &&
        (data as any).output[0]
      ) {
        const out = (data as any).output[0];
        if (out?.content && Array.isArray(out.content)) {
          responseText = out.content
            .map((c: any) => (typeof c.text === "string" ? c.text : ""))
            .join("");
        }
      }

      if (responseText) {
        const parsed = parseOllamaOutput(responseText);
        if (parsed) return parsed;
      }

      console.warn(
        `Attempt ${
          attempt + 1
        }: Failed to parse valid output. responseText='${responseText}'`
      );
    } catch (error) {
      console.error(
        `Attempt ${attempt + 1} error: ${
          error instanceof Error ? error.message : "Unknown error"
        }`
      );
    }
  }

  return null;
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

  try {
    // Build context-aware system prompt
    const systemPrompt = buildSystemPrompt(sortedWord1, sortedWord2);
    console.log(`Generating combination for: ${sortedWord1} + ${sortedWord2}`);

    // Generate with retry logic
    const result = await generateWithOllama(systemPrompt);

    if (!result) {
      // Fallback to contextual default
      const cat1 = getWordCategory(sortedWord1);
      const cat2 = getWordCategory(sortedWord2);
      const fallbackKey = `${cat1 || "unknown"}_${cat2 || "unknown"}`;
      const fallback =
        FALLBACK_COMBINATIONS[
          fallbackKey as keyof typeof FALLBACK_COMBINATIONS
        ] || FALLBACK_COMBINATIONS.default;

      console.warn(
        `Using fallback for ${sortedWord1} + ${sortedWord2}: ${fallback.text}`
      );

      const newElement = new ElementModel({
        word1: sortedWord1,
        word2: sortedWord2,
        emoji: fallback.emoji,
        text: fallback.text.toLowerCase(),
      });
      await newElement.save();

      return res.status(200).json({
        message: "Element created with fallback",
        element: {
          emoji: fallback.emoji,
          text: fallback.text.toLowerCase(),
          discovered: true,
        },
      });
    }

    const { emoji, text } = result;
    const normalizedText = text.toLowerCase();

    // Check if text already exists
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

    // Optional: Log terms not in known vocabulary for review
    if (!isValidImpressionismTerm(text)) {
      console.info(`New term discovered (not in base vocabulary): ${text}`);
    }

    // Save the new element
    const newElement = new ElementModel({
      word1: sortedWord1,
      word2: sortedWord2,
      emoji,
      text: normalizedText,
    });
    await newElement.save();

    console.log(`Successfully created: ${emoji} ${normalizedText}`);

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
