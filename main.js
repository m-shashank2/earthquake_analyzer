document.getElementById("currentYear").textContent = new Date().getFullYear();

const themeToggle = document.getElementById("themeToggle");
const themeText = document.getElementById("themeText");

themeToggle.addEventListener("change", () => {
  if (themeToggle.checked) document.body.classList.replace("day", "night"), themeText.textContent="Night";
  else document.body.classList.replace("night", "day"), themeText.textContent="Day";
});

let quakeData = [];
let currentSortedData = [];
let quakeChart;
let quakeMap;
let markers = [];
let heatLayer;
let userRegion = "";
let alertedQuakes = [];

document.getElementById("setAlert").addEventListener("click", () => {
  userRegion = document.getElementById("userRegion").value.trim().toLowerCase();
  if(userRegion) alert("Alert region set to: " + userRegion);
});

document.getElementById("checkAlert").addEventListener("click", () => {
  checkUserAlert(currentSortedData);
});

function initMap() {
  quakeMap = L.map("mapContainer").setView([20,0],2);
  L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {maxZoom:19, attribution:'© OpenStreetMap'}).addTo(quakeMap);
}
initMap();

async function loadEarthquakes() {
  try {
    const res = await fetch("https://earthquake.usgs.gov/earthquakes/feed/v1.0/summary/all_day.geojson");
    if(!res.ok) throw new Error("Failed to load USGS data: "+res.status);
    const data = await res.json();
    quakeData = data.features;
    sortByMagnitude();
  } catch(e){ console.error(e); document.getElementById("quakeContainer").innerHTML=`<div class="alert alert-danger">${e.message}</div>`; }
}
loadEarthquakes();

function sortByMagnitude(){ updateSortedData(quakeData.slice().sort((a,b)=>b.properties.mag-a.properties.mag),"magnitude"); }
function sortByTime(){ updateSortedData(quakeData.slice().sort((a,b)=>b.properties.time-a.properties.time),"time"); }
function sortByDepth(){ updateSortedData(quakeData.slice().sort((a,b)=>(b.geometry.coordinates[2]||0)-(a.geometry.coordinates[2]||0)),"depth"); }

function updateSortedData(sorted,sortType){
  currentSortedData=sorted;
  displayQuakes(sorted);
  generateChart(sorted,sortType);
  updateMap(sorted);
  updateHeatmap(sorted);
  checkRisk(sorted);
}

function displayQuakes(data){
  const c=document.getElementById("quakeContainer"); c.innerHTML="";
  if(data.length===0){ c.innerHTML="<p class='text-center'>No events found.</p>"; return; }
  data.forEach(q=>{
    const {mag,place,time}=q.properties;
    const [lon,lat,depth]=q.geometry.coordinates;
    const card=document.createElement("div");
    card.className="quake-card";
    card.innerHTML=`<h4>${place}</h4><p><strong>Magnitude:</strong>${mag}</p><p><strong>Date/Time:</strong>${new Date(time).toLocaleString()}</p><p><strong>Depth:</strong>${depth} km</p><p><strong>Coordinates:</strong>[${lat.toFixed(2)},${lon.toFixed(2)}]</p>`;
    c.appendChild(card);
  });
}

function updateMap(data){
  markers.forEach(m=>quakeMap.removeLayer(m));
  markers=[];
  data.forEach(q=>{
    const [lon,lat,depth]=q.geometry.coordinates;
    const {mag,place,time}=q.properties;
    const marker=L.marker([lat,lon]).bindPopup(`<strong>${place}</strong><br>Magnitude:${mag}<br>Date:${new Date(time).toLocaleString()}<br>Depth:${depth} km`);
    marker.addTo(quakeMap);
    markers.push(marker);
  });
  if(markers.length>0) quakeMap.fitBounds(L.featureGroup(markers).getBounds());
}

function updateHeatmap(data){
  const points=data.map(q=>{ const [lon,lat]=q.geometry.coordinates; return [lat,lon,q.properties.mag]; });
  if(heatLayer) heatLayer.setLatLngs(points);
  else heatLayer=L.heatLayer(points,{radius:25,blur:15,maxZoom:10}).addTo(quakeMap);
}

function generateChart(data,sortType){
  const top10=data.slice().sort((a,b)=>{
    if(sortType==="magnitude") return b.properties.mag-a.properties.mag;
    if(sortType==="depth") return (b.geometry.coordinates[2]||0)-(a.geometry.coordinates[2]||0);
    if(sortType==="time") return b.properties.time-a.properties.time;
  }).slice(0,10);

  const labels=top10.map(q=>q.properties.place.substring(0,20)+"...");
  const values=top10.map(q=>sortType==="magnitude"?q.properties.mag:sortType==="depth"?q.geometry.coordinates[2]||0:q.properties.time);

  const ctx=document.getElementById("quakeChart").getContext("2d");
  if(quakeChart) quakeChart.destroy();
  quakeChart=new Chart(ctx,{
    type:"bar",
    data:{labels:labels,datasets:[{label:sortType.charAt(0).toUpperCase()+sortType.slice(1),data:values,backgroundColor:"rgba(54,162,235,0.6)",borderColor:"rgba(54,162,235,1)",borderWidth:1}]},
    options:{responsive:true,maintainAspectRatio:false,scales:{y:{beginAtZero:true,ticks:{callback:value=>sortType==="time"?new Date(value).toLocaleString():value}}}}
  });
}

function checkRisk(data){
  const risky=data.filter(q=>q.properties.mag>=5||(q.geometry.coordinates[2]&&q.geometry.coordinates[2]<10));
  const c=document.getElementById("alertContainer");
  if(risky.length>0) c.innerHTML=`<div class="alert alert-warning">Warning: ${risky.length} significant earthquakes detected (mag ≥ 5 or depth < 10 km)</div>`;
  else c.innerHTML="";
}

function checkUserAlert(data){
  if(!userRegion) return;
  data.forEach(q=>{
    if(q.properties.place.toLowerCase().includes(userRegion) && !alertedQuakes.includes(q.id)){
      const {mag,time} = q.properties;
      const [lon,lat,depth] = q.geometry.coordinates;
      alert(`Earthquake Alert!\nLocation: ${q.properties.place}\nMagnitude: ${mag}\nDepth: ${depth} km\nDate/Time: ${new Date(time).toLocaleString()}`);
      alertedQuakes.push(q.id);
    }
  });
}

document.getElementById("btnMag").addEventListener("click",sortByMagnitude);
document.getElementById("btnTime").addEventListener("click",sortByTime);
document.getElementById("btnDepth").addEventListener("click",sortByDepth);
