export const cleanupIndicator = (name: string) => {
  const indicator = document.querySelector(`[data-position=${name}]`);

  if (indicator) indicator.remove();
};
