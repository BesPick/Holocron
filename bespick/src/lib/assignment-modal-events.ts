export type AssignmentModalFocus =
  | 'group'
  | 'team'
  | 'portfolio'
  | 'rankCategory'
  | 'rank';

export type AssignmentModalEventDetail = {
  focus?: AssignmentModalFocus;
};

export const ASSIGNMENT_MODAL_EVENT = 'bespick:assignment-modal';

export const requestAssignmentModalOpen = (
  detail: AssignmentModalEventDetail = {},
) => {
  if (typeof window === 'undefined') return;
  window.dispatchEvent(
    new CustomEvent<AssignmentModalEventDetail>(
      ASSIGNMENT_MODAL_EVENT,
      { detail },
    ),
  );
};
