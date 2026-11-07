/* =========================================================
   RSU School Event Registration System — client-side logic
   Handles: index.html (student SPA) and admin.html (admin)
   ========================================================= */
const $  = (s) => document.querySelector(s);
const $$ = (s) => document.querySelectorAll(s);

const getToken = () => localStorage.getItem('rsu_token');
const getUser  = () => JSON.parse(localStorage.getItem('rsu_user') || 'null');

async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (getToken()) headers.Authorization = `Bearer ${getToken()}`;
  const res = await fetch(path, { ...options, headers });
  const data = await res.json().catch(() => ({}));
  if (!res.ok) throw new Error(data.message || 'Request failed. Please try again.');
  return data;
}

function toast(msg, isError = false) {
  const t = $('#toast');
  if (!t) return;
  t.textContent = msg;
  t.className = 'toast show' + (isError ? ' error' : '');
  setTimeout(() => t.classList.remove('show'), 3000);
}

const fmtDate = (d) =>
  new Date(d).toLocaleDateString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });

/* =========================================================
   STUDENT APP (index.html)
   ========================================================= */
const routes          = ['home', 'login', 'dashboard', 'my-registrations', 'events', 'event'];
const protectedRoutes = ['dashboard', 'my-registrations', 'events', 'event'];

async function router() {
  const hash = location.hash.slice(1) || 'home';
  const [route, param] = hash.split('/');
  const current = routes.includes(route) ? route : 'home';

  if (protectedRoutes.includes(current) && !getToken()) { location.hash = '#login'; return; }
  if (current === 'login' && getToken()) { location.hash = '#dashboard'; return; }

  const isApp = protectedRoutes.includes(current);
  $('#appShell').style.display = isApp ? 'flex' : 'none';
  $('#appShell').classList.toggle('active-flex', isApp);
  $('#publicHeader').style.display = isApp ? 'none' : 'block';

  $$('.view').forEach((v) => v.classList.remove('active'));
  $('#view-' + current).classList.add('active');
  $$('#publicHeader [data-nav]').forEach((a) =>
    a.classList.toggle('active', a.dataset.nav === current)
  );
  $$('.side-nav a[data-side]').forEach((a) =>
    a.classList.toggle('active', a.dataset.side === current)
  );

  if (current === 'dashboard')        await renderDashboard();
  if (current === 'events')           await renderEvents();
  if (current === 'event')            await renderEventDetails(param);
  if (current === 'my-registrations') await renderMyRegistrations();
}

function eventRowHTML(e, actionHTML) {
  return `
    <div class="event-row">
      <div class="thumb">🖼️</div>
      <div class="event-row-info">
        <strong>${e.name}</strong>
        <small>📅 ${fmtDate(e.date)} &nbsp;|&nbsp; 📍 ${e.venue}</small>
      </div>
      ${actionHTML}
    </div>`;
}

async function renderDashboard() {
  const u = getUser();
  $('#welcomeTitle').textContent = `Welcome, ${u ? u.fullName.split(' ')[0] : 'Student'}!`;
  try {
    const [events, regs] = await Promise.all([
      api('/api/events'),
      api('/api/registrations/mine')
    ]);
    $('#statEvents').textContent = events.length;
    $('#statRegs').textContent   = regs.length;
    $('#dashEvents').innerHTML = events.slice(0, 3).map((e) =>
      eventRowHTML(e, `<a class="btn btn-primary btn-sm" href="#event/${e._id}">Register Now</a>`)
    ).join('') || '<p class="muted">No upcoming events.</p>';
  } catch (err) { toast(err.message, true); }
}

let allEvents = [];
async function renderEvents() {
  try {
    allEvents = await api('/api/events');
    drawEventGrid(allEvents);
    const search = $('#eventSearch');
    search.value = '';
    search.oninput = (ev) => {
      const q = ev.target.value.toLowerCase();
      drawEventGrid(allEvents.filter((e) =>
        e.name.toLowerCase().includes(q) || e.venue.toLowerCase().includes(q)
      ));
    };
  } catch (err) { toast(err.message, true); }
}

function drawEventGrid(list) {
  $('#eventGrid').innerHTML = list.map((e) => `
    <div class="event-card">
      <div class="thumb big">🖼️</div>
      <br />
      <strong>${e.name}</strong>
      <small>📅 ${fmtDate(e.date)}</small>
      <a class="btn btn-primary btn-sm" href="#event/${e._id}">View Details</a>
    </div>`).join('') || '<p class="muted">No events found.</p>';
}

