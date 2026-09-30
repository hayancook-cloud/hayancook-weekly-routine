// 요일별 일정 화면과 편집, 자동 저장, 백업 및 설치 안내를 연결한다.
import { DAYS, KINDS, LIMIT, initialStore, build, validStore, time } from './routine.js';
import { monthCells } from './calendar.js';

const $ = id => document.getElementById(id);
const escape = text => String(text).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
const clone = value => JSON.parse(JSON.stringify(value));
const KEY = 'hayan7';
let store = initialStore(), loadError = false;
try {
  const saved = localStorage.getItem(KEY);
  if (saved) {
    const parsed = JSON.parse(saved);
    if (!validStore(parsed)) throw new Error('Invalid data');
    store = parsed;
  }
} catch { loadError = true; }
const today = new Date();
let view = 'mine', selectedDay = DAYS[(today.getDay() + 6) % 7], period = 'day';
let month = new Date(today.getFullYear(), today.getMonth(), 1), selectedDate = today.getDate();
let editIndex = null, pickKind = 'shoot', draftSet = null, toastTimer;
const list = () => store[view];

function toast(message) {
  clearTimeout(toastTimer); $('toast').textContent = message; $('toast').hidden = false;
  toastTimer = setTimeout(() => { $('toast').hidden = true; }, 4000);
}
function persist(next) {
  try { localStorage.setItem(KEY, JSON.stringify(next)); store = next; return true; }
  catch { toast('저장하지 못했어요. 기기 저장 공간과 Safari 설정을 확인해 주세요.'); return false; }
}
function showDialog(id) { $(id).showModal(); document.body.classList.add('modal-open'); }
document.querySelectorAll('dialog').forEach(dialog => {
  dialog.addEventListener('close', () => { if (!document.querySelector('dialog[open]')) document.body.classList.remove('modal-open'); });
  dialog.querySelectorAll('[data-close]').forEach(button => { button.onclick = () => dialog.close(); });
});
function confirmAction(title, message, label) {
  $('confirm-title').textContent = title; $('confirm-message').textContent = message; $('confirm-ok').textContent = label;
  return new Promise(resolve => {
    const dialog = $('confirm');
    dialog.returnValue = '';
    $('confirm-ok').onclick = () => dialog.close('yes');
    $('confirm-cancel').onclick = () => dialog.close('no');
    dialog.addEventListener('close', () => resolve(dialog.returnValue === 'yes'), { once: true });
    showDialog('confirm');
  });
}

