import { useEffect, useRef, useState } from 'react';

interface UseSSEOptions<TEvent> {
  onMessage: (data: TEvent) => void;
  onError?: (error: Event) => void;
  reconnect?: boolean;
  reconnectDelay?: number;
  headers?: Record<string, string>;
  body?: unknown;
  method?: 'GET' | 'POST';
}

interface UseSSEReturn {
  isConnected: boolean;
  error: Error | null;
  close: () => void;
}

/**
 * Custom hook for handling Server-Sent Events (SSE)
 *
 * Note: For POST requests with SSE, we use fetch with ReadableStream
 * because EventSource only supports GET requests.
 */
export function useSSE<TEvent = unknown>(
  url: string | null,
  options: UseSSEOptions<TEvent>
): UseSSEReturn {
  const [isConnected, setIsConnected] = useState(false);
  const [error, setError] = useState<Error | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const abortControllerRef = useRef<AbortController | null>(null);
  const reconnectTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const {
    onMessage,
    onError,
    reconnect = false,
    reconnectDelay = 3000,
    headers = {},
    body,
    method = 'POST',
  } = options;

  // Stringified keys are the real effect triggers. `body` / `headers` may be
  // fresh object literals on every render (e.g. `body: { content }`), so using
  // them directly in the deps array would reconnect on every render. Comparing
  // by serialized value keeps the connection stable for equivalent payloads.
  const bodyKey = JSON.stringify(body ?? null);
  const headersKey = JSON.stringify(headers ?? null);

  useEffect(() => {
    if (!url) return;

    let isMounted = true;

    const connectSSE = async () => {
      try {
        setError(null);

        if (method === 'POST' && body) {
          // For POST requests with body, use fetch with ReadableStream
          abortControllerRef.current = new AbortController();

          const response = await fetch(url, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Accept': 'text/event-stream',
              ...headers,
            },
            body: JSON.stringify(body),
            signal: abortControllerRef.current.signal,
          });

          if (!response.ok) {
            throw new Error(`HTTP error! status: ${response.status}`);
          }

          if (!response.body) {
            throw new Error('Response body is null');
          }

          setIsConnected(true);

          const reader = response.body.getReader();
          const decoder = new TextDecoder();
          let buffer = '';

          while (isMounted) {
            const { done, value } = await reader.read();

            if (done) {
              break;
            }

            buffer += decoder.decode(value, { stream: true });

            // Process complete SSE messages (separated by double newlines)
            const messages = buffer.split('\n\n');
            buffer = messages.pop() || ''; // Keep incomplete message in buffer

            for (const message of messages) {
              if (!message.trim()) continue;

              // Parse SSE format: "data: {...}"
              const lines = message.split('\n');
              for (const line of lines) {
                if (line.startsWith('data: ')) {
                  try {
                    const data: TEvent = JSON.parse(line.substring(6));
                    if (isMounted) {
                      onMessage(data);
                    }
                  } catch (parseError) {
                    if (import.meta.env.DEV) {
                      console.error('Failed to parse SSE data:', parseError);
                    }
                  }
                }
              }
            }
          }

          setIsConnected(false);
        } else {
          // For GET requests, use EventSource
          const eventSource = new EventSource(url);
          eventSourceRef.current = eventSource;

          eventSource.onopen = () => {
            if (isMounted) {
              setIsConnected(true);
            }
          };

          eventSource.onmessage = (event) => {
            if (isMounted) {
              try {
                const data: TEvent = JSON.parse(event.data);
                onMessage(data);
              } catch (parseError) {
                if (import.meta.env.DEV) {
                  console.error('Failed to parse SSE data:', parseError);
                }
              }
            }
          };

          eventSource.onerror = (event) => {
            if (isMounted) {
              setIsConnected(false);
              const err = new Error('SSE connection error');
              setError(err);

              if (onError) {
                onError(event);
              }

              // Attempt reconnect if enabled
              if (reconnect && isMounted) {
                reconnectTimeoutRef.current = setTimeout(() => {
                  if (isMounted) {
                    connectSSE();
                  }
                }, reconnectDelay);
              }
            }

            eventSource.close();
          };
        }
      } catch (err) {
        if (isMounted) {
          const connectionError = err instanceof Error ? err : new Error('Unknown error');
          setError(connectionError);
          setIsConnected(false);

          if (onError) {
            onError(new Event('error'));
          }

          // Attempt reconnect if enabled
          if (reconnect && isMounted) {
            reconnectTimeoutRef.current = setTimeout(() => {
              if (isMounted) {
                connectSSE();
              }
            }, reconnectDelay);
          }
        }
      }
    };

    connectSSE();

    // Cleanup function
    return () => {
      isMounted = false;

      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }

      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }

      if (reconnectTimeoutRef.current) {
        clearTimeout(reconnectTimeoutRef.current);
        reconnectTimeoutRef.current = null;
      }

      setIsConnected(false);
    };
    // `body`/`headers` are intentionally read as the latest values when the
    // serialized `bodyKey`/`headersKey` change triggers this effect; adding the
    // raw objects would cause an infinite reconnect loop (new literal each render).
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [url, onMessage, onError, reconnect, reconnectDelay, method, bodyKey, headersKey]);

  const close = () => {
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }

    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
      abortControllerRef.current = null;
    }

    if (reconnectTimeoutRef.current) {
      clearTimeout(reconnectTimeoutRef.current);
      reconnectTimeoutRef.current = null;
    }

    setIsConnected(false);
  };

  return { isConnected, error, close };
}

export default useSSE;
