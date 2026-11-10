import React, { useRef, useState, useEffect, useCallback } from 'react';
import { Eraser, RotateCcw, Check, PenTool } from 'lucide-react';

interface SignaturePadProps {
  onSignatureChange: (dataUrl: string | null) => void;
  language: 'bn' | 'en';
  disabled?: boolean;
}

export const SignaturePad: React.FC<SignaturePadProps> = ({
  onSignatureChange,
  language,
  disabled = false
}) => {
  const isBn = language === 'bn';
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const lastPointRef = useRef<{ x: number; y: number } | null>(null);

  // Initialize and scale canvas for high DPI
  const setupCanvas = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const rect = canvas.getBoundingClientRect();
    const dpr = window.devicePixelRatio || 1;

    // Set internal resolution
    canvas.width = rect.width * dpr;
    canvas.height = rect.height * dpr;

    // Scale drawing context
    ctx.scale(dpr, dpr);
    ctx.lineCap = 'round';
    ctx.lineJoin = 'round';
    ctx.strokeStyle = '#0f172a'; // slate-900
    ctx.lineWidth = 2.5;
  }, []);

  useEffect(() => {
    setupCanvas();
    const handleResize = () => {
      // Note: Re-setting canvas clears drawing, but ensures crispness on resize
      // If user had drawn, we keep previous state or redraw if needed
    };
    window.addEventListener('resize', handleResize);
    return () => window.removeEventListener('resize', handleResize);
  }, [setupCanvas]);

  const getCoordinates = (e: MouseEvent | TouchEvent): { x: number; y: number } | null => {
    const canvas = canvasRef.current;
    if (!canvas) return null;
    const rect = canvas.getBoundingClientRect();

    if ('touches' in e) {
      if (e.touches.length === 0) return null;
      const touch = e.touches[0];
      return {
        x: touch.clientX - rect.left,
        y: touch.clientY - rect.top
      };
    } else {
      return {
        x: (e as MouseEvent).clientX - rect.left,
        y: (e as MouseEvent).clientY - rect.top
      };
    }
  };

  const isCanvasEmpty = (canvas: HTMLCanvasElement): boolean => {
    const ctx = canvas.getContext('2d');
    if (!ctx) return true;
    const pixelBuffer = new Uint32Array(
      ctx.getImageData(0, 0, canvas.width, canvas.height).data.buffer
    );
    return !pixelBuffer.some(color => color !== 0);
  };

  const startDrawing = (e: React.MouseEvent | React.TouchEvent) => {
    if (disabled) return;
    const coords = getCoordinates(e.nativeEvent);
    if (!coords) return;

    setIsDrawing(true);
    lastPointRef.current = coords;

    const canvas = canvasRef.current;
    if (canvas) {
      const ctx = canvas.getContext('2d');
      if (ctx) {
        ctx.beginPath();
        ctx.moveTo(coords.x, coords.y);
        ctx.lineTo(coords.x, coords.y);
        ctx.stroke();
      }
    }
  };

  const draw = (e: React.MouseEvent | React.TouchEvent) => {
    if (!isDrawing || disabled) return;
    const coords = getCoordinates(e.nativeEvent);
    if (!coords || !lastPointRef.current) return;

    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.beginPath();
    ctx.moveTo(lastPointRef.current.x, lastPointRef.current.y);
    ctx.lineTo(coords.x, coords.y);
    ctx.stroke();

    lastPointRef.current = coords;
  };

  const endDrawing = () => {
    if (!isDrawing) return;
    setIsDrawing(false);
    lastPointRef.current = null;

    const canvas = canvasRef.current;
    if (canvas) {
      const empty = isCanvasEmpty(canvas);
      if (!empty) {
        const dataUrl = canvas.toDataURL('image/png');
        setHasSignature(true);
        setPreviewUrl(dataUrl);
        onSignatureChange(dataUrl);
      } else {
        setHasSignature(false);
        setPreviewUrl(null);
        onSignatureChange(null);
      }
    }
  };

  const handleClear = () => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    ctx.clearRect(0, 0, canvas.width, canvas.height);
    setupCanvas();
    setHasSignature(false);
    setPreviewUrl(null);
    onSignatureChange(null);
  };

  return (
    <div className="space-y-3">
      <div className="flex items-center justify-between">
        <label className="text-xs font-bold text-slate-800 flex items-center space-x-1.5">
          <PenTool className="w-4 h-4 text-blue-600" />
          <span>{isBn ? 'শিক্ষকের ডিজিটাল স্বাক্ষর (অঙ্কন করুন):' : 'Teacher Digital Signature (Draw below):'}</span>
          <span className="text-red-500 font-bold">*</span>
        </label>
        {hasSignature && (
          <span className="inline-flex items-center space-x-1 text-[11px] text-emerald-700 font-semibold bg-emerald-50 px-2 py-0.5 rounded-full border border-emerald-200">
            <Check className="w-3 h-3 text-emerald-600" />
            <span>{isBn ? 'স্বাক্ষর গৃহীত হয়েছে' : 'Signature Captured'}</span>
          </span>
        )}
      </div>

      {/* Signature Canvas Box */}
      <div className="relative border-2 border-dashed border-slate-300 rounded-xl bg-slate-50 overflow-hidden hover:border-blue-400 transition">
        <canvas
          ref={canvasRef}
          onMouseDown={startDrawing}
          onMouseMove={draw}
          onMouseUp={endDrawing}
          onMouseLeave={endDrawing}
          onTouchStart={startDrawing}
          onTouchMove={draw}
          onTouchEnd={endDrawing}
          style={{ touchAction: 'none' }}
          className="w-full h-40 bg-white cursor-crosshair block"
        />

        {!hasSignature && !isDrawing && (
          <div className="absolute inset-0 pointer-events-none flex flex-col items-center justify-center text-slate-400 text-xs select-none">
            <PenTool className="w-6 h-6 mb-1 text-slate-300 animate-bounce" />
            <p className="font-medium">
              {isBn ? 'এখানে মাউস বা আঙুল দিয়ে স্বাক্ষর করুন' : 'Draw your signature here with finger or mouse'}
            </p>
            <p className="text-[10px] text-slate-300 mt-0.5">
              {isBn ? '(ডেস্কটপ, মোবাইল ও ট্যাবলেট সমর্থিত)' : '(Desktop, Mobile & Tablet Supported)'}
            </p>
          </div>
        )}
      </div>

      {/* Action Buttons & Signature Preview */}
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex items-center space-x-2">
          <button
            type="button"
            onClick={handleClear}
            disabled={!hasSignature || disabled}
            className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              hasSignature && !disabled
                ? 'bg-rose-50 text-rose-700 hover:bg-rose-100 border border-rose-200'
                : 'bg-slate-100 text-slate-400 border border-slate-200 cursor-not-allowed'
            }`}
          >
            <Eraser className="w-3.5 h-3.5" />
            <span>{isBn ? 'স্বাক্ষর মুছে ফেলুন' : 'Clear Signature'}</span>
          </button>

          <button
            type="button"
            onClick={handleClear}
            disabled={!hasSignature || disabled}
            className={`inline-flex items-center space-x-1 px-3 py-1.5 rounded-lg text-xs font-semibold transition ${
              hasSignature && !disabled
                ? 'bg-slate-100 text-slate-700 hover:bg-slate-200 border border-slate-300'
                : 'bg-slate-50 text-slate-300 border border-slate-200 cursor-not-allowed'
            }`}
          >
            <RotateCcw className="w-3.5 h-3.5" />
            <span>{isBn ? 'আবার স্বাক্ষর করুন' : 'Redraw Signature'}</span>
          </button>
        </div>

        {/* Small live thumbnail if signed */}
        {previewUrl && (
          <div className="flex items-center space-x-2 bg-white px-2.5 py-1 rounded-lg border border-slate-200 shadow-2xs">
            <span className="text-[10px] text-slate-500 font-medium">
              {isBn ? 'প্রিভিউ:' : 'Preview:'}
            </span>
            <img
              src={previewUrl}
              alt="Signature Preview"
              className="h-7 max-w-[90px] object-contain border border-slate-100 rounded bg-slate-50 p-0.5"
            />
          </div>
        )}
      </div>
    </div>
  );
};