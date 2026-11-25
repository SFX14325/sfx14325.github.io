export function applyThemeMode(state,mode){
 const theme=state.settings.theme||{},palette=theme[mode]||theme.dark||{};
 document.documentElement.classList.toggle("light",mode==="light");
 const map={bg:"--bg",panel:"--panel",panel2:"--panel2",text:"--text",muted:"--muted",line:"--line",accent:"--accent",hover:"--hover",reader:"--reader"};
 Object.entries(map).forEach(([key,variable])=>{if(palette[key])document.documentElement.style.setProperty(variable,palette[key]);});
 state.currentTheme=mode;
}
function applySettings(state){
 const settings=state.settings||{},appearance=settings.appearance||{};
 applyThemeMode(state,settings.theme?.default||"dark");
 if(appearance.panel_radius)document.documentElement.style.setProperty('--panel-radius',appearance.panel_radius);
 if(settings.media?.image_max_width)document.documentElement.style.setProperty('--image-max-width',settings.media.image_max_width);
 document.documentElement.classList.toggle('no_motion',appearance.motion_enabled===false);
 if(appearance.font_family)document.documentElement.style.setProperty("--font-family",appearance.font_family);
 if(appearance.base_font_size)document.documentElement.style.setProperty("--base-font-size",appearance.base_font_size);
}
export async function loadSettings(state){try{const r=await fetch(new URL("settings.json",document.baseURI));if(r.ok)state.settings=await r.json();}catch(e){console.warn("Using built-in appearance defaults",e);}applySettings(state);}
