'use client';

import React, { useState, useRef, useEffect, MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react';
import { useRouter, usePathname } from 'next/navigation';
import { Calendar, FileText } from 'lucide-react';
import { fetchSettingsAction } from '@/app/dashboard/settings/actions';
import './dashboard-shortcut.css';

interface DashboardShortcutProps {
  modulesEnabled?: Record<string, boolean>;
}

export default function DashboardShortcut({ modulesEnabled = {} }: DashboardShortcutProps) {
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

  // Check screen size (< 768px for mobile drawer)
  useEffect(() => {
    const checkMobile = () => {
      setIsMobile(window.innerWidth <= 768);
    };
    checkMobile();
    window.addEventListener('resize', checkMobile);
    return () => window.removeEventListener('resize', checkMobile);
  }, []);

  // Fetch POS Settings
  useEffect(() => {
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
  }, []);

  // Module enablement flags
  const isBillitEnabled = modulesEnabled.billit !== false;
  const isAppointerEnabled = modulesEnabled.appointer !== false;

  // Determine active action based on administrative gating & settings
  let effectiveAction: 'new_bill' | 'new_appointment' | null = null;

  if (isBillitEnabled) {
    if (shortcutAction === 'new_appointment' && isAppointerEnabled) {
      effectiveAction = 'new_appointment';
    } else {
      effectiveAction = 'new_bill';
    }
  } else if (isAppointerEnabled) {
    effectiveAction = 'new_appointment';
  } else {
    // Both Billit and Appointer are disabled by admin -> hide shortcut completely
    effectiveAction = null;
  }

  const targetPath = effectiveAction === 'new_appointment' ? '/dashboard/appointer/create' : '/dashboard/billit/create';
  const buttonText = effectiveAction === 'new_appointment' ? '+ Book' : '+ New Bill';
  const ActionIcon = effectiveAction === 'new_appointment' ? Calendar : FileText;

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

  // Route exceptions: hide on create bill and create appointment screens
  const isCreationPage = pathname === '/dashboard/billit/create' || pathname === '/dashboard/appointer/create';

  // Do not render if not on mobile, on creation page, POS mode is disabled, or both modules disabled
  if (!isMobile || isCreationPage || posModeEnabled === false || effectiveAction === null) {
    return null;
  }

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
        title={effectiveAction === 'new_appointment' ? 'Book New Appointment' : 'Create New Bill'}
      >
        <ActionIcon size={16} />
        <span>{buttonText}</span>
      </button>
    </div>
  );
}
