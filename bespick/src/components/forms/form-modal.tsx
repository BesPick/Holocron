'use client';

import * as React from 'react';
import { X } from 'lucide-react';
import {
  type PayPalButtonsComponentProps,
  type ReactPayPalScriptOptions,
} from '@paypal/react-paypal-js';
import { api } from '@/lib/api';
import { useApiMutation, useApiQuery } from '@/lib/apiClient';
import { formatCreator, formatDate, formatEventType } from '@/lib/announcements';
import { PayPalPanel } from '@/components/payments/paypal-panel';
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
  amount: number | null;
};

const formatRangeTip = (question: FormQuestion) => {
  if (question.allowAnyNumber) {
    return 'Any number is allowed.';
  }
  const minValue = question.minValue ?? 0;
  const maxValue = question.maxValue ?? minValue;
  const includeMin = question.includeMin ?? true;
  const includeMax = question.includeMax ?? true;
  const minLabel = includeMin ? 'at least' : 'greater than';
  const maxLabel = includeMax ? 'at most' : 'less than';
  return `Allowed range: ${minLabel} ${minValue} and ${maxLabel} ${maxValue}.`;
};

type FormPayPalPanelProps = {
  amount: number;
  description: string;
  referenceId: string;
  disabled?: boolean;
  onPaid: (orderId: string) => void;
  onError: (message: string) => void;
};

