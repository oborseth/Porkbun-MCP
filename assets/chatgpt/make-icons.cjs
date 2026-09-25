// Regenerate: node assets/chatgpt/make-icons.cjs (needs @resvg/resvg-js; paths below are this server's).
const fs = require("fs");
const { Resvg } = require("/var/www/buns-tools/node_modules/@resvg/resvg-js");
const src = fs.readFileSync("/var/www/html/owen.porkbun.com/images/porkbun.comphpPkl2eU.svg", "utf8");
// Keep the pig's white paths; drop the circle; put them on a full-bleed brand-pink square.
// Every path, in document order and in its own colour (the curly tail is a pink path drawn over the
// white body), minus the circle it used to sit in.
const paths = [...src.matchAll(/<path[\s\S]*?\/>/g)].map(m => m[0].replace(/class="st0"/, 'fill="#F27777"').replace(/class="st1"/, 'fill="#FFFFFF"')).join("\n");
if (!paths) throw new Error("no pig paths found");
// The pig sits within the old r=56 circle around (72,72). Scale it up a little so it reads at small sizes,
// but keep it well inside the square so rounded-corner masks never clip it.
const scale = 1.18;
const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 144 144">
<rect width="144" height="144" fill="#F27777"/>
<g transform="translate(72 72) scale(${scale}) translate(-72 -72)">${paths}</g>
</svg>`;
fs.writeFileSync("/var/www/porkbun-mcp/assets/chatgpt/icon-square.svg", svg);
for (const [name, size] of [["directory-icon.png", 1024], ["composer-icon.png", 96]]) {
  const png = new Resvg(svg, { fitTo: { mode: "width", value: size } }).render().asPng();
  fs.writeFileSync(`/var/www/porkbun-mcp/assets/chatgpt/${name}`, png);
  console.log(name, size + "x" + size, png.length, "bytes");
}
