"""Join actuals with forecasts (no data leakage) and compute accuracy metrics."""

import numpy as np
import pandas as pd


def _frame(records: list[dict], value_col: str) -> pd.DataFrame:
    if not records:
        return pd.DataFrame()
    df = pd.DataFrame(records).rename(columns={"generation": value_col})
    df["start_time"] = pd.to_datetime(df["start_time"], utc=True)
    return df


def _actuals_df(records: list[dict]) -> pd.DataFrame:
    df = _frame(records, "actual_mw")
    if df.empty:
        return pd.DataFrame(columns=["start_time", "actual_mw"])
    return (
        df.drop_duplicates("start_time", keep="last")
        .sort_values("start_time")[["start_time", "actual_mw"]]
    )


def _forecasts_df(records: list[dict]) -> pd.DataFrame:
    df = _frame(records, "forecast_mw")
    if df.empty:
        return pd.DataFrame(columns=["start_time", "publish_time", "forecast_mw"])
    df["publish_time"] = pd.to_datetime(df["publish_time"], utc=True)
    return df.sort_values(["start_time", "publish_time"])[
        ["start_time", "publish_time", "forecast_mw"]
    ]


def build_matched_dataset(
    actuals: list[dict], forecasts: list[dict], cutoff_offset_hours: int = 0
) -> pd.DataFrame:
    """
    Match each 30-min delivery interval to the latest WINDFOR forecast published
    strictly before the decision cutoff, which is `cutoff_offset_hours` before
    00:00 UTC on the delivery day. Offset 0 = midnight; offset 13 = 11:00 UTC on
    D-1, roughly the day-ahead auction gate closure. Later forecasts are never
    used, so there is no leakage.
    """
    a = _actuals_df(actuals)
    f = _forecasts_df(forecasts)
    if a.empty or f.empty:
        return pd.DataFrame()

    cutoff = f["start_time"].dt.normalize() - pd.Timedelta(hours=cutoff_offset_hours)
    f = (
        f[f["publish_time"] < cutoff]
        .sort_values("publish_time")
        .drop_duplicates("start_time", keep="last")
        .rename(columns={"publish_time": "forecast_publish_time"})
        .sort_values("start_time")
    )
    if f.empty:
        return pd.DataFrame()

    # WINDFOR is hourly while FUELHH actuals are half-hourly: carry each forecast
    # forward to the following :30 interval so every actual is evaluated.
    df = pd.merge_asof(
        a.sort_values("start_time"),
        f,
        on="start_time",
        direction="backward",
        tolerance=pd.Timedelta("30min"),
    ).dropna(subset=["forecast_mw"])
    if df.empty:
        return df

    df["error_mw"] = df["forecast_mw"] - df["actual_mw"]
    df["abs_error_mw"] = df["error_mw"].abs()
    df["delivery_date"] = df["start_time"].dt.date
    return df.sort_values("start_time").reset_index(drop=True)


def compute_accuracy_metrics(matched_df: pd.DataFrame) -> dict:
    """MAE, RMSE, bias and MAPE in MW / percent."""
    if matched_df.empty:
        return {}

    errors = matched_df["error_mw"].dropna()
    actuals = matched_df.loc[errors.index, "actual_mw"]
    mae = float(errors.abs().mean())
    rmse = float(np.sqrt((errors**2).mean()))
    bias = float(errors.mean())

    nonzero = actuals > 10  # avoid division artefacts near zero
    mape = float((errors[nonzero].abs() / actuals[nonzero]).mean() * 100) if nonzero.any() else None

    return {
        "n_matched": len(errors),
        "mae_mw": round(mae, 1),
        "rmse_mw": round(rmse, 1),
        "bias_mw": round(bias, 1),
        "mape_pct": round(mape, 2) if mape is not None else None,
        "mae_interpretation": (
            f"On average the wind forecast was off by {mae:.0f} MW. "
            f"{'Over' if bias > 0 else 'Under'}-forecasting wind by {abs(bias):.0f} MW "
            f"on average. Procure an additional buffer of ~{mae:.0f} MW."
        ),
    }


def compute_daily_metrics(matched_df: pd.DataFrame) -> list[dict]:
    if matched_df.empty:
        return []
    return (
        matched_df.groupby("delivery_date")["error_mw"]
        .agg(
            daily_mae=lambda x: np.mean(np.abs(x)),
            daily_bias=lambda x: np.mean(x),
            n=len,
        )
        .reset_index()
        .to_dict("records")
    )


def compute_hourly_metrics(matched_df: pd.DataFrame) -> list[dict]:
    if matched_df.empty:
        return []
    df = matched_df.assign(hour=matched_df["start_time"].dt.hour)
    return (
        df.groupby("hour")["error_mw"]
        .agg(
            hourly_mae=lambda x: np.mean(np.abs(x)),
            hourly_bias=lambda x: np.mean(x),
            n=len,
        )
        .reset_index()
        .to_dict("records")
    )


def matched_df_to_json(matched_df: pd.DataFrame) -> list[dict]:
    if matched_df.empty:
        return []
    df = matched_df.copy()
    df["start_time"] = df["start_time"].dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    df["forecast_publish_time"] = df["forecast_publish_time"].dt.strftime("%Y-%m-%dT%H:%M:%SZ")
    df["delivery_date"] = df["delivery_date"].astype(str)
    return df.to_dict("records")
