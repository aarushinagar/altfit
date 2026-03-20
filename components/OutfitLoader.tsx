'use client';

import React, { useState, useEffect } from 'react';
import { useRouter } from 'next/navigation';
import { toast } from 'react-hot-toast';

const STAGES = [
  { text: 'Scanning your wardrobe...', sub: 'Looking through your pieces' },
  { text: 'Getting the weather...', sub: 'Matching your local climate' },
  { text: 'Building your look...', sub: 'Matching colours and textures' },
  { text: 'Perfect! One moment...', sub: 'Finishing touches' },
];

interface OutfitLoaderProps {
  userId: string;
  timezone: string;
  onOutfitReady?: (outfit: any) => void;
}

export function OutfitLoader({ userId, timezone, onOutfitReady }: OutfitLoaderProps) {
  const [stage, setStage] = useState(0);
  const [outfit, setOutfit] = useState<any>(null);
  const [error, setError] = useState<string | null>(null);
  const router = useRouter();

  useEffect(() => {
    let stageInterval: NodeJS.Timeout;
    let isMounted = true;

    // Cycle through loading stages every 3.5 seconds
    const startStageCycle = () => {
      stageInterval = setInterval(() => {
        if (isMounted) {
          setStage((s) => Math.min(s + 1, STAGES.length - 1));
        }
      }, 3500);
    };

    startStageCycle();

    // Call the generation API
    const generateOutfit = async () => {
      try {
        const token = localStorage.getItem('accessToken');

        const res = await fetch('/api/curations/today', {
          method: 'POST',
          credentials: 'include',
          headers: {
            'Content-Type': 'application/json',
            ...(token ? { Authorization: `Bearer ${token}` } : {}),
          },
          body: JSON.stringify({
            timezone,
            lat: 0,
            lon: 0,
          }),
        });

        if (!res.ok) {
          const data = await res.json().catch(() => ({}));
          const errorMsg = data.error || `Server error ${res.status}`;

          if (errorMsg === 'not_enough_items') {
            setError('not_enough_items');
          } else if (errorMsg.includes('timeout')) {
            setError('timeout');
          } else {
            setError(errorMsg);
          }
          return;
        }

        const data = await res.json();
        if (isMounted) {
          setOutfit(data);
          onOutfitReady?.(data);
          clearInterval(stageInterval);
        }
      } catch (err) {
        if (isMounted) {
          setError((err as Error).message || 'Generation failed');
          clearInterval(stageInterval);
        }
      }
    };

    generateOutfit();

    return () => {
      isMounted = false;
      clearInterval(stageInterval);
    };
  }, [userId, timezone, onOutfitReady]);

  if (error === 'not_enough_items') {
    return (
      <div className="empty-state">
        <div style={{ fontSize: 32, marginBottom: 12 }}>👗</div>
        <p style={{ fontSize: 18, fontWeight: 300, color: '#1C1410', marginBottom: 8 }}>
          Add more pieces to get started
        </p>
        <p style={{ fontSize: 12, color: '#7a7060', marginBottom: 20, lineHeight: 1.6 }}>
          You need at least 3 items in your wardrobe to get AI-curated looks.
        </p>
        <a
          href="/upload"
          style={{
            display: 'inline-block',
            padding: '12px 28px',
            backgroundColor: '#1C1410',
            color: 'white',
            textDecoration: 'none',
            borderRadius: 8,
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
          }}
        >
          + Add pieces
        </a>
      </div>
    );
  }

  if (error === 'timeout' || error) {
    return (
      <div style={{ padding: '40px 24px', textAlign: 'center' }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
        <p style={{ fontSize: 16, fontWeight: 300, color: '#1C1410', marginBottom: 8 }}>
          {error === 'timeout' ? 'Generation took too long' : 'Something went wrong'}
        </p>
        <p style={{ fontSize: 12, color: '#7a7060', marginBottom: 24 }}>
          {error === 'timeout'
            ? 'Please check your connection and try again.'
            : 'Try refreshing or check back in a moment.'}
        </p>
        <button
          onClick={() => window.location.reload()}
          style={{
            padding: '12px 28px',
            backgroundColor: '#1C1410',
            color: 'white',
            border: 'none',
            borderRadius: 8,
            fontSize: 11,
            letterSpacing: '0.12em',
            textTransform: 'uppercase',
            cursor: 'pointer',
          }}
        >
          Try again
        </button>
      </div>
    );
  }

  return (
    <div className="outfit-loader">
      {/* Skeleton cards while loading */}
      <div className="skeleton-items">
        {[1, 2, 3].map((i) => (
          <div key={i} className="skeleton-item-card">
            <div className="skeleton-image shimmer" />
            <div className="skeleton-details">
              <div className="shimmer" style={{ width: '60px', height: '10px' }} />
              <div className="shimmer" style={{ width: '100px', height: '16px', marginTop: '6px' }} />
              <div className="shimmer" style={{ width: '140px', height: '12px', marginTop: '6px' }} />
            </div>
          </div>
        ))}
      </div>

      {/* Stage text overlaid at bottom */}
      <div className="loader-stage">
        <p className="stage-text">{STAGES[stage].text}</p>
        <p className="stage-sub">{STAGES[stage].sub}</p>
      </div>
    </div>
  );
}
