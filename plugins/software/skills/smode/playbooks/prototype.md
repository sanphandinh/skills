# Prototype

Throwaway code that answers a design question cheaply, or settles a fork by observing it instead of asking the user.

1. Write the question down as one sentence, with the answer that would change the decision.
2. Run the `prototype` skill. It picks the branch (a logic demo or UI variations), keeps the code throwaway and trivial to run, and surfaces the state after every action.
3. When the question has competing answers, build two or three variants and compare them on the same cases.
4. Record the verdict and the question it settled where the decision lives (the issue, the spec, an ADR). Capture the prototype on a throwaway branch, not on trunk.
5. Fold only the validated decision into real work, through the `ticket` or `feature` playbook.

**Reply:** the question, the verdict, what you observed (measured), the variants compared, and where the prototype and the decision are recorded.
