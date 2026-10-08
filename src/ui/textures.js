// Crisp heraldic textures. Legacy CSS token names are kept for the existing touch controls.
const svgURL = body => 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(`<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 128 128">${body}</svg>`);
const crest = (variant = 'flame') => svgURL(`
  <path d="M64 6 107 23v39c0 27-25 49-43 60C46 111 21 89 21 62V23Z" fill="#171b20" stroke="#b99a61" stroke-width="2"/>
  <path d="M64 14 98 29v32c0 21-19 42-34 51C49 103 30 82 30 61V29Z" fill="none" stroke="#b99a61" stroke-opacity=".45"/>
  ${variant === 'flame' ? '<path d="M67 29c5 17-12 23-4 36 4-5 8-8 8-17 15 18 20 35 4 46-19 11-38-4-32-21 2-8 9-12 11-22 1 10 0 16 6 20-8-23 9-26 7-42Z" fill="#d8b879"/><path d="M62 76c-3 8-6 12 3 17 12-7 4-13-3-17Z" fill="#f6e1aa"/>' : variant === 'shield' ? '<path d="m42 44 22-9 22 9v21c0 14-12 26-22 32-10-6-22-18-22-32Z" fill="none" stroke="#eed4a0" stroke-width="3"/><path d="M64 40v49M48 59h32" stroke="#eed4a0" stroke-width="3"/>' : '<path d="M60 30h8v47l-4 16-4-16Z" fill="#eed4a0"/><path d="M43 70h42M64 25v-8" stroke="#b99a61" stroke-width="4"/>'}
  <path d="m64 2 4 4-4 4-4-4Z" fill="#eed4a0"/>`);
export async function buildTextures(root) {
  const line = svgURL('<path d="M3 64h122" stroke="white" stroke-width="7"/><path d="m2 64 10-7v14Zm124 0-10-7v14Z" fill="white"/>');
  const ring = svgURL('<circle cx="64" cy="64" r="56" fill="none" stroke="white" stroke-width="3"/><path d="M64 3v14m0 94v14M3 64h14m94 0h14" stroke="white" stroke-width="5"/>');
  const flare = svgURL('<path d="m64 8 6 44 32-26-25 33 43 5-43 5 25 33-32-26-6 44-6-44-32 26 25-33-43-5 43-5-25-33 32 26Z" fill="white"/>');
  const wash = svgURL('<rect x="2" y="2" width="124" height="124" rx="12" fill="white"/>');
  for (const key of ['stroke','stroke2','stroke3','thin','tick']) root.style.setProperty(`--t-${key}`, `url("${line}")`);
  for (const key of ['enso','enso2']) root.style.setProperty(`--t-${key}`, `url("${ring}")`);
  for (const key of ['splat','splat2']) root.style.setProperty(`--t-${key}`, `url("${flare}")`);
  root.style.setProperty('--t-wash', `url("${wash}")`);
  root.style.setProperty('--t-edge', 'radial-gradient(ellipse,transparent 40%,#000 95%)');
  return { seals: { title: crest(), sword: crest('sword'), parry: crest('shield'), victory: crest(), fall: crest('sword'), rest: crest('shield') } };
}
