(function(){
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const KEY_CARDS='lb_cards_v1', KEY_SET='lb_settings_v1';
const INTERVALS=[1,2,4,8,16]; // روز؛ جعبه ۱ تا ۵
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const today=()=>{const d=new Date();return d.getFullYear()+'-'+String(d.getMonth()+1).padStart(2,'0')+'-'+String(d.getDate()).padStart(2,'0');};
const addDays=(iso,n)=>{const [y,m,d]=iso.split('-').map(Number);const t=new Date(y,m-1,d+n);return t.getFullYear()+'-'+String(t.getMonth()+1).padStart(2,'0')+'-'+String(t.getDate()).padStart(2,'0');};
const clean=s=>String(s==null?'':s).trim();

function load(k,def){try{const v=localStorage.getItem(k);return v?JSON.parse(v):def;}catch(e){return def;}}
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}

let settings=Object.assign({theme:'auto',size:20},load(KEY_SET,{}));
let cards=load(KEY_CARDS,null);
if(!cards){
  cards=(window.SEED_WORDS||[]).map((r,i)=>mk(r[0],r[1],r[2],r[3],r[4]));
  save(KEY_CARDS,cards);
}
function mk(w,m1,m2,p,s){return{id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),w:clean(w),m1:clean(m1),m2:clean(m2),p:clean(p),s:clean(s),box:1,due:today()};}
const persist=()=>save(KEY_CARDS,cards);

