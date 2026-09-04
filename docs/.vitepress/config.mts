import { defineConfig, type HeadConfig } from "vitepress";
import pkg from "../../package.json" with { type: "json" };

const packageVersion = pkg.version;

// The production origin. Every absolute URL the build emits — sitemap entries, canonical links,
// social cards — is prefixed with it, so the site has one name even when a preview deployment
// serves the same build from another hostname. One constant, changed in one place.
const hostname = "https://syngraphe.dev";

const repository = "https://github.com/suffro/syngraphe";

// Shared with every page that declares no description of its own, the home page included: the
// landing page's subject is the site, so the site description is its description too.
const description =
  "Keep repository context versioned, current, and understandable by both humans and coding agents.";

// The share image. The square mark rather than a composed banner: `twitter:card: summary` shows a
// square whole instead of cropping it, and the mark cannot drift from the logo the site already
// uses.
const socialImage = { path: "/static/png/logo-square-dark.png", size: "2000" };

// What this site is in the vocabulary a crawler reads. `sameAs` ties the npm package and the
// repository to this domain, so one project with three homes is read as one thing.
const structuredData = {
  "@context": "https://schema.org",
  "@graph": [
    {
      "@type": "WebSite",
      "@id": `${hostname}/#website`,
      url: `${hostname}/`,
      name: "Syngraphe",
      description,
      inLanguage: "en",
    },
    {
      "@type": "SoftwareApplication",
      "@id": `${hostname}/#syngraphe`,
      name: "Syngraphe",
      url: `${hostname}/`,
      description,
      applicationCategory: "DeveloperApplication",
      operatingSystem: "macOS, Linux, Windows",
      softwareVersion: packageVersion,
      license: "https://www.apache.org/licenses/LICENSE-2.0",
      isAccessibleForFree: true,
      offers: { "@type": "Offer", price: "0", priceCurrency: "USD" },
      sameAs: [repository, "https://www.npmjs.com/package/syngraphe"],
    },
  ],
};

// The sidebar is where this site's reading order is decided, so it is declared once here and
// handed to the theme below.
const sidebar = [
  {
    text: "Getting Started",
    link: "/getting-started/",
    collapsed: false,
    items: [
      { text: "What is Syngraphe", link: "/getting-started/what-is-syngraphe" },
      { text: "Why Syngraphe", link: "/getting-started/why-syngraphe" },
      { text: "Installation", link: "/getting-started/installation" },
      { text: "Quickstart", link: "/getting-started/quickstart" },
    ],
  },
  {
    text: "Guides",
    link: "/guides/",
    collapsed: false,
    items: [
      { text: "Adopting an existing repository", link: "/guides/adopting-an-existing-repository" },
      { text: "Writing the context", link: "/guides/writing-the-context" },
      { text: "Agent integrations", link: "/guides/agent-integrations" },
      { text: "Continuous integration", link: "/guides/continuous-integration" },
      { text: "Troubleshooting", link: "/guides/troubleshooting" },
    ],
  },
  {
    text: "Reference",
    link: "/reference/",
    collapsed: false,
    items: [
      { text: "CLI commands", link: "/reference/cli" },
      { text: "Context schema v1", link: "/reference/context-schema" },
      { text: "Managed blocks", link: "/reference/managed-blocks" },
      { text: "Checks and findings", link: "/reference/checks" },
      { text: "JSON output", link: "/reference/json-output" },
      { text: "Exit codes", link: "/reference/exit-codes" },
    ],
  },
  {
    text: "Concepts",
    link: "/concepts/",
    collapsed: false,
    items: [
      { text: "The context model", link: "/concepts/context-model" },
      { text: "Architecture", link: "/concepts/architecture" },
      { text: "Safety model", link: "/concepts/safety-model" },
      { text: "Design decisions", link: "/concepts/design-decisions" },
      { text: "Scope and non-goals", link: "/concepts/scope-and-non-goals" },
    ],
  },
];

