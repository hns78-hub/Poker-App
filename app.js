// Constants
const BUY_IN_COST = 10.0;
const CHIP_VALUE = 0.01;

// Admin Auth Settings
const ADMIN_USER = 'admin';
const ADMIN_PASS = 'Kiaan2424!';
let isAdminLoggedIn = false;

// Supabase Configuration
const SUPABASE_URL = 'https://jhfuahzqufddcybhbuda.supabase.co';
const SUPABASE_KEY = 'eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6ImpoZnVhaHpxdWZkZGN5YmhidWRhIiwicm9sZSI6ImFub24iLCJpYXQiOjE3NzczNjQ4MjEsImV4cCI6MjA5Mjk0MDgyMX0.WIBLeDuA6vzHwCALJ1FkL5dDkA3jWlTkDOrLJa-MmGE';
const supabaseClient = supabase.createClient(SUPABASE_URL, SUPABASE_KEY);

// State
let currentParsedSession = null;
let allSessions = [];

// DOM Elements
const tabBtns = document.querySelectorAll('.nav-item[data-tab]');
const tabContents = document.querySelectorAll('.tab-content');
const parseBtn = document.getElementById('btn-parse');
const saveBtn = document.getElementById('btn-save-session');
const rawInput = document.getElementById('raw-session-input');
const hostInput = document.getElementById('host-input');
const previewSection = document.getElementById('preview-section');
const previewTbody = document.getElementById('preview-tbody');
const consistencyCheck = document.getElementById('consistency-check');
const historyContainer = document.getElementById('history-container');
const leaderboardTbody = document.getElementById('leaderboard-tbody');

// Admin Auth DOM
const btnAdminLogin = document.getElementById('btn-admin-login');
const navAdmin = document.getElementById('nav-admin');
const adminLoginModal = document.getElementById('admin-login-modal');
const adminLoginClose = document.getElementById('admin-login-close');
const adminUser = document.getElementById('admin-user');
const adminPass = document.getElementById('admin-pass');
const btnSubmitLogin = document.getElementById('btn-submit-login');
const loginError = document.getElementById('login-error');

// Admin Dashboard DOM
const adminTbody = document.getElementById('admin-tbody');
const btnWipeData = document.getElementById('btn-wipe-data');

// Modal DOM
const sessionModal = document.getElementById('session-modal');
const modalClose = document.getElementById('modal-close');
const modalTitle = document.getElementById('modal-title');
const modalHost = document.getElementById('modal-host');
const modalConsistency = document.getElementById('modal-consistency');
const modalTbody = document.getElementById('modal-tbody');

// Graph/Chart State
let charts = {};
const chartColors = [
  '#3b82f6', '#22c55e', '#ef4444', '#eab308', '#8b5cf6', '#ec4899', '#06b6d4', '#f97316'
];

// Initialize
document.addEventListener('DOMContentLoaded', () => {
  loadData();

  // Tab Switching
  tabBtns.forEach(btn => {
    btn.addEventListener('click', () => {
      tabBtns.forEach(b => b.classList.remove('active'));
      tabContents.forEach(c => c.classList.remove('active'));

      btn.classList.add('active');
      const targetId = btn.getAttribute('data-tab');
      document.getElementById(targetId).classList.add('active');

      if (targetId === 'dashboard') renderDashboard();
      if (targetId === 'admin-dashboard') renderAdmin();
      
      // Close sidebar on mobile after clicking
      if (window.innerWidth <= 768) {
        document.getElementById('sidebar').classList.remove('open');
        document.getElementById('sidebar-backdrop').classList.remove('active');
      }
    });
  });

  // Mobile Menu Toggle
  const mobileToggle = document.getElementById('mobile-menu-toggle');
  const sidebar = document.getElementById('sidebar');
  const backdrop = document.getElementById('sidebar-backdrop');
  
  if (mobileToggle) {
    mobileToggle.addEventListener('click', () => {
      sidebar.classList.toggle('open');
      backdrop.classList.toggle('active');
    });
  }

  if (backdrop) {
    backdrop.addEventListener('click', () => {
      sidebar.classList.remove('open');
      backdrop.classList.remove('active');
    });
  }

  // Action Listeners
  parseBtn.addEventListener('click', handleParse);
  saveBtn.addEventListener('click', handleSaveSession);

  // Admin Login Triggers
  btnAdminLogin.addEventListener('click', () => {
    if (isAdminLoggedIn) {
      document.querySelector('[data-tab="admin-dashboard"]').click();
    } else {
      adminLoginModal.classList.remove('hidden');
      adminUser.value = ''; adminPass.value = ''; loginError.classList.add('hidden');
    }
  });
  adminLoginClose.addEventListener('click', () => adminLoginModal.classList.add('hidden'));

  btnSubmitLogin.addEventListener('click', () => {
    if (adminUser.value === ADMIN_USER && adminPass.value === ADMIN_PASS) {
      isAdminLoggedIn = true;
      adminLoginModal.classList.add('hidden');
      btnAdminLogin.classList.add('hidden');
      navAdmin.classList.remove('hidden');
      navAdmin.click();
    } else {
      loginError.classList.remove('hidden');
    }
  });

  // Admin Wipe
  btnWipeData.addEventListener('click', () => {
    if (confirm("Are you SURE you want to wipe all session data? This cannot be undone.")) {
      localStorage.removeItem('poker_sessions');
      loadData();
      renderAdmin();
      alert("All data wiped.");
    }
  });

  // Modal Listeners
  modalClose.addEventListener('click', () => sessionModal.classList.add('hidden'));

  // Initial Data Fetch
  fetchSessions();
});

