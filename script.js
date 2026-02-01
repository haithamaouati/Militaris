/* ===============================
   RADAR BACKGROUND EFFECT
================================ */
const radarCanvas = document.getElementById("radar-bg");
const rctx = radarCanvas.getContext("2d");

function resizeRadar() {
  radarCanvas.width = window.innerWidth;
  radarCanvas.height = window.innerHeight;
}
window.addEventListener("resize", resizeRadar);
resizeRadar();

const pulses = [];
function spawnPulse() {
  pulses.push({
    x: Math.random()*radarCanvas.width,
    y: Math.random()*radarCanvas.height,
    r: 0,
    alpha: 0.6,
    max: 150 + Math.random()*100
  });
}

function drawRadar() {
  rctx.clearRect(0,0,radarCanvas.width, radarCanvas.height);
  if(Math.random()<0.03) spawnPulse();

  pulses.forEach((p,i)=>{
    rctx.beginPath();
    rctx.arc(p.x,p.y,p.r,0,Math.PI*2);
    rctx.strokeStyle = `rgba(0,255,66,${p.alpha})`;
    rctx.lineWidth = 2;
    rctx.stroke();
    p.r += 2;
    p.alpha -= 0.01;
    if(p.alpha<=0) pulses.splice(i,1);
  });

  requestAnimationFrame(drawRadar);
}
drawRadar();

/* ===============================
   MAP + DATA LOGIC
================================ */
const mapContainer = document.getElementById("map-container");
const select = document.getElementById("countrySelect");
const select2 = document.getElementById("countrySelect2");
const resetBtn = document.getElementById("reset");
const zoomOutBtn = document.getElementById("zoomOut");
const copyLinkBtn = document.getElementById("copyLink");
const detailsCard = document.getElementById("detailsCard");
const detailsBody = document.getElementById("detailsBody");
const compareCard = document.getElementById("compareCard");
const compareBody = document.getElementById("compareBody");
const allCountriesBody = document.getElementById("allCountriesBody");
const shareLink = document.getElementById("shareLink");
const explosionCanvas = document.getElementById("explosion-canvas");
const ectx = explosionCanvas.getContext("2d");

explosionCanvas.width = mapContainer.clientWidth;
explosionCanvas.height = mapContainer.clientHeight;
window.addEventListener("resize", () => {
  explosionCanvas.width = mapContainer.clientWidth;
  explosionCanvas.height = mapContainer.clientHeight;
});

let svg, originalViewBox;
let data = [];
let explosions = [];

// Load map
fetch("world.svg")
  .then(r=>r.text())
  .then(svgText=>{
    mapContainer.innerHTML = svgText;
    svg = mapContainer.querySelector("svg");
    svg.setAttribute("preserveAspectRatio","xMidYMid meet");
    originalViewBox = svg.getAttribute("viewBox");
    bindMap();
    drawMapGrid();

    // URL selection
    const params = new URLSearchParams(window.location.search);
    const c1 = params.get("country");
    const c2 = params.get("country2");
    if(c1) selectCountry(c1);
    if(c2) selectCountry(c2,true);
  });

// Load data
fetch("data.json")
  .then(r=>r.json())
  .then(json=>{
    data=json;
    json.forEach(c=>{
      const opt1=document.createElement("option");
      opt1.value=c.code;
      opt1.textContent=`${c.rank} – ${c.name}`;
      select.appendChild(opt1);

      const opt2=document.createElement("option");
      opt2.value=c.code;
      opt2.textContent=`${c.rank} – ${c.name}`;
      select2.appendChild(opt2);
    });
    allCountriesBody.innerHTML=data.map(c=>`
      <tr>
        <td>${c.rank}</td>
        <td>${c.emoji}</td>
        <td>${c.name}</td>
      </tr>`).join("");
  });

function bindMap() {
  svg.querySelectorAll("path").forEach(p=>{
    p.addEventListener("click", e=>selectCountry(p.id,e));
  });
}

// Map grid overlay
function drawMapGrid() {
  const width = svg.viewBox.baseVal.width;
  const height = svg.viewBox.baseVal.height;
  const ns = "http://www.w3.org/2000/svg";

  svg.querySelectorAll(".grid-line").forEach(l=>l.remove());

  for(let i=0;i<=20;i++){
    let x=(width/20)*i;
    let y=(height/20)*i;

    let lineV=document.createElementNS(ns,"line");
    lineV.setAttribute("x1",x); lineV.setAttribute("y1",0);
    lineV.setAttribute("x2",x); lineV.setAttribute("y2",height);
    lineV.setAttribute("stroke","rgba(0,255,100,0.1)");
    lineV.setAttribute("class","grid-line");
    svg.appendChild(lineV);

    let lineH=document.createElementNS(ns,"line");
    lineH.setAttribute("x1",0); lineH.setAttribute("y1",y);
    lineH.setAttribute("x2",width); lineH.setAttribute("y2",y);
    lineH.setAttribute("stroke","rgba(0,255,100,0.1)");
    lineH.setAttribute("class","grid-line");
    svg.appendChild(lineH);
  }
}

