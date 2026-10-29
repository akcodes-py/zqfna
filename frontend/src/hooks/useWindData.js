import { useState, useEffect } from "react";
import { api } from "../api/client";

export function useAccuracy() {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    setLoading(true);
    Promise.all([api.getAccuracy(), api.getDailyAccuracy(), api.getHourlyAccuracy()])
      .then(([aggregate, daily, hourly]) => {
        setData({ aggregate, daily, hourly });
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}

export function useMatchedData(deliveryDate) {
  const [data, setData] = useState([]);
  const [vintages, setVintages] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    if (!deliveryDate) return;
    setLoading(true);
    Promise.all([
      api.getMatched(deliveryDate),
      api.getForecastVintages(deliveryDate),
    ])
      .then(([matched, vintageInfo]) => {
        setData(matched);
        setVintages(vintageInfo);
      })
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, [deliveryDate]);

  return { data, vintages, loading, error };
}

export function useAllMatched() {
  const [data, setData] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  useEffect(() => {
    api.getMatched()
      .then(setData)
      .catch((e) => setError(e.message))
      .finally(() => setLoading(false));
  }, []);

  return { data, loading, error };
}
