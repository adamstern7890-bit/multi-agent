## Multi‑Agent Task Solver (Prototype)

This is a small, friendly prototype that shows how multiple "agents" can plan, work, and report back in real time. It’s built to be easy to run, easy to read, and easy to extend. No heavy frameworks, just enough structure to make the ideas clear.

### Quick Start

```bash
npm install
npm start
# Open in browser
open http://localhost:3000
```

Try a sample request:
- "Summarize the last 3 quarters’ financial trends and create a chart"

### How It Works (High Level)

- Input: User submits a plain‑text business request via the UI.
- Planning: A lightweight planner infers which agents are relevant based on keywords.
- Execution: Agents are simulated to run sequentially with multiple steps, emitting progress/logs.
- Aggregation: Outputs are synthesized into a final result (summary + artifacts).
- Visibility: The frontend consumes Server‑Sent Events (SSE) to render a live timeline, progress bars, and final result.

### Architecture

- Backend: Node.js + Express
  - `POST /api/submit` – returns a `jobId`.
  - `GET /api/stream/:jobId?q=...` – SSE stream of job events: `job-start`, `plan`, `agent-start`, `agent-progress`, `agent-complete`, `job-complete`, `job-error`.
  - Static hosting of frontend from `public/`.
- Frontend: Vanilla JS + CSS (no framework) for fast boot and clarity
  - Form to submit request
  - Real‑time timeline of agents with progress bars and logs
  - Final result viewer with artifacts (mock chart + table)

### Event Model (SSE)

Events emitted by the server:
- `job-start`: `{ jobId, createdAt }`
- `plan`: `{ agents: [{ id, name, role, steps }] }`
- `agent-start`: `{ agent: { id, name, role } }`
- `agent-progress`: `{ id, progress, log }` (multiple per agent)
- `agent-complete`: `{ id, output }`
- `job-complete`: `{ jobId, result }`
- `job-error`: `{ message }`

The frontend subscribes with `EventSource` and updates UI accordingly.

### Design Decisions

- SSE over WebSockets: Simple one‑way event stream suffices for progress updates; native `EventSource` keeps implementation light.
- Sequential agent execution: Clear timeline and deterministic ordering for demo; can be parallelized later with dependencies.
- Keyword‑based planning: Minimal heuristic planner for the prototype; swappable with LLM‑based planning in production.
- Vanilla JS frontend: Faster to implement, zero build tooling; easy to port to React/Vue if scaling UI complexity.

### Trade‑offs (24h Constraint)

- No database or durable job queue: In‑memory job tracking only, adequate for local demo.
- Simulated agents instead of real tool use: Focus on event model, state management, and UX.
- Basic error handling: Demonstrates error event and UI state; not exhaustive.
- Minimal styling and animations: Polished enough for readability; could add richer motion and theming later.

### How To Run / Test

1) Run locally
```bash
npm install
npm start
```
Open `http://localhost:3000`.

2) Submit a request
- Finance prompt (injects Finance SME): "Summarize last three quarters financial trends and visualize revenue"
- Tech prompt (injects Engineer): "Draft API integration plan and create a sample code snippet"

3) Observe real‑time execution
- Timeline shows agents with progress and logs
- Final section renders synthesized summary and artifacts

4) Error testing (manual)
- Temporarily throw in `server.js` during execution to see `job-error` UI handling

### Project Structure

```
/Users/umern/assesment
├─ public/
│  ├─ index.html
│  ├─ styles.css
│  ├─ main.js
│  └─ placeholder-chart.svg
├─ server.js
├─ package.json
└─ README.md
```

### Extending This Prototype

- Real Agents: Replace simulated steps with tool/LLM calls per agent.
- Dependencies: Add a DAG planner and parallel execution for independent agents.
- Reliability: Persist job state (Redis/Postgres) and enable replay.
- Auth/Tenancy: Add user/workspace scoping and RBAC for enterprise contexts.
- Transport: Upgrade to WebSockets for bidirectional control (pause, retry, cancel).
- UI: Migrate to React + state machine (XState) for complex flows.

### High‑Marks Additions

- Event‑Driven Updates: Implemented with SSE (`EventSource`).
- Explicit Controls: Retry and Cancel buttons; connection status pill.
- Error Simulation: Toggle with adjustable `failRate` to exercise error states end‑to‑end.
- Animations: Subtle fade‑in and progress transitions; easy to extend.

### License

Prototype code provided for assessment purposes.

---

### Troubleshooting

- Port already in use: Change `PORT` env var, e.g. `PORT=4000 npm start` and open `http://localhost:4000`.
- Chart not rendering: We ship an SVG (`public/placeholder-chart.svg`). If you swapped it, double‑check the path in `server.js`.
- No updates visible: Check the browser console for EventSource errors; some ad‑blockers interfere with SSE.

### FAQ

- Is this using real agents? For the demo, they’re simulated so we can focus on planning, streaming, and UX. The code is structured so you can plug in real agents later.
- Why SSE over WebSockets? One‑way progress updates are a perfect fit, and SSE is simpler to wire up in a few lines.


