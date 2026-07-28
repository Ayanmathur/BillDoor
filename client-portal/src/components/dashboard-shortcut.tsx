'use client';

import React, { useState, useRef, useEffect, MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Plus, Calendar, FileText, X } from 'lucide-react';
import { fetchSettingsAction } from '@/app/dashboard/settings/actions';
import './dashboard-shortcut.css';

export default function DashboardShortcut() {
  const router = useRouter();
  const pathname = usePathname();

  const [posModeEnabled, setPosModeEnabled] = useState<boolean | null>(null);
  const [shortcutAction, setShortcutAction] = useState<'new_bill' | 'new_appointment'>('new_bill');
  const [isMobile, setIsMobile] = useState(false);
  const [isOpen, setIsOpen] = useState(false);
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [transformOrigin, setTransformOrigin] = useState('bottom right');

  const containerRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });
  const hasDraggedRef = useRef(false);

  // 1. Check screen size (< 640px) and page route (/dashboard only)
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 640);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // 2. Fetch POS Settings
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

  // Quadrant detection for 4-corner expansion physics
  const updateQuadrantOrigin = () => {
    if (!containerRef.current) return;
    const rect = containerRef.current.getBoundingClientRect();
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    const isRight = rect.left + rect.width / 2 > winW / 2;
    const isBottom = rect.top + rect.height / 2 > winH / 2;

    const vertical = isBottom ? 'bottom' : 'top';
    const horizontal = isRight ? 'right' : 'left';

    setTransformOrigin(`${vertical} ${horizontal}`);
  };

  const handleToggleOpen = () => {
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false;
      return;
    }
    updateQuadrantOrigin();
    setIsOpen(prev => !prev);
  };

  // Dragging logic (Touch & Mouse)
  const startDrag = (clientX: number, clientY: number, target: HTMLElement) => {
    if (target.closest('.shortcut-popover-item')) return;
    updateQuadrantOrigin();
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
    startDrag(e.clientX, e.clientY, e.target as HTMLElement);
  };

  const handleTouchStart = (e: ReactTouchEvent) => {
    if (e.touches.length > 0) {
      const touch = e.touches[0];
      startDrag(touch.clientX, touch.clientY, e.target as HTMLElement);
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
        updateQuadrantOrigin();
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

  const targetPath = shortcutAction === 'new_appointment' ? '/dashboard/appointer/create' : '/dashboard/billit/create';
  const actionLabel = shortcutAction === 'new_appointment' ? 'Book Appointment' : 'Create New Bill';
  const ActionIcon = shortcutAction === 'new_appointment' ? Calendar : FileText;

  return (
    <div
      ref={containerRef}
      className={`dashboard-shortcut-container ${isOpen ? 'open' : ''}`}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        transformOrigin,
      }}
    >
      {/* 4-Corner Expanded Popover Menu */}
      {isOpen && (
        <div className="shortcut-popover-menu" style={{ transformOrigin }}>
          <button
            type="button"
            className="shortcut-popover-item primary"
            onClick={() => { setIsOpen(false); router.push(targetPath); }}
          >
            <ActionIcon size={16} />
            <span>{actionLabel}</span>
          </button>
        </div>
      )}

      {/* Floating Trigger Button */}
      <button
        type="button"
        className="shortcut-trigger-btn"
        onClick={handleToggleOpen}
        title="Quick POS Shortcut"
      >
        {isOpen ? <X size={20} /> : <Plus size={20} />}
      </button>
    </div>
  );
}
