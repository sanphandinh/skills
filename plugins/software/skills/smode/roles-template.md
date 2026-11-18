# Roles

Read by the `smode` skill and the `factory-v2` skill whenever they delegate work: the model each role runs on in this project. Written by smode's `setup` playbook; change one role with `setup override`. Check it with `node <smode>/scripts/roles.mjs check`, and see what each candidate is doing with `show`.

Each line is `<role>: <candidate>, <candidate>, …`, in order of preference. A candidate is `<provider>/<model>`, the provider being the model's maker, then `effort=<low|medium|high|xhigh|max>` and, when another service runs the model, `via=<channel>`. The harness takes the first candidate it can run that is available and not out of quota, and skips the rest. A `reviewer` is another model family than the `worker`. A role without a line runs on the session's model.

scout: anthropic/claude-haiku-5-5 effort=low
worker: anthropic/claude-sonnet-5-5 effort=medium
thinker: anthropic/claude-opus-5-5 effort=high
reviewer: openai/gpt-5.5 effort=high, anthropic/claude-opus-5-5 effort=high
coordinator: anthropic/claude-sonnet-5-5 effort=low
