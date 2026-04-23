/* ── STATE ── */
const S = {
  mode: 'float',
  hideCompleted: false,
  filterGroup: 'all',
  finderLayout: 'grouped',
  suggestVisible: true,
  editingId: null,
  groups: [],
  notes: []
};
let nextId = 1;

/* ── UNDO STACK ── */
const undoStack = [];
const MAX_UNDO = 50;

function snapshot(label) {
  // Deep-clone the parts of state that mutations touch
  undoStack.push({
    label,
    notes: JSON.parse(JSON.stringify(S.notes)),
    groups: [...S.groups],
    nextId
  });
  if (undoStack.length > MAX_UNDO) undoStack.shift();
}

function undo() {
  if (!undoStack.length) { toast('Nothing to undo'); return; }
  const prev = undoStack.pop();
  S.notes = prev.notes;
  S.groups = prev.groups;
  nextId = prev.nextId;
  // Re-render whichever view is active
  if (S.mode === 'float') renderFloat(); else renderFinder();
  toast(`Undo: ${prev.label}`);
}

function daysAgo(d) { return Date.now() - d * 86400000; }
function ageText(ts) {
  const d = Math.floor((Date.now() - ts) / 86400000);
  if (d < 1) return 'today';
  if (d < 30) return d + 'd old';
  if (d < 60) return '1 mo old';
  return Math.floor(d/30) + ' mo old';
}
function isOld(ts) { return (Date.now() - ts) > 150 * 86400000; }

/* ── TOAST ── */
function toast(msg) {
  const el = document.getElementById('toast');
  el.textContent = msg;
  el.classList.add('show');
  clearTimeout(toast._t);
  toast._t = setTimeout(() => el.classList.remove('show'), 2000);
}

/* ─────────────────────────────── FLOAT VIEW ─── */
let drag = null, dragOff = {x:0,y:0}, lastDragMoved = false;
let activeGroupMenu = null; // currently open group name

function closeGroupMenu() {
  activeGroupMenu = null;
  document.querySelectorAll('.group-menu-popup').forEach(el => el.remove());
}

