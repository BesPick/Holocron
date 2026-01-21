'use client';

type ActivityDescriptionProps = {
  text: string;
  imageCount?: number;
};

export function ActivityDescription({
  text,
  imageCount = 0,
}: ActivityDescriptionProps) {
  const formattedText = text.replace(/\r\n/g, '\n');
  const attachmentNotice = imageCount
    ? `(${imageCount} ${imageCount === 1 ? 'image' : 'images'} attached)`
    : null;

  return (
    <div className='mt-4 space-y-1'>
      <p
        className='text-sm leading-relaxed text-muted-foreground whitespace-pre-wrap wrap-break-word'
        style={{
          display: '-webkit-box',
          WebkitLineClamp: 2,
          WebkitBoxOrient: 'vertical',
          overflow: 'hidden',
        }}
      >
        {formattedText}
      </p>
      {attachmentNotice && (
        <p className='text-xs italic text-muted-foreground'>
          {attachmentNotice}
        </p>
      )}
    </div>
  );
}
