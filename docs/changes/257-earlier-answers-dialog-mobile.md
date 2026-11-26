# Keep the earlier-answers dialog off the screen edges on mobile (#257)

The browser check of #231 at 390x844 showed the "Find earlier answers" dialog spanning the full width (x=0..390), because `max-w-2xl` replaced the shared dialog's side margin. The trigger button also filled the whole answer card at 1440 px.

| File                                            | Change                                                                                         |
| ----------------------------------------------- | ---------------------------------------------------------------------------------------------- |
| `frontend/src/cover-letter-earlier-answers.tsx` | Dialog uses `sm:max-w-2xl` (the phone keeps the default margin); the trigger button is `w-fit` |
