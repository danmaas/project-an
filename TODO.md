This file tracks the state of tasks that are TODO / INPROGRESS / DONE. Please keep this updated as work progresses.

- TASK-000 [DONE]: Create repo skeleton:
  - Dockerfile
  - minimal back-end code (just enough to serve the front-end UI to a browser)
  - minimal front-end code (just enough to display "hello world" with the desired UI framework)
  - Test suite
  - Add a Makefile with commands for building the container, running tests, and running the container with the interactive web interface exposed.
  - Update AGENTS.md as appropriate with testing instructions.

- TASK-100 [DONE]: The app is able to load a small event log (`data/events-202605-ca.parquet`) and display a time series chart of the number of `"screen"` events witnessed by hour across a one-month time span.

- TASK-200 [TODO]: The app offers a choice of event logs to load (i.e. files in the `data/` directory).

- TASK-300 [TODO]: The app exposes filtering options to selectively show `"screen"` event counts only for players from a specific `country`, `platform`, or `join_week`. There is also a "group by" option to display event counts broken down by any of those dimensions.

- TASK-400 [TODO]: In addition to the time-series chart, the app also computes the percentage of players who accomplished the `returned_1d` event (i.e. 1-day retention rate) and who accomplished the `sub_buy_success` event (i.e. conversion to paying player).

- TASK-500 [TODO]: Adds an "experiment analysis" mode. In this optional mode:
    - The user selects one of the experiment_ids seen in the dataset. A common one is `sub_sku_annual_only`.
    - The event log is scanned for `experiment_viewed` events with this `experiment_id`. The `variation_id` is recorded for each player (as identified by their `user_id_hash`). Not all players will be exposed to every experiment. It is safe to assume that the variation is "sticky", i.e. once a player views a given variation, they are permanently associated with that variation, regardless of subsequent activity. **Ignore events where `variation_id` is `"control"`.**. Control is a "dummy" variation; the actual control group for an experiment will have an explicit name like `"off"`, not `"control"`.
    - In addition to all existing filtering, the event log is also filtered to remove events pertaining to users who do not have a `variation_id` recorded for this experiment.
    - The `returned_1d` and `sub_buy_success` percentages are re-computed separately per `variation_id`. The app displays the difference in retention & monetization by variation.

- TASK-510 [TODO]: Expand the last step of "experiment analysis" to construct a contingency table and perform a chi-square test on statistical significance of the difference in retention & monetization rates by variation.