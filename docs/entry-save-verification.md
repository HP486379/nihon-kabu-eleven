# Entry save verification

This branch fixes a false-positive entry completion path.

- Participant list fetches use no-store cache busting.
- Dashboard submit now verifies the saved entry is visible from GET /api/entries before showing completion.
- If the backend POST responds but GET /api/entries does not include the new team, the UI shows an error instead of pretending the entry is complete.
