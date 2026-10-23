export type RegistrationCheck =
  | { registered: true; status: 'ACTIVE' | 'INACTIVE' }
  | { registered: false; status: 'NOT_FOUND' };
