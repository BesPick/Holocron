'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import {
  PayPalButtons,
  PayPalScriptProvider,
  usePayPalScriptReducer,
  type PayPalButtonsComponentProps,
  type ReactPayPalScriptOptions,
} from '@paypal/react-paypal-js';
import { api } from '@/lib/api';
import { useApiMutation, useApiQuery } from '@/lib/apiClient';
import { formatCreator, formatDate, formatEventType } from '@/lib/announcements';
import type {
  FormDetails,
  SubmitFormArgs,
} from '@/server/services/announcements';
import type { FormQuestion } from '@/types/db';
import type { Id, StorageImage } from '@/types/db';
import { FormSubmissionsModal } from './form-submissions-modal';

type FormModalProps = {
  formId: Id<'announcements'>;
  onClose: () => void;
  isAdmin: boolean;
  canSubmit: boolean;
};

type PaymentState = {
  orderId: string | null;
  captured: boolean;
  error: string | null;
};

type PayPalPanelProps = {
  amount: number;
  description: string;
  referenceId: string;
  onPaid: (orderId: string) => void;
  onError: (message: string) => void;
};

function PayPalPanel({
  amount,
  description,
  referenceId,
  onPaid,
  onError,
}: PayPalPanelProps) {
  const paypalClientId = process.env.NEXT_PUBLIC_PAYPAL_CLIENT_ID;
  const paypalCurrency =
    process.env.NEXT_PUBLIC_PAYPAL_CURRENCY ?? 'USD';
  const paypalBuyerCountry =
    process.env.NEXT_PUBLIC_PAYPAL_BUYER_COUNTRY;

  const paypalOptions = React.useMemo<ReactPayPalScriptOptions>(
    () => ({
      clientId: paypalClientId ?? '',
      currency: paypalCurrency,
      intent: 'capture',
      ...(paypalBuyerCountry ? { buyerCountry: paypalBuyerCountry } : {}),
    }),
    [paypalBuyerCountry, paypalClientId, paypalCurrency],
  );

  const paypalButtonsProps = React.useMemo<PayPalButtonsComponentProps>(
    () => ({
      style: {
        layout: 'vertical',
        label: 'pay',
        shape: 'rect',
        height: 44,
      },
      async createOrder() {
        if (!paypalClientId) {
          onError('PayPal is not configured.');
          throw new Error('Missing PayPal client id');
        }
        const response = await fetch('/api/paypal/create-order', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({
            amount,
            description,
            referenceId,
            currency: paypalCurrency,
          }),
        });
        if (!response.ok) {
          const body = await response.json().catch(() => ({}));
          const message =
            typeof body?.error === 'string'
              ? body.error
              : 'Unable to start PayPal checkout.';
          onError(message);
          throw new Error(message);
        }
        const order = (await response.json()) as { id?: string };
        if (!order?.id) {
          const message = 'PayPal did not return an order id.';
          onError(message);
          throw new Error(message);
        }
        return order.id;
      },
      async onApprove(data) {
        try {
          const response = await fetch('/api/paypal/capture-order', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ orderId: data.orderID }),
          });
          if (!response.ok) {
            const body = await response.json().catch(() => ({}));
            const message =
              typeof body?.error === 'string'
                ? body.error
                : 'Unable to capture PayPal payment.';
            onError(message);
            return;
          }
          onPaid(data.orderID);
        } catch (error) {
          console.error('PayPal capture error', error);
          onError('PayPal checkout failed. Please try again.');
        }
      },
      onError() {
        onError('PayPal checkout failed. Please try again.');
      },
    }),
    [
      amount,
      description,
      referenceId,
      paypalClientId,
      paypalCurrency,
      onError,
      onPaid,
    ],
  );

  if (!paypalClientId) {
    return (
      <div className='rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
        PayPal is not configured. Set `NEXT_PUBLIC_PAYPAL_CLIENT_ID` to enable
        payments.
      </div>
    );
  }

  return (
    <PayPalScriptProvider deferLoading={false} options={paypalOptions}>
      <PayPalButtonsPanel paypalButtonsProps={paypalButtonsProps} />
    </PayPalScriptProvider>
  );
}

