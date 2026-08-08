'use client';

import { useEffect, useMemo, useState } from 'react';
import { supabase } from './supabaseClient';
import DroxionProfile from './DroxionProfile';
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

function Profile(props){
  return <DroxionProfile {...props}/>;
}

function CoinStore({
  close,
  coins,
  freeMatches,
  plan,
  message
}){
  const [products,setProducts] = useState([]);
  const [loading,setLoading] = useState(true);
  const [checkoutId,setCheckoutId] = useState('');
  const [checkoutError,setCheckoutError] = useState('');

  useEffect(() => {
    let mounted = true;

    async function loadProducts(){

      const { data, error } = await supabase
        .from('droxion_products')
        .select(
          'id, product_type, name, price_cents, coins_granted, plan, sort_order'
        )
        .eq('active', true)
        .order('sort_order');

      if(!mounted) return;

      if(error){
        console.error(
          'Droxion products error:',
          error.message
        );

        setCheckoutError(
          'Unable to load Droxion products.'
        );
      } else {
        setProducts(data || []);
      }

      setLoading(false);
    }

    loadProducts();

    return () => {
      mounted = false;
    };
  }, []);


  async function startCheckout(productId){

    setCheckoutError('');
    setCheckoutId(productId);

    const { data, error } =
      await supabase.functions.invoke(
        'ccbill-checkout',
        {
          body: {
            product_id: productId
          }
        }
      );

    if(error){
      console.error(
        'CCBill checkout error:',
        error
      );

      setCheckoutError(
        'Checkout is not available yet. Please try again later.'
      );

      setCheckoutId('');

      return;
    }


    if(!data?.checkout_url){

      setCheckoutError(
        data?.error ||
        'Checkout could not be started.'
      );

      setCheckoutId('');

      return;
    }


    window.location.assign(
      data.checkout_url
    );
  }


  const coinProducts =
    products.filter(
      product =>
        product.product_type ===
        'coin_pack'
    );


  const subscriptionProducts =
    products.filter(
      product =>
        product.product_type ===
        'subscription'
    );


  const price = cents =>
    `$${(
      Number(cents || 0) / 100
    ).toFixed(2)}`;


  return (
    <div className="modalShade">

      <div className="sheet">

        <div className="sheetHead">

          <h2>Droxion Wallet</h2>

          <button
            className="iconBtn"
            onClick={close}
          >
            <X size={20}/>
          </button>

        </div>


        <p className="muted">
          {coins} coins
          {' · '}
          {freeMatches} free matches
          {' · '}
          {plan.toUpperCase()} plan
        </p>


        {message && (
          <p className="warning">
            {message}
          </p>
        )}


        {checkoutError && (
          <p className="warning">
            {checkoutError}
          </p>
        )}


        <h3>Buy Coins</h3>

        {loading ? (

          <p className="muted">
            Loading products...
          </p>

        ) : (

          <div className="packs">

            {coinProducts.map(product => (

              <button
                key={product.id}
                disabled={
                  checkoutId === product.id
                }
                onClick={() =>
                  startCheckout(product.id)
                }
              >

                <Coins/>

                <div>

                  <strong>
                    {product.coins_granted}
                    {' '}coins
                  </strong>

                  <span>
                    {
                      checkoutId === product.id
                        ? 'Opening checkout...'
                        : price(product.price_cents)
                    }
                  </span>

                </div>

              </button>

            ))}

          </div>

        )}


        <h3 style={{marginTop:24}}>
          Droxion Plans
        </h3>


        <div className="packs">

          {subscriptionProducts.map(
            product => (

              <button
                key={product.id}
                disabled={
                  checkoutId === product.id
                }
                onClick={() =>
                  startCheckout(product.id)
                }
              >

                <div>

                  <strong>
                    {product.name}
                  </strong>

                  <span>
                    {
                      checkoutId === product.id
                        ? 'Opening checkout...'
                        : `${price(
                            product.price_cents
                          )}/month`
                    }
                  </span>

                  <small>
                    +
                    {product.coins_granted}
                    {' '}coins
                  </small>

                </div>

              </button>

            )
          )}

        </div>


        <p className="muted"
           style={{marginTop:18}}>
          Coins and memberships are credited
          only after payment confirmation.
        </p>

      </div>

    </div>
  );
}


function CallScreen({
  person,
  onEnd,
  coins,
  onExtend
}){
  const [seconds,setSeconds] = useState(120);
  const [extended,setExtended] = useState(false);
  const [extending,setExtending] = useState(false);
  const [warning,setWarning] = useState('');

  const mins =
    String(Math.floor(seconds / 60)).padStart(2,'0');

  const secs =
    String(seconds % 60).padStart(2,'0');


  const extend = async () => {

    setWarning('');
    setExtending(true);

    const result = await onExtend();

    if(result?.allowed){

      setSeconds(300);
      setExtended(true);

    } else {

      setWarning(
        result?.message ||
        'Not enough coins. Add coins to continue.'
      );

    }

    setExtending(false);
  };


  return <div
    className="callScreen"
    style={{
      backgroundImage:
        `linear-gradient(
          180deg,
          rgba(0,0,0,.05),
          rgba(0,0,0,.7)
        ),
        url(${person.image})`
    }}
  >

    <div className="callTop">

      <div>
        <strong>
          {person.name}, {person.age}
        </strong>

        <span>
          {person.flag} {person.country}
        </span>
      </div>

      <button className="iconBtn dark">
        <MoreVertical/>
      </button>

    </div>


    <div className="timer">
      {mins}:{secs}
      {' '}
      {extended ? 'paid' : 'free preview'}
    </div>


    <div className="selfPreview">
      YOU
    </div>


    <div className="callBottom">

      <div className="callButtons">

        <button>
          <Gift/>
        </button>

        <button>
          <Mic/>
        </button>

        <button>
          <Camera/>
        </button>

        <button>
          <RotateCcw/>
        </button>

        <button
          className="hang"
          onClick={onEnd}
        >
          <PhoneOff/>
        </button>

      </div>


      {!extended && (
        <button
          className="bigCTA"
          disabled={extending}
          onClick={extend}
        >
          {
            extending
              ? 'Checking wallet...'
              : 'Continue 5 min · 25 🪙'
          }
        </button>
      )}


      {!extended && warning && (
        <p className="warning">
          {warning}
        </p>
      )}


      <p className="muted">
        Wallet balance: {coins} 🪙
      </p>

    </div>

  </div>
}

