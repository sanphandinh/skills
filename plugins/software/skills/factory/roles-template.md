# Roles

Read by the `factory` skill whenever it starts a worker: the model each role runs on in this project. Written by `factory setup`; change one role with `factory setup override`. Check it with `node <factory>/scripts/roles.mjs check`, and see what each candidate is doing with `show`.

Each line is `<role>: <candidate>, <candidate>, …`, in order of preference. A candidate is `<provider>/<model>`, the provider being the model's maker, then `effort=<low|medium|high|xhigh|max>` and, when another service runs the model, `via=<channel>`. The coordinator takes the first candidate its agent manager can run that is available and not out of quota, and skips the rest. A `reviewer` is another model family than the `worker`. A step whose role has no line waits: the factory never runs a step outside its route.

The role lines below are this project's own, chosen with the user at `factory setup`.
