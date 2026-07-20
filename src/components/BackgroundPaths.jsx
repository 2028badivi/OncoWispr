// src/components/BackgroundPaths.jsx
import React from 'react';
import { motion } from 'framer-motion';

export default function BackgroundPaths() {
  return (
    <div style={{ position: 'fixed', top: 0, left: 0, width: '100vw', height: '100vh', zIndex: -1, overflow: 'hidden', backgroundColor: '#0a0a0c' }}>
      <svg style={{ width: '100%', height: '100%', opacity: 0.15 }} xmlns="http://www.w3.org/2000/svg">
        {/* Path 1 */}
        <motion.path
          d="M-100,200 Q300,50 800,400 T1800,200"
          fill="none"
          stroke="#4FB58C"
          strokeWidth="2"
          animate={{
            d: [
              "M-100,200 Q300,50 800,400 T1800,200",
              "M-100,250 Q400,150 700,350 T1800,250",
              "M-100,200 Q300,50 800,400 T1800,200"
            ]
          }}
          transition={{ duration: 15, repeat: Infinity, ease: "easeInOut" }}
        />
        {/* Path 2 */}
        <motion.path
          d="M-50,600 Q400,800 900,450 T1950,700"
          fill="none"
          stroke="#1AD82C"
          strokeWidth="1.5"
          animate={{
            d: [
              "M-50,600 Q400,800 900,450 T1950,700",
              "M-50,550 Q500,700 800,500 T1950,650",
              "M-50,600 Q400,800 900,450 T1950,700"
            ]
          }}
          transition={{ duration: 20, repeat: Infinity, ease: "easeInOut" }}
        />
      </svg>
      {/* Radial overlay to smoothly fade out edges into dark space */}
      <div style={{
        position: 'absolute',
        top: 0,
        left: 0,
        width: '100%',
        height: '100%',
        background: 'radial-gradient(circle at 50% 50%, transparent 20%, #0a0a0c 85%)'
      }} />
    </div>
  );
}