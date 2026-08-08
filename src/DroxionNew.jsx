'use client';

import { useMemo, useState } from 'react';
import {
  Bell, Coins, Compass, Radio, MessageCircle, Star, User, Video, Heart,
  X, Gift, SlidersHorizontal, Globe2, ShieldCheck, PhoneOff, Mic, Camera,
  RotateCcw, MoreVertical, Search, BadgeCheck
} from 'lucide-react';
import './droxion-new.css';
import './droxion-new.css';

const profiles = [
  { name: 'Sofia', age: 24, country: 'Spain', flag: '🇪🇸', languages: 'English • Spanish', interests: ['Music','Travel','Gaming'], bio: 'Travel, music and late-night conversations.', image: 'https://images.unsplash.com/photo-1494790108377-be9c29b29330?auto=format&fit=crop&w=1200&q=80' },
  { name: 'Maya', age: 26, country: 'United States', flag: '🇺🇸', languages: 'English', interests: ['Film','Tech','Fitness'], bio: 'Creator, filmmaker, coffee enthusiast.', image: 'https://images.unsplash.com/photo-1534528741775-53994a69daeb?auto=format&fit=crop&w=1200&q=80' },
  { name: 'Anaya', age: 23, country: 'India', flag: '🇮🇳', languages: 'English • Hindi', interests: ['Food','Movies','Travel'], bio: 'Always planning the next trip.', image: 'https://images.unsplash.com/photo-1531123897727-8f129e1688ce?auto=format&fit=crop&w=1200&q=80' },
  { name: 'Elena', age: 25, country: 'Italy', flag: '🇮🇹', languages: 'English • Italian', interests: ['Fashion','Art','Music'], bio: 'Design, art and good energy.', image: 'https://images.unsplash.com/photo-1517841905240-472988babdf9?auto=format&fit=crop&w=1200&q=80' }
];

const creators = [
  { name: 'Maya', country: 'USA', flag: '🇺🇸', followers: '12.5K', image: profiles[1].image },
  { name: 'Anaya', country: 'India', flag: '🇮🇳', followers: '9.8K', image: profiles[2].image },
  { name: 'Elena', country: 'Italy', flag: '🇮🇹', followers: '7.4K', image: profiles[3].image }
];

function TopBar({ coins, onCoins }) {
  return <div className="topbar">
    <div className="brand"><span className="brandMark">D</span><span>DROXION</span></div>
    <div className="topActions">
      <button className="coinPill" onClick={onCoins}><Coins size={18}/><span>{coins}</span></button>
      <button className="iconBtn"><Bell size={20}/></button>
    </div>
  </div>
}

function BottomNav({ tab, setTab }) {
  const items = [
    ['discover','Discover',Compass],['live','Live',Radio],['messages','Messages',MessageCircle],['creators','Creators',Star],['profile','Profile',User]
  ];
  return <nav className="bottomNav">{items.map(([key,label,Icon]) =>
    <button key={key} className={tab===key?'navItem active':'navItem'} onClick={()=>setTab(key)}><Icon size={21}/><span>{label}</span></button>
  )}</nav>
}

function Discover({ onCall }) {
  const [i,setI] = useState(0);
  const p = profiles[i%profiles.length];
  const next = () => setI((i+1)%profiles.length);
  return <div className="pagePad">
    <div className="sectionHead"><div><h1>Discover</h1><p>Meet interesting people worldwide.</p></div><button className="roundBtn"><SlidersHorizontal size={20}/></button></div>
    <div className="profileCard" style={{backgroundImage:`linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.85)),url(${p.image})`}}>
      <div className="profileOverlay">
        <div className="online"><span></span> Online</div>
        <h2>{p.name}, {p.age} <BadgeCheck size={20}/></h2>
        <p>{p.flag} {p.country} · {p.languages}</p>
        <div className="chips">{p.interests.map(x=><span key={x}>{x}</span>)}</div>
        <p className="bio">{p.bio}</p>
      </div>
    </div>
    <div className="actionRow">
      <button className="actionBtn danger" onClick={next}><X size={29}/></button>
      <button className="actionBtn primary" onClick={()=>onCall(p)}><Video size={30}/></button>
      <button className="actionBtn love"><Heart size={28}/></button>
    </div>
    <button className="bigCTA" onClick={()=>onCall(profiles[(i+1)%profiles.length])}><Globe2 size={20}/> Meet Someone Now</button>
    <div className="infoBox"><ShieldCheck size={22}/><div><strong>21+ community</strong><p>Profiles, reporting, blocking and safety controls are built into the product.</p></div></div>
  </div>
}

function LivePage({ onCall }) {
  return <div className="pagePad"><div className="sectionHead"><div><h1>Live</h1><p>People available to connect right now.</p></div></div>
    <div className="liveGrid">{profiles.map((p,idx)=><button className="liveCard" key={p.name} onClick={()=>onCall(p)} style={{backgroundImage:`linear-gradient(180deg,transparent,rgba(0,0,0,.8)),url(${p.image})`}}><span className="liveBadge">LIVE</span><div><strong>{p.name}, {p.age}</strong><small>{p.flag} {p.country}</small></div></button>)}</div>
  </div>
}

