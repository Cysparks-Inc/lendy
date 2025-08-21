import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { User, Upload, Camera, Check, X } from 'lucide-react';

interface ImageUploaderProps {
  currentImageUrl?: string | null;
  onImageSelect: (file: File | null) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ currentImageUrl, onImageSelect }) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // --- FIX: Use useEffect to safely handle the camera stream ---
  useEffect(() => {
    if (isCameraOpen) {
      const startStream = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ video: true });
          streamRef.current = stream;
          if (videoRef.current) {
            videoRef.current.srcObject = stream;
          }
        } catch (err) {
          console.error("Camera access denied:", err);
          toast.error("Camera access was denied", {
            description: "Please allow camera access in your browser settings to use this feature.",
          });
          setIsCameraOpen(false);
        }
      };
      startStream();
    }
    
    // Cleanup function to stop the camera when the dialog closes or component unmounts
    return () => {
      if (streamRef.current) {
        streamRef.current.getTracks().forEach(track => track.stop());
      }
    };
  }, [isCameraOpen]); // This effect runs only when `isCameraOpen` changes

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (file) {
      const newPreviewUrl = URL.createObjectURL(file);
      setPreviewUrl(newPreviewUrl);
      onImageSelect(file);
    }
  };

  const captureImage = () => {
    if (videoRef.current && canvasRef.current) {
      const context = canvasRef.current.getContext('2d');
      if (context) {
        canvasRef.current.width = videoRef.current.videoWidth;
        canvasRef.current.height = videoRef.current.videoHeight;
        context.drawImage(videoRef.current, 0, 0, videoRef.current.videoWidth, videoRef.current.videoHeight);
        
        canvasRef.current.toBlob((blob) => {
          if (blob) {
            const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
            setPreviewUrl(URL.createObjectURL(file));
            onImageSelect(file);
            setIsCameraOpen(false); // This will trigger the useEffect cleanup
          }
        }, 'image/jpeg');
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="h-32 w-32 rounded-full bg-secondary flex items-center justify-center overflow-hidden border">
        {previewUrl ? (
          <img src={previewUrl} alt="Profile preview" className="h-full w-full object-cover" />
        ) : (
          <User className="h-16 w-16 text-muted-foreground" />
        )}
      </div>
      <div className="flex gap-2">
        <input type="file" accept="image/*" ref={fileInputRef} onChange={handleFileChange} className="hidden" />
        <Button type="button" variant="outline" onClick={() => fileInputRef.current?.click()}><Upload className="mr-2 h-4 w-4" /> Upload</Button>
        <Button type="button" variant="outline" onClick={() => setIsCameraOpen(true)}><Camera className="mr-2 h-4 w-4" /> Camera</Button>
      </div>

      <Dialog open={isCameraOpen} onOpenChange={setIsCameraOpen}>
        <DialogContent>
          <DialogHeader><DialogTitle>Take a Photo</DialogTitle></DialogHeader>
          {/* The video element is now guaranteed to exist before the stream is attached */}
          <video ref={videoRef} autoPlay playsInline className="w-full rounded-md bg-black" />
          <canvas ref={canvasRef} className="hidden" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCameraOpen(false)}><X className="mr-2 h-4 w-4" /> Cancel</Button>
            <Button onClick={captureImage}><Check className="mr-2 h-4 w-4" /> Capture</Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};