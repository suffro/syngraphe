<script setup lang="ts">
import { computed } from "vue";
import { useRoute, withBase } from "vitepress";
import { data as pages } from "./subpages.data.ts";

const route = useRoute();

// The directory the current page lives in. A landing page is `/guides/`, so this is that prefix;
// the filter below then picks exactly the pages under it.
const section = computed(() => route.path.replace(/[^/]*$/, ""));

const items = computed(() =>
  pages
    .filter((page) => page.url.startsWith(section.value) && page.url !== route.path)
    .sort((a, b) => a.order - b.order || a.title.localeCompare(b.title)),
);
</script>

<template>
  <div class="syg-subpages">
    <a v-for="page in items" :key="page.url" class="syg-subpage" :href="withBase(page.url)">
      <span class="syg-subpage-title">{{ page.title }}</span>
      <span v-if="page.description" class="syg-subpage-text">{{ page.description }}</span>
    </a>
  </div>
</template>
