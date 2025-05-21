import { useTabStore } from '@/stores/tabStore';
import { useProjectStore } from '@/stores/projectStore';
import type { UseNodeStateProps } from './useNodeState';
import { useNodeState } from './useNodeState';
import {
  type InputDefinition,
  DataFlowType,
  BuiltInSocketMatchCategory,
  type DataFlowTypeName,
} from '@comfytavern/types';
// import { getEffectiveDefaultValue } from '@comfytavern/utils'; // Removed as default value logic is handled by useNodeState or consuming components

// Component Imports
import StringInput from '@/components/graph/inputs/StringInput.vue';
import NumberInput from '@/components/graph/inputs/NumberInput.vue';
import CodeInput from '@/components/graph/inputs/CodeInput.vue';
import SelectInput from '@/components/graph/inputs/SelectInput.vue';
import BooleanToggle from '@/components/graph/inputs/BooleanToggle.vue';
import ButtonInput from '@/components/graph/inputs/ButtonInput.vue';
import ResourceSelectorInput from '@/components/graph/inputs/ResourceSelectorInput.vue';
import TextAreaInput from '@/components/graph/inputs/TextAreaInput.vue';

export function useNodeProps(props: Readonly<UseNodeStateProps>) {
  const tabStore = useTabStore();
  const projectStore = useProjectStore();

  const { isInputConnected, getConfigValue } = useNodeState(props);

  const getInputProps = (input: InputDefinition, inputKey: string) => {
    const connected = isInputConnected(inputKey);
    const config = input.config || {}; // Ensure config exists

    const isExplicitlyReadOnly = config.readOnly === true;
    const showReceivedValue = config.showReceivedValue === true;
    const isEffectivelyReadOnly = isExplicitlyReadOnly || (connected && showReceivedValue);

    const configDisabled = config.disabled ?? false;
    const isDisabled = connected || configDisabled || isExplicitlyReadOnly;

    const componentProps: Record<string, any> = {
      placeholder: config.placeholder,
      disabled: isDisabled,
      readonly: isEffectivelyReadOnly, // Simplified readonly prop
      suggestions: config.suggestions,
      inputConfig: config, // Pass original input.config
      name: inputKey, // Use inputKey for name
      label: input.displayName || input.description || inputKey, // Prioritize displayName
      // modelValue is typically handled by the component using these props via useNodeState's getInputValue/setInputNodeValue
      preferFloatingEditor: config.preferFloatingEditor === true, // Handle preferFloatingEditor
    };

    let component: any = StringInput; // Default component

    // Handle displayAs first, as it might override default component selection
    if (config.displayAs) {
      switch (config.displayAs) {
        // case 'slider': // Example: if SliderInput component exists
        //   if (input.dataFlowType === DataFlowType.INTEGER || input.dataFlowType === DataFlowType.FLOAT) {
        //     component = SliderInput;
        //     componentProps.min = config.min;
        //     componentProps.max = config.max;
        //     componentProps.step = config.step;
        //   }
        //   break;
        // case 'color-picker': // Example: if ColorPickerInput component exists
        //   if (input.dataFlowType === DataFlowType.STRING) {
        //     component = ColorPickerInput;
        //   }
        //   break;
        // Add more 'displayAs' cases here as needed
      }
    }

    // If component not set by displayAs, proceed with dataFlowType and matchCategories logic
    if (component === StringInput) { // Check if component is still the default
      switch (input.dataFlowType as DataFlowTypeName) {
        case DataFlowType.INTEGER:
          component = NumberInput;
          componentProps.step = config.step ?? 1;
          componentProps.min = config.min;
          componentProps.max = config.max;
          componentProps.type = DataFlowType.INTEGER; // 显式设置类型
          if (config.suggestions && config.suggestions.length > 0) {
            component = SelectInput;
          }
          break;
        case DataFlowType.FLOAT:
          component = NumberInput;
          componentProps.step = config.step ?? 0.01;
          componentProps.min = config.min;
          componentProps.max = config.max;
          componentProps.type = DataFlowType.FLOAT; // 显式设置类型
          if (config.suggestions && config.suggestions.length > 0) {
            component = SelectInput;
          }
          break;
        case DataFlowType.BOOLEAN:
          component = BooleanToggle;
          break;
        case DataFlowType.STRING:
          if (input.matchCategories?.includes(BuiltInSocketMatchCategory.CODE) || config.languageHint) {
            component = CodeInput;
            componentProps.languageHint = config.languageHint || 'text'; // Use languageHint
            componentProps.preferFloatingEditor = componentProps.preferFloatingEditor || true; // Default to floating for code
          } else if (config.suggestions && config.suggestions.length > 0) {
            component = SelectInput;
          } else if (input.matchCategories?.includes(BuiltInSocketMatchCategory.RESOURCE_ID)) {
            // Potentially ResourceSelectorInput or similar, for now, stick to text/textarea
            if (config.multiline) {
              component = TextAreaInput;
              componentProps.preferFloatingEditor = componentProps.preferFloatingEditor || true; // Default to floating for multiline
            } else {
              component = StringInput;
            }
          } else if (config.multiline) {
            component = TextAreaInput;
            componentProps.preferFloatingEditor = componentProps.preferFloatingEditor || true; // Default to floating for multiline
          } else {
            component = StringInput;
          }
          break;
        case DataFlowType.OBJECT:
        case DataFlowType.ARRAY:
          // These types often benefit from a more structured editor
          component = CodeInput; // Default to CodeInput for JSON-like data
          componentProps.languageHint = config.languageHint || 'json';
          componentProps.preferFloatingEditor = componentProps.preferFloatingEditor || true; // Default to floating
          if (config.suggestions && config.suggestions.length > 0) {
            component = SelectInput; // If suggestions are provided, override to SelectInput
          }
          break;
        case DataFlowType.WILDCARD:
          if (input.matchCategories?.includes(BuiltInSocketMatchCategory.TRIGGER)) {
            component = ButtonInput;
            componentProps.label = config.label || input.displayName || inputKey;
            componentProps.disabled = connected || configDisabled; // Button specific disabled logic
            delete componentProps.readonly; // Buttons don't have readonly state in the same way
            delete componentProps.preferFloatingEditor; // Not applicable for buttons
          } else if (config.multiline) {
            component = TextAreaInput;
            componentProps.preferFloatingEditor = componentProps.preferFloatingEditor || true;
          } else {
            component = StringInput;
          }
          break;
        default:
          // Fallback for unhandled DataFlowType, consider if specific handling is needed
          if (config.multiline) {
            component = TextAreaInput;
            componentProps.preferFloatingEditor = componentProps.preferFloatingEditor || true;
          } else {
            component = StringInput;
          }
      }
    }

    // Ensure nodeId and workflowId are always passed
    componentProps.nodeId = props.id;
    componentProps.workflowId = tabStore.activeTabId;

    return { component, props: componentProps };
  };

  const getConfigProps = (configDef: InputDefinition, configKey: string) => {
    const projectId = projectStore.currentProjectId;
    const baseConfigProps = configDef.config || {};
    const isDisabled = props.data.configValues?._disabled?.[configKey] ?? baseConfigProps.disabled ?? false;
    const isReadOnly = props.data.configValues?._readonly?.[configKey] ?? baseConfigProps.readonly ?? false;

    const componentProps: Record<string, any> = {
      ...baseConfigProps,
      disabled: isDisabled || isReadOnly,
      readonly: isReadOnly,
      placeholder: baseConfigProps.placeholder || configDef.description || configKey, // Corrected placeholder
      name: configKey, // Use configKey for name
      label: configDef.description || configKey, // Use configDef.description or configKey for label
      suggestions: configDef.config?.suggestions,
      inputConfig: configDef.config,
    };

    let component: any = StringInput;

    if (
      configDef.dataFlowType === DataFlowType.STRING &&
      configDef.matchCategories?.includes(BuiltInSocketMatchCategory.RESOURCE_ID)
    ) {
      component = ResourceSelectorInput;
      componentProps.acceptedTypes = configDef.config?.acceptedTypes;
    } else {
      switch (configDef.dataFlowType as DataFlowTypeName) {
        case DataFlowType.INTEGER:
          component = NumberInput;
          componentProps.step = configDef.config?.step ?? 1;
          componentProps.min = configDef.config?.min;
          componentProps.max = configDef.config?.max;
          if (configDef.matchCategories?.includes(BuiltInSocketMatchCategory.COMBO_OPTION)) {
            component = SelectInput;
          }
          break;
        case DataFlowType.FLOAT:
          component = NumberInput;
          componentProps.step = configDef.config?.step ?? 0.01;
          componentProps.min = configDef.config?.min;
          componentProps.max = configDef.config?.max;
          if (configDef.matchCategories?.includes(BuiltInSocketMatchCategory.COMBO_OPTION)) {
            component = SelectInput;
          }
          break;
        case DataFlowType.BOOLEAN:
          component = BooleanToggle;
          break;
        case DataFlowType.STRING:
          if (configDef.matchCategories?.includes(BuiltInSocketMatchCategory.CODE)) {
            component = CodeInput;
            componentProps.language = configDef.config?.language || 'text';
          } else if (configDef.matchCategories?.includes(BuiltInSocketMatchCategory.COMBO_OPTION)) {
            component = SelectInput;
          } else if (configDef.config?.multiline) {
            component = TextAreaInput;
          } else {
            component = StringInput;
          }
          break;
        default:
          if (configDef.config?.multiline) {
            component = TextAreaInput;
          } else {
            component = StringInput;
          }
      }
    }

    componentProps.nodeId = props.id;
    componentProps.workflowId = tabStore.activeTabId;
    componentProps.projectId = projectId;

    if (configKey === 'embeddedWorkflowId' || configKey === 'referencedWorkflowId') {
      componentProps.groupMode = getConfigValue('groupMode');
    }

    return { component, props: componentProps };
  };

  return {
    getInputProps,
    getConfigProps,
  };
}