// A row id in an address. The same pattern as `ID_PATTERN` in backend/src/standard/http.ts, so the screen calls
// an address invalid exactly when the API would answer 400 "Invalid ... ID" (#141).
const idPattern = /^[1-9]\d{0,14}$/;

export const isValidId = (id: string) => idPattern.test(id);

/** What a screen shows for an address whose id can never match a row, as opposed to a deleted row. */
export const invalidAddressText = 'This address is not valid.';
