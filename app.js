let pz;
let countriesMaster = [];

async function boot() {
    try {
        const [m, s] = await Promise.all([
            fetch('./countries.json').then(r => r.json()),
            fetch('./world.svg').then(r => r.text())
        ]);
        
        countriesMaster = Object.values(m).flat();
        
        document.getElementById('map-wrapper').innerHTML = s;
        setup();
        draw();
        initClock();
        pz.fit();
        pz.center();

        const params = new URLSearchParams(window.location.search);
        const sectorCode = params.get('sector');
        if (sectorCode) setTimeout(() => focus(sectorCode.toUpperCase()), 500);
    } catch (e) {
        console.error("SYSTEM_FAILURE", e);
    }
}

function initClock() {
    const clockEl = document.getElementById('clock-display');
    const updateTime = () => {
        const now = new Date();
        clockEl.textContent = `${now.toISOString().split('T')[0]} | ${now.toTimeString().split(' ')[0]}`;
    };
    updateTime();
    setInterval(updateTime, 1000);
}

function setup() {
    const v = document.querySelector('svg');
    pz = svgPanZoom(v, {
        zoomEnabled: true, 
        fit: true, 
        center: true, 
        maxZoom: 80,
        mouseWheelZoomEnabled: true,
        controlIconsEnabled: false,
        eventsListenerElement: document.getElementById('map-wrapper')
    });

    document.querySelectorAll('path').forEach(p => {
        const country = countriesMaster.find(x => x.code === p.id);
        // Map Logic: Only color Top 60 countries
        if (country && country.rank && country.rank <= 60) {
            p.classList.add('military-top');
        }
        
        p.addEventListener('pointerdown', (e) => {
            e.preventDefault(); e.stopPropagation();
            focus(p.id);
        });
    });

    v.addEventListener('pointerdown', (e) => {
        if (e.target.tagName === 'svg') kill();
    });
}

function toggleBoard(forceState = null) {
    const board = document.getElementById('conflict-board');
    const btn = document.getElementById('board-toggle');
    if (forceState === 'collapse') board.classList.add('collapsed');
    else if (forceState === 'expand') board.classList.remove('collapsed');
    else board.classList.toggle('collapsed');
    btn.textContent = board.classList.contains('collapsed') ? '▵' : '_';
}

function getTier(rank) {
    if (!rank) return "UNRANKED";
    if (rank <= 3) return "TIER 1 (SUPERPOWER)";
    if (rank <= 10) return "TIER 2 (MAJOR POWER)";
    if (rank <= 25) return "TIER 3 (REGIONAL POWER)";
    if (rank <= 45) return "TIER 4 (EMERGING POWER)";
    if (rank <= 60) return "TIER 5 (STABILIZED POWER)";
    return "TIER 6 (OBSERVATION)";
}

function draw() {
    const stream = document.getElementById('conflict-stream');
    const statsContainer = document.getElementById('level-stats');
    stream.innerHTML = '';
    
    // Board logic: Include ALL countries, ranked first, then unranked
    const ranked = countriesMaster.filter(c => c.rank !== null).sort((a, b) => a.rank - b.rank);
    const unranked = countriesMaster.filter(c => c.rank === null).sort((a, b) => a.name.localeCompare(b.name));
    const allSorted = [...ranked, ...unranked];

    statsContainer.innerHTML = `
        <div class="stat-item">TOTAL SECTORS:<span class="stat-count">${countriesMaster.length}</span></div>
        <div class="stat-item">RANKED:<span class="stat-count">${ranked.length}</span></div>
    `;

    allSorted.forEach(country => {
        const card = document.createElement('div');
        card.className = 'intel-card';
        const tier = getTier(country.rank);
        card.innerHTML = `
            <div>
                <div class="card-name">${country.emoji} ${country.name.toUpperCase()}</div>
                <div class="card-tier">${tier} [${country.code}]</div>
            </div>
            <div class="card-rank">${country.rank ? '#' + country.rank : '---'}</div>
        `;
        card.onpointerdown = () => focus(country.code);
        stream.appendChild(card);
    });
}

function focus(code) {
    const path = document.getElementById(code);
    const country = countriesMaster.find(x => x.code === code);
    const portal = document.getElementById('info-portal');
    if (!path || !country) return;
    
    if (path.classList.contains('selected')) { kill(); return; }
    document.querySelectorAll('.selected').forEach(x => x.classList.remove('selected'));
    path.classList.add('selected');

    toggleBoard('collapse');

    document.getElementById('p-emoji').textContent = country.emoji;
    document.getElementById('p-name').textContent = country.name;
    document.getElementById('p-code').textContent = `SECTOR: ${code}`;
    
    const rankTag = document.getElementById('p-risk-tag');
    const subjectBox = document.getElementById('p-subject');
    
    if (country.rank) {
        rankTag.textContent = `GLOBAL RANK: #${country.rank}`;
        subjectBox.textContent = `Classification: ${getTier(country.rank)}. Strategic assets verified via Military Watch Magazine Force Index. Sector monitoring active.`;
    } else {
        rankTag.textContent = `STATUS: UNRANKED`;
        subjectBox.textContent = "Insufficient data for ranking. Sector remains under observation for tactical updates.";
    }

    portal.classList.remove('hidden');

    const bbox = path.getBBox();
    const wrapper = document.getElementById('map-wrapper');
    const targetZoom = Math.min(wrapper.clientWidth / bbox.width, wrapper.clientHeight / bbox.height) * 0.4;
    const finalZoom = Math.min(Math.max(targetZoom, 2), 15);

    const targetX = (wrapper.clientWidth / 2) - ((bbox.x + bbox.width / 2) * finalZoom);
    const targetY = (wrapper.clientHeight / 2) - ((bbox.y + bbox.height / 2) * finalZoom);

    pz.zoom(1.1);
    setTimeout(() => {
        pz.zoom(finalZoom);
        pz.pan({ x: targetX, y: targetY });
    }, 50);
}

function kill() {
    document.querySelectorAll('.selected').forEach(x => x.classList.remove('selected'));
    document.getElementById('info-portal').classList.add('hidden');
    window.history.replaceState({}, document.title, window.location.pathname);
}

async function shareIntel() {
    const name = document.getElementById('p-name').innerText;
    const code = document.getElementById('p-code').innerText.split(': ')[1];
    const url = `${window.location.origin}${window.location.pathname}?sector=${code}`;
    const shareData = { title: `Militaris: ${name}`, text: `Intelligence for ${name} [${code}]:`, url: url };
    try {
        if (navigator.share) await navigator.share(shareData);
        else { await navigator.clipboard.writeText(`${shareData.text} ${url}`); alert("INTEL LINK COPIED"); }
    } catch (err) { console.error(err); }
}

function zoomInMap() { pz.zoomIn(); }
function zoomOutMap() { pz.zoomOut(); }
function resetMap() { kill(); pz.fit(); pz.center(); }

window.onload = boot;
