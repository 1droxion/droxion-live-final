import { useEffect, useState } from 'react';

const CATEGORIES = ['All', 'Trending', 'Gaming', 'Music', 'IRL', 'Talk', 'Lifestyle', 'Entertainment'];

function normalize(value) { return String(value || '').trim().toLowerCase(); }

export default function HomeDiscoveryControls({ query = '' }) {
  const [category, setCategory] = useState('All');

  useEffect(() => {
    const root = document.querySelector('.liveOnlyHome');
    if (!root) return;
    root.classList.add('dxDiscoverySingle');

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
    const feed = root.querySelector('.liveOnlyScroll');
    feed?.scrollTo?.({ top: 0, behavior: 'smooth' });

    const observer = new MutationObserver(apply);
    observer.observe(root, { childList: true, subtree: true, characterData: true });
    return () => observer.disconnect();
  }, [query, category]);

  return (
    <div className="dxDiscoveryControls dxDiscoveryControlsSingle">
      <div className="dxCategoryRail" aria-label="LIVE categories">
        {CATEGORIES.map(item => <button type="button" key={item} className={category === item ? 'active' : ''} onClick={() => setCategory(item)}>{item}</button>)}
      </div>
    </div>
  );
}
