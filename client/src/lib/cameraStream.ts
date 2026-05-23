/** Richiede stream video: posteriore su mobile, webcam predefinita su desktop. */
export async function acquireCameraStream(mobile: boolean): Promise<MediaStream> {
  const attempts: MediaStreamConstraints[] = mobile
    ? [
        // Mobile: 720p prima — decode più veloce, meno CPU
        {
          video: {
            facingMode: { ideal: 'environment' },
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        },
        {
          video: { facingMode: { ideal: 'environment' } },
          audio: false,
        },
        { video: { facingMode: 'environment' }, audio: false },
        { video: true, audio: false },
      ]
    : [
        {
          video: {
            width: { ideal: 1280 },
            height: { ideal: 720 },
          },
          audio: false,
        },
        { video: true, audio: false },
      ];

  let lastError: unknown;
  for (const constraints of attempts) {
    try {
      return await navigator.mediaDevices.getUserMedia(constraints);
    } catch (e) {
      lastError = e;
    }
  }
  throw lastError ?? new Error('no-camera');
}

export function isMobileDevice(): boolean {
  if (typeof navigator === 'undefined') return false;
  return /Android|iPhone|iPad|iPod|Mobile/i.test(navigator.userAgent);
}
