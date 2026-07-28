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
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isMinimized, setIsMinimized] = useState(true);
  const [transformOrigin, setTransformOrigin] = useState('bottom right');

  const widgetRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  // Calculate screen quadrant expansion origin whenever expanded
  const updateQuadrantOrigin = () => {
    if (!widgetRef.current) return;
    const rect = widgetRef.current.getBoundingClientRect();
    const winW = window.innerWidth;
    const winH = window.innerHeight;

    const isRight = rect.left + rect.width / 2 > winW / 2;
    const isBottom = rect.top + rect.height / 2 > winH / 2;

    const vertical = isBottom ? 'bottom' : 'top';
    const horizontal = isRight ? 'right' : 'left';

    setTransformOrigin(`${vertical} ${horizontal}`);
  };

  const toggleMinimize = () => {
    if (isMinimized) {
      updateQuadrantOrigin();
    }
    setIsMinimized(!isMinimized);
  };

  // Start Dragging (Mouse & Touch anywhere on container except buttons)
  const startDrag = (clientX: number, clientY: number, target: HTMLElement) => {
    if (target.closest('button, input, select, a')) return;
    updateQuadrantOrigin();
    setIsDragging(true);
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

  // Quick GST & Discount helpers
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

  // Global Keyboard Listener when expanded
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

  return (
    <div 
      className={`calc-widget-container ${isMinimized ? 'minimized' : ''}`}
      ref={widgetRef}
      onMouseDown={handleMouseDown}
      onTouchStart={handleTouchStart}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
        transformOrigin,
      }}
    >
      <div className="calc-widget-header">
        <div className="calc-widget-title">
          <Calculator size={14} /> Shop Calculator
        </div>
        <div className="calc-widget-actions">
          <button onClick={toggleMinimize} title={isMinimized ? 'Expand' : 'Minimize'}>
            <Minus size={14} />
          </button>
          {onClose && (
            <button onClick={onClose} title="Close">
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
              -{defaultDiscountType === 'flat' ? '₹' : ''}{defaultDiscountPercent}{defaultDiscountType === 'percent' ? '%' : ''}
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
