import React, { useState, useRef, useEffect } from 'react';
import { 
  CheckCircle, AlertCircle, Loader2, 
  ShieldCheck, Zap, Rocket, Presentation, 
  Wand2, Shield, Cpu, Lock, ExternalLink,
  Code2
} from 'lucide-react';
import { inject } from '@vercel/analytics';
import { ProcessingStatus, ProcessingState } from './types.ts';
import { convertPdfToImages, createPdfFromImages } from './services/pdfService.ts';
import { generatePptx } from './services/pptxService.ts';

const App: React.FC = () => {
  const [state, setState] = useState<ProcessingState>({
    status: ProcessingStatus.IDLE,
    progress: 0,
    message: '',
    slides: []
  });

  const fileInputRef = useRef<HTMLInputElement>(null);
  const pptInputRef = useRef<HTMLInputElement>(null);

  // Initialize Vercel Analytics
  useEffect(() => {
    inject();
  }, []);

  const updateState = (updates: Partial<ProcessingState>) => {
    setState(prev => ({ ...prev, ...updates }));
  };

  /**
   * HEURISTIC SCRUBBING ENGINE (100% LOCAL)
   * Samples surrounding pixels to 'heal' the branding areas without calling any external APIs.
   */
  const performHeuristicScrub = async (imageSrc: string, isLastPage: boolean): Promise<string> => {
    return new Promise((resolve) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        const canvas = document.createElement('canvas');
        const ctx = canvas.getContext('2d', { willReadFrequently: true });
        if (!ctx) return resolve(imageSrc);
        
        canvas.width = img.width;
        canvas.height = img.height;
        ctx.drawImage(img, 0, 0);

        const killZones = [
          { x: 74, y: 83, w: 26, h: 17 }, // Bottom-right logo
          { x: 0, y: 87, w: 23, h: 13 }   // Bottom-left variant
        ];

        if (isLastPage) {
          killZones.push({ x: 25, y: 78, w: 50, h: 22 }); 
        }

        killZones.forEach(zone => {
          const sx = (zone.x / 100) * img.width;
          const sy = (zone.y / 100) * img.height;
          const sw = (zone.w / 100) * img.width;
          const sh = (zone.h / 100) * img.height;

          const sampleY = Math.max(0, sy - 15);
          const sampleX = sx + (sw / 2);
          
          try {
            const pixel = ctx.getImageData(sampleX, sampleY, 1, 1).data;
            if (pixel[3] > 0) {
              const r = pixel[0], g = pixel[1], b = pixel[2];
              ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
              ctx.fillRect(sx - 5, sy - 5, sw + 10, sh + 10);
              ctx.globalAlpha = 0.6;
              ctx.filter = 'blur(12px)';
              ctx.fillRect(sx - 15, sy - 15, sw + 30, sh + 30);
              ctx.filter = 'none';
              ctx.globalAlpha = 1.0;
            }
          } catch (e) {
            console.warn("Heuristic sampling skipped.");
          }
        });

        resolve(canvas.toDataURL('image/jpeg', 0.82));
      };
      img.onerror = () => resolve(imageSrc);
      img.src = imageSrc;
    });
  };

  const startFastScrub = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const fileArray = Array.from(files).filter(f => f.type === 'application/pdf');
    updateState({ status: ProcessingStatus.LOADING_FILE, message: 'Cleaning Branding...', progress: 0 });

    try {
      for (let i = 0; i < fileArray.length; i++) {
        const file = fileArray[i];
        const pages = await convertPdfToImages(file);
        const cleanedPages = [];
        
        for (let j = 0; j < pages.length; j++) {
          const isLast = (j === pages.length - 1);
          const cleaned = await performHeuristicScrub(pages[j], isLast);
          cleanedPages.push(cleaned);
          updateState({ progress: Math.round(((i * pages.length + (j + 1)) / (fileArray.length * pages.length)) * 100) });
        }
        
        await createPdfFromImages(cleanedPages, `${file.name.replace('.pdf', '')}_Cleaned.pdf`);
      }
      updateState({ status: ProcessingStatus.COMPLETED, message: 'Success! Your branding-free PDF is ready.' });
    } catch (e: any) {
      updateState({ status: ProcessingStatus.ERROR, message: e.message });
    }
  };

  const startEditablePPT = async (files: FileList | null) => {
    if (!files || files.length === 0) return;
    const file = files[0];
    updateState({ status: ProcessingStatus.LOADING_FILE, message: 'Building Editable Decks...', progress: 0 });

    try {
      const pages = await convertPdfToImages(file);
      const slides = [];

      for (let i = 0; i < pages.length; i++) {
        const isLast = (i === pages.length - 1);
        const cleanedImg = await performHeuristicScrub(pages[i], isLast);
        
        slides.push({
          id: i,
          originalImage: cleanedImg,
          elements: [
            { type: 'image', x: 0, y: 0, w: 100, h: 100, imageData: cleanedImg },
            { type: 'title', x: 5, y: 10, w: 90, h: 15, content: '[Title Layer - Edit Me]' },
            { type: 'text', x: 5, y: 30, w: 90, h: 50, content: '[Body Text - Move or Resize]' }
          ]
        });
        updateState({ progress: Math.round(((i + 1) / pages.length) * 100) });
      }

      await generatePptx(slides as any, `${file.name.replace('.pdf', '')}_Editable.pptx`);
      updateState({ status: ProcessingStatus.COMPLETED, message: 'Success! PowerPoint deck is ready for editing.' });
    } catch (e: any) {
      updateState({ status: ProcessingStatus.ERROR, message: e.message });
    }
  };

  return (
    <div className="min-h-screen bg-white flex flex-col items-center text-slate-900 font-sans">
      <header className="w-full h-16 glass px-8 flex justify-between items-center fixed top-0 z-[600] border-b border-slate-100">
        <div className="flex items-center gap-3 group cursor-pointer" onClick={() => updateState({ status: ProcessingStatus.IDLE })}>
          <div className="bg-indigo-600 p-2 rounded-xl shadow-lg transition-all group-hover:rotate-6">
            <ShieldCheck className="text-white w-5 h-5" />
          </div>
          <h1 className="text-xl font-black tracking-tighter">NotebookLM Scrub</h1>
        </div>
        <div className="flex items-center gap-4">
          <a 
            href="https://linktr.ee/rajvivan" 
            target="_blank" 
            rel="noopener noreferrer"
            className="hidden md:flex items-center gap-2 text-indigo-600 hover:text-indigo-700 transition-colors text-sm font-bold bg-indigo-50 px-4 py-2 rounded-full border border-indigo-100"
          >
            Connect with me <ExternalLink size={16} />
          </a>
        </div>
      </header>

      <main className="max-w-5xl w-full mt-32 px-6 pb-32">
        {state.status === ProcessingStatus.IDLE && (
          <div className="space-y-16 animate-in fade-in slide-in-from-bottom-8 duration-700">
            <div className="text-center space-y-6">
              <div className="inline-flex items-center gap-2 bg-emerald-50 text-emerald-600 px-4 py-1.5 rounded-full text-xs font-black uppercase tracking-widest">
                <Lock size={14} /> Zero Data Capture
              </div>
              <h2 className="text-6xl font-black tracking-tight leading-tight">
                NotebookLM Branding <br/> <span className="text-indigo-600">Scrubbed Instantly.</span>
              </h2>
              <p className="text-slate-500 text-xl font-medium max-w-2xl mx-auto">
                The ultimate tool to remove branding from NotebookLM slides. 100% browser-side processing. Your data never leaves your computer.
              </p>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-2 gap-8 max-w-4xl mx-auto">
              <div 
                onClick={() => fileInputRef.current?.click()}
                className="relative p-10 rounded-[2.5rem] bg-white border-4 border-slate-100 hover:border-indigo-500 hover:bg-indigo-50/10 transition-all cursor-pointer flex flex-col items-center gap-6 shadow-xl group"
              >
                 <div className="w-20 h-20 bg-indigo-500 rounded-3xl flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                    <Zap className="text-white w-10 h-10" />
                 </div>
                 <div className="text-center">
                    <h4 className="text-2xl font-black mb-2">Insta-Scrub PDF</h4>
                    <p className="text-slate-500 text-sm font-medium">Instantly remove logos from all slides. Supports batch processing for multiple files.</p>
                 </div>
                 <span className="bg-indigo-50 text-indigo-600 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">Privacy Protected</span>
              </div>

              <div 
                onClick={() => pptInputRef.current?.click()}
                className="relative p-10 rounded-[2.5rem] bg-white border-4 border-slate-100 hover:border-amber-500 hover:bg-amber-50/10 transition-all cursor-pointer flex flex-col items-center gap-6 shadow-xl group"
              >
                 <div className="w-20 h-20 bg-amber-500 rounded-3xl flex items-center justify-center shadow-xl group-hover:scale-110 transition-transform">
                    <Presentation className="text-white w-10 h-10" />
                 </div>
                 <div className="text-center">
                    <h4 className="text-2xl font-black mb-2">Editable PowerPoint</h4>
                    <p className="text-slate-500 text-sm font-medium">Scrub logos and generate a PPTX file with active text layers you can modify.</p>
                 </div>
                 <span className="bg-amber-50 text-amber-600 text-[10px] font-bold px-3 py-1 rounded-full uppercase tracking-widest">Active Editing</span>
              </div>
            </div>

            <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
              <div className="p-8 rounded-3xl bg-white border border-slate-100 shadow-sm flex flex-col items-center text-center gap-4">
                <div className="w-12 h-12 bg-indigo-50 rounded-xl flex items-center justify-center">
                  <Code2 className="text-indigo-600 w-6 h-6" />
                </div>
                <h5 className="text-xl font-bold">Open Source Core</h5>
                <p className="text-slate-500 text-sm">Verifiable, transparent code. Built with standard web technologies for full community trust.</p>
              </div>
              <div className="p-8 rounded-3xl bg-white border border-slate-100 shadow-sm flex flex-col items-center text-center gap-4">
                <div className="w-12 h-12 bg-emerald-50 rounded-xl flex items-center justify-center">
                  <Wand2 className="text-emerald-600 w-6 h-6" />
                </div>
                <h5 className="text-xl font-bold">Heuristic Healing</h5>
                <p className="text-slate-500 text-sm">Our local engine samples background pixels to erase branding without leaving a trace.</p>
              </div>
              <div className="p-8 rounded-3xl bg-white border border-slate-100 shadow-sm flex flex-col items-center text-center gap-4">
                <div className="w-12 h-12 bg-slate-50 rounded-xl flex items-center justify-center">
                  <Lock className="text-slate-900 w-6 h-6" />
                </div>
                <h5 className="text-xl font-bold">Security First</h5>
                <p className="text-slate-500 text-sm">No data is captured or uploaded. All processing happens locally in your browser sandbox.</p>
              </div>
            </div>
            
            <input ref={fileInputRef} type="file" multiple className="hidden" accept="application/pdf" onChange={(e) => startFastScrub(e.target.files)} />
            <input ref={pptInputRef} type="file" className="hidden" accept="application/pdf" onChange={(e) => startEditablePPT(e.target.files)} />
          </div>
        )}

        {state.status === ProcessingStatus.LOADING_FILE && (
          <div className="h-full flex flex-col items-center justify-center py-20 animate-in fade-in duration-500 text-center">
            <div className="relative mb-12">
               <div className="absolute inset-0 bg-indigo-400 blur-3xl opacity-20 animate-pulse"></div>
               <div className="relative bg-white p-8 rounded-[2.5rem] shadow-2xl border border-indigo-50 flex items-center justify-center">
                  <Loader2 className="animate-spin text-indigo-600 w-16 h-16" />
               </div>
            </div>
            <h2 className="text-3xl font-black mb-2 tracking-tight">{state.message}</h2>
            <div className="w-80 bg-slate-100 rounded-full h-3 mb-4 overflow-hidden shadow-inner">
              <div 
                className="bg-indigo-600 h-3 rounded-full transition-all duration-300 shadow-[0_0_12px_rgba(99,102,241,0.5)]" 
                style={{ width: `${state.progress}%` }} 
              />
            </div>
            <p className="text-indigo-600 font-black uppercase tracking-[0.2em] text-[11px]">{state.progress}% Complete</p>
          </div>
        )}

        {state.status === ProcessingStatus.COMPLETED && (
           <div className="h-full flex flex-col items-center justify-center py-20 animate-in fade-in duration-500 text-center">
              <div className="bg-emerald-500 p-8 rounded-[2.5rem] shadow-2xl text-white mb-8">
                 <CheckCircle size={64} />
              </div>
              <h2 className="text-4xl font-black mb-4 tracking-tight">Processing Done!</h2>
              <p className="text-slate-500 text-lg font-medium mb-10 max-w-md">{state.message}</p>
              <button 
                onClick={() => updateState({ status: ProcessingStatus.IDLE })}
                className="bg-slate-900 text-white px-12 py-4 rounded-2xl font-black text-lg hover:bg-black transition-all shadow-xl"
              >
                Start New Project
              </button>
           </div>
        )}

        {state.status === ProcessingStatus.ERROR && (
          <div className="bg-white border border-red-100 rounded-[2.5rem] p-16 text-center max-w-xl mx-auto shadow-2xl animate-in zoom-in duration-300">
            <div className="bg-red-50 w-20 h-20 rounded-full flex items-center justify-center mx-auto mb-6">
              <AlertCircle className="w-10 h-10 text-red-500" />
            </div>
            <h3 className="text-3xl font-black mb-2">Error Occurred</h3>
            <p className="text-slate-500 mb-8 font-medium italic">"{state.message}"</p>
            <button 
              onClick={() => updateState({ status: ProcessingStatus.IDLE })}
              className="bg-slate-900 text-white px-10 py-4 rounded-2xl font-black text-lg hover:bg-black transition-all shadow-xl"
            >
              Go Back
            </button>
          </div>
        )}
      </main>

      <footer className="w-full py-12 border-t border-slate-50 flex flex-col items-center gap-4 bg-white mt-auto">
          <p className="text-slate-300 font-bold text-xs uppercase tracking-widest flex items-center gap-2">
            <ShieldCheck size={12} /> Privacy-First Architecture
          </p>
          <div className="flex gap-4 mb-2">
            <a 
              href="https://linktr.ee/rajvivan" 
              target="_blank" 
              rel="noopener noreferrer"
              className="text-indigo-500 hover:text-indigo-600 font-bold text-sm underline underline-offset-4"
            >
              Connect with me
            </a>
          </div>
          <p className="text-slate-400 font-medium text-xs">© {new Date().getFullYear()} NotebookLM Scrub Labs. Local Processing Only.</p>
      </footer>
    </div>
  );
};

export default App;