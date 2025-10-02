import { createSignal, onMount } from "solid-js";
import browser from "webextension-polyfill";

interface RpcResponse<T = unknown> {
  success: boolean;
  result?: T;
  error?: string;
}

function App() {
  const [currentBackend, setCurrentBackend] = createSignal<string | null>(null);
  const [loading, setLoading] = createSignal(false);

  onMount(async () => {
    await loadBackendStatus();
  });

  const loadBackendStatus = async () => {
    setLoading(true);
    try {
      // Get current backend
      const currentResponse = (await browser.runtime.sendMessage({
        type: "rpc",
        method: "get_backend",
        params: [],
        host: "popup",
      })) as RpcResponse<string | null>;

      if (currentResponse.success) {
        setCurrentBackend(currentResponse.result || null);
      }
    } catch (error) {
      console.error("Failed to load backend status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchBackend = async (backendType: "idb" | "relay") => {
    setLoading(true);
    try {
      const response = (await browser.runtime.sendMessage({
        type: "rpc",
        method: "set_backend",
        params: [backendType],
        host: "popup",
      })) as RpcResponse<string>;

      if (response.success) {
        await loadBackendStatus(); // Refresh status
      } else {
        console.error("Failed to switch backend:", response.error);
      }
    } catch (error) {
      console.error("Error switching backend:", error);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div class="w-full h-full bg-base-100 flex flex-col">
      <div class="bg-primary text-primary-content p-4 text-center">
        <h1 class="text-xl font-bold">Nostr Bucket</h1>
      </div>

      <div class="flex-1 p-4 flex flex-col justify-center gap-4">
        <button
          onClick={() => handleSwitchBackend("relay")}
          disabled={loading() || currentBackend() === "relay"}
          class={`btn w-full h-16 text-lg ${
            currentBackend() === "relay" ? "btn-success" : "btn-neutral"
          } ${loading() ? "loading" : ""}`}
        >
          {!loading() && "🌐"} Local Relay
        </button>

        <button
          onClick={() => handleSwitchBackend("idb")}
          disabled={loading() || currentBackend() === "idb"}
          class={`btn w-full h-16 text-lg ${
            currentBackend() === "idb" ? "btn-success" : "btn-neutral"
          } ${loading() ? "loading" : ""}`}
        >
          {!loading() && "💾"} IndexedDB
        </button>
      </div>
    </div>
  );
}

export default App;
