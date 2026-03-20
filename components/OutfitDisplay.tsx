'use client';

import React, { useState } from 'react';
import { toast } from 'react-hot-toast';

interface OutfitItem {
  id: string;
  name: string;
  category: string;
  imageUrl: string | null;
  reason: string;
  role?: string;
}

interface Outfit {
  vibe: string;
  vibeTag?: string;
  occasion?: string;
  items: OutfitItem[];
  stylistNote?: string;
  colorStory?: string;
}

interface OutfitDisplayProps {
  outfit: Outfit;
  curationId: string;
  onRefresh?: () => void;
}

export function OutfitDisplay({ outfit, curationId, onRefresh }: OutfitDisplayProps) {
  const [saved, setSaved] = useState(false);
  const [worn, setWorn] = useState(false);

  const handleSave = async () => {
    setSaved(true);
    try {
      const token = localStorage.getItem('accessToken');
      await fetch('/api/saved-outfits', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ curationId, vibe: outfit.vibe }),
      });
      toast.success('✨ Saved to collection!');
    } catch (_err) {
      setSaved(false);
      toast.error('Failed to save');
    }
  };

  const handleWorn = async () => {
    setWorn(true);
    try {
      const token = localStorage.getItem('accessToken');
      await fetch('/api/outfits/worn', {
        method: 'POST',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ curationId, vibe: outfit.vibe }),
      });
      toast.success('🔥 Great choice!');
    } catch (_err) {
      setWorn(false);
      toast.error('Failed to save');
    }
  };

  const handleNewLook = async () => {
    toast.loading('Getting a new look...');
    try {
      const token = localStorage.getItem('accessToken');
      await fetch('/api/curations/today', {
        method: 'DELETE',
        credentials: 'include',
        headers: {
          'Content-Type': 'application/json',
          ...(token ? { Authorization: `Bearer ${token}` } : {}),
        },
        body: JSON.stringify({ timezone: Intl.DateTimeFormat().resolvedOptions().timeZone }),
      });
      if (onRefresh) onRefresh();
      toast.dismiss();
      window.location.reload();
    } catch (_err) {
      toast.dismiss();
      toast.error('Failed to refresh');
    }
  };

  return (
    <div className="outfit-display">
      {/* VIBE TAG — small pill at top */}
      <div className="vibe-tag">
        {outfit.vibeTag ?? outfit.vibe ?? outfit.occasion}
      </div>

      {/* OUTFIT ITEMS — vertical stack on mobile */}
      <div className="outfit-items">
        {outfit.items?.map((item, i) => (
          <div
            key={item.id}
            className="outfit-item-card"
            style={{ animationDelay: `${i * 100}ms` }}
          >
            <div className="item-image">
              {item.imageUrl ? (
                // eslint-disable-next-line @next/next/no-img-element
                <img
                  src={item.imageUrl}
                  alt={item.category}
                  loading={i === 0 ? 'eager' : 'lazy'}
                  onError={(e) => {
                    e.currentTarget.style.display = 'none';
                  }}
                />
              ) : null}
            </div>
            <div className="item-details">
              {item.role && <span className="item-role">{item.role.toUpperCase()}</span>}
              <span className="item-category">{item.category}</span>
              {item.reason && <span className="item-reason">{item.reason}</span>}
            </div>
          </div>
        ))}
      </div>

      {/* STYLIST NOTE */}
      {outfit.stylistNote && (
        <div className="stylist-note">
          <span className="note-label">STYLIST NOTE</span>
          <p>{outfit.stylistNote}</p>
          <span className="note-sig">— ALT FIT</span>
        </div>
      )}

      {/* COLOR STORY */}
      {outfit.colorStory && (
        <div className="color-story">
          🎨 {outfit.colorStory}
        </div>
      )}

      {/* ACTIONS — sticky bottom bar on mobile */}
      <div className="outfit-actions">
        <button
          className={`action-btn ${saved ? 'active' : ''}`}
          onClick={handleSave}
        >
          {saved ? '❤️' : '🤍'} Save
        </button>

        <button
          className={`action-btn ${worn ? 'active' : ''}`}
          onClick={handleWorn}
        >
          ✅ Wore this
        </button>

        <button className="action-btn regen" onClick={handleNewLook}>
          🔄 New look
        </button>
      </div>
    </div>
  );
}
