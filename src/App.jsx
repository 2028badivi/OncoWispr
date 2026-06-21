import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import Auth from './Auth';

// INLINE AMBIENT SHADER COMPONENT
// Derived from 21st.dev / Aceternity design layers to add floating acoustic wave paths
function BackgroundPaths() {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1, overflow: 'hidden', backgroundColor: '#0a0a0c' }}>
      <svg style={{ width: '100%', height: '100%', opacity: 0.12 }} xmlns="http://www.w3.org/2000/svg">
        <path
          d="M-100,200 Q300,50 800,400 T1800,200"
          fill="none"
          stroke="#4FB58C"
          strokeWidth="2"
          style={{ transformOrigin: 'center', animation: 'fadeIn 20s infinite ease-in-out alternate' }}
        />
        <path
          d="M-50,600 Q400,800 900,450 T1950,700"
          fill="none"
          stroke="#1AD82C"
          strokeWidth="1.5"
          style={{ transformOrigin: 'center', animation: 'fadeIn 25s infinite ease-in-out alternate-reverse' }}
        />
      </svg>
      {/* Precision Radial Mask for Vignette Shadow Depth */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'radial-gradient(circle at 50% 50%, transparent 15%, #0a0a0c 85%)',
        pointerEvents: 'none'
      }} />
    </div>
  );
}

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]); 

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

  useEffect(() => {
    if (!user) return;
    const q = query(collection(db, "entries"), orderBy("timestamp", "desc"));
    const unsubscribeFirestore = onSnapshot(q, (snapshot) => {
      const dataItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setEntries(dataItems);
    });
    return () => unsubscribeFirestore();
  }, [user]);

  const [activeTab, setActiveTab] = useState('pipeline'); 
  const totalLogs = entries.length;
  
  const highDistressCount = entries.filter(t => t.depression_score && Number(t.depression_score) >= 7).length;
  const modDistressCount = entries.filter(t => t.depression_score && Number(t.depression_score) >= 4 && Number(t.depression_score) < 7).length;
  const distressRatio = totalLogs > 0 ? Math.round(((highDistressCount + modDistressCount) / totalLogs) * 100) : 0;

  const recentFlags = entries
    .filter(t => t.depression_score && Number(t.depression_score) >= 7)
    .map(t => t.explanation || "No explanation provided")
    .slice(0, 3);

  let currentStatus = 'Stable Baseline';
  if (totalLogs > 0) {
    const latestScore = Number(entries[0].depression_score || 0);
    const latestSentiment = String(entries[0].sentiment || '').toLowerCase();
    if (latestScore >= 7 || latestSentiment === 'high distress' || latestSentiment === 'positive') {
      currentStatus = latestScore >= 7 ? 'High Distress' : 'Stable Baseline';
    } else if (latestScore >= 4) {
      currentStatus = 'Moderate Distress';
    }
  }

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0a0a0c', color: '#D1FAD5', fontFamily: 'sans-serif' }}>
        <div style={{ fontSize: '16px', letterSpacing: '1px' }}>Loading Care Hub...</div>
      </div>
    );
  }

  return (
    <div style={{ minHeight: '100vh', position: 'relative', overflowX: 'hidden', backgroundColor: '#0a0a0c' }}>
      
      {/* PREMIUM VISUAL LAYER INGESTION */}
      <BackgroundPaths />

      {/* CORE CONTROLLER CONTAINER */}
      <div style={{ padding: '40px 40px 120px 40px', fontFamily: '-apple-system, BlinkMacSystemFont, sans-serif', maxWidth: '1100px', margin: '0 auto', color: '#D1FAD5', boxSizing: 'border-box', position: 'relative', zIndex: 1 }}>
        
        <style>{`
          @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          @keyframes pulseDistress {
            0% { box-shadow: 0 0 0 0 rgba(216, 66, 49, 0.4); }
            70% { box-shadow: 0 0 0 8px rgba(216, 66, 49, 0); }
            100% { box-shadow: 0 0 0 0 rgba(216, 66, 49, 0); }
          }
          .dashboard-card {
            background: rgba(209, 250, 213, 0.015);
            backdrop-filter: blur(16px);
            -webkit-backdrop-filter: blur(16px);
            border: 1px solid rgba(209, 250, 213, 0.05);
            border-radius: 12px;
            padding: 24px;
            animation: fadeIn 0.4s ease-out both;
            transition: all 0.3s cubic-bezier(0.16, 1, 0.3, 1);
          }
          .dashboard-card:hover {
            background: rgba(209, 250, 213, 0.035);
            border-color: rgba(79, 181, 140, 0.25);
            transform: translateY(-2px);
          }
          .tab-btn {
            padding: 12px 24px;
            background: transparent;
            border: none;
            color: rgba(209, 250, 213, 0.4);
            cursor: pointer;
            font-weight: 600;
            font-size: 14px;
            transition: all 0.2s;
            border-bottom: 2px solid transparent;
          }
          .tab-btn:hover {
            color: #D1FAD5;
          }
          .tab-btn.active {
            color: #4FB58C;
            border-bottom: 2px solid #4FB58C;
          }
          .pulse-red {
            animation: pulseDistress 2s infinite;
          }
          .progress-fill {
            transition: width 1.2s cubic-bezier(0.4, 0, 0.2, 1);
          }
        `}</style>

        <header style={{ borderBottom: '1px solid rgba(209, 250, 213, 0.1)', paddingBottom: '24px', marginBottom: '32px', marginTop: '40px' }}>
          <h1 style={{ 
            fontSize: '2.8rem', 
            fontWeight: '800', 
            margin: '0 0 4px 0', 
            lineHeight: '1.5', 
            background: 'linear-gradient(135deg, #ffffff 0%, #4FB58C 100%)', 
            WebkitBackgroundClip: 'text', 
            WebkitTextFillColor: 'transparent',
            display: 'block',
            paddingBottom: '4px'
          }}>
            OncoWispr Care Hub
          </h1>
          <p style={{ color: 'rgba(209, 250, 213, 0.5)', margin: 0, fontSize: '15px', letterSpacing: '0.3px' }}>Clinical Dashboard Ecosystem & NLP Pipeline</p>
        </header>

        <Auth user={user} />

        {user && (
          <>
            <div style={{ display: 'flex', gap: '10px', borderBottom: '1px solid rgba(209, 250, 213, 0.1)', marginBottom: '32px' }}>
              <button className={`tab-btn ${activeTab === 'pipeline' ? 'active' : ''}`} onClick={() => setActiveTab('pipeline')}>Live Stream</button>
              <button className={`tab-btn ${activeTab === 'journal' ? 'active' : ''}`} onClick={() => setActiveTab('journal')}>Daily Journal</button>
              <button className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>Health Analytics</button>
              <button className={`tab-btn ${activeTab === 'resources' ? 'active' : ''}`} onClick={() => setActiveTab('resources')}>Community Resources</button>
            </div>

            {/*Tab 1: Live Ingestion Stream*/}
            {activeTab === 'pipeline' && (
              <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1fr', gap: '32px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                  <h3 style={{ margin: 0, fontSize: '13px', color: '#4FB58C', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Active Incoming Ingestion Stream</h3>
                  {entries.length === 0 ? (
                    <div style={{ padding: '40px', textAlign: 'center', color: 'rgba(209, 250, 213, 0.3)', border: '1px dashed rgba(209, 250, 213, 0.15)', borderRadius: '12px' }}>Awaiting transmission packets...</div>
                  ) : (
                    <div className="dashboard-card" style={{ borderLeft: currentStatus === 'High Distress' ? '4px solid #D84231' : '4px solid #4FB58C' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <span style={{ fontSize: '13px', color: 'rgba(209, 250, 213, 0.5)' }}>Latest Drop • {entries[0].timestamp || 'N/A'}</span>
                        <span 
                          className={currentStatus === 'High Distress' ? 'pulse-red' : ''}
                          style={{ 
                            fontSize: '11px', 
                            padding: '4px 10px', 
                            borderRadius: '20px', 
                            background: currentStatus === 'High Distress' ? 'rgba(216, 66, 49, 0.15)' : 'rgba(26, 216, 44, 0.15)', 
                            color: currentStatus === 'High Distress' ? '#D84231' : '#1AD82C', 
                            fontWeight: '700',
                            textTransform: 'uppercase'
                          }}
                        >
                          Wellness: {entries[0].wellness_score || 0}/10 • Score: {entries[0].depression_score || 0}
                        </span>
                      </div>

                      <p style={{ margin: '0 0 20px 0', fontSize: '17px', fontWeight: '500', lineHeight: '1.6', color: '#fff' }}>
                        "{entries[0].transcript || 'No text captured yet.'}"
                      </p>
                      
                      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: '12px', marginBottom: '20px' }}>
                        <div style={{ background: 'rgba(255,255,255,0.01)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(209,250,213,0.04)' }}>
                          <span style={{ fontSize: '11px', color: 'rgba(209, 250, 213, 0.4)' }}>Duration</span>
                          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff', marginTop: '4px' }}>{Number(entries[0].duration || 0).toFixed(2)}s</div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.01)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(209,250,213,0.04)' }}>
                          <span style={{ fontSize: '11px', color: 'rgba(209, 250, 213, 0.4)' }}>Speech Tempo</span>
                          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff', marginTop: '4px' }}>{Math.round(entries[0].wpm || 0)} WPM</div>
                        </div>
                        <div style={{ background: 'rgba(255,255,255,0.01)', padding: '12px', borderRadius: '8px', border: '1px solid rgba(209,250,213,0.04)' }}>
                          <span style={{ fontSize: '11px', color: 'rgba(209, 250, 213, 0.4)' }}>Avg Amplitude</span>
                          <div style={{ fontSize: '14px', fontWeight: 'bold', color: '#fff', marginTop: '4px' }}>{Number(entries[0].avg_volume || 0).toFixed(3)}</div>
                        </div>
                      </div>

                      <div style={{ fontSize: '13px', color: '#D1FAD5', background: 'rgba(79, 181, 140, 0.06)', padding: '14px 16px', borderRadius: '8px', border: '1px solid rgba(79, 181, 140, 0.12)' }}>
                        <strong>AI Clinical Parsing:</strong> <span style={{ color: 'rgba(209,250,213,0.8)' }}>{entries[0].explanation || 'Awaiting analysis summary...'}</span>
                      </div>
                    </div>
                  )}
                </div>

                <div>
                  <div className="dashboard-card">
                    <h4 style={{ margin: '0 0 8px 0', color: '#4FB58C', fontWeight: '600' }}>Python Ingestion Core</h4>
                    <p style={{ fontSize: '13px', color: 'rgba(209, 250, 213, 0.6)', margin: '0 0 20px 0', lineHeight: '1.5' }}>Actively bound to firestore instance. Waiting on vocal multi-parameter streams.</p>
                    <div style={{ fontSize: '13px', color: '#1AD82C', display: 'flex', alignItems: 'center', gap: '8px', fontWeight: '500' }}>
                      <span style={{ width: '6px', height: '6px', borderRadius: '50%', backgroundColor: '#1AD82C' }}></span> Realtime Hook Active
                    </div>
                  </div>
                </div>
              </div>
            )}

            {/*Tab 2: Historical Archive Index*/}
            {activeTab === 'journal' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '13px', color: '#4FB58C', textTransform: 'uppercase', letterSpacing: '0.5px' }}>Historical Journal Index ({totalLogs})</h3>
                {entries.map((entry) => (
                  <div key={entry.id} className="dashboard-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '13px' }}>
                      <span style={{ color: 'rgba(209, 250, 213, 0.4)' }}>Captured {entry.timestamp || 'N/A'} • {Math.round(entry.wpm || 0)} WPM</span>
                      <span style={{ color: Number(entry.depression_score || 0) >= 7 ? '#D84231' : '#1AD82C', fontWeight: '700' }}>Depression Index: {entry.depression_score || 0}/10</span>
                    </div>
                    <p style={{ margin: '0 0 12px 0', color: '#fff', fontSize: '16px' }}>"{entry.transcript || 'No audio string captured.'}"</p>
                    <p style={{ margin: 0, fontSize: '13px', color: 'rgba(209,250,213,0.6)' }}><strong>Diagnostic Parsing:</strong> {entry.explanation || 'No tracking insights associated with this element.'}</p>
                  </div>
                ))}
              </div>
            )}

            {/*Tab 3: Analytics System Matrices*/}
            {activeTab === 'analytics' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '24px' }}>
                <div className="dashboard-card" style={{ display: 'flex', flexDirection: 'column', justifyContent: 'space-between' }}>
                  <div>
                    <h4 style={{ margin: '0 0 12px 0', color: '#D84231', fontSize: '14px', fontWeight: '700', textTransform: 'uppercase', letterSpacing: '0.5px' }}>
                      Depression Predictive NLP Density
                    </h4>
                    <div style={{ display: 'flex', alignItems: 'baseline', gap: '12px', margin: '20px 0' }}>
                      <span style={{ fontSize: '48px', fontWeight: '800', color: '#fff' }}>{distressRatio}%</span>
                      <span style={{ color: distressRatio > 50 ? '#D84231' : '#1AD82C', fontSize: '14px', fontWeight: '600' }}>
                        {distressRatio > 50 ? '▲ Elevated Stress Vector' : '✓ Normal Baseline'}
                      </span>
                    </div>
                    <p style={{ fontSize: '14px', color: 'rgba(209, 250, 213, 0.6)', lineHeight: '1.6', margin: 0 }}>
                      Ratio of speech samples processing severe biometric parameters versus regular baseline recordings.
                    </p>
                  </div>
                  <div style={{ width: '100%', background: 'rgba(209, 250, 213, 0.08)', height: '10px', borderRadius: '10px', marginTop: '24px', overflow: 'hidden' }}>
                    <div className="progress-fill" style={{ width: `${distressRatio}%`, background: distressRatio > 50 ? '#D84231' : '#1AD82C', height: '100%', borderRadius: '10px' }}></div>
                  </div>
                </div>

                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <div className="dashboard-card">
                    <h4 style={{ margin: '0 0 4px 0', color: '#4FB58C', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase' }}>
                      Total Linguistic Captures
                    </h4>
                    <div style={{ fontSize: '36px', fontWeight: '800', margin: '8px 0', color: '#fff' }}>{totalLogs}</div>
                    <p style={{ fontSize: '13px', color: 'rgba(209, 250, 213, 0.4)', margin: 0 }}>Vocal stream files stored safely inside your isolated datastore channel.</p>
                  </div>

                  <div className="dashboard-card">
                    <h4 style={{ margin: '0 0 12px 0', color: '#4FB58C', fontSize: '13px', fontWeight: '600', textTransform: 'uppercase' }}>
                      Active Critical Anomaly Log
                    </h4>
                    {recentFlags.length === 0 ? (
                      <p style={{ fontSize: '13px', color: 'rgba(209, 250, 213, 0.4)', margin: 0 }}>No highly distressing records caught in recent cycles.</p>
                    ) : (
                      <ul style={{ margin: 0, paddingLeft: '20px', color: '#fff', fontSize: '13px', lineHeight: '1.8' }}>
                        {recentFlags.map((flag, idx) => (
                          <li key={idx} style={{ color: '#D84231' }}><span style={{ color: '#D1FAD5' }}>{flag}</span></li>
                        ))}
                      </ul>
                    )}
                  </div>
                </div>
              </div>
            )}

            {/*Tab 4: Adaptive Resource Routing Matrix*/}
            {activeTab === 'resources' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                <div style={{ borderBottom: '1px solid rgba(209, 250, 213, 0.1)', paddingBottom: '12px' }}>
                  <h3 style={{ margin: '0 0 6px 0', fontSize: '1.2rem', fontWeight: '600', color: '#fff' }}>Automated Support Matching</h3>
                  <p style={{ color: 'rgba(209, 250, 213, 0.6)', margin: 0, fontSize: '14px' }}>
                    Current Status: <strong style={{ color: currentStatus === 'High Distress' ? '#D84231' : '#1AD82C' }}>{currentStatus}</strong>.
                  </p>
                </div>
                
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  <div className="dashboard-card" style={{ border: currentStatus === 'High Distress' ? '1px solid rgba(216, 66, 49, 0.3)' : '1px solid rgba(209, 250, 213, 0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <h4 style={{ margin: 0, color: '#4FB58C', fontSize: '16px', fontWeight: '600' }}>Oncology Peer Support Cohorts</h4>
                      {currentStatus === 'High Distress' && <span style={{ fontSize: '10px', background: 'rgba(216, 66, 49, 0.15)', color: '#D84231', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>RECOMMENDED</span>}
                    </div>
                    <p style={{ fontSize: '13px', color: 'rgba(209, 250, 213, 0.6)', lineHeight: '1.6', margin: '0 0 20px 0' }}>
                      Connects patients with specialized peer-led counseling structures designed specifically for high-energy therapy adjustments.
                    </p>
                    <button 
                      onClick={() => window.open('https://www.cancer.org/support-programs-and-services.html', '_blank')}
                      style={{ background: 'rgba(79, 181, 140, 0.15)', color: '#4FB58C', border: 'none', padding: '10px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                    >
                      Open Router Bridge
                    </button>
                  </div>
                  
                  <div className="dashboard-card" style={{ border: currentStatus === 'High Distress' ? '1px solid #D84231' : '1px solid rgba(209, 250, 213, 0.06)' }}>
                    <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: '12px' }}>
                      <h4 style={{ margin: 0, color: '#D1FAD5', fontSize: '16px', fontWeight: '600' }}>Clinical Guidance Response Line</h4>
                      {currentStatus === 'High Distress' && <span style={{ fontSize: '10px', background: '#D84231', color: '#fff', padding: '2px 6px', borderRadius: '4px', fontWeight: 'bold' }}>URGENT ACTION</span>}
                    </div>
                    <p style={{ fontSize: '13px', color: 'rgba(209, 250, 213, 0.6)', lineHeight: '1.6', margin: '0 0 20px 0' }}>
                      A direct portal matching the patient to immediate, dedicated mental health professionals who specialize in medical trauma processing.
                    </p>
                    <button 
                      onClick={() => window.open('https://988lifeline.org/', '_blank')}
                      style={{ background: currentStatus === 'High Distress' ? '#D84231' : 'rgba(209, 250, 213, 0.08)', color: currentStatus === 'High Distress' ? '#fff' : '#D1FAD5', border: 'none', padding: '10px 16px', borderRadius: '6px', fontSize: '13px', fontWeight: '600', cursor: 'pointer' }}
                    >
                      {currentStatus === 'High Distress' ? 'Call Responder Now' : 'Access Bridge'}
                    </button>
                  </div>
                </div>
              </div>
            )}

            {/* Persistent UI Footer */}
            <footer style={{ position: 'fixed', bottom: 0, left: 0, right: 0, height: '70px', background: '#09090c', borderTop: '1px solid rgba(209, 250, 213, 0.08)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', padding: '0 40px', zIndex: 1000, backdropFilter: 'blur(20px)', WebkitBackdropFilter: 'blur(20px)' }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
                <span style={{ fontSize: '13px', fontWeight: '600', color: '#4FB58C', textTransform: 'uppercase', letterSpacing: '0.5px' }}>User Status</span>
                <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(79, 181, 140, 0.1)', padding: '6px 12px', borderRadius: '6px', fontSize: '12px', color: '#4FB58C', fontWeight: '500' }}>
                  <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#1AD82C' }}></span> Authenticated Session
                </div>
                <span style={{ fontSize: '13px', color: 'rgba(209, 250, 213, 0.5)' }}>{user.email}</span>
              </div>
              <button 
                onClick={() => auth.signOut()} 
                style={{ padding: '8px 16px', background: 'transparent', color: 'rgba(209, 250, 213, 0.5)', border: '1px solid rgba(209, 250, 213, 0.15)', borderRadius: '6px', cursor: 'pointer', fontSize: '12px', fontWeight: '500', transition: 'all 0.2s' }}
                onMouseEnter={(e) => { e.target.style.borderColor = '#D84231'; e.target.style.color = '#D84231'; }}
                onMouseLeave={(e) => { e.target.style.borderColor = 'rgba(209, 250, 213, 0.15)'; e.target.style.color = 'rgba(209, 250, 213, 0.5)'; }}
              >
                Sign Out
              </button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

export default App;