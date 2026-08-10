import { useEffect, useRef, useState } from 'react';
import { Coins, X } from 'lucide-react';
import { supabase } from './supabaseClient';

export default function DroxionWallet({ coins = 0, freeMatches = 0, plan = 'free', onClose, onBalanceRefresh }) {
  const [products, setProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [checkoutId, setCheckoutId] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [paypalOrderId, setPaypalOrderId] = useState('');
  const [paypalReady, setPaypalReady] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const paypalRef = useRef(null);

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error: queryError } = await supabase
        .from('droxion_products')
        .select('id,product_type,name,price_cents,coins_granted,plan,sort_order')
        .eq('active', true)
        .order('sort_order');
      if (!alive) return;
      if (queryError) setError(queryError.message || 'Unable to load Droxion products.');
      else setProducts(data || []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const price = cents => `$${(Number(cents || 0) / 100).toFixed(2)}`;
  const coinProducts = products.filter(product => product.product_type === 'coin_pack');
  const plans = products.filter(product => product.product_type === 'subscription');

  async function buyCoins(product) {
    if (checkoutId) return;
    setError('');
    setSuccess('');
    setCheckoutId(product.id);
    setSelectedProduct(product);
    setPaypalOrderId('');
    setPaypalReady(false);

    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.access_token) throw new Error('Please sign in again before buying coins.');
      const response = await fetch('/api/paypal/create-order', {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          Authorization: `Bearer ${session.access_token}`
        },
        body: JSON.stringify({ packageId: product.id })
      });
      const payload = await response.json().catch(() => ({}));
      if (!response.ok || !payload.orderId) throw new Error(payload.error || 'PayPal checkout could not be started.');
      setPaypalOrderId(payload.orderId);
    } catch (err) {
      setError(err?.message || 'PayPal checkout could not be started.');
      setCheckoutId('');
      setSelectedProduct(null);
    }
  }

  useEffect(() => {
    if (!selectedProduct || !paypalOrderId || typeof window === 'undefined') return;
    if (!import.meta.env.VITE_PAYPAL_CLIENT_ID) {
      setError('PayPal is not configured for this environment yet.');
      return;
    }
    if (window.paypal) {
      setPaypalReady(true);
      return;
    }
    let script = document.getElementById('paypal-sdk');
    if (!script) {
      script = document.createElement('script');
      script.id = 'paypal-sdk';
      script.src = `https://www.paypal.com/sdk/js?client-id=${encodeURIComponent(import.meta.env.VITE_PAYPAL_CLIENT_ID)}&currency=USD&intent=capture&commit=true`;
      script.async = true;
      document.body.appendChild(script);
    }
    const onLoad = () => setPaypalReady(true);
    const onError = () => setError('PayPal could not be loaded.');
    script.addEventListener('load', onLoad);
    script.addEventListener('error', onError);
    return () => {
      script?.removeEventListener('load', onLoad);
      script?.removeEventListener('error', onError);
    };
  }, [selectedProduct, paypalOrderId]);

  useEffect(() => {
    if (!paypalReady || !paypalOrderId || !selectedProduct || !paypalRef.current || !window.paypal?.Buttons) return;
    const container = paypalRef.current;
    container.innerHTML = '';
    const buttons = window.paypal.Buttons({
      createOrder: () => paypalOrderId,
      onApprove: async data => {
        try {
          const { data: { session } } = await supabase.auth.getSession();
          if (!session?.access_token) throw new Error('Please sign in again before finishing your purchase.');
          const orderId = data?.orderID || paypalOrderId;
          const response = await fetch('/api/paypal/capture-order', {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              Authorization: `Bearer ${session.access_token}`
            },
            body: JSON.stringify({ orderId })
          });
          const payload = await response.json().catch(() => ({}));
          if (!response.ok || payload.error) throw new Error(payload.error || 'Payment verification failed.');
          setSuccess('Payment complete. Your coins were added.');
          await onBalanceRefresh?.();
        } catch (err) {
          setError(err?.message || 'Payment verification failed.');
        } finally {
          setCheckoutId('');
          setSelectedProduct(null);
          setPaypalOrderId('');
          setPaypalReady(false);
        }
      },
      onCancel: () => {
        setError('PayPal checkout was cancelled.');
        setCheckoutId('');
        setSelectedProduct(null);
        setPaypalOrderId('');
      },
      onError: err => {
        setError(err?.message || 'PayPal checkout failed.');
        setCheckoutId('');
        setSelectedProduct(null);
        setPaypalOrderId('');
      }
    });
    buttons.render(container).catch(err => setError(err?.message || 'PayPal checkout could not be displayed.'));
    return () => { container.innerHTML = ''; };
  }, [paypalReady, paypalOrderId, selectedProduct, onBalanceRefresh]);

  return (
    <div className="walletOverlay" role="dialog" aria-modal="true" aria-label="Droxion Wallet">
      <div className="walletSheet">
        <div className="walletHead">
          <div>
            <h2>Droxion Wallet</h2>
            <p>{coins} coins · {freeMatches} free matches · {String(plan).toUpperCase()} plan</p>
          </div>
          <button onClick={onClose} aria-label="Close wallet"><X size={20} /></button>
        </div>

        {error && <div className="walletError">{error}</div>}
        {success && <div className="walletSuccess">{success}</div>}

        <h3>Buy Coins</h3>
        {loading ? <p className="walletMuted">Loading…</p> : (
          <div className="walletGrid">
            {coinProducts.map(product => (
              <button key={product.id} disabled={Boolean(checkoutId)} onClick={() => buyCoins(product)}>
                <Coins size={22} />
                <strong>{product.coins_granted} coins</strong>
                <span>{checkoutId === product.id ? 'Opening PayPal…' : price(product.price_cents)}</span>
              </button>
            ))}
          </div>
        )}

        <h3>Droxion Plans</h3>
        <div className="walletPlans">
          {plans.length === 0 && !loading && <p className="walletMuted">No active plans are available right now.</p>}
          {plans.map(product => (
            <div className="walletPlan" key={product.id}>
              <div>
                <strong>{product.name}</strong>
                <span>{price(product.price_cents)}/month</span>
              </div>
              <small>+{product.coins_granted || 0} coins</small>
              <button type="button" disabled title="Subscription checkout will be enabled after billing setup is complete">Coming soon</button>
            </div>
          ))}
        </div>

        {selectedProduct && paypalOrderId && (
          <div className="paypalBox">
            <p>PayPal checkout for {selectedProduct.name}</p>
            <div ref={paypalRef} />
          </div>
        )}
      </div>
    </div>
  );
}