const nav = [
  { text: "Home", link: "/" },
  { text: "Quickstart", link: "/getting-started/quickstart" },
  { text: "Reference", link: "/reference/" },
  {
    text: "Resources",
    activeMatch: " ",
    items: [
      { text: "What is Syngraphe", link: "/getting-started/what-is-syngraphe" },
      { text: "Guides", link: "/guides/" },
      { text: "Concepts", link: "/concepts/" },
      { text: "Architecture", link: "/concepts/architecture" },
      { text: "Safety model", link: "/concepts/safety-model" },
      { text: "Checks", link: "/reference/checks" },
      { text: "Scope and non-goals", link: "/concepts/scope-and-non-goals" },
    ],
  },
];

// https://vitepress.dev/reference/site-config
export default defineConfig({
  title: "Syngraphe",
  description,
  base: "/",

  // Clean URLs; static hosts that serve `/path` for `/path.html` need no `.html` in links.
  cleanUrls: true,

  sitemap: { hostname },

  head: [
    ["link", { rel: "icon", href: "/static/icon.ico", sizes: "any" }],
    ["meta", { name: "theme-color", content: "#1c1c1f" }],
  ],

  // Per-page metadata, computed rather than typed into frontmatter thirty times.
  //
  // The canonical link matters most: a preview deployment serves this exact build from a second
  // hostname, and two hostnames carrying identical pages is duplicate content unless each page
  // names the URL it really lives at. The Open Graph tags exist because a documentation link is
  // usually met in a chat client or an issue tracker, where a bare URL says nothing.
  transformPageData(pageData) {
    const route = `/${pageData.relativePath}`
      .replace(/index\.md$/, "")
      .replace(/\.md$/, "")
      .replace(/\/+/g, "/");

    const head: HeadConfig[] = (pageData.frontmatter.head ??= []);
    // `||`, not `??`: a page that declares no description gets an empty string rather than
    // undefined, and the home page is exactly that page.
    const title = pageData.frontmatter.title || pageData.title || "Syngraphe";
    const summary = pageData.frontmatter.description || pageData.description || description;

    head.push(
      ["link", { rel: "canonical", href: `${hostname}${route}` }],
      ["meta", { property: "og:type", content: "website" }],
      ["meta", { property: "og:site_name", content: "Syngraphe" }],
      ["meta", { property: "og:title", content: title }],
      ["meta", { property: "og:description", content: summary }],
      ["meta", { property: "og:url", content: `${hostname}${route}` }],
      ["meta", { property: "og:image", content: `${hostname}${socialImage.path}` }],
      ["meta", { property: "og:image:width", content: socialImage.size }],
      ["meta", { property: "og:image:height", content: socialImage.size }],
      ["meta", { property: "og:image:alt", content: "Syngraphe logo" }],
      // `summary`, not `summary_large_image`: the image is square and a wide card would crop it.
      ["meta", { name: "twitter:card", content: "summary" }],
    );

    // The structured data describes the project, not the page, so it belongs on the one page whose
    // subject is the project.
    if (route === "/") {
      head.push(["script", { type: "application/ld+json" }, JSON.stringify(structuredData)]);
    }
  },

  themeConfig: {
    // The mark is used bare: the dark mark on a light background, the light mark on a dark one.
    logo: {
      light: "/static/svg/logo-dark.svg",
      dark: "/static/svg/logo-light.svg",
      alt: "Syngraphe logo",
    },

    siteTitle: "Syngraphe",
    search: { provider: "local" },
    nav,
    sidebar,

    socialLinks: [{ icon: "github", link: repository }],

    outline: { level: [2, 3] },

    editLink: {
      pattern: `${repository}/edit/main/docs/:path`,
      text: "Edit this page on GitHub",
    },

    footer: {
      message: `Syngraphe v${packageVersion} · context schema v1 · <a href="${repository}">GitHub</a>`,
      copyright: "Licensed under Apache-2.0",
    },
  },
});
