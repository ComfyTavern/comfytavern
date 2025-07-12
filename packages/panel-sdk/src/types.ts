import type {
  InvocationRequest,
  InvocationResponse,
  PanelFile,
  PanelApiHost,
  PanelDefinition,
  SlotDefinitionBase,
  ThemePreset,
} from '@comfytavern/types';

// --- Locally Defined Types (until they are moved to @comfytavern/types) ---

/**
 * Describes the public interface of a workflow or an adapter.
 */
export interface WorkflowInterface {
  id: string;
  name: string;
  description?: string;
  inputs: SlotDefinitionBase[];
  outputs: SlotDefinitionBase[];
}

/**
 * A collection of callbacks for handling execution events from the backend.
 */
export interface PanelExecutionCallbacks {
  onProgress?: (data: { key:string; content: any; isComplete: boolean }) => void;
  onResult?: (data: { outputs: Record<string, any> }) => void;
  onError?: (data: { error: string; details?: any }) => void;
}

// --- Interaction Request Types ---

export interface TextInputRequest {
  interactionId: string;
  prompt: string;
  defaultValue?: string;
}

export interface OptionSelectionRequest {
  interactionId: string;
  prompt: string;
  options: { value: string; label: string }[];
}

/**
 * An object that provides UI implementation for handling interaction requests.
 */
export interface PanelInteractionProvider {
  handleTextInputRequest?: (request: TextInputRequest) => Promise<string>;
  handleOptionSelectionRequest?: (request: OptionSelectionRequest) => Promise<string>;
}

/**
 * Information about the current theme.
 */
export interface ThemeInfo {
  mode: 'light' | 'dark';
  variables: Record<string, string>;
  preset?: ThemePreset;
}


// --- Main Panel API Interface ---

/**
 * The definitive API interface for communication between an application panel
 * and the ComfyTavern host environment.
 */
export interface ComfyTavernPanelApi {
  invoke(request: InvocationRequest): Promise<InvocationResponse>;
  getInterface(target: { type: 'adapter' | 'workflow', id: string }): Promise<WorkflowInterface>;
  subscribeToExecutionEvents(executionId: string, callbacks: PanelExecutionCallbacks): () => void;
  subscribeToInteractionRequests(uiProvider: PanelInteractionProvider): () => void;
  publishEvent(eventType: string, payload: any): Promise<void>;
  getCurrentTheme(): Promise<ThemeInfo>;
  requestHostService<T = any>(serviceName: string, args?: any): Promise<T>;
  listFiles(path: string): Promise<PanelFile[]>;
  readFile(path: string, encoding?: 'utf-8' | 'binary'): Promise<string | ArrayBuffer>;
  writeFile(path: string, content: string | Blob | ArrayBuffer): Promise<void>;
  deleteFile(path: string, options?: { recursive?: boolean }): Promise<void>;
  createDirectory(path: string): Promise<void>;

  /**
   * Forwards log messages to the host environment for centralized logging.
   * @param level The severity level of the log.
   * @param args The content to be logged.
   */
  log(level: 'log' | 'warn' | 'error' | 'debug', ...args: any[]): void;
}

// --- Re-export existing types for convenience ---
export type {
  InvocationRequest,
  InvocationResponse,
  PanelFile,
  PanelApiHost,
  PanelDefinition,
  SlotDefinitionBase,
  ThemePreset,
};