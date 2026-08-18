import { useEffect, useState } from 'react';
import { Grid2X2, Rows3 } from 'lucide-react';

const CATEGORIES = ['All', 'Trending', 'Gaming', 'Music', 'IRL', 'Talk', 'Lifestyle', 'Entertainment'];

function normalize(value) { return String(value || '').trim().toLowerCase(); }

export default function HomeDiscoveryControls({ query = '' }) {
  const [category, setCategory] = useState('All');
  const [mode, setMode] = useState('grid');

  useEffect(() => {
    const root = document.querySelector('.liveOnlyHome');
    if (!root) return;
    root.classList.toggle('dxDiscoveryFeed', mode === 'feed');
    root.classList.toggle('dxDiscoveryGrid', mode === 'grid');

    const apply = () => {
      const q = normalize(query);
      const cat = normalize(category);
      root.querySelectorAll('.liveFeedCard').forEach(card => {
        const text = normalize(card.textContent);
        const matchesQuery = !q || text.includes(q);
        const matchesCategory = category === 'All' || (category === 'Trending' ? true : text.includes(cat));
        card.classList.toggle('dxFilteredOut', !(matchesQuery && matchesCategory));
      });
    };

    apply();
    const observer = new MutationObserver(apply);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [query, category, mode]);

  return (
    <div className="dxDiscoveryControls">
      <div className="dxCategoryRail" aria-label="LIVE categories">
        {CATEGORIES.map(item => <button type="button" key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}
      </div>
      <div className="dxDiscoveryMode" aria-label="Discovery layout">
        <button type="button" className={mode === 'grid' ? 'active' : ''} onClick={() => setMode('grid')}><Grid2X2 size={15} /> Grid</button>
        <button type="button" className={mode === 'feed' ? 'active' : ''} onClick={() => setMode('feed')}><Rows3 size={15} /> Feed</button>
      </div>
    </div>
  );
}
