/* ================= CONFIGURACIÓN FIREBASE ================= */
import { initializeApp } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-app.js";
import { getDatabase, ref, set, onValue, update, remove } from "https://www.gstatic.com/firebasejs/10.8.0/firebase-database.js";

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
const FRASES_MOTIVACIONALES = ["Confía en tu talento.", "Seguridad y mando.", "Portería a cero es el objetivo.", "El trabajo vence al talento.", "Hoy serás un muro."];

/* ================= FUNCIONES GLOBALES (EXPORTS PARA HTML) ================= */
// Necesario porque type="module" aisla el scope. Asignamos a window.
window.abrirLogin = abrirLogin;
window.cerrarModal = cerrarModal;
window.confirmarLogin = confirmarLogin;
window.confirmingLogin = confirmingLogin;
window.logout = logout;
window.toggleTheme = toggleTheme;
window.navPortero = navPortero;
window.toggleRanking = toggleRanking;
window.procesarImagenSegura = procesarImagenSegura;
window.guardarPortero = guardarPortero;
window.limpiarFormAdmin = limpiarFormAdmin;
window.editarPortero = editarPortero;
window.borrarPortero = borrarPortero;
window.crearEDP = crearEDP;
window.toggleCard = toggleCard;
window.sumar = sumar;
window.guardarFeedback = guardarFeedback;
window.togglePasswordVisibility = togglePasswordVisibility;

/* ================= INICIO & LISTENERS ================= */
document.addEventListener('DOMContentLoaded', () => {
    // Service Worker para PWA
    if ('serviceWorker' in navigator) { navigator.serviceWorker.register('./sw.js'); }

    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
    
    // Enter en Login
    const passInput = document.getElementById('modal-pass');
    if(passInput) {
        passInput.addEventListener('keypress', function (e) {
            if (e.key === 'Enter') confirmingLogin();
        });
    }

    // CARGA DE DATOS DESDE FIREBASE
    const porterosRef = ref(db, 'porteros');
    onValue(porterosRef, (snapshot) => {
        const data = snapshot.val();
        porteros = data ? Object.values(data) : [];
        refreshCurrentView(); // Actualizar vista en tiempo real
    });

    const edpsRef = ref(db, 'edps');
    onValue(edpsRef, (snapshot) => {
        const data = snapshot.val();
        edps = data ? Object.values(data) : [];
        refreshCurrentView();
    });

    // RECUPERAR SESIÓN (PERSISTENCIA)
    checkSession();
});

/* ================= LÓGICA DE SESIÓN ================= */
function checkSession() {
    const session = JSON.parse(localStorage.getItem('guardianes_session'));
    if (session) {
        roleType = session.role;
        // Esperamos un poco a que carguen los datos de Firebase para asignar currentUser
        setTimeout(() => {
            if (roleType === 'admin') {
                navTo('view-admin');
            } else if (roleType === 'edp') {
                currentUser = edps.find(e => e.id === session.id);
                if (currentUser) navTo('view-edp');
            } else if (roleType === 'portero') {
                currentUser = porteros.find(p => p.id === session.id);
                if (currentUser) navTo('view-portero');
            }
        }, 800); // Pequeño delay para asegurar carga de DB
    }
}

function refreshCurrentView() {
    const currentView = document.querySelector('section[style*="block"]');
    if (!currentView) return;
    
    if (currentView.id === 'view-admin') {
        renderAdminList(); renderEDPListAdmin(); cargarSelectEDP();
    } else if (currentView.id === 'view-edp' && currentUser) {
        renderEvaluacionList();
    } else if (currentView.id === 'view-portero' && currentUser) {
        // Actualizamos currentUser con los datos nuevos
        currentUser = porteros.find(p => p.id === currentUser.id);
        if(currentUser) renderDashboard(currentUser.id);
    } else if (currentView.id === 'view-ranking') {
        renderRankingList();
    }
}

