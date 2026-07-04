import { useState, useEffect, useRef, useCallback } from 'react';

/**
 * Hook de Polling Cliente -> Servidor Local
 * Totalmente desacoplado de la lógica de Redux/Context existente.
 */
const usePolling = ({ 
  defaultInterval = 5000, 
  longInterval = 15000, 
  idleCycles = 3,
  onNewData 
}) => {
  const [isPolling, setIsPolling] = useState(true);
  const [error, setError] = useState(null);
  const [networkError, setNetworkError] = useState(false);
  
  const lastTimestampRef = useRef(new Date(Date.now() - 60000).toISOString());
  const emptyCyclesRef = useRef(0);
  const timeoutRef = useRef(null);
  const isVisibleRef = useRef(true);
  const abortControllerRef = useRef(null);
  const isMountedRef = useRef(true);

  const fetchUpdates = useCallback(async () => {
    if (!isVisibleRef.current || !isPolling) return;

    abortControllerRef.current = new AbortController();

    try {
      // Ajusta la URL si tu endpoint backend corre en otro puerto diferente al frontend
      // Asumimos que usa el proxy del package.json o la ruta relativa.
      const url = `/api/polling/updates?since=${lastTimestampRef.current}`;
      
      const response = await fetch(url, {
        signal: abortControllerRef.current.signal
      });
      
      if (!response.ok) throw new Error(`HTTP status ${response.status}`);
      
      const data = await response.json();
      
      if (isMountedRef.current) {
        setNetworkError(false);
        setError(null);
        
        if (data.success) {
          if (data.updates && data.updates.length > 0) {
            emptyCyclesRef.current = 0;
            lastTimestampRef.current = data.serverTimestamp || new Date().toISOString();
            
            if (onNewData) {
              onNewData(data.updates, data.activeAgents);
            }
          } else {
            emptyCyclesRef.current++;
            if (onNewData && data.activeAgents) {
              onNewData([], data.activeAgents);
            }
          }
        }
      }
    } catch (err) {
      if (err.name !== 'AbortError') {
        if (isMountedRef.current) {
          setError(err);
          setNetworkError(true);
        }
      }
    } finally {
      if (isMountedRef.current && isPolling && isVisibleRef.current) {
        const nextInterval = emptyCyclesRef.current >= idleCycles ? longInterval : defaultInterval;
        timeoutRef.current = setTimeout(fetchUpdates, nextInterval);
      }
    }
  }, [isPolling, defaultInterval, longInterval, idleCycles, onNewData]);

  useEffect(() => {
    isMountedRef.current = true;
    if (isPolling && isVisibleRef.current) {
      fetchUpdates();
    }
    return () => {
      isMountedRef.current = false;
      if (timeoutRef.current) clearTimeout(timeoutRef.current);
      if (abortControllerRef.current) abortControllerRef.current.abort();
    };
  }, [isPolling, fetchUpdates]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      isVisibleRef.current = document.visibilityState === 'visible';
      if (isVisibleRef.current && isPolling) {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        fetchUpdates();
      } else {
        if (timeoutRef.current) clearTimeout(timeoutRef.current);
        if (abortControllerRef.current) abortControllerRef.current.abort();
      }
    };
    document.addEventListener('visibilitychange', handleVisibilityChange);
    return () => document.removeEventListener('visibilitychange', handleVisibilityChange);
  }, [isPolling, fetchUpdates]);

  return { error, networkError, isPolling, setIsPolling };
};

export default usePolling;