async function renderEventDetails(id) {
  if (!id) { location.hash = '#events'; return; }
  try {
    const e = await api('/api/events/' + id);
    $('#eventDetail').innerHTML = `
      <div class="detail-top">
        <div class="thumb huge">🖼️</div>
        <div>
          <h2>${e.name}</h2>
          <p>📅 ${fmtDate(e.date)}</p>
          <p>📍 ${e.venue}</p>
          <p class="muted">${e.description || ''}</p>
          <p class="muted"><strong>${e.registrationCount}</strong> student(s) registered</p>
        </div>
      </div>
      <h3>Registration Form</h3>
      <button class="btn btn-primary btn-block" id="registerBtn" ${e.registered ? 'disabled' : ''}>
        ${e.registered ? '✓ You are registered for this event' : 'Register for this Event'}
      </button>`;
    $('#registerBtn').onclick = async () => {
      try {
        await api('/api/registrations', {
          method: 'POST',
          body: JSON.stringify({ eventId: id })
        });
        toast('Registration successful!');
        renderEventDetails(id);
      } catch (err) { toast(err.message, true); }
    };
  } catch (err) {
    toast(err.message, true);
    location.hash = '#events';
  }
}

async function renderMyRegistrations() {
  try {
    const regs = await api('/api/registrations/mine');
    $('#myRegsList').innerHTML = regs.map((r) =>
      eventRowHTML(r.event, `<button class="btn btn-danger btn-sm" onclick="cancelRegistration('${r._id}')">Cancel</button>`)
    ).join('') || '<p class="muted">You have not registered for any events yet. Browse events to get started!</p>';
  } catch (err) { toast(err.message, true); }
}

async function cancelRegistration(id) {
  if (!confirm('Cancel this registration?')) return;
  try {
    await api('/api/registrations/' + id, { method: 'DELETE' });
    toast('Registration cancelled');
    renderMyRegistrations();
  } catch (err) { toast(err.message, true); }
}

function initStudentApp() {
  $('#headerLoginBtn').addEventListener('click', () => {
    location.hash = getToken() ? '#dashboard' : '#login';
  });

  $('#logoutLink').addEventListener('click', (ev) => {
    ev.preventDefault();
    localStorage.removeItem('rsu_token');
    localStorage.removeItem('rsu_user');
    location.hash = '#home';
  });

  $('#loginForm').addEventListener('submit', async (ev) => {
    ev.preventDefault();
    try {
      const data = await api('/api/auth/login', {
        method: 'POST',
        body: JSON.stringify({
          identifier: $('#loginIdentifier').value.trim(),
          password:   $('#loginPassword').value
        })
      });
      localStorage.setItem('rsu_token', data.token);
      localStorage.setItem('rsu_user', JSON.stringify(data.user));
      if (data.user.role === 'admin') { location.href = 'admin.html'; return; }
      toast(`Welcome back, ${data.user.fullName.split(' ')[0]}!`);
      location.hash = '#dashboard';
    } catch (err) {
      $('#loginAlert').innerHTML = `<div class="alert error">${err.message}</div>`;
    }
  });

  window.addEventListener('hashchange', router);
  router();
}

/* =========================================================
   ADMIN APP (admin.html)
   ========================================================= */
let adminEvents = [];

async function initAdmin() {
  if (!getToken() || !getUser() || getUser().role !== 'admin') {
    localStorage.clear();
    location.href = 'index.html#login';
    return;
  }
  $$('.side-nav a[data-admin]').forEach((a) =>
    a.addEventListener('click', (ev) => { ev.preventDefault(); showAdminView(a.dataset.admin); })
  );
  $('#logoutLink').addEventListener('click', (ev) => {
    ev.preventDefault();
    localStorage.clear();
    location.href = 'index.html#home';
  });
  $('#addEventBtn').addEventListener('click', () => openEventModal());
  $('#modalCancel').addEventListener('click', () => $('#eventModal').classList.remove('open'));
  $('#eventForm').addEventListener('submit', saveEvent);
  showAdminView('dashboard');
}

function showAdminView(v) {
  $$('#adminApp .view').forEach((x) => x.classList.remove('active'));
  $('#admin-' + v).classList.add('active');
  $$('.side-nav a[data-admin]').forEach((a) =>
    a.classList.toggle('active', a.dataset.admin === v)
  );
  if (v === 'dashboard') loadAdminDash();
  if (v === 'events')    loadEventsTable();
  if (v === 'students')  loadStudentsTable();
  if (v === 'reports')   loadReports();
}

