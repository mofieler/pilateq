'use client';

import { useState, useRef, useCallback, useEffect } from 'react';
import { createPortal } from 'react-dom';
import { useSession } from 'next-auth/react';
import { useRouter } from 'next/navigation';
import { Camera, Loader2, Trash2 } from 'lucide-react';
import { toast } from 'sonner';
import Cropper from 'react-easy-crop';
import { UserAvatar } from './UserAvatar';
import { Button } from '@/components/ui/button';

interface AvatarUploaderProps {
  name: string;
  currentAvatarUrl?: string | null;
  /** Called whenever the fullscreen crop overlay opens or closes. */
  onCroppingChange?: (isCropping: boolean) => void;
}

const MAX_FILE_SIZE_MB = 5;
const ALLOWED_TYPES = ['image/jpeg', 'image/png', 'image/webp'];

export function AvatarUploader({ name, currentAvatarUrl, onCroppingChange }: AvatarUploaderProps) {
  const { update } = useSession();
  const router = useRouter();
  const [avatarUrl, setAvatarUrl] = useState(currentAvatarUrl);
  const [isUploading, setIsUploading] = useState(false);
  const [isDeleting, setIsDeleting] = useState(false);
  const [progress, setProgress] = useState(0);
  const inputRef = useRef<HTMLInputElement>(null);
  const [mounted, setMounted] = useState(false);

  // Sync local state when parent prop changes (e.g. after router.refresh())
  useEffect(() => {
    setAvatarUrl(currentAvatarUrl);
  }, [currentAvatarUrl]);

  // Crop & image states
  const [selectedImage, setSelectedImage] = useState<string | null>(null);
  const [selectedImageFile, setSelectedImageFile] = useState<File | null>(null);
  const [crop, setCrop] = useState({ x: 0, y: 0 });
  const [zoom, setZoom] = useState(1);
  const [croppedAreaPixels, setCroppedAreaPixels] = useState<{
    x: number;
    y: number;
    width: number;
    height: number;
  } | null>(null);

  useEffect(() => {
    setMounted(true);
  }, []);

  // Notify parent whenever crop overlay opens/closes
  useEffect(() => {
    onCroppingChange?.(selectedImage !== null);
  }, [selectedImage, onCroppingChange]);

  // Close on Escape key — only while the crop modal is open
  useEffect(() => {
    if (!selectedImage) return;
    function onKeyDown(e: KeyboardEvent) {
      if (e.key === 'Escape') handleCancelCrop();
    }
    document.addEventListener('keydown', onKeyDown);
    return () => document.removeEventListener('keydown', onKeyDown);
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedImage]);

  const handleFileSelect = useCallback(
    async (e: React.ChangeEvent<HTMLInputElement>) => {
      const file = e.target.files?.[0];
      if (!file) return;

      if (!ALLOWED_TYPES.includes(file.type)) {
        toast.error('Please select a JPEG, PNG, or WebP image.');
        return;
      }
      if (file.size > MAX_FILE_SIZE_MB * 1024 * 1024) {
        toast.error(`File too large. Maximum size is ${MAX_FILE_SIZE_MB} MB.`);
        return;
      }

      setSelectedImageFile(file);
      const reader = new FileReader();
      reader.onload = () => {
        setSelectedImage(reader.result as string);
      };
      reader.readAsDataURL(file);
    },
    [],
  );

  const handleCancelCrop = useCallback(() => {
    setSelectedImage(null);
    setSelectedImageFile(null);
    setCrop({ x: 0, y: 0 });
    setZoom(1);
    setCroppedAreaPixels(null);
    if (inputRef.current) {
      inputRef.current.value = '';
    }
  }, []);

  const onCropComplete = useCallback((_croppedArea: unknown, croppedAreaPx: { x: number; y: number; width: number; height: number }) => {
    setCroppedAreaPixels(croppedAreaPx);
  }, []);

  const handleUpload = useCallback(async () => {
    if (!selectedImageFile || !croppedAreaPixels) return;

    setIsUploading(true);
    setProgress(0);

    const fileToUpload = selectedImageFile;
    const cropCoords = croppedAreaPixels;

    // Close crop overlay before network request
    handleCancelCrop();

    try {
      const formData = new FormData();
      formData.append('file', fileToUpload);
      formData.append('cropX', cropCoords.x.toString());
      formData.append('cropY', cropCoords.y.toString());
      formData.append('cropWidth', cropCoords.width.toString());
      formData.append('cropHeight', cropCoords.height.toString());

      const xhr = new XMLHttpRequest();

      const uploadPromise = new Promise<{ success: boolean; avatarUrl?: string; error?: string }>(
        (resolve, reject) => {
          xhr.upload.addEventListener('progress', (event) => {
            if (event.lengthComputable) {
              setProgress(Math.round((event.loaded / event.total) * 100));
            }
          });

          xhr.addEventListener('load', () => {
            if (xhr.status >= 200 && xhr.status < 300) {
              resolve(JSON.parse(xhr.responseText));
            } else {
              reject(new Error('Upload failed'));
            }
          });

          xhr.addEventListener('error', () => reject(new Error('Network error')));
          xhr.addEventListener('abort', () => reject(new Error('Upload aborted')));

          xhr.open('POST', '/api/upload/avatar');
          xhr.send(formData);
        },
      );

      const result = await uploadPromise;

      if (result.success && result.avatarUrl) {
        setAvatarUrl(result.avatarUrl);
        await update({ image: result.avatarUrl });
        router.refresh();
        toast.success('Profile picture updated!');
      } else {
        toast.error(result.error ?? 'Upload failed. Please try again.');
      }
    } catch (err) {
      console.error('[AvatarUploader] Upload error:', err);
      toast.error('Upload failed. Please try again.');
    } finally {
      setIsUploading(false);
      setProgress(0);
    }
  }, [selectedImageFile, croppedAreaPixels, handleCancelCrop, update, router]);

  const handleDelete = useCallback(async () => {
    if (!avatarUrl) return;
    setIsDeleting(true);
    try {
      const res = await fetch('/api/upload/avatar', { method: 'DELETE' });
      const result = await res.json();
      if (result.success) {
        setAvatarUrl(null);
        await update({ image: null });
        router.refresh();
        toast.success('Profile picture removed.');
      } else {
        toast.error(result.error ?? 'Failed to remove photo.');
      }
    } catch (err) {
      console.error('[AvatarUploader] Delete error:', err);
      toast.error('Failed to remove photo.');
    } finally {
      setIsDeleting(false);
    }
  }, [avatarUrl, update, router]);

  return (
    <div className="flex flex-col items-center gap-3">
      <div className="relative">
        <UserAvatar name={name} avatarUrl={avatarUrl} size="xl" />

        {isUploading && (
          <div className="absolute inset-0 flex items-center justify-center rounded-full bg-black/40">
            <span className="text-xs font-semibold text-white">{progress}%</span>
          </div>
        )}

        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={isUploading || isDeleting}
          className="absolute -bottom-1 -right-1 inline-flex size-8 items-center justify-center rounded-full bg-[#4e2b22] text-[#faf9f7] shadow-md transition-transform hover:scale-110 disabled:opacity-50 cursor-pointer"
          title="Change profile picture"
          aria-label="Change profile picture"
        >
          {isUploading ? <Loader2 className="size-4 animate-spin" aria-hidden /> : <Camera className="size-4" aria-hidden />}
        </button>
      </div>

      <input
        ref={inputRef}
        type="file"
        accept="image/jpeg,image/png,image/webp"
        onChange={handleFileSelect}
        className="hidden"
      />

      <p className="text-xs text-[#8b6b5c]">
        JPEG, PNG, or WebP · Max {MAX_FILE_SIZE_MB} MB
      </p>

      {avatarUrl && (
        <button
          type="button"
          onClick={handleDelete}
          disabled={isDeleting}
          className="inline-flex items-center gap-1 text-[11px] font-medium text-[#c45c4a] hover:text-red-700 transition-colors disabled:opacity-50"
        >
          {isDeleting ? <Loader2 className="size-3 animate-spin" /> : <Trash2 className="size-3" />}
          Remove photo
        </button>
      )}

      {/* Fullscreen Crop Overlay — rendered in document.body portal */}
      {selectedImage && mounted && createPortal(
        /*
         * stopPropagation on the wrapper prevents any pointer event from the
         * crop overlay from bubbling to the NavProfileMenu's outside-click
         * listener — belt-and-suspenders alongside the onCroppingChange flag.
         */
        <div
          className="fixed inset-0 z-[100] flex flex-col items-center justify-center bg-black/95 p-4 sm:p-6 backdrop-blur-md"
          onMouseDown={(e) => e.stopPropagation()}
          onTouchStart={(e) => e.stopPropagation()}
          onPointerDown={(e) => e.stopPropagation()}
        >
          {/* Header */}
          <div className="mb-4 text-center">
            <h3 className="text-lg font-bold text-[#faf9f7]">Position and Size Your Photo</h3>
            <p className="text-xs text-neutral-400 mt-1">Drag to position · Scroll or slide to zoom · Esc to cancel</p>
          </div>

          {/* Cropper Container */}
          <div className="relative w-full max-w-sm aspect-square bg-neutral-950 rounded-2xl overflow-hidden shadow-2xl border border-neutral-800">
            <Cropper
              image={selectedImage}
              crop={crop}
              zoom={zoom}
              aspect={1}
              cropShape="round"
              showGrid={false}
              onCropChange={setCrop}
              onZoomChange={setZoom}
              onCropComplete={onCropComplete}
            />
          </div>

          {/* Zoom controls */}
          <div className="w-full max-w-sm mt-5 flex flex-col gap-2 px-2">
            <div className="flex justify-between text-xs font-medium text-neutral-400">
              <span>Zoom</span>
              <span>{zoom.toFixed(1)}x</span>
            </div>
            <input
              type="range"
              value={zoom}
              min={1}
              max={3}
              step={0.1}
              aria-label="Zoom"
              onChange={(e) => setZoom(Number(e.target.value))}
              className="w-full accent-[#c4a88a] h-1.5 bg-neutral-800 rounded-lg appearance-none cursor-pointer"
            />
          </div>

          {/* Action buttons */}
          <div className="w-full max-w-sm mt-6 flex gap-3 px-2">
            <Button
              type="button"
              variant="outline"
              onClick={handleCancelCrop}
              className="flex-1 border-neutral-700 text-neutral-300 hover:bg-neutral-900 hover:text-white rounded-xl min-h-[44px]"
            >
              Cancel
            </Button>
            <Button
              type="button"
              onClick={handleUpload}
              className="flex-1 bg-[#c4a88a] text-[#4e2b22] hover:bg-[#b5997b] font-semibold rounded-xl min-h-[44px]"
            >
              Apply Crop
            </Button>
          </div>
        </div>,
        document.body,
      )}
    </div>
  );
}