function renderFloat() {
  const canvas = document.getElementById('floatCanvas');
  canvas.innerHTML = '';

  // Group backgrounds — draggable, with three-dot menu
  const byGroup = {};
  S.notes.filter(n => n.grouped && !n.archived).forEach(n => {
    (byGroup[n.group] = byGroup[n.group]||[]).push(n);
  });
  Object.entries(byGroup).forEach(([g, notes]) => {
    if (notes.length < 2) return;
    let x0=Infinity, y0=Infinity, x1=-Infinity, y1=-Infinity;
    notes.forEach(n => {
      x0 = Math.min(x0, n.x-14); y0 = Math.min(y0, n.y-14);
      x1 = Math.max(x1, n.x+n.w+14); y1 = Math.max(y1, n.y+n.h+14);
    });

    // Reserve 22px at the top of the bubble for the group label
    const LABEL_H = 22;
    const bg = div('group-bubble');
    bg.dataset.group = g;
    // Expand bubble upward by LABEL_H so label sits above the cards
    css(bg, {
      left: x0+'px',
      top: (y0 - LABEL_H)+'px',
      width: (x1-x0)+'px',
      height: (y1-y0+LABEL_H)+'px',
      pointerEvents: 'auto',
      cursor: 'grab'
    });

    // label sits at the top of the bubble, above the cards
    const lbl = div('group-bubble-label');
    lbl.textContent = g;
    bg.appendChild(lbl);

    // three-dot menu button (visible on hover)
    const menuBtn = div('group-menu-btn');
    menuBtn.innerHTML = '&#8942;'; // vertical ellipsis
    menuBtn.title = 'Group options';
    bg.appendChild(menuBtn);

    menuBtn.addEventListener('click', e => {
      e.stopPropagation();
      if (activeGroupMenu === g) { closeGroupMenu(); return; }
      closeGroupMenu();
      activeGroupMenu = g;

      const popup = div('group-menu-popup');
      const rect = menuBtn.getBoundingClientRect();
      const canvasRect = canvas.getBoundingClientRect();
      css(popup, {
        left: (rect.left - canvasRect.left) + 'px',
        top:  (rect.bottom - canvasRect.top + 4) + 'px'
      });

      const groupNotes = S.notes.filter(n => n.group === g && !n.archived);
      const oldCount = groupNotes.filter(n => isOld(n.created)).length;

      popup.innerHTML = `
        <div class="gm-item" id="gm-archive">
          Archive group
          ${oldCount ? `<span class="gm-badge">${oldCount} old</span>` : ''}
        </div>
        <div class="gm-item" id="gm-ungroup">Ungroup</div>
      `;
      canvas.appendChild(popup);

      document.getElementById('gm-archive').onclick = e => {
        e.stopPropagation();
        snapshot('archive group');
        groupNotes.forEach(n => { n.archived = true; });
        closeGroupMenu();
        renderFloat();
        toast(`"${g}" archived`);
      };
      document.getElementById('gm-ungroup').onclick = e => {
        e.stopPropagation();
        snapshot('ungroup');
        groupNotes.forEach(n => { n.grouped = false; });
        closeGroupMenu();
        renderFloat();
        toast(`"${g}" ungrouped`);
      };
    });

    // drag the whole group
    bg.addEventListener('mousedown', e => {
      if (e.target === menuBtn || e.target.closest('.group-menu-popup')) return;
      closeGroupMenu();
      const groupMembers = S.notes.filter(n => n.group === g && n.grouped && !n.archived);
      const startX = e.clientX, startY = e.clientY;
      const startPositions = groupMembers.map(n => ({ n, x: n.x, y: n.y }));
      bg.style.cursor = 'grabbing';
      let hasMoved = false;
      e.preventDefault();
      e.stopPropagation();

      function onMove(ev) {
        if (!hasMoved) { snapshot('move group'); hasMoved = true; }
        const dx = ev.clientX - startX, dy = ev.clientY - startY;
        startPositions.forEach(({ n, x, y }) => { n.x = x + dx; n.y = y + dy; });
        renderFloat();
      }
      function onUp() {
        document.removeEventListener('mousemove', onMove);
        document.removeEventListener('mouseup', onUp);
      }
      document.addEventListener('mousemove', onMove);
      document.addEventListener('mouseup', onUp);
    });

    canvas.appendChild(bg);
  });

  // Suggestion ring for ungrouped notes
  const ungrouped = S.notes.filter(n => !n.grouped && !n.archived);
  if (S.suggestVisible && ungrouped.length >= 2) {
    const sample = ungrouped.slice(0,4);
    let x0=Infinity, y0=Infinity, x1=-Infinity, y1=-Infinity;
    sample.forEach(n => {
      x0 = Math.min(x0, n.x-22); y0 = Math.min(y0, n.y-22);
      x1 = Math.max(x1, n.x+n.w+22); y1 = Math.max(y1, n.y+n.h+22);
    });
    const cx = (x0+x1)/2, cy = (y0+y1)/2;
    const r = Math.max(x1-x0, y1-y0)/2 + 18;
    const ring = div('suggest-ring');
    css(ring, { left:(cx-r)+'px', top:(cy-r)+'px', width:(r*2)+'px', height:(r*2)+'px' });
    canvas.appendChild(ring);
    const acts = div('ring-actions');
    css(acts, { left:(cx+r-22)+'px', top:(cy-r+4)+'px' });
    acts.innerHTML = `<div class="ring-act confirm" id="rAccept">✓</div><div class="ring-act dismiss" id="rIgnore">✕</div>`;
    canvas.appendChild(acts);
    document.getElementById('rAccept').onclick = () => {
      S.suggestVisible = false;
      openGroupNameModal(sample);
    };
    document.getElementById('rIgnore').onclick = () => {
      S.suggestVisible = false; renderFloat(); toast('Suggestion dismissed');
    };
  }

  // Note cards — rendered on top of group bubbles
  S.notes.filter(n => !n.archived).forEach(n => {
    const card = div('note-card'
  + (n.grouped ? ' grouped' : '')
  + (n.todo ? ' todo' : ''));
    card.dataset.id = n.id;
    css(card, { left:n.x+'px', top:n.y+'px', width:n.w+'px', height:n.h+'px' });
    card.innerHTML = `
      <div class="note-inner">
        <div class="note-title">${n.title}</div>
        <div class="note-age">${ageText(n.created)}</div>
        <div class="note-date"></div>
      </div>
      <div class="note-actions">
        <div class="nact edit-nact" title="Edit">✎</div>
      </div>
    `;
    card.querySelector('.edit-nact').addEventListener('click', e => { e.stopPropagation(); openEditor(n.id); });
    
    // Populate note-date if the note has date information
    if (n.day && n.month && n.year) {
      const noteDateEl = card.querySelector('.note-date');
      noteDateEl.textContent = formatDateDisplay([n.day, n.month, n.year]);
    }
    
    card.addEventListener('click', e => { 
      if (!e.target.classList.contains('nact') && !lastDragMoved) openViewer(n.id); 
    });
    card.addEventListener('mousedown', onMouseDown);
    canvas.appendChild(card);
  });

  setupLasso(canvas);
}