function FormPayPalPanel({
  amount,
  description,
  referenceId,
  disabled = false,
  onPaid,
  onError,
}: FormPayPalPanelProps) {
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
  const amountLabel = React.useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: paypalCurrency,
        minimumFractionDigits: 2,
      }).format(amount),
    [amount, paypalCurrency],
  );

  const paypalButtonsProps = React.useMemo<PayPalButtonsComponentProps>(
    () => ({
      style: {
        background: 'transparent',
        shape: 'sharp',
        layout: 'vertical',
        label: 'pay',
        height: 48,
      },
      disabled,
      forceReRender: [
        amount,
        paypalCurrency,
        paypalClientId ?? '',
        disabled ? 'disabled' : 'enabled',
      ],
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

  return (
    <PayPalPanel
      amountLabel={amountLabel}
      paypalOptions={paypalOptions}
      paypalButtonsProps={paypalButtonsProps}
    />
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
  const [anonymousChoice, setAnonymousChoice] = React.useState(false);
  const [payment, setPayment] = React.useState<PaymentState>({
    orderId: null,
    captured: false,
    error: null,
    amount: null,
  });
  const displayCurrency =
    process.env.NEXT_PUBLIC_PAYPAL_CURRENCY ?? 'USD';
  const currencyFormatter = React.useMemo(
    () =>
      new Intl.NumberFormat('en-US', {
        style: 'currency',
        currency: displayCurrency,
        minimumFractionDigits: 2,
      }),
    [displayCurrency],
  );
  const autoSubmitRef = React.useRef(false);
  const successTimeoutRef = React.useRef<ReturnType<typeof setTimeout> | null>(
    null,
  );

  React.useEffect(() => {
    setAnswers({});
    setCustomOptionInputs({});
    setCustomOptions({});
    setPayment({ orderId: null, captured: false, error: null, amount: null });
    setLocalError(null);
    setSuccessMessage(null);
    setAnonymousChoice(false);
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
  const allowAnonymousChoice = Boolean(form?.formAllowAnonymousChoice);
  const forceAnonymous = Boolean(form?.formForceAnonymous);
  const showAnonymousChoice = allowAnonymousChoice && !forceAnonymous;
  const questionsById = React.useMemo(
    () => new Map(formQuestions.map((question) => [question.id, question])),
    [formQuestions],
  );
  const priceSourceIds = React.useMemo(() => {
    const ids = new Set<string>();
    formQuestions.forEach((question) => {
      const sourceIds = [
        ...(question.priceSourceQuestionIds ?? []),
        ...(question.priceSourceQuestionId
          ? [question.priceSourceQuestionId]
          : []),
      ];
      sourceIds.forEach((id) => ids.add(id));
    });
    return ids;
  }, [formQuestions]);
  const isReadOnly =
    form?.formSubmissionLimit === 'once' && Boolean(form?.userHasSubmitted);
  const basePrice =
    typeof form?.formPrice === 'number' ? form?.formPrice : null;
  const getPerUnitPrice = React.useCallback(
    (question: FormQuestion) => {
      const sourceIds = [
        ...(question.priceSourceQuestionIds ?? []),
        ...(question.priceSourceQuestionId
          ? [question.priceSourceQuestionId]
          : []),
      ];
      if (sourceIds.length === 0) {
        return question.pricePerUnit ?? 0;
      }
      return sourceIds.reduce((sum, sourceId) => {
        const sourceQuestion = questionsById.get(sourceId);
        if (!sourceQuestion || !sourceQuestion.optionPrices) {
          return sum;
        }
        const sourceAnswer = answers[sourceId];
        if (sourceQuestion.type === 'dropdown') {
          const selection =
            typeof sourceAnswer === 'string' ? sourceAnswer : '';
          return sum + (sourceQuestion.optionPrices[selection] ?? 0);
        }
        if (sourceQuestion.type === 'multiple_choice') {
          const selections = Array.isArray(sourceAnswer)
            ? sourceAnswer
            : [];
          const subtotal = selections.reduce(
            (innerSum, selection) =>
              innerSum +
              (sourceQuestion.optionPrices?.[selection] ?? 0),
            0,
          );
          return sum + subtotal;
        }
        return sum;
      }, 0);
    },
    [answers, questionsById],
  );
  const computedPrice = React.useMemo(() => {
    if (basePrice === null) return 0;
    let total = basePrice;
    for (const question of formQuestions) {
      const value = answers[question.id];
      if (question.type === 'dropdown') {
        if (priceSourceIds.has(question.id)) {
          continue;
        }
        const selection = typeof value === 'string' ? value : '';
        const optionPrice =
          selection && question.optionPrices
            ? question.optionPrices[selection] ?? 0
            : 0;
        total += optionPrice;
      }
      if (question.type === 'multiple_choice') {
        if (priceSourceIds.has(question.id)) {
          continue;
        }
        const selections = Array.isArray(value) ? value : [];
        if (question.optionPrices && selections.length > 0) {
          for (const selection of selections) {
            total += question.optionPrices[selection] ?? 0;
          }
        }
      }
      if (question.type === 'number') {
        const raw = typeof value === 'string' ? value.trim() : '';
        const perUnit = getPerUnitPrice(question);
        if (raw && Number.isFinite(perUnit) && perUnit > 0) {
          const parsed = Number(raw);
          if (Number.isFinite(parsed)) {
            total += parsed * perUnit;
          }
        }
      }
    }
    return Math.round(total * 100) / 100;
  }, [answers, basePrice, formQuestions, getPerUnitPrice, priceSourceIds]);

  const priceBreakdown = React.useMemo(() => {
    if (basePrice === null) return [];
    const items: Array<{ label: string; amount: number }> = [];
    if (basePrice > 0) {
      items.push({ label: 'Base price', amount: basePrice });
    }

    for (const question of formQuestions) {
      const value = answers[question.id];
      if (
        (question.type === 'dropdown' || question.type === 'multiple_choice') &&
        priceSourceIds.has(question.id)
      ) {
        continue;
      }
      if (question.type === 'dropdown') {
        const selection = typeof value === 'string' ? value : '';
        if (selection && question.optionPrices?.[selection]) {
          items.push({
            label: `${question.prompt}: ${selection}`,
            amount: question.optionPrices[selection] ?? 0,
          });
        }
      }
      if (question.type === 'multiple_choice') {
        const selections = Array.isArray(value) ? value : [];
        selections.forEach((selection) => {
          const optionPrice = question.optionPrices?.[selection] ?? 0;
          if (optionPrice > 0) {
            items.push({
              label: `${question.prompt}: ${selection}`,
              amount: optionPrice,
            });
          }
        });
      }
      if (question.type === 'number') {
        const raw = typeof value === 'string' ? value.trim() : '';
        const parsed = Number(raw);
        const perUnit = getPerUnitPrice(question);
        if (Number.isFinite(parsed) && perUnit > 0) {
          items.push({
            label: `${question.prompt}: ${parsed} × ${currencyFormatter.format(
              perUnit,
            )}`,
            amount: Math.round(parsed * perUnit * 100) / 100,
          });
        }
      }
    }

    return items.filter((item) => item.amount > 0);
  }, [
    answers,
    basePrice,
    currencyFormatter,
    formQuestions,
    getPerUnitPrice,
    priceSourceIds,
  ]);
  const paymentRequired = computedPrice > 0;
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

  const getAnswerError = React.useCallback(
    (question: FormQuestion, value: string | string[] | undefined) => {
      const isRequired = question.required ?? true;
      if (!isRequired) {
        const isEmpty =
          value === undefined ||
          value === null ||
          (typeof value === 'string' && value.trim().length === 0) ||
          (Array.isArray(value) && value.length === 0);
        if (isEmpty) return null;
      }

      if (question.type === 'multiple_choice') {
        return Array.isArray(value) && value.length > 0
          ? null
          : 'Select at least one option.';
      }
      if (question.type === 'number') {
        const raw = typeof value === 'string' ? value.trim() : '';
        if (!raw) return 'Enter a number.';
        const parsed = Number(raw);
        if (!Number.isFinite(parsed)) return 'Enter a valid number.';
        if (question.allowAnyNumber) return null;
        const minValue = question.minValue ?? 0;
        const maxValue = question.maxValue ?? minValue;
        const includeMin = question.includeMin ?? true;
        const includeMax = question.includeMax ?? true;
        const meetsMin = includeMin ? parsed >= minValue : parsed > minValue;
        const meetsMax = includeMax ? parsed <= maxValue : parsed < maxValue;
        if (!meetsMin || !meetsMax) {
          const minLabel = includeMin ? 'at least' : 'greater than';
          const maxLabel = includeMax ? 'at most' : 'less than';
          return `Enter a number ${minLabel} ${minValue} and ${maxLabel} ${maxValue}.`;
        }
        return null;
      }
      if (typeof value === 'string' && value.trim().length > 0) return null;
      return isRequired ? 'This response is required.' : null;
    },
    [],
  );

  const formReadyForPayment = React.useMemo(() => {
    if (!canSubmit || isReadOnly) return false;
    return formQuestions.every((question) =>
      !getAnswerError(question, answers[question.id]),
    );
  }, [answers, canSubmit, formQuestions, getAnswerError, isReadOnly]);

  React.useEffect(() => {
    if (!payment.captured) return;
    if (computedPrice <= 0) {
      setPayment({ orderId: null, captured: false, error: null, amount: null });
      return;
    }
    const paidAmount = payment.amount ?? null;
    if (paidAmount === null) return;
    if (Math.abs(paidAmount - computedPrice) > 0.01) {
      setPayment({ orderId: null, captured: false, error: null, amount: null });
      setLocalError(
        'Payment amount changed based on your responses. Please pay again.',
      );
    }
  }, [computedPrice, payment.amount, payment.captured]);

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
    return formQuestions.every((question) =>
      !getAnswerError(question, answers[question.id]),
    );
  }, [answers, canSubmit, formQuestions, getAnswerError, isReadOnly, paymentReady]);

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
        anonymousChoice: showAnonymousChoice ? anonymousChoice : undefined,
        paypalOrderId: payment.orderId ?? undefined,
        paymentAmount: paymentRequired ? computedPrice : undefined,
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
        setPayment({ orderId: null, captured: false, error: null, amount: null });
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
                  Form Data
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
                const priceSourceIdsForQuestion = [
                  ...(question.priceSourceQuestionIds ?? []),
                  ...(question.priceSourceQuestionId
                    ? [question.priceSourceQuestionId]
                    : []),
                ];
                const priceSourceQuestions = priceSourceIdsForQuestion
                  .map((id) => questionsById.get(id))
                  .filter(Boolean);
                const perUnitFromSource = priceSourceIdsForQuestion.length
                  ? getPerUnitPrice(question)
                  : 0;
                const sourcePromptLabel =
                  priceSourceQuestions.length > 0
                    ? priceSourceQuestions
                        .map((entry) => entry?.prompt || 'Untitled question')
                        .join(', ')
                    : 'the linked questions';

                const errorMessage = getAnswerError(
                  question,
                  selectionValue as string | string[] | undefined,
                );
                const showInlineError =
                  !isReadOnly &&
                  Boolean(errorMessage) &&
                  typeof selectionValue !== 'undefined';
                return (
                  <div
                    key={question.id}
                    className='rounded-xl border border-border bg-background/60 p-4'
                  >
                    <p className='text-sm font-semibold text-foreground'>
                      {question.prompt}
                      <span className='ml-2 text-xs font-normal text-muted-foreground'>
                        {question.required === false ? 'Optional' : 'Required'}
                      </span>
                    </p>

                    {question.type === 'multiple_choice' && (
                      <div className='mt-3 space-y-2'>
                        {options.map((option) => {
                          const checked = selectedValues.includes(option);
                          const disableToggle =
                            !checked && selectionAtMax;
                          const optionPrice =
                            question.optionPrices?.[option] ?? 0;
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
                              <span className='flex-1'>{option}</span>
                              {optionPrice > 0 && (
                                <span className='text-xs text-muted-foreground'>
                                  +{currencyFormatter.format(optionPrice)}
                                </span>
                              )}
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
                            {question.optionPrices?.[option]
                              ? ` (+${currencyFormatter.format(
                                  question.optionPrices[option],
                                )})`
                              : ''}
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

                    {question.type === 'number' && (
                      <div className='mt-3 space-y-2'>
                        <input
                          type='number'
                          min={
                            question.allowAnyNumber ? undefined : question.minValue
                          }
                          max={
                            question.allowAnyNumber ? undefined : question.maxValue
                          }
                          step='any'
                          value={
                            typeof selectionValue === 'string'
                              ? selectionValue
                              : ''
                          }
                          onChange={(event) =>
                            handleAnswerChange(question.id, event.target.value)
                          }
                          disabled={isReadOnly || !canSubmit}
                          className='w-full rounded-md border border-border bg-card px-3 py-2 text-sm text-foreground shadow-sm transition focus-visible:border-primary focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2 focus-visible:ring-offset-background'
                        />
                        {priceSourceIdsForQuestion.length ? (
                          perUnitFromSource > 0 ? (
                            <p className='text-xs text-muted-foreground'>
                              {currencyFormatter.format(perUnitFromSource)} per
                              unit (from {sourcePromptLabel})
                            </p>
                          ) : (
                            <p className='text-xs text-muted-foreground'>
                              Select options in {sourcePromptLabel} to set the
                              price.
                            </p>
                          )
                        ) : question.pricePerUnit && question.pricePerUnit > 0 ? (
                          <p className='text-xs text-muted-foreground'>
                            {currencyFormatter.format(question.pricePerUnit)} per
                            unit
                          </p>
                        ) : null}
                        <p className='text-xs text-muted-foreground'>
                          {formatRangeTip(question)}
                        </p>
                      </div>
                    )}
                    {showInlineError && (
                      <p className='mt-2 text-xs text-destructive'>
                        {errorMessage}
                      </p>
                    )}
                  </div>
                );
              })}

              {forceAnonymous && (
                <div className='rounded-xl border border-border bg-background/60 p-4 text-sm text-muted-foreground'>
                  Anonymous submissions are enforced for this form.
                </div>
              )}

              {showAnonymousChoice && (
                <div className='rounded-xl border border-border bg-background/60 p-4'>
                  <label className='flex items-center gap-3 text-sm text-foreground'>
                    <input
                      type='checkbox'
                      checked={anonymousChoice}
                      onChange={(event) =>
                        setAnonymousChoice(event.target.checked)
                      }
                      disabled={isReadOnly || !canSubmit}
                      className='h-4 w-4 rounded border-border'
                    />
                    Submit this form anonymously
                  </label>
                  <p className='mt-2 text-xs text-muted-foreground'>
                    If selected, your name will not appear on the submission.
                  </p>
                </div>
              )}
            </div>

            {paymentRequired && !payment.captured && (
              <div className='mt-6 rounded-xl border border-border bg-background/60 p-4'>
                <p className='text-sm font-semibold text-foreground'>
                  Payment required
                </p>
                <p className='mt-1 text-xs text-muted-foreground'>
                  Amount updates based on your answers.
                </p>
                {priceBreakdown.length > 0 && (
                  <div className='mt-3 rounded-lg border border-border/60 bg-card/60 px-3 py-2 text-xs text-muted-foreground'>
                    <p className='text-[11px] font-semibold uppercase tracking-wide text-muted-foreground'>
                      Price breakdown
                    </p>
                    <div className='mt-2 space-y-1'>
                      {priceBreakdown.map((item, index) => (
                        <div
                          key={`${item.label}-${index}`}
                          className='flex items-center justify-between gap-2'
                        >
                          <span className='text-foreground'>{item.label}</span>
                          <span>
                            {currencyFormatter.format(item.amount)}
                          </span>
                        </div>
                      ))}
                    </div>
                    <div className='mt-2 flex items-center justify-between border-t border-border/60 pt-2 text-sm font-semibold text-foreground'>
                      <span>Total</span>
                      <span>{currencyFormatter.format(computedPrice)}</span>
                    </div>
                  </div>
                )}
                {payment.error && (
                  <p className='mt-2 text-sm text-destructive'>
                    {payment.error}
                  </p>
                )}
                <div className='mt-3'>
                  <FormPayPalPanel
                    amount={computedPrice}
                    description={`Form submission: ${form.title}`}
                    referenceId={form._id}
                    disabled={!formReadyForPayment}
                    onPaid={(orderId) =>
                      setPayment({
                        orderId,
                        captured: true,
                        error: null,
                        amount: computedPrice,
                      })
                    }
                    onError={(message) =>
                      setPayment((prev) => ({
                        ...prev,
                        error: message,
                      }))
                    }
                  />
                  {!formReadyForPayment && (
                    <p className='mt-2 text-xs text-muted-foreground'>
                      Complete the required fields before paying.
                    </p>
                  )}
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
