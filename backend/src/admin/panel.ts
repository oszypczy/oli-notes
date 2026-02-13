import { Response } from 'express';

export function serveAdminPanel(res: Response): void {
  res.setHeader('Content-Type', 'text/html; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(ADMIN_HTML);
}

export function serveAdminScript(res: Response): void {
  res.setHeader('Content-Type', 'application/javascript; charset=utf-8');
  res.setHeader('Cache-Control', 'no-store');
  res.send(ADMIN_JS);
}

const ADMIN_HTML = `<!DOCTYPE html>
<html lang="pl">
<head>
<meta charset="UTF-8">
<meta name="viewport" content="width=device-width, initial-scale=1.0">
<title>Admin — OliNotes</title>
<style>
*,*::before,*::after{box-sizing:border-box;margin:0;padding:0}
body{font-family:'Inter',system-ui,-apple-system,sans-serif;background:#0f1117;color:#e2e4f0;min-height:100vh;line-height:1.5;-webkit-font-smoothing:antialiased}
.header{background:#12141e;border-bottom:1px solid #2a2d42;padding:16px 24px;display:flex;align-items:center;justify-content:space-between;height:64px}
.header h1{font-size:18px;font-weight:600;color:#7c85d6}
.header .right{display:flex;align-items:center;gap:16px}
.header .status{font-size:13px;color:#8b8faa}
.header .back-link{font-size:13px;color:#7c85d6;text-decoration:none}
.header .back-link:hover{text-decoration:underline}
.container{max-width:1200px;margin:0 auto;padding:24px}
.stats-grid{display:grid;grid-template-columns:repeat(auto-fit,minmax(160px,1fr));gap:16px;margin-bottom:32px}
.stat-card{background:#161822;border:1px solid #2a2d42;border-radius:10px;padding:20px}
.stat-card .label{font-size:12px;color:#8b8faa;text-transform:uppercase;letter-spacing:.5px;margin-bottom:8px}
.stat-card .value{font-size:28px;font-weight:700;color:#e2e4f0}
.stat-card.danger .value{color:#e85d5d}
.stat-card.success .value{color:#5de88a}
.stat-card.accent .value{color:#7c85d6}
.chart-section{background:#161822;border:1px solid #2a2d42;border-radius:10px;padding:20px;margin-bottom:32px}
.chart-section h2{font-size:14px;font-weight:600;margin-bottom:16px;color:#8b8faa;text-transform:uppercase;letter-spacing:.5px}
.chart-container{width:100%;height:180px;position:relative}
.chart-container svg{width:100%;height:100%}
.section-header{display:flex;align-items:center;justify-content:space-between;margin-bottom:16px}
.section-header h2{font-size:16px;font-weight:600}
.filters{display:flex;gap:8px;align-items:center}
.filters select,.filters button{background:#161822;color:#e2e4f0;border:1px solid #2a2d42;border-radius:6px;padding:6px 12px;font-size:13px;cursor:pointer;font-family:inherit}
.filters select:hover,.filters button:hover{border-color:#3d4160}
.filters button.active{background:#252840;border-color:#7c85d6}
.events-table{width:100%;border-collapse:collapse;font-size:13px}
.events-table th{text-align:left;padding:10px 12px;border-bottom:1px solid #2a2d42;color:#8b8faa;font-weight:500;font-size:12px;text-transform:uppercase;letter-spacing:.5px}
.events-table td{padding:10px 12px;border-bottom:1px solid rgba(42,45,66,.5);vertical-align:top}
.events-table tr:hover td{background:#1e2030}
.badge{display:inline-block;padding:2px 8px;border-radius:4px;font-size:11px;font-weight:500}
.badge-login_success{background:rgba(93,232,138,.15);color:#5de88a}
.badge-login_denied_faculty{background:rgba(232,93,93,.15);color:#e85d5d}
.badge-logout{background:rgba(139,143,170,.15);color:#8b8faa}
.badge-resource_access{background:rgba(93,180,232,.15);color:#5db4e8}
.badge-error{background:rgba(232,93,93,.15);color:#e85d5d}
.pagination{display:flex;justify-content:center;gap:8px;margin-top:16px;align-items:center}
.pagination button{background:#161822;color:#e2e4f0;border:1px solid #2a2d42;border-radius:6px;padding:6px 16px;font-size:13px;cursor:pointer;font-family:inherit}
.pagination button:disabled{opacity:.4;cursor:not-allowed}
.loading{color:#5c5f7a;text-align:center;padding:40px}
@media(max-width:768px){.container{padding:16px}.stats-grid{grid-template-columns:repeat(2,1fr)}.events-table{font-size:12px}.chart-container{height:140px}}
</style>
</head>
<body>
<header class="header">
  <h1>OliNotes Admin</h1>
  <div class="right">
    <span class="status" id="status">Loading...</span>
    <a href="/" class="back-link">Back to app</a>
  </div>
</header>
<div class="container">
  <div class="stats-grid" id="stats-grid"></div>
  <div class="chart-section">
    <h2>User Activity (last 6h)</h2>
    <div class="chart-container" id="chart"></div>
  </div>
  <div class="section-header">
    <h2>Event Log</h2>
    <div class="filters">
      <select id="type-filter">
        <option value="">All events</option>
        <option value="login_success">Logins</option>
        <option value="login_denied_faculty">Denied</option>
        <option value="logout">Logouts</option>
        <option value="resource_access">Resource access</option>
        <option value="error">Errors</option>
      </select>
      <button id="refresh-btn">Refresh</button>
      <button id="auto-refresh-btn" class="active">Auto 30s</button>
    </div>
  </div>
  <table class="events-table">
    <thead><tr><th>Time</th><th>Type</th><th>USOS ID</th><th>Detail</th></tr></thead>
    <tbody id="events-body"><tr><td colspan="4" class="loading">Loading...</td></tr></tbody>
  </table>
  <div class="pagination">
    <button id="prev-btn" disabled>Previous</button>
    <span id="page-info" style="color:#8b8faa;font-size:13px"></span>
    <button id="next-btn" disabled>Next</button>
  </div>
</div>
<script src="/admin/app.js"></script>
</body>
</html>`;

const ADMIN_JS = `(function(){
'use strict';
var PS=50,off=0,typ='',auto=true,timer=null;
var $=function(id){return document.getElementById(id)};
var statusEl=$('status'),sg=$('stats-grid'),eb=$('events-body'),ch=$('chart');
var tf=$('type-filter'),rb=$('refresh-btn'),ab=$('auto-refresh-btn');
var pb=$('prev-btn'),nb=$('next-btn'),pi=$('page-info');

function api(u){
  return fetch(u,{credentials:'same-origin'}).then(function(r){
    if(r.status===401||r.status===403){
      document.body.innerHTML='<div style="text-align:center;padding:80px;color:#e85d5d"><h2>Access Denied</h2><p>Not an admin or session expired.</p><a href="/" style="color:#7c85d6">Back</a></div>';
      throw new Error('denied');
    }
    if(!r.ok) throw new Error(r.status);
    return r.json();
  });
}

function esc(s){if(!s)return'';var d=document.createElement('div');d.textContent=s;return d.innerHTML}

function ft(iso){
  var d=new Date(iso);
  return d.toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit',second:'2-digit'})+' '+d.toLocaleDateString('pl-PL',{day:'2-digit',month:'2-digit'});
}

function up(s){var h=Math.floor(s/3600),m=Math.floor((s%3600)/60);return h+'h '+m+'m'}

function card(l,v,c){return'<div class="stat-card '+(c||'')+'"><div class="label">'+esc(l)+'</div><div class="value">'+esc(String(v))+'</div></div>'}

function stats(){
  api('/api/admin/stats').then(function(s){
    sg.innerHTML=
      card('Logins today',s.loginsToday,'success')+
      card('Total logins',s.loginsTotal,'accent')+
      card('Resources today',s.resourceAccessToday,'accent')+
      card('Denied today',s.deniedToday,s.deniedToday>0?'danger':'')+
      card('Errors today',s.errorsToday,s.errorsToday>0?'danger':'')+
      card('Buffer',s.bufferUsed+'/'+s.bufferMax,'')+
      card('Uptime',up(s.uptimeSeconds),'accent');
    statusEl.textContent='Updated: '+new Date().toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  }).catch(function(){});
}

function activity(){
  api('/api/admin/activity?hours=6').then(function(data){
    if(!data.length){ch.innerHTML='<p class="loading">No data yet.</p>';return;}
    var max=Math.max.apply(null,data.map(function(d){return d.users}))||1;
    var W=900,H=160,padL=40,padB=24,padT=10,padR=10;
    var cw=W-padL-padR,ch2=H-padT-padB;
    var step=cw/(data.length-1||1);

    var pts=data.map(function(d,i){
      var x=padL+i*step;
      var y=padT+ch2-(d.users/max)*ch2;
      return{x:x,y:y,u:d.users,t:d.time};
    });

    var line=pts.map(function(p,i){return(i===0?'M':'L')+p.x.toFixed(1)+' '+p.y.toFixed(1)}).join(' ');
    var area=line+' L'+pts[pts.length-1].x.toFixed(1)+' '+(padT+ch2)+' L'+padL+' '+(padT+ch2)+' Z';

    var labels='';
    var every=Math.max(1,Math.floor(data.length/8));
    for(var i=0;i<data.length;i+=every){
      var d=new Date(data[i].time);
      var lbl=d.toLocaleTimeString('pl-PL',{hour:'2-digit',minute:'2-digit'});
      labels+='<text x="'+pts[i].x.toFixed(1)+'" y="'+(H-4)+'" fill="#5c5f7a" font-size="10" text-anchor="middle">'+lbl+'</text>';
    }

    var yLabels='';
    for(var j=0;j<=4;j++){
      var val=Math.round(max*j/4);
      var yy=padT+ch2-(j/4)*ch2;
      yLabels+='<text x="'+(padL-6)+'" y="'+(yy+4)+'" fill="#5c5f7a" font-size="10" text-anchor="end">'+val+'</text>';
      yLabels+='<line x1="'+padL+'" y1="'+yy.toFixed(1)+'" x2="'+(W-padR)+'" y2="'+yy.toFixed(1)+'" stroke="#1e2030" stroke-width="1"/>';
    }

    ch.innerHTML='<svg viewBox="0 0 '+W+' '+H+'" preserveAspectRatio="none">'+
      yLabels+
      '<path d="'+area+'" fill="rgba(124,133,214,0.15)" stroke="none"/>'+
      '<path d="'+line+'" fill="none" stroke="#7c85d6" stroke-width="2" stroke-linejoin="round"/>'+
      labels+
      '</svg>';
  }).catch(function(){});
}

function events(){
  var p=new URLSearchParams({limit:String(PS),offset:String(off)});
  if(typ)p.set('type',typ);
  api('/api/admin/events?'+p).then(function(d){
    if(!d.events.length){eb.innerHTML='<tr><td colspan="4" class="loading">No events.</td></tr>';}
    else{eb.innerHTML=d.events.map(function(e){
      return'<tr><td>'+ft(e.timestamp)+'</td><td><span class="badge badge-'+esc(e.type)+'">'+esc(e.type)+'</span></td><td>'+esc(e.usosId||'-')+'</td><td>'+esc(e.detail||'')+'</td></tr>';
    }).join('');}
    pb.disabled=off===0;
    nb.disabled=d.events.length<PS;
    pi.textContent=d.events.length?'Showing '+(off+1)+'-'+(off+d.events.length):'';
  }).catch(function(){});
}

function load(){stats();events();activity()}

tf.addEventListener('change',function(){typ=this.value;off=0;events()});
rb.addEventListener('click',load);
ab.addEventListener('click',function(){auto=!auto;this.classList.toggle('active',auto);this.textContent=auto?'Auto 30s':'Auto off';sched()});
pb.addEventListener('click',function(){off=Math.max(0,off-PS);events()});
nb.addEventListener('click',function(){off+=PS;events()});

function sched(){if(timer)clearInterval(timer);if(auto)timer=setInterval(load,30000)}

load();sched();
})();`;