function abrirLogin(role) { roleType = role; document.getElementById('modal-login').style.display = 'flex'; document.getElementById('modal-pass').value = ''; document.getElementById('modal-pass').focus(); }
function cerrarModal() { document.getElementById('modal-login').style.display = 'none'; }
function confirmingLogin() { confirmarLogin(); }

function confirmarLogin() {
    const pass = document.getElementById('modal-pass').value;
    if(!pass) return;
    let success = false;
    let sessionData = null;

    if(roleType === 'admin' && pass === 'ATLETI2024') { 
        navTo('view-admin'); 
        success = true; 
        sessionData = { role: 'admin', id: 'admin' };
    }
    else if(roleType === 'edp') {
        const found = edps.find(e => e.clave === pass);
        if (found) {
            currentUser = found;
            navTo('view-edp');
            success = true;
            sessionData = { role: 'edp', id: found.id };
        }
    }
    else if(roleType === 'portero') {
        const found = porteros.find(p => p.clave === pass);
        if (found) {
            currentUser = found;
            navTo('view-portero');
            success = true;
            sessionData = { role: 'portero', id: found.id };
        }
    }

    if(success) {
        localStorage.setItem('guardianes_session', JSON.stringify(sessionData));
        cerrarModal();
    } else {
        alert("Clave incorrecta");
    }
}

function logout() { 
    localStorage.removeItem('guardianes_session');
    location.reload(); 
}

function navTo(viewId) {
    document.querySelectorAll('main section').forEach(s => s.style.display = 'none');
    document.getElementById(viewId).style.display = 'block';
    document.getElementById('btn-logout').style.display = 'block';
    
    if(viewId === 'view-portero') document.getElementById('nav-portero').style.display = 'flex';
    else document.getElementById('nav-portero').style.display = 'none';

    refreshCurrentView();
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
            const maxSize = 300; // Reducido un poco para optimizar Firebase
            let width = img.width; let height = img.height;
            if (width > height) { if (width > maxSize) { height *= maxSize / width; width = maxSize; } } 
            else { if (height > maxSize) { width *= maxSize / height; height = maxSize; } }
            canvas.width = width; canvas.height = height; ctx.drawImage(img, 0, 0, width, height);
            fotoTemp = canvas.toDataURL('image/jpeg', 0.7);
            document.getElementById('fotoPreview').src = fotoTemp;
        }
    }
    reader.readAsDataURL(file);
}

function guardarPortero() {
    const idEdit = document.getElementById('reg-id').value; 
    const nombre = document.getElementById('reg-nombre').value; 
    const clave = document.getElementById('reg-clave').value;
    if(!nombre || !clave) return alert("Faltan datos");

    const statsBase = { men:60, tec:60, jue:60, ret:60 };
    
    // Si editamos, buscamos el original para no perder datos
    const original = idEdit ? porteros.find(p => p.id == idEdit) : null;

    const datos = {
        id: idEdit ? parseInt(idEdit) : Date.now(),
        nombre, 
        equipo: document.getElementById('reg-equipo').value, 
        sede: document.getElementById('reg-sede').value,
        ano: document.getElementById('reg-ano').value, 
        entrenador: document.getElementById('reg-entrenador-select').value,
        pierna: document.getElementById('reg-pierna').value, 
        mano: document.getElementById('reg-mano').value, 
        clave,
        foto: fotoTemp || (original ? original.foto : ""),
        puntos: original ? original.puntos : 0,
        stats: original ? (original.stats || statsBase) : statsBase,
        mensajeManual: original ? original.mensajeManual : "",
        historial: original ? (original.historial || []) : []
    };

    set(ref(db, 'porteros/' + datos.id), datos)
        .then(() => {
            showToast("Guardado en la Nube");
            limpiarFormAdmin();
        })
        .catch((e) => alert("Error Firebase: " + e.message));
}

function crearEDP() {
    const nombre = document.getElementById('edp-nombre').value;
    const clave = document.getElementById('edp-clave').value;
    if(!nombre || !clave) return;
    
    const id = Date.now();
    set(ref(db, 'edps/' + id), { id, nombre, clave })
        .then(() => {
            showToast("Entrenador Creado");
            document.getElementById('edp-nombre').value = "";
            document.getElementById('edp-clave').value = "";
        });
}

