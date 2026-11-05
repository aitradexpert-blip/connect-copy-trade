# Project Architecture Rules

- Extend `master-position-sync` and its existing broker-close paths for trade-close workflows instead of introducing a parallel VPS integration; this preserves the app's established sequential terminal handling.