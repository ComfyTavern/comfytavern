<template>
  <BaseModal :visible="visible" v-comfy-tooltip="t('fileManager.filterModal.title')" @close="handleClose" modal-class="w-full max-w-lg"
    data-testid="fm-filter-modal">
    <form @submit.prevent="applyFilters" class="p-4 sm:p-6 space-y-4">
      <div class="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div>
          <label for="filter-filename"
            class="block text-sm font-medium text-text-base mb-1">{{ t('fileManager.filterModal.filenameLabel') }}</label>
          <input type="text" id="filter-filename" v-model="localFilters.namePattern"
            :placeholder="t('fileManager.filterModal.filenamePlaceholder')"
            class="input input-bordered input-sm w-full bg-background-base border-border-base" />
        </div>
        <div>
          <label for="filter-type" class="block text-sm font-medium text-text-base mb-1">{{ t('fileManager.filterModal.typeLabel') }}</label>
          <select id="filter-type" v-model="localFilters.itemType"
            class="select select-bordered select-sm w-full bg-background-base border-border-base">
            <option value="">{{ t('fileManager.filterModal.anyType') }}</option>
            <option value="file">{{ t('fileManager.filterModal.fileType') }}</option>
            <option value="directory">{{ t('fileManager.filterModal.folderType') }}</option>
            <!-- 更多具体文件类型可以后续添加，如 image, document, video 等 -->
          </select>
        </div>
      </div>

      <div>
        <p class="block text-sm font-medium text-text-base mb-1">{{ t('fileManager.filterModal.sizeRangeLabel') }}</p>
        <div class="grid grid-cols-2 gap-3 items-center">
          <div>
            <label for="filter-min-size" class="sr-only">{{ t('fileManager.filterModal.minSizeLabel') }}</label>
            <div class="flex items-center">
              <input type="number" id="filter-min-size" v-model.number="minSizeInput" min="0" :placeholder="t('fileManager.filterModal.minSizePlaceholder')"
                class="input input-bordered input-sm w-full bg-background-base border-border-base" />
              <select v-model="minSizeUnitInput"
                class="select select-bordered select-sm ml-2 bg-background-base border-border-base">
                <option value="B">B</option>
                <option value="KB">KB</option>
                <option value="MB">MB</option>
                <option value="GB">GB</option>
              </select>
            </div>
          </div>
          <div>
            <label for="filter-max-size" class="sr-only">{{ t('fileManager.filterModal.maxSizeLabel') }}</label>
            <div class="flex items-center">
              <input type="number" id="filter-max-size" v-model.number="maxSizeInput" min="0" :placeholder="t('fileManager.filterModal.maxSizePlaceholder')"
                class="input input-bordered input-sm w-full bg-background-base border-border-base" />
              <select v-model="maxSizeUnitInput"
                class="select select-bordered select-sm ml-2 bg-background-base border-border-base">
                <option value="B">B</option>
                <option value="KB">KB</option>
                <option value="MB">MB</option>
                <option value="GB">GB</option>
              </select>
            </div>
          </div>
        </div>
      </div>

      <div>
        <p class="block text-sm font-medium text-text-base mb-1">{{ t('fileManager.filterModal.dateRangeLabel') }}</p>
        <div class="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div>
            <label for="filter-date-after" class="sr-only">{{ t('fileManager.filterModal.dateAfterLabel') }}</label>
            <input type="date" id="filter-date-after" v-model="modifiedAfterDateInput"
              class="input input-bordered input-sm w-full bg-background-base border-border-base dark:[color-scheme:dark]" />
          </div>
          <div>
            <label for="filter-date-before" class="sr-only">{{ t('fileManager.filterModal.dateBeforeLabel') }}</label>
            <input type="date" id="filter-date-before" v-model="modifiedBeforeDateInput"
              class="input input-bordered input-sm w-full bg-background-base border-border-base dark:[color-scheme:dark]" />
          </div>
        </div>
      </div>

      <div>
        <label class="label cursor-pointer justify-start gap-2">
          <input type="checkbox" v-model="localFilters.showHiddenFiles"
            class="checkbox checkbox-sm checkbox-primary" />
          <span class="label-text text-text-base">{{ t('fileManager.filterModal.showHiddenLabel') }}</span>
        </label>
      </div>
    </form>

    <template #footer>
      <div class="flex justify-between items-center p-3 bg-background-surface rounded-b-md">
        <button @click="resetFilters" type="button"
          class="btn btn-sm btn-ghost text-error hover:bg-error/10">
          {{ t('fileManager.filterModal.resetButton') }}
        </button>
        <div>
          <button @click="handleClose" type="button" class="btn btn-sm btn-ghost mr-2">
            {{ t('common.cancel') }}
          </button>
          <button @click="applyFilters" type="submit" class="btn btn-sm btn-primary">
            {{ t('fileManager.filterModal.applyButton') }}
          </button>
        </div>
      </div>
    </template>
  </BaseModal>
