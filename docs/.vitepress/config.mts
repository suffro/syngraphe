import { defineConfig, type HeadConfig } from "vitepress";
import pkg from "../../package.json" with { type: "json" };
import { markdownFileFor, recordPage, writeLlmsFiles } from "./llms.mjs";

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

// The share image: a composed 1280×640 banner. 2:1 is the shape X, Slack, Discord, LinkedIn and
// iMessage all render whole in a large card, so the mark, the name and the one-line claim survive
// the crop every client applies. Declaring the dimensions lets a client reserve the space before
// the file arrives, and the alt text is what a screen reader reads in place of the card.
const socialImage = {
  path: "/static/png/social-preview.png",
  width: "1280",
  height: "640",
  alt: "Syngraphe — keeps a repository's own context in a small .context/ managed directory",
};

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
    // Recording the page is what feeds llms.txt and the Markdown twins; see ./llms.mjs.
    const route = recordPage(pageData);

    const head: HeadConfig[] = (pageData.frontmatter.head ??= []);
    // `||`, not `??`: a page that declares no description gets an empty string rather than
    // undefined, and the home page is exactly that page.
    const title = pageData.frontmatter.title || pageData.title || "Syngraphe";
    const summary = pageData.frontmatter.description || pageData.description || description;

    head.push(
      ["link", { rel: "canonical", href: `${hostname}${route}` }],
      // The Markdown twin of this page, discoverable without asking for it. The Function in
      // `functions/` serves the same file to anything sending `Accept: text/markdown`, and
      // `PageActions.vue` reads this link rather than deriving the path a fourth time.
      [
        "link",
        {
          rel: "alternate",
          type: "text/markdown",
          href: `${hostname}/${markdownFileFor(route)}`,
        },
      ],
      ["meta", { property: "og:type", content: "website" }],
      ["meta", { property: "og:site_name", content: "Syngraphe" }],
      ["meta", { property: "og:title", content: title }],
      ["meta", { property: "og:description", content: summary }],
      ["meta", { property: "og:url", content: `${hostname}${route}` }],
      ["meta", { property: "og:image", content: `${hostname}${socialImage.path}` }],
      ["meta", { property: "og:image:type", content: "image/png" }],
      ["meta", { property: "og:image:width", content: socialImage.width }],
      ["meta", { property: "og:image:height", content: socialImage.height }],
      ["meta", { property: "og:image:alt", content: socialImage.alt }],
      // `summary_large_image`, not `summary`: the banner is 2:1, and the small card would crop it
      // to a square that cuts the wordmark off.
      ["meta", { name: "twitter:card", content: "summary_large_image" }],
      // X reads the Open Graph image, but not `og:image:alt`; this is the tag it does read.
      ["meta", { name: "twitter:image:alt", content: socialImage.alt }],
    );

    // The structured data describes the project, not the page, so it belongs on the one page whose
    // subject is the project.
    if (route === "/") {
      head.push(["script", { type: "application/ld+json" }, JSON.stringify(structuredData)]);
    }
  },

  // The Markdown surface, written after the pages are rendered: /llms.txt, /llms-full.txt and one
  // `.md` twin per page. See ./llms.mjs.
  async buildEnd(siteConfig) {
    const written = await writeLlmsFiles({
      outDir: siteConfig.outDir,
      srcDir: siteConfig.srcDir,
      hostname,
      version: packageVersion,
      sidebar,
      siteDescription: description,
    });
    console.log(
      `generated llms.txt (${written.indexed} pages, ${Math.round(written.indexBytes / 1024)} kB), ` +
        `llms-full.txt (${Math.round(written.fullBytes / 1024)} kB) ` +
        `and ${written.twins} Markdown page twins`,
    );
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

    footer: {
      message: `Syngraphe v${packageVersion} · context schema v1 · <a href="${repository}">GitHub</a> · <a href="/donate">Donate</a>`,
      copyright: "Licensed under Apache-2.0",
    },
  },
});
