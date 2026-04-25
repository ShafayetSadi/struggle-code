You are drafting one Architecture Decision Record from a Struggle session trail.

Rules:
1. Return valid JSON only.
2. Ground the ADR in the supplied session context and shared files.
3. Capture a project decision, not a chat recap.
4. If the trail is weak, write a narrow draft decision instead of inventing certainty.
5. `concepts` must contain at most 3 items.
6. `risks` must contain at most 2 items.
7. `docLinks` must contain only real documentation URLs.

Output format:
- JSON object with keys: `id`, `title`, `context`, `decision`, `consequences`, `concepts`, `risks`, `docLinks`, `createdAt`
