/* ================= CONFIGURACIÓN ================= */
// Base de datos local
let porteros = JSON.parse(localStorage.getItem('atleti_db')) || [];
let edps = JSON.parse(localStorage.getItem('atleti_edps')) || [{id:1, nombre:"Simeone", clave:"CHOLO"}];
let currentUser = null; 
let roleType = ""; 
let fotoTemp = ""; 
let chartInstance = null; 
let rankingMode = "global";

const FRASES_MOTIVACIONALES = [
    "Confía en tu talento.", "Seguridad y mando.", "Portería a cero es el objetivo.", 
    "El trabajo vence al talento.", "Hoy serás un muro.", "Nunca dejes de creer."
];

// LISTA DE INSIGNIAS EXACTA (Extraída de tu archivo)
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
    { name: "Reto Superado", limit: 9999, icon: "check-circle" }
];

/* ================= INICIO Y UTILIDADES ================= */
document.addEventListener('DOMContentLoaded', () => {
    const savedTheme = localStorage.getItem('theme') || 'dark';
    document.body.setAttribute('data-theme', savedTheme);
    updateThemeIcon(savedTheme);
});

function toggleTheme() {
    const current = document.body.getAttribute('data-theme');
    const newTheme = current === 'dark' ? 'light' : 'dark';
    document.body.setAttribute('data-theme', newTheme);
    localStorage.setItem('theme', newTheme);
    updateThemeIcon(newTheme);
    if(currentUser && document.getElementById('view-portero').style.display === 'block') renderRadar(currentUser);
}

function updateThemeIcon(theme) { 
    const btn = document.getElementById('btn-theme');
    if(btn) btn.innerHTML = theme === 'dark' ? '<i class="fas fa-sun"></i>' : '<i class="fas fa-moon"></i>'; 
}

function showToast(message, type = 'success') {
    const container = document.getElementById('toast-container');
    const toast = document.createElement('div');
    toast.className = `toast ${type === 'success' ? 'toast-success' : ''}`;
    toast.innerHTML = `<i class="fas fa-check-circle"></i> <span>${message}</span>`;
    container.appendChild(toast);
    setTimeout(() => { toast.style.animation = 'fadeOut 0.3s forwards'; setTimeout(() => toast.remove(), 300); }, 2500);
}

function lanzarConfeti() {
    confetti({ particleCount: 100, spread: 70, origin: { y: 0.6 }, colors: ['#CB3524', '#ffffff', '#1C2C5B'] });
}

/* ================= LOGIN ================= */
function abrirLogin(role) { roleType = role; document.getElementById('modal-login').style.display = 'flex'; document.getElementById('modal-pass').value = ''; document.getElementById('modal-pass').focus(); }
function cerrarModal() { document.getElementById('modal-login').style.display = 'none'; }
function togglePasswordVisibility() {
    const input = document.getElementById('modal-pass');
    if (input.type === 'password') input.type = 'text'; else input.type = 'password';
}

function confirmarLogin() {
    const pass = document.getElementById('modal-pass').value;
    if(!pass) return;
    
    // Recargar datos por si hubo cambios
    porteros = JSON.parse(localStorage.getItem('atleti_db')) || [];
    edps = JSON.parse(localStorage.getItem('atleti_edps')) || [];

    if(roleType === 'admin' && pass === 'ATLETI2024') { 
        navTo('view-admin'); 
    } else if(roleType === 'edp') {
        const found = edps.find(e => e.clave === pass);
        if(found) { currentUser = found; navTo('view-edp'); renderEvaluacionList(); }
        else alert("Clave incorrecta");
    } else if(roleType === 'portero') {
        const found = porteros.find(p => p.clave === pass);
        if(found) { currentUser = found; navTo('view-portero'); renderDashboard(currentUser.id); }
        else alert("Clave incorrecta");
    }
    cerrarModal();
}

