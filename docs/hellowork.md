# 标题


# 标题

### 1
### 2
### 4
- `author`: 用于显示的作者的姓名。
- `author_url`: 作者的姓名所链接到的 URL。可以是 GitHub、Twitter、Facebook 个人资料链接等。
- `author_image_url`: 指向作者头像图片的链接。
- `author_title`: 作者简介。
- `title`: 文章标题。
- `slug`: 用于自定义文章的 url（`/<routeBasePath>/<slug>`）。支持多种模式：`slug: my-blog-post`、`slug: /my/path/to/blog/post`、slug: `/`。
- `date`: 用于设置文章的创建时间。如果未指定，则尝试从文件名中提取，例如 `2021-04-15-blog-post.mdx`。默认为 Markdown 文件的创建时间。
- `tags`: A list of strings or objects of two string fields `label` and `permalink` to tag to your post.
- `draft`: 这是一个布尔（boolean）值，表明此文章正在写作中，因此不发布。但是，草稿状态的文章在网站开发过程中是显示的。
- `description`: 文章的描述信息，将用于填充 `<head>` 标签中的 `<meta name="description" content="..."/>` 和 `<meta property="og:description" content="..."/>`，用于搜索引擎索引该文章。如果此字段未设置，则将使用文章正文第一行的内容代替。
- `keywords`: 设置文章的关键词，将用于填充 `<head>` 标签中的 `<meta name="keywords" content="keyword1,keyword2,..."/>`，供搜索引擎索引。
- `image`: 显示文章列表时所使用的封面图或缩略图。
- `hide_table_of_contents`: 是否隐藏文章的目录列表（显示在页面右侧）。默认为 `false`。

```jsx title="s"
console.log('Every repo must come with a mascot.');
```

```jsx {1}
function HighlightSomeText(highlight) {
  if (highlight) {
    return 'This text is highlighted!';
  }

  return 'Nothing highlighted';
}
```

```jsx title="/src/components/HelloCodeTitle.js"
function HelloCodeTitle(props) {
  return <h1>Hello, {props.name}</h1>;
}
```
