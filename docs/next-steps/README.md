# Next steps

Last updated: **2026-10-19 (Asia/Seoul)**.

## Do first

| Order | Task                                            | Status                   | Next action                                                                      |
| ----- | ----------------------------------------------- | ------------------------ | -------------------------------------------------------------------------------- |
| 1     | Register detailed requirement issue cards       | Waiting for the user     | Once registered, go issue → branch → implementation and tests → PR               |
| 2     | Design DB migration `002` for the first feature | Waiting for requirements | Settle the tables and the unit and NULL rules in the issue's completion criteria |

## Execution boundary

Deploys, syncing the sub-repositories, and creating AWS resources happen only on a separate request. Add the shared infrastructure's ECR repository to the list in `shared-aws-infrastructure` at the first deploy.