</template>

<script setup lang="ts">
import { ref, watch, reactive } from 'vue';
import { useI18n } from 'vue-i18n';
import BaseModal from '@/components/common/BaseModal.vue';
import { useFileManagerStore, type FilterOptions } from '@/stores/fileManagerStore';

type SizeUnit = 'B' | 'KB' | 'MB' | 'GB';
const UNIT_MULTIPLIERS: Record<SizeUnit, number> = {
  B: 1,
  KB: 1024,
  MB: 1024 * 1024,
  GB: 1024 * 1024 * 1024,
};

const props = defineProps<{
  visible: boolean;
}>();

const emit = defineEmits<{
  (e: 'close'): void;
}>();

const { t } = useI18n();
const fileManagerStore = useFileManagerStore();

// Local state for form inputs, initialized from store or defaults
const localFilters = reactive({
  namePattern: '',
  itemType: '' as '' | 'file' | 'directory',
  showHiddenFiles: false,
});

// For UI display of size inputs and date inputs
const minSizeInput = ref<number | undefined>(undefined);
const minSizeUnitInput = ref<SizeUnit>('KB');
const maxSizeInput = ref<number | undefined>(undefined);
const maxSizeUnitInput = ref<SizeUnit>('MB');
const modifiedAfterDateInput = ref(''); // YYYY-MM-DD
const modifiedBeforeDateInput = ref(''); // YYYY-MM-DD


// Sync localFilters with store when modal becomes visible
watch(
  () => props.visible,
  (newVal) => {
    if (newVal) {
      const storeFilters = fileManagerStore.filterOptions;
      localFilters.namePattern = storeFilters.namePattern || '';
      localFilters.itemType = storeFilters.itemType || '';
      localFilters.showHiddenFiles = storeFilters.showHiddenFiles || false;

      if (storeFilters.sizeRange && storeFilters.sizeRange[0] !== undefined) {
        const { value, unit } = convertBytesToAppropriateUnit(storeFilters.sizeRange[0]);
        minSizeInput.value = value;
        minSizeUnitInput.value = unit;
      } else {
        minSizeInput.value = undefined;
        minSizeUnitInput.value = 'KB';
      }

      if (storeFilters.sizeRange && storeFilters.sizeRange[1] !== undefined) {
        const { value, unit } = convertBytesToAppropriateUnit(storeFilters.sizeRange[1]);
        maxSizeInput.value = value;
        maxSizeUnitInput.value = unit;
      } else {
        maxSizeInput.value = undefined;
        maxSizeUnitInput.value = 'MB';
      }

      const dateAfter = storeFilters.dateRange?.[0];
      if (dateAfter instanceof Date) {
        // Ensure result is always a string for modifiedAfterDateInput (ref(''))
        modifiedAfterDateInput.value = String(dateAfter.toISOString().split('T')[0] || '');
      } else {
        modifiedAfterDateInput.value = '';
      }

      const dateBefore = storeFilters.dateRange?.[1];
      if (dateBefore instanceof Date) {
        // Ensure result is always a string
        modifiedBeforeDateInput.value = String(dateBefore.toISOString().split('T')[0] || '');
      } else {
        modifiedBeforeDateInput.value = '';
      }
    }
  },
  { immediate: true }
);
// Removed extra "}, { immediate: true });" that was causing syntax errors.

