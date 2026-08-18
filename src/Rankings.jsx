import { useEffect, useState } from 'react';
import { Crown, Radio, Trophy, UserRound } from 'lucide-react';
import { supabase } from './supabaseClient';
import './rankings.css';

const PERIODS = ['daily', 'weekly', 'monthly'];

function creatorAvatar(row, small = false) {
  if (row.avatar_url) return <img src={row.avatar_url} alt="" />;
  return <div className={`rankAvatar${small ? ' small' : ''}`}><UserRound size={small ? 17 : 24} /></div>;
}

export default function Rankings() {
  const [period, setPeriod] = useState('daily');
  const [rows, setRows] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let active = true;
    (async () => {
      setLoading(true);
      const { data, error } = await supabase.rpc('droxion_creator_rankings', { p_period: period, p_limit: 100 });
      if (!active) return;
      setRows(error ? [] : (data || []));
      setLoading(false);
    })();
    return () => { active = false; };
  }, [period]);

  return (
    <section className="rankPage">
      <div className="rankHero"><span>CREATOR LEADERBOARD</span><h1>Rankings</h1><p>Top creators ranked by LIVE gifts received.</p></div>
      <div className="rankTabs">{PERIODS.map(item => <button type="button" key={item} onClick={() => setPeriod(item)} className={period === item ? 'active' : ''}>{item[0].toUpperCase() + item.slice(1)}</button>)}</div>
      {loading ? <div className="rankEmpty">Loading rankings…</div> : rows.length === 0 ? <div className="rankEmpty"><Trophy size={30} /><strong>No ranking activity yet</strong><span>Creators will appear here as LIVE gifts are sent.</span></div> : <>
        <div className="rankPodium">{rows.slice(0,3).map((row, index) => <article key={row.user_id} className={`rankPodiumCard rank-${index+1}`}><div className="rankCrown">{index === 0 ? <Crown size={20} /> : `#${index+1}`}</div>{creatorAvatar(row)}<strong>{row.display_name || 'Creator'}</strong><span>{Number(row.gift_coins || 0).toLocaleString()} gift coins</span>{row.is_live && <em><Radio size={11} /> LIVE</em>}</article>)}</div>
        <div className="rankList">{rows.slice(3).map((row, index) => <article key={row.user_id}><b>#{index + 4}</b>{creatorAvatar(row, true)}<div><strong>{row.display_name || 'Creator'}</strong><span>{Number(row.gift_count || 0)} gifts</span></div><aside><strong>{Number(row.gift_coins || 0).toLocaleString()}</strong><span>coins</span></aside>{row.is_live && <em>LIVE</em>}</article>)}</div>
      </>}
    </section>
  );
}
