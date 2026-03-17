import { useState } from 'react';

const VALID_KEYS: string[] = [];

const KEY_PREFIX = 'DOOR-';
const FREE_USES_PER_DAY = 3;

const GROQ_SYSTEM_PROMPT = `You are an expert marketing copywriter for home service businesses in the USA. Generate exactly 5 "Sorry We Missed You" door card messages for the business below.

Each message must:
- Be 3-5 lines long (perfect for a door hanger card or sticky note)
- Sound human and genuine, never robotic
- Include a clear call to action with their contact info
- Each have a completely different angle as follows:
  CARD_1: Friendly and warm — neighbourly tone
  CARD_2: Urgency-focused — don't delay, small issues become big
  CARD_3: Professional and formal — builds trust and credibility
  CARD_4: Offer-based — mention free estimate or free inspection
  CARD_5: Short and punchy — 2-3 lines max for small cards

Rules:
- Use CARD_1: CARD_2: CARD_3: CARD_4: CARD_5: as separators
- Always include their contact info naturally in the message
- Write for USA audience
- No preamble, no explanation, just the 5 messages`;

const serviceTypes = [
  'Plumbing',
  'Electrical',
  'HVAC / Air Conditioning',
  'Locksmith',
  'Pest Control',
  'Carpet Cleaning',
  'Window Cleaning',
  'Roofing',
  'Landscaping',
  'Painting',
  'General Handyman',
  'Other',
];

const cardAngles = [
  { label: 'Friendly & Warm', emoji: '😊', color: '#16A34A' },
  { label: 'Urgency', emoji: '⚡', color: '#EF4444' },
  { label: 'Professional', emoji: '💼', color: '#92400E' },
  { label: 'Free Offer', emoji: '🎁', color: '#16A34A' },
  { label: 'Short & Punchy', emoji: '🎯', color: '#F59E0B' },
];

function parseCards(text: string) {
  const parts = text.split(/CARD_[12345]:/);
  return parts
    .slice(1)
    .map((s) => s.trim())
    .filter(Boolean);
}

function getTodayKey() {
  return new Date().toISOString().slice(0, 10);
}

function getUsesLeft() {
  try {
    const s = localStorage.getItem('dm_uses');
    if (!s) return FREE_USES_PER_DAY;
    const { date, count } = JSON.parse(s);
    return date !== getTodayKey()
      ? FREE_USES_PER_DAY
      : Math.max(0, FREE_USES_PER_DAY - count);
  } catch {
    return FREE_USES_PER_DAY;
  }
}

function decrementUses() {
  try {
    const today = getTodayKey();
    const s = localStorage.getItem('dm_uses');
    if (!s) {
      localStorage.setItem(
        'dm_uses',
        JSON.stringify({ date: today, count: 1 })
      );
      return;
    }
    const { date, count } = JSON.parse(s);
    localStorage.setItem(
      'dm_uses',
      JSON.stringify({ date: today, count: date === today ? count + 1 : 1 })
    );
  } catch {}
}

function isUnlocked() {
  try {
    return localStorage.getItem('dm_licensed') === 'true';
  } catch {
    return false;
  }
}
function saveLicense() {
  try {
    localStorage.setItem('dm_licensed', 'true');
  } catch {}
}

const styleEl = document.createElement('style');
styleEl.textContent = `
  *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
  html { scroll-behavior: smooth; }
  body { background: #FFFBF5; font-family: 'Inter', 'Segoe UI', sans-serif; }
  @keyframes spin { to { transform: rotate(360deg); } }
  @keyframes fadeUp { from { opacity: 0; transform: translateY(16px); } to { opacity: 1; transform: translateY(0); } }
  @keyframes float { 0%,100% { transform: translateY(0px); } 50% { transform: translateY(-6px); } }
  @keyframes gradientShift { 0% { background-position: 0% 50%; } 50% { background-position: 100% 50%; } 100% { background-position: 0% 50%; } }
  .anim-fade { animation: fadeUp 0.4s ease forwards; }
  textarea:focus, input:focus, select:focus { outline: none !important; border-color: #92400E !important; box-shadow: 0 0 0 3px rgba(146,64,14,0.1) !important; }
  button { font-family: inherit; }
  button:hover:not(:disabled) { filter: brightness(1.08); transform: translateY(-1px); transition: all 0.15s; }
  button:active:not(:disabled) { transform: translateY(0); }
  select option { background: #FFFBF5; color: #292524; }
  ::-webkit-scrollbar { width: 8px; }
  ::-webkit-scrollbar-track { background: #FEF3E2; }
  ::-webkit-scrollbar-thumb { background: #D4A574; border-radius: 4px; }
`;
document.head.appendChild(styleEl);

