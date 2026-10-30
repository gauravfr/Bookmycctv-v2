import { useCallback, useEffect, useRef, useState } from 'react';
import { ApiClientError } from '@/services/api-client';
export interface AsyncState<T> {
  data: T | null;
  loading: boolean;
  error: ApiClientError | null;
  reload: () => void;
}
export function useAsyncResource<T>(
  loader: () => Promise<T>,
  dependencies: readonly unknown[] = [],
): AsyncState<T> {
  const [data, setData] = useState<T | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<ApiClientError | null>(null);
  const [revision, setRevision] = useState(0);
  const active = useRef(0);
  const reload = useCallback(() => setRevision((value) => value + 1), []);
  useEffect(() => {
    const id = ++active.current;
    setLoading(true);
    setError(null);
    loader()
      .then((value) => {
        if (id === active.current) setData(value);
      })
      .catch((reason) => {
        if (id === active.current)
          setError(
            reason instanceof ApiClientError
              ? reason
              : new ApiClientError(0, 'UNEXPECTED_ERROR', 'Something went wrong.'),
          );
      })
      .finally(() => {
        if (id === active.current) setLoading(false);
      });
    return () => {
      active.current++;
    };
  }, [revision, ...dependencies]);
  return { data, loading, error, reload };
}
export function useMutation<TInput, TOutput>(mutation: (input: TInput) => Promise<TOutput>) {
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<ApiClientError | null>(null);
  const run = useCallback(
    async (input: TInput) => {
      if (loading)
        throw new ApiClientError(
          409,
          'DUPLICATE_SUBMISSION',
          'This action is already in progress.',
        );
      setLoading(true);
      setError(null);
      try {
        return await mutation(input);
      } catch (reason) {
        const mapped =
          reason instanceof ApiClientError
            ? reason
            : new ApiClientError(0, 'UNEXPECTED_ERROR', 'Something went wrong.');
        setError(mapped);
        throw mapped;
      } finally {
        setLoading(false);
      }
    },
    [loading, mutation],
  );
  return { run, loading, error, clearError: () => setError(null) };
}
