import express from 'express';
import cors from 'cors';
import { nanoid } from 'nanoid';

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());
app.use(express.static('public'));

// Tiny in-memory job store for the demo. Good enough for one process.
const jobs = new Map();

// Helper: write a well-formed SSE event with a named channel
function sseWrite(res, event, data) {
  res.write(`event: ${event}\n`);
  res.write(`data: ${JSON.stringify(data)}\n\n`);
}

// Planner: very small heuristic that chooses which agents to run
function planAgents(requestText) {
  const baseAgents = [
    { id: 'planner', name: 'Planner', role: 'Break down the request', steps: 1 },
    { id: 'researcher', name: 'Researcher', role: 'Gather data and sources', steps: 3 },
    { id: 'analyst', name: 'Analyst', role: 'Analyze trends and insights', steps: 3 },
    { id: 'visualizer', name: 'Visualizer', role: 'Create charts/tables', steps: 2 },
    { id: 'editor', name: 'Editor', role: 'Compose final structured report', steps: 2 }
  ];

  // Tailor by keywords. In real life, swap this for an LLM planner.
  const lower = requestText.toLowerCase();
  const agents = [...baseAgents];
  if (lower.includes('code') || lower.includes('api')) {
    agents.splice(2, 0, { id: 'engineer', name: 'Engineer', role: 'Prototype or integrate APIs', steps: 2 });
  }
  if (lower.includes('financial') || lower.includes('quarter')) {
    agents.unshift({ id: 'finance', name: 'Finance SME', role: 'Validate financial logic', steps: 2 });
  }

  return agents;
}

// Runner: simulate agents with small delays and progressive updates
async function executeJob(jobId, requestText, res, options = {}) {
  const { failRate = 0 } = options;
  const agents = planAgents(requestText);
  const startTime = Date.now();
  const job = { id: jobId, status: 'running', createdAt: startTime, agents: [], result: null };
  jobs.set(jobId, job);

  sseWrite(res, 'job-start', { jobId, createdAt: startTime });
  sseWrite(res, 'plan', { agents });

  // Execute each agent sequentially; in real life could be parallel with dependencies
  for (const agent of agents) {
    const agentRun = { id: agent.id, name: agent.name, role: agent.role, status: 'running', progress: 0, logs: [] };
    job.agents.push(agentRun);
    sseWrite(res, 'agent-start', { agent: agentRun });

    const totalSteps = agent.steps;
    for (let step = 1; step <= totalSteps; step += 1) {
      // Simulate work
      await new Promise(r => setTimeout(r, 500 + Math.random() * 600));
      // Simulate random failure based on failRate
      if (Math.random() < failRate) {
        agentRun.status = 'failed';
        const message = `${agent.name} encountered an error at step ${step}`;
        sseWrite(res, 'job-error', { message, agentId: agent.id });
        job.status = 'error';
        return res.end();
      }
      const progress = Math.round((step / totalSteps) * 100);
      const log = `${agent.name}: completed step ${step}/${totalSteps}`;
      agentRun.progress = progress;
      agentRun.logs.push(log);
      sseWrite(res, 'agent-progress', { id: agent.id, progress, log });
    }

    // Simulated output
    const output = { summary: `${agent.name} completed: ${agent.role}` };
    agentRun.status = 'completed';
    agentRun.output = output;
    sseWrite(res, 'agent-complete', { id: agent.id, output });
  }

  // Aggregate results
  const final = {
    title: 'Task Result',
    request: requestText,
    synthesizedSummary: job.agents.map(a => a.output?.summary).join('\n'),
    artifacts: [
      { type: 'chart', format: 'svg', url: '/placeholder-chart.svg', description: 'Example chart artifact' },
      { type: 'table', format: 'json', data: [
        { quarter: 'Q1', revenue: 120 },
        { quarter: 'Q2', revenue: 140 },
        { quarter: 'Q3', revenue: 160 }
      ] }
    ]
  };

  job.status = 'completed';
  job.result = final;
  sseWrite(res, 'job-complete', { jobId, result: final });
  res.end();
}

app.post('/api/submit', (req, res) => {
  const { request } = req.body || {};
  if (!request || typeof request !== 'string') {
    return res.status(400).json({ error: 'Missing request string' });
  }
  const jobId = nanoid();
  res.json({ jobId });
});

app.get('/api/stream/:jobId', async (req, res) => {
  const { jobId } = req.params;
  const { q, failRate } = req.query;

  res.setHeader('Content-Type', 'text/event-stream');
  res.setHeader('Cache-Control', 'no-cache');
  res.setHeader('Connection', 'keep-alive');
  res.flushHeaders?.();

  // If job exists and completed, replay plan and completion
  const existing = jobs.get(jobId);
  if (existing && existing.status === 'completed') {
    sseWrite(res, 'job-start', { jobId, createdAt: existing.createdAt });
    sseWrite(res, 'plan', { agents: existing.agents.map(a => ({ id: a.id, name: a.name, role: a.role, steps: a.steps || 1 })) });
    for (const a of existing.agents) {
      sseWrite(res, 'agent-start', { agent: { id: a.id, name: a.name, role: a.role } });
      sseWrite(res, 'agent-progress', { id: a.id, progress: 100, log: `${a.name} completed` });
      sseWrite(res, 'agent-complete', { id: a.id, output: a.output });
    }
    sseWrite(res, 'job-complete', { jobId, result: existing.result });
    return res.end();
  }

  // If new job, start execution using provided query text
  const text = typeof q === 'string' ? q : 'General business analysis request';
  const fail = typeof failRate === 'string' ? Math.max(0, Math.min(1, Number(failRate))) : 0;
  executeJob(jobId, text, res, { failRate: fail }).catch(err => {
    sseWrite(res, 'job-error', { message: err?.message || 'Unknown error' });
    res.end();
  });
});

app.listen(PORT, () => {
  // eslint-disable-next-line no-console
  console.log(`Server running on http://localhost:${PORT}`);
});