function borrarPortero(id) {
    if(confirm("¿Eliminar definitivamente?")) {
        remove(ref(db, 'porteros/' + id));
    }
}

// Renderizados Admin (Visualmente igual)
function renderAdminList() { 
    document.getElementById('admin-lista-porteros').innerHTML = porteros.map(p => `
        <div class="ranking-card-style" style="border-left: 4px solid var(--atm-blue);">
            <img src="${p.foto || 'https://via.placeholder.com/50'}" class="mini-foto-list">
            <div class="rank-info">
                <div class="rank-name">${p.nombre}</div>
                <div class="rank-team"><i class="fas fa-map-marker-alt"></i> ${p.sede || '-'} | ${p.equipo || '-'}</div>
            </div>
            <div class="admin-actions-modern">
                <button class="btn-admin-action btn-edit" onclick="editarPortero(${p.id})"><i class="fas fa-edit"></i></button>
                <button class="btn-admin-action btn-del" onclick="borrarPortero(${p.id})"><i class="fas fa-trash"></i></button>
            </div>
        </div>`).join(''); 
}
function renderEDPListAdmin() {
    document.getElementById('admin-lista-edps').innerHTML = edps.map(e => `
        <div class="ranking-card-style" style="border-left: 4px solid var(--lvl-3);">
            <div style="width:50px;height:50px;background:var(--lvl-3);color:black;border-radius:50%;display:flex;align-items:center;justify-content:center;font-weight:900;margin-right:12px;">${e.nombre.charAt(0)}</div>
            <div class="rank-info"><div class="rank-name">${e.nombre}</div><div class="rank-team">Clave: ${e.clave}</div></div>
        </div>`).join('');
}
function cargarSelectEDP() {
    document.getElementById('reg-entrenador-select').innerHTML = '<option value="">Asignar EDP...</option>' + edps.map(e => `<option value="${e.nombre}">${e.nombre}</option>`).join('');
}
function limpiarFormAdmin() {
    document.querySelectorAll('#view-admin input').forEach(i => i.value = "");
    document.getElementById('fotoPreview').src = "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///yH5BAEAAAAALAAAAAABAAEAAAIBRAA7";
    document.getElementById('reg-id').value = "";
    fotoTemp = "";
}
function editarPortero(id) {
    const p = porteros.find(x => x.id === id);
    document.getElementById('reg-id').value = p.id;
    document.getElementById('reg-nombre').value = p.nombre;
    document.getElementById('reg-equipo').value = p.equipo;
    document.getElementById('reg-sede').value = p.sede;
    document.getElementById('reg-ano').value = p.ano;
    document.getElementById('reg-entrenador-select').value = p.entrenador;
    document.getElementById('reg-clave').value = p.clave;
    if(p.foto) { document.getElementById('fotoPreview').src = p.foto; fotoTemp = p.foto; }
    document.querySelector('.modern-card').scrollIntoView({behavior: 'smooth'});
}

