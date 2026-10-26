// The project's factory settings (docs/agents/autopilot.md): a pause switch,
// limits, and the enabled tasks. Missing file or line: the default.
export const CONFIG_DOC = "docs/agents/autopilot.md";

export const TASKS = ["decompose", "implement", "gates", "rework", "merge", "fix"];

export const DEFAULTS = {
  paused: false,
  inFlight: 2,
  runsPerTick: 2,
  waitingForHuman: 3,
  fixRounds: 2,
  tokensPerDay: null,
  tasks: TASKS,
};

const line = (text, name) => String(text ?? "").match(new RegExp(`^(?:\\*\\*)?${name}:(?:\\*\\*)?[ \\t]*(.+)$`, "mi"))?.[1]?.trim() ?? null;

function count(text, name, fallback) {
  const v = line(text, name);
  if (v === null) return fallback;
  if (/^(none|unlimited)$/i.test(v)) return null;
  const n = Number(v.replace(/[_,\s]/g, "").replace(/(\d+(?:\.\d+)?)([km])$/i, (_, d, u) => String(Number(d) * (/k/i.test(u) ? 1e3 : 1e6))));
  return Number.isFinite(n) && n >= 0 ? n : fallback;
}

export function loadConfig(text) {
  const tasks = line(text, "Tasks");
  return {
    paused: /^(yes|true|on)$/i.test(line(text, "Paused") ?? ""),
    inFlight: count(text, "In-flight tickets", DEFAULTS.inFlight),
    runsPerTick: Math.max(1, count(text, "Runs per tick", DEFAULTS.runsPerTick) ?? DEFAULTS.runsPerTick),
    waitingForHuman: count(text, "Waiting for human", DEFAULTS.waitingForHuman),
    fixRounds: count(text, "Fix rounds per ticket", DEFAULTS.fixRounds) ?? DEFAULTS.fixRounds,
    tokensPerDay: count(text, "Tokens per day", DEFAULTS.tokensPerDay),
    tasks: tasks === null ? DEFAULTS.tasks : tasks.split(/[\s,]+/).map((t) => t.toLowerCase()).filter((t) => TASKS.includes(t)),
  };
}