function render() {
  document.querySelectorAll('[data-view]').forEach(b => b.setAttribute('aria-pressed', String(b.dataset.view === view)));
  $('generate-open').hidden = view !== 'mine';
  $('summary-label').textContent = view === 'mine' ? '이번 주 작업' : '기존 루틴의 작업';
  $('stats').innerHTML = [['콘텐츠', 'up'], ['공구 업로드', 'gbup'], ['기획', 'plan']].map(([label, kind]) => `<div class="stat"><span>${label}</span><b>${list().filter(e => e.kind === kind).length}<small>개</small></b></div>`).join('');
  $('days').hidden = period !== 'day';
  $('summary').hidden = period === 'month';
  document.querySelector('.app').classList.toggle('month-view', period === 'month');
  $('page-title').textContent = period === 'month' ? '나의 한 달' : '나의 한 주';
  $('month-calendar').hidden = period !== 'month';
  $('days').innerHTML = DAYS.map(day => {
    const kinds = [...new Set(list().filter(e => e.day === day).map(e => e.kind))].slice(0, 4);
    return `<button class="day${['토', '일'].includes(day) ? ' weekend' : ''}" data-day="${day}" aria-label="${day}요일" aria-pressed="${selectedDay === day}">${day}<span class="day-dots" aria-hidden="true">${kinds.map(kind => `<i class="dot ${kind}"></i>`).join('')}</span></button>`;
  }).join('');
  $('schedule-label').textContent = { day: '요일별로 보기', week: '한 주 전체', month: '한 달 전체' }[period];
  for (const mode of ['day', 'week', 'month']) $(`${mode}-toggle`).setAttribute('aria-pressed', String(period === mode));
  if (period === 'month') renderMonth();
  $('schedule').innerHTML = (period === 'week' ? DAYS : [selectedDay]).map(day => {
    const events = list().map((e, index) => ({ ...e, index })).filter(e => e.day === day).sort((a, b) => a.from - b.from || a.to - b.to);
    const hours = events.reduce((sum, e) => sum + e.to - e.from, 0);
    const heading = period === 'month' ? `${month.getMonth() + 1}월 ${selectedDate}일 ${day}요일` : `${day}요일`;
    return `<div class="day-group"><div class="day-heading"><h2>${heading}</h2><p>${events.length}개 일정${hours ? ` · ${hours}시간` : ''}</p></div>${events.length ? events.map(eventCard).join('') : `<div class="empty"><p><strong>비어 있는 ${day}요일</strong>쉬어도 좋고, 할 일을 더해도 좋아요.</p><button data-add-day="${day}">＋ 일정 추가</button></div>`}</div>`;
  }).join('');
}
function renderMonth() {
  const year = month.getFullYear(), m = month.getMonth();
  $('month-title').textContent = `${year}년 ${m + 1}월`;
  const short = { shoot: '촬영', edit: '편집', up: '업로드', gbup: '공구', gb: '준비', plan: '기획' };
  $('month-grid').innerHTML = monthCells(year, m).map(cell => {
    if (!cell) return '<div class="calendar-blank" aria-hidden="true"></div>';
    const events = list().filter(e => e.day === cell.day);
    const kinds = [...new Set(events.map(e => e.kind))];
    const isToday = year === today.getFullYear() && m === today.getMonth() && cell.date === today.getDate();
    return `<button class="calendar-date${['토', '일'].includes(cell.day) ? ' weekend' : ''}" data-date="${cell.date}" aria-pressed="${selectedDate === cell.date}" ${isToday ? 'aria-current="date"' : ''} aria-label="${m + 1}월 ${cell.date}일 ${cell.day}요일, ${events.length}개 일정"><span class="calendar-date-heading"><span class="calendar-number">${cell.date}</span>${kinds.length > 2 ? `<small aria-hidden="true">＋${kinds.length - 2}</small>` : ''}</span><span class="calendar-badges" aria-hidden="true">${kinds.slice(0, 2).map(kind => `<span class="${kind}">${short[kind]}</span>`).join('')}</span></button>`;
  }).join('');
}
function selectDate(date) {
  selectedDate = date;
  selectedDay = DAYS[(new Date(month.getFullYear(), month.getMonth(), date).getDay() + 6) % 7];
}
function changeMonth(delta) {
  month = new Date(month.getFullYear(), month.getMonth() + delta, 1);
  selectDate(Math.min(selectedDate, new Date(month.getFullYear(), month.getMonth() + 1, 0).getDate()));
  render();
}
function eventCard(e) {
  const clock = t => `<span${t >= 24 ? ' class="overnight"' : ''}>${time(t)}</span>`;
  return `<button class="event" data-index="${e.index}" aria-label="${escape(e.name)} ${time(e.from)}부터 ${time(e.to)}까지 수정"><span class="event-time">${clock(e.from)}<small>${clock(e.to)}</small></span><span class="event-info"><span class="badge ${e.kind}">${KINDS[e.kind]}</span><strong>${escape(e.name)}</strong></span><span class="chevron" aria-hidden="true">›</span></button>`;
}

document.querySelectorAll('[data-view]').forEach(button => { button.onclick = () => { view = button.dataset.view; render(); }; });
$('days').onclick = e => { const button = e.target.closest('[data-day]'); if (button) { selectedDay = button.dataset.day; render(); } };
for (const mode of ['day', 'week', 'month']) $(`${mode}-toggle`).onclick = () => { period = mode; if (mode === 'month') selectDate(selectedDate); render(); };
$('month-prev').onclick = () => changeMonth(-1);
$('month-next').onclick = () => changeMonth(1);
$('month-today').onclick = () => { month = new Date(today.getFullYear(), today.getMonth(), 1); selectDate(today.getDate()); render(); };
$('month-grid').onclick = e => { const b = e.target.closest('[data-date]'); if (b) { selectDate(Number(b.dataset.date)); render(); } };
$('schedule').onclick = e => {
  const event = e.target.closest('[data-index]'), add = e.target.closest('[data-add-day]');
  if (event) openEditor(Number(event.dataset.index));
  else if (add) { selectedDay = add.dataset.addDay; openEditor(null); }
};
$('add').onclick = () => openEditor(null);

