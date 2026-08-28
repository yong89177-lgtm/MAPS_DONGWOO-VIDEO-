const API = {
  categories: '/api/categories',
  agents: '/api/agents',
};

const state = { categories: [], agents: [] };

async function init() {
  await Promise.all([loadCategories(), loadAgents()]);
  renderCategorySelect();
  renderSections();
  bindEvents();
}

async function loadCategories() {
  const res = await fetch(API.categories);
  state.categories = await res.json();
}

async function loadAgents() {
  const res = await fetch(API.agents);
  state.agents = await res.json();
}

function renderCategorySelect() {
  const select = document.getElementById('categorySelect');
  select.innerHTML = state.categories
    .map((c) => `<option value="${escapeHtml(c)}">${escapeHtml(c)}</option>`)
    .join('');
}

function renderSections() {
  const container = document.getElementById('categorySections');
  container.innerHTML = '';
  state.categories.forEach((category) => {
    const agents = state.agents.filter((a) => a.category === category);
    const section = document.createElement('section');
    section.className = 'category-section';
    section.innerHTML = `
      <h2>${escapeHtml(category)} <span class="count">${agents.length}</span></h2>
      <div class="card-grid">
        ${agents.length ? agents.map(cardHtml).join('') : '<p class="empty">등록된 에이전트가 없습니다.</p>'}
      </div>
    `;
    container.appendChild(section);
  });
}

function cardHtml(agent) {
  const fileName = agent.originalFileName || `${agent.name}.html`;
  return `
    <article class="agent-card" data-id="${agent.id}" tabindex="0" role="button">
      <a class="dl-btn" href="/api/agents/${agent.id}/file" download="${escapeAttr(fileName)}"
         title="등록한 HTML 다운로드" aria-label="등록한 HTML 다운로드">⬇</a>
      <h3>${escapeHtml(agent.name)}</h3>
      <p class="agent-desc">${escapeHtml(agent.description)}</p>
      <p class="agent-meta">등록자: ${escapeHtml(agent.developer)}</p>
    </article>
  `;
}

function escapeHtml(str) {
  const div = document.createElement('div');
  div.textContent = str ?? '';
  return div.innerHTML;
}

function escapeAttr(str) {
  return escapeHtml(str).replace(/"/g, '&quot;');
}

function bindEvents() {
  document.getElementById('openRegisterBtn').addEventListener('click', openRegisterModal);
  document.getElementById('closeRegisterBtn').addEventListener('click', closeRegisterModal);
  document.getElementById('cancelRegisterBtn').addEventListener('click', closeRegisterModal);
  document.getElementById('registerForm').addEventListener('submit', submitRegister);

  const sections = document.getElementById('categorySections');
  sections.addEventListener('click', (e) => {
    if (e.target.closest('.dl-btn')) return; // 다운로드 링크는 기본 동작(파일 저장)만 하고 뷰어는 열지 않는다
    const card = e.target.closest('.agent-card');
    if (card) openViewer(card.dataset.id);
  });
  sections.addEventListener('keydown', (e) => {
    if (e.key !== 'Enter' && e.key !== ' ') return;
    if (e.target.closest('.dl-btn')) return;
    const card = e.target.closest('.agent-card');
    if (card) {
      e.preventDefault();
      openViewer(card.dataset.id);
    }
  });

  document.getElementById('closeViewerBtn').addEventListener('click', closeViewer);
}

function openRegisterModal() {
  document.getElementById('formError').classList.add('hidden');
  document.getElementById('registerForm').reset();
  document.getElementById('registerModal').classList.remove('hidden');
}

function closeRegisterModal() {
  document.getElementById('registerModal').classList.add('hidden');
}

async function submitRegister(e) {
  e.preventDefault();
  const form = e.target;
  const errorEl = document.getElementById('formError');
  const submitBtn = document.getElementById('submitRegisterBtn');
  errorEl.classList.add('hidden');
  submitBtn.disabled = true;
  submitBtn.textContent = '요청 보내는 중...';

  try {
    const formData = new FormData(form);
    const res = await fetch(API.agents, { method: 'POST', body: formData });

    let payload = null;
    try {
      payload = await res.json();
    } catch (_) {
      // 응답 본문이 없거나 JSON이 아닌 경우 무시
    }

    if (!res.ok) {
      throw new Error(payload?.message || '요청 처리 중 오류가 발생했습니다.');
    }

    closeRegisterModal();
    showToast('요청이 접수되었습니다. 관리자 승인(1차/2차) 후 카드가 생성됩니다.');
    await loadAgents();
    renderSections();
  } catch (err) {
    const message =
      err instanceof TypeError
        ? '서버에 연결할 수 없습니다. 잠시 후 다시 시도해주세요.'
        : err.message;
    errorEl.textContent = message;
    errorEl.classList.remove('hidden');
  } finally {
    submitBtn.disabled = false;
    submitBtn.textContent = '요청 보내기';
  }
}

function openViewer(id) {
  const agent = state.agents.find((a) => a.id === id);
  if (!agent) return;
  const url = `/api/agents/${id}/file`;
  document.getElementById('viewerTitle').textContent = agent.name;
  document.getElementById('viewerNewTab').href = url;
  document.getElementById('viewerFrame').src = url;
  document.getElementById('viewerModal').classList.remove('hidden');
}

function closeViewer() {
  document.getElementById('viewerModal').classList.add('hidden');
  document.getElementById('viewerFrame').src = 'about:blank';
}

function showToast(message) {
  const toast = document.getElementById('toast');
  toast.textContent = message;
  toast.classList.remove('hidden');
  clearTimeout(showToast._t);
  showToast._t = setTimeout(() => toast.classList.add('hidden'), 3500);
}

init();