function navTo(viewId) {
    document.querySelectorAll('main section').forEach(s => s.style.display = 'none');
    document.getElementById(viewId).style.display = 'block';
    document.getElementById('btn-logout').style.display = 'block';
    
    document.getElementById('nav-portero').style.display = (viewId === 'view-portero' || viewId === 'view-ranking') ? 'flex' : 'none';

    if(viewId === 'view-admin') { renderAdminList(); renderEDPListAdmin(); cargarSelectEDP(); limpiarFormAdmin(); }
}
function logout() { location.reload(); }

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
    
    if(!nombre || !clave) return alert("Nombre y Clave obligatorios");

    const pExistente = idEdit ? porteros.find(p => p.id == idEdit) : null;

    const datos = {
        id: idEdit ? parseInt(idEdit) : Date.now(),
        nombre, 
        equipo: document.getElementById('reg-equipo').value, 
        sede: document.getElementById('reg-sede').value, // IMPORTANTE PARA EL FILTRO
        ano: document.getElementById('reg-ano').value, 
        entrenador: document.getElementById('reg-entrenador-select').value,
        clave,
        foto: fotoTemp || (pExistente ? pExistente.foto : ""),
        puntos: pExistente ? pExistente.puntos : 0,
        stats: pExistente ? pExistente.stats : { men:60, tec:60, jue:60, ret:60 },
        mensajeManual: pExistente ? pExistente.mensajeManual : "",
        historial: pExistente ? pExistente.historial : []
    };

    if(idEdit) {
        const idx = porteros.findIndex(p => p.id == idEdit);
        porteros[idx] = datos;
    } else {
        porteros.push(datos);
    }

    localStorage.setItem('atleti_db', JSON.stringify(porteros));
    renderAdminList();
    limpiarFormAdmin();
    showToast("Portero guardado");
}

function limpiarFormAdmin() { 
    document.querySelectorAll('#view-admin input').forEach(i => i.value = ""); 
    document.getElementById('fotoPreview').src = "data:image/svg+xml;base64,PHN2ZyB4bWxucz0iaHR0cDovL3d3dy53My5vcmcvMjAwMC9zdmciIHdpZHRoPSIxNTAiIGhlaWdodD0iMTUwIiB2aWV3Qm94PSIwIDAgMTUwIDE1MCI+PHJlY3Qgd2lkdGg9IjE1MCIgaGVpZ2h0PSIxNTAiIGZpbGw9IiMzMzMiLz48dGV4dCB4PSI1MCUiIHk9IjUwJSIgZG9taW5hbnQtYmFzZWxpbmU9Im1pZGRsZSIgdGV4dC1hbmNob3I9Im1pZGRsZSIgZmlsbD0id2hpdGUiIGZvbnQtZmFtaWx5PSJQXSwgc2Fucy1zZXJpZiIgZm9udC1zaXplPSIyMCI+Rk9UTzwvdGV4dD48L3N2Zz4="; 
    document.getElementById('reg-id').value = ""; 
    fotoTemp = ""; 
}

function crearEDP() {
    const n = document.getElementById('edp-nombre').value;
    const c = document.getElementById('edp-clave').value;
    if(n && c) {
        edps.push({id: Date.now(), nombre: n, clave: c});
        localStorage.setItem('atleti_edps', JSON.stringify(edps));
        renderEDPListAdmin(); cargarSelectEDP();
        document.getElementById('edp-nombre').value = "";
        document.getElementById('edp-clave').value = "";
        showToast("Entrenador creado");
    }
}

function renderAdminList() { 
    document.getElementById('admin-lista-porteros').innerHTML = porteros.map(p => `
        <div class="ranking-card-style">
            <img src="${p.foto || 'logo.png'}" class="mini-foto-list">
            <div class="rank-info">
                <div class="rank-name">${p.nombre}</div>
                <div class="rank-team">${p.sede} - ${p.equipo}</div>
            </div>
            <button class="btn-admin-action btn-edit" onclick="editarPortero(${p.id})"><i class="fas fa-edit"></i></button>
            <button class="btn-admin-action btn-del" onclick="borrarPortero(${p.id})"><i class="fas fa-trash"></i></button>
        </div>
    `).join(''); 
}
function renderEDPListAdmin() {
    document.getElementById('admin-lista-edps').innerHTML = edps.map(e => `
        <div class="ranking-card-style" style="border-left:4px solid purple;">
            <div class="rank-info"><b>${e.nombre}</b> (Clave: ${e.clave})</div>
        </div>
    `).join('');
}
function cargarSelectEDP() { document.getElementById('reg-entrenador-select').innerHTML = '<option value="">Asignar...</option>' + edps.map(e => `<option value="${e.nombre}">${e.nombre}</option>`).join(''); }
function editarPortero(id) { const p = porteros.find(x => x.id === id); document.getElementById('reg-id').value = p.id; document.getElementById('reg-nombre').value = p.nombre; document.getElementById('reg-equipo').value = p.equipo; document.getElementById('reg-sede').value = p.sede; document.getElementById('reg-clave').value = p.clave; document.getElementById('reg-entrenador-select').value = p.entrenador; if(p.foto) { document.getElementById('fotoPreview').src = p.foto; fotoTemp = p.foto; } window.scrollTo(0,0); }
function borrarPortero(id) { if(confirm("¿Eliminar?")) { porteros = porteros.filter(p => p.id !== id); localStorage.setItem('atleti_db', JSON.stringify(porteros)); renderAdminList(); } }

