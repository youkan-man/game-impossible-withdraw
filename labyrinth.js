/* Eight gates behind one withdrawal button. Pure simulation; no DOM or I/O. */
(function(root,factory){
  const api=factory();
  if(typeof module==='object'&&module.exports)module.exports=api;
  else root.WithdrawLabyrinth=api;
})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const STAGES=[
    {name:'表の退会ページ',short:'入口',code:'FRONT',bot:4,hint:'ロック・チェック・抹茶・規約・逃げるボタン。ここはまだ入口です。'},
    {name:'順序式・多重封印',short:'封印',code:'SEALS',bot:5,hint:'表示された順で封印を外す。間違い・放置・一括解除は再施錠。'},
    {name:'期限付き本人認証',short:'本人',code:'IDENTITY',bot:6,hint:'ゲーム内受信箱の最新コードを入力。再送すると古いコードは失効。'},
    {name:'部署決裁・原本照合',short:'決裁',code:'APPROVAL',bot:7,hint:'依存関係の順に原本を添えて申請。旧原本や部署違いは差し戻し。'},
    {name:'取消の取消の確認',short:'意思',code:'INTENT',bot:8,hint:'否定の入れ子を読み、継続ではなく退会を選び続ける。'},
    {name:'動的規約・署名同期',short:'署名',code:'SIGNATURE',bot:9,hint:'改訂版を取り込み、3つの同意を外す。古い署名は受理されません。'},
    {name:'審査待ち・受付時刻',short:'審査',code:'QUEUE',bot:10,hint:'順番と受付窓の両方を待つ。再申請・再読込は最後尾へ。'},
    {name:'偽の完了・最終送信',short:'本送信',code:'DISPATCH',bot:12,hint:'「完了」は退会ではない。処理明細を開き、継続同意を外して長押し送信。'}
  ];
  const TRAPS={
    seals:'順番を間違えると全封印が復活',spring:'放置で戻るバネ式封印',bulk:'一括解除を装う再施錠',
    otp:'短命な本人認証コード',resend:'再送で旧コードが失効',mailbait:'受信箱の継続承認ボタン',
    offices:'前の承認がないと受理しない部署',staleDocument:'旧原本を添付すると差し戻し',express:'迅速審査という名の再認証',
    negatives:'取消の取消・否定だらけの意思確認',rollback:'一つの誤答で前の層へ差し戻し',
    hotTerms:'読んでいる途中で規約が改訂',signature:'版の違う署名を失効させるロック',consent:'改訂のたびに継続同意が復活',
    queue:'審査待ちと短い受付窓',duplicate:'連打・再申請で最後尾に戻る',reload:'再読込で受付番号が破棄',
    falseSuccess:'受付完了を退会完了に見せる罠',hiddenRenewal:'明細の中に残る継続同意',hold:'最後まで押し続けないと送信されない'
  };
  const RESEARCH={
    timebank:{name:'引継ぎ時間の交渉',cost:6,max:3,desc:'各層の初回突破ボーナス時間を1レベルにつき2秒増やす。再突破では増えない。'},
    sealMemory:{name:'封印の逆止弁',cost:7,max:1,desc:'時間経過で封印が戻る機構を止める。誤順序は防げない。'},
    tokenLife:{name:'認証コード延命',cost:7,max:3,desc:'本人認証コードの有効時間を1レベルにつき5秒延ばす。'},
    notarize:{name:'原本の公証',cost:10,max:1,desc:'差し戻しを現在の層に留める。承認済みの前層は失わない。'},
    freeze:{name:'規約版のピン留め',cost:12,max:1,desc:'署名中の規約自動改訂を停止する。手動で最新版を求めると改訂される。'},
    priority:{name:'受付優先権',cost:10,max:3,desc:'待ち人数をレベル分減らし、受付窓を0.4秒ずつ延長する。'}
  };
  const SYMBOLS=['月','星','鍵','花','傘'];
  const OFFICES=['本人確認課','意思確認課','預託精算課'];
  // Choice IDs identify outcomes, not visual positions. Button order changes per round.
  const QUESTIONS=[
    {title:'退会の取消を、取り消しますか？',detail:'退会の「取消」を取り消すと、退会の申請が残ります。',options:[['leave','取消を取り消し、退会を続ける'],['stay','取消を確定し、会員を続ける'],['defer','今は判断せず、最初から確認する']]},
    {title:'会員継続への不同意を、撤回しませんか？',detail:'不同意を撤回すると、会員継続に同意した扱いになります。',options:[['stay','不同意を撤回する'],['leave','不同意を維持し、退会を進める'],['defer','おすすめの設定を適用する']]},
    {title:'「退会しない」を選択しない、でよろしいですか？',detail:'必要なのは退会の意思です。「退会しない」は継続です。',options:[['defer','もう一度、本人から確認する'],['stay','退会しない'],['leave','「退会しない」は選ばず、退会する']]},
    {title:'申請を取り下げない意思の取消を、拒否しますか？',detail:'取消を拒否すれば、取り下げない意思が維持されます。',options:[['stay','取消を受け入れ、申請を取り下げる'],['leave','取消を拒否し、退会申請を維持する'],['defer','おすすめの簡単手続きに戻る']]},
    {title:'継続を希望しない、という回答を取り消しますか？',detail:'その回答を取り消さない限り、退会の希望が残ります。',options:[['leave','回答を取り消さず、退会を希望する'],['defer','次回の確認に持ち越す'],['stay','回答を取り消し、継続を希望する']]},
    {title:'退会中止への同意を拒否した状態を、確定しますか？',detail:'退会中止への同意を拒否すれば、退会の手続きを続けられます。',options:[['stay','退会中止に同意しなおす'],['defer','いったん初期状態へ戻る'],['leave','拒否を確定して、退会を続ける']]}
  ];
  const FAIL=(message)=>({ok:false,message});
  const OK=(message)=>({ok:true,message});
  const level=(s,c,id)=>c.level(s,id);
  const research=(s,id)=>s.research[id]||0;
  const now=s=>s.attempt.age;
  const state=s=>s.attempt?.labyrinth;
  const timeBonus=s=>8+research(s,'timebank')*2;
  function shuffle(list,s,c){const a=[...list];for(let i=a.length-1;i>0;i--){const j=Math.floor(c.rand(s)*(i+1));[a[i],a[j]]=[a[j],a[i]];}return a;}
  function note(s,message){const l=state(s);if(l)l.event=message;}
  function create(s,c){
    return {version:1,stage:0,highest:0,rewarded:[],cleared:[],faults:0,rollbacks:0,event:'最初のフォームの先に、さらに7層のロックがあります。',
      seals:{order:shuffle(SYMBOLS.slice(0,Math.min(5,3+Math.floor(s.cycle/2))),s,c),opened:0,resetAt:0},
      identity:{serial:0,code:'',expires:0,messages:[],verified:false},
      offices:{order:shuffle(OFFICES,s,c),stamps:[],revision:1,document:'',complete:false},
      intent:{step:0,rounds:Math.min(6,3+s.cycle),offset:Math.floor(c.rand(s)*6)},
      terms:{version:1,nextRevision:0,imported:0,renewals:[true,true,true],nonce:'',signed:false},
      queue:{ticket:false,remaining:0,next:0,windowStart:0,duplicates:0,number:0},
      final:{details:false,renewal:true,holding:false,held:0,source:''}};
  }
  function enter(s,c,stage){
    const l=state(s);l.stage=stage;l.highest=Math.max(l.highest,stage);s.stats.deepest=Math.max(s.stats.deepest||0,stage);
    const a=s.attempt;a.popup=false; // The old front-page advertisement cannot cover a later gate.
    if(stage===1){l.seals.opened=0;l.seals.resetAt=0;c.discover(s,'seals');}
    if(stage===2){l.identity.verified=false;l.identity.code='';l.identity.expires=0;c.discover(s,'otp');}
    if(stage===3){l.offices.stamps=[];l.offices.complete=false;l.offices.revision++;l.offices.document='W-'+a.id+'-'+l.offices.revision;c.discover(s,'offices');}
    if(stage===4){l.intent.step=0;c.discover(s,'negatives');}
    if(stage===5){l.terms.version++;l.terms.nextRevision=now(s)+revisionInterval(s);l.terms.imported=0;l.terms.renewals=[true,true,true];l.terms.signed=false;l.terms.nonce='LOGOUT-'+String(Math.floor(c.rand(s)*10000)).padStart(4,'0');c.discover(s,'signature');}
    if(stage===6){Object.assign(l.queue,{ticket:false,remaining:0,next:0,windowStart:0});c.discover(s,'queue');}
    if(stage===7){Object.assign(l.final,{details:false,renewal:true,holding:false,held:0,source:''});c.discover(s,'falseSuccess');}
    note(s,'第'+(stage+1)+'層：'+STAGES[stage].name+'。');
  }
  function clear(s,c){
    const a=s.attempt,l=state(s);if(!a||!l||l.stage>=7)return FAIL('ここでは次へ進めません。');
    const previous=l.stage;
    if(!l.cleared.includes(previous))l.cleared.push(previous);
    let bonus=0;
    if(!l.rewarded.includes(previous)){
      l.rewarded.push(previous);bonus=timeBonus(s);a.remaining+=bonus;a.duration+=bonus;s.data++;s.stats.gates=(s.stats.gates||0)+1;
      c.record(s,'第'+(previous+1)+'層を突破：引継ぎ +'+bonus+'秒 / 解析 +1',0,'gate');
    }
    enter(s,c,previous+1);
    return {ok:true,advanced:true,message:'第'+(previous+1)+'層を突破。'+(bonus?'引継ぎ +'+bonus+'秒。':'再突破のため追加時間なし。')+'まだ退会は完了していません。'};
  }
  function fault(s,c,id,message,seconds=1,back=null){
    const a=s.attempt,l=state(s);c.discover(s,id);l.faults++;a.remaining=Math.max(0,a.remaining-seconds);
    if(back!==null){
      c.discover(s,'rollback');l.rollbacks++;s.stats.rollbacks=(s.stats.rollbacks||0)+1;
      const target=(research(s,'notarize')||level(s,c,'shield')>=6)?l.stage:back;
      l.cleared=l.cleared.filter(i=>i<target);enter(s,c,target);
      message+=' 第'+(target+1)+'層へ差し戻し。';
    }
    note(s,message+' −'+seconds+'秒。');return FAIL(l.event);
  }
  function revisionInterval(s){return Math.max(3,6-Math.min(6,s.cycle)*.4);}
  function ttl(s,c){return Math.max(4,7-Math.min(6,s.cycle)*.5)+research(s,'tokenLife')*5+(level(s,c,'shield')>=5?7:0);}
  function holdTime(s){return 1.4+Math.min(3,s.cycle)*.2;}
  function windowWidth(s){return Math.min(3.5,1.5+research(s,'priority')*.4);}
  function windowOpen(s,c){const q=state(s)?.queue;if(!q?.ticket||q.remaining>0)return false;if(level(s,c,'shield')>=8)return true;return (now(s)-q.windowStart)%4<windowWidth(s);}
  function revise(s,c){const t=state(s).terms;t.version++;t.imported=0;t.renewals=[true,true,true];t.signed=false;t.nextRevision=now(s)+revisionInterval(s);c.discover(s,'hotTerms');c.discover(s,'consent');note(s,'規約が第'+t.version+'版に差し替えられ、同意が復活しました。新しい版を取り込んでください。');}
  function question(s){const l=state(s);if(!l)return null;return QUESTIONS[(l.intent.offset+l.intent.step)%QUESTIONS.length];}
  function action(s,op,value,c,expectedStage){
    const a=s.attempt,l=state(s);
    if(!a||!l)return FAIL('退会ページに入場していません。');
    if(expectedStage!==undefined&&expectedStage!==l.stage)return FAIL('前の層の操作は無効です。現在の手続きを確認してください。');
    if(a.remaining<=0)return FAIL('時間切れです。');
    const allowed={1:['seal','bulk'],2:['otp-send','otp-verify','mail-bait'],3:['stamp','express'],4:['answer'],5:['terms-import','renewal','sign','sync-bait'],6:['ticket','dispatch','reload'],7:['details','final-renewal','hold-start','hold-stop','fake-finish']}[l.stage]||[];
    if(!allowed.includes(op))return FAIL('別のロックを飛ばすことはできません。');
    switch(op){
      case 'seal':{
        const p=l.seals;if(value!==p.order[p.opened]){p.opened=0;p.resetAt=0;return fault(s,c,'seals','順序違反。すべての封印が閉じました。',.9);}
        p.opened++;p.resetAt=now(s)+3.5;note(s,p.opened+'/'+p.order.length+' 個の封印を解除。');
        return p.opened===p.order.length?clear(s,c):OK(l.event);
      }
      case 'bulk':l.seals.opened=0;l.seals.resetAt=0;return fault(s,c,'bulk','「一括解除」は全封印の再施錠でした。',1.2);
      case 'otp-send':{
        const p=l.identity;if(p.serial){c.discover(s,'resend');a.remaining=Math.max(0,a.remaining-.3);}
        const previous=p.code;p.serial++;
        // Ensure a resend cannot coincidentally validate the previous six-digit code.
        let n=Math.floor(c.rand(s)*1000000);if(String(n).padStart(6,'0')===previous)n=(n+1)%1000000;
        p.code=String(n).padStart(6,'0');p.expires=now(s)+ttl(s,c);
        p.messages.unshift({serial:p.serial,code:p.code,expires:p.expires});p.messages=p.messages.slice(0,4);
        note(s,'受信箱に認証番号 #'+p.serial+' が届きました。有効なコードは最新の1件だけです。');return OK(l.event);
      }
      case 'otp-verify':{
        const p=l.identity;if(!p.code)return FAIL('先に認証コードを送信してください。');
        if(now(s)>=p.expires)return fault(s,c,'otp','コードが期限切れです。再送してください。',.6);
        if(typeof value!=='string'||value.trim()!==p.code)return fault(s,c,'resend','最新の認証コードではありません。',.8);
        p.verified=true;return clear(s,c);
      }
      case 'mail-bait':return fault(s,c,'mailbait','会員継続専用の承認を押しました。本人認証からやり直しです。',1.5,2);
      case 'stamp':{
        const p=l.offices;if(!value||typeof value!=='object')return FAIL('添付書類を確認してください。');
        if(value.document!==p.document)return fault(s,c,'staleDocument','添付された原本が旧版です。認証を差し戻します。',1.3,2);
        if(value.office!==p.order[p.stamps.length])return fault(s,c,'offices','この部署には前の部署の決裁印が必要です。',.8);
        p.stamps.push(value.office);note(s,value.office+'が承認。次の部署へ原本を回してください。');
        if(p.stamps.length===p.order.length){p.complete=true;return clear(s,c);}return OK(l.event);
      }
      case 'express':return fault(s,c,'express','迅速審査では本人認証から取り直します。',1.5,2);
      case 'answer':{
        if(value!=='leave')return fault(s,c,'negatives',value==='stay'?'会員継続を選択しました。':'「おすすめ」は退会の差し戻しでした。',1.2,3);
        l.intent.step++;note(s,'退会の意思 '+l.intent.step+'/'+l.intent.rounds+' を確認。');
        return l.intent.step>=l.intent.rounds?clear(s,c):OK(l.event);
      }
      case 'terms-import':l.terms.imported=l.terms.version;note(s,'第'+l.terms.version+'版を取り込みました。自動継続への同意を外して署名してください。');return OK(l.event);
      case 'renewal':{
        if(!value||!Number.isInteger(value.index)||value.index<0||value.index>2||typeof value.checked!=='boolean')return FAIL('チェック情報が不正です。');
        if(l.terms.imported!==l.terms.version)return FAIL('先に現在の規約を取り込んでください。');
        l.terms.renewals[value.index]=value.checked;return OK();
      }
      case 'sign':{
        const p=l.terms;if(!value||value.version!==p.version||p.imported!==p.version)return fault(s,c,'signature','署名対象の版が一致しません。',.7);
        if(p.renewals.some(Boolean))return fault(s,c,'consent','継続・譲渡・保留への同意が残っています。',.7);
        if(value.word!==p.nonce)return fault(s,c,'signature','照合語が一致しません。',.5);
        p.signed=true;return clear(s,c);
      }
      case 'sync-bait':revise(s,c);return fault(s,c,'hotTerms','「常に最新版」は署名前の版を差し替えます。',.5);
      case 'ticket':{
        const q=l.queue;if(q.ticket){q.remaining=queueSize(s)+1;q.next=now(s)+1;c.discover(s,'duplicate');q.duplicates++;return fault(s,c,'duplicate','重複申請と判定され、最後尾に戻されました。',.8);}
        q.ticket=true;q.number=s.nextId++;q.remaining=queueSize(s);q.next=now(s)+1;q.windowStart=now(s);note(s,'受付番号 '+q.number+'。順番を待ってください。');return OK(l.event);
      }
      case 'reload':l.queue.ticket=false;l.queue.remaining=0;return fault(s,c,'reload','再読込で受付番号が破棄されました。',1);
      case 'dispatch':
        if(!windowOpen(s,c))return fault(s,c,'queue','今は受付窓が閉じています。順番と受付時間を確認してください。',.5);
        return clear(s,c);
      case 'details':l.final.details=true;c.discover(s,'hiddenRenewal');note(s,'受付完了は退会完了ではありません。明細内の継続同意を外してください。');return OK(l.event);
      case 'final-renewal':
        if(!l.final.details||typeof value!=='boolean')return FAIL('先に処理明細を開いてください。');
        l.final.renewal=value;return OK();
      case 'hold-start':
        if(!l.final.details||l.final.renewal)return fault(s,c,'hiddenRenewal','処理明細に会員継続への同意が残っています。',.5);
        if(!l.final.holding){l.final.holding=true;l.final.held=0;l.final.source=value==='bot'?'bot':'human';c.discover(s,'hold');}
        return OK();
      case 'hold-stop':l.final.holding=false;l.final.held=0;l.final.source='';note(s,'長押しが途中で解除されました。送信はまだ行われていません。');return OK();
      case 'fake-finish':
        if(level(s,c,'shield')>=9){note(s,'監査Botが偽の「完了して閉じる」を阻止しました。');return OK(l.event);}
        c.discover(s,'falseSuccess');c.fail(s,'偽の完了画面を閉じ、退会申請ではなく会員継続を確定');return FAIL('受付は完了しましたが、退会は成立しませんでした。');
    }
    return FAIL('不明な操作です。');
  }
  function queueSize(s){return Math.max(1,3+Math.min(5,s.cycle)-research(s,'priority'));}
  function tick(s,dt,c){
    const l=state(s);if(!l||!s.attempt||s.attempt.remaining<=0)return;
    if(l.stage===1){const p=l.seals;if(p.opened&&now(s)>=p.resetAt&&!research(s,'sealMemory')&&level(s,c,'shield')<4){p.opened--;p.resetAt=now(s)+3.5;c.discover(s,'spring');note(s,'バネが戻り、直前の封印が再施錠されました。');}}
    if(l.stage===5&&now(s)>=l.terms.nextRevision&&!research(s,'freeze')&&level(s,c,'shield')<7)revise(s,c);
    if(l.stage===6){const q=l.queue;if(q.ticket&&q.remaining>0&&now(s)+1e-8>=q.next){const turn=q.next;q.remaining--;q.next+=1;if(q.remaining===0){q.windowStart=turn;note(s,'あなたの順番です。緑の受付窓が開いている間に申請してください。');}}}
    if(l.stage===7){const f=l.final;if(f.holding){
      if(!f.details||f.renewal||(f.source==='bot'&&level(s,c,'solver')<12)){f.holding=false;f.held=0;return;}
      f.held+=dt;
      if(f.held+1e-8>=holdTime(s)){
        // Every previous layer must still be valid; stale buttons cannot skip a layer.
        if(Array.from({length:7},(_,i)=>i).every(i=>l.cleared.includes(i))){l.cleared.push(7);s.stats.deepest=8;c.finish(s);}
        else {f.holding=false;f.held=0;note(s,'未承認の層が残っています。申請は送信されませんでした。');}
      }
    }}
  }
  function auto(s,c,lv){
    const l=state(s);if(!l||l.stage===0||lv<STAGES[l.stage].bot&&(l.stage!==7||lv<11))return;
    const send=(op,value)=>action(s,op,value,c,l.stage);
    if(l.stage===1)return send('seal',l.seals.order[l.seals.opened]);
    if(l.stage===2){const p=l.identity;return !p.code||now(s)>=p.expires?send('otp-send'):send('otp-verify',p.code);}
    if(l.stage===3)return send('stamp',{office:l.offices.order[l.offices.stamps.length],document:l.offices.document});
    if(l.stage===4)return send('answer','leave');
    if(l.stage===5){const t=l.terms;if(t.imported!==t.version)return send('terms-import');const i=t.renewals.findIndex(Boolean);return i>=0?send('renewal',{index:i,checked:false}):send('sign',{version:t.version,word:t.nonce});}
    if(l.stage===6){if(!l.queue.ticket)return send('ticket');if(windowOpen(s,c))return send('dispatch');return;}
    if(l.stage===7){const f=l.final;if(!f.details)return send('details');if(f.renewal)return send('final-renewal',false);if(lv>=12&&!f.holding)return send('hold-start','bot');}
  }
  function cancelHumanHold(s){const f=state(s)?.final;if(f?.holding&&f.source==='human'){f.holding=false;f.held=0;f.source='';}}
  function hydrate(raw,s,c){
    if(raw===undefined||raw===null){const seed=s.seed,legacy=create(s,c);s.seed=seed;return legacy;}
    // Explicit whitelist with bounded fields. Corrupt progression is rejected, not promoted.
    const require=(ok)=>{if(!ok)throw new Error('退会の多重ロック情報が破損しています。');};
    require(raw.version===1&&Number.isInteger(raw.stage)&&raw.stage>=0&&raw.stage<=7);
    const num=(n,max=10000)=>{require(typeof n==='number'&&Number.isFinite(n)&&n>=0&&n<=max);return n;};
    const integer=(n,max=10000)=>{num(n,max);require(Number.isInteger(n));return n;};
    const text=(v,max=200)=>{require(typeof v==='string'&&v.length<=max);return v;};
    const bool=v=>{require(typeof v==='boolean');return v;};
    const unique=(v,valid,min=0,max=8)=>{require(Array.isArray(v)&&v.length>=min&&v.length<=max&&new Set(v).size===v.length&&v.every(valid));return [...v];};
    const requireObject=v=>{require(v&&typeof v==='object'&&!Array.isArray(v));return v;};
    const l={version:1,stage:raw.stage,highest:integer(raw.highest,7),rewarded:unique(raw.rewarded,i=>Number.isInteger(i)&&i>=0&&i<7),cleared:unique(raw.cleared,i=>Number.isInteger(i)&&i>=0&&i<7),faults:integer(raw.faults,100000),rollbacks:integer(raw.rollbacks,100000),event:text(raw.event)};
    require(l.highest>=l.stage&&Array.from({length:l.stage},(_,i)=>i).every(i=>l.cleared.includes(i)&&l.rewarded.includes(i))&&l.cleared.every(i=>i<l.stage)&&l.rewarded.every(i=>i<l.highest));
    const p=requireObject(raw.seals);l.seals={order:unique(p.order,i=>SYMBOLS.includes(i),3,5),opened:integer(p.opened,5),resetAt:num(p.resetAt)};require(l.seals.opened<=l.seals.order.length);
    const i=requireObject(raw.identity);require(Array.isArray(i.messages)&&i.messages.length<=4);
    l.identity={serial:integer(i.serial,100000),code:text(i.code,6),expires:num(i.expires),verified:bool(i.verified),messages:i.messages.map(m=>{requireObject(m);require(/^\d{6}$/.test(m.code));return {serial:integer(m.serial,100000),code:m.code,expires:num(m.expires)};})};
    require(l.identity.code===''||/^\d{6}$/.test(l.identity.code));
    const o=requireObject(raw.offices);l.offices={order:unique(o.order,i=>OFFICES.includes(i),3,3),stamps:unique(o.stamps,i=>OFFICES.includes(i),0,3),revision:integer(o.revision,100000),document:text(o.document,80),complete:bool(o.complete)};require(l.offices.stamps.every((v,i)=>v===l.offices.order[i]));
    const f=requireObject(raw.intent);l.intent={step:integer(f.step,6),rounds:integer(f.rounds,6),offset:integer(f.offset,5)};require(f.rounds>=3&&f.step<=f.rounds);
    const t=requireObject(raw.terms);require(Array.isArray(t.renewals)&&t.renewals.length===3);l.terms={version:integer(t.version,100000),nextRevision:num(t.nextRevision),imported:integer(t.imported,100000),renewals:t.renewals.map(bool),nonce:text(t.nonce,20),signed:bool(t.signed)};require(t.imported<=t.version);
    const q=requireObject(raw.queue);l.queue={ticket:bool(q.ticket),remaining:integer(q.remaining,20),next:num(q.next),windowStart:num(q.windowStart),duplicates:integer(q.duplicates,100000),number:integer(q.number,Number.MAX_SAFE_INTEGER)};
    const z=requireObject(raw.final);l.final={details:bool(z.details),renewal:bool(z.renewal),holding:false,held:0,source:''};
    // A physical key/pointer is never persisted. Bot-held submission restarts through auto().
    if(l.stage>1)require(l.seals.opened===l.seals.order.length);
    if(l.stage>2)require(l.identity.verified);
    if(l.stage>3)require(l.offices.complete&&l.offices.stamps.length===3);
    if(l.stage>4)require(l.intent.step===l.intent.rounds);
    if(l.stage>5)require(l.terms.signed&&l.terms.imported===l.terms.version&&!l.terms.renewals.some(Boolean));
    if(l.stage>6)require(l.queue.ticket&&l.queue.remaining===0);
    return l;
  }
  return {STAGES,TRAPS,RESEARCH,SYMBOLS,OFFICES,QUESTIONS,create,clear,action,tick,auto,cancelHumanHold,hydrate,question,ttl,holdTime,windowOpen,windowWidth,revisionInterval,timeBonus};
});