function paintKinds() {
  $('kinds').innerHTML = Object.entries(KINDS).map(([kind, label]) => `<button type="button" class="${kind}" data-kind="${kind}" aria-pressed="${pickKind === kind}">${label}</button>`).join('');
}
function openEditor(index) {
  editIndex = index;
  const event = index === null ? { name: '', day: selectedDay, from: 13, to: 14, kind: 'shoot' } : list()[index];
  $('editor-title').textContent = index === null ? '일정 추가' : '일정 수정';
  $('event-name').value = event.name; $('event-day').value = event.day;
  $('event-from').value = event.from; $('event-to').value = event.to;
  pickKind = event.kind; paintKinds(); $('delete').hidden = index === null;
  $('event-error').hidden = true; updateOverlap(); showDialog('editor');
}
$('kinds').onclick = e => { const b = e.target.closest('[data-kind]'); if (b) { pickKind = b.dataset.kind; paintKinds(); } };
$('event-day').innerHTML = DAYS.map(day => `<option value="${day}">${day}요일</option>`).join('');
for (let t = 9; t <= 25; t += 0.5) {
  if (t < 25) $('event-from').add(new Option(time(t), t));
  if (t > 9) $('event-to').add(new Option(time(t), t));
}
function updateOverlap() {
  $('event-error').hidden = true;
  const from = Number($('event-from').value), to = Number($('event-to').value), day = $('event-day').value;
  $('editor-repeat-note').hidden = period !== 'month';
  $('editor-repeat-note').textContent = `매주 ${day}요일에 반복되는 루틴을 수정해요. 다른 주의 ${day}요일에도 함께 적용돼요.`;
  $('overlap-note').hidden = !list().some((e, i) => i !== editIndex && e.day === day && e.from < to && e.to > from);
}
for (const id of ['event-day', 'event-from', 'event-to']) $(id).onchange = updateOverlap;
$('event-form').onsubmit = e => {
  e.preventDefault();
  const item = { day: $('event-day').value, from: Number($('event-from').value), to: Number($('event-to').value), kind: pickKind, name: $('event-name').value.trim() };
  if (!item.name || item.to <= item.from) {
    $('event-error').textContent = !item.name ? '할 일을 입력해 주세요.' : '종료 시간을 시작 시간보다 뒤로 정해 주세요.';
    $('event-error').hidden = false; return;
  }
  const next = clone(store);
  if (editIndex === null) {
    if (next[view].length >= 500) { $('event-error').textContent = '루틴 하나에는 일정을 최대 500개 저장할 수 있어요.'; $('event-error').hidden = false; return; }
    next[view].push(item);
  } else next[view][editIndex] = item;
  if (!persist(next)) return;
  selectedDay = item.day;
  if (period === 'month') {
    const dates = monthCells(month.getFullYear(), month.getMonth()).filter(cell => cell?.day === item.day);
    selectDate(dates.reduce((best, cell) => Math.abs(cell.date - selectedDate) < Math.abs(best.date - selectedDate) ? cell : best).date);
  }
  $('editor').close(); render(); toast('일정을 저장했어요.');
};
$('delete').onclick = async () => {
  if (!await confirmAction('일정을 삭제할까요?', list()[editIndex].name, '삭제')) return;
  const next = clone(store); next[view].splice(editIndex, 1);
  if (persist(next)) { $('editor').close(); render(); toast('일정을 삭제했어요.'); }
};

