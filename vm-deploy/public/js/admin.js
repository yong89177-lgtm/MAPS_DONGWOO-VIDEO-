const state = {
  adminKey: localStorage.getItem('adminKey') || '',
  agents: [],
  tab: 'pending',
};

const STATUS_LABEL = {
  pending: '대기중',
  first_approved: '1차 승인완료',
  approved: '승인완료',
  rejected: '거절됨',
};

function init() {
  document.getElementById('adminKeyInput').value = state.adminKey;
  bindEvents();
  if (state.adminKey) loadAgents();
}

function bindEvents() {
  document.getElementById('saveKeyBtn').addEventListener('click', () => {
    state.adminKey = document.getElementById('adminKeyInput').value.trim();
    localStorage.setItem('adminKey', state.adminKey);
    loadAgents();
  });

  document.querySelectorAll('.tab-btn').forEach((btn) => {
    btn.addEventListener('click', () => {
      state.tab = btn.dataset.tab;
      document.querySelectorAll('.tab-btn').forEach((b) => b.classList.toggle('active', b === btn));
      render();
    });
  });

  document.getElementById('agentList').addEventListener('click', onListClick);
}

function headers() {
  return { 'x-admin-key': state.adminKey };
}

async function loadAgents() {
  setStatus('불러오는 중...');
  try {
    const res = await fetch('/api/agents/admin', { headers: headers() });
    if (res.status === 401) {
      state.agents = [];
      setStatus('관리자 키가 올바르지 않습니다.');
      render();
      return;
    }
    if (!res.ok) throw new Error('목록을 불러오지 못했습니다.');
    state.agents = await res.json();
    setStatus('');
    render();
  } catch (err) {
    setStatus(err instanceof TypeError ? '서버에 연결할 수 없습니다.' : err.message);
  }
}

function setStatus(msg) {
  const el = document.getElementById('adminStatus');
  el.textContent = msg;
  el.classList.toggle('hidden', !msg);
}

function render() {
  const list = document.getElementById('agentList');
  const filtered = state.agents.filter((a) => a.status === state.tab);
  if (!filtered.length) {
    list.innerHTML = '<p class="empty">해당하는 요청이 없습니다.</p>';
    return;
  }
  list.innerHTML = filtered.map(itemHtml).join('');
}

function itemHtml(agent) {
  const previewUrl = `/api/agents/${agent.id}/preview?key=${encodeURIComponent(state.adminKey)}`;
  let actions = `<a class="btn-secondary" href="${previewUrl}" target="_blank" rel="noopener">미리보기</a>`;

  if (agent.status === 'pending') {
    actions += `
      <button class="btn-primary" data-action="first-approve" data-id="${agent.id}">1차 승인</button>
      <button class="btn-danger" data-action="reject" data-id="${agent.id}">거절</button>`;
  } else if (agent.status === 'first_approved') {
    actions += `
      <button class="btn-primary" data-action="second-approve" data-id="${agent.id}">2차(최종) 승인</button>
      <button class="btn-danger" data-action="reject" data-id="${agent.id}">거절</button>`;
  }

  return `
    <article class="admin-card">
      <div class="admin-card-header">
        <h3>${escapeHtml(agent.name)}</h3>
        <span class="badge badge-${agent.status}">${STATUS_LABEL[agent.status] || agent.status}</span>
      </div>
      <p><strong>카테고리:</strong> ${escapeHtml(agent.category)}</p>
      <p><strong>설명:</strong> ${escapeHtml(agent.description)}</p>
      <p><strong>등록자:</strong> ${escapeHtml(agent.developer)} (${escapeHtml(agent.contactEmail)})</p>
      <p><strong>파일명:</strong> ${escapeHtml(agent.originalFileName)}</p>
      <p><strong>요청일:</strong> ${formatDate(agent.createdAt)}</p>
      ${agent.firstApprovedAt ? `<p><strong>1차 승인:</strong> ${formatDate(agent.firstApprovedAt)} (${escapeHtml(agent.firstApprovedBy || '')})</p>` : ''}
      ${agent.approvedAt ? `<p><strong>2차(최종) 승인:</strong> ${formatDate(agent.approvedAt)} (${escapeHtml(agent.approvedBy || '')})</p>` : ''}
      ${agent.rejectedAt ? `<p><strong>거절 사유:</strong> ${escapeHtml(agent.rejectReason || '(사유 없음)')}</p>` : ''}
      <div class="admin-card-actions">${actions}</div>
    </article>
  `;
}

function formatDate(iso) {
  if (!iso) return '-';
  return new Date(iso).toLocaleString('ko-KR');
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

async function onListClick(e) {
  const btn = e.target.closest('button[data-action]');
  if (!btn) return;
  const { action, id } = btn.dataset;

  try {
    if (action === 'reject') {
      const reason = prompt('거절 사유를 입력해주세요.', '');
      if (reason === null) return;
      await callAction(id, 'reject', { reason });
    } else {
      await callAction(id, action);
    }
    await loadAgents();
  } catch (err) {
    alert(err.message);
  }
}

async function callAction(id, action, body) {
  const res = await fetch(`/api/agents/${id}/${action}`, {
    method: 'POST',
    headers: { ...headers(), 'Content-Type': 'application/json' },
    body: body ? JSON.stringify(body) : undefined,
  });
  const payload = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(payload.message || '처리 중 오류가 발생했습니다.');
}

init();