/* ================= EDP ================= */
function renderEvaluacionList() {
    const div = document.getElementById('edp-lista-porteros');
    const misPorteros = porteros.filter(p => p.entrenador === currentUser.nombre);
    if(misPorteros.length === 0) { div.innerHTML = "<p style='text-align:center;'>No tienes porteros asignados.</p>"; return; }
    
    div.innerHTML = misPorteros.map(p => `
        <div class="portero-card" id="card-${p.id}">
            <div class="card-header-flex" onclick="toggleCard(${p.id})">
                <div class="profile-flex">
                    <img src="${p.foto || 'https://via.placeholder.com/50'}" class="mini-foto-list">
                    <div><div style="font-weight:bold;">${p.nombre}</div><div style="font-size:0.7rem;">${p.puntos} PTS</div></div>
                </div>
                <i class="fas fa-chevron-down" style="color:var(--text-sec)"></i>
            </div>
            <div class="points-container">
                <div class="category-block"><div class="chat-input-container"><input type="text" id="feedback-input-${p.id}" class="chat-input" placeholder="Escribir mensaje..."><button class="btn-chat-send" onclick="guardarFeedback(${p.id})"><i class="fas fa-paper-plane"></i></button></div></div>
                
                <div class="category-block"><div class="category-header cat-men"><i class="fas fa-brain"></i> ACTITUD</div><div class="points-grid-modern">
                    <button class="btn-modern-score btn-men" onclick="sumar(${p.id}, 2, 'men', 'Puntual')"><i class="fas fa-clock"></i><span>+2</span>Puntual</button>
                    <button class="btn-modern-score btn-men" onclick="sumar(${p.id}, 2, 'men', 'Escucha')"><i class="fas fa-ear-listen"></i><span>+2</span>Escucha</button>
                    <button class="btn-modern-score btn-men" onclick="sumar(${p.id}, 3, 'men', 'Reacción')"><i class="fas fa-bolt"></i><span>+3</span>Reacción</button>
                    <button class="btn-modern-score btn-men" onclick="sumar(${p.id}, 2, 'men', 'Ayuda')"><i class="fas fa-handshake"></i><span>+2</span>Ayuda</button>
                    <button class="btn-modern-score btn-men" onclick="sumar(${p.id}, 1, 'men', 'Espíritu')"><i class="fas fa-fire"></i><span>+1</span>Espíritu</button>
                </div></div>

                <div class="category-block"><div class="category-header cat-tec"><i class="fas fa-mitten"></i> TÉCNICA</div><div class="points-grid-modern">
                    <button class="btn-modern-score btn-tec" onclick="sumar(${p.id}, 1, 'tec', 'Blocaje')"><i class="fas fa-hand-rock"></i><span>+1</span>Blocaje</button>
                    <button class="btn-modern-score btn-tec" onclick="sumar(${p.id}, 1, 'tec', 'Caída')"><i class="fas fa-arrow-down"></i><span>+1</span>Caída</button>
                    <button class="btn-modern-score btn-tec" onclick="sumar(${p.id}, 1, 'tec', 'Despeje')"><i class="fas fa-futbol"></i><span>+1</span>Despeje</button>
                    <button class="btn-modern-score btn-tec" onclick="sumar(${p.id}, 2, 'tec', 'Reflejo')"><i class="fas fa-bolt"></i><span>+2</span>Reflejo</button>
                    <button class="btn-modern-score btn-tec" onclick="sumar(${p.id}, 3, 'tec', 'TOP')"><i class="fas fa-star"></i><span>+3</span>TOP</button>
                </div></div>

                <div class="category-block"><div class="category-header cat-jue"><i class="fas fa-running"></i> JUEGO</div><div class="points-grid-modern">
                    <button class="btn-modern-score btn-jue" onclick="sumar(${p.id}, 2, 'jue', '1vs1')"><i class="fas fa-shield-alt"></i><span>+2</span>1vs1</button>
                    <button class="btn-modern-score btn-jue" onclick="sumar(${p.id}, 2, 'jue', 'Salida')"><i class="fas fa-rocket"></i><span>+2</span>Salida</button>
                    <button class="btn-modern-score btn-jue" onclick="sumar(${p.id}, 1, 'jue', 'Decisión')"><i class="fas fa-lightbulb"></i><span>+1</span>Decisión</button>
                    <button class="btn-modern-score btn-jue" onclick="sumar(${p.id}, 1, 'jue', 'Voz')"><i class="fas fa-bullhorn"></i><span>+1</span>Voz</button>
                    <button class="btn-modern-score btn-jue" onclick="sumar(${p.id}, 1, 'jue', 'Posición')"><i class="fas fa-map-marker-alt"></i><span>+1</span>Posición</button>
                </div></div>

                <div class="category-block"><div class="category-header cat-ret"><i class="fas fa-trophy"></i> RETOS</div><div class="points-grid-modern">
                    <button class="btn-modern-score btn-ret" onclick="sumar(${p.id}, 4, 'ret', 'Reto')"><i class="fas fa-check-circle"></i><span>+4</span>Reto</button>
                    <button class="btn-modern-score btn-ret" onclick="sumar(${p.id}, 6, 'ret', 'Perfecto')"><i class="fas fa-fire-alt"></i><span>+6</span>Perfect</button>
                    <button class="btn-modern-score btn-ret" onclick="sumar(${p.id}, 2, 'ret', 'Mejora')"><i class="fas fa-chart-line"></i><span>+2</span>Mejora</button>
                    <button class="btn-modern-score btn-ret" onclick="sumar(${p.id}, 2, 'ret', 'MVP')"><i class="fas fa-medal"></i><span>+2</span>MVP</button>
                </div></div>

                <div class="category-block" style="border:none;">
                    <div class="category-header">📜 Historial Reciente</div>
                    <div class="history-list">
                        ${p.historial && p.historial.length > 0 
                            ? p.historial.slice(0, 5).map(h => `
                                <div class="history-item">
                                    <span class="hist-date">${h.fecha.split(' ')[1]}</span>
                                    <span class="hist-action">${h.accion}</span>
                                    <span class="hist-pts" style="color:${getColor(h.categoria)}">+${h.puntos}</span>
                                </div>`).join('') 
                            : '<div style="text-align:center;font-size:0.75rem;color:var(--text-sec);">Sin actividad.</div>'}
                    </div>
                </div>
            </div>
        </div>`).join('');
}
function getColor(cat) { if(cat==='men') return 'var(--col-men)'; if(cat==='tec') return 'var(--col-tec)'; if(cat==='jue') return 'var(--col-jue)'; return 'var(--col-ret)'; }
function toggleCard(id) { document.getElementById(`card-${id}`).classList.toggle('expanded'); }

