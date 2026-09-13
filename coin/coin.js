/**
 * Coin page — pure functions plus the browser entry point.
 *
 * Everything that can be wrong with money is in the pure part, so it can be
 * tested in node without a browser: the 4-byte selectors (re-derived from the
 * signatures in js/test_coin_page.mjs, so a typo cannot survive), the ABI
 * decoding, the curve math, and which stream hosts get a player and which get
 * a link. The browser part only fetches and paints.
 *
 * Robinhood Chain is read LIVE from the visitor's browser: the public RPC
 * answers with `access-control-allow-origin: *` (measured 2026-09-13), so a
 * static page can show the curve as it is right now with no server of ours.
 */

export const RPC = { robinhood: 'https://rpc.mainnet.chain.robinhood.com' };
export const PONS_FACTORY = '0x7eD598BcEf8bd9Edd8C97A195C6d13f40801EC7e';

/** Selectors, hard-coded so the page needs no keccak; guarded by a test. */
export const SEL = {
  getLaunchedToken: '0x3cf28b5a',
  quoteReserve: '0x9da771f4', realQuoteReserve: '0x4f1f58fd', tokenReserve: '0xcbcb3171',
  phantomQuote: '0xc57eadfc', graduationThreshold: '0x8b0bc501', graduated: '0xe7c2b772',
  readyToGraduate: '0xc68360a5', creatorTaxBps: '0xc1bb8901', creatorTaxBalance: '0xdb2bd533',
  feeBps: '0x24a9d853', pairToken: '0x3de35b79', isNativeQuote: '0xdc08e094',
  launchedAt: '0xbf56b371', launchSupply: '0x3f7ed6b7', sellableTokens: '0x808bcddc',
  symbol: '0x95d89b41', decimals: '0x313ce567', name: '0x06fdde03',
};

// ------------------------------------------------------------------ ABI

export function encodeAddressArg(selector, address) {
  const a = String(address).toLowerCase().replace(/^0x/, '');
  if (!/^[0-9a-f]{40}$/.test(a)) throw new Error('bad address');
  return selector + a.padStart(64, '0');
}
export const word = (hex, i) => hex.slice(2 + i * 64, 2 + (i + 1) * 64);
export const asUint = (w) => BigInt('0x' + (w || '0'));
export const asBool = (w) => asUint(w) !== 0n;
export const asAddress = (w) => '0x' + w.slice(24);
export function asString(hex) {
  // dynamic string: [offset][length][bytes]
  const off = Number(asUint(word(hex, 0))) / 32;
  const len = Number(asUint(word(hex, off)));
  const bytes = hex.slice(2 + (off + 1) * 64, 2 + (off + 1) * 64 + len * 2);
  return decodeURIComponent(bytes.replace(/(..)/g, '%$1'));
}
/** getLaunchedToken(address) returns one 15-field tuple, statically encoded. */
export function decodeLaunched(hex) {
  if (!hex || hex === '0x' || hex.length < 2 + 15 * 64) return null;
  const r = {
    token: asAddress(word(hex, 0)), curve: asAddress(word(hex, 1)), deployer: asAddress(word(hex, 2)),
    creatorFeeRecipient: asAddress(word(hex, 3)), pairToken: asAddress(word(hex, 4)),
    graduationThreshold: asUint(word(hex, 5)), creatorTaxBps: Number(asUint(word(hex, 8))),
    buybackEnabled: asBool(word(hex, 9)), phase: Number(asUint(word(hex, 10))), exists: asBool(word(hex, 14)),
  };
  return r.exists ? r : null;
}

// ---------------------------------------------------------------- MATH

const ZERO = '0x0000000000000000000000000000000000000000';

/** Everything the page states about the curve, derived once, from raw reads. */
export function deriveState(raw) {
  const { quoteReserve, realQuoteReserve, tokenReserve, graduationThreshold, graduated, readyToGraduate,
    creatorTaxBps, creatorTaxBalance, feeBps, launchedAt, pairDecimals, tokenDecimals, pairSymbol, isNativeQuote } = raw;
  const progress = graduationThreshold > 0n
    ? Math.min(1, Number(realQuoteReserve * 1000000n / graduationThreshold) / 1000000) : null;  // 1e-6 resolution, BigInt-safe
  // marginal price = quote (incl. phantom) / tokens, in pair units per token
  const price = tokenReserve > 0n
    ? (Number(quoteReserve) / 10 ** pairDecimals) / (Number(tokenReserve) / 10 ** tokenDecimals) : null;
  const status = graduated ? 'graduated' : readyToGraduate ? 'ready to graduate' : 'on the curve';
  return {
    progress, price, status,
    raised: Number(realQuoteReserve) / 10 ** pairDecimals,
    target: Number(graduationThreshold) / 10 ** pairDecimals,
    creatorTaxBps, curveFeeBps: Number(feeBps),
    creatorFeeAccrued: Number(creatorTaxBalance) / 10 ** pairDecimals,
    launchedAt: Number(launchedAt) ? new Date(Number(launchedAt) * 1000) : null,
    pairSymbol: isNativeQuote ? 'ETH' : pairSymbol,
  };
}

