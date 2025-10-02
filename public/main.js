// Grab the pieces of the page we interact with
const form = document.getElementById('request-form');
const textarea = document.getElementById('request');
const submitBtn = document.getElementById('submit-btn');
const resetBtn = document.getElementById('reset-btn');
const timeline = document.getElementById('timeline');
const jobMeta = document.getElementById('job-meta');
const resultStatus = document.getElementById('result-status');
const resultEl = document.getElementById('result');

let evtSource = null; // The live connection to the server (SSE)
let state = { jobId: null, agents: {}, order: [] };

// Reset the UI back to a clean slate
function resetView() {
  state = { jobId: null, agents: {}, order: [] };
  timeline.innerHTML = '';
  jobMeta.textContent = '';
  resultStatus.textContent = 'Waiting for job...';
  resultEl.innerHTML = '';
  resetBtn.disabled = true;
}

// Create a card for each agent when it starts
function renderAgent(agent) {
  const container = document.createElement('div');
  container.className = 'agent fade-in';
  container.id = `agent-${agent.id}`;
  container.innerHTML = `
    <div class="agent-header">
      <div>
        <div><strong>${agent.name}</strong></div>
        <div class="agent-role">${agent.role || ''}</div>
      </div>
      <div class="pill" id="pill-${agent.id}">Running</div>
    </div>
    <div class="progress"><div class="bar" id="bar-${agent.id}"></div></div>
    <div class="logs" id="logs-${agent.id}"></div>
  `;
  timeline.appendChild(container);
}

// Move the progress bar and append log lines
function updateProgress(id, progress, log) {
  const bar = document.getElementById(`bar-${id}`);
  if (bar) bar.style.width = `${Math.min(100, Math.max(0, progress))}%`;
  if (log) {
    const logs = document.getElementById(`logs-${id}`);
    if (logs) {
      const line = document.createElement('div');
      line.textContent = log;
      logs.appendChild(line);
      logs.scrollTop = logs.scrollHeight;
    }
  }
}

// Mark the agent as completed
function markComplete(id) {
  const pill = document.getElementById(`pill-${id}`);
  const bar = document.getElementById(`bar-${id}`);
  if (bar) bar.style.width = '100%';
  if (pill) { pill.textContent = 'Completed'; pill.classList.add('success', 'pill', 'success'); }
}

// Render the final synthesized result and artifacts
function renderResult(result) {
  resultStatus.textContent = 'Completed';
  const artifactsHtml = (result.artifacts || []).map(a => {
    if (a.type === 'chart' && a.url) {
      return `<div class="card"><div class="kvs"><div class="key">Type</div><div>${a.type}</div><div class="key">Format</div><div>${a.format}</div></div><img src="${a.url}" alt="chart" style="width:100%; border-radius:8px; margin-top:8px;"/></div>`;
    }
    return `<div class="card"><pre style="white-space:pre-wrap; margin:0;">${JSON.stringify(a, null, 2)}</pre></div>`;
  }).join('');

  resultEl.innerHTML = `
    <h3>${result.title || 'Result'}</h3>
    <div class="kvs">
      <div class="key">Request</div><div>${result.request}</div>
      <div class="key">Summary</div><div><pre style="white-space:pre-wrap; margin:0;">${result.synthesizedSummary}</pre></div>
    </div>
    <div class="artifact-grid">${artifactsHtml}</div>
  `;
}

// Open the server-sent events stream and wire the event handlers
function connectSSE(jobId, query) {
  if (evtSource) evtSource.close();
  const url = new URL(`/api/stream/${jobId}`, window.location.origin);
  url.searchParams.set('q', query);
  evtSource = new EventSource(url);

  evtSource.addEventListener('job-start', (e) => {
    const data = JSON.parse(e.data);
    jobMeta.textContent = `Job ${data.jobId} • ${new Date(data.createdAt).toLocaleTimeString()}`;
  });

  evtSource.addEventListener('plan', (e) => {
    const data = JSON.parse(e.data);
    state.order = data.agents.map(a => a.id);
    for (const agent of data.agents) {
      state.agents[agent.id] = agent;
      renderAgent(agent);
    }
  });

  evtSource.addEventListener('agent-start', (e) => {
    const a = JSON.parse(e.data).agent;
    if (!document.getElementById(`agent-${a.id}`)) renderAgent(a);
  });

  evtSource.addEventListener('agent-progress', (e) => {
    const { id, progress, log } = JSON.parse(e.data);
    updateProgress(id, progress, log);
  });

  evtSource.addEventListener('agent-complete', (e) => {
    const { id } = JSON.parse(e.data);
    markComplete(id);
  });

  evtSource.addEventListener('job-complete', (e) => {
    const data = JSON.parse(e.data);
    renderResult(data.result);
    evtSource.close();
  });

  evtSource.addEventListener('job-error', (e) => {
    const { message } = JSON.parse(e.data);
    resultStatus.textContent = 'Error';
    resultEl.innerHTML = `<div class="card" style="border-color:#5b1a1a; color:#fca5a5;">${message}</div>`;
    evtSource.close();
  });

  evtSource.onerror = () => {
    // Basic retry indicator; default EventSource will retry automatically
    jobMeta.textContent += ' • reconnecting...';
  };
}

form.addEventListener('submit', async (e) => {
  e.preventDefault();
  submitBtn.disabled = true;
  resetBtn.disabled = false;
  timeline.innerHTML = '';
  resultEl.innerHTML = '';
  resultStatus.textContent = 'Running...';

  const request = textarea.value.trim();
  if (!request) return;

  const res = await fetch('/api/submit', {
    method: 'POST', headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ request })
  });
  const { jobId } = await res.json();
  state.jobId = jobId;
  connectSSE(jobId, request);
});

resetBtn.addEventListener('click', () => {
  if (evtSource) evtSource.close();
  resetView();
  submitBtn.disabled = false;
});

resetView();


