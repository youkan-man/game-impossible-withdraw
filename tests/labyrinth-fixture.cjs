'use strict';
const G=require('../game.js');
function make(cycle=0){const s=G.createState(Date.now(),724613);s.coins=100000;s.welcome=false;s.cycle=cycle;s.discovered=13;s.path=13;s.bots.clock.level=12;s.bots.shield.level=3;G.startAttempt(s);return s;}
function act(s,op,value){return G.labyrinthAction(s,op,value,s.attempt?.labyrinth.stage);}
function front(s){G.unlock(s);for(let i=0;i<3;i++)G.setCheck(s,i,false);for(const i of s.attempt.targets)G.captcha(s,i);G.acceptTerms(s);while(s.attempt.labyrinth.stage===0){const r=G.submit(s);if(!r.ok&&!r.message.includes('逃げ'))throw Error(r.message);}}
function clearStage(s){const l=s.attempt.labyrinth;switch(l.stage){
  case 0:front(s);break;
  case 1:while(s.attempt.labyrinth.stage===1)act(s,'seal',l.seals.order[l.seals.opened]);break;
  case 2:act(s,'otp-send');act(s,'otp-verify',l.identity.code);break;
  case 3:while(s.attempt.labyrinth.stage===3)act(s,'stamp',{office:l.offices.order[l.offices.stamps.length],document:l.offices.document});break;
  case 4:while(s.attempt.labyrinth.stage===4)act(s,'answer','leave');break;
  case 5:act(s,'terms-import');for(let i=0;i<3;i++)act(s,'renewal',{index:i,checked:false});act(s,'sign',{version:l.terms.version,word:l.terms.nonce});break;
  case 6:if(!l.queue.ticket)act(s,'ticket');while(s.attempt&&(!G.labyrinthWindow(s)))G.advance(s,.1);act(s,'dispatch');break;
  case 7:act(s,'details');act(s,'final-renewal',false);act(s,'hold-start');G.advance(s,G.LABYRINTH.holdTime(s)+.1);break;
}}
function reach(stage,cycle=0){const s=make(cycle);while(s.attempt.labyrinth.stage<stage)clearStage(s);return s;}
module.exports={G,make,act,front,clearStage,reach};
