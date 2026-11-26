export const maxPasswordBytes: number;
export const passwordRules: readonly {
  label: string;
  validate(value: string): boolean;
}[];
export function passwordPolicyError(value: string): string | undefined;
