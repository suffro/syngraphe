import { h } from "vue";
import DefaultTheme from "vitepress/theme";
import ExampleNote from "./ExampleNote.vue";
import HomePage from "./HomePage.vue";
import PageActions from "./PageActions.vue";
import SubPagesList from "./SubPagesList.vue";
import Tab from "./tabs/Tab.vue";
import Tabs from "./tabs/Tabs.vue";
import "./custom.css";

export default {
  extends: DefaultTheme,
  /**
   * The page actions are registered once, in the layout's `doc-before` slot, rather than written
   * into every page — which is what makes it impossible to forget on one.
   */
  Layout() {
    return h(DefaultTheme.Layout, null, {
      "doc-before": () => h(PageActions),
    });
  },
  enhanceApp({ app }) {
    app.component("HomePage", HomePage);
    app.component("SubPagesList", SubPagesList);
    app.component("Tabs", Tabs);
    app.component("Tab", Tab);
    app.component("ExampleNote", ExampleNote);
  },
};
