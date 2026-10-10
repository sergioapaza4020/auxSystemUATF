export interface IActivity {
  idActivity: number;
  isActive: boolean;
  name: string;
  description?: string;
  dueDate: string;
  publicationDate?: string | null;
}
