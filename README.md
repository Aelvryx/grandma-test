# The Grandma Test

Seven core Marxist concepts in plain English, plus an active-recall practice loop and a 14-week route from reading to teaching.

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

The tests lock the seven-concept practice contract, safe progress-state recovery, rating and selection behaviour, the complete 14-week schedule, and the HTML/model identity boundary.
