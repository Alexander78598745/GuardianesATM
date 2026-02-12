/* ================= IMPORTACIONES FIREBASE ================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, onValue, update, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

/* ================= CONFIGURACIÓN ================= */
const firebaseConfig = {
  apiKey: "AIzaSyCcS3t28TaeqvaklYS0hlUNupFNRkBN8Bo",
  authDomain: "guardianes-atm.firebaseapp.com",
  databaseURL: "https://guardianes-atm-default-rtdb.europe-west1.firebasedatabase.app",
  projectId: "guardianes-atm",
  storageBucket: "guardianes-atm.firebasestorage.app",
  messagingSenderId: "561012664887",
  appId: "1:561012664887:web:54fa7726e9dcc84ba0edb2"
};

const app = initializeApp(firebaseConfig);
const db = getDatabase(app);

/* ================= VARIABLES GLOBALES ================= */
let porteros = [];
let edps = [];
let currentUser = null; 
let roleType = ""; 
let fotoTemp = ""; 
let chartInstance = null; 
let rankingMode = "global";

const FRASES_MOTIVACIONALES = [
    "Confía en tu talento.", "Seguridad y mando.", "Portería a cero es el objetivo.", 
    "El trabajo vence al talento.", "Hoy serás un muro.", "Nunca dejes de creer."
];

// LISTA DE 12 INSIGNIAS SOLICITADA
const BADGES = [
    { name: "Primeros Pasos", limit: 30, icon: "shoe-prints" }, 
    { name: "Manos Seguras", limit: 80, icon: "hand-paper" },
    { name: "Reflejos Felinos", limit: 120, icon: "bolt" }, 
    { name: "Colocación", limit: 150, icon: "compass" },
    { name: "Mentalidad Pro", limit: 200, icon: "brain" }, 
    { name: "Espíritu Indio", limit: 250, icon: "heart" },
    { name: "Valiente 1vs1", limit: 300, icon: "shield-alt" }, 
    { name: "Rey del Área", limit: 400, icon: "crown" },
    { name: "Muro Diamante", limit: 500, icon: "gem" }, 
    { name: "Comunicador", limit: 600, icon: "bullhorn" },
    { name: "Leyenda", limit: 900, icon: "star" }, 
    { name: "Reto Superado", limit: 1000, icon: "check-circle" }
];