// Fetch from Supabase
async function fetchSessions() {
  const { data, error } = await supabaseClient
    .from('poker_sessions')
    .select('*')
    .order('date', { ascending: false });

  if (error) {
    console.error('Error fetching sessions:', error);
    return;
  }

  allSessions = data;
  renderHistory(allSessions);
  renderLeaderboard(allSessions);
  if (document.getElementById('dashboard').classList.contains('active')) renderDashboard();
  if (document.getElementById('admin-dashboard').classList.contains('active')) renderAdmin();
}

// Parsing Logic
function handleParse() {
  const text = rawInput.value.trim();
  const host = hostInput.value.trim() || 'Unknown';
  if (!text) return;

  const lines = text.split('\n');
  const players = [];
  const regex = /^([A-Za-z]+)\s*(?:\+(\d+))?\s*\(([\d,]+)\)/;

  let totalGains = 0; let totalLosses = 0; let totalChips = 0; let totalInvested = 0;

  for (const line of lines) {
    const cleanLine = line.trim();
    if (!cleanLine || cleanLine.toLowerCase().startsWith('total')) continue;

    const match = cleanLine.match(regex);
    if (match) {
      const name = match[1];
      const extraBuyIns = match[2] ? parseInt(match[2], 10) : 0;
      const chipsRaw = match[3].replace(/,/g, '');
      const endingChips = parseInt(chipsRaw, 10);

      const totalBuyIns = 1 + extraBuyIns;
      const cost = totalBuyIns * BUY_IN_COST;
      const endingValue = endingChips * CHIP_VALUE;
      const netReturn = endingValue - cost;

      if (netReturn > 0) totalGains += netReturn;
      else totalLosses += Math.abs(netReturn);

      totalChips += endingChips;
      totalInvested += cost;

      players.push({ name, baseBuyIn: 1, extraBuyIns, totalBuyIns, cost, endingChips, endingValue, netReturn });
    }
  }

  if (players.length === 0) {
    alert("Could not parse any valid players. Please check the format.");
    return;
  }

  const netDeficit = totalGains - totalLosses;
  const isZeroSum = Math.abs(netDeficit) < 0.001;

  currentParsedSession = {
    id: Date.now(),
    date: new Date().toISOString(),
    host,
    rawInput: text,
    players,
    summary: { totalInvested, totalEndingValue: totalChips * CHIP_VALUE, netDeficit, isZeroSum, playerCount: players.length }
  };

  renderPreview(currentParsedSession);
  previewSection.classList.remove('hidden');
}

