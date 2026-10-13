# Third-party notices

The calculation module in `src/calculator.js` is adapted from the Offer 等效薪资计算器 by sherry-roar.

- Website: https://sherry-roar.github.io/offer-calculate/
- Source: https://github.com/sherry-roar/sherry-roar.github.io/tree/c8ff72bb9df1abd00935dd01adb5f430de1036f0/offer-calculate
- Upstream file: `offer-calculate/calculator.js`
- Source commit: `c8ff72bb9df1abd00935dd01adb5f430de1036f0`

The upstream MIT license follows in full.

MIT License

Copyright (c) 2026 sherry-roar

Permission is hereby granted, free of charge, to any person obtaining a copy
of this software and associated documentation files (the "Software"), to deal
in the Software without restriction, including without limitation the rights
to use, copy, modify, merge, publish, distribute, sublicense, and/or sell
copies of the Software, and to permit persons to whom the Software is
furnished to do so, subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY,
FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE
AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER
LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM,
OUT OF OR IN CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE
SOFTWARE.

## Cubic 11 pixel font

The unmodified font at `src/assets/Cubic11.woff2` is Cubic 11, obtained from
[TakWolf/fusion-pixel-font](https://github.com/TakWolf/fusion-pixel-font/tree/master/assets/fonts/cubic-11).
The downloaded file's Git blob SHA is `fa0ab5370dd0058b22acbf77dfc2afef8d0d8543`.

Its complete accompanying license, including Cubic 11, M+ FONTS PROJECT and SIL
Open Font License notices, is distributed unchanged at
[`public/fonts/Cubic11-LICENSE.txt`](public/fonts/Cubic11-LICENSE.txt).

Balatro-inspired layout references are documented in `DESIGN.md`. No Balatro
game sprites, sounds or original game font are distributed with this app.

## Balatro-Button pixel flame shader

`src/shaders/flame.frag` is from [mininxd/Balatro-Button](https://github.com/mininxd/Balatro-Button), licensed under Apache License 2.0. The shader algorithm is retained; `src/Flame.jsx` provides a new React renderer with visibility suspension, reduced-motion handling, resource cleanup and fallback. Full license: [public/licenses/Balatro-Button-APACHE-2.0.txt](public/licenses/Balatro-Button-APACHE-2.0.txt). No upstream fonts or game sprites are included.

## M6X11 and supplied effect references

M6X11 is a font by Daniel Linssen, supplied by the user. Its original attribution/usage note is distributed at `public/licenses/m6x11-read.txt` and the author is credited in the help dialog.

The user supplied LÖVE background, polychrome, flame and CRT shader references. Raw .fs references are not distributed in this repository. Runtime background/flame adaptations and the CSS CRT approximation are documented in README.md. The previous Balatro-Button Apache notice is retained for the earlier implementation; it does not assign that license to the supplied shader references.

The rating wax-seal vectors and card icons are authored for this interface, guided by the user’s visual references.
