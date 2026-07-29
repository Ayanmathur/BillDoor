'use client';

import React, { useState, useRef, useEffect, MouseEvent as ReactMouseEvent, TouchEvent as ReactTouchEvent } from 'react';
import { Calculator, X, Minus } from 'lucide-react';
import './calculator-widget.css';

interface StandardCalculatorWidgetProps {
  onClose?: () => void;
  defaultGstPercent?: number;
  defaultDiscountPercent?: number;
  defaultDiscountType?: 'percent' | 'flat';
}

export default function StandardCalculatorWidget({
  onClose,
  defaultGstPercent = 18,
  defaultDiscountPercent = 10,
  defaultDiscountType = 'percent',
}: StandardCalculatorWidgetProps) {
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  const [isMinimized, setIsMinimized] = useState(true);
  const [isDragging, setIsDragging] = useState(false);

  // Widget anchor state: screen coordinates
  const [coords, setCoords] = useState<{
    top?: number;
    bottom?: number;
    left?: number;
    right?: number;
  }>({ bottom: 16, right: 16 });

  // Current quadrant: top-right, top-left, bottom-right, bottom-left
  const [quadrant, setQuadrant] = useState<'top-right' | 'top-left' | 'bottom-right' | 'bottom-left'>('bottom-right');

  const widgetRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0, initialRect: { top: 0, left: 0, bottom: 0, right: 0, width: 0, height: 0 } });
  const hasDraggedRef = useRef(false);

  // Recalculate quadrant and anchor coordinates based on current screen position
  const updateQuadrantAnchor = (currentRect?: DOMRect) => {
    const rect = currentRect || widgetRef.current?.getBoundingClientRect();
    if (!rect) return;

    const winW = window.innerWidth;
    const winH = window.innerHeight;
    const centerX = rect.left + rect.width / 2;
    const centerY = rect.top + rect.height / 2;

    const isRight = centerX > winW / 2;
    const isBottom = centerY > winH / 2;

    const headerHeight = 36;
    const headerBottom = isMinimized ? rect.bottom : (quadrant.startsWith('bottom') ? rect.bottom - (rect.height - headerHeight) : rect.top + headerHeight);
    const bottomDist = Math.max(8, winH - headerBottom);

    if (isBottom && isRight) {
      setQuadrant('bottom-right');
      setCoords({ bottom: bottomDist, right: Math.max(8, winW - rect.right) });
    } else if (isBottom && !isRight) {
      setQuadrant('bottom-left');
      setCoords({ bottom: bottomDist, left: Math.max(8, rect.left) });
    } else if (!isBottom && isRight) {
      setQuadrant('top-right');
      setCoords({ top: Math.max(8, rect.top), right: Math.max(8, winW - rect.right) });
    } else {
      setQuadrant('top-left');
      setCoords({ top: Math.max(8, rect.top), left: Math.max(8, rect.left) });
    }
  };

  // Initial calculation on mount (preserve default bottom-right placement until dragged)
  useEffect(() => {
    const handleResize = () => {
      if (hasDraggedRef.current) {
        updateQuadrantAnchor();
      }
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, []);

  const toggleMinimize = () => {
    if (hasDraggedRef.current) {
      const rect = widgetRef.current?.getBoundingClientRect();
      if (rect) {
        updateQuadrantAnchor(rect);
      }
    } else {
      setQuadrant('bottom-right');
      setCoords({ bottom: 16, right: 16 });
    }
    setIsMinimized(prev => !prev);
  };

  const handleHeaderClick = (e: ReactMouseEvent) => {
    if ((e.target as HTMLElement).closest('.calc-close-btn')) return;
    if (hasDraggedRef.current) {
      hasDraggedRef.current = false;
      return;
    }
    toggleMinimize();
  };

  // Start Dragging
  const startDrag = (clientX: number, clientY: number, target: HTMLElement) => {
    if (target.closest('.calc-close-btn')) return;
    const rect = widgetRef.current?.getBoundingClientRect();
    if (!rect) return;

    setIsDragging(true);
    hasDraggedRef.current = false;
    dragStartRef.current = {
      x: clientX,
      y: clientY,
      initialRect: {
        top: rect.top,
        left: rect.left,
        bottom: window.innerHeight - rect.bottom,
        right: window.innerWidth - rect.right,
        width: rect.width,
        height: rect.height,
      },
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

      const winW = window.innerWidth;
      const winH = window.innerHeight;
      const initial = dragStartRef.current.initialRect;

      const newLeft = Math.max(8, Math.min(winW - initial.width - 8, initial.left + dx));
      const newTop = Math.max(8, Math.min(winH - initial.height - 8, initial.top + dy));

      // Use top & left during active drag for fluid 60fps movement without anchor jumping
      setCoords({ top: newTop, left: newLeft });
    };

    const handleTouchMove = (e: TouchEvent) => {
      if (!isDragging || e.touches.length === 0) return;
      e.preventDefault(); // Prevent touch scroll during widget drag
      const touch = e.touches[0];
      const dx = touch.clientX - dragStartRef.current.x;
      const dy = touch.clientY - dragStartRef.current.y;
      if (Math.abs(dx) > 4 || Math.abs(dy) > 4) {
        hasDraggedRef.current = true;
      }

      const winW = window.innerWidth;
      const winH = window.innerHeight;
      const initial = dragStartRef.current.initialRect;

      const newLeft = Math.max(8, Math.min(winW - initial.width - 8, initial.left + dx));
      const newTop = Math.max(8, Math.min(winH - initial.height - 8, initial.top + dy));

      // Use top & left during active drag for fluid 60fps movement without anchor jumping
      setCoords({ top: newTop, left: newLeft });
    };

    const handleEnd = () => {
      if (isDragging) {
        setIsDragging(false);
        // On drag end, lock final quadrant anchor relative to screen center
        if (hasDraggedRef.current && widgetRef.current) {
          const rect = widgetRef.current.getBoundingClientRect();
          const winW = window.innerWidth;
          const winH = window.innerHeight;
          const centerX = rect.left + rect.width / 2;
          const centerY = rect.top + rect.height / 2;

          const isRight = centerX > winW / 2;
          const isBottom = centerY > winH / 2;

          const headerHeight = 36;
          const headerBottom = isMinimized ? rect.bottom : (quadrant.startsWith('bottom') ? rect.bottom - (rect.height - headerHeight) : rect.top + headerHeight);
          const bottomDist = Math.max(8, winH - headerBottom);

          if (isBottom && isRight) {
            setQuadrant('bottom-right');
            setCoords({ bottom: bottomDist, right: Math.max(8, winW - rect.right) });
          } else if (isBottom && !isRight) {
            setQuadrant('bottom-left');
            setCoords({ bottom: bottomDist, left: Math.max(8, rect.left) });
          } else if (!isBottom && isRight) {
            setQuadrant('top-right');
            setCoords({ top: Math.max(8, rect.top), right: Math.max(8, winW - rect.right) });
          } else {
            setQuadrant('top-left');
            setCoords({ top: Math.max(8, rect.top), left: Math.max(8, rect.left) });
          }
        }
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

  // Calculator Logic
  const handleNum = (num: string) => {
    if (display === '0' || display === 'Error') {
      setDisplay(num);
    } else {
      setDisplay(display + num);
    }
  };

  const handleOp = (op: string) => {
    setEquation(display + ' ' + op + ' ');
    setDisplay('0');
  };

  const handleEqual = () => {
    if (!equation) return;
    try {
      const fullEquation = equation + display;
      const safeEq = fullEquation.replace(/×/g, '*').replace(/÷/g, '/');
      const result = new Function('return ' + safeEq)();
      const finalResult = Math.round(result * 10000) / 10000;
      setDisplay(String(finalResult));
      setEquation('');
    } catch (e) {
      setDisplay('Error');
      setEquation('');
    }
  };

  const handleBackspace = () => {
    if (display === 'Error' || display.length <= 1) {
      setDisplay('0');
    } else {
      setDisplay(display.slice(0, -1));
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setEquation('');
  };

  const handlePlusGst = (gstPercent: number = defaultGstPercent) => {
    const val = parseFloat(display) || 0;
    const withGst = val + (val * (gstPercent / 100));
    setDisplay(String(Math.round(withGst * 100) / 100));
  };

  const handleMinusDisc = (discValue: number = defaultDiscountPercent, type: 'percent' | 'flat' = defaultDiscountType) => {
    const val = parseFloat(display) || 0;
    let afterDisc = val;
    if (type === 'flat') {
      afterDisc = Math.max(0, val - discValue);
    } else {
      afterDisc = val - (val * (discValue / 100));
    }
    setDisplay(String(Math.round(afterDisc * 100) / 100));
  };

  // Keyboard support when expanded
  useEffect(() => {
    if (isMinimized) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      const targetTag = (e.target as HTMLElement)?.tagName?.toLowerCase();
      if (targetTag === 'input' || targetTag === 'textarea' || targetTag === 'select') return;

      if (e.key >= '0' && e.key <= '9') {
        handleNum(e.key);
      } else if (e.key === '.') {
        handleNum('.');
      } else if (e.key === '+') {
        handleOp('+');
      } else if (e.key === '-') {
        handleOp('-');
      } else if (e.key === '*') {
        handleOp('×');
      } else if (e.key === '/') {
        e.preventDefault();
        handleOp('÷');
      } else if (e.key === 'Enter' || e.key === '=') {
        e.preventDefault();
        handleEqual();
      } else if (e.key === 'Backspace') {
        e.preventDefault();
        handleBackspace();
      } else if (e.key === 'Escape') {
        handleClear();
      }
    };

    window.addEventListener('keydown', handleKeyDown);
    return () => window.removeEventListener('keydown', handleKeyDown);
  }, [isMinimized, display, equation]);

  // Compute inline position styles based on active anchor
  const stylePos: React.CSSProperties = {
    position: 'fixed',
    top: coords.top !== undefined ? `${coords.top}px` : undefined,
    bottom: coords.bottom !== undefined ? `${coords.bottom}px` : undefined,
    left: coords.left !== undefined ? `${coords.left}px` : undefined,
    right: coords.right !== undefined ? `${coords.right}px` : undefined,
    transformOrigin: quadrant.replace('-', ' '),
  };

  return (
    <div 
      className={`calc-widget-container ${isMinimized ? 'minimized' : ''} quadrant-${quadrant}`}
      ref={widgetRef}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      style={stylePos}
    >
      <div className="calc-widget-header" onClick={handleHeaderClick} style={{ cursor: 'pointer' }} title={isMinimized ? 'Click to Expand Calculator' : 'Click to Minimize Calculator'}>
        <div className="calc-widget-title">
          <Calculator size={14} /> Shop Calculator
        </div>
        <div className="calc-widget-actions">
          <button type="button" onClick={(e) => { e.stopPropagation(); toggleMinimize(); }} title={isMinimized ? 'Expand' : 'Minimize'}>
            <Minus size={14} />
          </button>
          {onClose && (
            <button type="button" className="calc-close-btn" onClick={onClose} title="Close">
              <X size={14} />
            </button>
          )}
        </div>
      </div>

      {!isMinimized && (
        <div className="calc-widget-body">
          <div className="calc-screen">
            <div className="calc-equation">{equation}</div>
            <div className="calc-display">{display}</div>
          </div>
          
          <div className="calc-keypad">
            <button className="calc-btn calc-btn-clear" onClick={handleClear}>C</button>
            <button className="calc-btn" onClick={handleBackspace} title="Backspace (Backspace)">⌫</button>
            <button className="calc-btn" onClick={() => handlePlusGst(defaultGstPercent)} title={`Add ${defaultGstPercent}% GST`}>
              +{defaultGstPercent}%
            </button>
            <button className="calc-btn" onClick={() => handleMinusDisc(defaultDiscountPercent, defaultDiscountType)} title={`Subtract ${defaultDiscountType === 'flat' ? '₹' : ''}${defaultDiscountPercent}${defaultDiscountType === 'percent' ? '%' : ''} Discount`}>
              {defaultDiscountType === 'flat' ? `-₹${defaultDiscountPercent}` : `-${defaultDiscountPercent}%`}
            </button>

            <button className="calc-btn" onClick={() => handleOp('÷')}>÷</button>
            <button className="calc-btn" onClick={() => handleOp('×')}>×</button>
            <button className="calc-btn calc-btn-op" onClick={() => handleOp('-')}>−</button>
            <button className="calc-btn calc-btn-op" onClick={() => handleOp('+')}>+</button>

            <button className="calc-btn" onClick={() => handleNum('7')}>7</button>
            <button className="calc-btn" onClick={() => handleNum('8')}>8</button>
            <button className="calc-btn" onClick={() => handleNum('9')}>9</button>
            <button className="calc-btn calc-btn-equal" onClick={handleEqual} style={{ gridRow: 'span 2' }}>=</button>

            <button className="calc-btn" onClick={() => handleNum('4')}>4</button>
            <button className="calc-btn" onClick={() => handleNum('5')}>5</button>
            <button className="calc-btn" onClick={() => handleNum('6')}>6</button>

            <button className="calc-btn" onClick={() => handleNum('1')}>1</button>
            <button className="calc-btn" onClick={() => handleNum('2')}>2</button>
            <button className="calc-btn" onClick={() => handleNum('3')}>3</button>
            <button className="calc-btn" onClick={() => handleNum('.')}>.</button>

            <button className="calc-btn" onClick={() => handleNum('0')} style={{ gridColumn: 'span 4' }}>0</button>
          </div>
        </div>
      )}
    </div>
  );
}
