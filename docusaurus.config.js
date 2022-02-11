// const lightCodeTheme = require('prism-react-renderer/themes/github');
// const darkCodeTheme = require('prism-react-renderer/themes/dracula');
const math = require('remark-math');
const katex = require('rehype-katex');

// With JSDoc @type annotations, IDEs can provide config autocompletion
/** @type {import('@docusaurus/types').DocusaurusConfig} */
(module.exports = {
  // 网站的标题。
  title: '鲤鱼池',
  // 网站的标语
  tagline: '记录学习日常及杂七杂八的东西',
  // 网站的URL。这也可以被视为顶级主机名
  url: 'https://wiki.ioscarp.com',
  // 您网站的基本URL
  baseUrl: '/',
  onBrokenLinks: 'throw',
  onBrokenMarkdownLinks: 'warn',
  // 网站图标
  favicon: 'img/favicon.jpg',
  // GitHub用户或组织拥有此源代码存储库。部署命令（部署命令）将使用此参数。
  organizationName: 'carppond', // Usually your GitHub org/user name.
  // GitHub源代码存储库的名称。
  projectName: 'WiKi', // Usually your repo name.

  // 主题配置
  themeConfig:
    /** @type {import('@docusaurus/preset-classic').ThemeConfig} */
    ({
      hideableSidebar: false, // 让边栏可收起展开

      algolia: {
        // The application ID provided by Algolia
        appId: 'UK4D1HRBTC',
  
        // Public API key: it is safe to commit it
        apiKey: '4c0dd9fbd519ff9c148dd85383c7cbe2',
  
        indexName: 'wiki-power',
  
        // Optional: see doc section below
        contextualSearch: true,
  
        // Optional: Specify domains where the navigation should occur through window.location instead on history.push. Useful when our Algolia config crawls multiple documentation sites and we want to navigate with window.location.href to them.
        externalUrlRegex: 'external\\.com|domain\\.com',
  
        // Optional: Algolia search parameters
        searchParameters: {},
  
        //... other Algolia params
      },
      // algolia: {
      //   apiKey: "4c0dd9fbd519ff9c148dd85383c7cbe2",
      //   indexName: "wiki-power",
  
      //   // Optional: see doc section bellow
      //   contextualSearch: true,
  
      //   // Optional: Algolia search parameters
      //   searchParameters: {},
  
      //   //... other Algolia params
      // },
  
      colorMode: {

        disableSwitch: false,
        respectPrefersColorScheme: true,
    
        // Dark/light switch icon options
        switchConfig: {
          // Icon for the switch while in dark mode
          darkIcon: '🌙',
          lightIcon: '🌞',
    
          // CSS to apply to dark icon,
          // React inline style object
          // see https://reactjs.org/docs/dom-elements.html#style
          darkIconStyle: {
            marginLeft: "2px",
          },
    
          // Unicode icons such as '\u2600' will work
          // Unicode with 5 chars require brackets: '\u{1F602}'
          //lightIcon: '\u{1F602}',
    
          lightIconStyle: {
            marginLeft: "1px",
          },
        },
      },
      
      navbar: {
        title: "鲤鱼池", //导航上的站点名称
        hideOnScroll: false, // 文档页面向下滚动时收起顶部导航

        // logo: {
        //   alt: 'My Site Logo',
        //   src: 'img/logo.svg',
        // },
        items: [
          {
            href: 'https://ioscarp.com', // 点击后跳转的链接,站内跳转用 to,占位用 href
            label: "博客", // 显示的名称
            position: "right", // 显示在导航的左边还是右边
          },
          // {
          //   // href: "http://digest.wiki-power.com/",
          //   to: "blog",
          //   label: "书籍",
          //   position: "right",
          // },
          {
            href: 'https://github.com/carppond',
            label: 'GitHub',
            position: 'right',
          },
        ],
      },
      // footer: {
      //   style: 'dark',
      //   links: [
      //     {
      //       title: 'Docs',
      //       items: [
      //         {
      //           label: 'Tutorial',
      //           to: '/docs/intro',
      //         },
      //       ],
      //     },
      //     {
      //       title: 'Community',
      //       items: [
      //         {
      //           label: 'Stack Overflow',
      //           href: 'https://stackoverflow.com/questions/tagged/docusaurus',
      //         },
      //         {
      //           label: 'Discord',
      //           href: 'https://discordapp.com/invite/docusaurus',
      //         },
      //         {
      //           label: 'Twitter',
      //           href: 'https://twitter.com/docusaurus',
      //         },
      //       ],
      //     },
      //     {
      //       title: 'More',
      //       items: [
      //         {
      //           label: 'Blog',
      //           to: '/blog',
      //         },
      //         {
      //           label: 'GitHub',
      //           href: 'https://github.com/facebook/docusaurus',
      //         },
      //       ],
      //     },
      //   ],
      //   copyright: `Copyright © ${new Date().getFullYear()} My Project, Inc. Built with Docusaurus.`,
      // },
      // prism: {
      //   theme: lightCodeTheme,
      //   darkTheme: darkCodeTheme,
      // },
      prism: {
        theme: require('prism-react-renderer/themes/dracula'),
      },
    }),

  stylesheets: [
    {
      href: 'https://cdn.jsdelivr.net/npm/katex@0.13.11/dist/katex.min.css',
      integrity:
        'sha384-Um5gpz1odJg5Z4HAmzPtgZKdTBHZdw8S29IecapCSB31ligYPhHQZMIlWLYQGVoc',
      crossorigin: 'anonymous',
    },
  ],
  /** 预设所包含的插件或主题指定参数*/
  presets: [
    [
      '@docusaurus/preset-classic',
      /** @type {import('@docusaurus/preset-classic').Options} */
      ({
        docs: {
          sidebarCollapsible: true, //默认折叠
          routeBasePath: "/",
          sidebarPath: require.resolve("./sidebars.js"), // 侧边栏
          showLastUpdateAuthor: false,
          showLastUpdateTime: false,
          editUrl: "https://github.com/carppond/Wiki_Docusaurus/tree/edit/",
          remarkPlugins: [math],
          rehypePlugins: [katex],
        },
        blog: {
          //blogTitle: 'Power\'s blog!',
          //blogDescription: 'A docusaurus powered blog!',
          blogSidebarCount: 8,
          postsPerPage: 8,
          showReadingTime: false,
          path: 'blog',
          blogSidebarTitle: 'Recent',
          editUrl: 'https://github.com/carppond/Wiki_Docusaurus/tree/edit/',
          /*
          feedOptions: {
            type: 'all', // required. 'rss' | 'feed' | 'all'
            title: 'Power\'s Blog', // default to siteConfig.title
            description: '个人博客', // default to  `${siteConfig.title} Blog`
            copyright: 'Copyright © ${new Date().getFullYear()} Power Lin',
            language: undefined, // possible values: http://www.w3.org/TR/REC-html40/struct/dirlang.html#langcodes
          },
          */
        },
        theme: {
          customCss: require.resolve("./src/css/custom.css"),
        },
      }),
    ],
  ],
  
});
