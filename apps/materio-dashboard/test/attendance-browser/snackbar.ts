export function useSnackbar() {
  const show = (message: string) =>
    window.dispatchEvent(new CustomEvent('attendance-fixture-message', { detail: message }));

  return { success: show, error: show, warning: show };
}
