# Make enum error messages name the accepted values (#139)

- New `oneOfError(label, values)` in `backend/src/routes/shared.ts` builds "X must be one of a, b" from the enum array. Careers, educations (degree, status), skills and applications use it, so a client that follows the message sends an accepted value (`full_time`, `high_school`, `on_leave`, `dropped_out`).
- The GPA pair rule reports on the empty field: "Maximum GPA is required when GPA is entered" (on `gpaScale`) and "GPA is required when maximum GPA is entered" (on `gpa`). The form already maps messages to fields by prefix, so no form code changed.
- Tests: route tests (careers, educations, skills, applications) and the education form tests (message placement, prefix mapping).