/* ---------- تم ---------- */
function applyTheme(){
  let t=settings.theme;
  if(t==='auto')t=(window.matchMedia&&matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light';
  document.documentElement.setAttribute('data-theme',t);
  $('#themeBtn').textContent=t==='dark'?'☀️':'🌙';
  $$('#themeSeg button').forEach(b=>b.classList.toggle('on',b.dataset.t===settings.theme));
}
$('#themeBtn').onclick=()=>{
  const cur=document.documentElement.getAttribute('data-theme');
  settings.theme=cur==='dark'?'light':'dark';save(KEY_SET,settings);applyTheme();
};
$$('#themeSeg button').forEach(b=>b.onclick=()=>{settings.theme=b.dataset.t;save(KEY_SET,settings);applyTheme();});

/* ---------- تب‌ها ---------- */
$$('.bottom button').forEach(b=>b.onclick=()=>{
  $$('.bottom button').forEach(x=>x.classList.remove('active'));b.classList.add('active');
  $$('.tab').forEach(t=>t.classList.remove('active'));$('#tab-'+b.dataset.tab).classList.add('active');
  if(b.dataset.tab==='study')startStudy(false);
  if(b.dataset.tab==='list')renderList();
  $('main').scrollTop=0;
});

/* ---------- مطالعه ---------- */
let queue=[],cur=null,revealed=false,doneCount=0,totalInSession=0;
function dueCards(){const t=today();return cards.filter(c=>c.due<=t).sort((a,b)=>a.box-b.box||(a.due<b.due?-1:1));}
function renderStats(){
  const el=$('#boxStats');let h='';
  for(let b=1;b<=5;b++)h+=`<div><b>${cards.filter(c=>c.box===b).length}</b>جعبه ${b}</div>`;
  el.innerHTML=h;
}
function startStudy(force){
  renderStats();
  if(force||!queue.length&&!cur){
    queue=dueCards().slice(0,Math.max(1,settings.size|0));
    totalInSession=queue.length;doneCount=0;
  }
  next();
}
function next(){
  renderStats();
  cur=queue.shift()||null;revealed=false;
  const area=$('#studyArea');
  if(!cur){
    const left=dueCards().length;
    area.innerHTML=`<div class="empty">${cards.length?'🎉 مطالعهٔ این نوبت تمام شد!':'هنوز لغتی ندارید؛ از بخش «افزودن» مورد جدید اضافه کنید.'}<br>
      ${left?`<small>هنوز ${left} کارت سررسید دارد.</small><br><button class="btn primary" id="again" style="margin-top:12px">نوبت بعدی</button>`:'<small>کارت سررسیدشده‌ای باقی نمانده است. فردا دوباره سر بزنید.</small>'}</div>`;
    const a=$('#again');if(a)a.onclick=()=>startStudy(true);
    return;
  }
  draw();
}
function draw(){
  const c=cur,area=$('#studyArea');
  let h=`<div class="prog"><span>کارت ${doneCount+1} از ${totalInSession}</span><span>جعبه ${c.box}</span></div>
  <div class="flash" id="flash"><div class="word">${esc(c.w)}</div>${c.p?`<div class="pron">${esc(c.p)}</div>`:''}`;
  if(!revealed)h+=`<div class="tap">👆 برای دیدن معنی لمس کنید</div>`;
  else{
    h+=`<div class="meaning">${esc(c.m1)||'—'}</div>`;
    if(c.m2)h+=`<div class="meaning m2">${esc(c.m2)}</div>`;
    h+=`<div class="session">${c.s?esc(c.s):'جلسه'}</div>`;
  }
  h+='</div>';
  if(revealed)h+=`<div class="answer"><button class="btn no" id="no">❌ نمی‌دانستم</button><button class="btn yes" id="yes">✅ می‌دانستم</button></div>`;
  area.innerHTML=h;
  $('#flash').onclick=()=>{if(!revealed){revealed=true;draw();}};
  if(revealed){$('#no').onclick=()=>grade(false);$('#yes').onclick=()=>grade(true);}
}
function grade(ok){
  const c=cur;
  if(ok){c.box=Math.min(5,c.box+1);c.due=addDays(today(),INTERVALS[c.box-1]);}
  else{c.box=1;c.due=today();queue.push(c);totalInSession++;}
  doneCount++;persist();next();
}

/* ---------- افزودن ---------- */
function msg(t,err){const m=$('#addMsg');m.textContent=t;m.className='msg show'+(err?' err':'');m.scrollIntoView({behavior:'smooth',block:'center'});}
function addMany(rows){
  const have=new Set(cards.map(c=>c.w.toLowerCase()));let added=0,dup=0,bad=0;
  rows.forEach(r=>{
    const w=clean(r[0]);if(!w){bad++;return;}
    const k=w.toLowerCase();if(have.has(k)){dup++;return;}
    have.add(k);cards.push(mk(w,r[1],r[2],r[3],r[4]));added++;
  });
  persist();renderStats();
  return `✅ ${added} مورد اضافه شد`+(dup?` · ${dup} مورد تکراری نادیده گرفته شد`:'')+(bad?` · ${bad} ردیف نامعتبر`:'');
}
$('#addOne').onclick=()=>{
  const r=[$('#fWord').value,$('#fM1').value,$('#fM2').value,$('#fPron').value,$('#fSess').value];
  if(!clean(r[0])||!clean(r[1])){msg('لغت و معنی اول الزامی است.',true);return;}
  const t=addMany([r]);msg(t,t.indexOf('0 مورد اضافه')>=0);
  ['#fWord','#fM1','#fM2','#fPron','#fSess'].forEach(s=>$(s).value='');
};
const HEAD={'لغت':0,'word':0,'معنی اول':1,'معنی دوم':2,'تلفظ':3,'جلسه':4};
function mapRows(rows){
  rows=rows.filter(r=>r&&r.some(x=>clean(x)));
  if(!rows.length)return [];
  let idx=[0,1,2,3,4];
  const first=rows[0].map(x=>clean(x).toLowerCase());
  if(first.some(x=>x in HEAD)){
    idx=[-1,-1,-1,-1,-1];
    first.forEach((x,i)=>{if(x in HEAD&&idx[HEAD[x]]<0)idx[HEAD[x]]=i;});
    rows=rows.slice(1);
  }
  return rows.map(r=>idx.map(i=>i>=0?r[i]:''));
}
$('#addBulk').onclick=()=>{
  const lines=$('#bulkText').value.split(/\r?\n/).filter(l=>l.trim());
  if(!lines.length){msg('متنی وارد نشده است.',true);return;}
  const rows=lines.map(l=>{
    const sep=l.indexOf('\t')>=0?'\t':l.indexOf('|')>=0?'|':',';
    return l.split(sep).map(x=>x.trim());
  });
  msg(addMany(mapRows(rows)));$('#bulkText').value='';
};
$('#pickFile').onclick=()=>$('#xlsxFile').click();
$('#xlsxFile').onchange=e=>{
  const f=e.target.files[0];if(!f)return;
  const rd=new FileReader();
  rd.onload=ev=>{
    try{
      const wb=XLSX.read(new Uint8Array(ev.target.result),{type:'array'});
      let sh=wb.Sheets['لغات']||wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(sh,{header:1,defval:''});
      const mapped=mapRows(rows).map(r=>{ // تمیزکاری ستون جلسه مثل «01.pdf (جلسه اول)»
        const m=/\((.*?)\)/.exec(clean(r[4]));if(m)r[4]=m[1];return r;});
      msg(addMany(mapped));
    }catch(err){msg('خواندن فایل ناموفق بود: '+err.message,true);}
    e.target.value='';
  };
  rd.readAsArrayBuffer(f);
};

/* ---------- فهرست لغات ---------- */
function renderList(){
  const q=clean($('#search').value).toLowerCase();
  const list=cards.filter(c=>!q||c.w.toLowerCase().includes(q)||c.m1.includes(q)||c.m2.includes(q));
  $('#listCount').textContent=`${list.length} مورد از ${cards.length}`;
  $('#listArea').innerHTML=list.slice(0,300).map(c=>`<div class="item"><div>
    <div class="w">${esc(c.w)}</div>${c.p?`<div class="p">${esc(c.p)}</div>`:''}
    <div class="m">${esc(c.m1)}${c.m2?' ؛ '+esc(c.m2):''}</div>${c.s?`<div class="s">${esc(c.s)}</div>`:''}
    </div><button data-id="${c.id}" aria-label="حذف">🗑️</button></div>`).join('')+(list.length>300?'<div class="hint">برای دیدن بقیه، جستجو کنید…</div>':'');
  $$('#listArea button').forEach(b=>b.onclick=()=>{
    if(confirm('این مورد حذف شود؟')){cards=cards.filter(c=>c.id!==b.dataset.id);persist();renderList();renderStats();}
  });
}
$('#search').oninput=renderList;

/* ---------- تنظیمات ---------- */
$('#sessSize').value=settings.size;
$('#sessSize').onchange=e=>{settings.size=Math.min(200,Math.max(5,parseInt(e.target.value)||20));e.target.value=settings.size;save(KEY_SET,settings);};
$('#resetProg').onclick=()=>{
  if(confirm('همهٔ کارت‌ها به جعبهٔ ۱ برگردند؟')){cards.forEach(c=>{c.box=1;c.due=today();});persist();queue=[];cur=null;msg&&0;startStudy(true);alert('انجام شد.');}
};

applyTheme();startStudy(true);
})();
