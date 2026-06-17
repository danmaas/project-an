This file tracks the state of tasks that are TODO / INPROGRESS / DONE. Please keep this updated as work progresses.

- TASK-000 [DONE]: Create repo skeleton:
  - Dockerfile
  - minimal back-end code (just enough to serve the front-end UI to a browser)
  - minimal front-end code (just enough to display "hello world" with the desired UI framework)
  - Test suite
  - Add a Makefile with commands for building the container, running tests, and running the container with the interactive web interface exposed.
  - Update AGENTS.md as appropriate with testing instructions.

- TASK-100 [TODO]: The app is able to load a small event log (`data/events-202605-ca.parquet`) and display a time series chart of the number of `"screen"` events witnessed by hour across a one-month time span.

- TASK-200 [TODO]: The app offers a choice of event logs to load (i.e. files in the `data/` directory).

- TASK-300 [TODO]: The app exposes filtering options to selectively show `"screen"` event counts only for players from a specific `country`, `platform`, or `join_week`. There is also a "group by" option to display event counts broken down by any of those dimensions.

- TASK-400 [TODO]: In addition to the time-series chart, the app also computes the percentage of players who accomplished the `returned_1d` event (i.e. 1-day retention rate) and who accomplished the `sub_buy_success` event (i.e. conversion to paying player).