import { createSignal, onMount } from "solid-js";
import browser from "webextension-polyfill";

interface RpcResponse<T = unknown> {
  success: boolean;
  result?: T;
  error?: string;
}

interface BackendInfo {
  id: string;
  name: string;
  priority: number;
  connected: boolean;
  attempts: number;
}

function App() {
  const [currentBackend, setCurrentBackend] = createSignal<string | null>(null);
  const [availableBackends, setAvailableBackends] = createSignal<BackendInfo[]>(
    [],
  );
  const [loading, setLoading] = createSignal(false);

  onMount(async () => {
    await loadBackendStatus();
  });

  const loadBackendStatus = async () => {
    setLoading(true);
    try {
      // Get current backend and available backends in parallel
      const [currentResponse, backendsResponse] = await Promise.all([
        browser.runtime.sendMessage({
          type: "rpc",
          method: "get_backend",
          params: [],
          host: "popup",
        }) as Promise<RpcResponse<string | null>>,
        browser.runtime.sendMessage({
          type: "rpc",
          method: "get_backends",
          params: [],
          host: "popup",
        }) as Promise<RpcResponse<BackendInfo[]>>,
      ]);

      if (currentResponse.success) {
        setCurrentBackend(currentResponse.result || null);
      }

      if (backendsResponse.success && backendsResponse.result) {
        setAvailableBackends(backendsResponse.result);
      }
    } catch (error) {
      console.error("Failed to load backend status:", error);
    } finally {
      setLoading(false);
    }
  };

  const handleSwitchBackend = async (backendId: string) => {
    setLoading(true);
    try {
      const response = (await browser.runtime.sendMessage({
        type: "rpc",
        method: "set_backend",
        params: [backendId],
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

  const getBackendIcon = (backendId: string) => {
    switch (backendId) {
      case "relay":
        return "🌐";
      case "idb":
        return "💾";
      default:
        return "🔧";
    }
  };

  const getBackendStatusText = (backend: BackendInfo) => {
    if (backend.connected) {
      return "Connected";
    } else if (backend.attempts > 0) {
      return `Failed (${backend.attempts} attempts)`;
    } else {
      return "Not connected";
    }
  };

  return (
    <div class="w-full h-full bg-base-100 flex flex-col">
      <div class="bg-primary text-primary-content p-4 text-center">
        <h1 class="text-xl font-bold">Nostr Bucket</h1>
      </div>

      <div class="flex-1 p-4 flex flex-col justify-center gap-4">
        {availableBackends().length === 0 ? (
          <div class="text-center text-gray-500">
            {loading() ? "Loading backends..." : "No backends available"}
          </div>
        ) : (
          availableBackends().map((backend) => (
            <button
              onClick={() => handleSwitchBackend(backend.id)}
              disabled={loading() || currentBackend() === backend.id}
              class={`btn w-full h-16 text-lg ${
                currentBackend() === backend.id ? "btn-success" : "btn-neutral"
              } ${loading() ? "loading" : ""}`}
            >
              <div class="flex flex-col items-center gap-1">
                <div class="flex items-center gap-2">
                  {!loading() && getBackendIcon(backend.id)}
                  <span class="font-semibold">{backend.name}</span>
                </div>
                <div class="text-xs opacity-75">
                  {getBackendStatusText(backend)}
                </div>
              </div>
            </button>
          ))
        )}
      </div>
    </div>
  );
}

export default App;
