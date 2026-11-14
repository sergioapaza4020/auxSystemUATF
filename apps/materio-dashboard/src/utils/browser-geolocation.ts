import type { AttendanceCheckInPayload } from '@/interfaces/attendances/student-attendance.interface';

export class BrowserLocationError extends Error {
  constructor(public readonly code: number) {
    super('BROWSER_LOCATION_UNAVAILABLE');
  }
}

// One request per explicit user action. No tracking, storage or coordinate logging.
export function getCurrentBrowserPosition(): Promise<AttendanceCheckInPayload> {
  return new Promise((resolve, reject) => requestCurrentBrowserPosition(resolve, reject));
}

export function requestCurrentBrowserPosition(
  resolve: (position: AttendanceCheckInPayload) => void,
  reject: (error: BrowserLocationError) => void,
): void {
  if (typeof navigator === 'undefined' || !navigator.geolocation) {
    reject(new BrowserLocationError(0));

    return;
  }

  try {
    navigator.geolocation.getCurrentPosition(
      ({ coords }) => {
        resolve({ latitude: coords.latitude, longitude: coords.longitude, accuracy: coords.accuracy });
      },
      (error) => reject(new BrowserLocationError(error.code)),
      {
        enableHighAccuracy: true,
        timeout: 15000,
        maximumAge: 0,
      },
    );
  } catch {
    reject(new BrowserLocationError(0));
  }
}