function onMouseDown(e) {
  if (e.target.classList.contains('nact')) return;
  closeGroupMenu();
  const card = e.currentTarget;
  const id = +card.dataset.id;
  const note = S.notes.find(n => n.id === id);
  if (!note) return;
  drag = { note, card, hasMoved: false };
  dragOff = { x: e.clientX - note.x, y: e.clientY - note.y };
  card.classList.add('dragging');
  e.preventDefault();
  e.stopPropagation(); // prevent group bubble from also receiving this
}
document.addEventListener('mousemove', e => {
  if (!drag) return;
  if (!drag.hasMoved) { snapshot('move note'); drag.hasMoved = true; lastDragMoved = true; }
  drag.note.x = e.clientX - dragOff.x;
  drag.note.y = e.clientY - dragOff.y;
  drag.card.style.left = drag.note.x + 'px';
  drag.card.style.top  = drag.note.y + 'px';
});
document.addEventListener('mouseup', () => {
  if (drag) { drag.card.classList.remove('dragging'); }
  if (drag && !drag.hasMoved) { lastDragMoved = false; }
  drag = null;
});

/* ─────────────────────────────── LASSO SELECT ─── */
let lassoActive = false;

function setupLasso(canvas) {
  canvas.addEventListener('mousedown', e => {
    // Only trigger on bare canvas — not on cards or group bubbles
    if (e.target !== canvas) return;
    if (e.button !== 0) return;
    closeGroupMenu();

    const canvasRect = canvas.getBoundingClientRect();
    const startX = e.clientX - canvasRect.left;
    const startY = e.clientY - canvasRect.top;

    // Create lasso rect element
    const lasso = div('lasso-rect');
    css(lasso, { left: startX+'px', top: startY+'px', width: '0px', height: '0px' });
    canvas.appendChild(lasso);
    lassoActive = true;

    // Highlight notes as they enter the lasso
    function getRect(x1, y1, x2, y2) {
      return {
        left: Math.min(x1,x2), top: Math.min(y1,y2),
        right: Math.max(x1,x2), bottom: Math.max(y1,y2)
      };
    }

    function rectsOverlap(a, b) {
      return a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
    }

    function onMove(ev) {
      const curX = ev.clientX - canvasRect.left;
      const curY = ev.clientY - canvasRect.top;
      const l = Math.min(startX, curX), t = Math.min(startY, curY);
      const w = Math.abs(curX - startX), h = Math.abs(curY - startY);
      css(lasso, { left:l+'px', top:t+'px', width:w+'px', height:h+'px' });

      const lassoR = getRect(startX, startY, curX, curY);
      // Highlight cards within lasso
      canvas.querySelectorAll('.note-card').forEach(card => {
        const n = S.notes.find(n => n.id === +card.dataset.id);
        if (!n) return;
        const noteR = { left: n.x, top: n.y, right: n.x + n.w, bottom: n.y + n.h };
        card.classList.toggle('lasso-selected', rectsOverlap(lassoR, noteR));
      });
    }

    function onUp(ev) {
      document.removeEventListener('mousemove', onMove);
      document.removeEventListener('mouseup', onUp);
      lasso.remove();
      lassoActive = false;

      const curX = ev.clientX - canvasRect.left;
      const curY = ev.clientY - canvasRect.top;
      const lassoR = getRect(startX, startY, curX, curY);

      // Too small a drag = just a click, ignore
      if (Math.abs(curX - startX) < 8 && Math.abs(curY - startY) < 8) return;

      const selected = S.notes.filter(n => {
        if (n.archived) return false;
        const noteR = { left: n.x, top: n.y, right: n.x + n.w, bottom: n.y + n.h };
        return rectsOverlap(lassoR, noteR);
      });

      if (selected.length < 2) {
        renderFloat();
        return;
      }

      // Prompt for group name
      openGroupNameModal(selected);
    }

    document.addEventListener('mousemove', onMove);
    document.addEventListener('mouseup', onUp);
    e.preventDefault();
  });
}

function arrangeGroup(notes) {
  // Tile notes in a grid starting from the topmost-leftmost note's position
  if (!notes.length) return;
  const GAP = 12;
  const COLS = Math.ceil(Math.sqrt(notes.length));
  // Find the anchor position (top-left of the group's current bounding box)
  let anchorX = Math.min(...notes.map(n => n.x));
  let anchorY = Math.min(...notes.map(n => n.y));
  // Leave room for the group label above
  anchorY += 30;
  notes.forEach((n, i) => {
    const col = i % COLS;
    const row = Math.floor(i / COLS);
    n.x = anchorX + col * (n.w + GAP);
    n.y = anchorY + row * (n.h + GAP);
  });
}