export default function DoorMint() {
  const [screen, setScreen] = useState('input');
  const [bizName, setBizName] = useState('');
  const [service, setService] = useState('Plumbing');
  const [contact, setContact] = useState('');
  const [extraNote, setExtraNote] = useState('');
  const [cards, setCards] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [copied, setCopied] = useState<number | string | null>(null);
  const [licensed, setLicensed] = useState(isUnlocked);
  const [usesLeft, setUsesLeft] = useState(getUsesLeft);
  const [keyInput, setKeyInput] = useState('');
  const [keyError, setKeyError] = useState('');
  const [keySuccess, setKeySuccess] = useState(false);
  const [groqKey, setGroqKey] = useState(
    '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'
  );
  const [showGroqInput, setShowGroqInput] = useState(false);

  const canGenerate = licensed || usesLeft > 0;

  function validateKey(k: string) {
    const clean = k.trim().toUpperCase();
    if (VALID_KEYS.includes(clean)) return true;
    if (
      VALID_KEYS.length === 0 &&
      clean.startsWith(KEY_PREFIX) &&
      clean.length === 19
    )
      return true;
    return false;
  }

  function handleUnlock() {
    setKeyError('');
    const k = keyInput.trim().toUpperCase();
    if (!k) {
      setKeyError('Please enter your license key.');
      return;
    }
    if (!k.startsWith(KEY_PREFIX)) {
      setKeyError('Keys start with DOOR- — check your purchase email.');
      return;
    }
    if (!validateKey(k)) {
      setKeyError('Key not recognised. Check your email or contact support.');
      return;
    }
    saveLicense();
    setLicensed(true);
    setKeySuccess(true);
    setTimeout(() => setScreen('input'), 1800);
  }

  async function generateCards() {
    if (!bizName.trim() || !contact.trim()) return;
    if (!canGenerate) {
      setScreen('unlock');
      return;
    }

    const apiKey =
      groqKey ||
      (typeof import.meta !== 'undefined' && import.meta.env?.VITE_GROQ_KEY) ||
      '';
    if (!apiKey) {
      setShowGroqInput(true);
      return;
    }

    setLoading(true);
    setError('');
    setCards([]);

    const userPrompt = `Business Name: ${bizName}
Service Type: ${service}
Contact Info: ${contact}${extraNote ? `\nExtra detail: ${extraNote}` : ''}`;

    try {
      const res = await fetch(
        'https://api.groq.com/openai/v1/chat/completions',
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: `Bearer ${apiKey}`,
          },
          body: JSON.stringify({
            model: 'llama-3.3-70b-versatile',
            max_tokens: 1200,
            messages: [
              { role: 'system', content: GROQ_SYSTEM_PROMPT },
              { role: 'user', content: userPrompt },
            ],
          }),
        }
      );

      if (!res.ok) {
        const e = await res.json();
        throw new Error(e.error?.message || 'API error');
      }
      const data = await res.json();
      const parsed = parseCards(data.choices[0].message.content);
      setCards(parsed.length >= 3 ? parsed : [data.choices[0].message.content]);
      if (!licensed) {
        decrementUses();
        setUsesLeft(getUsesLeft());
      }
      setScreen('results');
    } catch (e) {
      setError(
        (e as Error).message || 'Something went wrong. Please try again.'
      );
    } finally {
      setLoading(false);
    }
  }

  function copyText(text: string, idx: number) {
    navigator.clipboard.writeText(text);
    setCopied(idx);
    setTimeout(() => setCopied(null), 2000);
  }

  function copyAll() {
    const all = cards
      .map(
        (c, i) => `--- Option ${i + 1}: ${cardAngles[i]?.label || ''} ---\n${c}`
      )
      .join('\n\n');
    navigator.clipboard.writeText(all);
    setCopied('all' as any);
    setTimeout(() => setCopied(null), 2000);
  }

  return (
    <div style={S.root}>
      <div style={S.bgGlow1} />
      <div style={S.bgGlow2} />
      <div style={S.bgGrid} />

      <header style={S.header}>
        <div style={S.logo} onClick={() => setScreen('input')}>
          <div style={S.logoIcon}>
            <svg width="22" height="22" viewBox="0 0 24 24" fill="none">
              <path
                d="M3 9l9-7 9 7v11a2 2 0 01-2 2H5a2 2 0 01-2-2V9z"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <path
                d="M9 22V12h6v10"
                stroke="white"
                strokeWidth="2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
              <circle
                cx="19"
                cy="8"
                r="4"
                fill="#16A34A"
                stroke="white"
                strokeWidth="1.5"
              />
              <path
                d="M17.5 8l1 1 2-2"
                stroke="white"
                strokeWidth="1.2"
                strokeLinecap="round"
                strokeLinejoin="round"
              />
            </svg>
          </div>
          <div>
            <span style={S.logoText}>DoorMint</span>
            <span style={S.logoTag}>AI Card Writer</span>
          </div>
        </div>

        <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
          {licensed ? (
            <div style={S.proBadge}>Lifetime Access</div>
          ) : (
            <div style={S.usesBadge}>
              {usesLeft > 0
                ? `${usesLeft} free ${usesLeft === 1 ? 'use' : 'uses'} left`
                : 'Upgrade to continue'}
            </div>
          )}
          {!licensed && (
            <button onClick={() => setScreen('unlock')} style={S.headerBtn}>
              Unlock
            </button>
          )}
        </div>
      </header>

      <main style={S.main}>
        {screen === 'unlock' && (
          <div style={{ ...S.card, ...S.anim }}>
            {keySuccess ? (
              <div style={{ textAlign: 'center', padding: '48px 20px' }}>
                <div
                  style={{
                    fontSize: 56,
                    marginBottom: 16,
                    animation: 'float 2s ease infinite',
                  }}
                >
                  🎉
                </div>
                <h2 style={S.h2}>You're unlocked!</h2>
                <p style={{ ...S.muted, marginTop: 10, fontWeight: 500 }}>
                  Lifetime access activated. Enjoy unlimited card generation.
                </p>
              </div>
            ) : (
              <>
                <div style={{ textAlign: 'center', marginBottom: 32 }}>
                  <div style={{ fontSize: 48, marginBottom: 14 }}>🔐</div>
                  <h2 style={S.h2}>Enter Your License Key</h2>
                  <p style={{ ...S.muted, marginTop: 8, fontWeight: 500 }}>
                    {usesLeft === 0
                      ? "You've used all 3 free card generations for today."
                      : 'Get unlimited access with a one-time purchase.'}
                  </p>
                </div>

                <div style={{ display: 'flex', gap: 10, marginBottom: 10 }}>
                  <input
                    style={S.keyField}
                    type="text"
                    placeholder="DOOR-XXXX-XXXX-XXXX"
                    value={keyInput}
                    onChange={(e) => {
                      setKeyInput(e.target.value.toUpperCase());
                      setKeyError('');
                    }}
                    onKeyDown={(e) => e.key === 'Enter' && handleUnlock()}
                    maxLength={19}
                  />
                  <button onClick={handleUnlock} style={S.activateBtn}>
                    Activate
                  </button>
                </div>
                {keyError && <div style={S.errorBox}>{keyError}</div>}

                <div style={S.divider} />

                <div style={S.pricingBox}>
                  <div style={S.pricingTopRow}>
                    <div>
                      <div style={S.pricingLabel}>Lifetime Access</div>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'baseline',
                          gap: 10,
                          marginTop: 6,
                        }}
                      >
                        <span style={S.bigPrice}>$19</span>
                        <span style={S.oldPrice}>$39</span>
                        <span style={S.launchBadge}>Launch Price</span>
                      </div>
                    </div>
                  </div>

                  <div style={S.featureList}>
                    {[
                      'Unlimited card generations — forever',
                      'All 12 service types supported',
                      '5 card angles per generation',
                      'Works on any device, any browser',
                      'No subscription, no recurring fees',
                      'License key delivered instantly by email',
                    ].map((f) => (
                      <div key={f} style={S.featureItem}>
                        <span
                          style={{
                            color: '#16A34A',
                            fontSize: 16,
                            fontWeight: 900,
                          }}
                        >
                          ✓
                        </span>{' '}
                        {f}
                      </div>
                    ))}
                  </div>

                  <a
                    href="https://gumroad.com/YOUR_PRODUCT_LINK"
                    target="_blank"
                    rel="noopener noreferrer"
                    style={S.buyBtn}
                  >
                    Buy Lifetime Access — $19
                  </a>
                  <p
                    style={{
                      color: '#A8A29E',
                      fontSize: 13,
                      textAlign: 'center',
                      marginTop: 12,
                      fontWeight: 500,
                    }}
                  >
                    Secure checkout via Gumroad • Key sent instantly to your
                    email
                  </p>
                </div>

                <button
                  onClick={() => setScreen('input')}
                  style={{
                    display: 'block',
                    margin: '20px auto 0',
                    background: 'none',
                    border: 'none',
                    color: '#A8A29E',
                    fontSize: 14,
                    cursor: 'pointer',
                    fontWeight: 600,
                  }}
                >
                  ← Back ({usesLeft} free {usesLeft === 1 ? 'use' : 'uses'}{' '}
                  remaining today)
                </button>
              </>
            )}
          </div>
        )}

        {screen === 'input' && (
          <div style={S.anim}>
            <div style={S.hero}>
              <div style={S.heroBadge}>For Home Service Businesses</div>
              <h1 style={S.h1}>
                Turn missed visits into
                <br />
                <span style={S.gradText}>booked jobs</span>
              </h1>
              <p style={S.heroSub}>
                Generate 5 professional "Sorry We Missed You" door cards in 10
                seconds. Stop losing leads to handwritten notes.
              </p>
              <div style={S.statsRow}>
                {[
                  ['3×', 'more callbacks'],
                  ['10 sec', 'to generate'],
                  ['$0', 'upfront cost'],
                ].map(([val, label]) => (
                  <div key={label} style={S.statBox}>
                    <span style={S.statVal}>{val}</span>
                    <span style={S.statLabel}>{label}</span>
                  </div>
                ))}
              </div>
            </div>

            <div style={S.card}>
              <h2 style={{ ...S.h2, marginBottom: 24 }}>Generate Your Cards</h2>

              <div style={S.field}>
                <label style={S.label}>
                  Business Name <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  style={S.input}
                  type="text"
                  placeholder="e.g. Mike's Plumbing"
                  value={bizName}
                  onChange={(e) => setBizName(e.target.value)}
                />
              </div>

              <div style={S.field}>
                <label style={S.label}>
                  Service Type <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <select
                  style={S.select}
                  value={service}
                  onChange={(e) => setService(e.target.value)}
                >
                  {serviceTypes.map((s) => (
                    <option key={s} value={s}>
                      {s}
                    </option>
                  ))}
                </select>
              </div>

              <div style={S.field}>
                <label style={S.label}>
                  Phone Number or Website{' '}
                  <span style={{ color: '#EF4444' }}>*</span>
                </label>
                <input
                  style={S.input}
                  type="text"
                  placeholder="e.g. (555) 012-3456 or www.mikesplumbing.com"
                  value={contact}
                  onChange={(e) => setContact(e.target.value)}
                />
              </div>

              <div style={S.field}>
                <label style={S.label}>
                  Extra Detail <span style={S.optional}>(optional)</span>
                </label>
                <input
                  style={S.input}
                  type="text"
                  placeholder="e.g. 20 years experience, free same-day quotes, family owned"
                  value={extraNote}
                  onChange={(e) => setExtraNote(e.target.value)}
                />
              </div>

              {showGroqInput && (
                <div style={S.groqBox}>
                  <p
                    style={{ color: '#92400E', fontSize: 14, fontWeight: 700 }}
                  >
                    Add your free Groq API key to power the AI
                  </p>
                  <p style={{ color: '#78716C', fontSize: 13, marginTop: 4 }}>
                    Get it free at{' '}
                    <strong style={{ color: '#92400E' }}>groq.com</strong> → API
                    Keys → Create Key
                  </p>
                  <div style={{ display: 'flex', gap: 8, marginTop: 10 }}>
                    <input
                      style={{ ...S.keyField, flex: 1 }}
                      type="password"
                      placeholder="gsk_xxxxxxxxxxxxxxxxxxxx"
                      value={groqKey}
                      onChange={(e) => setGroqKey(e.target.value)}
                    />
                    <button
                      onClick={() => {
                        try {
                          localStorage.setItem('dm_groq', groqKey);
                        } catch {}
                        setShowGroqInput(false);
                      }}
                      style={S.activateBtn}
                    >
                      Save
                    </button>
                  </div>
                </div>
              )}

              {error && <div style={S.errorBox}>{error}</div>}

              {!canGenerate && (
                <div style={S.limitBanner}>
                  <span
                    style={{ color: '#92400E', fontSize: 14, fontWeight: 700 }}
                  >
                    You've used all 3 free generations for today.
                  </span>
                  <button
                    onClick={() => setScreen('unlock')}
                    style={S.inlineUnlockBtn}
                  >
                    Unlock unlimited
                  </button>
                </div>
              )}

              <button
                onClick={generateCards}
                disabled={
                  loading || !bizName.trim() || !contact.trim() || !canGenerate
                }
                style={{
                  ...S.genBtn,
                  ...(!bizName.trim() ||
                  !contact.trim() ||
                  !canGenerate ||
                  loading
                    ? S.genBtnDisabled
                    : {}),
                }}
              >
                {loading ? (
                  <span
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      justifyContent: 'center',
                      gap: 10,
                    }}
                  >
                    <span style={S.spinner} />
                    Writing your door cards...
                  </span>
                ) : canGenerate ? (
                  'Generate 5 Door Cards'
                ) : (
                  'Unlock to Generate'
                )}
              </button>

              {!licensed && canGenerate && (
                <p
                  style={{
                    textAlign: 'center',
                    color: '#A8A29E',
                    fontSize: 13,
                    marginTop: 10,
                    fontWeight: 500,
                  }}
                >
                  {usesLeft} free{' '}
                  {usesLeft === 1 ? 'generation' : 'generations'} left today •{' '}
                  <button
                    onClick={() => setScreen('unlock')}
                    style={{
                      background: 'none',
                      border: 'none',
                      color: '#92400E',
                      fontSize: 13,
                      cursor: 'pointer',
                      fontWeight: 700,
                    }}
                  >
                    Get unlimited access
                  </button>
                </p>
              )}
            </div>
          </div>
        )}

        {screen === 'results' && (
          <div style={S.anim}>
            <div style={S.resultsHeader}>
              <div>
                <h2 style={S.h2}>5 Door Cards Ready</h2>
                <p style={{ ...S.muted, marginTop: 4 }}>
                  {bizName} • {service} • {contact}
                </p>
              </div>
              <div style={{ display: 'flex', gap: 8 }}>
                <button onClick={copyAll} style={S.copyAllBtn}>
                  {copied === 'all' ? 'All Copied!' : 'Copy All'}
                </button>
                <button onClick={() => setScreen('input')} style={S.backBtn}>
                  New
                </button>
              </div>
            </div>

            <div style={S.cardsGrid}>
              {cards.map((card, i) => {
                const angle = cardAngles[i] || {
                  label: `Option ${i + 1}`,
                  emoji: '📄',
                  color: '#6B7280',
                };
                return (
                  <div key={i} style={S.cardItem}>
                    <div style={S.cardItemHeader}>
                      <div
                        style={{
                          display: 'flex',
                          alignItems: 'center',
                          gap: 8,
                        }}
                      >
                        <div
                          style={{
                            ...S.angleIcon,
                            background: angle.color + '22',
                            border: `2px solid ${angle.color}`,
                          }}
                        >
                          <span style={{ fontSize: 16 }}>{angle.emoji}</span>
                        </div>
                        <div>
                          <div
                            style={{
                              fontSize: 11,
                              fontWeight: 700,
                              color: angle.color,
                              textTransform: 'uppercase',
                              letterSpacing: '0.5px',
                            }}
                          >
                            Option {i + 1}
                          </div>
                          <div
                            style={{
                              fontSize: 14,
                              fontWeight: 700,
                              color: '#292524',
                            }}
                          >
                            {angle.label}
                          </div>
                        </div>
                      </div>
                      <button
                        onClick={() => copyText(card, i)}
                        style={{
                          ...S.copyBtn,
                          ...(copied === i
                            ? { background: '#16A34A', color: '#fff' }
                            : {}),
                        }}
                      >
                        {copied === i ? 'Copied!' : 'Copy'}
                      </button>
                    </div>

                    <div style={S.cardPreview}>
                      <div style={S.cardPreviewInner}>
                        <p style={S.cardText}>{card}</p>
                      </div>
                    </div>
                  </div>
                );
              })}
            </div>

            <button
              onClick={generateCards}
              disabled={loading}
              style={S.regenBtn}
            >
              {loading ? 'Regenerating...' : 'Generate 5 New Options'}
            </button>

            {!licensed && (
              <div style={S.upsellBanner}>
                <span>Enjoyed DoorMint? Get unlimited access for life.</span>
                <button
                  onClick={() => setScreen('unlock')}
                  style={S.inlineUnlockBtn}
                >
                  Unlock for $19
                </button>
              </div>
            )}
          </div>
        )}

        <p style={S.footer}>
          DoorMint • Trusted by home service businesses across USA 🇺🇸 • Secure
          checkout via Gumroad
        </p>
      </main>
    </div>
  );
}