/* ================= UTILS & UI ================= */
function showToast(message) {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = 'toast';
    toast.innerHTML = `<i class="fas fa-check-circle"></i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.animation = 'fadeOut 0.3s forwards'; setTimeout(() => toast.remove(), 300); }, 2500);
}

function lanzarCelebracion() {
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#CB3524', '#ffffff', '#1C2C5B'] });
}

function toggleTheme() {
    const current = document.body.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
    if(chartInstance && currentUser) renderRadar(currentUser);
}

function updateThemeIcon(theme) { 
    const btn = document.getElementById('btn-theme');
    if(btn) btn.innerHTML = theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>'; 
}

/* ================= AUTH ================= */
function abrirLogin(role) { roleType = role; document.getElementById('modal-login').style.display = 'flex'; document.getElementById('modal-pass').value = ''; setTimeout(() => document.getElementById('modal-pass').focus(), 100); }
function cerrarModal() { document.getElementById('modal-login').style.display = 'none'; }
function togglePasswordVisibility() { const i = document.getElementById('modal-pass'); i.type = i.type === 'password' ? 'text' : 'password'; }

function confirmarLogin() {
    const pass = document.getElementById('modal-pass').value;
    if(!pass) return;

    if(roleType === 'admin' && pass === 'ATLETI2024') { 
        navTo('view-admin'); 
    } 
    else if(roleType === 'edp') {
        const found = edps.find(e => e.clave === pass);
        if(found) { currentUser = found; navTo('view-edp'); }
        else alert("Clave incorrecta");
    } 
    else if(roleType === 'portero') {
        const found = porteros.find(p => p.clave === pass);
        if(found) { currentUser = found; navTo('view-portero'); }
        else alert("Clave incorrecta");
    }
    cerrarModal();
}

function logout() { location.reload(); }

/* ================= NAVEGACIÓN ================= */
function navTo(viewId) {
    document.querySelectorAll('main section').forEach(s => s.style.display = 'none');
    document.getElementById(viewId).style.display = 'block';
    document.getElementById('btn-logout').style.display = 'block';
    
    // Barra navegación portero
    const navBar = document.getElementById('nav-portero');
    if(viewId === 'view-portero' || viewId === 'view-ranking') {
        if(roleType === 'portero') navBar.style.display = 'flex';
    } else {
        navBar.style.display = 'none';
    }

    if(viewId === 'view-admin') { renderAdminList(); renderEDPListAdmin(); cargarSelectEDP(); limpiarFormAdmin(); }
    refreshCurrentView();
}

function navPortero(tab) {
    document.getElementById('view-portero').style.display = tab === 'home' ? 'block' : 'none';
    document.getElementById('view-ranking').style.display = tab === 'ranking' ? 'block' : 'none';
    document.getElementById('nav-btn-home').classList.toggle('active', tab === 'home');
    document.getElementById('nav-btn-rank').classList.toggle('active', tab === 'ranking');
    if(tab === 'ranking') renderRankingList();
}

/* ================= ADMIN ================= */
function procesarImagenSegura(event) {
    const file = event.target.files[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = function(e) {
        const img = new Image();
        img.src = e.target.result;
        img.onload = function() {
            const canvas = document.createElement('canvas'); const ctx = canvas.getContext('2d');
            const maxSize = 250; 
            let width = img.width; let height = img.height;
            if (width > height) { if (width > maxSize) { height *= maxSize / width; width = maxSize; } } 
            else { if (height > maxSize) { width *= maxSize / height; height = maxSize; } }
            canvas.width = width; canvas.height = height; ctx.drawImage(img, 0, 0, width, height);
            fotoTemp = canvas.toDataURL('image/jpeg', 0.6);
            document.getElementById('fotoPreview').src = fotoTemp;
        }
    }
    reader.readAsDataURL(file);
}

function guardarPortero() {
    const idEdit = document.getElementById('reg-id').value;
    const nombre = document.getElementById('reg-nombre').value;
    const clave = document.getElementById('reg-clave').value;
    
    if(!nombre || !clave) return alert("Nombre y clave obligatorios");

    const id = idEdit ? parseInt(idEdit) : Date.now();
    const existing = porteros.find(p => p.id == id);

    const data = {
        id, nombre, clave,
        equipo: document.getElementById('reg-equipo').value,
        sede: document.getElementById('reg-sede').value,
        ano: document.getElementById('reg-ano').value,
        entrenador: document.getElementById('reg-entrenador-select').value,
        foto: fotoTemp || (existing ? existing.foto : ""),
        puntos: existing ? existing.puntos : 0,
        stats: existing ? existing.stats : { men:60, tec:60, jue:60, ret:60 },
        mensajeManual: existing ? existing.mensajeManual : ""
    };

    set(ref(db, 'porteros/' + id), data).then(() => {
        showToast("Portero guardado");
        limpiarFormAdmin();
    });
}

function limpiarFormAdmin() {
    document.querySelectorAll('#view-admin input').forEach(i => i.value = "");
    document.getElementById('reg-id').value = "";
    document.getElementById('fotoPreview').src = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNTAiIGhlaWdodD0iMTUwIiB2aWV3Qm94PSIwIDAgMTUwIDE1MCI+PHJlY3Qgd2lkdGg9IjE1MCIgaGVpZ2h0PSIxNTAiIGZpbGw9IiMzMzMiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiIGZvbnQtZmFtaWx5PSJQXSwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyMCI+Rk9UTzwvdGV4dD48L3N2Zz4=";
    fotoTemp = "";
}

function crearEDP() {
    const n = document.getElementById('edp-nombre').value;
    const c = document.getElementById('edp-clave').value;
    if(!n || !c) return;
    const id = Date.now();
    set(ref(db, 'edps/' + id), { id, nombre: n, clave: c }).then(() => {
        showToast("Entrenador creado");
        document.getElementById('edp-nombre').value = "";
        document.getElementById('edp-clave').value = "";
    });
}

function borrarPortero(id) { if(confirm("¿Eliminar?")) remove(ref(db, 'porteros/' + id)); }
function borrarEDP(id) { if(confirm("¿Eliminar?")) remove(ref(db, 'edps/' + id)); }
function editarPortero(id) {
    const p = porteros.find(x => x.id === id);
    if(!p) return;
    document.getElementById('reg-id').value = p.id;
    document.getElementById('reg-nombre').value = p.nombre;
    document.getElementById('reg-equipo').value = p.equipo;
    document.getElementById('reg-sede').value = p.sede; // Carga la sede
    document.getElementById('reg-ano').value = p.ano;
    document.getElementById('reg-entrenador-select').value = p.entrenador;
    document.getElementById('reg-clave').value = p.clave;
    if(p.foto) { document.getElementById('fotoPreview').src = p.foto; fotoTemp = p.foto; }
    window.scrollTo(0,0);
}

function renderAdminList() {
    document.getElementById('admin-lista-porteros').innerHTML = porteros.map(p => `
        <div class="ranking-card-style">
            <img src="${p.foto || 'logo.png'}" class="mini-foto-list">
            <div class="rank-info">
                <div class="rank-name">${p.nombre}</div>
                <div class="rank-team">${p.sede} - ${p.equipo}</div>
            </div>
            <div class="admin-actions-modern">
                <button class="btn-admin-action btn-edit" onclick="window.editarPortero(${p.id})"><i class="fas fa-edit"></i></button>
                <button class="btn-admin-action btn-del" onclick="window.borrarPortero(${p.id})"><i class="fas fa-trash"></i></button>
            </div>
        </div>
    `).join('');
}

function renderEDPListAdmin() {
    document.getElementById('admin-lista-edps').innerHTML = edps.map(e => `
        <div class="ranking-card-style" style="border-left:4px solid purple;">
            <div class="rank-info"><b>${e.nombre}</b> (Clave: ${e.clave})</div>
            <button class="btn-admin-action btn-del" onclick="window.borrarEDP(${e.id})"><i class="fas fa-trash"></i></button>
        </div>
    `).join('');
}
function cargarSelectEDP() { document.getElementById('reg-entrenador-select').innerHTML = '<option value="">Asignar...</option>' + edps.map(e => `<option value="${e.nombre}">${e.nombre}</option>`).join(''); }


/* ================= EDP (EVALUACIÓN) ================= */
function renderEvaluacionList() {
    const div = document.getElementById('edp-lista-porteros');
    const mis = porteros.filter(p => p.entrenador === currentUser.nombre);
    if(mis.length === 0) { div.innerHTML = "<p style='text-align:center;'>No tienes porteros asignados.</p>"; return; }
    
    div.innerHTML = mis.map(p => `
        <div class="portero-card" id="card-${p.id}">
            <div class="card-header-flex" onclick="window.toggleCard(${p.id})">
                <div class="profile-flex">
                    <img src="${p.foto || 'logo.png'}" class="mini-foto-list">
                    <div><div style="font-weight:bold;">${p.nombre}</div><div style="font-size:0.7rem;">${p.puntos} PTS</div></div>
                </div>
                <i class="fas fa-chevron-down"></i>
            </div>
            <div class="points-container">
                <div class="category-block">
                    <div class="chat-input-container">
                        <input type="text" id="feedback-input-${p.id}" class="chat-input" placeholder="Mensaje para el portero...">
                        <button class="btn-chat-send" onclick="window.guardarFeedback(${p.id})"><i class="fas fa-paper-plane"></i></button>
                    </div>
                </div>
                <div class="category-block"><div class="category-header cat-men">ACTITUD</div><div class="points-grid-modern">
                    <button class="btn-modern-score btn-men" onclick="window.sumar(${p.id}, 2, 'men', 'Puntual')"><i class="fas fa-clock"></i><span>+2</span></button>
                    <button class="btn-modern-score btn-men" onclick="window.sumar(${p.id}, 2, 'men', 'Esfuerzo')"><i class="fas fa-fire"></i><span>+2</span></button>
                </div></div>
                <div class="category-block"><div class="category-header cat-tec">TÉCNICA</div><div class="points-grid-modern">
                    <button class="btn-modern-score btn-tec" onclick="window.sumar(${p.id}, 1, 'tec', 'Blocaje')"><i class="fas fa-hand-rock"></i><span>+1</span></button>
                    <button class="btn-modern-score btn-tec" onclick="window.sumar(${p.id}, 3, 'tec', 'Paradón')"><i class="fas fa-star"></i><span>+3</span></button>
                </div></div>
                 <div class="category-block"><div class="category-header cat-jue">JUEGO</div><div class="points-grid-modern">
                    <button class="btn-modern-score btn-jue" onclick="window.sumar(${p.id}, 2, 'jue', 'Pies')"><i class="fas fa-shoe-prints"></i><span>+2</span></button>
                    <button class="btn-modern-score btn-jue" onclick="window.sumar(${p.id}, 2, 'jue', 'Mando')"><i class="fas fa-bullhorn"></i><span>+2</span></button>
                </div></div>
            </div>
        </div>
    `).join('');
}

function guardarFeedback(id) {
    const input = document.getElementById(`feedback-input-${id}`);
    const msg = input.value;
    if(!msg) return;
    
    // GUARDAR EN FIREBASE PARA QUE EL PORTERO LO VEA
    update(ref(db, 'porteros/' + id), { mensajeManual: msg })
        .then(() => {
            showToast("Mensaje enviado");
            input.value = "";
        });
}

function sumar(id, pts, statKey, accion) {
    const p = porteros.find(x => x.id === id);
    if(!p) return;
    
    let s = p.stats || { men:60, tec:60, jue:60, ret:60 };
    const oldPts = p.puntos;
    const newPts = oldPts + pts;

    // Chequeo de insignias
    BADGES.forEach(b => {
        if(oldPts < b.limit && newPts >= b.limit) {
            alert(`¡${p.nombre} ha desbloqueado: ${b.name}!`);
            lanzarCelebracion();
        }
    });

    update(ref(db, 'porteros/' + id), { 
        puntos: newPts, 
        stats: { ...s, [statKey]: s[statKey] + pts }
    }).then(() => showToast(`+${pts} ${accion}`));
}

/* ================= DASHBOARD PORTERO ================= */
function renderDashboard(id) {
    const p = porteros.find(x => x.id === id);
    if(!p) return;

    document.getElementById('dash-card-nombre').innerText = p.nombre;
    document.getElementById('dash-feedback-content').innerText = `"${p.mensajeManual || FRASES_MOTIVACIONALES[0]}"`;
    
    const imgEl = document.getElementById('card-foto');
    if(p.foto) { imgEl.src = p.foto; imgEl.style.display = 'block'; } else { imgEl.style.display = 'none'; }
    
    document.getElementById('fifa-rating').innerText = Math.min(99, 60 + Math.floor(p.puntos/30));
    document.getElementById('stat-tec').innerText = p.stats?.tec || 60;
    document.getElementById('stat-fis').innerText = p.stats?.jue || 60;
    document.getElementById('stat-men').innerText = p.stats?.men || 60;
    document.getElementById('stat-tac').innerText = p.stats?.ret || 60;
    
    document.getElementById('dash-puntos-badge').innerText = p.puntos + " PTS";
    const percent = Math.min(100, (p.puntos / 1000) * 100);
    document.getElementById('progress-fill').style.width = percent + "%";

    // RENDERIZADO DEL MURO DE TROFEOS CORRECTO
    const container = document.getElementById('insignias-container');
    container.innerHTML = BADGES.map(b => {
        const unlocked = p.puntos >= b.limit;
        return `
            <div class="insignia-item">
                <div class="insignia-box ${unlocked ? 'unlocked' : 'locked'}">
                    <i class="fas fa-${b.icon}"></i>
                </div>
                <div class="insignia-name">${b.name}</div>
            </div>
        `;
    }).join('');

    renderRadar(p);
}

function renderRadar(p) {
    const ctx = document.getElementById('adnChart');
    if(chartInstance) chartInstance.destroy();
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    chartInstance = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Actitud', 'Técnica', 'Juego', 'Retos'],
            datasets: [{
                label: 'ADN',
                data: [p.stats?.men||60, p.stats?.tec||60, p.stats?.jue||60, p.stats?.ret||60],
                backgroundColor: 'rgba(203, 53, 36, 0.4)', borderColor: '#CB3524', borderWidth: 2, pointBackgroundColor: '#fff'
            }]
        },
        options: { scales: { r: { min: 0, max: 100, ticks:{display:false}, grid:{color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)'} } }, plugins: { legend: { display: false } } }
    });
}

/* ================= RANKING ================= */
function toggleRanking(mode) {
    rankingMode = mode;
    // Actualizar botones visualmente
    document.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
    if(mode === 'global') document.getElementById('rank-global').classList.add('active');
    else if(mode === 'CD Alcalá') document.getElementById('rank-alcala').classList.add('active');
    else if(mode === 'Cotorruelo') document.getElementById('rank-cotorruelo').classList.add('active');
    
    renderRankingList();
}

function renderRankingList() {
    const container = document.getElementById('ranking-list-container');
    const smart = document.getElementById('smart-rankings');
    let lista = [...porteros];
    
    // FILTRO DE SEDES CORREGIDO
    if(rankingMode !== 'global') {
        lista = lista.filter(p => p.sede === rankingMode);
    }
    
    lista.sort((a,b) => b.puntos - a.puntos);

    // Smart data (mejor de la lista filtrada)
    const bestMen = [...lista].sort((a,b) => (b.stats?.men||0) - (a.stats?.men||0))[0];
    const bestTec = [...lista].sort((a,b) => (b.stats?.tec||0) - (a.stats?.tec||0))[0];
    smart.innerHTML = `<div class="smart-card"><span class="smart-icon">🧠</span><span class="smart-title">Actitud</span><span class="smart-winner">${bestMen ? bestMen.nombre : '-'}</span></div><div class="smart-card"><span class="smart-icon">🧤</span><span class="smart-title">Técnica</span><span class="smart-winner">${bestTec ? bestTec.nombre : '-'}</span></div>`;

    container.innerHTML = lista.map((p, i) => `
        <div class="ranking-card-style ${i<3 ? 'rank-'+(i+1) : ''}" style="${currentUser && p.id === currentUser.id ? 'border-color:var(--atm-red);' : ''}">
            <div class="rank-pos">${i+1}</div>
            <img src="${p.foto || 'logo.png'}" class="mini-foto-list">
            <div class="rank-info">
                <div class="rank-name">${p.nombre}</div>
                <div class="rank-team">${p.sede}</div>
            </div>
            <div class="rank-score">${p.puntos}</div>
        </div>
    `).join('');
}

function refreshCurrentView() {
    const vAdmin = document.getElementById('view-admin');
    const vEdp = document.getElementById('view-edp');
    const vPort = document.getElementById('view-portero');
    const vRank = document.getElementById('view-ranking');

    if(vAdmin.style.display === 'block') { renderAdminList(); renderEDPListAdmin(); }
    if(vEdp.style.display === 'block' && currentUser) { renderEvaluacionList(); }
    if(vPort.style.display === 'block' && currentUser) { renderDashboard(currentUser.id); }
    if(vRank.style.display === 'block') { renderRankingList(); }
}

/* ================= INICIALIZACIÓN ================= */
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);

    // Listeners de Firebase
    onValue(ref(db, 'porteros'), (snap) => {
        const val = snap.val();
        porteros = val ? Object.values(val) : [];
        refreshCurrentView();
    });
    onValue(ref(db, 'edps'), (snap) => {
        const val = snap.val();
        edps = val ? Object.values(val) : [];
        refreshCurrentView();
    });
});

/* ================= EXPOSICIÓN GLOBAL (NECESARIO PARA MODULOS) ================= */
window.abrirLogin = abrirLogin;
window.cerrarModal = cerrarModal;
window.confirmarLogin = confirmarLogin;
window.logout = logout;
window.toggleTheme = toggleTheme;
window.navPortero = navPortero;
window.toggleRanking = toggleRanking;
window.procesarImagenSegura = procesarImagenSegura;
window.guardarPortero = guardarPortero;
window.limpiarFormAdmin = limpiarFormAdmin;
window.crearEDP = crearEDP;
window.borrarPortero = borrarPortero;
window.borrarEDP = borrarEDP;
window.editarPortero = editarPortero;
window.toggleCard = (id) => document.getElementById(`card-${id}`).classList.toggle('expanded');
window.sumar = sumar;
window.guardarFeedback = guardarFeedback;
window.togglePasswordVisibility = togglePasswordVisibility;