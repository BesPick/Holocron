import * as React from 'react';
import type { Id } from '@/types/db';

interface ImageUploadSectionProps {
  imageIds: Id<'_storage'>[];
  canAddMore: boolean;
  uploadingImages: boolean;
  maxImages: number;
  imagePreviewMap: Map<string, string>;
  onFileSelect: (files: FileList | null) => void;
  onRemoveImage: (id: Id<'_storage'>) => void;
}

export function ImageUploadSection({
  imageIds,
  canAddMore,
  uploadingImages,
  maxImages,
  imagePreviewMap,
  onFileSelect,
  onRemoveImage,
}: ImageUploadSectionProps) {
  return (
    <div className='space-y-3 rounded-2xl border border-border bg-card/70 p-4'>
      <div className='flex items-center justify-between'>
        <p className='text-sm font-medium text-foreground'>Images</p>
        <span className='text-xs text-muted-foreground'>
          {imageIds.length}/{maxImages}
        </span>
      </div>
      <p className='text-xs text-muted-foreground'>
        Upload up to {maxImages} images to showcase this activity. Accepted formats: JPG, PNG, GIF, WEBP.
      </p>
      <label className='inline-flex w-full cursor-pointer flex-col gap-2 rounded-md border border-dashed border-border bg-card/60 px-3 py-4 text-center text-sm text-foreground transition hover:border-primary/60 hover:bg-primary/5'>
        <span className='font-medium'>
          {canAddMore ? 'Select images to upload' : 'Image limit reached'}
        </span>
        <input
          type='file'
          accept='image/*'
          multiple
          className='hidden'
          disabled={!canAddMore || uploadingImages}
          onChange={(event) => {
            onFileSelect(event.target.files);
            event.target.value = '';
          }}
        />
        <span className='text-xs text-muted-foreground'>
          {uploadingImages
            ? 'Uploading...'
            : canAddMore
              ? 'You can select multiple files at once.'
              : 'Remove an image to add another.'}
        </span>
      </label>
      {imageIds.length > 0 && (
        <div className='grid gap-3 sm:grid-cols-3'>
          {imageIds.map((storageId) => {
            const previewUrl = imagePreviewMap.get(storageId);
            return (
              <div
                key={storageId}
                className='relative overflow-hidden rounded-lg border border-border bg-card/80'
              >
                {previewUrl ? (
                  <>
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={previewUrl}
                      alt='Announcement attachment'
                      className='h-32 w-full object-cover'
                    />
                  </>
                ) : (
                  <div className='flex h-32 w-full items-center justify-center text-xs text-muted-foreground'>
                    Loading preview...
                  </div>
                )}
                <button
                  type='button'
                  onClick={() => onRemoveImage(storageId)}
                  className='absolute right-2 top-2 inline-flex items-center rounded-full border border-border bg-background/80 p-1 text-xs font-medium text-foreground shadow hover:bg-background'
                >
                  Remove
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