function sumar(id, pts, statKey, accionNombre) {
    const p = porteros.find(x => x.id === id);
    if (!p) return;

    let s = p.stats || { men:60, tec:60, jue:60, ret:60 };
    if(s[statKey] === undefined) s[statKey] = 60; // Auto-fix por si acaso

    let hist = p.historial || [];
    const fecha = new Date().toLocaleDateString('es-ES', {day:'2-digit', month:'2-digit'}) + ' ' + new Date().toLocaleTimeString('es-ES', {hour:'2-digit', minute:'2-digit'});
    hist.unshift({ fecha, accion: accionNombre, puntos: pts, categoria: statKey });
    if(hist.length > 20) hist.pop();

    update(ref(db, 'porteros/' + id), {
        puntos: (p.puntos || 0) + pts,
        stats: {
            ...s,
            [statKey]: s[statKey] + pts
        },
        historial: hist
    }).then(() => showToast(`+${pts} ${accionNombre}`));
}

function guardarFeedback(id) {
    const input = document.getElementById(`feedback-input-${id}`);
    if(!input.value) return;
    update(ref(db, 'porteros/' + id), { mensajeManual: input.value })
    .then(() => { showToast("Mensaje Enviado"); input.value = ""; });
}

/* ================= DASHBOARD PORTERO ================= */
function renderDashboard(porteroId) {
    const p = porteros.find(x => x.id === porteroId);
    if(!p) return;

    // Auto-fix stats if needed
    let s = p.stats || {};
    let needsUpdate = false;
    if (typeof s.men !== 'number' || isNaN(s.men)) { s.men = 60; needsUpdate = true; }
    if (typeof s.tec !== 'number' || isNaN(s.tec)) { s.tec = 60; needsUpdate = true; }
    if (typeof s.jue !== 'number' || isNaN(s.jue)) { s.jue = s.fis || 60; needsUpdate = true; }
    if (typeof s.ret !== 'number' || isNaN(s.ret)) { s.ret = s.tac || 60; needsUpdate = true; }
    if (needsUpdate) { update(ref(db, 'porteros/'+p.id), {stats: s}); }

    document.getElementById('dash-card-nombre').innerText = p.nombre; 
    document.getElementById('dash-feedback-content').innerText = `"${p.mensajeManual || FRASES_MOTIVACIONALES[Math.floor(Math.random() * FRASES_MOTIVACIONALES.length)]}"`;
    const imgEl = document.getElementById('card-foto');
    if(p.foto && p.foto.length > 50) { imgEl.src = p.foto; imgEl.style.display = 'block'; } else { imgEl.src = ""; imgEl.style.display = 'none'; }
    
    document.getElementById('fifa-rating').innerText = Math.min(99, 60 + Math.floor(p.puntos / 30));
    document.getElementById('stat-tec').innerText = Math.min(99, s.tec).toFixed(0);
    document.getElementById('stat-fis').innerText = Math.min(99, s.jue).toFixed(0); 
    document.getElementById('stat-men').innerText = Math.min(99, s.men).toFixed(0);
    document.getElementById('stat-tac').innerText = Math.min(99, s.ret).toFixed(0);
    
    let w=0, step=1, lvlName="Iniciación", lvlColor="var(--lvl-1)";
    if(p.puntos<=150) { w=(p.puntos/150)*100; }
    else if(p.puntos<=350) { lvlName="Formación"; lvlColor="var(--lvl-2)"; w=((p.puntos-150)/200)*100; step=2; }
    else if(p.puntos<=650) { lvlName="Consolidación"; lvlColor="var(--lvl-3)"; w=((p.puntos-350)/300)*100; step=3; }
    else if(p.puntos<=900) { lvlName="Rendimiento"; lvlColor="var(--lvl-4)"; w=((p.puntos-650)/250)*100; step=4; }
    else { lvlName="Referente"; lvlColor="var(--lvl-5)"; w=100; step=5; }
    
    document.getElementById('level-title').innerText = "Nivel: " + lvlName;
    document.getElementById('level-title').style.color = lvlColor;
    document.getElementById('dash-puntos-badge').innerText = p.puntos + " PTS";
    document.getElementById('dash-puntos-badge').style.backgroundColor = lvlColor;
    document.getElementById('progress-fill').style.width = Math.min(w, 100) + "%";
    document.getElementById('progress-fill').style.background = lvlColor;

    for(let i=1; i<=5; i++) {
        const divCol = document.querySelector(`.step-${i}`);
        divCol.classList.remove('active', 'passed');
        const circle = divCol.querySelector('.lvl-circle');
        circle.style.background = "rgba(128,128,128,0.2)"; circle.style.borderColor = "#555";
        if(i < step) { divCol.classList.add('passed'); circle.style.background = `var(--lvl-${i})`; circle.style.borderColor = `var(--lvl-${i})`; circle.style.color = i===5?"black":"white"; }
        if(i === step) { divCol.classList.add('active'); circle.style.background = lvlColor; circle.style.borderColor = lvlColor; circle.style.color = i===5?"black":"white"; }
    }

    const badges = [
        { name: "Primeros Pasos", limit: 30, icon: "shoe-prints" }, { name: "Manos Seguras", limit: 80, icon: "hand-paper" },
        { name: "Reflejos Felinos", limit: 120, icon: "bolt" }, { name: "Colocación", limit: 150, icon: "compass" },
        { name: "Mentalidad Pro", limit: 200, icon: "brain" }, { name: "Espíritu Indio", limit: 250, icon: "heart" },
        { name: "Valiente 1vs1", limit: 300, icon: "shield-alt" }, { name: "Rey del Área", limit: 400, icon: "crown" },
        { name: "Muro Diamante", limit: 500, icon: "gem" }, { name: "Comunicador", limit: 600, icon: "bullhorn" },
        { name: "Leyenda", limit: 900, icon: "star" }, { name: "Reto Superado", limit: 9999, icon: "check-circle" }
    ];
    document.getElementById('insignias-container').innerHTML = badges.map(b => `<div class="insignia-item"><div class="insignia-box ${p.puntos >= b.limit ? 'unlocked' : 'locked'}"><i class="fas fa-${b.icon}"></i></div><div class="insignia-name">${b.name}</div></div>`).join('');
    
    setTimeout(() => renderRadar(p), 300);
}