function PayPalButtonsPanel({
  paypalButtonsProps,
}: {
  paypalButtonsProps: PayPalButtonsComponentProps;
}) {
  const [{ isPending, isRejected }] = usePayPalScriptReducer();

  if (isRejected) {
    return (
      <p className='text-xs text-destructive'>
        PayPal failed to load. Disable blockers and refresh.
      </p>
    );
  }

  return (
    <div className='space-y-2'>
      {isPending && (
        <p className='text-xs text-muted-foreground'>
          Loading PayPal checkout...
        </p>
      )}
      <PayPalButtons
        {...paypalButtonsProps}
        style={{
          ...(paypalButtonsProps.style ?? {}),
          color: 'gold',
        }}
      />
    </div>
  );
}

export function FormModal({
  formId,
  onClose,
  isAdmin,
  canSubmit,
}: FormModalProps) {
  const form = useApiQuery<{ id: Id<'announcements'> }, FormDetails>(
    api.announcements.getForm,
    { id: formId },
    { liveKeys: ['announcements', 'formSubmissions'] },
  );
  const imageUrls = useApiQuery<
    { ids: Id<'_storage'>[] },
    StorageImage[]
  >(
    api.storage.getImageUrls,
    form?.imageIds && form.imageIds.length ? { ids: form.imageIds } : 'skip',
  );
  const submitForm = useApiMutation<SubmitFormArgs, { id: Id<'formSubmissions'> }>(
    api.announcements.submitForm,
  );

  const [previewImage, setPreviewImage] = React.useState<string | null>(null);
  const [showSubmissions, setShowSubmissions] = React.useState(false);
  const [answers, setAnswers] = React.useState<Record<string, string | string[]>>({});
  const [customOptionInputs, setCustomOptionInputs] = React.useState<Record<string, string>>({});
  const [customOptions, setCustomOptions] = React.useState<Record<string, string[]>>({});
  const [submitting, setSubmitting] = React.useState(false);
  const [localError, setLocalError] = React.useState<string | null>(null);
  const [successMessage, setSuccessMessage] = React.useState<string | null>(null);
  const [payment, setPayment] = React.useState<PaymentState>({
    orderId: null,
    captured: false,
    error: null,
  });
  const autoSubmitRef = React.useRef(false);
  const successTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  React.useEffect(() => {
    setAnswers({});
    setCustomOptionInputs({});
    setCustomOptions({});
    setPayment({ orderId: null, captured: false, error: null });
    setLocalError(null);
    setSuccessMessage(null);
    if (successTimeoutRef.current) {
      clearTimeout(successTimeoutRef.current);
      successTimeoutRef.current = null;
    }
    autoSubmitRef.current = false;
  }, [formId]);

  React.useEffect(() => {
    return () => {
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
    };
  }, []);

  React.useEffect(() => {
    const handleKey = (event: KeyboardEvent) => {
      if (event.key === 'Escape') {
        if (previewImage) {
          setPreviewImage(null);
          return;
        }
        if (showSubmissions) {
          setShowSubmissions(false);
          return;
        }
        onClose();
      }
    };
    document.addEventListener('keydown', handleKey);
    return () => document.removeEventListener('keydown', handleKey);
  }, [onClose, previewImage, showSubmissions]);

  const formQuestions = form?.formQuestions ?? [];
  const isReadOnly =
    form?.formSubmissionLimit === 'once' && Boolean(form?.userHasSubmitted);
  const price = typeof form?.formPrice === 'number' ? form?.formPrice : null;
  const paymentRequired = Boolean(price && price > 0);
  const paymentReady = !paymentRequired || payment.captured;

  const handleAnswerChange = (
    questionId: string,
    value: string | string[],
  ) => {
    setAnswers((prev) => ({ ...prev, [questionId]: value }));
  };

  const handleToggleMultiSelect = (
    question: FormQuestion,
    option: string,
  ) => {
    const selections = Array.isArray(answers[question.id])
      ? (answers[question.id] as string[])
      : [];
    const exists = selections.includes(option);
    const maxSelections = question.maxSelections ?? 2;
    const nextSelections = exists
      ? selections.filter((entry) => entry !== option)
      : selections.length >= maxSelections
        ? selections
        : [...selections, option];
    handleAnswerChange(question.id, nextSelections);
  };

  const addCustomOption = (question: FormQuestion) => {
    const input = customOptionInputs[question.id]?.trim() ?? '';
    if (!input) return;
    const existingOptions = [
      ...(question.options ?? []),
      ...(customOptions[question.id] ?? []),
    ];
    if (existingOptions.some((option) => option.toLowerCase() === input.toLowerCase())) {
      setLocalError('That option already exists.');
      return;
    }
    setCustomOptions((prev) => ({
      ...prev,
      [question.id]: [...(prev[question.id] ?? []), input],
    }));
    setCustomOptionInputs((prev) => ({ ...prev, [question.id]: '' }));
    handleToggleMultiSelect(question, input);
  };

  const canSubmitForm = React.useMemo(() => {
    if (!canSubmit || isReadOnly) return false;
    if (!paymentReady) return false;
    return formQuestions.every((question) => {
      const isRequired = question.required ?? true;
      if (!isRequired) return true;
      const value = answers[question.id];
      if (question.type === 'multiple_choice') {
        return Array.isArray(value) && value.length > 0;
      }
      return typeof value === 'string' && value.trim().length > 0;
    });
  }, [answers, canSubmit, formQuestions, isReadOnly, paymentReady]);

  const handleSubmit = async () => {
    autoSubmitRef.current = true;
    if (!form) {
      setLocalError('Form is still loading.');
      return;
    }
    if (!canSubmit) {
      setLocalError('You must be signed in to submit.');
      return;
    }
    if (isReadOnly) {
      setLocalError('You already submitted this form.');
      return;
    }
    if (!paymentReady) {
      setLocalError('Please complete payment before submitting.');
      return;
    }
    try {
      setSubmitting(true);
      setLocalError(null);
      await submitForm({
        id: form._id,
        answers: formQuestions.map((question) => ({
          questionId: question.id,
          value: answers[question.id] ?? '',
        })),
        paypalOrderId: payment.orderId ?? undefined,
        paymentAmount: price ?? undefined,
      });
      setSuccessMessage('Submission received!');
      if (successTimeoutRef.current) {
        clearTimeout(successTimeoutRef.current);
      }
      successTimeoutRef.current = setTimeout(() => {
        setSuccessMessage(null);
      }, 3000);
      if (form.formSubmissionLimit === 'unlimited') {
        setAnswers({});
        setCustomOptions({});
        setPayment({ orderId: null, captured: false, error: null });
        autoSubmitRef.current = false;
      }
    } catch (error) {
      setLocalError(
        error instanceof Error ? error.message : 'Failed to submit form.',
      );
      autoSubmitRef.current = false;
    } finally {
      setSubmitting(false);
    }
  };

  React.useEffect(() => {
    if (!payment.captured) return;
    if (submitting) return;
    if (autoSubmitRef.current) return;
    if (!canSubmitForm) return;
    void handleSubmit();
  }, [payment.captured, submitting, canSubmitForm]);

  if (!form) {
    return (
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
          <p className='text-sm text-muted-foreground'>Loading form...</p>
        </div>
      </div>
    );
  }

  return (
    <>
      <div
        className='fixed inset-0 z-50 flex items-center justify-center bg-black/60 px-4 py-6'
        role='dialog'
        aria-modal='true'
        onClick={onClose}
      >
        <div
          className='w-full max-w-3xl rounded-2xl border border-border bg-card p-6 shadow-2xl'
          onClick={(event) => event.stopPropagation()}
        >
          <div className='flex items-start justify-between gap-4'>
            <div>
              <p className='text-xs font-medium uppercase tracking-wide text-primary'>
                {formatEventType('form')}
              </p>
              <h2 className='mt-1 text-2xl font-semibold text-foreground'>
                {form.title}
              </h2>
              <p className='mt-2 text-xs text-muted-foreground'>
                {form.status === 'scheduled' ? 'Scheduled for' : 'Published'}{' '}
                {formatDate(form.publishAt)}
              </p>
              {form.updatedAt && form.updatedBy && (
                <p className='mt-1 text-xs text-muted-foreground'>
                  Updated by {formatCreator(form.updatedBy)} on{' '}
                  {formatDate(form.updatedAt)}
                </p>
              )}
            </div>
            <div className='flex items-center gap-2'>
              {isAdmin && (
                <button
                  type='button'
                  onClick={() => setShowSubmissions(true)}
                  className='rounded-full border border-primary px-3 py-1 text-xs font-medium text-primary transition hover:bg-primary/10'
                >
                  Form submissions
                </button>
              )}
              <button
                type='button'
                onClick={onClose}
                className='rounded-full border border-border p-2 text-muted-foreground transition hover:text-foreground'
                aria-label='Close form'
              >
                <X className='h-4 w-4' aria-hidden={true} />
              </button>
            </div>
          </div>

          <div className='mt-6 max-h-[60vh] overflow-y-auto pr-1'>
            {form.description?.trim() ? (
              <p className='whitespace-pre-wrap text-sm leading-relaxed text-foreground'>
                {form.description}
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
                      alt='Form image'
                      className='h-48 w-full object-cover transition duration-200 group-hover:scale-105'
                    />
                    <span className='sr-only'>View full-size image</span>
                  </button>
                ))}
              </div>
            )}

            <div className='mt-6 space-y-4'>
              {form.formQuestions.map((question) => {
                const selectionValue = answers[question.id];
                const options = [
                  ...(question.options ?? []),
                  ...(customOptions[question.id] ?? []),
                ];
                const selectedValues = Array.isArray(selectionValue)
                  ? selectionValue
                  : [];
                const maxSelections = question.maxSelections ?? 2;
                const selectionAtMax =
                  question.type === 'multiple_choice' &&
                  selectedValues.length >= maxSelections;

                return (
                  <div
                    key={question.id}
                    className='rounded-xl border border-border bg-background/60 p-4'
                  >
                    <p className='text-sm font-semibold text-foreground'>
                      {question.prompt}
                      {question.required === false && (
                        <span className='ml-2 text-xs font-normal text-muted-foreground'>
                          Optional
                        </span>
                      )}
                    </p>

                    {question.type === 'multiple_choice' && (
                      <div className='mt-3 space-y-2'>
                        {options.map((option) => {
                          const checked = selectedValues.includes(option);
                          const disableToggle =
                            !checked && selectionAtMax;
                          return (
                            <label
                              key={option}
                              className='flex items-center gap-2 text-sm text-foreground'
                            >
                              <input
                                type='checkbox'
                                checked={checked}
                                disabled={disableToggle || isReadOnly || !canSubmit}
                                onChange={() =>
                                  handleToggleMultiSelect(question, option)
                                }
                                className='h-4 w-4 rounded border-border'
                              />
                              {option}
                            </label>
                          );
                        })}
                        {question.allowAdditionalOptions && !isReadOnly && (
                          <div className='flex flex-col gap-2 sm:flex-row sm:items-center'>
                            <input
                              type='text'
                              value={customOptionInputs[question.id] ?? ''}
                              onChange={(event) =>
                                setCustomOptionInputs((prev) => ({
                                  ...prev,
                                  [question.id]: event.target.value,
                                }))
                              }
                              disabled={isReadOnly || !canSubmit}
                              placeholder='Add your own option'
                              className='flex-1 rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                            />
                            <button
                              type='button'
                              onClick={() => addCustomOption(question)}
                              disabled={isReadOnly || !canSubmit}
                              className='rounded-md border border-border bg-secondary px-3 py-2 text-xs font-medium text-muted-foreground transition hover:text-foreground'
                            >
                              Add
                            </button>
                          </div>
                        )}
                        <p className='text-xs text-muted-foreground'>
                          Select up to {maxSelections} options.
                        </p>
                      </div>
                    )}

                    {question.type === 'dropdown' && (
                      <select
                        value={
                          typeof selectionValue === 'string'
                            ? selectionValue
                            : ''
                        }
                        onChange={(event) =>
                          handleAnswerChange(question.id, event.target.value)
                        }
                        disabled={isReadOnly || !canSubmit}
                        className='mt-3 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                      >
                        <option value=''>Select an option</option>
                        {(question.options ?? []).map((option) => (
                          <option key={option} value={option}>
                            {option}
                          </option>
                        ))}
                      </select>
                    )}

                    {question.type === 'free_text' && (
                      <textarea
                        rows={3}
                        value={
                          typeof selectionValue === 'string'
                            ? selectionValue
                            : ''
                        }
                        onChange={(event) =>
                          handleAnswerChange(question.id, event.target.value)
                        }
                        maxLength={question.maxLength ?? 250}
                        disabled={isReadOnly || !canSubmit}
                        placeholder='Type your response...'
                        className='mt-3 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                      />
                    )}

                    {question.type === 'user_select' && (
                      <select
                        value={
                          typeof selectionValue === 'string'
                            ? selectionValue
                            : ''
                        }
                        onChange={(event) =>
                          handleAnswerChange(question.id, event.target.value)
                        }
                        disabled={isReadOnly || !canSubmit}
                        className='mt-3 w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                      >
                        <option value=''>Select a user</option>
                        {(form.userOptionsByQuestionId[question.id] ?? []).map(
                          (user) => (
                            <option key={user.userId} value={user.userId}>
                              {user.name}
                            </option>
                          ),
                        )}
                      </select>
                    )}
                  </div>
                );
              })}
            </div>

            {paymentRequired && !payment.captured && (
              <div className='mt-6 rounded-xl border border-border bg-background/60 p-4'>
                <p className='text-sm font-semibold text-foreground'>
                  Payment required
                </p>
                <p className='mt-1 text-sm text-muted-foreground'>
                  Pay ${price?.toFixed(2)} to submit this form.
                </p>
                {payment.error && (
                  <p className='mt-2 text-sm text-destructive'>
                    {payment.error}
                  </p>
                )}
                <div className='mt-3'>
                  <PayPalPanel
                    amount={price ?? 0}
                    description={`Form submission: ${form.title}`}
                    referenceId={form._id}
                    onPaid={(orderId) =>
                      setPayment({
                        orderId,
                        captured: true,
                        error: null,
                      })
                    }
                    onError={(message) =>
                      setPayment((prev) => ({
                        ...prev,
                        error: message,
                      }))
                    }
                  />
                </div>
              </div>
            )}

            {paymentRequired && payment.captured && (
              <p className='mt-4 text-sm text-emerald-500'>
                Payment received. You can submit the form now.
              </p>
            )}

            {form.formSubmissionLimit === 'once' && form.userHasSubmitted && (
              <p className='mt-4 text-sm text-muted-foreground'>
                You already submitted this form. Thank you!
              </p>
            )}

            {!canSubmit && (
              <p className='mt-4 text-sm text-muted-foreground'>
                Sign in to submit this form.
              </p>
            )}

            <div className='mt-6 flex flex-col items-start gap-3 sm:flex-row sm:items-center sm:justify-between'>
              <p className='text-xs text-muted-foreground'>
                {form.formSubmissionLimit === 'once'
                  ? 'One submission per user.'
                  : 'Unlimited submissions.'}
              </p>
              {!paymentRequired && (
                <button
                  type='button'
                  disabled={!canSubmitForm || submitting}
                  onClick={handleSubmit}
                  className='inline-flex items-center justify-center rounded-md border border-border bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-60'
                >
                  {submitting ? 'Submitting...' : 'Submit form'}
                </button>
              )}
            </div>

            {localError && (
              <div className='mt-3 rounded-md border border-destructive/40 bg-destructive/10 px-3 py-2 text-sm text-destructive'>
                {localError}
              </div>
            )}
            {successMessage && (
              <div className='mt-3 rounded-md border border-emerald-500/40 bg-emerald-500/10 px-3 py-2 text-sm text-emerald-600'>
                {successMessage}
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
              alt='Full-size form image'
              className='h-full w-full rounded-xl object-contain'
            />
            <p className='mt-2 text-center text-xs text-muted-foreground'>
              Click outside or press Escape to close.
            </p>
          </div>
        </div>
      )}

      {showSubmissions && (
        <FormSubmissionsModal
          formId={form._id}
          onClose={() => setShowSubmissions(false)}
        />
      )}
    </>
  );
}
