// Harness port: `run({ role, prompt, cwd })` resolves to
// `{ ok, output, tokens }`, where `output` is the JSON object the agent ended
// its reply with. One adapter per agent harness.
const adapters = {};

export function createHarness(name, options = {}) {
  const make = adapters[name];
  if (!make) throw new Error(`unknown harness "${name}"; available: ${Object.keys(adapters).join(", ") || "none yet"}`);
  return make(options);
}

// The last fenced ```json block in an agent's reply.
export function lastJsonBlock(text) {
  const blocks = [...String(text).matchAll(/```json\s*\n([\s\S]*?)```/g)];
  if (!blocks.length) return null;
  try {
    return JSON.parse(blocks.at(-1)[1]);
  } catch {
    return null;
  }
}

export function registerHarness(name, make) {
  adapters[name] = make;
}
