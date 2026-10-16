(function(root,factory){const api=factory();if(typeof module==='object'&&module.exports)module.exports=api;else root.WithdrawSave=api;})(typeof globalThis!=='undefined'?globalThis:this,function(){
  'use strict';
  const KEY='impossible-withdraw.save.v1', BACKUP=KEY+'.backup';
  function checksum(text){let n=2166136261;for(let i=0;i<text.length;i++){n^=text.charCodeAt(i);n=Math.imul(n,16777619);}return (n>>>0).toString(16);}
  function encode(state){const payload=JSON.stringify(state);return JSON.stringify({format:'impossible-withdraw',checksum:checksum(payload),payload});}
  function decode(text){if(typeof text!=='string'||text.length>1000000)throw new Error('セーブのサイズが不正です。');const wrapper=JSON.parse(text);if(wrapper.format!=='impossible-withdraw'||typeof wrapper.payload!=='string'||wrapper.checksum!==checksum(wrapper.payload))throw new Error('セーブの整合性を確認できません。');return JSON.parse(wrapper.payload);}
  function load(storage,hydrate){
    let primary,backup;
    try{primary=storage.getItem(KEY);backup=storage.getItem(BACKUP);}catch(e){return {state:null,error:'保存領域にアクセスできません。メモリ上で遊べますが、終了前に書き出してください。',blocked:true};}
    if(!primary&&!backup)return {state:null,error:null};
    for(const [text,isBackup] of [[primary,false],[backup,true]]){if(!text)continue;try{return {state:hydrate(decode(text)),error:isBackup?'前回のセーブが破損していたため、バックアップから復元しました。':null,recovered:isBackup};}catch(e){/* Try the intact backup before declaring the save corrupt. */}}
    return {state:null,error:'セーブを読み込めません。元データは保持しています。書き出し済みのJSONを読み込むか、明示的に初期化してください。',corrupt:true};
  }
  function save(storage,state){
    try{
      const next=encode(state), previous=storage.getItem(KEY);
      if(previous){try{decode(previous);storage.setItem(BACKUP,previous);}catch(e){/* Never copy corrupt primary data over an intact backup. */}}
      storage.setItem(KEY,next);return {ok:true};
    }catch(e){return {ok:false,error:'自動保存できません。容量またはブラウザの保存設定を確認し、JSONを書き出してください。'};}
  }
  return {KEY,BACKUP,checksum,encode,decode,load,save};
});