function renderRadar(p) {
    const ctxEl = document.getElementById('adnChart');
    if (!ctxEl) return;
    if (chartInstance) { chartInstance.destroy(); }
    const s = p.stats || { men:60, tec:60, jue:60, ret:60 };
    const isDark = document.body.getAttribute('data-theme') === 'dark';
    chartInstance = new Chart(ctxEl, {
        type: 'radar',
        data: {
            labels: ['Actitud', 'Técnica', 'Juego', 'Retos'],
            datasets: [{
                label: 'Rendimiento', data: [s.men, s.tec, s.jue, s.ret],
                backgroundColor: 'rgba(203, 53, 36, 0.5)', borderColor: 'rgba(203, 53, 36, 1)', borderWidth: 2, pointBackgroundColor: '#fff'
            }]
        },
        options: { responsive: true, maintainAspectRatio: false, scales: { r: { min: 0, max: 100, grid: { color: isDark ? 'rgba(255,255,255,0.1)' : 'rgba(0,0,0,0.1)' }, pointLabels: { color: isDark ? 'white' : '#333', font: {size: 11} }, ticks: { display: false } } }, plugins: { legend: { display: false } } }
    });
}

function toggleRanking(mode) { rankingMode = mode; document.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active')); if(mode === 'global') document.getElementById('rank-global').classList.add('active'); else if(mode === 'CD Alcalá') document.getElementById('rank-alcala').classList.add('active'); else if(mode === 'Cotorruelo') document.getElementById('rank-cotorruelo').classList.add('active'); renderRankingList(); }
function renderRankingList() {
    const div = document.getElementById('ranking-list-container');
    const smartDiv = document.getElementById('smart-rankings');
    let lista = [...porteros];
    if(rankingMode !== 'global') lista = lista.filter(p => p.sede === rankingMode);
    lista.sort((a,b) => b.puntos - a.puntos);
    
    const bestMen = [...lista].sort((a,b) => (b.stats?.men||0) - (a.stats?.men||0))[0];
    const bestTec = [...lista].sort((a,b) => (b.stats?.tec||0) - (a.stats?.tec||0))[0];
    smartDiv.innerHTML = `<div class="smart-card"><span class="smart-icon">🧠</span><span class="smart-title">Actitud</span><span class="smart-winner">${bestMen ? bestMen.nombre : '-'}</span></div><div class="smart-card"><span class="smart-icon">🧤</span><span class="smart-title">Técnica</span><span class="smart-winner">${bestTec ? bestTec.nombre : '-'}</span></div>`;
    div.innerHTML = lista.map((p, i) => `
        <div class="ranking-card-style rank-${i+1}" style="${currentUser && p.id === currentUser.id ? 'border-color:var(--atm-red);' : ''}">
            <div class="rank-pos">${i+1}</div>
            <img src="${p.foto || 'https://via.placeholder.com/50'}" class="mini-foto-list">
            <div class="rank-info">
                <div class="rank-name">${p.nombre}</div>
                <div class="rank-team"><i class="fas fa-shield-alt"></i> ${p.equipo || 'Sin Equipo'}</div>
            </div>
            <div class="rank-score">${p.puntos} PTS</div>
        </div>
    `).join('');
}
function togglePasswordVisibility() {
    const input = document.getElementById('modal-pass');
    const icon = document.querySelector('.toggle-password');
    if (input.type === 'password') { input.type = 'text'; icon.classList.replace('fa-eye', 'fa-eye-slash'); } 
    else { input.type = 'password'; icon.classList.replace('fa-eye-slash', 'fa-eye'); }
}
function updateThemeIcon(theme) { document.getElementById('btn-theme').innerHTML = theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>'; }