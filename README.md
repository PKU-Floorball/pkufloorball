# PKU Floorball unified site

Homepage: https://pkufloorball.site/
Registration: https://pkufloorball.site/registration

## Vercel deployment

```bash
cd registration
npm ci
npm run prepare:association
npm exec --yes --package=vercel -- vercel deploy --prod --yes
```

The build script copies only index.html, htmls, assets, _layouts and _includes into association-source, then renders Liquid templates into public. Vercel rebuilds these files from the staged sources. Generated folders are ignored by Git; CLI uploads include association-source. Always run prepare:association from the full repository before deploying. Supabase and the admin password use the existing Vercel environment variables. Deployment does not reset the database.

Local: `cd registration && npm run dev`. Homepage: `/`; registration: `/registration`. See registration/README.md for registration details.

## Original GitHub Pages development

The GitHub Pages hosting configuration is retained. Original development instructions follow.

# 北京大学软式曲棍球协会主页

## 快速开始

### 直接打开
在浏览器中打开 [https://pku-floorball.github.io/pkufloorball/](https://pku-floorball.github.io/pkufloorball/) 。

### 本地运行
将本项目克隆到本地
```bash
git clone https://github.com/PKU-Floorball/pkufloorball.git
```

对于Windows系统用户需要安装 [Ruby](https://www.ruby-lang.org/en/downloads/)， 建议下载 3.2.9 版本。

安装 `Jekyll`
```bash
gem install bundler jekyll
jekyll -v
```

`cd` 进入项目目录，构建 `Jekyll` 项目
```bash
cd pkufloorball
jekyll new . --force
```

启动 `Jekyll` 服务
```bash
bundle exec jekyll serve
```
然后在浏览器中打开 [http://localhost:4000](http://localhost:4000) 即可看到效果。