const S = {
  root: {
    minHeight: '100vh',
    background: '#FFFBF5',
    fontFamily: "'Inter','Segoe UI',sans-serif",
    position: 'relative' as const,
    overflowX: 'hidden' as const,
  },
  bgGlow1: {
    position: 'fixed' as const,
    top: -200,
    right: -200,
    width: 600,
    height: 600,
    borderRadius: '50%',
    background:
      'radial-gradient(circle, rgba(251,191,36,0.15) 0%, transparent 70%)',
    pointerEvents: 'none' as const,
    zIndex: 0,
  },
  bgGlow2: {
    position: 'fixed' as const,
    bottom: -200,
    left: -200,
    width: 600,
    height: 600,
    borderRadius: '50%',
    background:
      'radial-gradient(circle, rgba(22,163,74,0.1) 0%, transparent 70%)',
    pointerEvents: 'none' as const,
    zIndex: 0,
  },
  bgGrid: {
    position: 'fixed' as const,
    inset: 0,
    backgroundImage:
      'radial-gradient(rgba(146,64,14,0.04) 1px, transparent 1px)',
    backgroundSize: '32px 32px',
    pointerEvents: 'none' as const,
    zIndex: 0,
  },

  header: {
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    padding: '18px 24px',
    borderBottom: '3px solid #92400E',
    position: 'sticky' as const,
    top: 0,
    background: '#FFFFFF',
    backdropFilter: 'blur(14px)',
    zIndex: 100,
    boxShadow: '0 2px 8px rgba(146,64,14,0.08)',
  },
  logo: { display: 'flex', alignItems: 'center', gap: 10, cursor: 'pointer' },
  logoIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    background: 'linear-gradient(135deg,#92400E,#B45309)',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  logoText: {
    fontSize: 22,
    fontWeight: 800,
    color: '#292524',
    letterSpacing: '-0.5px',
    display: 'block',
    lineHeight: 1.2,
  },
  logoTag: {
    fontSize: 11,
    color: '#78716C',
    display: 'block',
    fontWeight: 600,
  },
  proBadge: {
    background: '#16A34A',
    border: '2px solid #15803D',
    color: '#fff',
    padding: '6px 14px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
  },
  usesBadge: {
    background: '#FEF3C7',
    border: '2px solid #F59E0B',
    color: '#92400E',
    padding: '6px 14px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
  },
  headerBtn: {
    background: '#92400E',
    color: '#fff',
    border: 'none',
    borderRadius: 999,
    padding: '8px 18px',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },

  main: {
    maxWidth: 700,
    margin: '0 auto',
    padding: '40px 18px 100px',
    position: 'relative' as const,
    zIndex: 10,
  },
  anim: { animation: 'fadeUp 0.4s ease forwards' },

  hero: {
    textAlign: 'center' as const,
    marginBottom: 40,
    background:
      'linear-gradient(135deg, #92400E 0%, #B45309 50%, #F59E0B 100%)',
    padding: '50px 30px',
    borderRadius: 20,
    boxShadow: '0 8px 24px rgba(146,64,14,0.2)',
  },
  heroBadge: {
    display: 'inline-block',
    background: '#FFFBF5',
    border: '2px solid #92400E',
    color: '#92400E',
    padding: '8px 18px',
    borderRadius: 999,
    fontSize: 14,
    fontWeight: 700,
    marginBottom: 20,
  },
  h1: {
    fontSize: 'clamp(28px,4.5vw,46px)',
    fontWeight: 900,
    color: '#fff',
    lineHeight: 1.18,
    letterSpacing: '-1px',
    marginBottom: 16,
  },
  gradText: {
    background: '#FEF3C7',
    WebkitBackgroundClip: 'text',
    WebkitTextFillColor: 'transparent',
    textShadow: '0 2px 4px rgba(0,0,0,0.1)',
  },
  heroSub: {
    color: 'rgba(255,255,255,0.95)',
    fontSize: 17,
    lineHeight: 1.6,
    maxWidth: 480,
    margin: '0 auto 28px',
    fontWeight: 500,
  },
  statsRow: {
    display: 'flex',
    justifyContent: 'center',
    gap: 16,
    flexWrap: 'wrap' as const,
  },
  statBox: {
    background: 'rgba(255,255,255,0.2)',
    border: '2px solid rgba(255,255,255,0.3)',
    borderRadius: 14,
    padding: '12px 20px',
    display: 'flex',
    flexDirection: 'column' as const,
    alignItems: 'center',
    gap: 2,
    backdropFilter: 'blur(10px)',
  },
  statVal: { fontSize: 24, fontWeight: 900, color: '#fff' },
  statLabel: { fontSize: 12, color: 'rgba(255,255,255,0.9)', fontWeight: 600 },

  card: {
    background: '#FFFFFF',
    border: '3px solid #E7D5C0',
    borderRadius: 18,
    padding: '32px 28px',
    boxShadow: '0 4px 16px rgba(146,64,14,0.08)',
  },
  h2: {
    fontSize: 24,
    fontWeight: 800,
    color: '#292524',
    letterSpacing: '-0.5px',
  },
  muted: { color: '#78716C', fontSize: 15, lineHeight: 1.5 },

  field: { marginBottom: 22 },
  label: {
    display: 'block',
    color: '#57534E',
    fontSize: 13,
    fontWeight: 700,
    marginBottom: 8,
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  optional: {
    color: '#A8A29E',
    fontWeight: 400,
    textTransform: 'none',
    fontSize: 12,
  },
  input: {
    width: '100%',
    background: '#FFFBF5',
    border: '2px solid #E7D5C0',
    borderRadius: 10,
    color: '#292524',
    fontSize: 16,
    padding: '14px 16px',
    fontFamily: 'inherit',
    transition: 'border 0.15s, box-shadow 0.15s',
    fontWeight: 500,
  },
  select: {
    width: '100%',
    background: '#FFFBF5',
    border: '2px solid #E7D5C0',
    borderRadius: 10,
    color: '#292524',
    fontSize: 16,
    padding: '14px 16px',
    fontFamily: 'inherit',
    cursor: 'pointer',
    transition: 'border 0.15s',
    fontWeight: 500,
  },
  keyField: {
    background: '#FFFBF5',
    border: '2px solid #E7D5C0',
    borderRadius: 10,
    color: '#292524',
    fontSize: 15,
    padding: '13px 16px',
    fontFamily: 'monospace',
    letterSpacing: '1px',
    width: '100%',
    transition: 'border 0.15s',
  },
  activateBtn: {
    background: '#92400E',
    color: '#fff',
    border: 'none',
    borderRadius: 10,
    padding: '13px 20px',
    fontSize: 15,
    fontWeight: 800,
    cursor: 'pointer',
    whiteSpace: 'nowrap',
  },
  groqBox: {
    background: '#FEF3C7',
    border: '2px solid #F59E0B',
    borderRadius: 12,
    padding: '18px',
    marginBottom: 18,
  },
  errorBox: {
    background: '#FEE2E2',
    border: '2px solid #EF4444',
    color: '#991B1B',
    borderRadius: 10,
    padding: '12px 16px',
    fontSize: 14,
    marginBottom: 16,
    fontWeight: 600,
  },
  limitBanner: {
    background: '#FEF3C7',
    border: '2px solid #F59E0B',
    borderRadius: 12,
    padding: '14px 18px',
    marginBottom: 16,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap' as const,
    gap: 10,
  },
  inlineUnlockBtn: {
    background: '#92400E',
    color: '#fff',
    border: 'none',
    borderRadius: 8,
    padding: '8px 16px',
    fontSize: 14,
    fontWeight: 700,
    cursor: 'pointer',
  },
  genBtn: {
    width: '100%',
    background: '#16A34A',
    color: '#fff',
    border: 'none',
    borderRadius: 12,
    padding: '18px',
    fontSize: 18,
    fontWeight: 800,
    cursor: 'pointer',
    letterSpacing: '-0.3px',
    transition: 'opacity 0.15s, transform 0.1s',
    boxShadow: '0 4px 12px rgba(22,163,74,0.3)',
  },
  genBtnDisabled: {
    opacity: 0.35,
    cursor: 'not-allowed',
    filter: 'none',
    transform: 'none !important',
  },
  spinner: {
    width: 18,
    height: 18,
    border: '3px solid rgba(255,255,255,0.3)',
    borderTop: '3px solid #fff',
    borderRadius: '50%',
    animation: 'spin 0.7s linear infinite',
    display: 'inline-block',
  },

  divider: { height: 2, background: '#E7D5C0', margin: '28px 0' },
  pricingBox: {
    background: '#FEF3C7',
    border: '3px solid #F59E0B',
    borderRadius: 18,
    padding: '28px',
  },
  pricingTopRow: { marginBottom: 20 },
  pricingLabel: {
    fontSize: 12,
    fontWeight: 700,
    color: '#78716C',
    textTransform: 'uppercase' as const,
    letterSpacing: '0.5px',
  },
  bigPrice: { fontSize: 44, fontWeight: 900, color: '#92400E' },
  oldPrice: { fontSize: 24, color: '#A8A29E', textDecoration: 'line-through' },
  launchBadge: {
    background: '#16A34A',
    border: 'none',
    color: '#fff',
    padding: '6px 13px',
    borderRadius: 999,
    fontSize: 13,
    fontWeight: 700,
  },
  featureList: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 10,
    marginBottom: 24,
  },
  featureItem: {
    color: '#57534E',
    fontSize: 15,
    display: 'flex',
    gap: 10,
    fontWeight: 600,
  },
  buyBtn: {
    display: 'block',
    background: '#16A34A',
    color: '#fff',
    borderRadius: 12,
    padding: '16px',
    fontSize: 16,
    fontWeight: 800,
    textAlign: 'center' as const,
    textDecoration: 'none',
    letterSpacing: '-0.2px',
    boxShadow: '0 4px 12px rgba(22,163,74,0.3)',
  },

  resultsHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'flex-start',
    marginBottom: 28,
    flexWrap: 'wrap' as const,
    gap: 12,
  },
  backBtn: {
    background: '#FFFFFF',
    border: '2px solid #E7D5C0',
    color: '#57534E',
    borderRadius: 10,
    padding: '10px 16px',
    fontSize: 14,
    cursor: 'pointer',
    fontWeight: 700,
  },
  copyAllBtn: {
    background: '#16A34A',
    border: '2px solid #15803D',
    color: '#fff',
    borderRadius: 10,
    padding: '10px 18px',
    fontSize: 14,
    cursor: 'pointer',
    fontWeight: 700,
  },
  cardsGrid: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: 18,
    marginBottom: 18,
  },
  cardItem: {
    background: '#FFFFFF',
    border: '2px solid #E7D5C0',
    borderRadius: 16,
    overflow: 'hidden',
    boxShadow: '0 2px 8px rgba(146,64,14,0.06)',
  },
  cardItemHeader: {
    display: 'flex',
    justifyContent: 'space-between',
    alignItems: 'center',
    padding: '18px 20px',
    borderBottom: '2px solid #E7D5C0',
    background: '#FFFBF5',
  },
  angleIcon: {
    width: 40,
    height: 40,
    borderRadius: 10,
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
  },
  cardPreview: { padding: '20px', background: '#FFFBF5' },
  cardPreviewInner: {
    background: '#FFFFFF',
    border: '2px dashed #E7D5C0',
    borderRadius: 10,
    padding: '18px',
  },
  cardText: {
    color: '#292524',
    fontSize: 15,
    lineHeight: 1.8,
    whiteSpace: 'pre-wrap',
    fontWeight: 500,
  },
  copyBtn: {
    background: '#92400E',
    border: 'none',
    color: '#fff',
    borderRadius: 8,
    padding: '8px 18px',
    fontSize: 13,
    fontWeight: 700,
    cursor: 'pointer',
    transition: 'all 0.15s',
    whiteSpace: 'nowrap' as const,
  },
  regenBtn: {
    width: '100%',
    background: '#FFFFFF',
    border: '2px solid #E7D5C0',
    color: '#57534E',
    borderRadius: 12,
    padding: '14px',
    fontSize: 15,
    fontWeight: 700,
    cursor: 'pointer',
    marginBottom: 16,
  },
  upsellBanner: {
    background: '#FEF3C7',
    border: '2px solid #F59E0B',
    borderRadius: 14,
    padding: '16px 20px',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'space-between',
    flexWrap: 'wrap' as const,
    gap: 10,
    color: '#57534E',
    fontSize: 14,
    fontWeight: 600,
  },
  footer: {
    textAlign: 'center' as const,
    color: '#A8A29E',
    fontSize: 13,
    marginTop: 32,
    fontWeight: 500,
  },
};
