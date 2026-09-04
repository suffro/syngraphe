<script setup lang="ts">
/**
 * The line that says "what follows is made up".
 *
 * Documentation shows two kinds of block that look identical: output Syngraphe really produces, and
 * prose invented to illustrate what a person would write. Confusing the second for the first is the
 * expensive mistake — someone waits for `init` to write an architecture document it never writes —
 * so the distinction is labelled rather than left to the surrounding sentence.
 *
 * It goes *before* the block it describes and outside the fence: a caption underneath is read after
 * the damage is done, and a note inside the fence would be copied along with the content.
 */

defineProps<{
  /** The tag on the left. `Example` by default; `Generated` marks the real thing. */
  label?: string;
}>();
</script>

<template>
  <p class="syg-example">
    <span class="syg-example-tag">{{ label ?? "Example" }}</span>
    <span class="syg-example-text"><slot /></span>
  </p>
</template>
