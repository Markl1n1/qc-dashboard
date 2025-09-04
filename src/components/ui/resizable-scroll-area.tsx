import * as React from "react";
import { ScrollArea, ScrollBar } from "./scroll-area";
import { cn } from "@/lib/utils";
import { GripHorizontal } from "lucide-react";

interface ResizableScrollAreaProps {
  children: React.ReactNode;
  className?: string;
  defaultHeight?: number;
  minHeight?: number;
  maxHeight?: number;
  storageKey?: string;
}

const ResizableScrollArea = React.forwardRef<
  HTMLDivElement,
  ResizableScrollAreaProps
>(({
  children,
  className,
  defaultHeight = 384, // equivalent to h-96 (24rem = 384px)
  minHeight = 200,
  maxHeight = 800,
  storageKey,
  ...props
}, ref) => {
  const [height, setHeight] = React.useState(defaultHeight);
  const [isResizing, setIsResizing] = React.useState(false);
  const resizeRef = React.useRef<HTMLDivElement>(null);

  // Load saved height from localStorage
  React.useEffect(() => {
    if (storageKey) {
      const savedHeight = localStorage.getItem(`scroll-area-height-${storageKey}`);
      if (savedHeight) {
        const parsedHeight = parseInt(savedHeight, 10);
        if (parsedHeight >= minHeight && parsedHeight <= maxHeight) {
          setHeight(parsedHeight);
        }
      }
    }
  }, [storageKey, minHeight, maxHeight]);

  // Save height to localStorage
  React.useEffect(() => {
    if (storageKey) {
      localStorage.setItem(`scroll-area-height-${storageKey}`, height.toString());
    }
  }, [height, storageKey]);

  const handleMouseDown = React.useCallback((e: React.MouseEvent) => {
    e.preventDefault();
    setIsResizing(true);
    
    const startY = e.clientY;
    const startHeight = height;

    const handleMouseMove = (e: MouseEvent) => {
      const deltaY = e.clientY - startY;
      const newHeight = Math.min(maxHeight, Math.max(minHeight, startHeight + deltaY));
      setHeight(newHeight);
    };

    const handleMouseUp = () => {
      setIsResizing(false);
      document.removeEventListener('mousemove', handleMouseMove);
      document.removeEventListener('mouseup', handleMouseUp);
    };

    document.addEventListener('mousemove', handleMouseMove);
    document.addEventListener('mouseup', handleMouseUp);
  }, [height, minHeight, maxHeight]);

  return (
    <div 
      ref={ref}
      className={cn("relative", className)}
      {...props}
    >
      <ScrollArea 
        className="w-full border rounded-md"
        style={{ height: `${height}px` }}
      >
        {children}
        <ScrollBar />
      </ScrollArea>
      
      {/* Resize handle */}
      <div
        ref={resizeRef}
        className={cn(
          "absolute bottom-0 left-0 right-0 h-2 cursor-row-resize bg-border/50 hover:bg-border transition-colors flex items-center justify-center",
          isResizing && "bg-border"
        )}
        onMouseDown={handleMouseDown}
      >
        <GripHorizontal className="h-3 w-3 text-muted-foreground" />
      </div>
    </div>
  );
});

ResizableScrollArea.displayName = "ResizableScrollArea";

export { ResizableScrollArea };