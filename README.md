# Overview

This is a demo of data analysis & visualization, making use of a dataset from one of my side projects, a [mobile puzzle game](https://badukpop.com).

As a game developer, it is vital to understand the drivers of user behavior. What aspects of the app, and of user demographics, correlate with important business outcomes, like user retention and monetization?

To answer this question, we'll analyze event logs recorded by the game server. An event is recorded each time a user takes a significant action, like navigating in the game UI, starting a puzzle, or entering a purchase flow.

Below is a sample of the raw input data. The event log schema is intentionally denormalized - repeating user attributes like `country` redundantly in each event row - in order to simplify query construction.

```
+---------------------------+----------------------------------+---------+----------+---------------------------+---------------------------+-------------------+--------------------+----------------------+--------------+
| ts                        | user_id_hash                     | country | platform | user_create_time          | join_week                 | event             | screen_name        | experiment_id        | variation_id |
|---------------------------+----------------------------------+---------+----------+---------------------------+---------------------------+-------------------+--------------------+----------------------+--------------|
| 2026-05-02 06:15:28+00:00 | 9170769c3b9b6d45f9152a05cccfce9a | ca      | android  | 2026-05-01 17:05:45+00:00 | 2026-04-27 00:00:00+00:00 | screen            | GameSelect         |                      |              |
| 2026-05-02 06:15:28+00:00 | 9170769c3b9b6d45f9152a05cccfce9a | ca      | android  | 2026-05-01 17:05:45+00:00 | 2026-04-27 00:00:00+00:00 | screen            | SubscriptionBundle |                      |              |
| 2026-05-02 06:15:28+00:00 | 9170769c3b9b6d45f9152a05cccfce9a | ca      | android  | 2026-05-01 17:05:45+00:00 | 2026-04-27 00:00:00+00:00 | experiment_viewed |                    | automatch            | on           |
| 2026-05-02 06:15:28+00:00 | 9170769c3b9b6d45f9152a05cccfce9a | ca      | android  | 2026-05-01 17:05:45+00:00 | 2026-04-27 00:00:00+00:00 | experiment_viewed |                    | tutorial_video       | off          |
| 2026-05-02 06:15:30+00:00 | 9170769c3b9b6d45f9152a05cccfce9a | ca      | android  | 2026-05-01 17:05:45+00:00 | 2026-04-27 00:00:00+00:00 | screen            | GameSelect         |                      |              |
| 2026-05-02 06:15:32+00:00 | 9170769c3b9b6d45f9152a05cccfce9a | ca      | android  | 2026-05-01 17:05:45+00:00 | 2026-04-27 00:00:00+00:00 | screen            | PvEStarter         |                      |              |
| 2026-05-02 06:15:58+00:00 | 9170769c3b9b6d45f9152a05cccfce9a | ca      | android  | 2026-05-01 17:05:45+00:00 | 2026-04-27 00:00:00+00:00 | pve_game_started  |                    |                      |              |
| 2026-05-02 06:15:58+00:00 | 9170769c3b9b6d45f9152a05cccfce9a | ca      | android  | 2026-05-01 17:05:45+00:00 | 2026-04-27 00:00:00+00:00 | screen            | PvEScreen          |                      |              |
| 2026-05-02 06:19:42+00:00 | 10155a76a44f167d1454aaf1ff3281fb | ca      | ios      | 2026-05-02 06:19:42+00:00 | 2026-04-27 00:00:00+00:00 | experiment_viewed |                    | lddk_rank_lessons    | off          |
| 2026-05-02 06:19:42+00:00 | 10155a76a44f167d1454aaf1ff3281fb | ca      | ios      | 2026-05-02 06:19:42+00:00 | 2026-04-27 00:00:00+00:00 | experiment_viewed |                    | sub_sku_annual_only  | on           |
+---------------------------+----------------------------------+---------+----------+---------------------------+---------------------------+-------------------+--------------------+----------------------+--------------+
```

For this demo, I've bundled a full event log from a 1-month period (~10M events; ~50k users), as well as some smaller filtered subsets that load more quickly.

Normally, I'd analyze these logs, which are stored natively in a Postgres database, with heavyweight tools like Jupyter notebooks, `pandas`, and `matplotlib`. For this demo, I wanted to try building a lightweight, low-latency query & visualization dashboard as a self-contained web app, with all data processing entirely in client-side code.

I exported the raw data from the game server in Parquet format and, with the help of Claude Code, developed a Docker image that serves the event data and the web interface to analyze it.

The live instance is running at http://project-an-761414613.us-east-1.elb.amazonaws.com/

# Design Decisions & Tradeoffs

## Service decomposition

In order to deliver an interactive prototype in only a few hours, I decided to focus on creating a single Docker container that bundles the raw data, a lightweight HTTP server, and the front-end code. With zero external dependencies, the container would be simple to test and deploy.

As an experiment, I wanted to see how much data processing I could accomplish on the client side. I started with a "thin" HTTP server that just provides raw Parquet data to the client, and put the filtering and aggregation logic in the front end. It would be more conventional to filter and aggregate on the server side - this would be necessary to handle extremely large datasets of course - but this adds the complexity of defining more REST or GraphQL APIs to send queries, and adds round-trip latency. For this demo, I wanted to see if a "thin" server and "fat" client would be enough for useful work, and it actually turned out pretty well.

I picked back-end and front-end frameworks that I knew were lightweight, AI-friendly, and just featureful enough to support the intended application: Python / FastAPI for the HTTP service and TypeScript / Vue.js for the front-end.

## Agent use

I tried to make maximum use of Claude Code for this project, while still keeping manual control over the key design decisions. I started by writing a high-level spec in `AGENTS.md`. Then I listed specific tasks for the agent to take on, Jira style, in `TODO.md` (initially just TASK-000 to TASK-400; I added more tasks later as the app developed).

These two files, `AGENTS.md` and `TODO.md`, were the "seed" of the entire repo. I wrote ~90% of those files myself manually. The entire rest of this repo is agent-generated. (I also wrote this `README.md` manually, after the project was complete).

Before starting the implementation work, I asked Claude to read my `AGENTS.md` and `TODO.md`, find gaps and clear up any ambiguities.

Then, with the spec and task list ready, I instructed Claude to implement each TASK from `TODO.md`. The agent and I updated this file cooperatively; the agent marked tasks DONE as they were completed, and I kept adding new TASKs as we went along. Claude nearly one-shot every task, although it often needed a small manual "nudge" to fix implementation issues. I read each diff manually, putting most scrutiny on test coverage, data handling, & visual presentation, leaving the agent output mostly untouched on tedious details like CSS styles.

## Test coverage

I insisted that the agent maintain unit and end-to-end test suites with good coverage and fast execution. This enabled the agent to iterate on code changes in a closed loop without stopping for human input.

## Deployment

With the entire app bundled as a single, self-contained Docker image, it's trivial to run in the cloud and expose the web interface. I deployed the live instance as an AWS ECS task, reusing some pre-existing Terraform code I had already written for other purposes.

# Learnings & Iterations

## Agent workflow

The pairing of `AGENTS.md` (design spec) and `TODO.md` (task tracker) worked well. It took longer for me to write the spec and task list than for the agent to implement all of it in code. I thought about using the agent at an even higher level of abstraction - just giving it the design spec alone - but considered that too much of a stretch for this demo project, since I already knew the basic "shape" of what I needed to deliver, and wasn't sure the agent would be able to create a high-quality task breakdown in the available time.

## Agent mistakes

The agent generally implemented tasks to my satisfaction. The main gap was that the agent missed some obvious performance/memory optimizations, which are critical for this project since the browser is handling so much data processing. The agent's initial code failed to load the 10 million-row event log, hitting browser timeouts and JavaScript memory limits. I needed to "nudge" the agent with specific recommendations to fix these issues.

For example, TASK-450 asked the agent to scan the event log and insert synthetic events to represent players returning to the game within specific time intervals. The agent chose an algorithm that is O(N) in extra space and O(N*log(N)) in time -- N being the size of the event log -- it missed an obvious shortcut that accomplishes the same thing in O(1) space and O(N) time.

In addition, the agent first tried to implement the data ingestion and filtering as monolithic steps operating on the entire dataset at once. This exploded at N=10 million, causing browser timeouts. I nudged the agent to consider streaming/chunked processing, and the agent found alternative APIs that allowed it to ingest & filter the data in smaller batches, enabling it to handle N=10 million without breaking the browser.

# Future steps

## Higher Scale

The full dataset in this demo is near the limit we can reasonably handle with client-side data processing. Anything larger would call for server-side filtering & aggregation. In order of increasing complexity & performance, the options I'd choose are: in-memory, SQL-based (Postgres), columnar-store (e.g. Redshift, Clickhouse, or Snowflake), and at the largest scale, distributed map/reduce (e.g. Spark).

## Advanced Analysis

The activity chart and retention/monetization metrics only scratch the surface of what one can learn from this dataset. A useful next step would be to implement conversion funnel analysis: given a sequence of key events -- for example, "complete tutorial" to "start first puzzle" to "activate paid subscription" -- check the rate at which users successfully jump from one step to the next. This could be visualized as numeric conversion rates or a graphical Sankey chart. This way, we can identify the worst "churn points" where users stop progressing, and inspire new variations of the game design aimed at fixing these leaks.

# Time taken

Total approximately 7 hours.
  - 1h: AGENTS/TODO setup
  - 1h: Complete initial TASKS
  - 1h: Add TASKS for additional features
  - 2h: Optimize performance & polish UI
  - 1h: Deploy to the cloud
  - 1h: Write README & record demo