<script setup lang="ts">
/**
 * One panel of a `<Tabs>` group. Hidden panels stay in the DOM (`v-show`, not `v-if`) so the
 * browser's find-in-page and the site's local search still reach the text in the tab that is not
 * currently open.
 */

import { computed, inject } from "vue";
import type { Ref } from "vue";

const props = defineProps<{
  title: string;
}>();

const tabsContext = inject<{
  tabs: Ref<Array<{ id: number; title: string }>>;
  activeTab: Ref<number>;
  registerTab: (title: string) => number;
  tabButtonId: (id: number) => string;
  tabPanelId: (id: number) => string;
}>("tabsContext");

if (!tabsContext) {
  throw new Error("<Tab> must be used inside <Tabs>");
}

const tabId = tabsContext.registerTab(props.title);

const isActive = computed(() => tabId === tabsContext.activeTab.value);
</script>

<template>
  <div
    v-show="isActive"
    class="syg-tabs__panel"
    role="tabpanel"
    :id="tabsContext.tabPanelId(tabId)"
    :aria-labelledby="tabsContext.tabButtonId(tabId)"
    tabindex="0"
  >
    <slot />
  </div>
</template>
