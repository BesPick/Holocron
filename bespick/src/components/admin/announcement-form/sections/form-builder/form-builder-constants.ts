import type { FormQuestion, FormQuestionType } from '@/types/db';

export const MAX_QUESTIONS = 5;
export const UNASSIGNED_VALUE = 'unassigned';

export const QUESTION_TYPES: Array<{
  value: FormQuestionType;
  label: string;
  description: string;
}> = [
  {
    value: 'multiple_choice',
    label: 'Multiple Choice',
    description: 'Choose several options from a list.',
  },
  {
    value: 'dropdown',
    label: 'Dropdown',
    description: 'Pick one option from a dropdown.',
  },
  {
    value: 'free_text',
    label: 'Free Text',
    description: 'Short response (up to 250 characters).',
  },
  {
    value: 'user_select',
    label: 'User Select',
    description: 'Pick a user from the roster.',
  },
  {
    value: 'number',
    label: 'Numbers',
    description: 'Accept a number within a defined range.',
  },
];

export const createQuestion = (type: FormQuestionType): FormQuestion => {
  const id = crypto.randomUUID();
  if (type === 'multiple_choice') {
    return {
      id,
      type,
      prompt: '',
      required: true,
      options: ['Option 1', 'Option 2'],
      allowAdditionalOptions: false,
      maxSelections: 2,
    };
  }
  if (type === 'dropdown') {
    return {
      id,
      type,
      prompt: '',
      required: true,
      options: ['Option 1', 'Option 2'],
    };
  }
  if (type === 'free_text') {
    return {
      id,
      type,
      prompt: '',
      required: true,
      maxLength: 250,
    };
  }
  if (type === 'number') {
    return {
      id,
      type,
      prompt: '',
      required: true,
      minValue: 1,
      maxValue: 10,
      includeMin: true,
      includeMax: true,
      allowAnyNumber: false,
      pricePerUnit: undefined,
      priceSourceQuestionId: undefined,
      priceSourceQuestionIds: undefined,
    };
  }
  return {
    id,
    type: 'user_select',
    prompt: '',
    required: true,
    userFilters: {},
  };
};