const convertToBytes = (value: number | undefined, unit: SizeUnit): number | undefined => {
  if (value === undefined || value === null || isNaN(value) || value < 0) return undefined;
  return Math.round(value * UNIT_MULTIPLIERS[unit]);
};

const convertBytesToAppropriateUnit = (bytes: number): { value: number, unit: SizeUnit } => {
  if (bytes < UNIT_MULTIPLIERS.KB) return { value: bytes, unit: 'B' };
  if (bytes < UNIT_MULTIPLIERS.MB) return { value: parseFloat((bytes / UNIT_MULTIPLIERS.KB).toFixed(1)), unit: 'KB' };
  if (bytes < UNIT_MULTIPLIERS.GB) return { value: parseFloat((bytes / UNIT_MULTIPLIERS.MB).toFixed(1)), unit: 'MB' };
  return { value: parseFloat((bytes / UNIT_MULTIPLIERS.GB).toFixed(1)), unit: 'GB' };
};


const applyFilters = () => {
  const minBytes = convertToBytes(minSizeInput.value, minSizeUnitInput.value);
  const maxBytes = convertToBytes(maxSizeInput.value, maxSizeUnitInput.value);

  let sizeRange: [number, number] | null = null;
  if (minBytes !== undefined && maxBytes !== undefined) {
    if (minBytes > maxBytes) {
      // console.warn("Min size cannot be greater than max size. Swapping.");
      sizeRange = [maxBytes, minBytes];
    } else {
      sizeRange = [minBytes, maxBytes];
    }
  } else if (minBytes !== undefined) {
    sizeRange = [minBytes, Infinity]; // Or some very large number if Infinity is not desired for backend
  } else if (maxBytes !== undefined) {
    sizeRange = [0, maxBytes];
  }

  let dateRange: [Date, Date] | null = null;
  const dateAfter = modifiedAfterDateInput.value ? new Date(modifiedAfterDateInput.value) : null;
  const dateBefore = modifiedBeforeDateInput.value ? new Date(modifiedBeforeDateInput.value) : null;

  if (dateAfter && dateBefore) {
    if (dateAfter > dateBefore) {
      // console.warn("Start date cannot be after end date. Swapping.");
      dateRange = [dateBefore, dateAfter];
    } else {
      dateRange = [dateAfter, dateBefore];
    }
  } else if (dateAfter) {
    dateRange = [dateAfter, new Date(8640000000000000)]; // Max Date
  } else if (dateBefore) {
    dateRange = [new Date(-8640000000000000), dateBefore]; // Min Date
  }

  const optionsToStore: Partial<FilterOptions> = {
    namePattern: localFilters.namePattern,
    itemType: localFilters.itemType,
    showHiddenFiles: localFilters.showHiddenFiles,
    fileTypes: [], // This modal doesn't set specific fileTypes (extensions) for now.
    // If itemType is 'file', one might want to allow extension input.
    sizeRange,
    dateRange,
  };

  fileManagerStore.updateFilterOptions(optionsToStore);
  emit('close');
};

const resetFilters = () => {
  localFilters.namePattern = '';
  localFilters.itemType = '';
  localFilters.showHiddenFiles = false;
  minSizeInput.value = undefined;
  minSizeUnitInput.value = 'KB';
  maxSizeInput.value = undefined;
  maxSizeUnitInput.value = 'MB';
  modifiedAfterDateInput.value = '';
  modifiedBeforeDateInput.value = '';

  fileManagerStore.clearFilters();
  // emit('close'); // User might want to see the reset fields before closing
};

const handleClose = () => {
  // Reset local form to match store if user cancels without applying
  // This is handled by the watch on props.visible
  emit('close');
};

</script>

<style scoped>
/* Add any specific styles for the filter modal here if needed */
/* Ensure date input text is visible in dark mode */
input[type="date"]::-webkit-calendar-picker-indicator {
  filter: invert(var(--tw-dark-mode-invert, 0));
}

.dark input[type="date"]::-webkit-calendar-picker-indicator {
  --tw-dark-mode-invert: 1;
}
</style>