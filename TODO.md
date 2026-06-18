This file tracks the state of tasks that are TODO / INPROGRESS / DONE. Please keep this updated as work progresses.

- TASK-000 [DONE]: Create repo skeleton:
  - Dockerfile
  - minimal back-end code (just enough to serve the front-end UI to a browser)
  - minimal front-end code (just enough to display "hello world" with the desired UI framework)
  - Test suite
  - Add a Makefile with commands for building the container, running tests, and running the container with the interactive web interface exposed.
  - Update AGENTS.md as appropriate with testing instructions.

- TASK-100 [DONE]: The app is able to load a small event log (`data/events-202605-ca.parquet`) and display a time series chart of the number of `"screen"` events witnessed by hour across a one-month time span.

- TASK-200 [DONE]: The app offers a choice of event logs to load (i.e. files in the `data/` directory).

- TASK-300 [DONE]: The app exposes filtering options to selectively show `"screen"` event counts only for players from a specific `country` class, `platform`, or `join_week`. There is also a "group by" option to display total event counts, broken down by any of those dimensions, on the same chart. (**Note**: For `country`, please use the classification scheme described in `AGENTS.md`. Encode that classification scheme cleanly in code so that we can modify it easily in the future, if necessary).

- TASK-400 [DONE]: In addition to the time-series chart, the app also displays the absolute number and percentage of players, among all players who pass the filter, who accomplished the `returned_1d`, `returned_2d`, and `returned_3d` events (i.e. 1/2/3-day retention rates), and also who accomplished the `sub_buy_success` event (i.e. conversion to paying player). All these events should be treated as independent, and rates reported independently; i.e., a player may accomplish `sub_buy_success` whether or not they also accomplished `returned_1d`.

- TASK-450 [DONE]: After loading the parquet data into the client, we need to synthesize additional events and add them to the event log. These synthetic events are derived from pre-existing events. Specifically, for each `user_id_hash`, we want to insert new events `returned_Nd` for N=[1,2,3,5,7] to represent the player returning to the game on the Nth day after account creation. This is defined as the presence of any single `screen` event, for that `user_id_hash`, whose timestamp (`ts`) is within the range `[user_create_time + N days, user_create_time + (N+1) days]`.

- TASK-500 [DONE]: Adds an "experiment analysis" mode. Expanding on the "group by" option added in TASK-300:
    - The "group by" menu now adds a choice for each "experiment_id" found in the dataset. An example is the `sub_sku_annual_only` experiment which is aimed at affecting the `sub_buy_success` rate.
    - When experiment analysis is active, the event log is scanned for `experiment_viewed` events with this `experiment_id`. The `variation_id` is recorded for each player (as identified by their `user_id_hash`). Not all players will be exposed to every experiment. It is safe to assume that the variation is "sticky", i.e. once a player views a given variation, they are permanently associated with that variation, regardless of subsequent activity. **Ignore events where `variation_id` is `"control"`.**. Control is a "dummy" variation; the actual control group for an experiment will have an explicit name like `"off"`, not `"control"`.
    - In addition to all existing filtering, the event log is also filtered to remove events pertaining to players who do not have a `variation_id` recorded for this experiment.
    - The number displays from TASK-400 are computed separately per `variation_id` group. The app displays the difference in retention & monetization rates by variation.

- TASK-510 [DONE]: Expand the last step of "experiment analysis" to also construct a contingency table and perform a chi-square test to show the user the statistical significance of the difference in retention & monetization rates by variation.

- TASK-600 [DONE]: We seem to have a performance problem with medium and large datasets (events-202605-us.parquet is considered a "medium" sized dataset and events-202605-full.parquet is a "large" dataset). When the user selects a medium or larger dataset, the web UI freezes for a while saying "Loading event log...". With large datasets, Chrome displays an "unresponsive page" warning and sometimes even an "Oh snap!" page crash. From looking at log output, the issue seems to be the client-side ingestion/processing that occurs after the download, not the initial download the parquet data. See if you can find any optimizations. For example, should be use some kind of pandas-like numerics library for the data handling, instead of native JavaScript objects? You may want to add some performance instrumentation in the e2e test framework to find hotspots and measure progress. At the very last, make the "Loading event log..." step display a progress bar instead of just freezing the UI during load.
  - **Done:** Loading moved to a Web Worker so the main thread never freezes. Progress bar shows phase + percent during decode/normalize/synthesize/transfer. `PlayerEvent` timestamps converted from `Date` to `number` (~1.5 GB saved on the 10.5M-row dataset). `shallowRef` for the events array to avoid Vue deep-proxying millions of objects. Aggregation hot loops switched to ms math (no per-event `Date` allocation) and nested-Map keys (no per-event string concat). The worker streams the assembled event log back to the main thread in 100k-row chunks so the per-message structured-clone size cap doesn't apply to the total payload. The medium (us, 1.4M rows) dataset loads in ~2 seconds; the 6M-row "most" dataset loads in ~6 seconds.
  - **Known limitation:** The `full` (10.5M rows) dataset still fails with "Failed to fetch" inside hyparquet's decode pass — likely a worker-OOM during the parquet read itself, before we ever assemble the event log. It now fails **gracefully** with a "Failed to load data" error message instead of crashing the tab. Fully supporting it would likely require streaming directly into columnar typed arrays via `parquetReadColumn` (one column at a time) plus rewriting the aggregations to operate column-wise — substantial enough to warrant its own task.

- TASK-700 [TODO]: Misc visual polish.
    - Delete "Hourly screen-event traffic" subtitle
    - On time-series chart, change "screen events / hour" text -> "activity"
    - Move the time-series legend below the chart instead of above it.
    - When "group by" is active, can we make the legend clickable, such that when the user clicks on a dimension legend label, the other values for that dimension temporarily toggle hidden? Similar to the behavior of Grafana time-series charts.
    - Make the UI expand horizontally, responsive to the browser width.