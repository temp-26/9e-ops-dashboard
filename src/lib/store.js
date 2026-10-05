// Holds the decrypted workforce data once the password has been entered.
let RAW = null;
export const setRaw = (r) => { RAW = r; };
export const getRaw = () => {
  if (!RAW) throw new Error('Dashboard data is locked.');
  return RAW;
};
