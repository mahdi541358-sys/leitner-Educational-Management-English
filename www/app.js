(function(){
'use strict';
const $=s=>document.querySelector(s), $$=s=>[...document.querySelectorAll(s)];
const KEY_CARDS='lb_cards_v1', KEY_SET='lb_settings_v1', KEY_SEEDV='lb_seedv_v1';
const INTERVALS=[1,2,4,8,16]; // روز؛ جعبه ۱ تا ۵
const esc=s=>String(s==null?'':s).replace(/[&<>"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;'}[c]));
const pad=n=>String(n).padStart(2,'0');
const today=()=>{const d=new Date();return d.getFullYear()+'-'+pad(d.getMonth()+1)+'-'+pad(d.getDate());};
const addDays=(iso,n)=>{const [y,m,d]=iso.split('-').map(Number);const t=new Date(y,m-1,d+n);return t.getFullYear()+'-'+pad(t.getMonth()+1)+'-'+pad(t.getDate());};
const clean=s=>String(s==null?'':s).trim();

function load(k,def){try{const v=localStorage.getItem(k);return v?JSON.parse(v):def;}catch(e){return def;}}
function save(k,v){try{localStorage.setItem(k,JSON.stringify(v));}catch(e){}}

let settings=Object.assign({theme:'auto',size:20,accent:'us',gender:'f',voice:'',sess:''},load(KEY_SET,{}));
const saveSet=()=>save(KEY_SET,settings);

function mk(w,m1,m2,p,s,u){const c={id:Date.now().toString(36)+Math.random().toString(36).slice(2,7),w:clean(w),m1:clean(m1),m2:clean(m2),p:clean(p),s:clean(s),box:1,due:today()};if(u)c.u=1;return c;}
function build(rows,old,u){ // ساخت کارت‌ها با حفظ پیشرفت لغات مشترک
  const prog=new Map((old||[]).map(c=>[c.w.toLowerCase(),c]));
  const seen=new Set(),out=[];
  rows.forEach(r=>{
    const w=clean(r[0]);if(!w||seen.has(w.toLowerCase()))return;seen.add(w.toLowerCase());
    const c=mk(w,r[1],r[2],r[3],r[4],u);const o=prog.get(w.toLowerCase());
    if(o){c.box=o.box;c.due=o.due;}out.push(c);
  });
  return out;
}
const SEEDV=window.SEED_VERSION||1;
let cards=load(KEY_CARDS,null);
if(!cards){cards=build(window.SEED_WORDS||[],null,false);save(KEY_CARDS,cards);save(KEY_SEEDV,SEEDV);}
else if(load(KEY_SEEDV,0)!==SEEDV){ // نسخهٔ جدید لیست لغات: جایگزینی با حفظ پیشرفت
  const keep=cards.filter(c=>c.u);
  const nw=build(window.SEED_WORDS||[],cards,false);
  const have=new Set(nw.map(c=>c.w.toLowerCase()));
  cards=nw.concat(keep.filter(c=>!have.has(c.w.toLowerCase())));
  save(KEY_CARDS,cards);save(KEY_SEEDV,SEEDV);
}
const persist=()=>save(KEY_CARDS,cards);

/* ---------- جلسه‌ها و فیلتر ---------- */
const ORD=['اول','دوم','سوم','چهارم','پنجم','ششم','هفتم','هشتم','نهم','دهم','یازدهم','دوازدهم','سیزدهم','چهاردهم','پانزدهم','شانزدهم'];
function sessKey(s){const i=ORD.indexOf(clean(s).split(/\s+/).pop());return i<0?100:i;}
function sessions(){return [...new Set(cards.map(c=>c.s).filter(Boolean))].sort((a,b)=>sessKey(a)-sessKey(b)||a.localeCompare(b,'fa'));}
const inFilter=c=>!settings.sess||c.s===settings.sess;
function renderFilters(){
  const ss=sessions();if(settings.sess&&!ss.includes(settings.sess))settings.sess='';
  const h='<option value="">همهٔ جلسات</option>'+ss.map(s=>`<option value="${esc(s)}"${s===settings.sess?' selected':''}>${esc(s)} (${cards.filter(c=>c.s===s).length})</option>`).join('');
  $('#sessFilter').innerHTML=h;
  const lf=$('#listFilter');if(lf)lf.innerHTML=h;
}
$('#sessFilter').onchange=e=>{settings.sess=e.target.value;saveSet();queue=[];cur=null;startStudy(true);};

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
  settings.theme=cur==='dark'?'light':'dark';saveSet();applyTheme();
};
$$('#themeSeg button').forEach(b=>b.onclick=()=>{settings.theme=b.dataset.t;saveSet();applyTheme();});

/* ---------- تب‌ها ---------- */
$$('.bottom button').forEach(b=>b.onclick=()=>{
  $$('.bottom button').forEach(x=>x.classList.remove('active'));b.classList.add('active');
  $$('.tab').forEach(t=>t.classList.remove('active'));$('#tab-'+b.dataset.tab).classList.add('active');
  if(b.dataset.tab==='study')startStudy(false);
  if(b.dataset.tab==='list')renderList();
  if(b.dataset.tab==='info')renderVoices();
  $('main').scrollTop=0;
});

/* ---------- تلفظ (TTS گوشی) ---------- */
const TTS=()=>window.Capacitor&&Capacitor.Plugins&&Capacitor.Plugins.TextToSpeech;
const F_CODES=['sfg','tpf','tpc','iob','iof','gba','gbc','fis'], M_CODES=['iol','iom','tpd','gbb','gbd','rjs'];
function genderOf(v){
  const n=((v.name||'')+' '+(v.uri||'')).toLowerCase();
  if(/female|woman/.test(n))return 'f';
  if(/\bmale\b|\bman\b/.test(n))return 'm';
  const m=/-x-([a-z]{3})/.exec(n);
  if(m){if(F_CODES.includes(m[1]))return 'f';if(M_CODES.includes(m[1]))return 'm';}
  if(/samantha|karen|serena|moira|tessa|fiona|victoria|susan|zira|hazel|kate|stephanie/.test(n))return 'f';
  if(/daniel|alex|fred|oliver|george|david|mark|rishi|arthur/.test(n))return 'm';
  return '';
}
let voiceCache=null;
async function loadVoices(){
  if(voiceCache&&voiceCache.length)return voiceCache;
  let list=[];
  try{
    const t=TTS();
    if(t){const r=await t.getSupportedVoices();list=(r.voices||[]).map((v,i)=>({index:i,name:v.name||v.voiceURI||('voice '+i),uri:v.voiceURI||'',lang:String(v.lang||'').replace('_','-')}));}
    else if(window.speechSynthesis){list=(speechSynthesis.getVoices()||[]).map((v,i)=>({index:i,name:v.name,uri:v.voiceURI,lang:String(v.lang||'').replace('_','-')}));}
  }catch(e){}
  voiceCache=list;return list;
}
const accentLang=()=>settings.accent==='uk'?'en-GB':'en-US';
function pickVoice(list,lang){
  const L=list.filter(v=>v.lang.toLowerCase()===lang.toLowerCase());
  if(settings.voice){const s=L.find(v=>(v.uri||v.name)===settings.voice);if(s)return {v:s,exact:true};}
  const g=L.find(v=>genderOf(v)===settings.gender);
  if(g)return {v:g,exact:true};
  return {v:L[0]||null,exact:false};
}
async function speak(text){
  const lang=accentLang();
  try{
    const list=await loadVoices();
    const {v,exact}=pickVoice(list,lang);
    const pitch=exact?1.0:(settings.gender==='f'?1.25:0.8);
    const t=TTS();
    if(t){
      await t.stop().catch(()=>{});
      const o={text:text,lang:lang,rate:0.9,pitch:pitch,volume:1.0,category:'ambient'};
      if(v)o.voice=v.index;
      await t.speak(o);
    }else{
      const u=new SpeechSynthesisUtterance(text);u.lang=lang;u.rate=0.9;u.pitch=pitch;
      if(v){const sv=(speechSynthesis.getVoices()||[])[v.index];if(sv)u.voice=sv;}
      speechSynthesis.cancel();speechSynthesis.speak(u);
    }
  }catch(e){alert('تلفظ روی این دستگاه انجام نشد. در تنظیمات گوشی، موتور «تبدیل متن به گفتار» (مثلاً Google) را فعال و صدای انگلیسی را دانلود کنید.');}
}
async function renderVoices(){
  $$('#accentSeg button').forEach(b=>b.classList.toggle('on',b.dataset.a===settings.accent));
  $$('#genderSeg button').forEach(b=>b.classList.toggle('on',b.dataset.g===settings.gender));
  const list=(await loadVoices()).filter(v=>v.lang.toLowerCase()===accentLang().toLowerCase());
  const sel=$('#voiceSel');
  sel.innerHTML='<option value="">خودکار (بر اساس خانم/آقا)</option>'+list.map(v=>{
    const g=genderOf(v);const tag=g==='f'?' 👩':g==='m'?' 👨':'';
    return `<option value="${esc(v.uri||v.name)}"${(v.uri||v.name)===settings.voice?' selected':''}>${esc(v.name)}${tag}</option>`;}).join('');
}
$$('#accentSeg button').forEach(b=>b.onclick=()=>{settings.accent=b.dataset.a;settings.voice='';saveSet();renderVoices();});
$$('#genderSeg button').forEach(b=>b.onclick=()=>{settings.gender=b.dataset.g;settings.voice='';saveSet();renderVoices();});
$('#voiceSel').onchange=e=>{settings.voice=e.target.value;saveSet();};
$('#testVoice').onclick=()=>speak('Educational management');

/* ---------- مطالعه ---------- */
let queue=[],cur=null,revealed=false,doneCount=0,totalInSession=0;
function dueCards(){const t=today();return cards.filter(c=>inFilter(c)&&c.due<=t).sort((a,b)=>a.box-b.box||(a.due<b.due?-1:1));}
function renderStats(){
  let h='';const f=cards.filter(inFilter);
  for(let b=1;b<=5;b++)h+=`<div><b>${f.filter(c=>c.box===b).length}</b>جعبه ${b}</div>`;
  $('#boxStats').innerHTML=h;
}
function startStudy(force){
  renderFilters();renderStats();
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
    const left=dueCards().length,total=cards.filter(inFilter).length;
    area.innerHTML=`<div class="empty">${total?'🎉 مطالعهٔ این نوبت تمام شد!':'کارتی در این بخش نیست؛ از «افزودن» مورد جدید اضافه کنید.'}<br>
      ${left?`<small>هنوز ${left} کارت سررسید دارد.</small><br><button class="btn primary" id="again" style="margin-top:12px">نوبت بعدی</button>`:(total?'<small>کارت سررسیدشده‌ای باقی نمانده است. فردا دوباره سر بزنید.</small>':'')}</div>`;
    const a=$('#again');if(a)a.onclick=()=>startStudy(true);
    return;
  }
  draw();
}
const SPK='<svg viewBox="0 0 24 24"><path d="M3 9v6h4l5 5V4L7 9H3zm13.5 3a4.5 4.5 0 0 0-2.5-4.03v8.05A4.5 4.5 0 0 0 16.5 12zM14 3.23v2.06a7 7 0 0 1 0 13.42v2.06a9 9 0 0 0 0-17.54z"/></svg>';
function draw(){
  const c=cur,area=$('#studyArea');
  let h=`<div class="prog"><span>کارت ${doneCount+1} از ${totalInSession}</span><span>جعبه ${c.box}</span></div>
  <div class="flash" id="flash"><div class="word">${esc(c.w)}</div>
  <button class="big-speaker" id="spk" aria-label="تلفظ">${SPK}</button>${c.p?`<div class="pron">${esc(c.p)}</div>`:''}`;
  if(!revealed)h+=`<div class="tap">👆 برای دیدن معنی، کارت را لمس کنید</div>`;
  else{
    h+=`<div class="meaning">${esc(c.m1)||'—'}</div>`;
    if(c.m2)h+=`<div class="meaning m2">${esc(c.m2)}</div>`;
    h+=`<div class="session">${c.s?esc(c.s):'جلسه'}</div>`;
  }
  h+='</div>';
  if(revealed)h+=`<div class="answer"><button class="btn no" id="no">❌ نمی‌دانستم</button><button class="btn yes" id="yes">✅ می‌دانستم</button></div>`;
  area.innerHTML=h;
  $('#flash').onclick=()=>{if(!revealed){revealed=true;draw();}};
  $('#spk').onclick=e=>{e.stopPropagation();speak(c.w);};
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
    have.add(k);cards.push(mk(w,r[1],r[2],r[3],r[4],true));added++;
  });
  persist();renderStats();renderFilters();
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
function readExcel(file,cb){
  const rd=new FileReader();
  rd.onload=ev=>{
    try{
      const wb=XLSX.read(new Uint8Array(ev.target.result),{type:'array'});
      const sh=wb.Sheets['لغات']||wb.Sheets[wb.SheetNames[0]];
      const rows=XLSX.utils.sheet_to_json(sh,{header:1,defval:''});
      cb(mapRows(rows).map(r=>{const m=/\((.*?)\)/.exec(clean(r[4]));if(m)r[4]=m[1];return r;}));
    }catch(err){msg('خواندن فایل ناموفق بود: '+err.message,true);}
  };
  rd.readAsArrayBuffer(file);
}
$('#pickFile').onclick=()=>$('#xlsxFile').click();
$('#xlsxFile').onchange=e=>{
  const f=e.target.files[0];if(!f)return;
  readExcel(f,rows=>msg(addMany(rows)));e.target.value='';
};
$('#replaceFile').onclick=()=>$('#xlsxReplace').click();
$('#xlsxReplace').onchange=e=>{
  const f=e.target.files[0];if(!f)return;
  readExcel(f,rows=>{
    if(!rows.length){msg('فایل خالی است.',true);return;}
    if(!confirm('لیست فعلی ('+cards.length+' مورد) حذف و '+rows.length+' ردیف فایل جایگزین شود؟')){return;}
    cards=build(rows,cards,true);persist();queue=[];cur=null;renderStats();renderFilters();
    msg('✅ لیست با '+cards.length+' مورد جایگزین شد.');
  });
  e.target.value='';
};

/* ---------- فهرست لغات ---------- */
let listSess='';
function renderList(){
  renderFilters();
  const lf=$('#listFilter');lf.value=listSess;
  const q=clean($('#search').value).toLowerCase();
  const list=cards.filter(c=>(!listSess||c.s===listSess)&&(!q||c.w.toLowerCase().includes(q)||c.m1.includes(q)||c.m2.includes(q)));
  $('#listCount').textContent=`${list.length} مورد از ${cards.length}`;
  $('#listArea').innerHTML=list.slice(0,300).map(c=>`<div class="item"><div>
    <div class="w">${esc(c.w)}</div>${c.p?`<div class="p">${esc(c.p)}</div>`:''}
    <div class="m">${esc(c.m1)}${c.m2?' ؛ '+esc(c.m2):''}</div>${c.s?`<div class="s">${esc(c.s)}</div>`:''}
    </div><button data-id="${c.id}" aria-label="حذف">🗑️</button></div>`).join('')+(list.length>300?'<div class="hint">برای دیدن بقیه، جستجو یا فیلتر کنید…</div>':'');
  $$('#listArea button').forEach(b=>b.onclick=()=>{
    if(confirm('این مورد حذف شود؟')){cards=cards.filter(c=>c.id!==b.dataset.id);persist();renderList();renderStats();}
  });
}
$('#search').oninput=renderList;
$('#listFilter').onchange=e=>{listSess=e.target.value;renderList();};

/* ---------- تنظیمات ---------- */
$('#sessSize').value=settings.size;
$('#sessSize').onchange=e=>{settings.size=Math.min(200,Math.max(5,parseInt(e.target.value)||20));e.target.value=settings.size;saveSet();};
$('#resetProg').onclick=()=>{
  if(confirm('همهٔ کارت‌ها به جعبهٔ ۱ برگردند؟')){cards.forEach(c=>{c.box=1;c.due=today();});persist();queue=[];cur=null;startStudy(true);alert('انجام شد.');}
};

applyTheme();startStudy(true);
})();
