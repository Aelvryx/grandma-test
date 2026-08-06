# The Grandma Test

Eight core Marxist concepts in plain English, plus an active-recall practice loop and a 16-week route from reading to teaching.

The application is completely client-side. Practice ratings, attempts and programme dates stay in local browser storage and are not transmitted anywhere.

## Run locally

```sh
python3 -m http.server 4174
```

## Verify

```sh
npm ci
npm run check
```

The tests lock the eight-concept practice contract, safe progress-state migration and recovery, rating and selection behaviour, the complete 16-week schedule, and the HTML/model identity boundary.
