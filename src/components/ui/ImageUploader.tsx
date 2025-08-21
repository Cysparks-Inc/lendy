import React, { useState, useRef, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogFooter } from '@/components/ui/dialog';
import { User, Upload, Camera, Check, X, Loader2 } from 'lucide-react';
import { toast } from 'sonner';

interface ImageUploaderProps {
  currentImageUrl?: string | null;
  onImageSelect: (file: File | null) => void;
  maxSize?: number; // Max file size in MB
  maxDimensions?: number; // Max width/height in pixels
  quality?: number; // JPEG quality (0.1 to 1.0)
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ 
  currentImageUrl, 
  onImageSelect, 
  maxSize = 5,
  maxDimensions = 512,
  quality = 0.8
}) => {
  const [previewUrl, setPreviewUrl] = useState<string | null>(currentImageUrl || null);
  const [isCameraOpen, setIsCameraOpen] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const videoRef = useRef<HTMLVideoElement>(null);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  // Update preview when currentImageUrl changes
  useEffect(() => {
    setPreviewUrl(currentImageUrl || null);
  }, [currentImageUrl]);

  // --- FIX: Use useEffect to safely handle the camera stream ---
  useEffect(() => {
    if (isCameraOpen) {
      const startStream = async () => {
        try {
          const stream = await navigator.mediaDevices.getUserMedia({ 
            video: { 
              width: { ideal: 1280 },
              height: { ideal: 720 }
            } 
          });
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

  const handleFileChange = async (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];
    if (!file) return;

    // Validate file size
    if (file.size > maxSize * 1024 * 1024) {
      toast.error(`File too large`, { 
        description: `Please select an image smaller than ${maxSize}MB` 
      });
      return;
    }

    // Validate file type
    if (!file.type.startsWith('image/')) {
      toast.error('Invalid file type', { 
        description: 'Please select a valid image file' 
      });
      return;
    }

    setIsProcessing(true);
    try {
      // Compress and process image
      const processedFile = await processImage(file);
      
      // Create preview URL
      const newPreviewUrl = URL.createObjectURL(processedFile);
      setPreviewUrl(newPreviewUrl);
      
      // Pass processed file to parent
      onImageSelect(processedFile);
      
      toast.success('Image processed successfully');
    } catch (error) {
      console.error('Error processing image:', error);
      toast.error('Failed to process image');
    } finally {
      setIsProcessing(false);
    }
  };

  // Image processing and compression
  const processImage = (file: File): Promise<File> => {
    return new Promise((resolve, reject) => {
      const canvas = document.createElement('canvas');
      const ctx = canvas.getContext('2d');
      const img = new Image();
      
      img.onload = () => {
        try {
          // Calculate new dimensions
          let { width, height } = img;
          
          if (width > height) {
            if (width > maxDimensions) {
              height = (height * maxDimensions) / width;
              width = maxDimensions;
            }
          } else {
            if (height > maxDimensions) {
              width = (width * maxDimensions) / height;
              height = maxDimensions;
            }
          }
          
          canvas.width = width;
          canvas.height = height;
          
          // Draw and compress
          ctx?.drawImage(img, 0, 0, width, height);
          
          canvas.toBlob(
            (blob) => {
              if (blob) {
                const processedFile = new File([blob], file.name, {
                  type: 'image/jpeg',
                  lastModified: Date.now(),
                });
                resolve(processedFile);
              } else {
                reject(new Error('Failed to process image'));
              }
            },
            'image/jpeg',
            quality
          );
        } catch (error) {
          reject(error);
        }
      };
      
      img.onerror = () => reject(new Error('Failed to load image'));
      img.src = URL.createObjectURL(file);
    });
  };

  const captureImage = async () => {
    if (videoRef.current && canvasRef.current) {
      setIsProcessing(true);
      try {
        const context = canvasRef.current.getContext('2d');
        if (context) {
          canvasRef.current.width = videoRef.current.videoWidth;
          canvasRef.current.height = videoRef.current.videoHeight;
          context.drawImage(videoRef.current, 0, 0, videoRef.current.videoWidth, videoRef.current.videoHeight);
          
          canvasRef.current.toBlob(async (blob) => {
            if (blob) {
              try {
                const file = new File([blob], `capture-${Date.now()}.jpg`, { type: 'image/jpeg' });
                const processedFile = await processImage(file);
                
                const newPreviewUrl = URL.createObjectURL(processedFile);
                setPreviewUrl(newPreviewUrl);
                onImageSelect(processedFile);
                
                setIsCameraOpen(false);
                toast.success('Photo captured and processed successfully');
              } catch (error) {
                console.error('Error processing captured image:', error);
                toast.error('Failed to process captured image');
              }
            }
            setIsProcessing(false);
          }, 'image/jpeg', quality);
        }
      } catch (error) {
        console.error('Error capturing image:', error);
        toast.error('Failed to capture image');
        setIsProcessing(false);
      }
    }
  };

  return (
    <div className="flex flex-col items-center gap-4">
      <div className="relative">
        <div className="h-32 w-32 rounded-full bg-secondary flex items-center justify-center overflow-hidden border">
          {previewUrl ? (
            <img src={previewUrl} alt="Profile preview" className="h-full w-full object-cover" />
          ) : (
            <User className="h-16 w-16 text-muted-foreground" />
          )}
        </div>
        {isProcessing && (
          <div className="absolute inset-0 bg-black/50 rounded-full flex items-center justify-center">
            <Loader2 className="h-8 w-8 animate-spin text-white" />
          </div>
        )}
      </div>
      
      <div className="flex gap-2">
        <input 
          type="file" 
          accept="image/*" 
          ref={fileInputRef} 
          onChange={handleFileChange} 
          className="hidden" 
        />
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => fileInputRef.current?.click()}
          disabled={isProcessing}
          className="flex items-center gap-2"
        >
          <Upload className="h-4 w-4" />
          {isProcessing ? 'Processing...' : 'Upload'}
        </Button>
        <Button 
          type="button" 
          variant="outline" 
          onClick={() => setIsCameraOpen(true)}
          disabled={isProcessing}
          className="flex items-center gap-2"
        >
          <Camera className="h-4 w-4" />
          Camera
        </Button>
      </div>

      <Dialog open={isCameraOpen} onOpenChange={setIsCameraOpen}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Take a Photo</DialogTitle>
          </DialogHeader>
          <video ref={videoRef} autoPlay playsInline className="w-full rounded-md bg-black" />
          <canvas ref={canvasRef} className="hidden" />
          <DialogFooter>
            <Button variant="outline" onClick={() => setIsCameraOpen(false)}>
              <X className="mr-2 h-4 w-4" /> Cancel
            </Button>
            <Button onClick={captureImage} disabled={isProcessing}>
              {isProcessing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <Check className="mr-2 h-4 w-4" />
              )}
              {isProcessing ? 'Processing...' : 'Capture'}
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </div>
  );
};