function Messages(){ return <div className="pagePad"><div className="sectionHead"><div><h1>Messages</h1><p>Connections you've made.</p></div><button className="roundBtn"><Search size={20}/></button></div><div className="list">{profiles.slice(0,3).map((p,i)=><div className="messageRow" key={p.name}><img src={p.image}/><div><strong>{p.name}</strong><span>{i===0?'Hey! Nice meeting you 😊':i===1?'Want to call again?':'That was fun!'}</span></div><small>{i===0?'2m':'1h'}</small></div>)}</div></div> }

function Creators(){ return <div className="pagePad"><div className="sectionHead"><div><h1>Creators</h1><p>Discover verified hosts and creators.</p></div></div><h3 className="subhead">Trending</h3><div className="creatorList">{creators.map(c=><div className="creatorCard" key={c.name}><img src={c.image}/><div><strong>{c.name} <BadgeCheck size={16}/></strong><span>{c.flag} {c.country}</span><small>{c.followers} followers</small></div><button>Follow</button></div>)}</div><div className="earnCard"><Star size={28}/><div><h3>Earn on Droxion</h3><p>Verified 21+ creators can build an audience and earn from eligible gifts and engagement.</p></div><button>Apply</button></div></div> }

function Profile(){ return <div className="pagePad"><div className="profileHeader"><div className="avatar">D</div><h2>Dhruv <BadgeCheck size={18}/></h2><p>🌎 Global · 21+</p><div className="stats"><div><strong>128</strong><span>Connections</span></div><div><strong>42</strong><span>Following</span></div><div><strong>4.9</strong><span>Trust</span></div></div></div><div className="settingsList">{['Edit profile','Wallet & coins','Droxion+','Creator dashboard','Safety center','Privacy','Help & support'].map(x=><button key={x}>{x}<span>›</span></button>)}</div></div> }

function CoinStore({close,setCoins}){
  const packs=[['100','$1.99'],['550','$7.99'],['1,200','$14.99'],['3,000','$29.99']];
  return <div className="modalShade"><div className="sheet"><div className="sheetHead"><h2>Coin Store</h2><button className="iconBtn" onClick={close}><X size={20}/></button></div><p className="muted">Demo checkout. Connect Stripe or another supported payment provider before launch.</p><div className="packs">{packs.map(([n,price])=><button key={n} onClick={()=>{setCoins(c=>c+parseInt(n.replace(',','')));close();}}><Coins/><div><strong>{n} coins</strong><span>{price}</span></div></button>)}</div></div></div>
}

function CallScreen({person,onEnd,coins,setCoins}){
  const [seconds,setSeconds] = useState(120);
  const [extended,setExtended] = useState(false);
  const mins = String(Math.floor(seconds/60)).padStart(2,'0');
  const secs = String(seconds%60).padStart(2,'0');
  const extend=()=>{ if(coins>=25){setCoins(coins-25);setSeconds(300);setExtended(true);} };
  return <div className="callScreen" style={{backgroundImage:`linear-gradient(180deg,rgba(0,0,0,.05),rgba(0,0,0,.7)),url(${person.image})`}}>
    <div className="callTop"><div><strong>{person.name}, {person.age}</strong><span>{person.flag} {person.country}</span></div><button className="iconBtn dark"><MoreVertical/></button></div>
    <div className="timer">{mins}:{secs} {extended?'paid':'free preview'}</div>
    <div className="selfPreview">YOU</div>
    <div className="callBottom">
      <div className="callButtons"><button><Gift/></button><button><Mic/></button><button><Camera/></button><button><RotateCcw/></button><button className="hang" onClick={onEnd}><PhoneOff/></button></div>
      {!extended && <button className="bigCTA" onClick={extend}>Continue 5 min · 25 🪙</button>}
      {!extended && coins<25 && <p className="warning">Not enough coins. Add coins to continue.</p>}
    </div>
  </div>
}

export default function Home(){
  const [tab,setTab]=useState('discover');
  const [coins,setCoins]=useState(100);
  const [coinStore,setCoinStore]=useState(false);
  const [call,setCall]=useState(null);
  const content=useMemo(()=>{
    if(tab==='discover') return <Discover onCall={setCall}/>;
    if(tab==='live') return <LivePage onCall={setCall}/>;
    if(tab==='messages') return <Messages/>;
    if(tab==='creators') return <Creators/>;
    return <Profile/>;
  },[tab]);

  if(call) return <CallScreen person={call} onEnd={()=>setCall(null)} coins={coins} setCoins={setCoins}/>;
  return <main className="appShell"><TopBar coins={coins} onCoins={()=>setCoinStore(true)}/><div className="content">{content}</div><BottomNav tab={tab} setTab={setTab}/>{coinStore&&<CoinStore close={()=>setCoinStore(false)} setCoins={setCoins}/>}</main>
}
