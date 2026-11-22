import { useEffect } from "react";
import { useQueryClient } from "@tanstack/react-query";
import { streamOrderEvents } from "../api/order-events";
import { useAuth } from "../context/AuthContext";

const RECONNECT_DELAY_MS = 3_000;

export function useOrderEvents(): void {
  const { accessToken } = useAuth();
  const queryClient = useQueryClient();

  useEffect(() => {
    if (!accessToken) return;

    const controller = new AbortController();
    let active = true;
    let reconnectTimer: ReturnType<typeof setTimeout> | undefined;

    const refreshOrders = () => queryClient.invalidateQueries({ queryKey: ["orders"] });
    const connect = async () => {
      try {
        await streamOrderEvents({
          accessToken,
          signal: controller.signal,
          onOpen: () => {
            void refreshOrders();
            void queryClient.invalidateQueries({ queryKey: ["notifications"] });
          },
          onEvent: (event) => {
            void refreshOrders();
            if (event.type !== "order.order.created") {
              void queryClient.invalidateQueries({ queryKey: ["notifications"] });
            }
            if (event.type === "order.order.confirmed") {
              void queryClient.invalidateQueries({ queryKey: ["cart"] });
              void queryClient.invalidateQueries({ queryKey: ["products"] });
            }
          },
        });
      } catch (error) {
        if (controller.signal.aborted) return;
        console.error("Order event stream disconnected", error);
      }

      if (active) {
        reconnectTimer = setTimeout(() => void connect(), RECONNECT_DELAY_MS);
      }
    };

    void connect();
    return () => {
      active = false;
      if (reconnectTimer) clearTimeout(reconnectTimer);
      controller.abort();
    };
  }, [accessToken, queryClient]);
}