/** What the page says about the creator fee — the truth per route, never "80/20" by default. */
export function feeCopy(coin) {
  const bps = coin.creator_fee_bps;
  const pct = bps == null ? null : (bps / 100).toString().replace(/\.0$/, '') + '%';
  switch (coin.fee_model) {
    case 'split': return `${pct ?? 'A'} creator fee, split at launch: 80% to the creator, 20% to Pairoo.`;
    case 'single': return `${pct ?? 'A'} creator fee to one recipient. This route cannot split a fee.`;
    case 'none': return 'The platform keeps the trading fee on this route. There is no creator fee here.';
    default: return '';
  }
}

// -------------------------------------------------------------- STREAM

export const EMBED_HOSTS = new Set(['youtube', 'twitch', 'kick']);
/** The stream block: player where the host allows an iframe, a link card where it forbids one. */
export function streamView(stream) {
  if (!stream || !stream.url) return { kind: 'none' };
  if (stream.kind === 'embed' && stream.embed_url && EMBED_HOSTS.has(stream.host)) {
    return { kind: 'embed', src: stream.embed_url, label: stream.label, url: stream.url };
  }
  return { kind: 'link', url: stream.url, label: stream.label || 'Live' };
}

// -------------------------------------------------------------- FORMAT

export function fmtNum(n, max = 6) {
  if (n == null || !Number.isFinite(n)) return '—';
  if (n === 0) return '0';
  if (Math.abs(n) < 1e-7) return n.toExponential(2);   // below what six decimals can show
  return n.toLocaleString('en-US', { maximumFractionDigits: n < 1 ? max : n < 1000 ? 4 : 2 });
}
export const short = (a) => (a && a.length > 12 ? a.slice(0, 6) + '…' + a.slice(-4) : a || '—');
export function coinFromLocation(loc) {
  const m = /^\/coin\/([A-Za-z0-9]{20,64})\/?$/.exec(loc.pathname);
  if (m) return m[1];
  return new URLSearchParams(loc.search).get('a') || '';
}
export const sameMint = (a, b) => String(a || '').toLowerCase() === String(b || '').toLowerCase();

// ------------------------------------------------------------- BROWSER

/**
 * One HTTP request per refresh, not one per read. The public RPC answers a
 * JSON-RPC batch (measured 2026-09-13: 12 calls in one request, five times in a
 * row, all 200) and rate-limits bursts of separate requests ("Too Many
 * Requests" on the third page load in a row). A visitor's browser must never
 * be the thing that trips that limit.
 */
async function rpc(url, calls) {
  const batch = calls.map(([to, data], i) => ({ jsonrpc: '2.0', id: i + 1, method: 'eth_call', params: [{ to, data }, 'latest'] }));
  batch.push({ jsonrpc: '2.0', id: batch.length + 1, method: 'eth_blockNumber', params: [] });
  const r = await fetch(url, { method: 'POST', headers: { 'content-type': 'application/json' }, body: JSON.stringify(batch) });
  if (r.status === 429) throw new Error('the chain is rate-limiting reads right now; retrying shortly');
  if (!r.ok) throw new Error(`the chain answered ${r.status}`);
  const out = await r.json();
  if (!Array.isArray(out)) throw new Error('the chain did not answer the batch');
  const byId = new Map(out.map((x) => [x.id, x]));
  const results = batch.map((q) => { const x = byId.get(q.id); if (!x) throw new Error('missing answer'); if (x.error) throw new Error(x.error.message); return x.result; });
  return { results: results.slice(0, calls.length), block: Number(results[results.length - 1]) };
}

export async function readRobinhood(token) {
  const url = RPC.robinhood;
  // First request: is this token the factory's? Second: the curve, in one batch.
  const first = await rpc(url, [[PONS_FACTORY, encodeAddressArg(SEL.getLaunchedToken, token)]]);
  const L = decodeLaunched(first.results[0]);
  if (!L) return null;
  const c = L.curve;
  // Only what the page shows. phantomQuote/launchSupply/sellableTokens are not painted, so they are not read.
  const names = ['quoteReserve', 'realQuoteReserve', 'tokenReserve', 'graduationThreshold', 'graduated',
    'readyToGraduate', 'creatorTaxBps', 'creatorTaxBalance', 'feeBps', 'isNativeQuote', 'launchedAt'];
  const bools = new Set(['graduated', 'readyToGraduate', 'isNativeQuote']);
  const reads = names.map((n) => [c, SEL[n]]);
  reads.push([token, SEL.decimals]);
  const native = L.pairToken === ZERO;
  if (!native) { reads.push([L.pairToken, SEL.decimals]); reads.push([L.pairToken, SEL.symbol]); }
  const { results: res, block } = await rpc(url, reads);
  const raw = {};
  names.forEach((n, i) => { raw[n] = bools.has(n) ? asBool(word(res[i], 0)) : asUint(word(res[i], 0)); });
  raw.tokenDecimals = Number(asUint(word(res[names.length], 0)));
  raw.pairDecimals = native ? 18 : Number(asUint(word(res[names.length + 1], 0)));
  raw.pairSymbol = native ? 'ETH' : asString(res[names.length + 2]);
  return { launched: L, raw, state: deriveState(raw), block };
}
