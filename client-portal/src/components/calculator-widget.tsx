'use client';

import React, { useState, useRef, useEffect, MouseEvent as ReactMouseEvent } from 'react';
import { Calculator, X, Minus } from 'lucide-react';
import './calculator-widget.css';

interface StandardCalculatorWidgetProps {
  onClose?: () => void;
}

export default function StandardCalculatorWidget({ onClose }: StandardCalculatorWidgetProps) {
  const [display, setDisplay] = useState('0');
  const [equation, setEquation] = useState('');
  const [isDragging, setIsDragging] = useState(false);
  const [position, setPosition] = useState({ x: 0, y: 0 });
  const [isMinimized, setIsMinimized] = useState(true);

  const widgetRef = useRef<HTMLDivElement>(null);
  const dragStartRef = useRef({ x: 0, y: 0, posX: 0, posY: 0 });

  // Handle Dragging
  const handleMouseDown = (e: ReactMouseEvent) => {
    // Only allow drag on header
    if ((e.target as HTMLElement).closest('.calc-widget-header')) {
      setIsDragging(true);
      dragStartRef.current = {
        x: e.clientX,
        y: e.clientY,
        posX: position.x,
        posY: position.y
      };
    }
  };

  useEffect(() => {
    const handleMouseMove = (e: MouseEvent) => {
      if (!isDragging) return;
      const dx = e.clientX - dragStartRef.current.x;
      const dy = e.clientY - dragStartRef.current.y;
      setPosition({
        x: dragStartRef.current.posX + dx,
        y: dragStartRef.current.posY + dy
      });
    };

    const handleMouseUp = () => {
      setIsDragging(false);
    };

    if (isDragging) {
      window.addEventListener('mousemove', handleMouseMove);
      window.addEventListener('mouseup', handleMouseUp);
    }

    return () => {
      window.removeEventListener('mousemove', handleMouseMove);
      window.removeEventListener('mouseup', handleMouseUp);
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
      // safe eval using Function
      const fullEquation = equation + display;
      // replace × with * and ÷ with /
      const safeEq = fullEquation.replace(/×/g, '*').replace(/÷/g, '/');
      const result = new Function('return ' + safeEq)();
      
      // format to max 4 decimal places
      const finalResult = Math.round(result * 10000) / 10000;
      setDisplay(String(finalResult));
      setEquation('');
    } catch (e) {
      setDisplay('Error');
      setEquation('');
    }
  };

  const handleClear = () => {
    setDisplay('0');
    setEquation('');
  };

  return (
    <div 
      className={`calc-widget-container ${isMinimized ? 'minimized' : ''}`}
      ref={widgetRef}
      style={{
        transform: `translate(${position.x}px, ${position.y}px)`,
      }}
    >
      <div className="calc-widget-header" onMouseDown={handleMouseDown}>
        <div className="calc-widget-title">
          <Calculator size={14} /> Shop Calculator
        </div>
        <div className="calc-widget-actions">
          <button onClick={() => setIsMinimized(!isMinimized)} title="Minimize">
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
            <button className="calc-btn" onClick={() => handleOp('÷')}>÷</button>
            <button className="calc-btn" onClick={() => handleOp('×')}>×</button>
            <button className="calc-btn calc-btn-op" onClick={() => handleOp('-')}>−</button>

            <button className="calc-btn" onClick={() => handleNum('7')}>7</button>
            <button className="calc-btn" onClick={() => handleNum('8')}>8</button>
            <button className="calc-btn" onClick={() => handleNum('9')}>9</button>
            <button className="calc-btn calc-btn-op" onClick={() => handleOp('+')} style={{ gridRow: 'span 2' }}>+</button>

            <button className="calc-btn" onClick={() => handleNum('4')}>4</button>
            <button className="calc-btn" onClick={() => handleNum('5')}>5</button>
            <button className="calc-btn" onClick={() => handleNum('6')}>6</button>

            <button className="calc-btn" onClick={() => handleNum('1')}>1</button>
            <button className="calc-btn" onClick={() => handleNum('2')}>2</button>
            <button className="calc-btn" onClick={() => handleNum('3')}>3</button>
            <button className="calc-btn calc-btn-equal" onClick={handleEqual} style={{ gridRow: 'span 2' }}>=</button>

            <button className="calc-btn" onClick={() => handleNum('0')} style={{ gridColumn: 'span 2' }}>0</button>
            <button className="calc-btn" onClick={() => handleNum('.')}>.</button>
          </div>
        </div>
      )}
    </div>
  );
}