function openGroupNameModal(selectedNotes) {
  document.querySelectorAll('.group-name-modal').forEach(el => el.remove());

  const modal = div('group-name-modal');
  modal.innerHTML = `
    <div class="gnm-box">
      <div class="gnm-title">Name this group</div>
      <div class="gnm-count">${selectedNotes.length} notes selected</div>
      <input class="gnm-input" id="gnmInput" placeholder="group name…" autocomplete="off"/>
      <div class="gnm-existing" id="gnmExisting"></div>
      <div class="gnm-actions">
        <button class="gnm-cancel" id="gnmCancel">Cancel</button>
        <button class="gnm-save" id="gnmSave">Group</button>
      </div>
    </div>
  `;
  document.body.appendChild(modal);

  // Only show existing user-created groups as chips (empty on fresh start)
  const existing = document.getElementById('gnmExisting');
  S.groups.forEach(g => {
    const chip = div('gnm-chip');
    chip.textContent = g;
    chip.onclick = () => { document.getElementById('gnmInput').value = g; };
    existing.appendChild(chip);
  });

  const input = document.getElementById('gnmInput');
  input.focus();

  function doGroup() {
    const name = input.value.trim();
    if (!name) { input.style.borderColor = 'rgba(0,0,0,0.4)'; input.focus(); return; }
    snapshot('group notes');
    if (!S.groups.includes(name)) S.groups.push(name);
    selectedNotes.forEach(n => { n.group = name; n.grouped = true; });
    arrangeGroup(selectedNotes);
    modal.remove();
    renderFloat();
    toast(`Grouped into "${name}"`);
  }

  document.getElementById('gnmSave').onclick = doGroup;
  document.getElementById('gnmCancel').onclick = () => { modal.remove(); renderFloat(); };
  input.addEventListener('keydown', e => {
    if (e.key === 'Enter') doGroup();
    if (e.key === 'Escape') { modal.remove(); renderFloat(); }
  });
}

