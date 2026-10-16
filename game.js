/* Pure, deterministic simulation. No DOM, network, timers or storage access. */
(function (root, factory) {
  const labyrinth = typeof module === 'object' && module.exports ? require('./labyrinth.js') : root.WithdrawLabyrinth;
  const api = factory(labyrinth);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else root.WithdrawGame = api;
})(typeof globalThis !== 'undefined' ? globalThis : this, function (L) {
  'use strict';
  const VERSION = 1;
  const LIMIT = 1e12;
  const ROUTES = ['HOME', 'マイページ', '設定', 'その他', 'お得情報', 'キャンペーン', 'ソフトクリーム', '味', 'ミックス', '退会希望', '退会要望', '退会要請', '味', '抹茶', '退会ページ'];
  const CATALOG = [
    {id:'clock', name:'ゼンマイ式の置き時計', cat:'生活道具', base:110, value:205, time:12, unlock:0, tag:'小さく始める', art:'clock', color:'#e9dec9'},
    {id:'camera', name:'旅の記憶のフィルムカメラ', cat:'カメラ', base:240, value:425, time:17, unlock:0, tag:'定番の人気', art:'camera', color:'#dce5dd'},
    {id:'radio', name:'ポケットラジオ / 1984', cat:'オーディオ', base:160, value:295, time:14, unlock:0, tag:'動作確認済', art:'radio', color:'#dfe3ed'},
    {id:'lamp', name:'真鍮のデスクランプ', cat:'生活道具', base:210, value:390, time:16, unlock:0, tag:'古い、がいい', art:'lamp', color:'#ece3cf'},
    {id:'record', name:'夜更けのジャズ LP', cat:'オーディオ', base:85, value:165, time:10, unlock:0, tag:'回転のよい一枚', art:'record', color:'#ebd9d3'},
    {id:'console', name:'レトロな携帯ゲーム機', cat:'ゲーム', base:350, value:620, time:20, unlock:0, tag:'電池は別売り', art:'console', color:'#e2dded'},
    {id:'typewriter', name:'手紙を書くためのタイプライター', cat:'生活道具', base:650, value:1120, time:24, unlock:5, tag:'次の仕入れへ', art:'typewriter', color:'#d4e4e2'},
    {id:'headphones', name:'スタジオヘッドホン', cat:'オーディオ', base:460, value:820, time:21, unlock:5, tag:'音のある暮らし', art:'headphones', color:'#e4dfd4'},
    {id:'lens', name:'オールドレンズ 50mm', cat:'カメラ', base:950, value:1670, time:26, unlock:12, tag:'一点もの', art:'lens', color:'#d9e3ea'},
    {id:'turntable', name:'木目のレコードプレーヤー', cat:'オーディオ', base:1350, value:2400, time:29, unlock:12, tag:'針先にロマン', art:'turntable', color:'#e7d6bf'},
    {id:'synth', name:'アナログシンセサイザー', cat:'オーディオ', base:2800, value:5100, time:34, unlock:25, tag:'店の看板商品', art:'synth', color:'#dfe2db'},
    {id:'watch', name:'ヴィンテージ腕時計', cat:'生活道具', base:5500, value:9800, time:38, unlock:45, tag:'コレクター向け', art:'watch', color:'#e2ddcc'}
  ];
  const BOTS = {
    lister: {name:'出品Bot', code:'LIST-01', cost:260, color:'#daece4', desc:'在庫を順番に自動出品。レベルが上がるほど作業が速くなる。'},
    buyer: {name:'仕入れBot', code:'BUY-02', cost:620, color:'#e8e2f0', desc:'利益率のよい商品を自動で仕入れる。指定した運転資金は残す。'},
    seller: {name:'接客Bot', code:'SELL-03', cost:900, color:'#f0e3cf', desc:'全出品の販売速度をレベルごとに22%加速する。'},
    clock: {name:'延長Bot', code:'TIME-04', cost:1100, color:'#dde8f2', desc:'退会ページの制限時間をレベルごとに3秒延長する。'},
    solver: {name:'手続きBot', code:'FORM-05', cost:1600, color:'#e8e9cd', desc:'ページ移動・ロック解除・チェック解除を自動化。Lv2〜4で入口、Lv5〜10で深層ロック、Lv11で最終明細、Lv12で本送信。'},
    shield: {name:'監査Bot', code:'AUDIT-06', cost:2300, color:'#efdcd7', desc:'没収されるデポジットを一部保護。Lv1〜3で入口の罠、Lv4〜9で封印・認証・差し戻し・規約・受付窓・偽完了に対抗。'}
  };
  const RESEARCH = {
    ...L.RESEARCH,
    bookmark: {name:'手続きのブックマーク', cost:3, max:1, desc:'発見済みの退会導線をスキップできる。'},
    latch: {name:'チェック固定パッチ', cost:5, max:1, desc:'勝手に入れ直されるチェックを永久に無効化。'},
    discount: {name:'デポジット交渉術', cost:4, max:3, desc:'預託額を1レベルにつき10%引き下げる。'},
    polish: {name:'古物の目利き', cost:4, max:5, desc:'商品の販売価格を1レベルにつき8%上乗せする。'}
  };
  const TRAPS = {
    ...L.TRAPS,
    timer:'2秒で強制ログアウト', lock:'外せないチェックボックス', recheck:'チェックの自動復活', fly:'「はい（蝿）」の偽ボタン', advert:'閉じるほど増える広告', escape:'カーソルから逃げるボタン', captcha:'抹茶だけを選ぶ画像認証', terms:'最後まで読ませる規約', revision:'終わらない規約改訂'
  };
  const product = id => CATALOG.find(x => x.id === id);
  const int = (n, fallback=0, max=LIMIT) => typeof n === 'number' && Number.isFinite(n) ? Math.min(max, Math.max(0, Math.floor(n))) : fallback;
  function rand(s) { s.seed = (Math.imul(s.seed, 1664525) + 1013904223) >>> 0; return s.seed / 4294967296; }
  function level(s, id) { return s.bots[id].on ? s.bots[id].level : 0; }
  function record(s, label, delta=0, kind='info') {
    s.ledger.unshift({id:s.nextId++, at:Math.floor(s.elapsed), label, delta, kind});
    s.ledger = s.ledger.slice(0,100);
  }
  function credit(s, amount, label, kind='income') {
    const delta = Math.min(LIMIT-s.coins, Math.max(0, Math.round(amount)));
    s.coins += delta; record(s, label, delta, kind); return delta;
  }
  function spend(s, amount, label, kind='spend') {
    if (!Number.isSafeInteger(amount) || amount < 0 || s.coins < amount) return false;
    s.coins -= amount; record(s, label, -amount, kind); return true;
  }
  function refreshMarket(s) {
    s.market = Object.fromEntries(CATALOG.map(p=>[p.id, {price:Math.round(p.base*(.77+rand(s)*.44)), stock:2+Math.floor(rand(s)*3)}]));
    s.marketTime = 30;
  }
  function createState(now=Date.now(), seed=724613) {
    const s = {version:VERSION, seed:seed>>>0, nextId:1, coins:1200, elapsed:0, savedAt:now, marketTime:30, market:{}, inventory:[],
      bots:Object.fromEntries(Object.keys(BOTS).map(k=>[k,{level:0,on:true,clock:0}])),
      research:Object.fromEntries(Object.keys(RESEARCH).map(k=>[k,0])), shelves:0, data:0, cycle:0,
      settings:{reserve:500, strategy:'normal', sound:false, reducedMotion:false},
      profile:{shop:'余白古物店', newsletter:true, flavor:'mix', reason:'退会したい', comment:''},
      path:0, discovered:0, navClock:0, attempt:null, lastResult:null, findings:[], ledger:[], work:0,
      stats:{bought:0,sold:0,revenue:0,profit:0,attempts:0,lost:0,refunded:0,breakthroughs:0,work:0,deepest:0,gates:0,rollbacks:0},
      milestones:[], welcome:true};
    refreshMarket(s); record(s, '開店資金を受け取りました', 1200, 'income'); return s;
  }
  function capacity(s) { return 8+s.shelves*4; }
  function deposit(s) { return Math.round(500*(1+Math.floor(s.stats.attempts/4)*.2)*(1+s.cycle*.65)*(1-s.research.discount*.1)); }
  function botCost(s, id) { return BOTS[id] ? Math.round(BOTS[id].cost*1.72**s.bots[id].level) : Infinity; }
  function botInterval(s, id) { return (id==='lister'?7:11)/(1+.36*Math.max(0,level(s,id)-1)); }
  function quote(s, id, strategy=s.settings.strategy) {
    const p=product(id); if(!p) return null;
    const factor = {quick:[.83,.6],normal:[1,1],premium:[1.35,1.9]}[strategy] || [1,1];
    return {price:Math.round(p.value*factor[0]*(1+s.research.polish*.08)*(1+s.cycle*.12)), time:p.time*factor[1]};
  }
  function buy(s, id) {
    const p=product(id), m=s.market[id];
    if(!p || !m || s.stats.sold<p.unlock) return {ok:false,message:'販売実績を積むと仕入れが解放されます。'};
    if(s.inventory.length>=capacity(s)) return {ok:false,message:'保管棚がいっぱいです。出品するか棚を拡張してください。'};
    if(m.stock<=0) return {ok:false,message:'売り切れです。次の市場更新をお待ちください。'};
    if(!spend(s,m.price,p.name+'を仕入れ','buy')) return {ok:false,message:'仕入れ資金が足りません。'};
    s.inventory.push({uid:s.nextId++,product:id,paid:m.price,status:'stock',ask:0,remaining:0,total:0});
    m.stock--; s.stats.bought++; return {ok:true,message:'仕入れました。「自分の店」から出品できます。'};
  }
  function list(s, uid) {
    const item=s.inventory.find(i=>i.uid===uid); if(!item||item.status!=='stock') return {ok:false,message:'この商品は出品済みです。'};
    const q=quote(s,item.product); Object.assign(item,{status:'listed',ask:q.price,remaining:q.time,total:q.time});
    return {ok:true,message:'出品しました。お客さまを待ちましょう。'};
  }
  function listAll(s) { let count=0; s.inventory.forEach(i=>{if(i.status==='stock'){list(s,i.uid);count++;}}); return count; }
  function upgradeBot(s,id) {
    if(!BOTS[id]||s.bots[id].level>=12) return {ok:false,message:'最大レベルです。'};
    if(!spend(s,botCost(s,id),BOTS[id].name+'を購入・強化','bot')) return {ok:false,message:'CCが足りません。'};
    s.bots[id].level++; s.bots[id].on=true; return {ok:true,message:BOTS[id].name+'が Lv.'+s.bots[id].level+' になりました。'};
  }
  function research(s,id) {
    const r=RESEARCH[id]; if(!r||s.research[id]>=r.max) return {ok:false,message:'研究済みです。'};
    const cost=r.cost+s.research[id]*3;
    if(s.data<cost) return {ok:false,message:'解析データが足りません。退会に挑むと手に入ります。'};
    s.data-=cost; s.research[id]++; record(s,r.name+'を研究',0,'research'); return {ok:true,message:'研究が完了しました。'};
  }
  function shelfCost(s) { return Math.round(300*1.7**s.shelves); }
  function upgradeShelf(s) {
    if(s.shelves>=12) return {ok:false,message:'これ以上拡張できません。'};
    if(!spend(s,shelfCost(s),'保管棚の拡張','upgrade')) return {ok:false,message:'CCが足りません。'};
    s.shelves++; return {ok:true,message:'保管できる商品が4個増えました。'};
  }
  function discover(s,id) { if(TRAPS[id]&&!s.findings.includes(id)){s.findings.push(id); s.data++; record(s,'妨害を発見：'+TRAPS[id],0,'finding');} }
  function navigate(s,index) {
    index=int(index,0,14);
    // The deposit gate is authoritative; a bookmark is not a free entry.
    if(index===14&&!s.attempt) return {ok:false,gate:true,message:'入場にはデポジットが必要です。'};
    if(!s.attempt && index>s.discovered+1 && !s.research.bookmark) return {ok:false,message:'まだ見つけていないページです。順番に進んでください。'};
    s.path=index; s.discovered=Math.max(s.discovered,index); s.navClock=0; return {ok:true};
  }
  function startAttempt(s) {
    if(s.attempt) return {ok:false,message:'すでに退会ページへ入場しています。'};
    if(s.discovered<13) return {ok:false,message:'まずは抹茶の認証ページまで進んでください。'};
    const cost=deposit(s);
    if(!spend(s,cost,'退会デポジットを預託','deposit')) return {ok:false,message:'デポジットが足りません。お店でCCを稼いでください。'};
    s.stats.attempts++; const order=Array.from({length:9},(_,i)=>i);
    for(let i=8;i>0;i--){const j=Math.floor(rand(s)*(i+1));[order[i],order[j]]=[order[j],order[i]];}
    s.attempt={id:s.nextId++,deposit:cost,remaining:2+3*level(s,'clock'),duration:2+3*level(s,'clock'),age:0,
      checks:[true,true,true], unlocked:false, targets:order.slice(0,3), selected:[], captcha:false, terms:false,
      popup:false, adSeen:false, evades:level(s,'shield')?0:2+Math.min(3,s.cycle), position:0, recheckAt:3, botClock:0, progress:0};
    s.attempt.labyrinth=L.create(s,labServices);
    s.path=14; s.discovered=14; s.lastResult=null;
    discover(s,'timer'); discover(s,'lock'); return {ok:true,message:'デポジットを預託しました。退会手続きを開始します。'};
  }
  function refundRate(s) { return Math.min(.8,level(s,'shield')*.12); }
  function settle(s, reason, breakthrough=false) {
    const a=s.attempt; if(!a) return null;
    // Clear before crediting so a second click/reload cannot settle twice.
    s.attempt=null;
    const rate=breakthrough?.8:Math.max(refundRate(s),a.checks[2]?0:.55);
    const refund=Math.round(a.deposit*rate), loss=a.deposit-refund;
    if(refund) credit(s,refund,'退会デポジットの返還','refund');
    s.stats.refunded+=refund; s.stats.lost+=loss;
    const data=1+Math.floor(Math.min(12,a.progress)/2)+(breakthrough?3:0); s.data+=data;
    if(breakthrough){s.cycle++;s.stats.breakthroughs++;discover(s,'revision');}
    const result={id:a.id,reason,deposit:a.deposit,refund,loss,data,breakthrough,cycle:s.cycle,stage:a.labyrinth?.stage||0,highest:a.labyrinth?.highest||0,faults:a.labyrinth?.faults||0};
    s.lastResult=result; s.path=1;
    record(s,(breakthrough?'規約が改訂されました':'退会失敗：'+reason)+' / '+loss+' CC 没収',0,'attempt');
    return result;
  }
  function unlock(s) {
    if(!frontActive(s)) return {ok:false,message:'入口フォームを操作できません。'};
    if(!s.attempt.unlocked){s.attempt.unlocked=true;s.attempt.progress++;}
    return {ok:true,message:'ロック解除。チェックを外してください。'};
  }
  function setCheck(s,index,checked) {
    const a=s.attempt;
    if(!frontActive(s)||!a.unlocked||!Number.isInteger(index)||index<0||index>2) return {ok:false,message:'チェックボックスはロックされています。'};
    if(a.checks[index]&&!checked) a.progress=Math.min(7,a.progress+1);
    a.checks[index]=Boolean(checked); return {ok:true};
  }
  function captcha(s,index) {
    const a=s.attempt; if(!frontActive(s)) return {ok:false}; discover(s,'captcha');
    if(a.captcha) return {ok:true};
    if(!a.targets.includes(index)){a.selected=[];a.remaining=Math.max(0,a.remaining-.7);return {ok:false,message:'それは、わさびです。残り時間 -0.7秒。'};}
    if(!a.selected.includes(index)) a.selected.push(index);
    if(a.selected.length===3){a.captcha=true;a.progress++;}
    return {ok:true,message:a.captcha?'画像認証が完了しました。':'抹茶を選択しました。'};
  }
  function acceptTerms(s) { const a=s.attempt;if(!frontActive(s))return;discover(s,'terms');if(!a.terms){a.terms=true;a.progress++;} }
  function evade(s) {
    const a=s.attempt; if(!frontActive(s)||a.evades<=0) return false;
    if(level(s,'shield')) {a.evades=0;return false;}
    discover(s,'escape');a.evades--;a.position=(a.position+1)%3;return true;
  }
  function dismissAd(s,real) {
    const a=s.attempt;if(!frontActive(s))return;
    discover(s,'advert');if(real)a.popup=false;else{a.remaining=Math.max(0,a.remaining-.6);a.popup=true;}
  }
  function submit(s) {
    const a=s.attempt;if(!a)return {ok:false,message:'退会ページに入場してください。'};
    if(a.remaining<=0){settle(s,'時間切れ');return {ok:false,message:'時間切れです。'};}
    if(a.labyrinth.stage!==0)return {ok:false,message:'入口は通過済みです。現在の層のロックを解除してください。'};
    if(a.popup) return {ok:false,message:'広告を本当に閉じてください。'};
    if(!a.unlocked||a.checks.some(Boolean)) return {ok:false,message:'3つのチェックを外してください。'};
    if(!a.captcha){discover(s,'captcha');return {ok:false,message:'抹茶の画像認証が残っています。'};}
    if(!a.terms){discover(s,'terms');return {ok:false,message:'規約を最後まで読んでください。'};}
    if(evade(s))return {ok:false,message:'ボタンが逃げました。もう一度。'};
    return L.clear(s,labServices);
  }
  function fly(s) { if(!frontActive(s))return;discover(s,'fly');settle(s,'「はい（蝿）」で蝿プランに加入'); }
  function autoForm(s,dt) {
    const lv=level(s,'solver');if(!lv)return;
    if(!s.attempt){if(s.path>0&&s.path<13){s.navClock+=dt;if(s.navClock>=Math.max(.4,2-lv*.2)){navigate(s,s.path+1);s.navClock=0;}}return;}
    const a=s.attempt;a.botClock+=dt;if(a.botClock<Math.max(.18,1.1-lv*.12))return;a.botClock=0;
    if(a.labyrinth.stage>0){L.auto(s,labServices,lv);return;}
    if(!a.unlocked){unlock(s);return;}
    const checked=a.checks.findIndex(Boolean);if(checked>=0){setCheck(s,checked,false);return;}
    if(lv>=2&&!a.captcha){const next=a.targets.find(i=>!a.selected.includes(i));captcha(s,next);return;}
    if(lv>=3&&!a.terms){acceptTerms(s);return;}
    if(lv>=3&&a.popup){dismissAd(s,true);return;}
    if(lv>=4)submit(s);
  }
  function step(s,dt) {
    s.elapsed+=dt;s.marketTime-=dt;
    if(s.marketTime<=0)refreshMarket(s);
    if(s.work>0){s.work=Math.max(0,s.work-dt);if(s.work===0){credit(s,40,'梱包バイトの報酬','work');s.stats.work++;}}
    const speed=1+level(s,'seller')*.22;
    for(const item of [...s.inventory]){
      if(item.status!=='listed')continue;
      item.remaining=Math.max(0,item.remaining-dt*speed);
      if(item.remaining===0){s.inventory=s.inventory.filter(i=>i.uid!==item.uid);credit(s,item.ask,product(item.product).name+'が売れました','sale');s.stats.sold++;s.stats.revenue+=item.ask;s.stats.profit+=item.ask-item.paid;}
    }
    for(const id of ['lister','buyer']){
      if(!level(s,id))continue;
      const b=s.bots[id];b.clock+=dt;
      if(b.clock<botInterval(s,id))continue;b.clock-=botInterval(s,id);
      if(id==='lister'){const item=s.inventory.find(i=>i.status==='stock');if(item)list(s,item.uid);}
      else if(s.inventory.length<capacity(s)){
        const choices=CATALOG.filter(p=>s.stats.sold>=p.unlock&&s.market[p.id].stock>0&&s.coins-s.market[p.id].price>=s.settings.reserve&&quote(s,p.id).price>s.market[p.id].price);
        choices.sort((a,b)=>(quote(s,b.id).price-s.market[b.id].price)/quote(s,b.id).time-(quote(s,a.id).price-s.market[a.id].price)/quote(s,a.id).time);
        if(choices[0])buy(s,choices[0].id);
      }
    }
    const a=s.attempt;
    if(!a){autoForm(s,dt);return;}
    // Deadlines win a tie against automation, so an expired attempt cannot gain bonus time.
    a.age+=dt;a.remaining=Math.max(0,a.remaining-dt);
    if(a.remaining<=1e-8){settle(s,'第'+(a.labyrinth.stage+1)+'層「'+L.STAGES[a.labyrinth.stage].name+'」で時間切れ');return;}
    if(a.labyrinth.stage===0){
      if(a.age>=a.recheckAt){a.recheckAt+=3;if(!s.research.latch&&level(s,'shield')<2){a.checks[1]=true;discover(s,'recheck');}}
      if(a.age>=4&&!a.adSeen){a.adSeen=true;if(level(s,'shield')<3){a.popup=true;discover(s,'advert');}}
    } else L.tick(s,dt,labServices);
    if(s.attempt)autoForm(s,dt);
  }
  function advance(s,seconds) {
    if(!Number.isFinite(seconds)||seconds<=0)return;
    // Bounded catch-up uses the same economic and attempt rules as foreground play.
    let left=Math.min(seconds,7200);
    while(left>1e-8){const dt=Math.min(left,s.attempt?.1:1);step(s,dt);left-=dt;}
  }
  function work(s) { if(s.work>0)return {ok:false,message:'梱包作業中です。'};s.work=5;return {ok:true,message:'5秒の梱包バイトを始めました。'}; }
  function hydrate(raw,now=Date.now()) {
    if(!raw||raw.version!==VERSION||!Number.isFinite(raw.coins)||raw.coins<0||!Array.isArray(raw.inventory)||!raw.bots) throw new Error('対応していないセーブデータです。');
    const s=createState(now,int(raw.seed,724613,0xffffffff));
    s.seed=int(raw.seed,724613,0xffffffff);
    for(const key of ['coins','nextId','elapsed','savedAt','shelves','data','cycle','path','discovered','work'])s[key]=int(raw[key],s[key]);
    s.savedAt=int(raw.savedAt,now,Number.MAX_SAFE_INTEGER);
    s.nextId=Math.max(1,s.nextId);s.shelves=Math.min(12,s.shelves);s.path=Math.min(14,s.path);s.discovered=Math.min(14,s.discovered);s.work=Math.min(5,s.work);s.cycle=Math.min(10000,s.cycle);
    for(const key of Object.keys(BOTS)){const b=raw.bots[key]||{};s.bots[key]={level:int(b.level,0,12),on:b.on!==false,clock:0};}
    for(const key of Object.keys(RESEARCH))s.research[key]=int(raw.research?.[key],0,RESEARCH[key].max);
    s.settings={reserve:int(raw.settings?.reserve,500),strategy:['normal','quick','premium'].includes(raw.settings?.strategy)?raw.settings.strategy:'normal',sound:raw.settings?.sound===true,reducedMotion:raw.settings?.reducedMotion===true};
    const text=(v,d,max=100)=>typeof v==='string'?v.slice(0,max):d;
    s.profile={shop:text(raw.profile?.shop,'余白古物店',30),newsletter:raw.profile?.newsletter!==false,flavor:text(raw.profile?.flavor,'mix',20),reason:text(raw.profile?.reason,'退会したい'),comment:text(raw.profile?.comment,'',500)};
    s.welcome=raw.welcome===true;s.findings=Array.isArray(raw.findings)?[...new Set(raw.findings.filter(k=>TRAPS[k]))]:[];
    for(const key of Object.keys(s.stats)) s.stats[key]=int(raw.stats?.[key]);
    const uids=new Set();s.inventory=[];
    for(const i of raw.inventory.slice(0,capacity(s))){
      if(!product(i.product)||!Number.isSafeInteger(i.uid)||i.uid<=0||uids.has(i.uid))continue;uids.add(i.uid);
      const listed=i.status==='listed';s.inventory.push({uid:i.uid,product:i.product,paid:int(i.paid),status:listed?'listed':'stock',ask:listed?int(i.ask):0,remaining:listed?Math.min(180,Math.max(.01,Number(i.remaining)||.01)):0,total:listed?Math.min(180,Math.max(.01,Number(i.total)||.01)):0});
      s.nextId=Math.max(s.nextId,i.uid+1);
    }
    s.ledger=Array.isArray(raw.ledger)?raw.ledger.slice(0,100).filter(x=>typeof x.label==='string'&&Number.isFinite(x.delta)).map(x=>({id:int(x.id),at:int(x.at),label:x.label.slice(0,180),delta:Math.max(-LIMIT,Math.min(LIMIT,Math.round(x.delta))),kind:text(x.kind,'info',20)})):[];
    for(const p of CATALOG){const m=raw.market?.[p.id];if(m&&Number.isFinite(m.price)&&m.price>0)s.market[p.id]={price:int(m.price,p.base),stock:int(m.stock,0,4)};}
    s.marketTime=Math.min(30,Math.max(.01,Number(raw.marketTime)||30));
    const a=raw.attempt;
    if(a){
      if(!Number.isSafeInteger(a.deposit)||a.deposit<0||!Array.isArray(a.checks)||a.checks.length!==3||!Array.isArray(a.targets)||new Set(a.targets).size!==3||a.targets.some(i=>!Number.isInteger(i)||i<0||i>8))throw new Error('デポジットまたは認証情報が破損しています。');
      s.attempt={id:int(a.id,1),deposit:int(a.deposit),remaining:Math.min(300,Math.max(0,Number(a.remaining)||0)),duration:Math.min(300,Math.max(2,Number(a.duration)||2)),age:Math.min(7200,Math.max(0,Number(a.age)||0)),checks:a.checks.map(Boolean),unlocked:a.unlocked===true,targets:[...a.targets],selected:Array.isArray(a.selected)?[...new Set(a.selected.filter(i=>a.targets.includes(i)))]:[],captcha:a.captcha===true,terms:a.terms===true,popup:a.popup===true,adSeen:a.adSeen===true,evades:int(a.evades,0,5),position:int(a.position,0,2),recheckAt:int(a.recheckAt,3,90),botClock:0,progress:int(a.progress,0,12)};
      s.attempt.labyrinth=L.hydrate(a.labyrinth,s,labServices);
    }
    s.lastResult=raw.lastResult&&typeof raw.lastResult.reason==='string'?{id:int(raw.lastResult.id),reason:raw.lastResult.reason.slice(0,160),deposit:int(raw.lastResult.deposit),refund:int(raw.lastResult.refund),loss:int(raw.lastResult.loss),data:int(raw.lastResult.data),breakthrough:raw.lastResult.breakthrough===true,cycle:int(raw.lastResult.cycle),stage:int(raw.lastResult.stage,0,7),highest:int(raw.lastResult.highest,0,7),faults:int(raw.lastResult.faults,0,100000)}:null;
    if(!s.attempt&&s.path===14)s.path=13;
    return s;
  }
  function frontActive(s){return !!s.attempt&&s.attempt.remaining>0&&s.attempt.labyrinth.stage===0;}
  const labServices={rand,level,discover,record,finish:s=>settle(s,'8層の受付ロックを突破。退会予約を受理',true),fail:(s,why)=>settle(s,why)};
  const labyrinthAction=(s,op,value,stage)=>L.action(s,op,value,labServices,stage);
  const labyrinthWindow=s=>L.windowOpen(s,labServices);
  const cancelHold=s=>L.cancelHumanHold(s);
  return {LABYRINTH:L,labyrinthAction,labyrinthWindow,cancelHold,VERSION,ROUTES,CATALOG,BOTS,RESEARCH,TRAPS,createState,hydrate,advance,level,product,quote,capacity,deposit,botCost,botInterval,shelfCost,refundRate,buy,list,listAll,upgradeBot,upgradeShelf,research,navigate,startAttempt,settle,unlock,setCheck,captcha,acceptTerms,evade,dismissAd,submit,fly,work};
});