/* ================= EDP (EVALUACIÓN) ================= */
function renderEvaluacionList() {
    const div = document.getElementById('edp-lista-porteros');
    const mis = porteros.filter(p => p.entrenador === currentUser.nombre);
    if(mis.length === 0) { div.innerHTML = "<p style='text-align:center; margin-top:20px;'>No tienes porteros asignados.</p>"; return; }
    
    div.innerHTML = mis.map(p => `
        <div class="portero-card" id="card-${p.id}">
            <div class="card-header-flex" onclick="document.getElementById('card-${p.id}').classList.toggle('expanded')">
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
                        <button class="btn-chat-send" onclick="guardarFeedback(${p.id})"><i class="fas fa-paper-plane"></i></button>
                    </div>
                </div>
                <div class="category-block"><div class="category-header cat-men">ACTITUD</div><div class="points-grid-modern">
                    <button class="btn-modern-score btn-men" onclick="sumar(${p.id}, 2, 'men', 'Puntual')"><i class="fas fa-clock"></i><span>+2</span></button>
                    <button class="btn-modern-score btn-men" onclick="sumar(${p.id}, 2, 'men', 'Esfuerzo')"><i class="fas fa-fire"></i><span>+2</span></button>
                    <button class="btn-modern-score btn-men" onclick="sumar(${p.id}, 3, 'men', 'Compañero')"><i class="fas fa-handshake"></i><span>+3</span></button>
                </div></div>
                <div class="category-block"><div class="category-header cat-tec">TÉCNICA</div><div class="points-grid-modern">
                    <button class="btn-modern-score btn-tec" onclick="sumar(${p.id}, 1, 'tec', 'Blocaje')"><i class="fas fa-hand-rock"></i><span>+1</span></button>
                    <button class="btn-modern-score btn-tec" onclick="sumar(${p.id}, 2, 'tec', 'Desvío')"><i class="fas fa-hand-paper"></i><span>+2</span></button>
                    <button class="btn-modern-score btn-tec" onclick="sumar(${p.id}, 3, 'tec', 'Paradón')"><i class="fas fa-star"></i><span>+3</span></button>
                </div></div>
                 <div class="category-block"><div class="category-header cat-jue">JUEGO</div><div class="points-grid-modern">
                    <button class="btn-modern-score btn-jue" onclick="sumar(${p.id}, 2, 'jue', 'Pies')"><i class="fas fa-shoe-prints"></i><span>+2</span></button>
                    <button class="btn-modern-score btn-jue" onclick="sumar(${p.id}, 2, 'jue', 'Mando')"><i class="fas fa-bullhorn"></i><span>+2</span></button>
                </div></div>
            </div>
        </div>
    `).join('');
}

function guardarFeedback(id) {
    const input = document.getElementById(`feedback-input-${id}`);
    const msg = input.value;
    if(!msg) return;
    
    const idx = porteros.findIndex(p => p.id === id);
    if(idx !== -1) {
        porteros[idx].mensajeManual = msg;
        localStorage.setItem('atleti_db', JSON.stringify(porteros));
        showToast("Mensaje enviado");
        input.value = "";
    }
}

