# Tournament visual theme

Official PKU web red: **#94070A**. The PKU Visual Identity Office FAQ explicitly lists “C0 M100 Y100 K45; R139G0B18; 94070A”. The manual labels the hexadecimal value “Web”; the website follows that published web value rather than converting the separately listed RGB value.

Sources:
- https://vim.pku.edu.cn/cjwt/index.htm
- https://vim.pku.edu.cn/docs/20240527144814943256.pdf (A7)

All tournament routes share --red and --tournament-font. English uses Google Sans Flex; Chinese uses the same system sans fallback as the association homepage (whose Latin font is Source Sans 3). The tournament no longer forces its own Chinese font. Main association navigation keeps its existing styling.

The interactive ball rolls along a shared 3D rail under projected gravity and damping, slows near its turning point and returns to its starting position. Dragging, keyboard access, offscreen pausing and reduced motion remain supported. No registration or team business logic changed.

Player login now requires the name and four final phone digits. The server resolves the suffix privately and invokes the existing full-number login RPC; no SQL migration is required. Session cookies have no persistent expiry. A fresh tab clears a previous identity before loading the registration interface; reloads within the current tab retain it.
