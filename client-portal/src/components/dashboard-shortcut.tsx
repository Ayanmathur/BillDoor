'use client';

import React, { useState, useRef, useEffect, MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Plus, Calendar, FileText } from 'lucide-react';
import { fetchSettingsAction } from '@/app/dashboard/settings/actions';
import './dashboard-shortcut.css';

export default function DashboardShortcut() {
  const router = useRouter();
  const pathname = usePathname();

  const [posModeEnabled, setPosModeEnabled] = useState<boolean | null>(null);
  const [shortcutAction, setShortcutAction] = useState<'new_bill' | 'new_appointment'>('new_bill');
  const [isMobile, setIsMobile] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });

  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const hasDraggedRef = useRef(false);

  // Check screen size (< 640px) and page route (/dashboard only)
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch POS Settings
  useEffect(() => {
    if (pathname !== '/dashboard') return;

    async function loadPos() {
      const res = await fetchSettingsAction();
      if (res.settings?.posSettings) {
        setPosModeEnabled(res.settings.posSettings.posModeEnabled);
        setShortcutAction(res.settings.posSettings.mobileShortcutAction || 'new_bill');
      } else {
        setPosModeEnabled(true);
      }
    }
    loadPos();
  }, [pathname]);

  const targetPath = shortcutAction === 'new_appointment' ? '/dashboard/appointer/create' : '/dashboard/billit/create';
  const buttonText = shortcutAction === 'new_appointment' ? '+ Book' : '+ New Bill';
  const ActionIcon = shortcutAction === 'new_appointment' ? Calendar : FileText;

  const handleClick = () => {
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false;
      return;
    }
    router.push(targetPath);
  };

  // Dragging logic (Touch & Mouse)
  const startDrag = (clientX: number, clientY: number) => {
    setIsDragging(true);
    hasDraggedRef.current = false;
    dragStartRef.current = {
      x: clientX,
      y: clientY,
      posX: position.x,
      posY: position.y,
    };
  };

  const handleMouseDown = (e: ReactMouseEvent) => {
    startDrag(e.clientX, e.clientY);
  };

  const handleTouchStart = (e: ReactTouchEvent) => {
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      startDrag(touch.clientX, touch.clientY);
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        hasDraggedRef.current = true;
      }
      setPosition({
        x: dragStartRef.current.posX + dx,
        y: dragStartRef.current.posY + dy,
      });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length === 0) return;
      const touch = e.touches[0];
      const dx = touch.clientX - dragStartRef.current.x;
      const dy = touch.clientY - dragStartRef.current.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        hasDraggedRef.current = true;
      }
      setPosition({
        x: dragStartRef.current.posX + dx,
        y: dragStartRef.current.posY + dy,
      });
    };

    const handleEnd = () => {
      if (isDragging) {
        setIsDragging(false);
      }
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleEnd);
      window.addEventListener('touchmove', handleTouchMove, { passive: false });
      window.addEventListener('touchend', handleEnd);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleEnd);
      window.removeEventListener('touchmove', handleTouchMove);
      window.removeEventListener('touchend', handleEnd);
    };
  }, [isDragging]);

  // Do not render if not on mobile, not on dashboard, or POS mode is OFF
  if (!isMobile || pathname !== '/dashboard' || posModeEnabled === false) return null;

  return (
    <div
      ref={containerRef}
      className="dashboard-shortcut-container"
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
      }}
    >
      <button
        type="button"
        className="shortcut-pill-btn"
        onClick={handleClick}
        title={shortcutAction === 'new_appointment' ? 'Book New Appointment' : 'Create New Bill'}
      >
        <ActionIcon size={16} />
        <span>{buttonText}</span>
      </button>
    </div>
  );
}
