
'use client';

import { useEffect } from 'react';
import { useToast } from '@/hooks/use-toast';

export default function SSEListener({
  children,
}: { children: React.ReactNode }) {
  const { toast } = useToast();

  useEffect(() => {
    const eventSourceUrl = 'http://localhost:8000/events'; // Adjust URL if your FastAPI runs elsewhere
    const eventSource = new EventSource(eventSourceUrl);

    eventSource.onmessage = (event) => {
      try {
        const data = JSON.parse(event.data);
        if (data.message) {
          toast({
            title: "Website Update",
            description: data.message,
          });
        }
      } catch (error) {
        console.error('Failed to parse SSE data:', error, 'Raw data:', event.data);
      }
    };

    eventSource.onerror = (errorEvent) => {
      // An error occurred with the SSE connection.
      // We will close the EventSource to prevent further attempts and associated errors from this instance.
      // No console logging from our application code to "ignore" the error if the server is down.
      if (eventSource.readyState !== EventSource.CLOSED) {
        eventSource.close();
      }
    };

    return () => {
      if (eventSource.readyState !== EventSource.CLOSED) {
        eventSource.close();
      }
    };
  }, [toast]);

  return <>{children}</>;
}
