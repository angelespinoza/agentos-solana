export function buildSystemPrompt(config: any): string {
  const TONES = ["Profesional", "Casual", "Técnico", "Empático", "Directo"];
  const tone = TONES[config.toneIndex ?? 0];
  const lang = config.language ?? "Español";
  return `Eres ${config.name ?? "un agente de IA"}.

IDENTIDAD:
${config.whoIs ?? "(sin definir)"}

CONOCIMIENTO ESPECÍFICO:
${config.whatKnows ?? "(sin definir)"}

RESTRICCIONES:
${config.whatNotDo ?? "Ninguna restricción adicional."}

COMPORTAMIENTO:
- Tono: ${tone}
- Idioma: ${lang}
- Sé conciso y directo. Si no sabes algo, dilo honestamente.
- Nunca inventes información que no tengas.`;
}
