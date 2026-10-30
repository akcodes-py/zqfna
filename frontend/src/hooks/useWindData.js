import { useCallback, useEffect, useState } from "react";
import { api } from "../api/client";

function useAsync(load, deps, enabled = true) {
  const [state, setState] = useState({ data: null, loading: true, error: null });
  const [tick, setTick] = useState(0);
  const [slow, setSlow] = useState(false);

  useEffect(() => {
    let active = true;
    if (!enabled) {
      setState({ data: null, loading: false, error: null });
      setSlow(false);
      return () => {
        active = false;
      };
    }
    setState((s) => ({ ...s, loading: true, error: null }));
    setSlow(false);
    // Free hosting sleeps when idle; tell the user instead of showing a silent spinner.
    const timer = setTimeout(() => active && setSlow(true), 4000);
    load()
      .then((data) => active && setState({ data, loading: false, error: null }))
      .catch((e) => active && setState({ data: null, loading: false, error: e.message }));
    return () => {
      active = false;
      clearTimeout(timer);
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [...deps, tick, enabled]);

  const retry = useCallback(() => setTick((t) => t + 1), []);
  return { ...state, slow: slow && state.loading, retry };
}

export function useAccuracy(offset, enabled = true) {
  return useAsync(
    () =>
      Promise.all([api.getAccuracy(offset), api.getDailyAccuracy(offset), api.getHourlyAccuracy(offset)]).then(
        ([aggregate, daily, hourly]) => ({ aggregate, daily, hourly })
      ),
    [offset],
    enabled
  );
}

export function useAllMatched(offset, enabled = true) {
  return useAsync(() => api.getMatched(offset), [offset], enabled);
}

export function useMatchedData(deliveryDate, offset, enabled = true) {
  const { data, loading, error, slow, retry } = useAsync(
    () =>
      Promise.all([api.getMatched(offset, deliveryDate), api.getForecastVintages(offset, deliveryDate)]).then(
        ([rows, vintages]) => ({ rows, vintages })
      ),
    [deliveryDate, offset],
    enabled
  );
  return { data: data?.rows ?? [], vintages: data?.vintages ?? null, loading, error, slow, retry };
}