/* ─────────────────────────────── FINDER VIEW ─── */
function renderFinder() {
  const body = document.getElementById('finderBody');
  const search = document.getElementById('searchInput').value.toLowerCase();
  body.innerHTML = '';

  // Rebuild toolbar tabs
  const toolbar = document.getElementById('finderToolbar');
  toolbar.querySelectorAll('.ftab,.fdrop,.hide-btn,.toolbar-div').forEach(e => e.remove());
  const spacer = toolbar.querySelector('.toolbar-spacer');
  const searchWrap = toolbar.querySelector('.search-wrap');
  const tabs = ['all', ...S.groups];
  tabs.forEach(g => {
    const b = document.createElement('button');
    b.className = 'ftab' + (S.filterGroup === g ? ' active' : '');
    b.textContent = g;
    b.onclick = () => { S.filterGroup = g; setBreadcrumb(g); renderFinder(); };
    toolbar.insertBefore(b, spacer);
  });
  const sdrop = document.createElement('button'); sdrop.className = 'fdrop';
  sdrop.textContent = 'Date/time created ∨'; toolbar.insertBefore(sdrop, searchWrap);
  const pdrop = document.createElement('button'); pdrop.className = 'fdrop';
  pdrop.textContent = 'priority ∨'; toolbar.insertBefore(pdrop, searchWrap);
  const hbtn = document.createElement('button');
  hbtn.className = 'hide-btn' + (S.hideCompleted ? ' on' : '');
  hbtn.textContent = 'hide completed';
  hbtn.onclick = () => { S.hideCompleted = !S.hideCompleted; renderFinder(); };
  toolbar.insertBefore(hbtn, searchWrap);

  let filtered = S.notes.filter(n => !n.archived);
  if (S.filterGroup !== 'all') filtered = filtered.filter(n => n.group === S.filterGroup);
  if (search) filtered = filtered.filter(n =>
    n.title.toLowerCase().includes(search) || (n.body||'').toLowerCase().includes(search)
  );

  const wrapper = div('');
  if (S.hideCompleted) wrapper.classList.add('hide-completed-on');

  // Suggested row
  if (S.filterGroup === 'all' && !search) {
    const lbl = div('suggested-label'); lbl.textContent = 'suggested'; wrapper.appendChild(lbl);
    const row = div('suggested-row');
    [...S.notes].sort((a,b)=>b.created-a.created).slice(0,7).forEach(n => {
      const sc = div('sug-card');
      sc.textContent = n.title.length > 22 ? n.title.slice(0,22)+'…' : n.title;
      sc.onclick = () => openEditor(n.id);
      row.appendChild(sc);
    });
    wrapper.appendChild(row);

    const dv = div('finder-divider'); wrapper.appendChild(dv);

    const toggleRow = div('finder-layout-toggle');
    toggleRow.innerHTML = `
      <button class="finder-layout-btn${S.finderLayout === 'ungrouped' ? ' active' : ''}" data-layout="ungrouped">notes</button>
      <button class="finder-layout-btn${S.finderLayout === 'grouped' ? ' active' : ''}" data-layout="grouped">grouped</button>
    `;
    toggleRow.querySelectorAll('.finder-layout-btn').forEach(btn => {
      btn.addEventListener('click', () => {
        S.finderLayout = btn.dataset.layout;
        renderFinder();
      });
    });
    wrapper.appendChild(toggleRow);
  }

  // Group sections
  const byGroup = {};
  filtered.forEach(n => { (byGroup[n.group||'ungrouped'] = byGroup[n.group||'ungrouped']||[]).push(n); });
  const groupsToShow = S.finderLayout === 'ungrouped'
    ? ['notes']
    : (S.filterGroup === 'all' ? Object.keys(byGroup) : [S.filterGroup]);
  groupsToShow.forEach(g => {
    const notes = S.finderLayout === 'ungrouped' ? filtered : (byGroup[g] || []);
    if (S.finderLayout === 'ungrouped') {
      const grid = div('note-grid');
      notes.forEach(n => {
        const dueText = (n.day && n.month && n.year) ? formatDateDisplay([n.day, n.month, n.year]) : '';
        const card = div('finder-card' + (n.completed ? ' completed' : ''));
        card.innerHTML = `
          <div class="fc-age">${ageText(n.created)}</div>
          <div class="fc-title">${n.title}</div>
          ${dueText ? `<div class="fc-date">${dueText}</div>` : ''}
          <div class="fc-check">${n.completed ? '✓' : ''}</div>
        `;
        card.querySelector('.fc-check').addEventListener('click', e => {
          e.stopPropagation(); n.completed = !n.completed; renderFinder();
        });
        card.addEventListener('click', () => openViewer(n.id));
        grid.appendChild(card);
      });
      wrapper.appendChild(grid);
    } else {
      const sec = div('group-section');
      const hdr = div('group-hdr');
      hdr.textContent = g;
      hdr.onclick = () => { S.filterGroup = g; setBreadcrumb(g); renderFinder(); };
      sec.appendChild(hdr);
      const grid = div('note-grid');
      notes.forEach(n => {
        const dueText = (n.day && n.month && n.year) ? formatDateDisplay([n.day, n.month, n.year]) : '';
        const card = div('finder-card' + (n.completed ? ' completed' : ''));
        card.innerHTML = `
          <div class="fc-age">${ageText(n.created)}</div>
          <div class="fc-title">${n.title}</div>
          ${dueText ? `<div class="fc-date">${dueText}</div>` : ''}
          <div class="fc-check">${n.completed ? '✓' : ''}</div>
        `;
        card.querySelector('.fc-check').addEventListener('click', e => {
          e.stopPropagation(); n.completed = !n.completed; renderFinder();
        });
        card.addEventListener('click', () => openViewer(n.id));
        grid.appendChild(card);
      });
      sec.appendChild(grid);
      wrapper.appendChild(sec);
    }
  });

  body.appendChild(wrapper);
}

function setBreadcrumb(g) {
  const el = document.getElementById('breadcrumb');
  if (g === 'all') { el.innerHTML = ''; return; }
  el.innerHTML = `<a onclick="S.filterGroup='all';setBreadcrumb('all');renderFinder()">home</a><span class="sep">›</span><span style="font-weight:500;color:var(--text)">${g}</span>`;
}

