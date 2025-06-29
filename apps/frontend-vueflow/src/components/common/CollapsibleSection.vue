<template>
  <div class="collapsible-section border border-border-base/40 rounded-lg overflow-hidden">
    <button
      class="flex items-center justify-between w-full p-3 text-left transition-colors hover:bg-background-base"
      @click="toggle"
    >
      <div class="text-sm font-medium text-text-base">
        <slot name="title">Section Title</slot>
      </div>
      <ChevronDownIcon
        class="w-4 h-4 text-text-muted transition-transform duration-200"
        :class="{ 'rotate-180': !isOpen }"
      />
    </button>
    <div v-show="isOpen" class="content-area p-3 border-t border-border-base/40">
      <slot name="content">
        <p>Collapsible content goes here.</p>
      </slot>
    </div>
  </div>
</template>

<script setup lang="ts">
import { ref } from 'vue';
import { ChevronDownIcon } from '@heroicons/vue/24/outline';

const props = defineProps({
  initiallyOpen: {
    type: Boolean,
    default: false,
  },
});

const isOpen = ref(props.initiallyOpen);

const toggle = () => {
  isOpen.value = !isOpen.value;
};
</script>