function sumar(id, pts, statKey, accion) {
    const idx = porteros.findIndex(p => p.id === id);
    if(idx === -1) return;
    
    const portero = porteros[idx];
    const puntosViejos = portero.puntos;
    portero.puntos += pts;
    portero.stats[statKey] += pts;
    
    // Check Insignias (Confeti)
    BADGES.forEach(b => {
        if(puntosViejos < b.limit && portero.puntos >= b.limit) {
            alert(`¡${portero.nombre} desbloqueó: ${b.name}!`);
        }
    });

    localStorage.setItem('atleti_db', JSON.stringify(porteros));
    renderEvaluacionList();
    showToast(`+${pts} ${accion}`);
}

/* ================= DASHBOARD PORTERO ================= */
function renderDashboard(id) {
    porteros = JSON.parse(localStorage.getItem('atleti_db')); // Refrescar
    const p = porteros.find(x => x.id === id);
    if(!p) return;

    document.getElementById('dash-card-nombre').innerText = p.nombre;
    document.getElementById('dash-feedback-content').innerText = `"${p.mensajeManual || FRASES_MOTIVACIONALES[0]}"`;
    
    if(p.foto) { 
        document.getElementById('card-foto').src = p.foto; 
        document.getElementById('card-foto').style.display = 'block'; 
    }

    document.getElementById('fifa-rating').innerText = Math.min(99, 60 + Math.floor(p.puntos/30));
    document.getElementById('stat-tec').innerText = p.stats.tec;
    document.getElementById('stat-fis').innerText = p.stats.jue;
    document.getElementById('stat-men').innerText = p.stats.men;
    document.getElementById('stat-tac').innerText = p.stats.ret;

    // Barra Nivel
    let pct = Math.min(100, (p.puntos / 1000) * 100);
    document.getElementById('progress-fill').style.width = pct + "%";
    document.getElementById('dash-puntos-badge').innerText = p.puntos + " PTS";

    // INSIGNIAS - Aquí usamos el Array que pediste
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
    
    // Si acaba de entrar y ganó algo...
    if(p.puntos > 30) { /* Lógica opcional de bienvenida */ }

    renderRadar(p);
}

function renderRadar(p) {
    const ctx = document.getElementById('adnChart');
    if(chartInstance) chartInstance.destroy();
    
    chartInstance = new Chart(ctx, {
        type: 'radar',
        data: {
            labels: ['Actitud', 'Técnica', 'Juego', 'Retos'],
            datasets: [{
                label: 'ADN',
                data: [p.stats.men, p.stats.tec, p.stats.jue, p.stats.ret],
                backgroundColor: 'rgba(203, 53, 36, 0.4)',
                borderColor: '#CB3524',
                pointBackgroundColor: '#fff'
            }]
        },
        options: {
            scales: { r: { min: 0, max: 100, ticks:{display:false}, grid:{color:'rgba(128,128,128,0.2)'}, pointLabels:{color:'var(--text-sec)'} } },
            plugins: { legend: { display: false } }
        }
    });
}

/* ================= RANKING ================= */
function toggleRanking(mode) {
    rankingMode = mode;
    document.querySelectorAll('.segment-btn').forEach(b => b.classList.remove('active'));
    if(mode === 'global') document.getElementById('rank-global').classList.add('active');
    else if(mode === 'CD Alcalá') document.getElementById('rank-alcala').classList.add('active');
    else if(mode === 'Cotorruelo') document.getElementById('rank-cotorruelo').classList.add('active');
    renderRankingList();
}

function renderRankingList() {
    const container = document.getElementById('ranking-list-container');
    let lista = [...porteros];
    
    // FILTRO IMPORTANTE
    if(rankingMode !== 'global') {
        lista = lista.filter(p => p.sede === rankingMode);
    }
    
    lista.sort((a,b) => b.puntos - a.puntos);

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

function navPortero(tab) {
    document.getElementById('view-portero').style.display = tab==='home'?'block':'none';
    document.getElementById('view-ranking').style.display = tab==='ranking'?'block':'none';
    document.getElementById('nav-btn-home').classList.toggle('active', tab==='home');
    document.getElementById('nav-btn-rank').classList.toggle('active', tab==='ranking');
    if(tab==='ranking') renderRankingList();
}