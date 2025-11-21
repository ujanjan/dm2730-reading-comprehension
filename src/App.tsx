import React, { useState, useRef, useEffect } from 'react';
import { ReadingComprehension, ReadingComprehensionHandle } from './components/ReadingComprehension';
import { CursorTracker, CursorData } from './components/CursorTracker';
import { CursorTrackingData } from './components/CursorTrackingData';
import { CursorHeatmap, CursorHeatmapHandle } from './components/CursorHeatmap';
//import { RealtimeCursorIndicator } from './components/RealtimeCursorIndicator';
import { Button } from './components/ui/button';
import { Card } from './components/ui/card';
import { MousePointer2, MousePointerClick, PanelRightClose, PanelRightOpen } from 'lucide-react';
import { toCanvas } from 'html-to-image';
import { getPassages } from './services/passageService';
import { Passage } from './types/passage';

export default function App() {
  const [passages, setPassages] = useState<Passage[]>([]);
  const [currentPassageIndex, setCurrentPassageIndex] = useState(0);
  const currentPassage = passages[currentPassageIndex];
  const [trackingEnabled, setTrackingEnabled] = useState(false);
  const [cursorHistory, setCursorHistory] = useState<CursorData[]>([]);
  const [showHeatmap, setShowHeatmap] = useState(true);
  const [screenshot, setScreenshot] = useState<string | null>(null);
  const [showSidebar, setShowSidebar] = useState(false);
  const [quizComplete, setQuizComplete] = useState(false);
  //const [showRealtimeIndicator, setShowRealtimeIndicator] = useState(true);

  // 🔹 Ref to control the CursorHeatmap (for saving image)
  const heatmapRef = useRef<CursorHeatmapHandle | null>(null);
  // 🔹 Ref to control the ReadingComprehension component
  const readingComprehensionRef = useRef<ReadingComprehensionHandle | null>(null);
  // 🔹 Ref to the passage container for CursorHeatmap
  const passageRef = useRef<HTMLDivElement | null>(null);

  const handleCursorData = (data: CursorData) => {
    setCursorHistory(prev => [...prev, data]);
  };

  const clearCursorHistory = () => {
    setCursorHistory([]);
  };

  // Load passages on mount
  useEffect(() => {
    getPassages().then(setPassages);
  }, []);

  // Sync passageRef with ReadingComprehension's passage element
  useEffect(() => {
    const element = readingComprehensionRef.current?.getPassageElement();
    if (element) {
      passageRef.current = element;
    }
  });

  const handleToggleTracking = () => {
    if (trackingEnabled) {
      // When stopping, just stop tracking (button will show "Restart The Quiz")
      setTrackingEnabled(false);
    } else {
      // When starting fresh
      setTrackingEnabled(true);
    }
  };

  const handleRestartQuiz = () => {
    // Reset the quiz component state
    if (readingComprehensionRef.current) {
      readingComprehensionRef.current.reset();
    }
    // Clear cursor history
    setCursorHistory([]);
    // Reset quiz completion state
    setQuizComplete(false);
    // Clear screenshot
    setScreenshot(null);
    // Start tracking again
    setTrackingEnabled(true);
    // Update passageRef after reset
    setTimeout(() => {
      const element = readingComprehensionRef.current?.getPassageElement();
      if (element) {
        passageRef.current = element;
      }
    }, 0);
  };

  const handleCaptureScreenshot = async (): Promise<string | null> => {
    const passageElement = readingComprehensionRef.current?.getPassageElement();
    if (!passageElement) {
      return null;
    }

    try {
      // OPTIMIZATION: Limit pixel ratio to reduce image size
      // Use max 1.5x instead of full device pixel ratio (which can be 2-3x on retina)
      // This significantly reduces file size while maintaining readability
      const pixelRatio = Math.min(window.devicePixelRatio || 1, 1.5);
      const rect = passageElement.getBoundingClientRect();
      
      // Capture using html-to-image (supports oklch natively)
      const canvas = await toCanvas(passageElement, {
        backgroundColor: '#ffffff',
        pixelRatio: pixelRatio,
      });

      // If heatmap is visible, composite it onto the screenshot
      if (showHeatmap && heatmapRef.current) {
        const heatmapCanvas = heatmapRef.current.getCanvas();
        if (heatmapCanvas) {
          const ctx = canvas.getContext('2d');
          if (ctx) {
            // The heatmap canvas is already sized to match the container exactly
            // and contains only container-relative coordinates (0,0 to width,height)
            // So we can draw it directly without cropping
            
            // However, we need to account for pixel ratio differences
            // The screenshot canvas might be at a different scale than the heatmap canvas
            const screenshotWidth = canvas.width;
            const screenshotHeight = canvas.height;
            const heatmapWidth = heatmapCanvas.width;
            const heatmapHeight = heatmapCanvas.height;
            
            // Save the current context state
            ctx.save();
            
            // Apply the heatmap opacity (0.6) when compositing
            ctx.globalAlpha = 0.6;
            
            // Draw the entire heatmap canvas onto the screenshot
            // Scale it to match the screenshot dimensions exactly
            ctx.drawImage(
              heatmapCanvas,
              0, 0, heatmapWidth, heatmapHeight, // Source: entire heatmap canvas
              0, 0, screenshotWidth, screenshotHeight // Destination: full screenshot canvas
            );
            
            // Restore the context state
            ctx.restore();
          }
        }
      }

      // OPTIMIZATION: Use JPEG instead of PNG for much smaller file size
      // Quality 0.85 provides good balance between quality and file size
      // PNG: ~500KB-2MB, JPEG (0.85): ~50-150KB (10-20x smaller!)
      const dataUrl = canvas.toDataURL('image/jpeg', 0.85);
      
      // Log size for monitoring
      const sizeKB = Math.round((dataUrl.length * 0.75) / 1024); // Approximate base64 to bytes
      console.log(`📸 Screenshot captured: ${sizeKB}KB (JPEG quality 0.85, pixelRatio ${pixelRatio.toFixed(1)})`);
      
      setScreenshot(dataUrl);
      return dataUrl;
    } catch (error) {
      console.error('Failed to capture screenshot:', error);
      alert('Failed to capture screenshot. Check console for details.');
      return null;
    }
  };

  // Loading state
  if (!currentPassage) {
    return (
      <div className="h-screen bg-gray-50 p-4 flex items-center justify-center">
        <p className="text-gray-600">Loading passage...</p>
      </div>
    );
  }

  return (
    <div className="h-screen bg-gray-50 p-4 flex flex-col">
      <div className="max-w-[1600px] mx-auto w-full flex flex-col flex-1 min-h-0">
        <div className="mb-3 flex items-start justify-between flex-shrink-0">
          <div>
            <h1 className="text-gray-900">Reading Comprehension</h1>
            <p className="text-gray-600 text-sm">
              Read the passage carefully and answer the questions below.
            </p>
          </div>
          
          <div className="flex items-center gap-2">
            <Button
              variant={trackingEnabled ? 'outline' : 'default'}
              size="sm"
              onClick={trackingEnabled ? handleToggleTracking : ((quizComplete || cursorHistory.length > 0) ? handleRestartQuiz : handleToggleTracking)}
              className="text-xs"
            >
              {trackingEnabled ? (
                <>
                  <MousePointerClick className="h-4 w-4 mr-1" />
                  Stop The Quiz
                </>
              ) : (quizComplete || cursorHistory.length > 0) ? (
                <>
                  <MousePointer2 className="h-4 w-4 mr-1" />
                  Restart The Quiz
                </>
              ) : (
                <>
                  <MousePointer2 className="h-4 w-4 mr-1" />
                  Start The Quiz
                </>
              )}
            </Button>
            
            <Button
              variant="outline"
              size="sm"
              onClick={() => setShowSidebar(!showSidebar)}
              className="text-xs"
              title={showSidebar ? 'Hide sidebar' : 'Show sidebar'}
            >
              {showSidebar ? (
                <PanelRightClose className="h-4 w-4" />
              ) : (
                <PanelRightOpen className="h-4 w-4" />
              )}
            </Button>
          </div>
        </div>
        
        <div className="flex-1 min-h-0 flex gap-3 min-w-0">
          <div className="flex-1 min-h-0 min-w-0">
            <ReadingComprehension
              ref={readingComprehensionRef}
              title={currentPassage.title}
              passage={currentPassage.text}
              questions={currentPassage.questions}
              cursorHistory={cursorHistory}
              screenshot={screenshot}
              onCaptureScreenshot={handleCaptureScreenshot}
              onQuizComplete={() => {
                setTrackingEnabled(false);
                setQuizComplete(true);
              }}
              trackingEnabled={trackingEnabled}
            />
          </div>
          
          {showSidebar && (
            <div className="w-80 flex-shrink-0">
              <CursorTrackingData
                cursorHistory={cursorHistory}
                onClear={clearCursorHistory}
                screenshot={screenshot}
                showHeatmap={showHeatmap}
                onToggleHeatmap={() => setShowHeatmap(!showHeatmap)}
                onSaveHeatmap={() => heatmapRef.current?.saveImage()}
                onSaveScreenshot={handleCaptureScreenshot}
                heatmapRef={heatmapRef}
                title={currentPassage.title}
                passage={currentPassage.text}
              />
            </div>
          )}
        </div>
      </div>

      <CursorTracker 
        onCursorData={handleCursorData}
        enabled={trackingEnabled}
      />

      {trackingEnabled && showHeatmap && (
        <CursorHeatmap 
          ref={heatmapRef}
          cursorHistory={cursorHistory}
          opacity={0.6}
          radius={40}
          containerRef={passageRef}
        />
      )}
    </div>
  );
}