function renderCounters() {
  $('counters').innerHTML = Object.entries({ content: '콘텐츠', gb: '공구', plan: '기획' }).map(([key, label]) => `<div class="counter"><span>${label}</span><div class="stepper"><button data-key="${key}" data-delta="-1" aria-label="${label} 줄이기" ${draftSet[key] <= LIMIT[key][0] ? 'disabled' : ''}>−</button><output aria-label="${label} 수량">${draftSet[key]}</output><button data-key="${key}" data-delta="1" aria-label="${label} 늘리기" ${draftSet[key] >= LIMIT[key][1] ? 'disabled' : ''}>＋</button></div></div>`).join('');
}
$('generate-open').onclick = () => { draftSet = { ...store.set }; renderCounters(); showDialog('generator'); };
$('counters').onclick = e => {
  const b = e.target.closest('[data-key]'); if (!b) return;
  const key = b.dataset.key; draftSet[key] = Math.max(LIMIT[key][0], Math.min(LIMIT[key][1], draftSet[key] + Number(b.dataset.delta))); renderCounters();
};
$('generate').onclick = async () => {
  if (!await confirmAction('내 루틴을 다시 만들까요?', '직접 추가하거나 수정한 내 루틴 일정이 새 일정으로 바뀌어요. 기존 루틴은 그대로 남아요.', '다시 만들기')) return;
  const next = clone(store); next.set = { ...draftSet }; next.mine = build(next.set);
  if (persist(next)) { $('generator').close(); render(); toast('새 루틴을 만들었어요.'); }
};
$('settings-open').onclick = () => showDialog('settings');
$('export').onclick = async () => {
  const file = new File([JSON.stringify(store, null, 2)], `하얀쿡-루틴-${new Date().toISOString().slice(0, 10)}.json`, { type: 'application/json' });
  if (navigator.canShare?.({ files: [file] })) {
    try { await navigator.share({ files: [file], title: '하얀쿡 루틴 백업' }); }
    catch (error) { if (error.name !== 'AbortError') toast('백업을 공유하지 못했어요. 다시 시도해 주세요.'); }
  } else {
    const url = URL.createObjectURL(file), a = document.createElement('a'); a.href = url; a.download = file.name; a.click(); setTimeout(() => URL.revokeObjectURL(url), 30000);
    toast('백업 파일을 저장했어요.');
  }
};
$('import').onclick = () => $('backup-file').click();
$('backup-file').onchange = async e => {
  const file = e.target.files[0]; e.target.value = ''; if (!file) return;
  let next;
  try {
    if (file.size > 1000000) throw new Error('Too large');
    next = JSON.parse(await file.text()); if (!validStore(next)) throw new Error('Invalid backup');
  } catch { toast('올바른 하얀쿡 루틴 백업 파일을 선택해 주세요.'); return; }
  if (!await confirmAction('백업을 가져올까요?', '현재 내 루틴과 기존 루틴을 백업 파일의 일정으로 바꿔요.', '가져오기')) return;
  if (persist(next)) { $('settings').close(); render(); toast('백업의 일정을 가져왔어요.'); }
};

render();
if (loadError) {
  $('storage-note').textContent = '이전 저장 데이터를 읽지 못했어요. 백업이 있으면 설정에서 가져와 주세요.';
  toast('저장 데이터를 읽지 못해 기본 루틴을 표시했어요.');
}
if ('serviceWorker' in navigator && location.protocol !== 'file:') {
  navigator.serviceWorker.register('./sw.js').then(async () => {
    await navigator.serviceWorker.ready;
    $('offline-status').textContent = '오프라인 사용 준비가 끝났어요. 다음부터 인터넷 없이도 열 수 있어요.';
  }).catch(() => { $('offline-status').textContent = '오프라인 준비를 마치지 못했어요. 인터넷 연결 후 다시 열어 주세요.'; });
} else $('offline-status').textContent = '오프라인 사용은 웹 주소로 접속했을 때 준비할 수 있어요.';

// 지원하는 브라우저에서는 화면의 주간 일정을 읽는 도구를 제공한다.
if (document.modelContext?.registerTool) {
  const lifecycle = new AbortController();
  try {
    Promise.resolve(document.modelContext.registerTool({
      name: 'read_weekly_routine',
      title: '주간 루틴 읽기',
      description: '현재 표시 중인 루틴의 일정을 읽는다. 특정 요일을 지정하면 그 요일의 일정만 반환한다.',
      inputSchema: { type: 'object', properties: { day: { type: 'string', enum: DAYS } }, additionalProperties: false },
      annotations: { readOnlyHint: true, untrustedContentHint: true },
      execute(input) {
        if (!input || typeof input !== 'object' || Object.keys(input).some(key => key !== 'day') || (input.day !== undefined && !DAYS.includes(input.day))) throw new Error('올바른 요일을 지정해 주세요.');
        return { routine: view === 'mine' ? '내 루틴' : '기존 루틴', events: clone(list().filter(e => !input.day || e.day === input.day)) };
      }
    }, { signal: lifecycle.signal })).catch(() => {});
  } catch { /* 지원하지 않는 브라우저에서는 화면 조작을 그대로 사용한다. */ }
  window.addEventListener('pagehide', () => lifecycle.abort(), { once: true });
}