/* ─────────────────────────────── EDITOR ─── */
/* ─────────────────────────────── VIEWER ─── */
function openViewer(id) {
  const n = S.notes.find(x => x.id === id);
  if (!n) return;

  document.getElementById('viewerTitle').textContent = n.title;
  document.getElementById('viewerMeta').textContent =
    (n.group ? n.group + ' · ' : '') + ageText(n.created);

  const body = document.getElementById('viewerBody');
  body.innerHTML = '';

  if (n.todo && Array.isArray(n.items)) {
    // Render interactive todo list (ticking updates state live)
    n.items.forEach((item, i) => {
      const row = div('viewer-todo-row');
      const cb = document.createElement('input');
      cb.type = 'checkbox';
      cb.checked = item.checked;
      cb.className = 'viewer-todo-cb';
      cb.addEventListener('change', () => {
        snapshot('check todo item');
        n.items[i].checked = cb.checked;
      });
      const lbl = document.createElement('span');
      lbl.textContent = item.text;
      lbl.className = 'viewer-todo-text' + (item.checked ? ' done' : '');
      cb.addEventListener('change', () => lbl.classList.toggle('done', cb.checked));
      row.appendChild(cb);
      row.appendChild(lbl);
      body.appendChild(row);
    });
  } else {
    // Render plain text with bullet detection
    const lines = (n.body || '').split('\n');
    lines.forEach(line => {
      const p = document.createElement('div');
      p.className = 'viewer-line';
      if (line.startsWith('- ')) {
        p.classList.add('viewer-bullet');
        p.textContent = line.slice(2);
      } else {
        p.textContent = line || '\u00a0'; // non-breaking space for empty lines
      }
      body.appendChild(p);
    });
  }

  document.getElementById('viewerEditBtn').onclick = () => {
    document.getElementById('viewerOverlay').classList.remove('open');
    openEditor(id);
  };
  document.getElementById('viewerOverlay').classList.add('open');
}

document.getElementById('viewerClose').onclick = () =>
  document.getElementById('viewerOverlay').classList.remove('open');

/* ─────────────────────────────── EDITOR ─── */
function syncTodoUI() {
  const isTodo = document.getElementById('eTodo').checked;
  document.getElementById('eBody').style.display = isTodo ? 'none' : 'block';
  document.getElementById('todoEditor').style.display = isTodo ? 'flex' : 'none';
}

function addTodoItem(text = '', checked = false) {
  const items = document.getElementById('todoItems');
  const row = div('todo-item-row');

  const cb = document.createElement('input');
  cb.type = 'checkbox';
  cb.checked = checked;
  cb.className = 'todo-item-cb';

  const inp = document.createElement('input');
  inp.type = 'text';
  inp.value = text;
  inp.className = 'todo-item-input';
  inp.placeholder = 'item…';

  // Enter on an item adds a new one below
  inp.addEventListener('keydown', e => {
    if (e.key === 'Enter') {
      e.preventDefault();
      const newRow = addTodoItem();
      newRow.querySelector('.todo-item-input').focus();
    }
    if (e.key === 'Backspace' && inp.value === '') {
      e.preventDefault();
      const prev = row.previousElementSibling;
      row.remove();
      if (prev) prev.querySelector('.todo-item-input').focus();
    }
  });

  const del = div('todo-item-del');
  del.textContent = '×';
  del.onclick = () => row.remove();

  row.appendChild(cb);
  row.appendChild(inp);
  row.appendChild(del);
  items.appendChild(row);
  return row;
}

document.getElementById('eTodo').addEventListener('change', syncTodoUI);
document.getElementById('todoAddBtn').addEventListener('click', () => {
  const row = addTodoItem();
  row.querySelector('.todo-item-input').focus();
});

function openEditor(id) {
  S.editingId = id || null;
  const n = id ? S.notes.find(x => x.id === id) : null;

  // Rebuild group options
  const sel = document.getElementById('eGroup');
  sel.innerHTML = '<option value="">no group</option>';
  S.groups.forEach(g => {
    const opt = document.createElement('option');
    opt.value = g; opt.textContent = g;
    sel.appendChild(opt);
  });

  document.getElementById('eTitle').value = n ? n.title : '';
  sel.value = n ? (n.group || '') : '';

  const isTodo = n ? !!n.todo : false;
  document.getElementById('eTodo').checked = isTodo;

  if (isTodo && n.items) {
    document.getElementById('todoItems').innerHTML = '';
    n.items.forEach(item => addTodoItem(item.text, item.checked));
  } else {
    document.getElementById('todoItems').innerHTML = '';
    document.getElementById('eBody').value = n ? (n.body || '') : '';
  }

  // Load date fields if note has date data, otherwise clear them
  if (n && n.day && n.month && n.year) {
    updateDate([n.day, n.month, n.year]);
  } else {
    updateDate([null, null, null]);
  }

  syncTodoUI();
  document.getElementById('overlay').classList.add('open');
  document.getElementById('eTitle').focus();
}

