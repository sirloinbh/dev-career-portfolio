# #246 Translate the remaining Korean screen text to English

## Findings

`git grep -P '[\x{AC00}-\x{D7A3}]'` over `frontend/src`, `backend/src` and `shared` found one hit outside tests: a doc comment in `frontend/src/delete-item.ts` (`'학력', '이력'`). No Korean is shown on any screen: labels, messages, placeholders, API error messages, the HTML `lang` and dates (`service-date.ts` formats in English; only the time zone is `Asia/Seoul`) are English already. The rest of the Korean in the repo is test data (company names in backend tests), the managed `.standards/` files and docs.

## Change

| File                                | Change                                                                                              |
| ----------------------------------- | --------------------------------------------------------------------------------------------------- |
| `frontend/src/delete-item.ts`       | The comment example is English                                                                      |
| `frontend/src/english-text.test.ts` | New test: fails if a non-test source under `frontend/src` contains Korean, so it does not come back |
