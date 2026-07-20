// src/Auth.jsx
import React, { useState } from 'react';
import { auth } from './firebase';
import { createUserWithEmailAndPassword, signInWithEmailAndPassword, signOut } from 'firebase/auth';

function Auth({ user }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [isSignUp, setIsSignUp] = useState(false);
  const [error, setError] = useState('');

  const handleAuth = async (e) => {
    e.preventDefault();
    setError('');
    try {
      if (isSignUp) {
        await createUserWithEmailAndPassword(auth, email, password);
      } else {
        await signInWithEmailAndPassword(auth, email, password);
      }
    } catch (err) {
      setError(err.message.replace("Firebase: ", ""));
    }
  };

  if (user) {
  return null; 
  }   

  return (
    <div style={{ background: '#1e1e24', padding: '30px', borderRadius: '8px', maxWidth: '400px', margin: '20px auto', boxShadow: '0 4px 10px rgba(0,0,0,0.3)' }}>
      <h2 style={{ color: '#fff', marginTop: 0 }}>{isSignUp ? 'Create Account' : 'Sign In'}</h2>
      <form onSubmit={handleAuth} style={{ display: 'flex', flexDirection: 'column', gap: '15px' }}>
        <input type="email" placeholder="Email" value={email} onChange={(e) => setEmail(e.target.value)} required style={{ padding: '10px', borderRadius: '4px', border: '1px solid #333', background: '#121214', color: '#fff' }} />
        <input type="password" placeholder="Password" value={password} onChange={(e) => setPassword(e.target.value)} required style={{ padding: '10px', borderRadius: '4px', border: '1px solid #333', background: '#121214', color: '#fff' }} />
        <button type="submit" style={{ padding: '10px', background: '#3a86ff', color: '#fff', border: 'none', borderRadius: '4px', fontWeight: 'bold', cursor: 'pointer' }}>
          {isSignUp ? 'Sign Up' : 'Log In'}
        </button>
      </form>
      {error && <p style={{ color: '#e63946', marginTop: '15px', fontSize: '14px' }}>{error}</p>}
      <p style={{ color: '#a0a0a0', marginTop: '20px', fontSize: '14px', textAlign: 'center' }}>
        {isSignUp ? 'Already have an account?' : "Don't have an account?"}{' '}
        <span onClick={() => setIsSignUp(!isSignUp)} style={{ color: '#3a86ff', cursor: 'pointer', textDecoration: 'underline' }}>
          {isSignUp ? 'Sign In' : 'Sign Up'}
        </span>
      </p>
    </div>
  );
}

export default Auth;