function selectCountry(code,e,comparison=false) {
  const country = data.find(c=>c.code===code);
  if(!country) return;

  if(!comparison){
    svg.querySelectorAll("path").forEach(p=>{
      p.classList.remove("selected");
      if(p.classList.contains("selected2")) p.classList.remove("selected2");
    });
    const path = svg.getElementById(code);
    if(path) path.classList.add("selected");
    select.value = code;

    const box = path.getBBox();
    svg.setAttribute("viewBox",
      `${box.x-20} ${box.y-20} ${box.width+40} ${box.height+40}`);

    detailsBody.innerHTML=`
      <tr>
        <td>${country.rank}</td>
        <td>${country.emoji}</td>
        <td>${country.name}</td>
      </tr>`;
    detailsCard.hidden=false;

    shareLink.value = generateLink();
  } else {
    svg.querySelectorAll("path").forEach(p=>{
      if(p.classList.contains("selected2")) p.classList.remove("selected2");
    });
    const path2 = svg.getElementById(code);
    if(path2) path2.classList.add("selected2");
    select2.value = code;
    compareBody.innerHTML="";
    const c1 = data.find(d=>d.code===select.value);
    const c2 = country;
    if(c1) compareBody.innerHTML+=`
      <tr>
        <td>${c1.name}</td>
        <td>${c1.rank}</td>
        <td>${c1.emoji}</td>
      </tr>`;
    compareBody.innerHTML+=`
      <tr>
        <td>${c2.name}</td>
        <td>${c2.rank}</td>
        <td>${c2.emoji}</td>
      </tr>`;
    compareCard.hidden=false;
    shareLink.value = generateLink(true);
  }

  // explosion effect
  const rect = mapContainer.getBoundingClientRect();
  const cx = e? e.clientX-rect.left : rect.width/2;
  const cy = e? e.clientY-rect.top : rect.height/2;
  explosions.push({x:cx,y:cy,r:0,alpha:1});
}

function generateLink(comparison=false){
  const url = new URL(window.location);
  if(select.value) url.searchParams.set("country", select.value);
  else url.searchParams.delete("country");
  if(comparison && select2.value) url.searchParams.set("country2", select2.value);
  else url.searchParams.delete("country2");
  return url.toString();
}

// explosion animation
function drawExplosions() {
  ectx.clearRect(0,0,explosionCanvas.width,explosionCanvas.height);
  explosions.forEach((exp,i)=>{
    ectx.beginPath();
    ectx.arc(exp.x,exp.y,exp.r,0,Math.PI*2);
    ectx.strokeStyle=`rgba(0,255,66,${exp.alpha})`;
    ectx.lineWidth=2;
    ectx.stroke();
    exp.r+=3;
    exp.alpha-=0.03;
    if(exp.alpha<=0) explosions.splice(i,1);
  });
  requestAnimationFrame(drawExplosions);
}

// buttons
resetBtn.onclick=()=>{
  svg.setAttribute("viewBox",originalViewBox);
  svg.querySelectorAll("path").forEach(p=>{
    p.classList.remove("selected");
    p.classList.remove("selected2");
  });
  select.value="";
  select2.value="";
  detailsCard.hidden=true;
  compareCard.hidden=true;
  shareLink.value="";
};

zoomOutBtn.onclick=()=>{ svg.setAttribute("viewBox",originalViewBox); };

select.onchange=e=>{ if(e.target.value) selectCountry(e.target.value); };
select2.onchange=e=>{ if(e.target.value) selectCountry(e.target.value,null,true); };

// copy link
copyLinkBtn.onclick=()=> {
  if(shareLink.value){
    navigator.clipboard.writeText(shareLink.value);
    alert("Link copied!");
  }
};

// toggle all countries table
const toggleBtn = document.getElementById("toggleAll");
const allWrapper = document.getElementById("allCountriesWrapper");
toggleBtn.onclick = () => {
  if(allWrapper.style.display==="none" || !allWrapper.style.display){
    allWrapper.style.display="block";
    toggleBtn.textContent="All Countries Ranking ▼";
  } else {
    allWrapper.style.display="none";
    toggleBtn.textContent="All Countries Ranking ▲";
  }
};
allWrapper.style.display="none"; // start collapsed