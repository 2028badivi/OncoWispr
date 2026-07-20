// src/App.jsx
import React, { useState, useEffect, useRef } from 'react';
import * as THREE from 'three';
import { auth, db } from './firebase';
import { onAuthStateChanged } from 'firebase/auth';
import { collection, query, orderBy, onSnapshot } from 'firebase/firestore';
import Auth from './Auth';

// INTEGRATED VISUAL ENVIRONMENT (Shader Background + Shooting Stars)
function VisualEnvironment() {
  const mountRef = useRef(null);
  const mouse = useRef(new THREE.Vector2(0, 0));

  useEffect(() => {
    const currentMount = mountRef.current;
    if (!currentMount) return;

    // 1. Scene Setup
    const scene = new THREE.Scene();
    const camera = new THREE.OrthographicCamera(-1, 1, 1, -1, 0, 1);
    const renderer = new THREE.WebGLRenderer({ alpha: true, antialias: true });
    renderer.setSize(window.innerWidth, window.innerHeight);
    renderer.setPixelRatio(Math.min(window.devicePixelRatio, 2));
    currentMount.appendChild(renderer.domElement);

    // 2. Shader Background
    const geometry = new THREE.PlaneGeometry(2, 2);
    const uniforms = {
      time: { value: 0.0 },
      uMouse: { value: new THREE.Vector2(0, 0) },
      resolution: { value: new THREE.Vector2(window.innerWidth, window.innerHeight) }
    };

    const material = new THREE.ShaderMaterial({
      uniforms: uniforms,
      fragmentShader: `
        uniform float time;
        uniform vec2 uMouse;
        uniform vec2 resolution;
        
        vec3 permute(vec3 x) { return mod(((x*34.0)+1.0)*x, 289.0); }
        float snoise(vec2 v){
          const vec4 C = vec4(0.211324865405187, 0.366025403784439, -0.577350269189626, 0.024390243902439);
          vec2 i  = floor(v + dot(v, C.yy) ); vec2 x0 = v -   i + dot(i, C.xx);
          vec2 i1 = (x0.x > x0.y) ? vec2(1.0, 0.0) : vec2(0.0, 1.0);
          vec4 x12 = x0.xyxy + C.xxzz; x12.xy -= i1; i = mod(i, 289.0);
          vec3 p = permute( permute( i.y + vec3(0.0, i1.y, 1.0 )) + i.x + vec3(0.0, i1.x, 1.0 ));
          vec3 m = max(0.5 - vec3(dot(x0,x0), dot(x12.xy,x12.xy), dot(x12.zw,x12.zw)), 0.0);
          m = m*m ; m = m*m ;
          vec3 x = 2.0 * fract(p * C.www) - 1.0; vec3 h = abs(x) - 0.5;
          vec3 ox = floor(x + 0.5); vec3 a0 = x - ox;
          m *= 1.79284291400159 - 0.85373472095314 * ( a0*a0 + h*h );
          vec3 g; g.x  = a0.x  * x0.x  + h.x  * x0.y; g.yz = a0.yz * x12.xz + h.yz * x12.yw;
          return 130.0 * dot(m, g);
        }

        void main() {
          vec2 st = gl_FragCoord.xy / resolution.xy;
          st.x *= resolution.x / resolution.y;
          float mouseDist = distance(st, uMouse);
          vec3 color = vec3(0.06, 0.06, 0.07); // Slightly warmer dark
          float n1 = snoise(st * 2.0 + time * 0.1);
          float n2 = snoise(st * 4.0 - time * 0.15 + n1 + (1.0 - mouseDist));
          float fluid = smoothstep(-0.2, 1.0, n2);
          vec3 emerald = vec3(0.31, 0.71, 0.55);
          vec3 mint = vec3(0.10, 0.85, 0.17);
          vec3 glow = mix(emerald, mint, snoise(st + time * 0.05));
          color += glow * fluid * 0.15; // Lower intensity for natural feel
          gl_FragColor = vec4(color, 1.0);
        }
      `
    });
    scene.add(new THREE.Mesh(geometry, material));

    // 3. Shooting Stars Layer
    const starCount = 40;
    const starGeometry = new THREE.BufferGeometry();
    const positions = new Float32Array(starCount * 3);
    const velocities = [];

    for (let i = 0; i < starCount; i++) {
      positions[i * 3] = (Math.random() - 0.5) * 2;
      positions[i * 3 + 1] = (Math.random() - 0.5) * 2;
      positions[i * 3 + 2] = 0.5;
      velocities.push(Math.random() * 0.01 + 0.005);
    }
    starGeometry.setAttribute('position', new THREE.BufferAttribute(positions, 3));
    const starMaterial = new THREE.PointsMaterial({ color: 0xffffff, size: 0.012, transparent: true, opacity: 0.7 });
    const stars = new THREE.Points(starGeometry, starMaterial);
    scene.add(stars);

    // 4. Animation Loop
    let animationFrameId;
    const clock = new THREE.Clock();
    const renderLoop = () => {
      uniforms.time.value = clock.getElapsedTime();
      uniforms.uMouse.value.lerp(mouse.current, 0.05);
      const pos = stars.geometry.attributes.position.array;
      for (let i = 0; i < starCount; i++) {
        pos[i * 3] += velocities[i];
        pos[i * 3 + 1] += velocities[i] * 0.5;
        if (pos[i * 3] > 1 || pos[i * 3 + 1] > 1) {
          pos[i * 3] = -1;
          pos[i * 3 + 1] = -1;
        }
      }
      stars.geometry.attributes.position.needsUpdate = true;
      renderer.render(scene, camera);
      animationFrameId = requestAnimationFrame(renderLoop);
    };
    renderLoop();

    const handleMouseMove = (e) => {
      mouse.current.set(e.clientX / window.innerWidth, 1.0 - (e.clientY / window.innerHeight));
    };
    window.addEventListener('mousemove', handleMouseMove);

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      cancelAnimationFrame(animationFrameId);
      currentMount.removeChild(renderer.domElement);
    };
  }, []);

  return <div ref={mountRef} style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: 0, pointerEvents: 'none' }} />;
}

