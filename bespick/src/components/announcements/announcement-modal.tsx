'use client';

import * as React from 'react';
import { useQuery } from 'convex/react';
import { X } from 'lucide-react';
import { api } from '../../../convex/_generated/api';
import type { Doc } from '../../../convex/_generated/dataModel';
import {
  formatCreator,
  formatDate,
  formatEventType,
} from '@/lib/announcements';

type Announcement = Doc<'announcements'>;

type AnnouncementModalProps = {
  announcement: Announcement;
  onClose: () => void;
};

export function AnnouncementModal({
  announcement,
  onClose,
}: AnnouncementModalProps) {
  const [previewImage, setPreviewImage] = React.useState<string | null>(null);
  const description = React.useMemo(
    () => (announcement.description ?? '').replace(/\r\n/g, '\n'),
    [announcement.description],
  );
  const imageUrls = useQuery(
    api.storage.getImageUrls,
    announcement.imageIds && announcement.imageIds.length
      ? { ids: announcement.imageIds }
      : 'skip',
  );

  React.useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (previewImage) {
          setPreviewImage(null);
          return;
        }
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, previewImage]);

  const hasDescription = description.trim().length > 0;

  return (
    <>
      <div
        className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6'
        role='dialog'
        aria-modal='true'
        onClick={onClose}
      >
        <div
          className='w-full max-w-2xl rounded-2xl border border-border bg-card p-6 shadow-2xl'
          onClick={(event) => event.stopPropagation()}
        >
          <div className='flex items-start justify-between gap-4'>
            <div>
              <p className='text-xs font-medium uppercase tracking-wide text-primary'>
                {formatEventType(announcement.eventType)}
              </p>
              <h2 className='mt-1 text-2xl font-semibold text-foreground'>
                {announcement.title}
              </h2>
              <p className='mt-2 text-xs text-muted-foreground'>
                Published {formatDate(announcement.publishAt)}
              </p>
              {announcement.updatedAt && announcement.updatedBy && (
                <p className='mt-1 text-xs text-muted-foreground'>
                  Updated by {formatCreator(announcement.updatedBy)} on{' '}
                  {formatDate(announcement.updatedAt)}
                </p>
              )}
            </div>
            <button
              type='button'
              onClick={onClose}
              className='rounded-full border border-border p-2 text-muted-foreground transition hover:text-foreground'
              aria-label='Close announcement'
            >
              <X className='h-4 w-4' aria-hidden='true' />
            </button>
          </div>

          <div className='mt-6 max-h-[60vh] overflow-y-auto pr-1'>
            {hasDescription ? (
              <p className='whitespace-pre-wrap text-sm leading-relaxed text-foreground'>
                {description}
              </p>
            ) : (
              <p className='text-sm italic text-muted-foreground'>
                No description provided.
              </p>
            )}
            {imageUrls && imageUrls.length > 0 && (
              <div className='mt-4 grid gap-3 sm:grid-cols-2'>
                {imageUrls.map((image) => (
                  <button
                    type='button'
                    key={image.id}
                    onClick={() => setPreviewImage(image.url)}
                    className='group relative overflow-hidden rounded-lg focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                  >
                    {/* eslint-disable-next-line @next/next/no-img-element */}
                    <img
                      src={image.url}
                      alt='Announcement image'
                      className='h-48 w-full object-cover transition duration-200 group-hover:scale-105'
                    />
                    <span className='sr-only'>View full-size image</span>
                  </button>
                ))}
              </div>
            )}
          </div>
        </div>
      </div>
      {previewImage && (
        <div
          className='fixed inset-0 z-60 flex items-center justify-center bg-black/80 px-4 py-6'
          role='dialog'
          aria-modal='true'
          onClick={() => setPreviewImage(null)}
        >
          <div
            className='max-h-[90vh] w-full max-w-4xl'
            onClick={(event) => event.stopPropagation()}
          >
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={previewImage}
              alt='Full-size announcement image'
              className='h-full w-full rounded-xl object-contain'
            />
            <p className='mt-2 text-center text-xs text-muted-foreground'>
              Click outside or press Escape to close.
            </p>
          </div>
        </div>
      )}
    </>
  );
}
