## Design

This is a small demo app for data analysis & visualization. Its purpose is to help the developers of a mobile puzzle game to better understand behavioral trends among game players. Important trends to study include the likelihood of returning to the game repeatedly, or of making an in-app purchase, conditional on player demographics and/or exposure to different experimental variants of the game. The app will accomplish this by reading event logs recorded by the game system, and creating an interactive visual display to explore that data.

(important clarification: in this repo, "player" means a person who uses the mobile puzzle game; "user" means the game developer who is interacting with the analysis app).

This app will bundle together a pre-provisioned dataset and a lightweight web server that presents a browser-based interface to explore that dataset. The app shall be packaged as a single Docker container that exposes the web server on port 8000. The dataset will be provided as a directory of one or more Parquet files. These are stored in this repo under the path data/, and shall be mounted into the container at runtime using a Docker mount at the path /data.

No back-end database is required, since there is no need to store state across sessions. All state should be handled client-side in the browser.

The front-end shall be implemented in TypeScript & Vue 3 (Composition API with `<script setup>` single-file components) with a tasteful, professional UI theme - think Edward Tufte. Built with Vite, which uses esbuild for dev transforms and Rollup for production bundles. Package manager: Yarn. It is OK to use modern web technology; support for pre-2026 browsers is not required.

The back-end shall be implemented in Python 3.14 with FastAPI + uvicorn and the classic pandas/pyarrow tools for working with Parquet dataframes. Its primary job is to serve the built front-end assets as static files and to stream the Parquet data from `/data` to the browser.

We strive to implement all data processing/filtering on the client browser side. (i.e. the server should just provide the Parquet data to the client as a blob, and the client code should take care of filtering and other calculations to drive the UI). This avoids the need to design a complex API protocol to send and answer queries. We may revisit this decision if it becomes too cumbersome or resource-intensive to do all of the processing client-side.

## Event log schema

The input data consists of a single large table of "events" where each row represents one event, i.e. an action taken by a player in the game. Important columns:

- `ts`: UTC timestamp of the event
- `user_id_hash`: string that uniquely identifies an individual player
- `user_create_time`: UTC timestamp of the player account creation
- `country`: 2-letter ISO code for the player's country.
  - The dataset may include players from dozens of countries. To simplify the analysis UI, instead of working with raw `country` values, classify `country` as follows:
    - `us`,`ca`,`gb`,`ie`,`au`,`nz`: classify collectively as `ENG` for "English-speaking" countries.
    - `kr`,`tw`,`jp`: retain these literal values for Korea, Taiwan, and Japan, respectively. (these are main markets for the game).
    - `fr`,`de`,`za`,`tr`,`nl`,`it`,`pl`,`ua`,`se`,`es`,`ro`,`fi`,`ch`,`cz`,`be`,`at`,`pt`,`hu`: classify collectively as `EUR` for key European countries.
    - all other values: classify collectively as `Other`.
- `platform`: `ios`, `android`, or `web`
- `join_week`: UTC timestamp of the player account, quantized to the nearest week. This is useful for analyzing the behavior of successive cohorts of players, to look for seasonal effects.
- `event`: Names the event that took place. See below for important event codes.
- `screen_name`: Only for `event: "screen"` events, this is the name of the game screen the player visited.
- `experiment_id`/`variation_id`: Only for `event: "experiment_viewed"` events. This specifies the experiment name and variation the player was exposed to.

### Event names

- `problem_set_started`: The player began working on a puzzle set in the game.
- `problem_set_completed`: The player finished a puzzle set in the game.
- `lesson_started`: The player began taking a lesson in the game.
- `returned_1d`, `returned_2d`, `returned_3d`, `returned_5d`, `returned_7d`: The player returned to the app on the Nth day after account creation. (* these are synthetic events derived from the `screen` event occurring in specific time windows since account creation; see TASK-450).
- `pve_game_started`: The player began playing a match against an AI opponent.
- `pvp_game_started`: The player began playing a match against a human opponent.
- `sub_buy_start`: The player started the flow to purchase an in-app subscription.
- `sub_buy_success`: The player completed the flow to purchase an in-app subscription.
- `screen`: The player visited a specific screen in the game. The screen is in the `screen_name` column.
- `experiment_viewed`: The player was exposed to an experimental variation (an A/B test). The experiment name and variation are in the `experiment_id` and `variation_id` columns respectively.

This is not a complete list. Other events may be present in the data.

## Guidelines & Coding Conventions

- This is a self-contained demo app. It should ship as a single, lightweight Docker container. The container should not consume more than ~2GB RAM. The Dockerfile should be optimized such that incremental changes to app code can be rebuilt quickly, by leveraging the standard Docker layer cache.
- Test coverage goal is 80%+, including unit tests and an end-to-end test. This coverage goal does not apply to imported library code, only "novel" code in this repo.
- When making code changes, avoid making whitespace changes in code lines not related to the primary change.
- In TypeScript files, prefer `// ...` style comments. Only use `/* ...  */` for large multi-line block comments. Use `/** ... */` for JSDoc compliant comments where appropriate.
- Use `ruff` for Python lint + format; `eslint` + `prettier` for TypeScript.
- Keep `TODO.md` updated to reflect the current state of the project tasks.
  - When you finish implementing a task (tests green + verified working), the **final action** before reporting back to the user is to mark that task `[DONE]` in `TODO.md`. Re-read the file afterwards to confirm the change actually landed — don't trust the prior `Edit` blindly, since the file may have been concurrently modified by the user or a linter.
  - If you start a non-trivial task, mark it `[INPROGRESS]` first so the state is visible.

## Testing

### Prerequisites

- If the Docker socket is not responsive, then the Docker daemon might not be started. Ask the user to start Docker Desktop.

### Test frameworks

- Python unit tests: `pytest` with `coverage.py` for coverage measurement.
- Front-end unit tests: `vitest`.
- End-to-end tests: `playwright`, driving a real browser against the built Docker container.

### Running the test suite

One-time setup (installs backend, frontend, and e2e dev deps; downloads the Playwright Chromium browser):

```sh
make install
```

Then:

```sh
make test            # all three suites: backend, frontend, e2e
make test-backend    # pytest only (fast)
make test-frontend   # vitest only (fast)
make test-e2e        # builds the Docker image and runs Playwright against it
```

`make test-e2e` requires the Docker daemon to be running — it builds the image (`make build`) and then Playwright launches it via `docker run`, mounting `./data` into the container at `/data`. The container is torn down automatically when the test run ends.

Other helpful targets: `make build`, `make run`, `make lint`, `make fmt`, `make typecheck`, `make clean`. Run `make help` for the full list.

## Updating Dependencies

Always run the test suite after updating dependencies to confirm nothing is broken.

### Resolutions

When updating packages, don't just bump the version spec in package.json, also check whether any related "resolutions" must also be updated.

### Types

@types/* packages should be updated together with the package they provide types for.

### Security Updates

When updating packages to fix security vulnerabilities (e.g. via `yarn audit` or manual request), if the package is not a direct dependency in package.json, first try to update the parent dependency that pulls it in. (though only if it can be done cleanly, with minimal code changes). As a fallback, update the vulnerable package directly using a "resolution".
