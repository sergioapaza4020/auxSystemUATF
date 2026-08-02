// Type Imports
import type { ChildrenType, Direction } from '@core/types';

// Context Imports
import { VerticalNavProvider } from '@menu/contexts/verticalNavContext';
import { SettingsProvider } from '@core/contexts/settingsContext';
import ThemeProvider from '@components/theme';

// Util Imports
import { getMode, getSettingsFromCookie } from '@core/utils/serverHelpers';
import { SnackbarProvider } from '@/providers/SnackbarProvider';
import { DialogProvider } from '@/providers/DialogProvider';
import { AuthProvider } from '@/providers/AuthProvider';

type Props = ChildrenType & {
  direction: Direction;
};

const Providers = (props: Props) => {
  // Props
  const { children, direction } = props;

  // Vars
  const mode = getMode();
  const settingsCookie = getSettingsFromCookie();

  return (
    <AuthProvider>
      <VerticalNavProvider>
        <SettingsProvider settingsCookie={settingsCookie} mode={mode}>
          <ThemeProvider direction={direction}>
            <DialogProvider>
              <SnackbarProvider>{children}</SnackbarProvider>
            </DialogProvider>
          </ThemeProvider>
        </SettingsProvider>
      </VerticalNavProvider>
    </AuthProvider>
  );
};

export default Providers;