function saveNote() {
  const title = document.getElementById('eTitle').value.trim();
  if (!title) { toast('Add a title'); return; }
  const group = document.getElementById('eGroup').value;
  const isTodo = document.getElementById('eTodo').checked;
  const day = date[0] || null;
  const month = date[1] || null;
  const year = date[2] || null;

  let body = '';
  let items = [];

  if (isTodo) {
    document.getElementById('todoItems').querySelectorAll('.todo-item-row').forEach(row => {
      const text = row.querySelector('.todo-item-input').value.trim();
      const checked = row.querySelector('.todo-item-cb').checked;
      if (text) items.push({ text, checked });
    });
  } else {
    body = document.getElementById('eBody').value;
  }

  if (S.editingId) {
    snapshot('edit note');
    const n = S.notes.find(x => x.id === S.editingId);
    if (n) Object.assign(n, { title, body, items, todo: isTodo, group, day, month, year });
  } else {
    snapshot('new note');
    S.notes.push({
      id: nextId++, title, body, items, todo: isTodo, group, day, month, year,
      x: 60 + Math.random() * 300, y: 60 + Math.random() * 200,
      w: 130, h: 95, created: Date.now(), completed: false, archived: false, grouped: false
    });
  }
  document.getElementById('overlay').classList.remove('open');
  S.editingId = null;
  if (S.mode === 'float') renderFloat(); else renderFinder();
  toast('Saved');
}

/* ─────────────────────────────── MODE SWITCH ─── */
function switchMode(mode) {
  S.mode = mode;
  document.getElementById('modeLabel').textContent = mode==='float' ? 'Floating Desktop' : 'Finder Desktop';
  document.getElementById('modeDropdown').classList.remove('open');
  document.querySelectorAll('.mode-option').forEach(o => o.classList.toggle('active', o.dataset.mode===mode));
  document.getElementById('float-view').classList.toggle('active', mode==='float');
  document.getElementById('finder-view').classList.toggle('active', mode==='finder');
  const autoFmtBtn = document.getElementById('autoFmtBtn');
  if (autoFmtBtn) autoFmtBtn.style.display = mode === 'float' ? 'inline-flex' : 'none';
  document.getElementById('breadcrumb').innerHTML = '';
  S.filterGroup = 'all';
  if (mode==='float') renderFloat(); else renderFinder();
}

/* ─────────────────────────────── EVENTS ─── */
document.getElementById('modeBtn').onclick = () => {
  document.getElementById('modeDropdown').classList.toggle('open');
  document.getElementById('modeBtn').classList.toggle('open');
};
document.querySelectorAll('.mode-option').forEach(o => o.onclick = () => switchMode(o.dataset.mode));
document.getElementById('newBtn').onclick = () => openEditor(null);
document.getElementById('eSave').onclick = saveNote;
document.getElementById('eClose').onclick = () => document.getElementById('overlay').classList.remove('open');
document.getElementById('searchInput').addEventListener('input', renderFinder);
document.getElementById('autoFmtBtn').onclick = function() {
  this.classList.toggle('on');
  toast(this.classList.contains('on') ? 'Auto format on' : 'Auto format off');
};
document.getElementById('settingsBtn').onclick = () => toast('Settings coming soon');

/* ── SETUP MODAL ── */
let setupStep = 0;
const totalSteps = 4;

function updateSetupStep(step) {
  setupStep = step;
  document.querySelectorAll('.setup-step').forEach(el => {
    el.classList.toggle('active', +el.dataset.step === step);
  });
  document.querySelectorAll('.setup-step-dot').forEach(el => {
    el.classList.toggle('active', +el.dataset.step === step);
  });
  document.getElementById('setupBack').style.visibility = step === 0 ? 'hidden' : 'visible';
  document.getElementById('setupNext').textContent = step === totalSteps - 1 ? 'done' : 'next →';
}

document.getElementById('desktopAppBtn').onclick = () => {
  updateSetupStep(0);
  document.getElementById('setupOverlay').classList.add('open');
};
document.getElementById('setupClose').onclick = () =>
  document.getElementById('setupOverlay').classList.remove('open');
document.getElementById('setupNext').onclick = () => {
  if (setupStep < totalSteps - 1) updateSetupStep(setupStep + 1);
  else document.getElementById('setupOverlay').classList.remove('open');
};
document.getElementById('setupBack').onclick = () => {
  if (setupStep > 0) updateSetupStep(setupStep - 1);
};
document.querySelectorAll('.setup-step-dot').forEach(dot => {
  dot.onclick = () => updateSetupStep(+dot.dataset.step);
});

function tryOpenApp() {
  window.location = 'digsystems://open';
  setTimeout(() => {
    toast('App not found — complete setup first');
  }, 1500);
}

document.addEventListener('click', e => {
  if (!e.target.closest('.mode-wrap')) {
    document.getElementById('modeDropdown').classList.remove('open');
    document.getElementById('modeBtn').classList.remove('open');
  }
  if (!e.target.closest('.group-menu-btn') && !e.target.closest('.group-menu-popup')) {
    closeGroupMenu();
  }
});

