// Seed content for the RAG chatbot demo.
// Citations are referenced inline in the answer text as [[N]] tokens.

window.PYDOCS_DATA = {
  conversations: [
    { id: 'c1', title: 'asyncio.gather vs TaskGroup', ago: '2m',  active: true },
    { id: 'c2', title: 'Dataclasses with slots',       ago: '1h'  },
    { id: 'c3', title: 'pathlib vs os.path',           ago: '3h'  },
    { id: 'c4', title: 'Type hints with Generic',      ago: 'Tue' },
    { id: 'c5', title: 'Why is GIL going away?',       ago: 'Tue' },
    { id: 'c6', title: '__init_subclass__ examples',   ago: 'Mon' },
    { id: 'c7', title: 'Walrus operator gotchas',      ago: 'May 5' },
    { id: 'c8', title: 'functools.cache vs lru_cache', ago: 'May 4' },
  ],

  userQuestion: "What's the difference between asyncio.gather() and asyncio.TaskGroup, and when should I use each?",

  // ── streamed answer ─────────────────────────────────────────────────
  // Use [[N]] tokens for citations (resolved at render time).
  // Use ```py blocks for code (rendered with the syntax highlighter).
  // Use **bold** and `inline` and bullet lines starting with "- ".
  answer: [
    "Both [[1]] `asyncio.gather()` and `asyncio.TaskGroup` schedule several coroutines to run concurrently — but they differ in **how failures propagate** and how lifetimes are managed.[[2]]",

    "`asyncio.gather()` is the older API. It returns results in the same order you passed the awaitables. By default, if one coroutine raises, the others keep running and `gather` re-raises only the first exception; the rest are silently discarded unless you pass `return_exceptions=True`.[[3]]",

    "```py\nimport asyncio\n\nasync def fetch(url: str) -> str:\n    # simulated I/O\n    await asyncio.sleep(0.1)\n    return url.upper()\n\nasync def main() -> None:\n    results = await asyncio.gather(\n        fetch(\"https://a\"),\n        fetch(\"https://b\"),\n        return_exceptions=True,\n    )\n    print(results)\n\nasyncio.run(main())\n```",

    "`asyncio.TaskGroup`, introduced in **Python 3.11**, is a structured-concurrency primitive. It is used as an `async with` block, and when any task raises, the group cancels every sibling task and re-raises the collected errors as an `ExceptionGroup`.[[4]]",

    "```py\nimport asyncio\n\nasync def fetch(url: str) -> str:\n    await asyncio.sleep(0.1)\n    return url.upper()\n\nasync def main() -> None:\n    async with asyncio.TaskGroup() as tg:\n        a = tg.create_task(fetch(\"https://a\"))\n        b = tg.create_task(fetch(\"https://b\"))\n    # tasks are guaranteed to be done here\n    print(a.result(), b.result())\n\nasyncio.run(main())\n```",

    "**When to use which:**",

    "- Reach for `TaskGroup` for new code — failures are contained, cancellation is automatic, and exceptions surface as an `ExceptionGroup` you can `except*`.[[4]]",
    "- Use `gather()` when you need fine control over which exceptions propagate, want a flat list of results in input order, or have to support pre-3.11 runtimes.[[3]]",
    "- Avoid mixing the two within the same logical scope — `gather()` does not respect a surrounding `TaskGroup`'s cancellation semantics.[[2]]",
  ].join('\n\n'),

  citations: [
    {
      n: 1,
      title: 'asyncio — Asynchronous I/O',
      path: 'library/asyncio.html',
      version: 'Python 3.13',
      anchor: '#module-asyncio',
      quote: "This module provides infrastructure for writing single-threaded concurrent code using coroutines, multiplexing I/O access over sockets and other resources, running network clients and servers, and other related primitives.",
      highlight: 'concurrent code using coroutines',
      excerpt: "asyncio is used as a foundation for multiple Python asynchronous frameworks that provide high-performance network and web-servers, database connection libraries, distributed task queues, etc. It is often a perfect fit for IO-bound and high-level structured network code.",
    },
    {
      n: 2,
      title: 'Coroutines and Tasks — Running Tasks Concurrently',
      path: 'library/asyncio-task.html',
      version: 'Python 3.13',
      anchor: '#running-tasks-concurrently',
      quote: "Awaitables passed to gather() and tasks scheduled by a TaskGroup both run concurrently in the event loop, but only a task group will cancel its siblings when one fails.",
      highlight: 'cancel its siblings when one fails',
      excerpt: "Use TaskGroup when you want failure to cancel the rest of the group. Use gather() when you specifically need return_exceptions semantics, or when interoperating with code that pre-dates structured concurrency.",
    },
    {
      n: 3,
      title: 'asyncio.gather()',
      path: 'library/asyncio-task.html',
      version: 'Python 3.13',
      anchor: '#asyncio.gather',
      quote: "If return_exceptions is False (default), the first raised exception is immediately propagated to the task that awaits on gather(). Other awaitables in the aws sequence won't be cancelled and will continue to run.",
      highlight: "won't be cancelled and will continue to run",
      excerpt: "If gather() is cancelled, all submitted awaitables (that have not completed yet) are also cancelled. If any child of the gather() is cancelled, it is treated the same as if it raised CancelledError.",
    },
    {
      n: 4,
      title: 'Task Groups',
      path: 'library/asyncio-task.html',
      version: 'Python 3.13',
      anchor: '#task-groups',
      quote: "When any of the tasks belonging to the group fails with an exception other than asyncio.CancelledError, the remaining tasks in the group are cancelled.",
      highlight: 'remaining tasks in the group are cancelled',
      excerpt: "The async with statement will wait for all tasks in the group to finish. While waiting, new tasks may still be added to the group (for example, by passing tg into one of the coroutines and calling tg.create_task() in that coroutine). Once the last task has finished and the async with block is exited, no new tasks may be added to the group.",
    },
  ],

  followups: [
    "Show me how except* unpacks an ExceptionGroup",
    "What changed for asyncio in Python 3.12?",
    "How do I add a timeout to a TaskGroup?",
  ],
};
