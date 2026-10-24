# Data analysis

The submitted archive was retrieved from the two specified Elexon stream endpoints. The app does not create a new wind forecasting model; it evaluates the public forecasts that were available to the decision maker.

## Time scope and alignment

- Decision dates: 1–31 January 2026 inclusive.
- Delivery dates: 2 January–1 February 2026 inclusive.
- Forecast publication requests: 31 December 2025–31 January 2026 inclusive. The preceding day supports an early January 1 cutoff if necessary.
- Actual settlement requests: 1 January–1 February 2026 inclusive. The January 1 boundary data are not added to the January decision evaluation.
- Each delivery day has 48 half-hour starts. Native WINDFOR targets in this archive occur at minute 00, producing 24 forecasts per delivery day at the supplied cutoffs.
- The exact timestamp join scores 24 points per delivery day and 744 over the month. There are no fabricated half-hour forecasts. The hourly forecast at 01:00 is compared with the half-hour actual whose startTime is exactly 01:00, not with an invented hourly outturn average.

## Definitions

For matched target i, let Fᵢ be the latest eligible forecast and Aᵢ the recorded wind outturn.

`eᵢ = Fᵢ − Aᵢ`

| Metric | Formula | Interpretation |
|---|---|---|
| MAE | Σ|eᵢ| / n | Typical absolute difference |
| RMSE | √(Σeᵢ² / n) | Greater sensitivity to large differences |
| Bias | Σeᵢ / n | Positive: forecast exceeded actual wind |
| WAPE | 100 × Σ|eᵢ| / ΣAᵢ | Weighted relative error; undefined if total actual is zero |
| Overforecast share | 100 × count(eᵢ > 0) / n | Frequency of wind shortfall exposure |

All source power values and calculations are in MW. The UI converts to GW only for display. An arithmetic mean over hourly forecast targets is not asserted to be the complete day's average energy production. No MWh figure is inferred from missing targets.

## Measured January result

At the 09:50 GMT cutoff:

| Quantity | Result |
|---|---:|
| Matched points | 744 |
| MAE | 1,995.5685 MW |
| RMSE | 2,498.8245 MW |
| Bias | +1,727.9825 MW |
| WAPE | 17.682578% |
| Overforecast share | 84.274194% |
| P90 absolute difference | 4,183.9 MW |

The positive bias and high overforecast share make shortfall direction worth examining. They do **not** establish that a utility should purchase 1.728 GW: the pilot lacks the utility's demand, contracted share, other resources, constraints and risk policy. They also do not prove the entire difference is forecast error in the meteorological sense. Metering scope and curtailment are potential contributors to the series difference and should be reconciled in a production study.

## Demonstration decision

For the decision on 14 January at 09:50 GMT, delivery is 15 January. The selected latest publication is 14 January at 09:30 GMT.

| Quantity | Result |
|---|---:|
| Mean of native forecast targets | 11,678 MW |
| Peak native forecast target | 15,828 MW |
| Matched mean actual | 10,584.375 MW |
| MAE | 1,093.625 MW |
| Bias | +1,093.625 MW |
| RMSE | 1,229.3977 MW |
| Targets with overforecast | 24 of 24 |
| Earlier completed-delivery risk samples | 288 from 12 delivery days |
| Empirical P90 shortfall scenario | 4,604.3 MW |

Moving the cutoff to 09:20 excludes the 09:30 publication and chooses the eligible 07:30 issue for this delivery. The forecast mean becomes 11,609.5833 MW. The system uses publication timestamps returned by the source, rather than assuming an issue schedule from documentation.

The historical P90 scenario is based only on information available before this decision. It must not use the actual 15 January outturn or other outcomes that had not been published by 14 January at 09:50. Early decisions have insufficient in-scope history and display that condition explicitly.

## Source limitations

The retrieved archive is a reproducible current historical extract, not proof that the source never revised or backfilled an old record. We preserve returned publishTime values and retrieval timestamps. A production archival service should capture publication events continuously and preserve arrival time as well as the provider's issue time. Current sample coverage must not be generalized to every Elexon date without checking it.
