# Roles

Read by the `factory` skill whenever it starts a session: the model each role runs on in this project. `scout` runs the watcher and every dispatcher run; `coordinator` runs one session per claimed ticket, from plan to Close; `thinker` plans, `worker` builds, `reviewer` verifies and reviews. Written by `factory setup`; change one role with `factory setup override`. Check it with `node <factory>/scripts/roles.mjs check`, and see what each candidate is doing with `show`.

Each line is `<role>: <candidate>, <candidate>, …`, in order of preference. A candidate is `<provider>/<model>`, the provider being the model's maker, then `effort=<low|medium|high|xhigh|max>` and, when another service runs the model, `via=<channel>`. The factory takes the first candidate its agent manager can run that passed the setup check, is available and is not out of quota, and skips the rest. A `reviewer` is another model family than the `worker`. A step whose role has no line waits: the factory never runs a step outside its route.

scout: anthropic/claude-haiku-5-5 effort=low
worker: anthropic/claude-sonnet-5-5 effort=medium
thinker: anthropic/claude-opus-5-5 effort=high
reviewer: openai/gpt-5.5 effort=high, anthropic/claude-opus-5-5 effort=high
coordinator: anthropic/claude-sonnet-5-5 effort=low
