# Show the cover-letter answer length without spaces (#232)

Each cover-letter answer now shows its length without spaces next to the existing count, for example "1,204 characters (1,032 without spaces) / 1,500".

| File                                                                         | Change                                                                                                                                                                                     |
| ---------------------------------------------------------------------------- | ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------ |
| `frontend/src/cover-letter-data.ts`                                          | New `answerLengthWithoutSpaces` (drops all white space, counts by code point). `answerLengthText` shows both numbers; the limit and the over-limit warning still use the count with spaces |
| `frontend/src/cover-letter-questions.test.tsx`, `cover-letter-form.test.tsx` | Unit tests for spaces, line breaks, tabs, emoji; screen tests (view and live typing in the form) check both numbers                                                                        |
