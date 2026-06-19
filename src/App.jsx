// src/App.jsx
import React, { useState, useEffect } from 'react';
import { auth, db } from './firebase'; // Imported live db reference
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore'; // Firebase Firestore streams
import Auth from './Auth';

function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [transcripts, setTranscripts] = useState([]); // Clear hardcoded state

  useEffect(() => {
    const unsubscribeAuth = onAuthStateChanged(auth, (currentUser) => {
      setUser(currentUser);
      setLoading(false);
    });
    return () => unsubscribeAuth();
  }, []);

  // Live Firestore database subscription
  useEffect(() => {
    if (!user) return;

    // Create a query pointing to your transcripts collection sorted by time
    const q = query(collection(db, "transcripts"), orderBy("timestamp", "desc"));

    // Establish a live real-time connection stream
    const unsubscribeFirestore = onSnapshot(q, (snapshot) => {
      const dataItems = snapshot.docs.map(doc => ({
        id: doc.id,
        ...doc.data()
      }));
      setTranscripts(dataItems);
    }, (error) => {
      console.error("Firestore live stream intercepted: ", error);
    });

    return () => unsubscribeFirestore();
  }, [user]);

  if (loading) {
    return (
      <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0a0a0c', color: '#fff', fontFamily: 'Arial, sans-serif' }}>
        <div style={{ fontSize: '16px', letterSpacing: '1px' }}>Loading Care Hub...</div>
      </div>
    );
  }

  return (
    <div style={{ 
      padding: '40px 40px 120px 40px', 
      fontFamily: '-apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif', 
      maxWidth: '1100px', 
      margin: '0 auto', 
      color: '#f3f4f6', 
      backgroundColor: '#0a0a0c', 
      minHeight: '100vh',
      boxSizing: 'border-box'
    }}>
      
      <style>{`
        @keyframes fadeIn {
          from { opacity: 0; transform: translateY(12px); }
          to { opacity: 1; transform: translateY(0); }
        }
        @keyframes pulse {
          0% { box-shadow: 0 0 0 0 rgba(230, 57, 70, 0.4); }
          70% { box-shadow: 0 0 0 8px rgba(230, 57, 70, 0); }
          100% { box-shadow: 0 0 0 0 rgba(230, 57, 70, 0.4); }
        }
        .dashboard-card {
          background: rgba(255, 255, 255, 0.03);
          backdrop-filter: blur(12px);
          border: 1px solid rgba(255, 255, 255, 0.05);
          border-radius: 12px;
          padding: 24px;
          transition: all 0.3s cubic-bezier(0.4, 0, 0.2, 1);
          animation: fadeIn 0.6s ease-out both;
        }
        .dashboard-card:hover {
          transform: translateY(-2px);
          background: rgba(255, 255, 255, 0.05);
          border-color: rgba(255, 255, 255, 0.1);
        }
        .pulse-badge {
          animation: pulse 2s infinite;
        }
        .progress-fill {
          transition: width 1.5s cubic-bezier(0.4, 0, 0.2, 1);
        }
      `}</style>

      <header style={{ borderBottom: '1px solid rgba(255,255,255,0.08)', paddingBottom: '24px', marginBottom: '32px', marginTop: '20px' }}>
        <h1 style={{ fontSize: '2.6rem', fontWeight: '800', margin: '0 0 8px 0', lineHeight: '1.3', background: 'linear-gradient(135deg, #fff 0%, #a5a5b0 100%)', WebkitBackgroundClip: 'text', WebkitTextFillColor: 'transparent' }}>
          OncoWispr Care Hub
        </h1>
        <p style={{ color: '#6b7280', margin: 0, fontSize: '15px', letterSpacing: '0.3px' }}>Clinical Dashboard Ecosystem & Real-Time Pipeline</p>
      </header>

      <Auth user={user} />

      {user && (
        <>
          <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1fr', gap: '32px', marginTop: '32px' }}>
            
            {/* Left Column: Live Streaming Transcripts */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#9ca3af', letterSpacing: '0.5px', textTransform: 'uppercase', margin: '0' }}>
                📡 Live Stream Pipeline
              </h2>
              
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                {transcripts.length === 0 ? (
                  <div style={{ padding: '40px', textAlign: 'center', color: '#6b7280', border: '1px dashed #222', borderRadius: '12px' }}>
                    No streams captured yet. Awaiting database transaction packages...
                  </div>
                ) : (
                  transcripts.map((item, index) => (
                    <div 
                      key={item.id} 
                      className="dashboard-card" 
                      style={{ 
                        animationDelay: `${index * 0.1}s`,
                        borderLeft: item.sentiment === 'High Distress' ? '4px solid #e63946' : '4px solid #ffb703' 
                      }}
                    >
                      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: '16px' }}>
                        <span style={{ fontSize: '13px', color: '#6b7280', fontWeight: '500' }}>Timestamp: {item.timestamp}</span>
                        <span 
                          className={item.sentiment === 'High Distress' ? 'pulse-badge' : ''}
                          style={{ 
                            fontSize: '11px', 
                            padding: '4px 10px', 
                            borderRadius: '20px', 
                            background: item.sentiment === 'High Distress' ? 'rgba(230,57,70,0.12)' : 'rgba(255,183,3,0.12)', 
                            color: item.sentiment === 'High Distress' ? '#ff4d5a' : '#ffb703', 
                            fontWeight: '700',
                            letterSpacing: '0.5px',
                            textTransform: 'uppercase'
                          }}
                        >
                          {item.sentiment || 'Evaluating'}
                        </span>
                      </div>
                      <p style={{ margin: '0 0 20px 0', fontSize: '16px', lineHeight: '1.6', color: '#e5e7eb' }}>
                        "{item.text}"
                      </p>
                      <div style={{ fontSize: '13px', color: '#a8dadc', background: 'rgba(168,218,220,0.06)', padding: '12px 16px', borderRadius: '8px', border: '1px solid rgba(168,218,220,0.1)', display: 'flex', alignItems: 'center', gap: '8px' }}>
                        <span>🔍</span> <span><strong>Biomarker Delta:</strong> {item.biomarkerMatch || 'Processing...'}</span>
                      </div>
                    </div>
                  ))
                )}
              </div>
            </div>

            {/* Right Column: Analytics Insights Summary */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
              <h2 style={{ fontSize: '1.1rem', fontWeight: '600', color: '#9ca3af', letterSpacing: '0.5px', textTransform: 'uppercase', margin: '0' }}>
                📊 System Analytics
              </h2>
              
              <div className="dashboard-card" style={{ background: 'rgba(255,255,255,0.01)', animationDelay: '0.3s' }}>
                <h4 style={{ margin: '0 0 8px 0', color: '#3a86ff', fontSize: '15px', fontWeight: '600' }}>Groq / Llama Engine Status</h4>
                <p style={{ fontSize: '14px', color: '#9ca3af', margin: '0 0 24px 0', lineHeight: '1.5' }}>Pipeline active. Evaluating speech structure for physiological distress markers.</p>
                
                <div style={{ marginBottom: '20px' }}>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>
                    <span>Pinecone Vector Match Sync</span>
                    <span style={{ fontWeight: 'bold', color: '#3a86ff' }}>83%</span>
                  </div>
                  <div style={{ width: '100%', background: 'rgba(255,255,255,0.05)', height: '6px', borderRadius: '10px', overflow: 'hidden' }}>
                    <div className="progress-fill" style={{ width: '83%', background: 'linear-gradient(90deg, #3a86ff, #00b4d8)', height: '100%', borderRadius: '10px' }}></div>
                  </div>
                </div>

                <div>
                  <div style={{ display: 'flex', justifyContent: 'space-between', fontSize: '12px', color: '#9ca3af', marginBottom: '6px' }}>
                    <span>Firestore Write Stream</span>
                    <span style={{ fontWeight: 'bold', color: '#4caf50' }}>100%</span>
                  </div>
                  <div style={{ width: '100%', background: 'rgba(255,255,255,0.05)', height: '6px', borderRadius: '10px', overflow: 'hidden' }}>
                    <div className="progress-fill" style={{ width: '100%', background: 'linear-gradient(90deg, #4caf50, #81c784)', height: '100%', borderRadius: '10px' }}></div>
                  </div>
                </div>
              </div>
            </div>

          </div>

          <footer style={{
            position: 'fixed',
            bottom: 0,
            left: 0,
            right: 0,
            height: '70px',
            background: '#0e0e12',
            borderTop: '1px solid rgba(255, 255, 255, 0.08)',
            display: 'flex',
            justifyContent: 'space-between',
            alignItems: 'center',
            padding: '0 40px',
            zIndex: 1000,
            backdropFilter: 'blur(20px)'
          }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: '24px' }}>
              <span style={{ fontSize: '14px', fontWeight: '600', color: '#9ca3af', textTransform: 'uppercase', letterSpacing: '0.5px' }}>User Status</span>
              <div style={{ display: 'flex', alignItems: 'center', gap: '8px', background: 'rgba(58, 134, 255, 0.1)', padding: '6px 12px', borderRadius: '6px', fontSize: '13px', color: '#3a86ff', fontWeight: '500' }}>
                <span style={{ width: '6px', height: '6px', borderRadius: '50%', background: '#3a86ff' }}></span>
                Authenticated Session
              </div>
              <span style={{ fontSize: '14px', color: '#6b7280' }}>{user.email}</span>
            </div>
            
            <button 
              onClick={() => auth.signOut()} 
              style={{ 
                padding: '8px 16px', 
                background: 'transparent', 
                color: '#9ca3af', 
                border: '1px solid rgba(255,255,255,0.15)', 
                borderRadius: '6px', 
                cursor: 'pointer',
                fontSize: '13px',
                fontWeight: '500',
                transition: 'all 0.2s'
              }}
              onMouseEnter={(e) => {
                e.target.style.background = 'rgba(230, 57, 70, 0.1)';
                e.target.style.borderColor = '#e63946';
                e.target.style.color = '#e63946';
              }}
              onMouseLeave={(e) => {
                e.target.style.background = 'transparent';
                e.target.style.borderColor = 'rgba(255,255,255,0.15)';
                e.target.style.color = '#9ca3af';
              }}
            >
              Sign Out
            </button>
          </footer>
        </>
      )}
    </div>
  );
}

export default App;