// MAIN APP
function App() {
  const [user, setUser] = useState(null);
  const [loading, setLoading] = useState(true);
  const [entries, setEntries] = useState([]); 
  const [activeTab, setActiveTab] = useState('pipeline'); 

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
      setEntries(snapshot.docs.map(doc => ({ id: doc.id, ...doc.data() })));
    });
    return () => unsubscribeFirestore();
  }, [user]);

  const totalLogs = entries.length;
  const highDistressCount = entries.filter(t => t.depression_score && Number(t.depression_score) >= 7).length;
  const modDistressCount = entries.filter(t => t.depression_score && Number(t.depression_score) >= 4 && Number(t.depression_score) < 7).length;
  const distressRatio = totalLogs > 0 ? Math.round(((highDistressCount + modDistressCount) / totalLogs) * 100) : 0;
  const recentFlags = entries.filter(t => t.depression_score && Number(t.depression_score) >= 7).map(t => t.explanation || "No explanation").slice(0, 3);
  let currentStatus = 'Stable Baseline';
  if (totalLogs > 0) {
    const latestScore = Number(entries[0].depression_score || 0);
    if (latestScore >= 7) currentStatus = 'High Distress';
    else if (latestScore >= 4) currentStatus = 'Moderate Distress';
  }

  if (loading) {
      return (
        <div style={{ display: 'flex', justifyContent: 'center', alignItems: 'center', height: '100vh', backgroundColor: '#0a0a0c', color: '#D1FAD5', fontFamily: 'sans-serif' }}>
          <div style={{ fontSize: '16px', letterSpacing: '1px' }}>Loading Care Hub...</div>
        </div>
      );
  }

  return (
    <div style={{ minHeight: '100vh', backgroundColor: '#0a0a0c', position: 'relative' }}>
      <VisualEnvironment />
      
      {/* Container with optimized human-readable typography and layout spacing */}
      <div style={{ 
        padding: '180px 40px 200px 40px', 
        maxWidth: '1100px', 
        margin: '0 auto', 
        color: '#e2e8f0', // Slightly warmer off-white for text
        position: 'relative', 
        zIndex: 10,
        boxSizing: 'border-box',
        fontFamily: 'system-ui, -apple-system, BlinkMacSystemFont, "Segoe UI", Roboto, sans-serif'
      }}>
        <style>{`
          @keyframes fadeIn { from { opacity: 0; transform: translateY(10px); } to { opacity: 1; transform: translateY(0); } }
          .dashboard-card { background: rgba(255, 255, 255, 0.03); backdrop-filter: blur(10px); border: 1px solid rgba(255, 255, 255, 0.1); border-radius: 16px; padding: 32px; animation: fadeIn 0.6s ease-out; }
          .tab-btn { padding: 10px 20px; background: transparent; border: none; color: #94a3b8; cursor: pointer; font-weight: 500; font-size: 15px; border-bottom: 2px solid transparent; transition: all 0.2s; }
          .tab-btn.active { color: #4ade80; border-bottom: 2px solid #4ade80; }
          .progress-fill { transition: width 1.2s cubic-bezier(0.4, 0, 0.2, 1); }
        `}</style>

        <header style={{ borderBottom: '1px solid rgba(255, 255, 255, 0.1)', paddingBottom: '40px', marginBottom: '40px' }}>
          <h1 style={{ fontSize: '3.5rem', lineHeight: '1.1', fontWeight: '700', color: '#f8fafc', margin: 0 }}>OncoWispr Care Hub</h1>
        </header>

        <Auth user={user} />

        {user && (
          <>
             <div style={{ display: 'flex', gap: '24px', marginBottom: '40px' }}>
              <button className={`tab-btn ${activeTab === 'pipeline' ? 'active' : ''}`} onClick={() => setActiveTab('pipeline')}>Live Stream</button>
              <button className={`tab-btn ${activeTab === 'journal' ? 'active' : ''}`} onClick={() => setActiveTab('journal')}>Daily Journal</button>
              <button className={`tab-btn ${activeTab === 'analytics' ? 'active' : ''}`} onClick={() => setActiveTab('analytics')}>Health Analytics</button>
              <button className={`tab-btn ${activeTab === 'resources' ? 'active' : ''}`} onClick={() => setActiveTab('resources')}>Community Resources</button>
            </div>
            
            {activeTab === 'pipeline' && (
              <div style={{ display: 'grid', gridTemplateColumns: '2.2fr 1fr', gap: '32px' }}>
                <div style={{ display: 'flex', flexDirection: 'column', gap: '24px' }}>
                  <h3 style={{ margin: 0, fontSize: '14px', color: '#4ade80', textTransform: 'uppercase', letterSpacing: '1px' }}>System Feed</h3>
                  {entries.length === 0 ? (
                    <div style={{ padding: '60px', textAlign: 'center', color: '#64748b', border: '1px solid rgba(255,255,255,0.05)', borderRadius: '16px' }}>No active stream...</div>
                  ) : (
                    <div className="dashboard-card" style={{ borderLeft: currentStatus === 'High Distress' ? '4px solid #ef4444' : '4px solid #4ade80' }}>
                      <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '20px' }}>
                        <span style={{ fontSize: '13px', color: '#94a3b8' }}>Latest Entry • {entries[0].timestamp || 'N/A'}</span>
                        <span style={{ fontSize: '11px', padding: '4px 12px', borderRadius: '99px', background: 'rgba(255,255,255,0.05)', color: '#e2e8f0' }}>
                          Wellness: {entries[0].wellness_score || 0}/10
                        </span>
                      </div>
                      <p style={{ margin: '0 0 24px 0', fontSize: '18px', lineHeight: '1.6', color: '#f8fafc' }}>"{entries[0].transcript || 'No text captured yet.'}"</p>
                      <div style={{ fontSize: '14px', color: '#cbd5e1', background: 'rgba(255,255,255,0.03)', padding: '20px', borderRadius: '12px' }}>
                        <span style={{ color: '#4ade80', fontWeight: '600' }}>AI Summary:</span> {entries[0].explanation || 'Awaiting analysis...'}
                      </div>
                    </div>
                  )}
                </div>
                <div>
                  <div className="dashboard-card">
                    <h4 style={{ margin: '0 0 12px 0', color: '#f8fafc' }}>Ingestion Core</h4>
                    <p style={{ fontSize: '14px', color: '#94a3b8' }}>Pipeline Status: <span style={{ color: '#4ade80' }}>Operational</span></p>
                  </div>
                </div>
              </div>
            )}

            {activeTab === 'journal' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '20px' }}>
                <h3 style={{ margin: 0, fontSize: '14px', color: '#4ade80' }}>Journal History</h3>
                {entries.map((entry) => (
                  <div key={entry.id} className="dashboard-card">
                    <div style={{ display: 'flex', justifyContent: 'space-between', marginBottom: '12px', fontSize: '13px' }}>
                      <span style={{ color: '#94a3b8' }}>{entry.timestamp || 'N/A'}</span>
                      <span style={{ color: '#e2e8f0' }}>Score: {entry.depression_score || 0}/10</span>
                    </div>
                    <p style={{ margin: 0, color: '#f8fafc' }}>"{entry.transcript || 'No data.'}"</p>
                  </div>
                ))}
              </div>
            )}

            {activeTab === 'analytics' && (
              <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: '32px' }}>
                <div className="dashboard-card">
                  <h4 style={{ margin: '0 0 16px 0', color: '#f8fafc', fontSize: '16px' }}>Predictive Risk Density</h4>
                  <div style={{ fontSize: '56px', fontWeight: '700', color: '#fff' }}>{distressRatio}%</div>
                  <div style={{ width: '100%', background: 'rgba(255,255,255,0.1)', height: '8px', borderRadius: '4px', marginTop: '24px', overflow: 'hidden' }}>
                    <div className="progress-fill" style={{ width: `${distressRatio}%`, background: distressRatio > 50 ? '#ef4444' : '#4ade80', height: '100%' }}></div>
                  </div>
                </div>
                <div className="dashboard-card">
                    <h4 style={{ margin: '0 0 16px 0', color: '#f8fafc', fontSize: '16px' }}>Anomaly Log</h4>
                    {recentFlags.length > 0 ? recentFlags.map((flag, idx) => <li key={idx} style={{ color: '#fda4af', marginBottom: '8px' }}>{flag}</li>) : <p style={{ color: '#64748b' }}>No anomalies detected.</p>}
                </div>
              </div>
            )}

            {activeTab === 'resources' && (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '32px' }}>
                <h3 style={{ margin: 0, fontSize: '14px', color: '#4ade80' }}>Support Connections</h3>
                <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: '24px' }}>
                  <div className="dashboard-card">
                    <h4 style={{ margin: 0, color: '#f8fafc' }}>Oncology Peer Support</h4>
                    <button onClick={() => window.open('https://www.cancer.org/support-programs-and-services.html', '_blank')} style={{ background: 'transparent', border: '1px solid #4ade80', color: '#4ade80', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', marginTop: '20px' }}>Connect</button>
                  </div>
                  <div className="dashboard-card">
                    <h4 style={{ margin: 0, color: '#f8fafc' }}>Clinical Assistance</h4>
                    <button onClick={() => window.open('https://988lifeline.org/', '_blank')} style={{ background: 'transparent', border: '1px solid #ef4444', color: '#ef4444', padding: '10px 20px', borderRadius: '8px', cursor: 'pointer', marginTop: '20px' }}>Urgent Help</button>
                  </div>
                </div>
              </div>
            )}

            <footer style={{ position: 'fixed', bottom: 0, left: 0, right: 0, padding: '20px 40px', background: 'rgba(10,10,12,0.8)', borderTop: '1px solid rgba(255,255,255,0.05)', display: 'flex', justifyContent: 'space-between', alignItems: 'center', zIndex: 100, backdropFilter: 'blur(10px)' }}>
              <span style={{ fontSize: '12px', color: '#64748b' }}>Logged in as {user.email}</span>
              <button onClick={() => auth.signOut()} style={{ background: 'transparent', border: 'none', color: '#94a3b8', cursor: 'pointer', fontSize: '12px' }}>Sign Out</button>
            </footer>
          </>
        )}
      </div>
    </div>
  );
}

export default App;