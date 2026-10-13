# Local association site dependencies

These assets are bundled locally to avoid requiring visitors to reach external font/CDN/icon services. Builds do not download dependencies.

- Bootstrap 5.3.0-alpha3: https://github.com/twbs/bootstrap — MIT, full license in bootstrap/LICENSE.
- Swiper 9.4.1: https://github.com/nolimits4web/swiper — MIT, full license in swiper/LICENSE.
- Remix Icon 4.3.0: https://github.com/Remix-Design/RemixIcon — Apache-2.0, full license in remixicon/LICENSE.
- Oswald and Source Sans 3: Google Fonts distributions, SIL Open Font License 1.1; license files in fonts/.
- Icon SVG bodies are from the Iconify JSON collections listed in icon-sources.json; the selected source data is retained in icons.json.
  - Solar: 480 Design, CC BY 4.0: https://www.figma.com/community/file/1166831539721848736.
  - Phosphor: Phosphor Icons, MIT (Phosphor-LICENSE): https://github.com/phosphor-icons/core.
  - Ionicons: Ionic, MIT (Ionicons-LICENSE): https://github.com/ionic-team/ionicons.
  - Remix Icon: Remix Design, Apache-2.0: https://github.com/Remix-Design/RemixIcon.
  - Font Awesome Free icons: Fonticons, Inc., CC BY 4.0: https://fontawesome.com/license/free.

Icon shapes are unchanged, rendered as inline SVG instead of remotely fetched custom elements. CC BY 4.0: https://creativecommons.org/licenses/by/4.0/.

Font files use local content-hash names. Homepage image variants are generated during build with Sharp; original images remain available. Generated WebP filenames incorporate the input content hash and optimization settings.
