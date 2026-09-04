import DefaultTheme from "vitepress/theme";
import HomePage from "./HomePage.vue";
import SubPagesList from "./SubPagesList.vue";
import "./custom.css";

export default {
  extends: DefaultTheme,
  enhanceApp({ app }) {
    app.component("HomePage", HomePage);
    app.component("SubPagesList", SubPagesList);
  },
};