document.addEventListener('keydown', e => {
  if (document.getElementById('archivePanel').style.display !== 'none') {
    if (e.key === 'Escape') document.getElementById('archivePanel').style.display = 'none';
    return;
  }
  if (document.getElementById('setupOverlay').classList.contains('open')) {
    if (e.key === 'Escape') document.getElementById('setupOverlay').classList.remove('open');
    return;
  }
  if (document.getElementById('viewerOverlay').classList.contains('open')) {
    if (e.key === 'Escape') document.getElementById('viewerOverlay').classList.remove('open');
    return;
  }
  if (document.getElementById('overlay').classList.contains('open')) {
    if (e.key === 'Escape') document.getElementById('overlay').classList.remove('open');
    if (e.key==='Enter') saveNote();
    return;
  }
  if ((e.metaKey||e.ctrlKey) && e.key === 'z') { e.preventDefault(); undo(); return; }
  if (e.key==='Enter' && !e.metaKey && !e.ctrlKey) { e.preventDefault(); openEditor(null); }
  if (e.key==='Tab') { e.preventDefault(); switchMode(S.mode==='float' ? 'finder' : 'float'); }
  if (e.shiftKey && e.key==='A') {
    e.preventDefault();
    openArchivePanel();
  }
});

/* ─────────────────────────────── UTILS ─── */
function div(cls) { const d = document.createElement('div'); if(cls) d.className=cls; return d; }
function css(el, styles) { Object.assign(el.style, styles); }

/* ─────────────────────────────── ARCHIVE PANEL ─── */
function openArchivePanel() {
  renderArchivePanel();
  document.getElementById('archivePanel').style.display = 'flex';
}

function renderArchivePanel() {
  const sort = document.getElementById('archiveSort').value;
  const body = document.getElementById('archiveBody');
  body.innerHTML = '';

  let archived = S.notes.filter(n => n.archived);

  if (sort === 'newest') archived.sort((a,b) => b.created - a.created);
  else if (sort === 'oldest') archived.sort((a,b) => a.created - b.created);
  else if (sort === 'az') archived.sort((a,b) => a.title.localeCompare(b.title));
  else if (sort === 'za') archived.sort((a,b) => b.title.localeCompare(a.title));

  if (!archived.length) {
    const empty = div('archive-empty');
    empty.textContent = 'No archived notes yet.';
    body.appendChild(empty);
    return;
  }

  archived.forEach(n => {
    const row = div('archive-item');
    const info = div('archive-item-info');
    const title = div('archive-item-title'); title.textContent = n.title;
    const meta = div('archive-item-meta');
    meta.textContent = (n.group ? n.group + ' · ' : '') + ageText(n.created);
    info.appendChild(title); info.appendChild(meta);

    const actions = div('archive-item-actions');

    const restoreBtn = document.createElement('button');
    restoreBtn.className = 'archive-btn';
    restoreBtn.textContent = 'Restore';
    restoreBtn.onclick = () => {
      snapshot('restore note');
      n.archived = false;
      renderArchivePanel();
      if (S.mode === 'float') renderFloat(); else renderFinder();
      toast(`"${n.title.slice(0,24)}" restored`);
    };

    const deleteBtn = document.createElement('button');
    deleteBtn.className = 'archive-btn danger';
    deleteBtn.textContent = 'Delete';
    deleteBtn.onclick = () => {
      if (!confirm(`Permanently delete "${n.title}"?`)) return;
      snapshot('delete note');
      S.notes = S.notes.filter(x => x.id !== n.id);
      renderArchivePanel();
      if (S.mode === 'float') renderFloat(); else renderFinder();
    };

    actions.appendChild(restoreBtn);
    actions.appendChild(deleteBtn);
    row.appendChild(info);
    row.appendChild(actions);
    body.appendChild(row);
  });
}

document.getElementById('archivePanelClose').onclick = () =>
  document.getElementById('archivePanel').style.display = 'none';
document.getElementById('archiveSort').addEventListener('change', renderArchivePanel);

/* ─────────────────────────────── TEXTAREA KEYBOARD ─── */
document.getElementById('eBody').addEventListener('keydown', e => {
  if ((e.shiftKey || e.metaKey) && e.key === 'Enter') {
    e.preventDefault();
    const textarea = e.target;
    const start = textarea.selectionStart;
    const end = textarea.selectionEnd;
    textarea.value = textarea.value.substring(0, start) + '\n' + textarea.value.substring(end);
    textarea.selectionStart = textarea.selectionEnd = start + 1;
  }
});

/* ─────────────────────────────── INIT ─── */
// Hide "get desktop app" button when already running inside Electron
if (window.electronAPI) {
  const btn = document.getElementById('desktopAppBtn');
  if (btn) btn.style.display = 'none';
}
renderFloat();
