| ID | Test | Input | Expected |
|---|---|---|---|
| T1 | Filter by single type | GET /events?type=crime | Only events where `type` === "crime" returned (8 records) |
| T2 | Filter by multiple types | GET /events?type=crime,weather | Events with type "crime" OR "weather" returned |
| T3 | Filter by risk range | GET /events?min_risk=60&max_risk=100 | Events with 60 <= risk_score <= 100 returned |
| T4 | Boundary value low | GET /events?min_risk=0&max_risk=0 | Only events with risk_score == 0 returned |
| T5 | Boundary values edges | GET /events?min_risk=30&max_risk=31 | Events with risk_score 30 or 31 returned |
| T6 | Invalid param (min<0) | GET /events?min_risk=-10 | HTTP 400 + JSON error |
| T7 | Invalid param (max>100) | GET /events?max_risk=200 | HTTP 400 + JSON error |
| T8 | min > max | GET /events?min_risk=80&max_risk=20 | HTTP 400 + JSON error |
| T9 | Empty dataset | Start server using sample_events_empty.json | API returns [] and UI shows "No events" (no console errors) |
| T10 | Missing-type fallback | GET /events?type=unknown | Events with `type` === "unknown" returned (evt-0035) |
