'use client';

import { usePathname, useRouter } from 'next/navigation';

export const SearchUsers = () => {
  const router = useRouter();
  const pathname = usePathname();

  return (
    <div className='space-y-3'>
      <h2 className='text-xl font-semibold text-foreground'>Find a user</h2>
      <p className='text-sm text-muted-foreground'>
        Search by name or email to view and manage a user&apos;s role and data.
      </p>
      <form
        onSubmit={(e) => {
          e.preventDefault();
          const form = e.currentTarget;
          const formData = new FormData(form);
          const queryTerm = formData.get('search') as string;
          const params = new URLSearchParams();
          if (queryTerm?.trim()) {
            params.set('search', queryTerm.trim());
          }
          const query = params.toString();
          router.push(query ? `${pathname}?${query}` : pathname);
        }}
        className='flex flex-col gap-3 sm:flex-row sm:items-end'
      >
        <label className='flex-1 text-sm text-foreground' htmlFor='search'>
          Search for users
          <input
            id='search'
            name='search'
            type='text'
            autoComplete='off'
            placeholder='Enter a name or email'
            className='mt-1 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
          />
        </label>
        <button
          type='submit'
          className='inline-flex items-center justify-center rounded-md border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background'
        >
          Search
        </button>
      </form>
    </div>
  );
};
