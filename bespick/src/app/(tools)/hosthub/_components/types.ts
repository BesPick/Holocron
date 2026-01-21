export type ShiftResource = {
  label: string;
  href: string;
};

export type ShiftEntry = {
  id: string;
  date: string;
  time: string;
  details: string;
  resources: ShiftResource[];
};
