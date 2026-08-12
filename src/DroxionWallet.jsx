import { useEffect, useMemo, useRef, useState } from 'react';
import { Capacitor } from '@capacitor/core';
import { NativePurchases, PURCHASE_TYPE } from '@capgo/native-purchases';
import { Coins, X } from 'lucide-react';
import { supabase } from './supabaseClient';

function getNativeStorePlatform() {
  try {
    const platform = Capacitor.getPlatform?.();
    if (platform === 'ios' || platform === 'android') return platform;
    if (Capacitor.isNativePlatform?.()) return platform || 'native';
  } catch {}
  return '';
}

function storeProductKey(product) {
  return product?.identifier || product?.productIdentifier || '';
}

export default function DroxionWallet({ coins = 0, freeMatches = 0, plan = 'free', onClose, onBalanceRefresh }) {
  const [products, setProducts] = useState([]);
  const [appleProducts, setAppleProducts] = useState([]);
  const [loading, setLoading] = useState(true);
  const [storeLoading, setStoreLoading] = useState(false);
  const [checkoutId, setCheckoutId] = useState('');
  const [selectedProduct, setSelectedProduct] = useState(null);
  const [paypalOrderId, setPaypalOrderId] = useState('');
  const [paypalReady, setPaypalReady] = useState(false);
  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');
  const paypalRef = useRef(null);
  const nativeStorePlatform = getNativeStorePlatform();
  const nativeMobile = Boolean(nativeStorePlatform);
  const isIOS = nativeStorePlatform === 'ios';

  useEffect(() => {
    let alive = true;
    (async () => {
      const { data, error: queryError } = await supabase
        .from('droxion_products')
        .select('id,product_type,name,price_cents,coins_granted,plan,sort_order,apple_product_id')
        .eq('active', true)
        .order('sort_order');
      if (!alive) return;
      if (queryError) setError(queryError.message || 'Unable to load Droxion products.');
      else setProducts(data || []);
      setLoading(false);
    })();
    return () => { alive = false; };
  }, []);

  const coinProducts = products.filter(product => product.product_type === 'coin_pack');
  const plans = products.filter(product => product.product_type === 'subscription');
  const appleProductMap = useMemo(() => {
    const map = new Map();
    appleProducts.forEach(product => {
      const key = storeProductKey(product);
      if (key) map.set(key, product);
    });
    return map;
  }, [appleProducts]);

  useEffect(() => {
    if (!isIOS || loading || !coinProducts.length) return;
    let alive = true;
    (async () => {
      setStoreLoading(true);
      try {
        const { isBillingSupported } = await NativePurchases.isBillingSupported();
        if (!isBillingSupported) throw new Error('Apple In-App Purchase is not available on this device.');
        const ids = coinProducts.map(product => product.apple_product_id).filter(Boolean);
        if (!ids.length) throw new Error('Droxion coin products are not configured for the App Store.');
        const { products: storeProducts } = await NativePurchases.getProducts({
          productIdentifiers: ids,
          productType: PURCHASE_TYPE.INAPP
        });
        if (alive) setAppleProducts(storeProducts || []);
      } catch (err) {
        if (alive) setError(err?.message || 'Could not load Apple coin products.');
      } finally {
        if (alive) setStoreLoading(false);
      }
    })();
    return () => { alive = false; };
  }, [isIOS, loading, products]);

  const webPrice = cents => `$${(Number(cents || 0) / 100).toFixed(2)}`;

  async function verifyAppleTransaction(transaction, expectedProductId) {
    const { data: { session } } = await supabase.auth.getSession();
    if (!session?.access_token || !session?.user?.id) throw new Error('Please sign in again before buying coins.');
    if (!transaction?.transactionId || !transaction?.receipt) throw new Error('Apple did not return a verifiable purchase receipt.');

    const response = await fetch('/api/apple/verify-purchase', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${session.access_token}`
      },
      body: JSON.stringify({
        receipt: transaction.receipt,
        transactionId: transaction.transactionId,
        productId: expectedProductId
      })
    });
    const payload = await response.json().catch(() => ({}));
    if (!response.ok || !payload?.ok) throw new Error(payload?.error || 'Apple purchase verification failed.');

    try {
      await NativePurchases.acknowledgePurchase({ purchaseToken: transaction.transactionId });
    } catch (ackError) {
      console.warn('StoreKit finish retry needed', ackError);
    }

    await onBalanceRefresh?.();
    return payload;
  }

  async function buyAppleCoins(product) {
    if (checkoutId) return;
    const productId = product.apple_product_id;
    const storeProduct = appleProductMap.get(productId);
    if (!productId || !storeProduct) {
      setError('This coin pack is not available from Apple yet.');
      return;
    }

    setError('');
    setSuccess('');
    setCheckoutId(product.id);
    try {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session?.user?.id) throw new Error('Please sign in again before buying coins.');

      const transaction = await NativePurchases.purchaseProduct({
        productIdentifier: productId,
        productType: PURCHASE_TYPE.INAPP,
        quantity: 1,
        appAccountToken: session.user.id,
        isConsumable: true,
        autoAcknowledgePurchases: false
      });

      const result = await verifyAppleTransaction(transaction, productId);
      setSuccess(`${result.coinsGranted || product.coins_granted} coins added to your Droxion wallet.`);
    } catch (err) {
      const message = String(err?.message || 'Apple purchase was not completed.');
      if (!/cancel/i.test(message)) setError(message);
    } finally {
      setCheckoutId('');
    }
  }

  async function buyCoins(product) {
    if (isIOS) {
      await buyAppleCoins(product);
      return;
    }
    if (nativeMobile) {
      setError('Coin purchases on Android will use Google Play Billing in the Android release.');
      return;
    }
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
    if (nativeMobile || !selectedProduct || !paypalOrderId || typeof window === 'undefined') return;
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
  }, [nativeMobile, selectedProduct, paypalOrderId]);

  useEffect(() => {
    if (nativeMobile || !paypalReady || !paypalOrderId || !selectedProduct || !paypalRef.current || !window.paypal?.Buttons) return;
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
  }, [nativeMobile, paypalReady, paypalOrderId, selectedProduct, onBalanceRefresh]);

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
        {loading || (isIOS && storeLoading) ? <p className="walletMuted">Loading store…</p> : nativeStorePlatform === 'android' ? (
          <div className="publishBillingNotice">Google Play Billing will be enabled in the Android release.</div>
        ) : (
          <div className="walletGrid">
            {coinProducts.map(product => {
              const storeProduct = isIOS ? appleProductMap.get(product.apple_product_id) : null;
              const displayPrice = isIOS ? (storeProduct?.priceString || 'Unavailable') : webPrice(product.price_cents);
              const unavailable = isIOS && !storeProduct;
              return (
                <button key={product.id} disabled={Boolean(checkoutId) || unavailable} onClick={() => buyCoins(product)}>
                  <Coins size={22} />
                  <strong>{product.coins_granted} coins</strong>
                  <span>{checkoutId === product.id ? (isIOS ? 'Purchasing…' : 'Opening PayPal…') : displayPrice}</span>
                </button>
              );
            })}
          </div>
        )}

        {!nativeMobile && (
          <>
            <h3>Droxion Plans</h3>
            <div className="walletPlans">
              {plans.length === 0 && !loading && <p className="walletMuted">No active plans are available right now.</p>}
              {plans.map(product => (
                <div className="walletPlan" key={product.id}>
                  <div>
                    <strong>{product.name}</strong>
                    <span>{webPrice(product.price_cents)}/month</span>
                  </div>
                  <small>+{product.coins_granted || 0} coins</small>
                  <button type="button" disabled title="Subscription checkout will be enabled after store billing setup is complete">Coming soon</button>
                </div>
              ))}
            </div>
          </>
        )}

        {!nativeMobile && selectedProduct && paypalOrderId && (
          <div className="paypalBox">
            <p>PayPal checkout for {selectedProduct.name}</p>
            <div ref={paypalRef} />
          </div>
        )}
      </div>
    </div>
  );
}