function renderPreview(session) {
  previewTbody.innerHTML = '';
  session.players.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${p.name}</strong></td><td class="text-right">${p.totalBuyIns}</td><td class="text-right">$${p.cost.toFixed(2)}</td>
      <td class="text-right">${p.endingChips}</td><td class="text-right">$${p.endingValue.toFixed(2)}</td>
      <td class="text-right ${p.netReturn >= 0 ? 'text-success' : 'text-danger'}">${p.netReturn >= 0 ? '+' : ''}$${p.netReturn.toFixed(2)}</td>
    `;
    previewTbody.appendChild(tr);
  });

  saveBtn.disabled = false;
  if (session.summary.isZeroSum) {
    consistencyCheck.className = 'consistency-card success';
    consistencyCheck.innerHTML = `<strong>Consistency Passed:</strong> Zero-Sum perfectly verified ($${session.summary.totalInvested.toFixed(2)}).`;
  } else {
    consistencyCheck.className = 'consistency-card error';
    consistencyCheck.innerHTML = `<strong>Consistency Error:</strong> Math does not tie out! Deficit: $${session.summary.netDeficit.toFixed(2)}`;
  }
}

async function handleSaveSession() {
  if (!currentParsedSession) return;
  
  saveBtn.disabled = true;
  saveBtn.textContent = 'Saving to Cloud...';

  const { error } = await supabaseClient
    .from('poker_sessions')
    .insert([{
      date: currentParsedSession.date,
      host: currentParsedSession.host,
      raw_input: currentParsedSession.rawInput,
      players: currentParsedSession.players,
      summary: currentParsedSession.summary
    }]);

  if (error) {
    alert("Error saving to cloud: " + error.message);
    saveBtn.disabled = false;
    saveBtn.textContent = 'Save to Ledger';
    return;
  }

  currentParsedSession = null; 
  rawInput.value = ''; 
  hostInput.value = ''; 
  previewSection.classList.add('hidden');
  saveBtn.textContent = 'Save to Ledger';
  
  await fetchSessions();
  document.querySelector('[data-tab="history"]').click();
}

function renderHistory(sessions) {
  historyContainer.innerHTML = '';
  if (sessions.length === 0) {
    historyContainer.innerHTML = '<p style="color: var(--text-secondary)">No sessions recorded yet.</p>';
    return;
  }

  sessions.forEach(s => {
    const d = new Date(s.date);
    const dateStr = d.toLocaleDateString(undefined, { weekday: 'short', year: 'numeric', month: 'short', day: 'numeric', hour: '2-digit', minute: '2-digit' });
    const card = document.createElement('div');
    card.className = 'session-card';
    const winnersStr = s.players.filter(p => p.netReturn > 0).sort((a, b) => b.net - a.net).map(p => `${p.name} (+$${p.netReturn.toFixed(2)})`).join(', ');
    const hostDisplay = s.host && s.host !== 'Unknown' ? ` • Hosted by ${s.host}` : '';

    card.innerHTML = `
      <div class="session-date">${dateStr}</div>
      <div class="session-summary">${s.summary.playerCount} Players${hostDisplay} • Pot: $${s.summary.totalInvested.toFixed(2)}</div>
      <div style="font-size: 0.9rem; color: var(--text-secondary); margin-bottom: 8px;"><strong>Winners:</strong> <br>${winnersStr || 'None'}</div>
      ${!s.summary.isZeroSum ? `<div style="font-size: 0.85rem; color: var(--color-danger)">⚠️ Net Deficit: $${s.summary.netDeficit.toFixed(2)}</div>` : ''}
    `;
    card.addEventListener('click', () => openSessionModal(s));
    historyContainer.appendChild(card);
  });
}

function renderLeaderboard(sessions) {
  const playerStats = {};
  sessions.forEach(s => {
    s.players.forEach(p => {
      if (!playerStats[p.name]) playerStats[p.name] = { name: p.name, gamesPlayed: 0, totalInvested: 0, totalEndingValue: 0, totalNet: 0 };
      playerStats[p.name].gamesPlayed += 1;
      playerStats[p.name].totalInvested += p.cost;
      playerStats[p.name].totalEndingValue += p.endingValue;
      playerStats[p.name].totalNet += p.netReturn;
    });
  });

  const lb = Object.values(playerStats).sort((a, b) => b.totalNet - a.totalNet);
  leaderboardTbody.innerHTML = '';
  if (lb.length === 0) leaderboardTbody.innerHTML = `<tr><td colspan="6" style="text-align: center;">No data yet.</td></tr>`;
  else {
    lb.forEach((p, index) => {
      let rankHtml = `#${index + 1}`;
      if (index === 0) rankHtml = `<span class="medal medal-1">🥇</span>1st`;
      else if (index === 1) rankHtml = `<span class="medal medal-2">🥈</span>2nd`;
      else if (index === 2) rankHtml = `<span class="medal medal-3">🥉</span>3rd`;
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${rankHtml}</td><td><strong>${p.name}</strong></td><td class="text-right">${p.gamesPlayed}</td>
        <td class="text-right">$${p.totalInvested.toFixed(2)}</td><td class="text-right">$${p.totalEndingValue.toFixed(2)}</td>
        <td class="text-right ${p.totalNet >= 0 ? 'text-success' : 'text-danger'}">${p.totalNet >= 0 ? '+' : ''}$${p.totalNet.toFixed(2)}</td>
      `;
      leaderboardTbody.appendChild(tr);
    });
  }
}

function openSessionModal(s) {
  modalTitle.textContent = `Session on ${new Date(s.date).toLocaleDateString()}`;
  modalHost.textContent = s.host && s.host !== 'Unknown' ? `Hosted by: ${s.host}` : '';

  if (s.summary.isZeroSum) {
    modalConsistency.className = 'consistency-card success';
    modalConsistency.innerHTML = `Zero-Sum Verified ($${s.summary.totalInvested.toFixed(2)} Pot)`;
  } else {
    modalConsistency.className = 'consistency-card error';
    modalConsistency.innerHTML = `Consistency Error! Deficit: $${s.summary.netDeficit.toFixed(2)}`;
  }

  modalTbody.innerHTML = '';
  const sortedPlayers = [...s.players].sort((a, b) => b.netReturn - a.netReturn);
  sortedPlayers.forEach(p => {
    const tr = document.createElement('tr');
    tr.innerHTML = `
      <td><strong>${p.name}</strong></td>
      <td class="text-right">${p.totalBuyIns}</td>
      <td class="text-right ${p.netReturn >= 0 ? 'text-success' : 'text-danger'}">${p.netReturn >= 0 ? '+' : ''}$${p.netReturn.toFixed(2)}</td>
    `;
    modalTbody.appendChild(tr);
  });
  sessionModal.classList.remove('hidden');
}

// Generate Raw Text fallback for old sessions missing it
function generateRawText(players) {
  return players.map(p => {
    const extra = p.extraBuyIns > 0 ? ` +${p.extraBuyIns}` : '';
    return `${p.name}${extra} (${p.endingChips})`;
  }).join('\n');
}

function renderAdmin() {
  adminTbody.innerHTML = '';
  if (allSessions.length === 0) {
    adminTbody.innerHTML = '<tr><td colspan="4">No sessions</td></tr>';
    return;
  }

  allSessions.forEach(s => {
    const tr = document.createElement('tr');
    const d = new Date(s.date);
    const localDateTime = new Date(d.getTime() - (d.getTimezoneOffset() * 60000)).toISOString().slice(0, 16);

    tr.innerHTML = `
      <td><input type="datetime-local" class="text-input dt-input" data-id="${s.id}" value="${localDateTime}" style="padding: 0.25rem;"></td>
      <td>${s.host || 'Unknown'}</td>
      <td>${s.summary.playerCount} Players</td>
      <td class="text-right">
        <button class="btn btn-primary btn-edit" style="padding: 0.25rem 0.75rem; font-size: 0.8rem;" data-id="${s.id}">Edit</button>
        <button class="btn btn-danger btn-del" style="padding: 0.25rem 0.75rem; font-size: 0.8rem; margin-left: 8px;" data-id="${s.id}">Delete</button>
      </td>
    `;
    adminTbody.appendChild(tr);
  });

  // Handle Date changes
  document.querySelectorAll('.dt-input').forEach(input => {
    input.addEventListener('change', async (e) => {
      const id = parseInt(e.target.getAttribute('data-id'));
      const newDateStr = e.target.value;
      if (newDateStr) {
        const { error } = await supabaseClient
          .from('poker_sessions')
          .update({ date: new Date(newDateStr).toISOString() })
          .eq('id', id);
        
        if (error) alert("Error updating date: " + error.message);
        else fetchSessions();
      }
    });
  });

  document.querySelectorAll('.btn-del').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = parseInt(e.target.getAttribute('data-id'));
      if (confirm("Delete this session from the cloud?")) {
        const { error } = await supabaseClient.from('poker_sessions').delete().eq('id', id);
        if (error) alert("Error deleting: " + error.message);
        else fetchSessions();
      }
    });
  });

  document.querySelectorAll('.btn-edit').forEach(btn => {
    btn.addEventListener('click', async (e) => {
      const id = parseInt(e.target.getAttribute('data-id'));
      const session = allSessions.find(x => x.id === id);
      if (session) {
        const textToLoad = session.raw_input || generateRawText(session.players);
        hostInput.value = session.host && session.host !== 'Unknown' ? session.host : '';
        rawInput.value = textToLoad;

        document.querySelector('[data-tab="new-session"]').click();
        await supabaseClient.from('poker_sessions').delete().eq('id', id);
        alert("Session loaded into parser! It has been removed from the cloud temporarily. Save it again to re-upload.");
        fetchSessions();
      }
    });
  });
}

function renderDashboard() {
  if (allSessions.length === 0) return;
  const sortedSessions = [...allSessions].sort((a, b) => new Date(a.date) - new Date(b.date));
  
  // 1. Process Cumulative Data
  const players = {};
  const labels = ['Start'];
  
  // Initialize players
  sortedSessions.forEach(s => {
    s.players.forEach(p => {
      if (!players[p.name]) {
        players[p.name] = {
          label: p.name,
          data: [0],
          cumulative: 0,
          games: 0,
          totalNet: 0
        };
      }
    });
  });

  sortedSessions.forEach((s, index) => {
    labels.push(new Date(s.date).toLocaleDateString());
    
    // For every player known, update their cumulative or push their last value if they didn't play
    Object.keys(players).forEach(name => {
      const pInSession = s.players.find(p => p.name === name);
      if (pInSession) {
        players[name].cumulative += pInSession.netReturn;
        players[name].games += 1;
        players[name].totalNet += pInSession.netReturn;
      }
      players[name].data.push(players[name].cumulative);
    });
  });

  // 2. Render Winnings Over Time (Line Chart)
  renderLineChart(labels, Object.values(players));
  
  // 3. Render Performance (Bar Chart)
  renderBarChart(Object.values(players).sort((a, b) => b.totalNet - a.totalNet));

  // 4. Render Frequency (Doughnut Chart)
  renderFrequencyChart(Object.values(players).sort((a, b) => b.games - a.games));
}

function renderLineChart(labels, playerDatasets) {
  const ctx = document.getElementById('winnings-chart').getContext('2d');
  
  if (charts.winnings) charts.winnings.destroy();
  
  charts.winnings = new Chart(ctx, {
    type: 'line',
    data: {
      labels: labels,
      datasets: playerDatasets.map((p, i) => ({
        label: p.label,
        data: p.data,
        borderColor: chartColors[i % chartColors.length],
        backgroundColor: chartColors[i % chartColors.length] + '33',
        tension: 0.3,
        fill: false,
        borderWidth: 3,
        pointRadius: 4,
        pointHoverRadius: 6
      }))
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { position: 'bottom', labels: { color: '#f8fafc', font: { family: 'Inter' } } },
        tooltip: { mode: 'index', intersect: false }
      },
      scales: {
        y: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8', callback: value => '$' + value }
        },
        x: {
          grid: { display: false },
          ticks: { color: '#94a3b8' }
        }
      }
    }
  });
}

function renderBarChart(players) {
  const ctx = document.getElementById('performance-chart').getContext('2d');
  if (charts.performance) charts.performance.destroy();

  charts.performance = new Chart(ctx, {
    type: 'bar',
    data: {
      labels: players.map(p => p.label),
      datasets: [{
        label: 'Total Net ($)',
        data: players.map(p => p.totalNet),
        backgroundColor: players.map(p => p.totalNet >= 0 ? '#22c55e' : '#ef4444'),
        borderRadius: 6
      }]
    },
    options: {
      indexAxis: 'y',
      responsive: true,
      maintainAspectRatio: false,
      plugins: {
        legend: { display: false },
        tooltip: { callbacks: { label: context => `Net: $${context.parsed.x.toFixed(2)}` } }
      },
      scales: {
        x: {
          grid: { color: 'rgba(255, 255, 255, 0.05)' },
          ticks: { color: '#94a3b8', callback: value => '$' + value }
        },
        y: {
          grid: { display: false },
          ticks: { color: '#f8fafc' }
        }
      }
    }
  });
}

function renderFrequencyChart(players) {
  const ctx = document.getElementById('frequency-chart').getContext('2d');
  if (charts.frequency) charts.frequency.destroy();

  charts.frequency = new Chart(ctx, {
    type: 'doughnut',
    data: {
      labels: players.map(p => p.label),
      datasets: [{
        data: players.map(p => p.games),
        backgroundColor: chartColors,
        borderWidth: 0,
        hoverOffset: 10
      }]
    },
    options: {
      responsive: true,
      maintainAspectRatio: false,
      cutout: '60%',
      plugins: {
        legend: { position: 'right', labels: { color: '#f8fafc', padding: 20 } },
        tooltip: { callbacks: { label: context => `${context.label}: ${context.raw} games` } }
      }
    }
  });
}