async function loadAdminDash() {
  try {
    const [events, regs] = await Promise.all([
      api('/api/events'),
      api('/api/registrations')
    ]);
    const uniqueStudents = new Set(regs.map((r) => r.student && r.student._id)).size;
    $('#aStatEvents').textContent   = events.length;
    $('#aStatRegs').textContent     = regs.length;
    $('#aStatStudents').textContent = uniqueStudents;
  } catch (err) { toast(err.message, true); }
}

async function loadEventsTable() {
  try {
    adminEvents = await api('/api/events');
    $('#eventsTable').innerHTML = adminEvents.map((e, i) => `
      <tr>
        <td>${i + 1}</td>
        <td>${e.name}</td>
        <td>${fmtDate(e.date)}</td>
        <td>${e.venue}</td>
        <td><span class="badge ${e.status === 'Active' ? 'green' : ''}">${e.status}</span></td>
        <td>
          <div class="row-actions">
            <button class="btn btn-primary btn-sm" onclick="editEvent('${e._id}')">Edit</button>
            <button class="btn btn-danger btn-sm" onclick="deleteEvent('${e._id}')">Delete</button>
          </div>
        </td>
      </tr>`).join('');
  } catch (err) { toast(err.message, true); }
}

async function loadStudentsTable() {
  try {
    const regs = await api('/api/registrations');
    $('#studentsTable').innerHTML = regs.map((r) => `
      <tr>
        <td>${r.student ? r.student.fullName : '—'}</td>
        <td>${r.student ? r.student.studentId : '—'}</td>
        <td>${r.student ? r.student.email : '—'}</td>
        <td>${r.event ? r.event.name : '—'}</td>
        <td>${fmtDate(r.registeredAt || r.createdAt)}</td>
      </tr>`).join('') || '<tr><td colspan="5" class="muted">No registrations yet.</td></tr>';
  } catch (err) { toast(err.message, true); }
}

async function loadReports() {
  try {
    const [events, regs] = await Promise.all([
      api('/api/events'),
      api('/api/registrations')
    ]);
    const rows = events.map((e) => {
      const count = regs.filter((r) => r.event && r.event._id === e._id).length;
      return `
        <div class="event-row">
          <div class="event-row-info">
            <strong>${e.name}</strong>
            <small>📅 ${fmtDate(e.date)} &nbsp;|&nbsp; 📍 ${e.venue}</small>
          </div>
          <span class="badge green">${count} registered</span>
        </div>`;
    }).join('');
    $('#reportsBody').innerHTML = `
      <div class="event-list">
        <div class="event-row">
          <div class="event-row-info"><strong>Total events:</strong> ${events.length} &nbsp;·&nbsp; <strong>Total registrations:</strong> ${regs.length}</div>
        </div>
        ${rows}
      </div>`;
  } catch (err) { toast(err.message, true); }
}

function openEventModal(event = null) {
  $('#modalTitle').textContent = event ? 'Edit Event' : 'Add Event';
  $('#evId').value     = event ? event._id : '';
  $('#evName').value   = event ? event.name : '';
  $('#evDate').value   = event ? new Date(event.date).toISOString().slice(0, 10) : '';
  $('#evVenue').value  = event ? event.venue : '';
  $('#evDesc').value   = event ? event.description || '' : '';
  $('#evStatus').value = event ? event.status : 'Active';
  $('#eventModal').classList.add('open');
}

function editEvent(id) {
  const event = adminEvents.find((e) => e._id === id);
  if (event) openEventModal(event);
}

async function deleteEvent(id) {
  if (!confirm('Delete this event? All registrations for it will also be removed.')) return;
  try {
    await api('/api/events/' + id, { method: 'DELETE' });
    toast('Event deleted');
    loadEventsTable();
  } catch (err) { toast(err.message, true); }
}

async function saveEvent(ev) {
  ev.preventDefault();
  const id = $('#evId').value;
  const body = JSON.stringify({
    name: $('#evName').value.trim(),
    date: $('#evDate').value,
    venue: $('#evVenue').value.trim(),
    description: $('#evDesc').value.trim(),
    status: $('#evStatus').value
  });
  try {
    if (id) await api('/api/events/' + id, { method: 'PUT', body });
    else    await api('/api/events',       { method: 'POST', body });
    $('#eventModal').classList.remove('open');
    toast(id ? 'Event updated' : 'Event added');
    loadEventsTable();
  } catch (err) { toast(err.message, true); }
}

/* =========================================================
   BOOT
   ========================================================= */
if (document.getElementById('adminApp')) {
  initAdmin();
} else {
  initStudentApp();
}