export default function Home(){

  const [tab,setTab] =
    useState('discover');

  const [coins,setCoins] =
    useState(0);

  const [freeMatches,setFreeMatches] =
    useState(0);

  const [plan,setPlan] =
    useState('free');

  const [walletLoading,setWalletLoading] =
    useState(true);

  const [coinStore,setCoinStore] =
    useState(false);

  const [call,setCall] =
    useState(null);

  const [moneyMessage,setMoneyMessage] =
    useState('');


  async function loadWallet(){

    setWalletLoading(true);

    const {
      data: authData,
      error: authError
    } = await supabase.auth.getUser();

    const user = authData?.user;


    if(authError || !user){

      console.error(
        'Droxion wallet auth error:',
        authError?.message
      );

      setMoneyMessage(
        'Please sign in again to load your wallet.'
      );

      setWalletLoading(false);

      return;
    }


    const {
      data,
      error
    } = await supabase
      .from('droxion_wallets')
      .select(
        'coin_balance, free_matches_remaining, plan'
      )
      .eq('user_id', user.id)
      .maybeSingle();


    if(error || !data){

      console.error(
        'Droxion wallet load error:',
        error?.message
      );

      setMoneyMessage(
        'Your wallet could not be loaded.'
      );

      setWalletLoading(false);

      return;
    }


    setCoins(
      Number(data.coin_balance ?? 0)
    );

    setFreeMatches(
      Number(
        data.free_matches_remaining ?? 0
      )
    );

    setPlan(
      data.plan || 'free'
    );

    setMoneyMessage('');

    setWalletLoading(false);
  }


  useEffect(() => {

    loadWallet();

  }, []);


  async function startCall(person){

    if(walletLoading){

      setMoneyMessage(
        'Wallet is still loading. Try again in a moment.'
      );

      return;
    }


    setMoneyMessage('');


    const {
      data,
      error
    } = await supabase.rpc(
      'droxion_use_match'
    );


    if(error){

      console.error(
        'Droxion match charge error:',
        error.message
      );

      setMoneyMessage(
        'We could not verify your match allowance. Please try again.'
      );

      return;
    }


    if(!data?.allowed){

      setCoins(
        Number(
          data?.coin_balance ?? coins
        )
      );

      setFreeMatches(
        Number(
          data?.free_matches_remaining ?? 0
        )
      );

      if(data?.plan){
        setPlan(data.plan);
      }

      setMoneyMessage(
        `You need ${
          data?.required_coins ?? 10
        } coins for another match.`
      );

      setCoinStore(true);

      return;
    }


    setCoins(
      Number(
        data.coin_balance ?? coins
      )
    );

    setFreeMatches(
      Number(
        data.free_matches_remaining ??
        freeMatches
      )
    );

    if(data.plan){
      setPlan(data.plan);
    }

    setCall(person);
  }


  async function extendCall(){

    const {
      data,
      error
    } = await supabase.rpc(
      'droxion_extend_call'
    );


    if(error){

      console.error(
        'Droxion call extension error:',
        error.message
      );

      return {
        allowed:false,
        message:
          'We could not verify the wallet. Please try again.'
      };
    }


    setCoins(
      Number(
        data?.coin_balance ?? coins
      )
    );


    if(!data?.allowed){

      setMoneyMessage(
        `You need ${
          data?.required_coins ?? 25
        } coins to extend this call.`
      );

      return {
        allowed:false,
        message:
          `Not enough coins. You need ${
            data?.required_coins ?? 25
          } coins.`
      };
    }


    setMoneyMessage('');

    return {
      allowed:true
    };
  }


  let content;


  if(tab === 'discover'){

    content =
      <Discover onCall={startCall}/>;

  } else if(tab === 'live'){

    content =
      <LivePage onCall={startCall}/>;

  } else if(tab === 'messages'){

    content =
      <Messages/>;

  } else if(tab === 'creators'){

    content =
      <Creators/>;

  } else {

    content =
      <Profile
        onOpenWallet={()=>setCoinStore(true)}
        coins={coins}
        freeMatches={freeMatches}
        plan={plan}
      />;

  }


  if(call){

    return (
      <CallScreen
        person={call}
        onEnd={() => setCall(null)}
        coins={coins}
        onExtend={extendCall}
      />
    );
  }


  return (
    <main className="appShell">

      <TopBar
        coins={coins}
        onCoins={() =>
          setCoinStore(true)
        }
      />

      <div className="content">
        {content}
      </div>

      <BottomNav
        tab={tab}
        setTab={setTab}
      />


      {coinStore && (
        <CoinStore
          close={() => {
            setCoinStore(false);
            setMoneyMessage('');
          }}
          coins={coins}
          freeMatches={freeMatches}
          plan={plan}
          message={moneyMessage}
        />
      )}

    </main>
  );
}
