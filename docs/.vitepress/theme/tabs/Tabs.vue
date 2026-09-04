<script setup lang="ts">
/**
 * A tabbed panel group.
 *
 * The titles are declared once on the parent rather than collected from the children, because the
 * buttons have to render in source order before any child has mounted. Each `<Tab>` then looks its
 * own index up by title, which also makes a typo an error at build time rather than a silently
 * missing panel.
 */

import { nextTick, provide, ref, useId } from "vue";

type TabData = {
  id: number;
  title: string;
};

const props = defineProps<{
  titles: string[];
  /** Names the group for assistive technology; the default suits the common case. */
  label?: string;
}>();

const tabs = ref<TabData[]>(props.titles.map((title, id) => ({ id, title })));
const activeTab = ref(0);
const tablist = ref<HTMLElement | null>(null);
// Ids have to be unique across a page that may hold several groups, and stable between the server
// render and the client one.
const instanceId = `syngraphe-tabs-${useId().replace(/[^a-zA-Z0-9_-]/g, "")}`;

const tabButtonId = (id: number) => `${instanceId}-tab-${id}`;
const tabPanelId = (id: number) => `${instanceId}-panel-${id}`;

function registerTab(title: string) {
  const existing = tabs.value.find((tab) => tab.title === title);
  if (existing) return existing.id;
  throw new Error(`<Tab title="${title}"> is missing from the parent <Tabs> titles`);
}

async function activate(id: number, focus = false) {
  activeTab.value = id;
  if (!focus) return;
  await nextTick();
  tablist.value?.querySelector<HTMLElement>(`#${tabButtonId(id)}`)?.focus();
}

/** Arrow-key navigation, as the tablist pattern requires: the buttons are one tab stop, and the
 *  arrows move between them. */
function onKeydown(event: KeyboardEvent, id: number) {
  let next = id;
  if (event.key === "ArrowRight" || event.key === "ArrowDown") next = (id + 1) % tabs.value.length;
  else if (event.key === "ArrowLeft" || event.key === "ArrowUp") {
    next = (id - 1 + tabs.value.length) % tabs.value.length;
  } else if (event.key === "Home") next = 0;
  else if (event.key === "End") next = tabs.value.length - 1;
  else return;
  event.preventDefault();
  void activate(next, true);
}

provide("tabsContext", {
  tabs,
  activeTab,
  registerTab,
  tabButtonId,
  tabPanelId,
});
</script>

<template>
  <div class="syg-tabs">
    <div ref="tablist" class="syg-tabs__nav" role="tablist" :aria-label="label ?? 'Variants'">
      <button
        v-for="tab in tabs"
        :key="tab.id"
        type="button"
        class="syg-tabs__button"
        :class="{ 'is-active': activeTab === tab.id }"
        role="tab"
        :id="tabButtonId(tab.id)"
        :aria-controls="tabPanelId(tab.id)"
        :aria-selected="activeTab === tab.id"
        :tabindex="activeTab === tab.id ? 0 : -1"
        @click="activate(tab.id)"
        @keydown="onKeydown($event, tab.id)"
      >
        {{ tab.title }}
      </button>
    </div>

    <div class="syg-tabs__content">
      <slot />
    </div>
  </div>
</template>
