import type { ComfyTavernPanelApi } from './types';

/**
 * Initializes the panel API and establishes communication with the host environment.
 * This function should be called once when the panel application starts.
 * @returns The fully functional panelApi object.
 */
function initializePanelApi(): ComfyTavernPanelApi {
  // Avoid re-initialization
  if ((window as any).comfyTavern?.panelApi) {
    console.log('[Panel SDK] panelApi already exists.');
    return (window as any).comfyTavern.panelApi;
  }

  // --- State for managing communication ---
  const pendingRequests = new Map<string, { resolve: (value: any) => void; reject: (reason?: any) => void }>();
  let eventListeners = new Map<string, Set<(detail: any) => void>>();

  // --- Central message handler from host ---
  window.addEventListener('message', (event: MessageEvent) => {
    const data = event.data;

    // Response to an API call
    if (data.type === 'comfy-tavern-api-response' && data.id && pendingRequests.has(data.id)) {
      const { resolve, reject } = pendingRequests.get(data.id)!;
      if (data.error) {
        reject(new Error(data.error.message));
      } else {
        resolve(data.payload);
      }
      pendingRequests.delete(data.id);
      return;
    }

    // Generic execution event from host
    if (data.type === 'execution-event' && data.event) {
        const listeners = eventListeners.get(data.event);
        if (listeners) {
            listeners.forEach(callback => callback(data));
        }
    }
    
    // Theme update event
    if (data.type === 'comfy-tavern-theme-update') {
        const listeners = eventListeners.get('onThemeChange');
        if (listeners) {
            listeners.forEach(callback => callback(data.payload));
        }
    }
  });

  // --- The actual panelApi implementation ---
  const panelApi: ComfyTavernPanelApi = new Proxy({} as ComfyTavernPanelApi, {
    get(_target, prop: string, _receiver) {
      // --- Special handling for event subscriptions ---
      if (prop === 'subscribeToExecutionEvents') {
        return (executionId: string, callbacks: any) => {
          const onResultListener = (detail: any) => {
            if (detail.executionId === executionId && callbacks.onResult) callbacks.onResult(detail.payload);
          };
          const onErrorListener = (detail: any) => {
            if (detail.executionId === executionId && callbacks.onError) callbacks.onError(detail.payload);
          };
          
          let onResultListeners = eventListeners.get('onResult');
          if (!onResultListeners) {
              onResultListeners = new Set();
              eventListeners.set('onResult', onResultListeners);
          }
          onResultListeners.add(onResultListener);

          let onErrorListeners = eventListeners.get('onError');
          if (!onErrorListeners) {
              onErrorListeners = new Set();
              eventListeners.set('onError', onErrorListeners);
          }
          onErrorListeners.add(onErrorListener);

          // Tell the host we are ready to receive events for this execution
          (panelApi as any)._internalSubscribe(executionId);

          // Return an unsubscribe function
          return () => {
            onResultListeners?.delete(onResultListener);
            onErrorListeners?.delete(onErrorListener);
          };
        };
      }
      
      // --- Special handling for log forwarding ---
      if (prop === 'log') {
        return (level: 'log' | 'warn' | 'error' | 'debug', ...args: any[]) => {
          // This is a fire-and-forget action, no response expected.
          const logMessage = {
            type: 'panel-log',
            payload: {
              level,
              message: args.map(arg => { // Basic serialization
                try {
                  return JSON.parse(JSON.stringify(arg));
                } catch {
                  return String(arg);
                }
              })
            }
          };
          window.parent.postMessage(logMessage, '*');
        };
      }

      // --- Generic method handler using postMessage ---
      return function(...args: any[]) {
        return new Promise((resolve, reject) => {
          const id = `${prop}-${Date.now()}-${Math.random().toString(36).substring(2, 9)}`;
          pendingRequests.set(id, { resolve, reject });

          const requestMessage = {
            type: 'comfy-tavern-api-call',
            id: id,
            payload: { method: prop, args: args }
          };
          
          // The host is responsible for verifying the origin
          window.parent.postMessage(requestMessage, '*');
        });
      }
    }
  });
  
  // --- Finalize initialization ---
  
  // 1. Assign the created API to the window object
  (window as any).comfyTavern = (window as any).comfyTavern || {};
  (window as any).comfyTavern.panelApi = panelApi;
  
  // 2. Notify the host that the panel is ready and the SDK is active
  window.parent.postMessage({ type: 'panel-sdk-ready' }, '*');

  console.log('[Panel SDK] Initialized and ready.');
  
  return panelApi;
}

// --- Export a single instance ---
export const panelApi = initializePanelApi();

// --- Also export types for convenience ---
export * from './types';