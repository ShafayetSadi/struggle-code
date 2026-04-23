Generate one Architecture Decision Record as JSON.

Return valid JSON only with these keys:
- id
- title
- context
- decision
- consequences
- concepts
- risks
- docLinks
- createdAt

Constraints:
- `concepts` must have at most 3 items
- `risks` must have at most 2 items
- `docLinks` must contain only real documentation URLs
- keep the language concise and specific to the milestone
