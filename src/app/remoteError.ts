export const toRemoteErrorMessage = (error: unknown, fallback: string) => {
  if (!(error instanceof Error)) {
    return fallback;
  }

  const message = error.message.trim();
  if (
    !message ||
    [
      /credentials? invalid/i,
      /firestore unavailable/i,
      /getting metadata from plugin failed/i,
      /reauthentication is needed/i,
      /gcloud auth application-default login/i,
    ].some((pattern) => pattern.test(message))
  ) {
    return fallback;
  }

  return message;
};
