import { useEffect } from 'react';
import './live-interactions.css';

function participantColor(name = '') {
  let hash = 0;
  for (let i = 0; i < name.length; i += 1) hash = ((hash << 5) - hash + name.charCodeAt(i)) | 0;
  const hue = Math.abs(hash) % 360;
  return `hsl(${hue} 88% 72%)`;
}

function giftDetails(line) {
  const sender = line.querySelector('strong')?.textContent?.trim() || 'Someone';
  const text = line.textContent?.trim() || '';
  const afterSent = text.includes(' sent ') ? text.split(' sent ').slice(1).join(' sent ').trim() : '🎁 Gift';
  const parts = afterSent.split(/\s+/).filter(Boolean);
  return {
    sender,
    emoji: parts[0] || '🎁',
    gift: parts.slice(1).join(' ') || 'Gift',
  };
}

export default function LiveInteractionEnhancer() {
  useEffect(() => {
    let giftLane = 0;
    const enhancedStages = new Set();

    const scrollToLatest = feed => {
      window.requestAnimationFrame(() => {
        feed.scrollTop = feed.scrollHeight;
      });
    };

    const celebrateGift = (line, stage) => {
      const { sender, emoji, gift } = giftDetails(line);
      const celebration = document.createElement('div');
      celebration.className = 'liveGiftCelebration';
      celebration.style.bottom = `${31 + (giftLane % 3) * 6}%`;
      giftLane += 1;

      const icon = document.createElement('span');
      icon.className = 'liveGiftCelebrationIcon';
      icon.textContent = emoji;

      const copy = document.createElement('div');
      copy.className = 'liveGiftCelebrationCopy';
      const strong = document.createElement('strong');
      strong.textContent = sender;
      strong.style.color = participantColor(sender);
      const label = document.createElement('span');
      label.textContent = `sent ${emoji} ${gift}`;
      copy.append(strong, label);

      const sparks = document.createElement('div');
      sparks.className = 'liveGiftSparks';
      for (let index = 0; index < 8; index += 1) {
        const spark = document.createElement('i');
        spark.className = 'liveGiftSpark';
        sparks.appendChild(spark);
      }

      celebration.append(sparks, icon, copy);
      stage.appendChild(celebration);
      window.setTimeout(() => celebration.remove(), 2600);
    };

    const ensureFeed = stage => {
      let feed = stage.querySelector('.liveSmartChat');
      if (feed) return feed;

      feed = document.createElement('div');
      feed.className = 'liveSmartChat';
      feed.setAttribute('aria-live', 'polite');
      feed.setAttribute('aria-relevant', 'additions');
      stage.appendChild(feed);
      enhancedStages.add(stage);

      const source = stage.querySelector('.liveChatV4');
      if (source) {
        source.classList.add('liveChatV4Source');
        const initialLines = Array.from(source.querySelectorAll('.liveChatLine'));
        initialLines.forEach(line => captureLine(line, stage, false));
        if (!initialLines.length) {
          const hint = document.createElement('div');
          hint.className = 'liveSmartChatHint';
          hint.textContent = 'Live chat will appear here.';
          feed.appendChild(hint);
        }
      }
      return feed;
    };

    const captureLine = (line, stage, playGiftEffect = true) => {
      if (!(line instanceof HTMLElement) || !stage || line.dataset.liveSmartCaptured === '1') return;
      line.dataset.liveSmartCaptured = '1';
      const feed = ensureFeed(stage);
      feed.querySelector('.liveSmartChatHint')?.remove();

      const clone = line.cloneNode(true);
      clone.classList.add('liveSmartChatLine');
      const sender = clone.querySelector('strong');
      if (sender) sender.style.color = participantColor(sender.textContent || 'Droxion');
      if (clone.classList.contains('liveGiftEvent')) clone.classList.add('liveSmartGiftLine');
      feed.appendChild(clone);

      while (feed.children.length > 240) feed.firstElementChild?.remove();
      scrollToLatest(feed);

      if (playGiftEffect && line.classList.contains('liveGiftEvent')) celebrateGift(line, stage);
    };

    const scan = node => {
      if (!(node instanceof Element)) return;

      if (node.matches('.liveStageV4')) ensureFeed(node);
      node.querySelectorAll?.('.liveStageV4').forEach(ensureFeed);

      if (node.matches('.liveChatLine')) {
        const stage = node.closest('.liveStageV4');
        if (stage) captureLine(node, stage, true);
      }
      node.querySelectorAll?.('.liveChatLine').forEach(line => {
        const stage = line.closest('.liveStageV4');
        if (stage) captureLine(line, stage, true);
      });
    };

    document.querySelectorAll('.liveStageV4').forEach(ensureFeed);

    const observer = new MutationObserver(records => {
      records.forEach(record => record.addedNodes.forEach(scan));
    });
    observer.observe(document.body, { childList: true, subtree: true });

    return () => {
      observer.disconnect();
      enhancedStages.forEach(stage => {
        stage.querySelector('.liveSmartChat')?.remove();
        stage.querySelector('.liveChatV4')?.classList.remove('liveChatV4Source');
      });
      document.querySelectorAll('.liveGiftCelebration').forEach(node => node.remove());
    };
  }, []);

  return null;
}
